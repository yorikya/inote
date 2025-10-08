const { withIsolatedServer, createWebSocketConnection, waitForMessageType, sendMessage, clearMessageQueueOnly } = require('./test-utils');

async function debugFindnote() {
    console.log('Debugging /findnote command...');
    
    await withIsolatedServer('debug-findnote', async (port) => {
        const ws = await createWebSocketConnection(port);
        console.log('Client connected');

        try {
            // Create a note first
            console.log('1. Creating a note...');
            sendMessage(ws, 'chat', { text: '/createnote Test Note Debug' });
            
            const confirmation = await waitForMessageType(ws, 'reply');
            console.log('Got confirmation:', confirmation.text);
            
            sendMessage(ws, 'chat', { text: 'yes' });
            await waitForMessageType(ws, 'created_note');
            console.log('Note created');
            
            // Clear any pending messages before finding the note
            clearMessageQueueOnly(ws);
            
            // Now try to find the note
            console.log('2. Finding the note...');
            sendMessage(ws, 'chat', { text: '/findnote Test Note Debug' });
            
            // Wait for found_notes
            const foundNotes = await waitForMessageType(ws, 'found_notes');
            console.log('Got found_notes:', foundNotes.notes.length, 'notes');
            
            // Wait for reply
            const reply = await waitForMessageType(ws, 'reply');
            console.log('Got reply:', reply.text);
            
            // Now get commands
            console.log('3. Getting commands...');
            sendMessage(ws, 'get_commands');
            
            const commands = await waitForMessageType(ws, 'available_commands');
            const commandNames = commands.commands.map(cmd => cmd.command);
            console.log('Available commands:', commandNames);
            
            // Check if we have note context commands
            if (commandNames.includes('/editdescription')) {
                console.log('✅ SUCCESS: Got note context commands');
            } else {
                console.log('❌ FAILED: Got main menu commands instead of note context commands');
            }

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
debugFindnote().catch(error => {
    console.error('Test failed:', error.message);
    process.exit(1);
});
