import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const RATES_TABLE = process.env.RATES_TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const from = event.queryStringParameters?.from || 'USD';
    const to = event.queryStringParameters?.to || 'INR';
    const currencyPair = `${from}-${to}`;
    
    // Get the latest rate
    const latestRateResponse = await docClient.send(new QueryCommand({
      TableName: RATES_TABLE,
      KeyConditionExpression: 'currencyPair = :pair',
      ExpressionAttributeValues: {
        ':pair': currencyPair,
      },
      ScanIndexForward: false, // Get latest first
      Limit: 1,
    }));
    
    if (!latestRateResponse.Items || latestRateResponse.Items.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'No rates found' }),
      };
    }
    
    const currentRate = latestRateResponse.Items[0];
    
    // Get daily reference rate for comparison
    const today = new Date().toISOString().split('T')[0];
    const dailyReferenceKey = `${currencyPair}-DAILY-${today}`;
    
    const dailyRateResponse = await docClient.send(new QueryCommand({
      TableName: RATES_TABLE,
      KeyConditionExpression: 'currencyPair = :pair',
      ExpressionAttributeValues: {
        ':pair': dailyReferenceKey,
      },
      Limit: 1,
    }));
    
    let dailyChange = 0;
    let dailyChangePercent = 0;
    
    if (dailyRateResponse.Items && dailyRateResponse.Items.length > 0) {
      const dailyRate = dailyRateResponse.Items[0].rate;
      dailyChange = currentRate.rate - dailyRate;
      dailyChangePercent = (dailyChange / dailyRate) * 100;
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        currencyPair,
        rate: currentRate.rate,
        timestamp: currentRate.timestamp,
        dailyChange,
        dailyChangePercent,
      }),
    };
  } catch (error) {
    console.error('Error getting current rate:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};