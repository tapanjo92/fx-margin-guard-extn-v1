# 🚀 FX Margin Guard - Deployment Guide

## Prerequisites

1. **AWS CLI** configured with credentials
2. **Node.js** 18.x or higher
3. **Fixer.io API Key** (Get free at https://fixer.io)

## Step 1: Get Fixer.io API Key

1. Go to https://fixer.io/signup/free
2. Sign up for free account (100 requests/month)
3. Copy your API access key

## Step 2: Set Environment Variables

```bash
# Set your Fixer API key
export FIXER_API_KEY="your_fixer_api_key_here"

# Set AWS region (Mumbai)
export AWS_REGION=ap-south-1
export CDK_DEFAULT_REGION=ap-south-1
```

## Step 3: Deploy CDK Stack

```bash
cd backend/cdk

# Install dependencies
npm install

# Bootstrap CDK (first time only)
npm run bootstrap

# Deploy the stack
npm run deploy
```

## Step 4: Update Chrome Extension

After deployment completes, you'll see output like:
```
Outputs:
FxMarginGuardStack.ApiEndpoint = https://xxxxx.execute-api.ap-south-1.amazonaws.com/prod
```

Update this URL in all extension files:
- `src/content/shopify-order-tracker.js`
- `src/popup/popup.js`
- `src/background/service-worker.js`
- `manifest.json`

## Step 5: Load Extension in Chrome

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `fx-margin-guard-extn-v1` folder

## 🔍 Verify Deployment

### Test Lambda Function
```bash
# Trigger rate fetch manually
aws lambda invoke \
  --function-name FxMarginGuardStack-FetchRatesFunction \
  --region ap-south-1 \
  output.json
```

### Check DynamoDB
```bash
# View stored rates
aws dynamodb scan \
  --table-name fx-margin-guard-rates \
  --region ap-south-1
```

### Test API Endpoint
```bash
# Get current rate
curl https://your-api-id.execute-api.ap-south-1.amazonaws.com/prod/rates/current?from=USD&to=INR
```

## 💰 Cost Breakdown

- **Fixer.io Free**: 100 requests/month
- **Fixer.io Basic**: $9.99/month for 10,000 requests
- **AWS costs**: ~$5/month for typical usage

## 🚨 Production Checklist

- [ ] Use paid Fixer.io plan for more requests
- [ ] Set up CloudWatch alarms for errors
- [ ] Enable API Gateway logging
- [ ] Configure CORS for your domain only
- [ ] Add API key authentication
- [ ] Set up budget alerts in AWS

## 📞 Support

Issues? Check CloudWatch logs:
```bash
aws logs tail /aws/lambda/FxMarginGuardStack-FetchRatesFunction --follow
```