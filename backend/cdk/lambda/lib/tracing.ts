// X-Ray tracing utilities
import * as AWSXRay from 'aws-xray-sdk-core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Enable X-Ray tracing for AWS SDK
export const createTracedDynamoDBClient = () => {
  const client = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
  return DynamoDBDocumentClient.from(client);
};

// Custom subsegment for external API calls
export const traceExternalAPI = async <T>(
  apiName: string,
  url: string,
  operation: () => Promise<T>
): Promise<T> => {
  const subsegment = AWSXRay.getSegment()?.addNewSubsegment(apiName);
  
  if (subsegment) {
    subsegment.addAnnotation('api_url', url);
    subsegment.addMetadata('request', { url, timestamp: new Date().toISOString() });
  }

  try {
    const result = await operation();
    subsegment?.addMetadata('response', { success: true });
    subsegment?.close();
    return result;
  } catch (error) {
    subsegment?.addError(error as Error);
    subsegment?.close();
    throw error;
  }
};