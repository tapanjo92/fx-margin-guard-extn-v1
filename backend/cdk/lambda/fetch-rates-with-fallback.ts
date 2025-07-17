import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ScheduledEvent } from 'aws-lambda';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

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
    info: string;
  };
}

interface FallbackResponse {
  rates: {
    [key: string]: number;
  };
  base: string;
  date: string;
}

async function fetchFromFixer(): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.fixer.io/latest?access_key=${FIXER_API_KEY}&base=USD&symbols=INR`
    );
    
    const data: FixerResponse = await response.json();
    
    if (!data.success) {
      console.error('Fixer API error:', data.error);
      
      // Check if it's a usage limit error
      if (data.error?.code === 104) {
        console.log('Fixer.io monthly limit reached, using fallback');
        return null;
      }
      
      throw new Error(`Fixer API error: ${data.error?.info || 'Unknown error'}`);
    }
    
    return data.rates.INR;
  } catch (error) {
    console.error('Fixer.io fetch error:', error);
    return null;
  }
}

async function fetchFromFallback(): Promise<number> {
  try {
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/USD`
    );
    
    if (!response.ok) {
      throw new Error(`Fallback API failed: ${response.statusText}`);
    }
    
    const data: FallbackResponse = await response.json();
    return data.rates.INR;
  } catch (error) {
    console.error('Fallback API error:', error);
    throw error;
  }
}

export const handler = async (event: ScheduledEvent): Promise<void> => {
  console.log('Fetching exchange rates...');
  
  try {
    // Try Fixer.io first
    let inrRate = await fetchFromFixer();
    let source = 'fixer.io';
    
    // If Fixer fails (e.g., limit reached), use fallback
    if (!inrRate) {
      console.log('Using fallback exchange rate API');
      inrRate = await fetchFromFallback();
      source = 'exchangerate-api';
    }
    
    if (!inrRate) {
      throw new Error('No exchange rate available from any source');
    }
    
    const timestamp = Date.now();
    const ttl = Math.floor(timestamp / 1000) + (90 * 24 * 60 * 60); // 90 days TTL
    
    // Store the rate in DynamoDB
    const rateItem = {
      currencyPair: 'USD-INR',
      timestamp,
      rate: inrRate,
      source,
      ttl,
    };
    
    await docClient.send(new PutCommand({
      TableName: RATES_TABLE,
      Item: rateItem,
    }));
    
    console.log(`Successfully stored rate: 1 USD = ${inrRate} INR (source: ${source})`);
    
    // Also store daily reference rate for comparison
    const dailyReferenceKey = `USD-INR-DAILY-${new Date().toISOString().split('T')[0]}`;
    await docClient.send(new PutCommand({
      TableName: RATES_TABLE,
      Item: {
        currencyPair: dailyReferenceKey,
        timestamp,
        rate: inrRate,
        type: 'daily_reference',
        source,
        ttl,
      },
    }));
    
  } catch (error) {
    console.error('Error fetching rates:', error);
    throw error;
  }
};