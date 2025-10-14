/**
 * Shared WebSocket Client
 * Provides a persistent WebSocket connection across all pages
 * Uses Service Worker to maintain connection even when pages are navigated
 */

class SharedWebSocketClient {
  constructor() {
    this.connected = false;
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.serviceWorkerReady = false;
    this.init();
  }

  init() {
    // Register service worker if not already registered
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').then(reg => {
        console.log('Service Worker registered for SharedWebSocket:', reg);
        this.serviceWorkerReady = true;
        this.requestConnectionStatus();
      }).catch(err => {
        console.error('Service Worker registration failed:', err);
        this.fallbackToDirectConnection();
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', event => {
        this.handleServiceWorkerMessage(event);
      });

      // Listen for service worker controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        this.serviceWorkerReady = true;
        this.requestConnectionStatus();
      });
    } else {
      console.warn('Service Workers not supported, falling back to direct connection');
      this.fallbackToDirectConnection();
    }
  }

  fallbackToDirectConnection() {
    // Fallback to direct WebSocket connection if service worker is not available
    console.log('Using fallback direct WebSocket connection');
    this.connectDirectly();
  }

  connectDirectly() {
    // This would be used if service worker is not available
    // For now, we'll rely on the service worker approach
    console.log('Direct connection not implemented, using service worker approach');
  }

  requestConnectionStatus() {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('REQUEST_WS_STATUS');
    }
  }

  handleServiceWorkerMessage(event) {
    try {
      const msg = JSON.parse(event.data);
      console.log("SharedWebSocket: Received message:", msg.type, msg);

      switch (msg.type) {
        case 'ws_open':
          this.connected = true;
          this.reconnectAttempts = 0;
          this.notifyHandlers('ws_open', msg);
          break;
        case 'ws_close':
          this.connected = false;
          this.notifyHandlers('ws_close', msg);
          this.attemptReconnect();
          break;
        case 'ws_error':
          this.connected = false;
          this.notifyHandlers('ws_error', msg);
          this.attemptReconnect();
          break;
        default:
          this.notifyHandlers(msg.type, msg);
      }
    } catch (error) {
      console.log("SharedWebSocket: Received non-JSON message:", event.data, error);
      this.notifyHandlers('raw_message', event.data);
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => {
        this.requestConnectionStatus();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  send(messageObject) {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(JSON.stringify(messageObject));
    } else {
      console.error("Service worker not in control. Cannot send message.");
      // Store message for retry when connection is restored
      this.storeMessageForRetry(messageObject);
    }
  }

  storeMessageForRetry(messageObject) {
    // Store messages in localStorage for retry when connection is restored
    const storedMessages = JSON.parse(localStorage.getItem('pendingMessages') || '[]');
    storedMessages.push({
      message: messageObject,
      timestamp: Date.now()
    });
    localStorage.setItem('pendingMessages', JSON.stringify(storedMessages));
  }

  retryStoredMessages() {
    const storedMessages = JSON.parse(localStorage.getItem('pendingMessages') || '[]');
    if (storedMessages.length > 0) {
      console.log(`Retrying ${storedMessages.length} stored messages`);
      storedMessages.forEach(({ message }) => {
        this.send(message);
      });
      localStorage.removeItem('pendingMessages');
    }
  }

  registerHandler(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType).push(handler);
  }

  unregisterHandler(messageType, handler) {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  notifyHandlers(messageType, data) {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      });
    }
  }

  isConnected() {
    return this.connected;
  }

  getConnectionStatus() {
    return {
      connected: this.connected,
      serviceWorkerReady: this.serviceWorkerReady,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Create global instance
window.SharedWebSocket = new SharedWebSocketClient();

// Auto-retry stored messages when connection is restored
window.SharedWebSocket.registerHandler('ws_open', () => {
  window.SharedWebSocket.retryStoredMessages();
});

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SharedWebSocketClient;
}
