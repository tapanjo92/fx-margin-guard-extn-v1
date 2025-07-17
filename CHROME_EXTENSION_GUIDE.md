# 🎯 Chrome Extension Setup - Complete Beginner Guide

## 📋 Prerequisites
- Chrome browser installed
- AWS CDK deployment completed (you should have an API endpoint URL)

---

## 🚀 Step-by-Step Setup

### **Step 1: Get Your API Endpoint**

After running `npm run deploy`, look for this in the output:
```
Outputs:
FxMarginGuardStack.ApiEndpoint = https://xxxxx.execute-api.ap-south-1.amazonaws.com/prod
                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                  Copy this entire URL!
```

### **Step 2: Update Extension with Your API**

Run this command with YOUR API endpoint:
```bash
./update-api-endpoint.sh https://YOUR-API-ID.execute-api.ap-south-1.amazonaws.com/prod
```

### **Step 3: Load Extension in Chrome**

1. **Open Chrome Extension Manager**
   - Type in address bar: `chrome://extensions/`
   - OR: Click 3 dots menu → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Look for toggle in top-right corner
   - Turn it ON (it should be blue)

3. **Load Your Extension**
   - Click "Load unpacked" button
   - Navigate to `/root/fx-margin-guard-extn-v1` folder
   - Click "Select Folder"

4. **Success!**
   - You'll see "FX Margin Guard for Shopify" in your extensions
   - Pin it by clicking the puzzle icon in toolbar

---

## 🧪 Testing Your Extension

### **Test 1: Check Popup Works**
1. Click the FX icon in Chrome toolbar
2. You should see:
   - Current USD/INR rate
   - "Connected" status

### **Test 2: Visit Shopify Order Page**
1. Go to any Shopify admin order page:
   - `https://YOUR-STORE.myshopify.com/admin/orders/12345`
   - OR: `https://admin.shopify.com/store/YOUR-STORE/orders/12345`

2. Look for the FX widget that appears showing:
   - Order amount in USD
   - Exchange rate impact
   - Margin loss/gain

---

## 🔧 Troubleshooting

### **"Manifest file is missing or unreadable"**
- Make sure you selected the `fx-margin-guard-extn-v1` folder, not a parent folder

### **API Not Working**
1. Check Console (F12 → Console tab)
2. Look for CORS errors
3. Make sure you updated the API endpoint correctly

### **Extension Not Showing on Shopify**
1. Refresh the Shopify page
2. Check if URL matches patterns in manifest.json
3. Try disabling other extensions

---

## 📦 Package for Distribution

When ready to share with others:

```bash
# Create a .zip file
cd /root
zip -r fx-margin-guard-extension.zip fx-margin-guard-extn-v1/ \
  -x "*/node_modules/*" \
  -x "*/.git/*" \
  -x "*/backend/*"
```

Share the .zip file - users can load it the same way!

---

## 🎨 Customize Icons (Optional)

1. Create your icons:
   - 16x16 pixels (toolbar)
   - 48x48 pixels (extensions page)
   - 128x128 pixels (Chrome Web Store)

2. Save as PNG in `assets/icons/`

3. Names must match:
   - `icon-16.png`
   - `icon-48.png`
   - `icon-128.png`

---

## 🚀 Next Steps

1. **Test with Real Orders**: Visit actual Shopify order pages
2. **Monitor Usage**: Check AWS CloudWatch for API calls
3. **Get Feedback**: Share with 5-10 beta users
4. **Iterate**: Add features based on feedback

---

## 💡 Pro Tips

- **Auto-reload**: After code changes, click refresh icon in chrome://extensions/
- **Debug**: Right-click extension icon → "Inspect popup" for popup debugging
- **Logs**: Check background script logs in chrome://extensions/ → "Service Worker"

---

Maven says: *"Ship it to 10 users TODAY. Don't wait for perfection. You'll learn more from 10 real users than 100 hours of solo development."*