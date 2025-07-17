import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ScheduledEvent } from 'aws-lambda';
import { createTracedDynamoDBClient, traceExternalAPI } from './lib/tracing';

const docClient = createTracedDynamoDBClient();

const RATES_TABLE = process.env.RATES_TABLE_NAME!;
const FIXER_API_KEY = process.env.FIXER_API_KEY!;

interface FixerResponse {
  success: boolean;
  timestamp: number;
  base: string;
  date: string;
  rates: {
    [key: string]: number;
  };
  error?: {
    code: number;
    type: string;
    info?: string;
  };
}

export const handler = async (event: ScheduledEvent): Promise<void> => {
  console.log('Fetching exchange rates...');
  
  try {
    // Fetch EUR to INR and USD rates (free tier only supports EUR base)
    const fixerUrl = `http://data.fixer.io/api/latest?access_key=${FIXER_API_KEY}&symbols=INR,USD`;
    const response = await traceExternalAPI('Fixer.io', fixerUrl, () => 
      fetch(fixerUrl)
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch rates: ${response.statusText}`);
    }
    
    const data: FixerResponse = await response.json();
    
    if (!data.success) {
      console.error('Fixer API error:', data);
      throw new Error(`Fixer API error: ${data.error?.type || 'Unknown error'}`);
    }
    
    const eurToInr = data.rates.INR;
    const eurToUsd = data.rates.USD;
    
    if (!eurToInr || !eurToUsd) {
      throw new Error('Required rates not found in response');
    }
    
    // Calculate USD to INR rate
    const usdToInr = eurToInr / eurToUsd;
    console.log(`EUR/INR: ${eurToInr}, EUR/USD: ${eurToUsd}, Calculated USD/INR: ${usdToInr}`);
    
    const timestamp = Date.now();
    const ttl = Math.floor(timestamp / 1000) + (90 * 24 * 60 * 60); // 90 days TTL
    
    // Store the calculated USD-INR rate in DynamoDB
    const rateItem = {
      currencyPair: 'USD-INR',
      timestamp,
      rate: usdToInr,
      source: 'fixer.io',
      ttl,
    };
    
    await docClient.send(new PutCommand({
      TableName: RATES_TABLE,
      Item: rateItem,
    }));
    
    console.log(`Successfully stored rate: 1 USD = ${usdToInr.toFixed(4)} INR`);
    
    // Also store daily reference rate for comparison
    const dailyReferenceKey = `USD-INR-DAILY-${new Date().toISOString().split('T')[0]}`;
    await docClient.send(new PutCommand({
      TableName: RATES_TABLE,
      Item: {
        currencyPair: dailyReferenceKey,
        timestamp,
        rate: usdToInr,
        type: 'daily_reference',
        ttl,
      },
    }));
    
  } catch (error) {
    console.error('Error fetching rates:', error);
    throw error;
  }
};