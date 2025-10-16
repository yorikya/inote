/**
 * Shared WebSocket Client
 *
 * A robust and resilient WebSocket client with automatic reconnection,
 * message queuing, and exponential backoff.
 */
class SharedWebSocketClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.messageHandlers = new Map();
        this.messageQueue = [];
        this.reconnectAttempts = 0;
        this.maxReconnectDelay = 30000; // 30 seconds
        this.baseReconnectDelay = 1000; // 1 second
        this.state = 'CLOSED'; // States: CONNECTING, OPEN, CLOSED

        this.connect();

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('Page is now visible, checking WebSocket connection.');
                if (this.state !== 'OPEN') {
                    this.connect();
                }
            }
        });
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        this.state = 'CONNECTING';
        this.notifyHandlers('ws_connecting', {});

        try {
            this.ws = new WebSocket(this.url);
        } catch (error) {
            console.error('WebSocket instantiation failed:', error);
            this.handleConnectionClose();
            return;
        }

        this.ws.onopen = () => {
            this.state = 'OPEN';
            this.reconnectAttempts = 0;
            console.log('WebSocket connected');
            this.notifyHandlers('ws_open', {});
            this.flushMessageQueue();
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.notifyHandlers(msg.type, msg);
            } catch (error) {
                this.notifyHandlers('raw_message', event.data);
            }
        };

        this.ws.onclose = (event) => {
            console.log(`WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`);
            this.handleConnectionClose();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            // The onclose event will be fired next, which will handle reconnection.
        };
    }

    handleConnectionClose() {
        this.ws = null;
        if (this.state !== 'CLOSED') {
            this.state = 'CLOSED';
            this.notifyHandlers('ws_close', {});
        }
        this.scheduleReconnect();
    }

    scheduleReconnect() {
        if (this.reconnectAttempts > 0) {
            // If we've already tried to reconnect, don't schedule another one immediately.
            return;
        }
        this.reconnectAttempts++;
        const delay = this.getReconnectDelay();
        console.log(`Scheduling reconnect in ${delay}ms`);

        setTimeout(() => {
            this.reconnectAttempts = 0; // Reset for the next attempt
            this.connect();
        }, delay);
    }

    getReconnectDelay() {
        // Exponential backoff with jitter
        const exponentialBackoff = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
        const jitter = exponentialBackoff * 0.3 * Math.random();
        return Math.min(this.maxReconnectDelay, exponentialBackoff + jitter);
    }

    send(messageObject) {
        const message = JSON.stringify(messageObject);
        if (this.state === 'OPEN' && this.ws) {
            this.ws.send(message);
        } else {
            console.log('WebSocket not open. Queuing message.');
            this.messageQueue.push(message);
        }
    }

    flushMessageQueue() {
        console.log(`Flushing ${this.messageQueue.length} queued messages.`);
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.send(JSON.parse(message));
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
                    console.error(`Error in '${messageType}' handler:`, error);
                }
            });
        }
    }

    getState() {
        return this.state;
    }
}

// Create a global instance of the WebSocket client.
// The URL is constructed dynamically based on the page's hostname.
const wsUrl = `ws://${window.location.hostname}:30000`;
window.SharedWebSocket = new SharedWebSocketClient(wsUrl);

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedWebSocketClient;
}