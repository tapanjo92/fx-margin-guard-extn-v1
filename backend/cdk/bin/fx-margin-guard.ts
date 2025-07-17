#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FxMarginGuardStack } from '../lib/fx-margin-guard-stack';

const app = new cdk.App();

new FxMarginGuardStack(app, 'FxMarginGuardStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-south-1',
  },
  description: 'FX Margin Guard - Chrome Extension Backend for Shopify Sellers'
});

app.synth();