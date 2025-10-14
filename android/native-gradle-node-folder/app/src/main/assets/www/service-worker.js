let ws;
const wsUrl = 'ws://127.0.0.1:30000';
let reconnectInterval = 3000;
let reconnectTimer = null;

function connect() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (ws && ws.readyState !== WebSocket.CLOSED) return;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('[ServiceWorker] WebSocket connected');
        broadcast({ type: 'ws_open' });
    };

    ws.onmessage = (event) => {
        broadcast(event.data, true);
    };

    ws.onclose = () => {
        console.log('[ServiceWorker] WebSocket disconnected');
        ws = null;
        broadcast({ type: 'ws_close' });
        if (!reconnectTimer) {
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
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
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
