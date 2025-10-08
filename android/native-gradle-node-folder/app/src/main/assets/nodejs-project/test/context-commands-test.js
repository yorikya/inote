const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { withIsolatedServer, createWebSocketConnection, waitForMessageType, waitForNonCommandMessage, sendMessage, clearMessageQueue } = require('./test-utils');

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

// Clean up test data
function cleanupTestData() {
    const notesFile = path.join(__dirname, '../notes.context-commands-test.json');
    if (fs.existsSync(notesFile)) {
        fs.writeFileSync(notesFile, '{"notes": [], "latestNoteId": 0}');
        console.log('Cleaned up notes.context-commands-test.json');
    }
}

// Test server management - now using isolated servers
async function withServer(testFn) {
    await withIsolatedServer('context-commands-test', testFn, { timeout: 30000 });
}

// WebSocket test helper - now using robust connection
async function withWebSocket(port, testFn) {
    const ws = await createWebSocketConnection(port);
    ws.setMaxListeners(20);

    await new Promise(resolve => {
        ws.once('message', resolve);
    });

    try {
        await testFn(ws);
    } finally {
        await new Promise(resolve => setTimeout(resolve, 100));
        ws.close();
        await new Promise(resolve => {
            ws.on('close', resolve);
        });
    }
}

// sendMessage is now imported from test-utils

// Test response helper
async function waitForMessage(ws, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Timeout waiting for message'));
        }, timeout);
        
        ws.once('message', (data) => {
            clearTimeout(timer);
            const parsed = JSON.parse(data.toString());
            resolve(parsed);
        });
    });
}

// Helper functions are now imported from test-utils

