const { spawn } = require('child_process');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

// Global port counter to ensure unique ports
let portCounter = 10000;

// Get next unique port
function getNextPort() {
    return portCounter++;
}

// Clean up test data file
function cleanupTestData(testSuite) {
    const notesFile = path.join(__dirname, `../notes.${testSuite}.json`);
    if (fs.existsSync(notesFile)) {
        fs.writeFileSync(notesFile, '{"notes": [], "latestNoteId": 0}');
        console.log(`Cleaned up notes.${testSuite}.json`);
    }
}

// Wait for server to be ready
async function waitForServerReady(port, timeout = 10000) {
    console.log(`Waiting for server to be ready on port ${port}...`);
    
    // Simple approach: just wait for the server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`Server should be ready on port ${port}`);
    return;
}

// Create isolated test server
async function withIsolatedServer(testSuite, testFn, options = {}) {
    const port = getNextPort();
    const timeout = options.timeout || 30000;
    
    console.log(`Starting isolated server for ${testSuite} on port ${port}`);
    
    // Clean up test data
    cleanupTestData(testSuite);
    
    // Start server with unique port and test suite
    const serverProcess = spawn('node', [path.join(__dirname, '../min.js')], {
        env: { 
            ...process.env, 
            NODE_PORT: port.toString(), 
            NODE_ENV: 'test', 
            TEST_SUITE: testSuite 
        },
        stdio: options.stdio || 'inherit' // Use inherit for debugging
    });
    
    // Add error handling for server process
    serverProcess.on('error', (error) => {
        console.error(`Server process error: ${error.message}`);
    });
    
    serverProcess.on('exit', (code, signal) => {
        console.log(`Server process exited with code ${code}, signal ${signal}`);
    });
    
    // Set up timeout for the entire test
    const testTimeout = setTimeout(() => {
        console.error(`Test ${testSuite} timed out after ${timeout}ms`);
        serverProcess.kill('SIGKILL');
        process.exit(1);
    }, timeout);
    
    try {
        // Wait for server to be ready
        await waitForServerReady(port, 10000);
        console.log(`Server ready on port ${port}`);
        
        // Run the test
        await testFn(port);
        
    } catch (error) {
        console.error(`Test ${testSuite} failed:`, error.message);
        throw error;
    } finally {
        // Clean up
        clearTimeout(testTimeout);
        
        // Kill server process
        if (serverProcess && !serverProcess.killed) {
            serverProcess.kill('SIGTERM');
            
            // Wait for graceful shutdown
            await new Promise((resolve) => {
                const killTimeout = setTimeout(() => {
                    serverProcess.kill('SIGKILL');
                    resolve();
                }, 2000);
                
                serverProcess.on('exit', () => {
                    clearTimeout(killTimeout);
                    resolve();
                });
            });
        }
        
        // Additional cleanup time
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`Server on port ${port} cleaned up`);
    }
}

// Create WebSocket connection with retry
async function createWebSocketConnection(port, maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`Attempting WebSocket connection to port ${port} (attempt ${i + 1})`);
            const ws = new WebSocket(`ws://localhost:${port}`);
            
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    ws.close();
                    reject(new Error('Connection timeout'));
                }, 5000);
                
                ws.on('open', () => {
                    clearTimeout(timer);
                    console.log(`WebSocket connected to port ${port}`);
                    resolve();
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timer);
                    console.log(`WebSocket connection error: ${error.message}`);
                    reject(error);
                });
            });
            
            return ws;
        } catch (error) {
            if (i === maxRetries - 1) {
                throw error;
            }
            console.log(`Connection attempt ${i + 1} failed, retrying in 1 second...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Message queue system for sequential message consumption
class MessageQueue {
    constructor(ws) {
        this.ws = ws;
        this.queue = [];
        this.listeners = [];
        this.isProcessing = false;
        
        // Set up the main message handler
        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this.queue.push(message);
                this.processQueue();
            } catch (error) {
                console.log('Ignoring invalid JSON message:', data.toString());
            }
        });
    }
    
    processQueue() {
        if (this.isProcessing || this.listeners.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        // Process messages in order, matching against listeners in order
        while (this.queue.length > 0 && this.listeners.length > 0) {
            const message = this.queue[0]; // Always take the first message
            const listener = this.listeners[0]; // Always take the first listener
            
            if (listener.filter(message)) {
                // Message matches the listener, resolve it
                this.queue.shift();
                this.listeners.shift();
                listener.resolve(message);
            } else {
                // Message doesn't match the first listener, try next listener
                let matched = false;
                for (let i = 1; i < this.listeners.length; i++) {
                    if (this.listeners[i].filter(message)) {
                        // Found a matching listener, resolve it
                        this.queue.shift();
                        this.listeners.splice(i, 1);
                        this.listeners[i].resolve(message);
                        matched = true;
                        break;
                    }
                }
                
                if (!matched) {
                    // No listener matches this message, remove it from queue
                    this.queue.shift();
                }
            }
        }
        
        this.isProcessing = false;
    }
    
    waitForMessage(filter, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                // Remove this listener from the queue
                const index = this.listeners.findIndex(l => l.resolve === resolve);
                if (index !== -1) {
                    this.listeners.splice(index, 1);
                }
                reject(new Error(`Timeout waiting for message matching filter`));
            }, timeout);
            
            const listener = {
                filter,
                resolve: (message) => {
                    clearTimeout(timer);
                    resolve(message);
                }
            };
            
            this.listeners.push(listener);
            this.processQueue();
        });
    }
}

// Global message queue per WebSocket
const messageQueues = new Map();

function getMessageQueue(ws) {
    if (!messageQueues.has(ws)) {
        messageQueues.set(ws, new MessageQueue(ws));
    }
    return messageQueues.get(ws);
}

// Wait for specific message type
function waitForMessageType(ws, expectedType, timeout = 10000) {
    const queue = getMessageQueue(ws);
    return queue.waitForMessage(
        (message) => message.type === expectedType,
        timeout
    );
}

// Wait for non-command message
function waitForNonCommandMessage(ws, timeout = 10000) {
    const queue = getMessageQueue(ws);
    return queue.waitForMessage(
        (message) => message.type !== 'available_commands',
        timeout
    );
}

// Wait for message with custom filter
function waitForMessage(ws, filter, timeout = 10000) {
    const queue = getMessageQueue(ws);
    return queue.waitForMessage(filter, timeout);
}

// Wait for message containing specific text
function waitForMessageWithText(ws, text, timeout = 10000) {
    const queue = getMessageQueue(ws);
    return queue.waitForMessage(
        (message) => message.text && message.text.includes(text),
        timeout
    );
}

// Send message helper
function sendMessage(ws, type, data = {}) {
    const message = { type, ...data };
    ws.send(JSON.stringify(message));
}

// Clear message queue
function clearMessageQueue(ws) {
    // Clear the message queue for this WebSocket without removing listeners
    if (messageQueues.has(ws)) {
        const queue = messageQueues.get(ws);
        queue.queue = [];
        queue.listeners = [];
        queue.isProcessing = false;
    }
}

// Clear only the message queue (keep listeners)
function clearMessageQueueOnly(ws) {
    if (messageQueues.has(ws)) {
        const queue = messageQueues.get(ws);
        queue.queue = [];
        queue.isProcessing = false;
    }
}

module.exports = {
    withIsolatedServer,
    createWebSocketConnection,
    waitForMessageType,
    waitForNonCommandMessage,
    waitForMessage,
    waitForMessageWithText,
    sendMessage,
    clearMessageQueue,
    clearMessageQueueOnly,
    cleanupTestData,
    getNextPort
};
