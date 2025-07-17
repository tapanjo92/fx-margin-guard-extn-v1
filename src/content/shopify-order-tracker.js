// FX Margin Guard - Content Script for Shopify Order Pages
// Extracts order data and calculates FX impact

class FXMarginTracker {
  constructor() {
    this.API_ENDPOINT = 'https://fx-margin-guard-api.execute-api.ap-south-1.amazonaws.com/prod';
    this.initializeTracking();
  }

  initializeTracking() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.extractOrderData());
    } else {
      this.extractOrderData();
    }
  }

  extractOrderData() {
    try {
      // Extract order details from Shopify admin page
      const orderData = this.parseShopifyOrderPage();
      
      if (orderData) {
        this.calculateFXImpact(orderData);
        this.injectFXDisplay(orderData);
      }
    } catch (error) {
      console.error('FX Margin Guard Error:', error);
    }
  }

  parseShopifyOrderPage() {
    // Check if we're on an order details page
    const orderIdMatch = window.location.pathname.match(/orders\/(\d+)/);
    if (!orderIdMatch) return null;

    const orderId = orderIdMatch[1];
    
    // Extract order amount (looking for USD amounts)
    const priceElements = document.querySelectorAll('[class*="Polaris-Text"]:not(script)');
    let orderAmountUSD = null;
    
    for (const elem of priceElements) {
      const text = elem.textContent;
      // Look for USD currency format
      if (text && text.includes('$') && text.match(/\$[\d,]+\.?\d*/)) {
        const amount = parseFloat(text.replace(/[$,]/g, ''));
        if (amount > 0 && !isNaN(amount)) {
          orderAmountUSD = amount;
          break;
        }
      }
    }

    // Extract order date
    const dateElements = document.querySelectorAll('time');
    let orderDate = new Date().toISOString();
    if (dateElements.length > 0) {
      orderDate = dateElements[0].getAttribute('datetime') || orderDate;
    }

    // Get store info from URL
    const storeMatch = window.location.hostname.match(/(.+)\.myshopify\.com/);
    const storeName = storeMatch ? storeMatch[1] : 'unknown';

    return {
      orderId,
      orderAmountUSD,
      orderDate,
      storeName,
      currentUrl: window.location.href
    };
  }

  async calculateFXImpact(orderData) {
    try {
      // Fetch current exchange rate and calculate impact
      const response = await fetch(`${this.API_ENDPOINT}/calculate-impact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderAmount: orderData.orderAmountUSD,
          orderDate: orderData.orderDate,
          fromCurrency: 'USD',
          toCurrency: 'INR'
        })
      });

      if (response.ok) {
        const impactData = await response.json();
        this.displayFXImpact(impactData, orderData);
        
        // Store in Chrome storage for popup access
        chrome.storage.local.set({
          [`order_${orderData.orderId}`]: {
            ...orderData,
            ...impactData,
            timestamp: Date.now()
          }
        });
      }
    } catch (error) {
      console.error('Failed to calculate FX impact:', error);
    }
  }

  injectFXDisplay(orderData) {
    // Create FX impact widget
    const fxWidget = document.createElement('div');
    fxWidget.id = 'fx-margin-guard-widget';
    fxWidget.className = 'fx-margin-widget';
    fxWidget.innerHTML = `
      <div class="fx-widget-header">
        <span class="fx-widget-title">💱 FX Margin Guard</span>
        <span class="fx-widget-status">Calculating...</span>
      </div>
      <div class="fx-widget-content">
        <div class="fx-loading">Fetching exchange rates...</div>
      </div>
    `;

    // Find a good place to inject (after order header)
    const orderHeader = document.querySelector('[class*="Page-Header"], h1');
    if (orderHeader && orderHeader.parentElement) {
      orderHeader.parentElement.insertAdjacentElement('afterend', fxWidget);
    }
  }

  displayFXImpact(impactData, orderData) {
    const widget = document.getElementById('fx-margin-guard-widget');
    if (!widget) return;

    const impactClass = impactData.marginLoss > 0 ? 'fx-loss' : 'fx-gain';
    const impactIcon = impactData.marginLoss > 0 ? '📉' : '📈';
    
    widget.querySelector('.fx-widget-content').innerHTML = `
      <div class="fx-metrics">
        <div class="fx-metric">
          <span class="fx-label">Order Amount:</span>
          <span class="fx-value">$${orderData.orderAmountUSD.toFixed(2)} USD</span>
        </div>
        <div class="fx-metric">
          <span class="fx-label">Exchange Rate at Order:</span>
          <span class="fx-value">₹${impactData.orderRate.toFixed(2)}</span>
        </div>
        <div class="fx-metric">
          <span class="fx-label">Current Rate:</span>
          <span class="fx-value">₹${impactData.currentRate.toFixed(2)}</span>
        </div>
        <div class="fx-metric ${impactClass}">
          <span class="fx-label">Margin Impact:</span>
          <span class="fx-value">${impactIcon} ₹${Math.abs(impactData.marginLoss).toFixed(2)} (${impactData.percentageChange.toFixed(2)}%)</span>
        </div>
      </div>
      ${impactData.marginLoss > 100 ? `
        <div class="fx-alert">
          ⚠️ Consider adjusting prices by ${Math.ceil(impactData.percentageChange)}% to maintain margins
        </div>
      ` : ''}
    `;

    widget.querySelector('.fx-widget-status').textContent = 'Live';
  }
}

// Initialize tracker
new FXMarginTracker();