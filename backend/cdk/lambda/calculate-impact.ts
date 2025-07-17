import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const RATES_TABLE = process.env.RATES_TABLE_NAME!;
const ORDERS_TABLE = process.env.ORDERS_TABLE_NAME!;

interface CalculateImpactRequest {
  orderAmount: number;
  orderDate: string;
  fromCurrency: string;
  toCurrency: string;
  orderId?: string;
  storeId?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }
    
    const request: CalculateImpactRequest = JSON.parse(event.body);
    const { orderAmount, orderDate, fromCurrency, toCurrency, orderId, storeId } = request;
    
    if (!orderAmount || !orderDate || !fromCurrency || !toCurrency) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }
    
    const currencyPair = `${fromCurrency}-${toCurrency}`;
    const orderTimestamp = new Date(orderDate).getTime();
    
    // Get rate at order time (find closest rate)
    const orderRateResponse = await docClient.send(new QueryCommand({
      TableName: RATES_TABLE,
      KeyConditionExpression: 'currencyPair = :pair AND #ts <= :orderTime',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':pair': currencyPair,
        ':orderTime': orderTimestamp,
      },
      ScanIndexForward: false,
      Limit: 1,
    }));
    
    // Get current rate
    const currentRateResponse = await docClient.send(new QueryCommand({
      TableName: RATES_TABLE,
      KeyConditionExpression: 'currencyPair = :pair',
      ExpressionAttributeValues: {
        ':pair': currencyPair,
      },
      ScanIndexForward: false,
      Limit: 1,
    }));
    
    if (!orderRateResponse.Items?.length || !currentRateResponse.Items?.length) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Exchange rates not found' }),
      };
    }
    
    const orderRate = orderRateResponse.Items[0].rate;
    const currentRate = currentRateResponse.Items[0].rate;
    
    // Calculate impact
    const expectedInrAmount = orderAmount * orderRate;
    const currentInrAmount = orderAmount * currentRate;
    const marginLoss = expectedInrAmount - currentInrAmount;
    const percentageChange = ((currentRate - orderRate) / orderRate) * 100;
    
    // Store order data if orderId is provided
    if (orderId && storeId) {
      await docClient.send(new PutCommand({
        TableName: ORDERS_TABLE,
        Item: {
          orderId,
          storeId,
          orderDate,
          orderAmount,
          orderRate,
          currentRate,
          marginLoss,
          percentageChange,
          timestamp: Date.now(),
          ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year TTL
        },
      }));
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        orderRate,
        currentRate,
        expectedInrAmount,
        currentInrAmount,
        marginLoss,
        percentageChange,
        suggestion: marginLoss > orderAmount * 0.02 
          ? `Consider raising prices by ${Math.ceil(percentageChange)}% to maintain margins`
          : 'Margin impact is within acceptable range',
      }),
    };
  } catch (error) {
    console.error('Error calculating impact:', error);
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