const WebSocket = require('ws');

class TestUtils {
    constructor() {
        this.servers = new Map();
    }

    async createTestServer(name) {
        const TestServer = require('./test-server');
        const server = new TestServer();
        await server.start();
        this.servers.set(name, server);
        return server;
    }

    async cleanupTestServer(name) {
        const server = this.servers.get(name);
        if (server) {
            await server.stop();
            this.servers.delete(name);
        }
    }

    async cleanupAllTestServers() {
        for (const [name, server] of this.servers) {
            await server.stop();
        }
        this.servers.clear();
    }

    createTestClient(port) {
        return new WebSocket(`ws://localhost:${port}`);
    }

    async waitForMessage(ws) {
        return new Promise(resolve => {
            ws.once('message', (data) => resolve(JSON.parse(data.toString())));
        });
    }

    async waitForMessages(ws, count) {
        return new Promise(resolve => {
            const messages = [];
            const handler = (data) => {
                messages.push(JSON.parse(data.toString()));
                if (messages.length === count) {
                    ws.removeListener('message', handler);
                    resolve(messages);
                }
            };
            ws.on('message', handler);
        });
    }

    async connectToServer(port) {
        const ws = this.createTestClient(port);
        await new Promise(resolve => {
            ws.on('open', resolve);
        });
        // Wait for the connection message
        await this.waitForMessage(ws);
        return ws;
    }

    async withTestServer(testFn) {
        const server = await this.createTestServer('test');
        try {
            await testFn(server);
        } finally {
            await this.cleanupTestServer('test');
        }
    }

    async withTestClient(server, testFn) {
        const ws = await this.connectToServer(server.port);
        try {
            await testFn(ws);
        } finally {
            ws.close();
        }
    }
}

module.exports = new TestUtils();
