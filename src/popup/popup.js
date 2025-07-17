// FX Margin Guard - Popup Script

class FXMarginPopup {
  constructor() {
    this.API_ENDPOINT = 'https://fx-margin-guard-api.execute-api.ap-south-1.amazonaws.com/prod';
    this.initialize();
  }

  async initialize() {
    this.bindEventListeners();
    await this.loadCurrentRate();
    await this.loadRecentOrders();
    this.updateConnectionStatus(true);
  }

  bindEventListeners() {
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.refresh();
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  async loadCurrentRate() {
    try {
      const response = await fetch(`${this.API_ENDPOINT}/rates/current?from=USD&to=INR`);
      if (response.ok) {
        const data = await response.json();
        this.displayCurrentRate(data);
      }
    } catch (error) {
      console.error('Failed to load current rate:', error);
      this.updateConnectionStatus(false);
    }
  }

  displayCurrentRate(rateData) {
    document.getElementById('currentRate').textContent = `₹${rateData.rate.toFixed(2)}`;
    
    const changeElement = document.getElementById('rateChange');
    const change = rateData.dailyChange || 0;
    const changePercent = rateData.dailyChangePercent || 0;
    
    changeElement.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(2)}%)`;
    changeElement.className = `rate-change ${change >= 0 ? 'positive' : 'negative'}`;
    
    document.getElementById('lastUpdated').textContent = new Date(rateData.timestamp).toLocaleTimeString();
  }

  async loadRecentOrders() {
    try {
      // Get recent orders from Chrome storage
      const result = await chrome.storage.local.get(null);
      const orders = Object.entries(result)
        .filter(([key]) => key.startsWith('order_'))
        .map(([_, value]) => value)
        .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))
        .slice(0, 5);

      if (orders.length > 0) {
        this.displayOrders(orders);
        this.calculateSummaryStats(orders);
      } else {
        this.displayNoOrders();
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  }

  displayOrders(orders) {
    const ordersList = document.getElementById('ordersList');
    ordersList.innerHTML = orders.map(order => {
      const impactClass = order.marginLoss > 0 ? 'loss' : 'gain';
      return `
        <div class="order-item">
          <div class="order-info">
            <div class="order-id">Order #${order.orderId}</div>
            <div class="order-amount">$${order.orderAmountUSD.toFixed(2)} USD</div>
          </div>
          <div class="order-impact">
            <div class="impact-value ${impactClass}">
              ${order.marginLoss > 0 ? '-' : '+'}₹${Math.abs(order.marginLoss).toFixed(2)}
            </div>
            <div class="impact-percent">${order.percentageChange.toFixed(2)}%</div>
          </div>
        </div>
      `;
    }).join('');
  }

  displayNoOrders() {
    document.getElementById('ordersList').innerHTML = `
      <div class="loading">No orders tracked yet. Visit a Shopify order page to start tracking.</div>
    `;
  }

  calculateSummaryStats(orders) {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now.setDate(now.getDate() - 7));

    const todayImpact = orders
      .filter(order => new Date(order.orderDate) >= todayStart)
      .reduce((sum, order) => sum + (order.marginLoss || 0), 0);

    const weekImpact = orders
      .filter(order => new Date(order.orderDate) >= weekStart)
      .reduce((sum, order) => sum + (order.marginLoss || 0), 0);

    document.getElementById('todayImpact').textContent = `₹${Math.abs(todayImpact).toFixed(2)}`;
    document.getElementById('weekImpact').textContent = `₹${Math.abs(weekImpact).toFixed(2)}`;
  }

  updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    statusElement.textContent = connected ? 'Connected' : 'Offline';
    statusElement.className = `status-badge ${connected ? 'connected' : ''}`;
  }

  async refresh() {
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing...';
    
    await this.loadCurrentRate();
    await this.loadRecentOrders();
    
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Refresh';
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new FXMarginPopup();
});