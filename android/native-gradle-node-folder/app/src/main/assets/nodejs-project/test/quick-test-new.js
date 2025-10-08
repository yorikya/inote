const { withIsolatedServer, createWebSocketConnection, waitForMessageType, sendMessage } = require('./test-utils');

async function testContextCommands() {
    console.log('Testing context-aware commands...');
    
    await withIsolatedServer('quick-test', async (port) => {
        const ws = await createWebSocketConnection(port);
        console.log('Client connected');

        try {
            // Test 1: Main menu commands
            console.log('1. Testing main menu commands...');
            sendMessage(ws, 'get_commands');
            
            const initialCommands = await waitForMessageType(ws, 'available_commands');
            const commandNames = initialCommands.commands.map(cmd => cmd.command);
            
            console.log('Initial commands:', commandNames);
            assert(commandNames.includes('/createnote'), 'Should have /createnote command');
            assert(commandNames.includes('/findnote'), 'Should have /findnote command');
            assert(commandNames.includes('/findbyid'), 'Should have /findbyid command');
            assert(commandNames.includes('/showparents'), 'Should have /showparents command');
            console.log('✓ Main menu commands working');

            // Test 2: Note context commands
            console.log('2. Testing note context commands...');
            
            // Create a note first
            sendMessage(ws, 'chat', { text: '/createnote Test Note' });
            
            // Wait for confirmation
            const confirmation = await waitForMessageType(ws, 'reply');
            assert(confirmation.text.includes('Do you want to create'), 'Should get confirmation prompt');
            
            // Confirm
            sendMessage(ws, 'chat', { text: 'yes' });
            
            // Wait for note creation
            await waitForMessageType(ws, 'created_note');
            
            // Find the note to enter note context
            sendMessage(ws, 'chat', { text: '/findnote Test Note' });
            
            // Wait for found_notes
            await waitForMessageType(ws, 'found_notes');
            
            // Get commands in note context
            sendMessage(ws, 'get_commands');
            
            const noteContextCommands = await waitForMessageType(ws, 'available_commands');
            const noteCommandNames = noteContextCommands.commands.map(cmd => cmd.command);
            
            console.log('Note context commands:', noteCommandNames);
            assert(noteCommandNames.includes('/editdescription'), 'Should have /editdescription command');
            assert(noteCommandNames.includes('/markdone'), 'Should have /markdone command');
            assert(noteCommandNames.includes('/delete'), 'Should have /delete command');
            assert(noteCommandNames.includes('/createsubnote'), 'Should have /createsubnote command');
            assert(noteCommandNames.includes('/talkai'), 'Should have /talkai command');
            assert(noteCommandNames.includes('/selectsubnote'), 'Should have /selectsubnote command');
            assert(noteCommandNames.includes('/uploadimage'), 'Should have /uploadimage command');
            console.log('✓ Note context commands working');

            console.log('Context-aware commands test completed!');

        } finally {
            ws.close();
            console.log('Client disconnected');
        }
    }, { timeout: 30000 });
}

// Simple assert function
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

// Run the test
testContextCommands().catch(error => {
    console.error('Test failed:', error.message);
    process.exit(1);
});
