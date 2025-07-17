// FX Margin Guard - Service Worker
// Handles background tasks and API communication

const API_ENDPOINT = 'https://fx-margin-guard-api.execute-api.ap-south-1.amazonaws.com/prod';

// Set up alarms for periodic rate updates
chrome.runtime.onInstalled.addListener(() => {
  console.log('FX Margin Guard installed');
  
  // Create alarm to fetch rates every 30 minutes
  chrome.alarms.create('fetchRates', { periodInMinutes: 30 });
  
  // Fetch initial rates
  fetchAndStoreRates();
});

// Handle alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'fetchRates') {
    fetchAndStoreRates();
  }
});

// Fetch current exchange rates
async function fetchAndStoreRates() {
  try {
    const response = await fetch(`${API_ENDPOINT}/rates/current?from=USD&to=INR`);
    if (response.ok) {
      const rateData = await response.json();
      
      // Store in Chrome storage
      chrome.storage.local.set({
        currentRate: rateData,
        lastFetched: Date.now()
      });
      
      // Check for significant rate changes
      checkRateAlert(rateData);
    }
  } catch (error) {
    console.error('Failed to fetch rates:', error);
  }
}

// Check if rate change warrants an alert
async function checkRateAlert(currentRateData) {
  const { previousRate } = await chrome.storage.local.get('previousRate');
  
  if (previousRate) {
    const changePercent = Math.abs((currentRateData.rate - previousRate.rate) / previousRate.rate * 100);
    
    // Alert if change is more than 2%
    if (changePercent > 2) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/assets/icons/icon-128.png',
        title: 'FX Rate Alert!',
        message: `USD/INR rate changed by ${changePercent.toFixed(2)}%. Current rate: ₹${currentRateData.rate.toFixed(2)}`,
        priority: 2
      });
    }
  }
  
  // Store current rate as previous for next comparison
  chrome.storage.local.set({ previousRate: currentRateData });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'calculateImpact') {
    calculateFXImpact(request.data)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }
});

// Calculate FX impact for an order
async function calculateFXImpact(orderData) {
  try {
    const response = await fetch(`${API_ENDPOINT}/calculate-impact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData)
    });
    
    if (response.ok) {
      return await response.json();
    } else {
      throw new Error('Failed to calculate impact');
    }
  } catch (error) {
    console.error('Impact calculation error:', error);
    throw error;
  }
}