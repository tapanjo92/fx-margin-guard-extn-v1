# FX Margin Guard Chrome Extension v1

Track currency exchange impact on your Shopify profit margins in real-time.

## 🚀 Quick Start

### Chrome Extension Setup
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `fx-margin-guard-extn-v1` folder

### AWS Backend Deployment

```bash
cd backend/cdk
npm install
npm run bootstrap  # First time only
npm run deploy
```

## 📋 Features

- **Real-time FX tracking** on Shopify order pages
- **Margin loss alerts** when exchange rates impact profits
- **Daily/weekly impact summaries** in extension popup
- **Smart pricing suggestions** based on FX fluctuations

## 🏗️ Architecture

```
Chrome Extension (Frontend)
├── Content Script: Extracts order data from Shopify
├── Service Worker: Background rate fetching
└── Popup: Dashboard view

AWS Backend (CDK)
├── API Gateway: REST endpoints
├── Lambda Functions:
│   ├── fetch-rates: Gets USD/INR rates every 30 min
│   ├── calculate-impact: Computes margin loss
│   └── get-current-rate: Returns latest FX rate
├── DynamoDB Tables:
│   ├── fx-margin-guard-rates: Exchange rate history
│   └── fx-margin-guard-orders: Order tracking
└── EventBridge: Scheduled rate updates
```

## 🔧 Configuration

Update the API endpoint in:
- `src/content/shopify-order-tracker.js`
- `src/popup/popup.js`
- `src/background/service-worker.js`

Replace demo endpoint with your deployed API Gateway URL.

## 💰 Cost Estimate (AWS)

- **Lambda**: ~$0.20/month (1M requests)
- **DynamoDB**: ~$0.25/month (on-demand)
- **API Gateway**: ~$3.50/month (1M requests)
- **Total**: < $5/month for typical usage

## 🛡️ Security

- CORS configured for Chrome extension
- API throttling enabled (100 req/sec)
- DynamoDB encryption at rest
- No sensitive data stored

## 📊 Roadmap

- [ ] WhatsApp/SMS alerts
- [ ] Multi-currency support
- [ ] Shopify app version
- [ ] Bulk order analysis
- [ ] Export to Excel/CSV

---

Built with 💱 by FX Margin Guard Team