// Run tests
async function runTests() {
    console.log('Starting context-aware command tests...');

    // Test 1: Main menu commands
    await withServer(async (port) => {
        await withWebSocket(port, async (ws) => {
            console.log('--- Testing main menu commands ---');
            
            // Request available commands
            sendMessage(ws, 'get_commands');
            const response = await waitForMessageType(ws, 'available_commands');
            
            // Should have main menu commands
            const commandNames = response.commands.map(cmd => cmd.command);
            console.log('--- Command names:', commandNames);
            
            // Check for main menu commands
            assert(commandNames.includes('/createnote'), 'Should include /createnote command');
            assert(commandNames.includes('/findnote'), 'Should include /findnote command');
            assert(commandNames.includes('/findbyid'), 'Should include /findbyid command');
            assert(commandNames.includes('/showparents'), 'Should include /showparents command');
            
            // Should NOT have note-specific commands in main menu
            assert(!commandNames.includes('/editdescription'), 'Should NOT include /editdescription in main menu');
            assert(!commandNames.includes('/markdone'), 'Should NOT include /markdone in main menu');
            assert(!commandNames.includes('/delete'), 'Should NOT include /delete in main menu');
            
            console.log('--- Test passed: Main menu commands returned correctly ---');
        });
    });

    // Test 2: Note context commands
    await withServer(async (port) => {
        await withWebSocket(port, async (ws) => {
            const noteTitle = `Test Note Context ${Date.now()}`;
            
            // Create a note first
            sendMessage(ws, 'chat', { text: `/createnote ${noteTitle}` });
            await waitForMessageType(ws, 'reply'); // Confirmation prompt
            sendMessage(ws, 'chat', { text: 'yes' });
            await waitForMessageType(ws, 'created_note');
            await clearMessageQueue(ws);
            
            console.log('--- Testing note context commands ---');
            
            // Find the note to enter note context
            sendMessage(ws, 'chat', { text: `/findnote ${noteTitle}` });
            await waitForMessageType(ws, 'found_notes');
            
            // Wait for the reply message
            const replyResponse = await waitForMessageType(ws, 'reply');
            console.log('Got reply:', replyResponse.text);
            
            // Wait a bit for the available_commands to be sent automatically
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Request available commands again to get updated context
            sendMessage(ws, 'get_commands');
            const response = await waitForMessageType(ws, 'available_commands');
            
            // Should have note-specific commands
            const commandNames = response.commands.map(cmd => cmd.command);
            console.log('--- Command names in note context:', commandNames);
            
            // Check for note context commands
            assert(commandNames.includes('/editdescription'), 'Should include /editdescription command');
            assert(commandNames.includes('/markdone'), 'Should include /markdone command');
            assert(commandNames.includes('/delete'), 'Should include /delete command');
            assert(commandNames.includes('/createsubnote'), 'Should include /createsubnote command');
            assert(commandNames.includes('/talkai'), 'Should include /talkai command');
            assert(commandNames.includes('/selectsubnote'), 'Should include /selectsubnote command');
            assert(commandNames.includes('/uploadimage'), 'Should include /uploadimage command');
            
            // Should NOT have main menu commands in note context
            assert(!commandNames.includes('/createnote'), 'Should NOT include /createnote in note context');
            assert(!commandNames.includes('/findnote'), 'Should NOT include /findnote in note context');
            assert(!commandNames.includes('/findbyid'), 'Should NOT include /findbyid in note context');
            assert(!commandNames.includes('/showparents'), 'Should NOT include /showparents in note context');
            
            console.log('--- Test passed: Note context commands returned correctly ---');
        });
    });

    // Test 3: Confirmation commands
    await withServer(async (port) => {
        await withWebSocket(port, async (ws) => {
            const noteTitle = `Test Note Confirm ${Date.now()}`;
            
            console.log('--- Testing confirmation commands ---');
            
            // Start note creation to enter confirmation state
            sendMessage(ws, 'chat', { text: `/createnote ${noteTitle}` });
            await waitForMessageType(ws, 'reply'); // Confirmation prompt
            await new Promise(resolve => setTimeout(resolve, 200)); // Wait for auto-updated commands
            
            // Request available commands during confirmation
            sendMessage(ws, 'get_commands');
            const response = await waitForMessageType(ws, 'available_commands');
            
            // Should have confirmation commands
            const commandNames = response.commands.map(cmd => cmd.command);
            console.log('--- Command names in confirmation state:', commandNames);
            
            // Check for confirmation commands
            assert(commandNames.includes('yes'), 'Should include yes command');
            assert(commandNames.includes('no'), 'Should include no command');
            
            // Should NOT have other commands during confirmation
            assert(!commandNames.includes('/createnote'), 'Should NOT include /createnote during confirmation');
            assert(!commandNames.includes('/editdescription'), 'Should NOT include /editdescription during confirmation');
            
            console.log('--- Test passed: Confirmation commands returned correctly ---');
        });
    });

    // Test 4: Commands update automatically on state change
    await withServer(async (port) => {
        await withWebSocket(port, async (ws) => {
            const noteTitle = `Test Note Auto Update ${Date.now()}`;
            
            console.log('--- Testing automatic command updates ---');
            
            // Start in main menu - should have main menu commands
            console.log('--- Step 1: Getting initial commands ---');
            sendMessage(ws, 'get_commands');
            let response = await waitForMessageType(ws, 'available_commands');
            console.log('--- Initial commands response:', JSON.stringify(response, null, 2));
            let commandNames = response.commands.map(cmd => cmd.command);
            console.log('--- Initial command names:', commandNames);
            assert(commandNames.includes('/createnote'), 'Should start with main menu commands');
            
            // Create a note to enter confirmation state
            console.log('--- Step 2: Creating note to enter confirmation state ---');
            sendMessage(ws, 'chat', { text: `/createnote ${noteTitle}` });
            console.log('--- Sent /createnote command, waiting for reply ---');
            
            let replyResponse = await waitForMessageType(ws, 'reply');
            console.log('--- Got reply after /createnote:', JSON.stringify(replyResponse, null, 2));
            
            console.log('--- Waiting 200ms for auto-updated commands ---');
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Should now have confirmation commands
            console.log('--- Step 3: Getting commands in confirmation state ---');
            sendMessage(ws, 'get_commands');
            response = await waitForMessageType(ws, 'available_commands');
            console.log('--- Confirmation state commands response:', JSON.stringify(response, null, 2));
            commandNames = response.commands.map(cmd => cmd.command);
            console.log('--- Confirmation state command names:', commandNames);
            assert(commandNames.includes('yes'), 'Should have confirmation commands after state change');
            assert(!commandNames.includes('/createnote'), 'Should NOT have main menu commands in confirmation state');
            
            // Confirm the note creation
            console.log('--- Step 4: Confirming note creation ---');
            sendMessage(ws, 'chat', { text: 'yes' });
            console.log('--- Sent yes confirmation, waiting for created_note ---');
            
            let createdNoteResponse = await waitForMessageType(ws, 'created_note');
            console.log('--- Got created_note response:', JSON.stringify(createdNoteResponse, null, 2));
            
            console.log('--- Waiting for reply after note creation ---');
            let finalReplyResponse = await waitForMessageType(ws, 'reply');
            console.log('--- Got final reply:', JSON.stringify(finalReplyResponse, null, 2));
            
            console.log('--- Waiting 200ms for auto-updated commands ---');
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Should be back to main menu commands
            console.log('--- Step 5: Getting final commands after confirmation ---');
            sendMessage(ws, 'get_commands');
            response = await waitForMessageType(ws, 'available_commands');
            console.log('--- Final commands response:', JSON.stringify(response, null, 2));
            commandNames = response.commands.map(cmd => cmd.command);
            console.log('--- Final command names:', commandNames);
            assert(commandNames.includes('/createnote'), 'Should return to main menu commands after confirmation');
            assert(!commandNames.includes('yes'), 'Should NOT have confirmation commands after confirmation');
            
            console.log('--- Test passed: Commands automatically updated on state changes ---');
        });
    });

    // Test 5: Story editing commands
    await withServer(async (port) => {
        await withWebSocket(port, async (ws) => {
            const noteTitle = `Test Note Edit ${Date.now()}`;
            
            // Create a note first
            sendMessage(ws, 'chat', { text: `/createnote ${noteTitle}` });
            await waitForMessageType(ws, 'reply'); // Confirmation prompt
            sendMessage(ws, 'chat', { text: 'yes' });
            await waitForMessageType(ws, 'created_note');
            await clearMessageQueue(ws);
            
            console.log('--- Testing story editing commands ---');
            
            // Find the note and enter edit mode
            console.log('--- Step 1: Finding note to enter edit mode ---');
            sendMessage(ws, 'chat', { text: `/findnote ${noteTitle}` });
            console.log('--- Sent /findnote command, waiting for found_notes ---');
            
            let foundNotesResponse = await waitForMessageType(ws, 'found_notes');
            console.log('--- Got found_notes response:', JSON.stringify(foundNotesResponse, null, 2));
            
            let findReplyResponse = await waitForMessageType(ws, 'reply');
            console.log('--- Got find reply:', JSON.stringify(findReplyResponse, null, 2));
            
            console.log('--- Waiting 100ms for state to settle ---');
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Start editing
            console.log('--- Step 2: Starting edit mode ---');
            sendMessage(ws, 'chat', { text: '/editdescription' });
            console.log('--- Sent /editdescription command, waiting for non-command message ---');
            
            let editResponse = await waitForMessageType(ws, 'reply');
            console.log('--- Got edit response:', JSON.stringify(editResponse, null, 2));
            
            console.log('--- Waiting 100ms for state to settle ---');
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Request available commands during editing
            console.log('--- Step 3: Getting commands in story editing state ---');
            sendMessage(ws, 'get_commands');
            const response = await waitForMessageType(ws, 'available_commands');
            console.log('--- Story editing commands response:', JSON.stringify(response, null, 2));
            
            // Should have story editing commands
            const commandNames = response.commands.map(cmd => cmd.command);
            console.log('--- Command names in story editing state:', commandNames);
            
            // Check for story editing commands
            assert(commandNames.includes('/stopediting'), 'Should include /stopediting command');
            
            // Should NOT have other commands during editing
            assert(!commandNames.includes('/editdescription'), 'Should NOT include /editdescription during editing');
            assert(!commandNames.includes('/markdone'), 'Should NOT include /markdone during editing');
            
            console.log('--- Test passed: Story editing commands returned correctly ---');
        });
    });

    console.log('All context-aware command tests passed!');
}

// Run the tests
runTests().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
