const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

// Simple test framework
function test(name, fn) {
    console.log(`Running: ${name}`);
    try {
        fn();
        console.log(`✓ ${name}`);
    } catch (error) {
        console.error(`✗ ${name}`);
        console.error(error.message);
        process.exit(1);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

// Test server management
async function withServer(testFn) {
    const serverProcess = spawn('node', [path.join(__dirname, '../min.js')], {
        env: { ...process.env, NODE_PORT: '30004' },
        stdio: 'inherit'
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        await testFn();
    } finally {
        serverProcess.kill();
    }
}

// WebSocket test helper
async function withWebSocket(testFn) {
    const ws = new WebSocket('ws://localhost:30004');

    await new Promise(resolve => {
        ws.on('open', resolve);
    });

    // Wait for connection message
    await new Promise(resolve => {
        ws.once('message', resolve);
    });

    try {
        await testFn(ws);
    } finally {
        ws.close();
    }
}

// Test message helper
function sendMessage(ws, type, data) {
    ws.send(JSON.stringify({ type, ...data }));
}

// Test response helper
async function waitForMessage(ws) {
    return new Promise(resolve => {
        ws.once('message', (data) => {
            resolve(JSON.parse(data.toString()));
        });
    });
}

// Run tests
async function runTests() {
    console.log('Starting tests...');

    await withServer(async () => {
        await withWebSocket(async (ws) => {
            // Test 1: Create a note
            await test('should create a note', async () => {
                sendMessage(ws, 'chat', { text: '/createnote Test Note' });

                const response = await waitForMessage(ws);
                assertEqual(response.type, 'reply');
                assert(response.text.includes('Do you want to create a note'));

                sendMessage(ws, 'chat', { text: 'yes' });
                const createResponse = await waitForMessage(ws);
                assertEqual(createResponse.type, 'created_note');
                assertEqual(createResponse.note.title, 'Test Note');
            });

            // Test 2: Find a note
            await test('should find a note', async () => {
                sendMessage(ws, 'chat', { text: '/findnote Test Note' });

                const response = await waitForMessage(ws);
                assertEqual(response.type, 'found_notes');
                assert(response.notes.length > 0);
                assert(response.notes[0].title === 'Test Note');
            });

            // Test 3: Update a note
            await test('should update a note', async () => {
                sendMessage(ws, 'chat', { text: '/findnote Test Note' });
                await waitForMessage(ws); // found_notes
                await waitForMessage(ws); // reply

                sendMessage(ws, 'chat', { text: '/edit Updated Test Note' });
                const response = await waitForMessage(ws);
                assertEqual(response.type, 'reply');
                assert(response.text.includes('Do you want to update'));

                sendMessage(ws, 'chat', { text: 'yes' });
                const updateResponse = await waitForMessage(ws);
                assertEqual(updateResponse.type, 'note_updated');
                assertEqual(updateResponse.note.title, 'Updated Test Note');
            });

            // Test 4: Delete a note
            await test('should delete a note', async () => {
                sendMessage(ws, 'chat', { text: '/findnote Updated Test Note' });
                await waitForMessage(ws); // found_notes
                await waitForMessage(ws); // reply

                sendMessage(ws, 'chat', { text: '/delete' });
                const response = await waitForMessage(ws);
                assertEqual(response.type, 'reply');
                assert(response.text.includes('Do you want to delete'));

                sendMessage(ws, 'chat', { text: 'yes' });
                const deleteResponse = await waitForMessage(ws);
                assertEqual(deleteResponse.type, 'note_deleted');
            });
        });
    });

    console.log('All tests passed!');
}

// Run the tests
runTests().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
