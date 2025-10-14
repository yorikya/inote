let ws;
// Use the hostname of the service worker to construct the WebSocket URL.
const wsUrl = `ws://${self.location.hostname}:30000`;
console.log(`[ServiceWorker] WebSocket URL: ${wsUrl}`);

let reconnectInterval = 3000;
let reconnectTimer = null;

function connect() {
    console.log('[ServiceWorker] Attempting to connect...');
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (ws && ws.readyState !== WebSocket.CLOSED) {
        console.log('[ServiceWorker] WebSocket already open or connecting.');
        return;
    }

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('[ServiceWorker] WebSocket connected');
        broadcast({ type: 'ws_open' });
    };

    ws.onmessage = (event) => {
        broadcast(event.data, true);
    };

    ws.onclose = (event) => {
        console.log(`[ServiceWorker] WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`);
        ws = null;
        broadcast({ type: 'ws_close' });
        if (!reconnectTimer) {
            console.log('[ServiceWorker] Scheduling reconnect...');
            reconnectTimer = setTimeout(connect, reconnectInterval);
        }
    };

    ws.onerror = (error) => {
        console.error('[ServiceWorker] WebSocket error:', error);
        broadcast({ type: 'ws_error' });
    };
}

async function broadcast(message, isRaw = false) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    clients.forEach(client => {
        if (isRaw) {
            client.postMessage(message);
        } else {
            client.postMessage(JSON.stringify(message));
        }
    });
}

self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Installing...');
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activating...');
    event.waitUntil(self.clients.claim());
    connect();
});

self.addEventListener('message', (event) => {
    if (event.data === 'REQUEST_WS_STATUS') {
        if (ws && ws.readyState === WebSocket.OPEN) {
            broadcast({ type: 'ws_open' });
        }
        return;
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(event.data);
    } else {
        console.warn('[ServiceWorker] WebSocket not open. Message from client not sent.');
    }
});