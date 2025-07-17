# 🔍 FX Margin Guard - Observability Guide

## 🎯 What We've Set Up

### **1. AWS X-Ray Tracing** 
- End-to-end request tracing across all services
- See exact latency breakdowns
- Identify bottlenecks in real-time

### **2. CloudWatch Logs**
- Structured JSON logs from all Lambda functions
- API Gateway access logs with full request details
- 1-week retention (configurable)

### **3. CloudWatch Alarms**
- **FetchRatesErrorAlarm**: Triggers when rate fetching fails 2+ times
- **ApiErrorAlarm**: Triggers on 5+ API server errors in 10 minutes
- **ApiLatencyAlarm**: Triggers when p99 latency > 1 second

### **4. CloudWatch Dashboard**
- Real-time metrics visualization
- Lambda performance metrics
- API Gateway request patterns

### **5. Lambda Insights**
- Enhanced monitoring with memory, CPU, cold starts
- Automatic anomaly detection

---

## 📊 How to Monitor Your App

### **1. View X-Ray Service Map**
```bash
# In AWS Console
Services → X-Ray → Service Map

# What you'll see:
Chrome Extension → API Gateway → Lambda → DynamoDB
                                     ↓
                                  Fixer.io
```

### **2. Check CloudWatch Dashboard**
```bash
# Direct link after deployment:
https://console.aws.amazon.com/cloudwatch/home?region=ap-south-1#dashboards:name=fx-margin-guard-dashboard
```

### **3. Search Logs**
```bash
# Find errors in Lambda logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/FxMarginGuardStack-FetchRatesFunction \
  --filter-pattern "ERROR" \
  --region ap-south-1

# View API Gateway logs
aws logs tail /aws/apigateway/fx-margin-guard \
  --follow \
  --region ap-south-1
```

### **4. Trace a Request**
```bash
# Get trace summaries
aws xray get-trace-summaries \
  --time-range-type LastHour \
  --region ap-south-1

# Get detailed trace
aws xray get-traces \
  --trace-ids "1-5f3e1234-abcd1234abcd1234abcd1234" \
  --region ap-south-1
```

---

## 🚨 Alert Configuration

### **Email Alerts**
Set up before deployment:
```bash
export ALERT_EMAIL="your-email@example.com"
npm run deploy
```

### **Slack/Discord Alerts**
Add to CDK stack:
```typescript
// In fx-margin-guard-stack.ts
alertTopic.addSubscription(
  new snsSubscriptions.UrlSubscription('https://hooks.slack.com/YOUR_WEBHOOK')
);
```

---

## 📈 Key Metrics to Watch

### **Business Metrics**
1. **API Request Volume**: Orders being tracked
2. **Calculate Impact Calls**: Active users
3. **Error Rate**: User experience issues

### **Technical Metrics**
1. **Lambda Cold Starts**: First request latency
2. **DynamoDB Throttles**: Capacity issues
3. **External API Failures**: Fixer.io availability

---

## 🔧 Debugging Common Issues

### **"No trace data"**
```bash
# Check Lambda has X-Ray permissions
aws lambda get-function-configuration \
  --function-name FxMarginGuardStack-FetchRatesFunction \
  --query 'TracingConfig'
```

### **"Missing logs"**
```bash
# Ensure CloudWatch Logs permissions
aws iam get-role-policy \
  --role-name FxMarginGuardStack-FetchRatesFunctionRole \
  --policy-name CloudWatchLogsPolicy
```

### **"High latency"**
1. Check X-Ray traces for slow segments
2. Look for Lambda cold starts
3. Verify DynamoDB performance

---

## 💰 Cost Optimization

### **Current Setup Costs**
- X-Ray: First 100K traces free, then $5/million
- CloudWatch Logs: $0.50/GB ingested
- CloudWatch Dashboards: $3/dashboard/month
- Lambda Insights: $0.30/function/month

### **To Reduce Costs**
1. Decrease log retention to 3 days
2. Sample X-Ray traces (10% instead of 100%)
3. Use CloudWatch Logs Insights instead of dashboard

---

## 🎯 Maven's Monitoring Philosophy

> "If you can't measure it, you can't improve it. But don't over-monitor - focus on metrics that directly impact user experience and revenue."

**Essential Metrics Only**:
1. API success rate (>99.9%)
2. Response time (<200ms p50)
3. Error rate (<0.1%)
4. Daily active users

Everything else is noise until you hit 1000 users.