import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export class FxMarginGuardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    const exchangeRatesTable = new dynamodb.Table(this, 'ExchangeRatesTable', {
      tableName: 'fx-margin-guard-rates',
      partitionKey: { name: 'currencyPair', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const ordersTable = new dynamodb.Table(this, 'OrdersTable', {
      tableName: 'fx-margin-guard-orders',
      partitionKey: { name: 'orderId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'storeId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for querying by store
    ordersTable.addGlobalSecondaryIndex({
      indexName: 'storeIndex',
      partitionKey: { name: 'storeId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'orderDate', type: dynamodb.AttributeType.STRING },
    });

    // Lambda Functions
    const fetchRatesFunction = new NodejsFunction(this, 'FetchRatesFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/fetch-rates.ts'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        RATES_TABLE_NAME: exchangeRatesTable.tableName,
        FIXER_API_KEY: process.env.FIXER_API_KEY || 'YOUR_FIXER_API_KEY_HERE',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const calculateImpactFunction = new NodejsFunction(this, 'CalculateImpactFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/calculate-impact.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: {
        RATES_TABLE_NAME: exchangeRatesTable.tableName,
        ORDERS_TABLE_NAME: ordersTable.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const getCurrentRateFunction = new NodejsFunction(this, 'GetCurrentRateFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/get-current-rate.ts'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        RATES_TABLE_NAME: exchangeRatesTable.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions
    exchangeRatesTable.grantReadWriteData(fetchRatesFunction);
    exchangeRatesTable.grantReadData(calculateImpactFunction);
    exchangeRatesTable.grantReadData(getCurrentRateFunction);
    ordersTable.grantReadWriteData(calculateImpactFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'FxMarginGuardApi', {
      restApiName: 'FX Margin Guard API',
      description: 'API for FX Margin Guard Chrome Extension',
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // API Routes
    const rates = api.root.addResource('rates');
    const currentRate = rates.addResource('current');
    currentRate.addMethod('GET', new apigateway.LambdaIntegration(getCurrentRateFunction));

    const calculateImpact = api.root.addResource('calculate-impact');
    calculateImpact.addMethod('POST', new apigateway.LambdaIntegration(calculateImpactFunction));

    // EventBridge Rule for scheduled rate fetching
    const fetchRatesRule = new events.Rule(this, 'FetchRatesRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(30)),
      description: 'Fetch exchange rates every 30 minutes',
    });

    fetchRatesRule.addTarget(new targets.LambdaFunction(fetchRatesFunction));

    // Output the API endpoint
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'FX Margin Guard API Endpoint',
      exportName: 'FxMarginGuardApiEndpoint',
    });

    // Output table names
    new cdk.CfnOutput(this, 'RatesTableName', {
      value: exchangeRatesTable.tableName,
      description: 'Exchange Rates DynamoDB Table Name',
    });

    new cdk.CfnOutput(this, 'OrdersTableName', {
      value: ordersTable.tableName,
      description: 'Orders DynamoDB Table Name',
    });
  }
}