const { withIsolatedServer, createWebSocketConnection, sendMessage, waitForMessageType, waitForMessageSequence, clearMessageQueue, clearMessageQueueOnly } = require('./test-utils');

// Test utilities
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`Assertion failed: ${message || `Expected ${expected}, got ${actual}`}`);
    }
}

// Helper function to create a test note
async function createTestNote(ws, title) {
    sendMessage(ws, 'chat', { text: `/createnote ${title}` });
    const response = await waitForMessageType(ws, 'created_note');
    return response.note.id;
}

// Helper function to run tests with dedicated server
async function runTestWithDedicatedServer(testName, testFunction) {
    console.log(`\nRunning ${testName} on port ${Math.floor(Math.random() * 10000) + 20000}`);
    
    await withIsolatedServer('to-do-test', async (port) => {
        const uniqueId = Date.now();
        
        // Create WebSocket connection
        const ws = await createWebSocketConnection(port);
        
        await testFunction(ws, createTestNote, uniqueId);
        
        // Close WebSocket connection
        ws.close();
    });
}

async function runTests() {
    console.log('Starting to-do tests...\n');

    // Test 1: Sub-note creation commands (PROBLEMATIC - needs context setup)
    await runTestWithDedicatedServer('should return sub-note creation commands when creating sub-note', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note Sub ${uniqueId}`;
        const noteId = await createTestNote(ws, noteTitle);
        
        console.log('--- Testing sub-note creation commands ---');
        
        // Consume the available_commands message sent after note creation
        await waitForMessageType(ws, 'available_commands');
        
        // Find the note first to establish context (FIX NEEDED)
        sendMessage(ws, 'chat', { text: `/findnote ${noteTitle}` });
        await waitForMessageSequence(ws, ['found_notes', 'reply']);
        clearMessageQueueOnly(ws);
        
        // Start sub-note creation (without parameters to trigger title prompt)
        sendMessage(ws, 'chat', { text: `/createsubnote` });
        
        // Wait for the available_commands message sent by sendUpdatedCommands (sub-note creation commands)
        const response = await waitForMessageType(ws, 'available_commands');
        
        // Wait for the reply message
        await waitForMessageType(ws, 'reply');
        
        console.log('--- Available commands in sub-note creation state:', response.commands);
        
        // Should have sub-note creation commands
        const commandNames = response.commands.map(cmd => cmd.command);
        console.log('--- Command names in sub-note creation state:', commandNames);
        
        // Check for sub-note creation commands
        assert(commandNames.includes('yes'), 'Should include yes command');
        assert(commandNames.includes('no'), 'Should include no command');
        
        // Should NOT have other commands during sub-note creation
        assert(!commandNames.includes('/createsubnote'), 'Should NOT include /createsubnote during creation');
        assert(!commandNames.includes('/editdescription'), 'Should NOT include /editdescription during creation');
        
        console.log('--- Test passed: Sub-note creation commands returned correctly ---');
    });

    // Test 2: Commands update automatically on state change (POTENTIALLY PROBLEMATIC - complex state transitions)
    await runTestWithDedicatedServer('should automatically update commands when state changes', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note Auto Update ${uniqueId}`;
        
        console.log('--- Testing automatic command updates ---');
        
        // Start in main menu - should have main menu commands
        sendMessage(ws, 'get_commands');
        let response = await waitForMessageType(ws, 'available_commands');
        let commandNames = response.commands.map(cmd => cmd.command);
        assert(commandNames.includes('/createnote'), 'Should start with main menu commands');
        
        // Create a note to enter confirmation state
        sendMessage(ws, 'chat', { text: `/createnote ${noteTitle}` });
        await waitForMessageType(ws, 'reply'); // Confirmation prompt
        
        // Wait a bit for state to settle
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Should now have confirmation commands
        sendMessage(ws, 'get_commands');
        response = await waitForMessageType(ws, 'available_commands');
        commandNames = response.commands.map(cmd => cmd.command);
        assert(commandNames.includes('yes'), 'Should have confirmation commands');
        assert(commandNames.includes('no'), 'Should have confirmation commands');
        
        // Confirm the note creation
        sendMessage(ws, 'chat', { text: 'yes' });
        await waitForMessageType(ws, 'created_note');
        await waitForMessageType(ws, 'reply'); // Success message
        
        // Wait a bit for state to settle
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Should be back to main menu commands
        sendMessage(ws, 'get_commands');
        response = await waitForMessageType(ws, 'available_commands');
        commandNames = response.commands.map(cmd => cmd.command);
        assert(commandNames.includes('/createnote'), 'Should return to main menu commands');
        
        console.log('--- Test passed: Commands automatically updated on state changes ---');
    });

    // Test 3: Select sub-note test (PROBLEMATIC - complex flow)
    await runTestWithDedicatedServer('should select sub-note', async (ws, createTestNote, uniqueId) => {
        const noteTitle = `Test Note Select ${uniqueId}`;
        const noteId = await createTestNote(ws, noteTitle);
        await clearMessageQueue(ws);

        // Find the note first to enter note context
        sendMessage(ws, 'chat', { text: `/findnote ${noteTitle}` });
        await waitForMessageSequence(ws, ['found_notes', 'reply']);
        clearMessageQueueOnly(ws);

        // Create a sub-note
        sendMessage(ws, 'chat', { text: `/createsubnote` });
        await waitForMessageType(ws, 'reply'); // "What is the title..."
        sendMessage(ws, 'chat', { text: 'Sub Note' });
        await waitForMessageType(ws, 'created_note');
        await waitForMessageType(ws, 'reply');
        clearMessageQueueOnly(ws);

        // Now find the parent note to get the sub-note
        sendMessage(ws, 'chat', { text: `/findbyid ${noteId}` });
        const messages = await waitForMessageSequence(ws, ['found_notes', 'reply']);
        const findResponse = messages.found_notes;
        
        const subNote = findResponse.notes.find(note => note.title === 'Sub Note');
        assert(subNote, 'Sub-note not found in find results');
        
        // Select the sub-note
        sendMessage(ws, 'chat', { text: `/selectsubnote ${subNote.id}` });
        
        // Wait for the reply message
        const response = await waitForMessageType(ws, 'reply');
        assertEqual(response.type, 'reply');
        assert(response.text.includes('Selected sub-note'));
    });

    console.log('\n🎉 All to-do tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { runTests };
