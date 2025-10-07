const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { NoteManager } = require('../min.js');

// Clean up the notes file before running tests
const notesFile = path.join(__dirname, '../notes.json');
if (fs.existsSync(notesFile)) {
  fs.unlinkSync(notesFile);
}

// Test configuration
const TEST_PORT = 30003;
const TEST_TIMEOUT = 60000; // 60 seconds

function waitForMessage(ws) {
    return new Promise(resolve => {
        ws.once('message', (data) => resolve(JSON.parse(data.toString())));
    });
}

function waitForMessages(ws, count) {
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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

test('Comprehensive Note Operations Test', { timeout: TEST_TIMEOUT }, async (t) => {
    // Start the server
    console.log('Starting server...');
    const serverProcess = spawn('node', [path.join(__dirname, '../min.js')], {
        env: { ...process.env, NODE_PORT: TEST_PORT.toString() },
        stdio: 'inherit'
    });

    // Wait for the server to start
    let serverStarted = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!serverStarted && attempts < maxAttempts) {
        try {
            const WebSocket = require('ws');
            const testWs = new WebSocket(`ws://localhost:${TEST_PORT}`);
            
            await new Promise((resolve, reject) => {
                testWs.on('open', () => {
                    serverStarted = true;
                    testWs.close();
                    resolve();
                });
                testWs.on('error', reject);
                
                setTimeout(() => reject(new Error('Connection timeout')), 1000);
            });
        } catch (error) {
            attempts++;
            console.log(`Server not ready, attempt ${attempts}/${maxAttempts}...`);
            await delay(1000);
        }
    }
    
    if (!serverStarted) {
        throw new Error('Server failed to start');
    }

    try {
        // Create a WebSocket connection
        const WebSocket = require('ws');
        const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);

        // Wait for connection
        await new Promise(resolve => {
            ws.on('open', resolve);
        });
        
        // Wait for the connection message
        await waitForMessage(ws);

        // Test 1: Enable auto-confirmation
        await t.test('should enable auto-confirmation', async () => {
            ws.send(JSON.stringify({ type: 'set_auto_confirm', enabled: true }));

            let responses = await waitForMessages(ws, 2);
            assert.strictEqual(responses[0].type, 'auto_confirm_status');
            assert.strictEqual(responses[0].enabled, true);
            assert.strictEqual(responses[1].type, 'reply');
            assert.match(responses[1].text, /Auto confirmation enabled/);
        });

        // Test 2: Create a note with auto-confirmation
        await t.test('should create a note with auto-confirmation', async () => {
            const initialNoteCount = NoteManager.getAll().length;

            // Create a note with auto-confirmation enabled
            ws.send(JSON.stringify({ type: 'chat', text: '/createnote Auto Confirm Note' }));

            // Wait for the response - should directly create the note without asking for confirmation
            let responses = await waitForMessages(ws, 2);
            assert.strictEqual(responses[0].type, 'created_note');
            assert.strictEqual(responses[0].note.title, 'Auto Confirm Note');
            assert.strictEqual(responses[1].type, 'reply');
            assert.match(responses[1].text, /Note created successfully/);

            const finalNoteCount = NoteManager.getAll().length;
            assert.strictEqual(finalNoteCount, initialNoteCount + 1);
        });

        // Test 3: Find a note
        await t.test('should find a note', async () => {
            // Find the note
            ws.send(JSON.stringify({ type: 'chat', text: '/findnote Auto Confirm Note' }));

            // Wait for the response
            let responses = await waitForMessages(ws, 2);
            assert.strictEqual(responses[0].type, 'found_notes');
            assert.strictEqual(responses[0].notes.length, 1);
            assert.strictEqual(responses[0].notes[0].title, 'Auto Confirm Note');
            assert.strictEqual(responses[1].type, 'reply');
            assert.match(responses[1].text, /Found 1 note/);
        });

        // Test 4: Update a note
        await t.test('should update a note', async () => {
            // First, find the note
            ws.send(JSON.stringify({ type: 'chat', text: '/findnote Auto Confirm Note' }));
            await waitForMessages(ws, 2); // found_notes and reply

            // Update the note
            ws.send(JSON.stringify({ type: 'chat', text: '/edit Updated Auto Confirm Note' }));

            // Wait for the response - should directly update the note without asking for confirmation
            let responses = await waitForMessages(ws, 2);
            assert.strictEqual(responses[0].type, 'note_updated');
            assert.strictEqual(responses[0].note.title, 'Updated Auto Confirm Note');
            assert.strictEqual(responses[1].type, 'reply');
            assert.match(responses[1].text, /Note updated/);
        });

        // Test 5: Mark a note as done
        await t.test('should mark a note as done', async () => {
            // First, find the note
            ws.send(JSON.stringify({ type: 'chat', text: '/findnote Updated Auto Confirm Note' }));
            await waitForMessages(ws, 2); // found_notes and reply

            // Mark the note as done
            ws.send(JSON.stringify({ type: 'chat', text: '/markdone' }));

            // Wait for the response - should directly mark the note as done without asking for confirmation
            let responses = await waitForMessages(ws, 2);
            assert.strictEqual(responses[0].type, 'note_updated');
            assert.strictEqual(responses[0].note.done, true);
            assert.strictEqual(responses[1].type, 'reply');
            assert.match(responses[1].text, /Note marked as done/);
        });

        // Test 6: Delete a note
        await t.test('should delete a note', async () => {
            // First, find the note
            ws.send(JSON.stringify({ type: 'chat', text: '/findnote Updated Auto Confirm Note' }));
            await waitForMessage(ws); // found_notes
            await waitForMessage(ws); // reply

            // Delete the note
            ws.send(JSON.stringify({ type: 'chat', text: '/delete' }));

            // Wait for the response - should directly delete the note without asking for confirmation
            let response = await waitForMessage(ws);
            assert.strictEqual(response.type, 'note_deleted');
        });

        // Test 7: Disable auto-confirmation
        await t.test('should disable auto-confirmation', async () => {
            // Disable auto-confirmation
            ws.send(JSON.stringify({ type: 'set_auto_confirm', enabled: false }));

            let response = await waitForMessage(ws);
            assert.strictEqual(response.type, 'reply');
            assert.match(response.text, /Auto confirmation disabled/);
        });

        // Test 8: Create a note with confirmation
        await t.test('should create a note with confirmation', async () => {
            const initialNoteCount = NoteManager.getAll().length;

            // Create a note with auto-confirmation disabled
            ws.send(JSON.stringify({ type: 'chat', text: '/createnote Manual Confirm Note' }));

            // Wait for the response - should ask for confirmation
            let response = await waitForMessage(ws);
            assert.strictEqual(response.type, 'reply');
            assert.match(response.text, /Do you want to create a note with title 'Manual Confirm Note'\? \(yes\/no\)/);

            // Confirm the creation
            ws.send(JSON.stringify({ type: 'chat', text: 'yes' }));

            response = await waitForMessage(ws);
            assert.strictEqual(response.type, 'created_note');
            assert.strictEqual(response.note.title, 'Manual Confirm Note');

            const finalNoteCount = NoteManager.getAll().length;
            assert.strictEqual(finalNoteCount, initialNoteCount + 1);
        });

        // Close the connection
        ws.close();
    } finally {
        // Kill the server process
        serverProcess.kill();
    }
});
