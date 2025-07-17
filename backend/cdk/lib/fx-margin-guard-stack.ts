import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as xray from 'aws-cdk-lib/aws-xray';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
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

    // Create SNS topic for alerts
    const alertTopic = new sns.Topic(this, 'FxMarginAlerts', {
      topicName: 'fx-margin-guard-alerts',
      displayName: 'FX Margin Guard Alerts',
    });

    // Add email subscription if provided
    if (process.env.ALERT_EMAIL) {
      alertTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(process.env.ALERT_EMAIL)
      );
    }

    // Lambda Functions with X-Ray tracing
    const fetchRatesFunction = new NodejsFunction(this, 'FetchRatesFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/fetch-rates.ts'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        RATES_TABLE_NAME: exchangeRatesTable.tableName,
        FIXER_API_KEY: process.env.FIXER_API_KEY || '01d8965bb736c4eb4e16db355124de26',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_229_0,
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
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_229_0,
    });

    const getCurrentRateFunction = new NodejsFunction(this, 'GetCurrentRateFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/get-current-rate.ts'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        RATES_TABLE_NAME: exchangeRatesTable.tableName,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_229_0,
    });

    // Grant permissions
    exchangeRatesTable.grantReadWriteData(fetchRatesFunction);
    exchangeRatesTable.grantReadData(calculateImpactFunction);
    exchangeRatesTable.grantReadData(getCurrentRateFunction);
    ordersTable.grantReadWriteData(calculateImpactFunction);

    // Create CloudWatch Log Group for API Gateway
    const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayLogs', {
      logGroupName: '/aws/apigateway/fx-margin-guard',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // API Gateway with full observability
    const api = new apigateway.RestApi(this, 'FxMarginGuardApi', {
      restApiName: 'FX Margin Guard API',
      description: 'API for FX Margin Guard Chrome Extension',
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        tracingEnabled: true,
        dataTraceEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amzn-Trace-Id'],
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

    // CloudWatch Alarms
    const fetchRatesErrorAlarm = new cloudwatch.Alarm(this, 'FetchRatesErrorAlarm', {
      metric: fetchRatesFunction.metricErrors({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 2,
      evaluationPeriods: 1,
      alarmDescription: 'Alert when fetch rates function fails',
    });

    const apiErrorAlarm = new cloudwatch.Alarm(this, 'ApiErrorAlarm', {
      metric: api.metricServerError({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 2,
      alarmDescription: 'Alert when API has server errors',
    });

    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      metric: api.metricLatency({
        period: cdk.Duration.minutes(5),
        statistic: 'p99',
      }),
      threshold: 1000, // 1 second
      evaluationPeriods: 2,
      alarmDescription: 'Alert when API latency is high',
    });

    // Add SNS notifications for alarms
    fetchRatesErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));
    apiErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));
    apiLatencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));

    // CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'FxMarginGuardDashboard', {
      dashboardName: 'fx-margin-guard-dashboard',
      defaultInterval: cdk.Duration.hours(1),
    });

    // Lambda metrics row
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        left: [
          fetchRatesFunction.metricInvocations(),
          calculateImpactFunction.metricInvocations(),
          getCurrentRateFunction.metricInvocations(),
        ],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: [
          fetchRatesFunction.metricErrors(),
          calculateImpactFunction.metricErrors(),
          getCurrentRateFunction.metricErrors(),
        ],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration',
        left: [
          fetchRatesFunction.metricDuration(),
          calculateImpactFunction.metricDuration(),
          getCurrentRateFunction.metricDuration(),
        ],
        width: 8,
      })
    );

    // API Gateway metrics row
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Requests',
        left: [api.metricCount()],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Latency',
        left: [
          api.metricLatency({ statistic: 'avg' }),
          api.metricLatency({ statistic: 'p99' }),
        ],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Errors',
        left: [
          api.metricClientError(),
          api.metricServerError(),
        ],
        width: 8,
      })
    );

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