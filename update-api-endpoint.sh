#!/bin/bash

# This script updates all API endpoints in the Chrome extension
# Usage: ./update-api-endpoint.sh YOUR_API_ENDPOINT

if [ -z "$1" ]; then
    echo "❌ Please provide your API endpoint"
    echo "Usage: ./update-api-endpoint.sh https://your-api-id.execute-api.ap-south-1.amazonaws.com/prod"
    exit 1
fi

NEW_ENDPOINT=$1
OLD_ENDPOINT="https://fx-margin-guard-api.execute-api.ap-south-1.amazonaws.com/prod"

echo "🔄 Updating API endpoints from:"
echo "   $OLD_ENDPOINT"
echo "   to: $NEW_ENDPOINT"

# Update all files
sed -i "s|$OLD_ENDPOINT|$NEW_ENDPOINT|g" src/content/shopify-order-tracker.js
sed -i "s|$OLD_ENDPOINT|$NEW_ENDPOINT|g" src/popup/popup.js
sed -i "s|$OLD_ENDPOINT|$NEW_ENDPOINT|g" src/background/service-worker.js
sed -i "s|$OLD_ENDPOINT|$NEW_ENDPOINT|g" manifest.json

echo "✅ API endpoints updated successfully!"
echo ""
echo "Next steps:"
echo "1. Open Chrome and go to: chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. Click 'Load unpacked'"
echo "4. Select this folder: $(pwd)"
echo "5. The extension is now installed!"