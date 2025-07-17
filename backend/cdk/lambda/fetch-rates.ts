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
}

export const handler = async (event: ScheduledEvent): Promise<void> => {
  console.log('Fetching exchange rates...');
  
  try {
    // Fetch USD to INR rate using Fixer.io with X-Ray tracing
    const fixerUrl = `https://api.fixer.io/latest?access_key=${FIXER_API_KEY}&base=USD&symbols=INR`;
    const response = await traceExternalAPI('Fixer.io', fixerUrl, () => 
      fetch(fixerUrl)
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch rates: ${response.statusText}`);
    }
    
    const data: FixerResponse = await response.json();
    
    if (!data.success) {
      throw new Error(`Fixer API error: ${JSON.stringify(data)}`);
    }
    
    const inrRate = data.rates.INR;
    
    if (!inrRate) {
      throw new Error('INR rate not found in response');
    }
    
    const timestamp = Date.now();
    const ttl = Math.floor(timestamp / 1000) + (90 * 24 * 60 * 60); // 90 days TTL
    
    // Store the rate in DynamoDB
    const rateItem = {
      currencyPair: 'USD-INR',
      timestamp,
      rate: inrRate,
      source: 'fixer.io',
      ttl,
    };
    
    await docClient.send(new PutCommand({
      TableName: RATES_TABLE,
      Item: rateItem,
    }));
    
    console.log(`Successfully stored rate: 1 USD = ${inrRate} INR`);
    
    // Also store daily reference rate for comparison
    const dailyReferenceKey = `USD-INR-DAILY-${new Date().toISOString().split('T')[0]}`;
    await docClient.send(new PutCommand({
      TableName: RATES_TABLE,
      Item: {
        currencyPair: dailyReferenceKey,
        timestamp,
        rate: inrRate,
        type: 'daily_reference',
        ttl,
      },
    }));
    
  } catch (error) {
    console.error('Error fetching rates:', error);
    throw error;
  }
};