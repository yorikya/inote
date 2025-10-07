const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { server, wss, NoteManager, StateManager } = require('../min.js');
const WebSocket = require('ws');

// Clean up the notes file before running tests
const notesFile = path.join(__dirname, '../notes.json');
if (fs.existsSync(notesFile)) {
  fs.unlinkSync(notesFile);
}

// Reset the NoteManager
NoteManager.notes = [];
NoteManager.lastId = 0;

function waitForMessage(ws) {
    return new Promise(resolve => {
        ws.once('message', (data) => resolve(JSON.parse(data.toString())));
    });
}

test('Note Speaker Auto-Confirmation Test', { timeout: 10000 }, async (t) => {
    const PORT = process.env.NODE_PORT || 30000;
    const ws = new WebSocket(`ws://localhost:${PORT}`);

    await new Promise(resolve => ws.on('open', resolve));
    await waitForMessage(ws); // Wait for connection message

    let noteIdToDelete;

    await t.test('should enable auto-confirmation', async () => {
        // Enable auto-confirmation
        ws.send(JSON.stringify({ type: 'set_auto_confirm', enabled: true }));

        let response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'auto_confirm_status');
        assert.strictEqual(response.enabled, true);
    });

    await t.test('should create a note without confirmation when auto-confirmation is enabled', async () => {
        const initialNoteCount = NoteManager.getAll().length;

        // Create a note with auto-confirmation enabled
        ws.send(JSON.stringify({ type: 'chat', text: '/createnote Auto Confirm Note', autoConfirm: true }));

        // Wait for the response - should directly create the note without asking for confirmation
        let response = await waitForMessage(ws);
        console.log('Response type:', response.type);
        console.log('Response:', response);
        
        // Check if it's a confirmation request (which would be wrong)
        if (response.type === 'reply' && response.text.includes('Do you want to create a note')) {
            // If we get a confirmation request, auto-confirmation is not working
            assert.fail('Got confirmation request when auto-confirmation is enabled');
        }
        
        // Otherwise, we should get a created_note message
        assert.strictEqual(response.type, 'created_note');
        assert.strictEqual(response.note.title, 'Auto Confirm Note');
        noteIdToDelete = response.note.id;

        const finalNoteCount = NoteManager.getAll().length;
        console.log(`Initial note count: ${initialNoteCount}, Final note count: ${finalNoteCount}`);
        assert.strictEqual(finalNoteCount, initialNoteCount + 1, `Expected ${initialNoteCount + 1} notes, but got ${finalNoteCount}`);
    });

    await t.test('should delete a note without confirmation when auto-confirmation is enabled', async () => {
        // Create a new note to delete
        ws.send(JSON.stringify({ type: 'chat', text: '/createnote Note To Delete', autoConfirm: true }));
        let createResponse = await waitForMessage(ws);
        assert.strictEqual(createResponse.type, 'created_note');
        const noteToDeleteId = createResponse.note.id;
        
        // Find the note first to enter find_context
        ws.send(JSON.stringify({ type: 'chat', text: `/findbyid ${noteToDeleteId}` }));
        await waitForMessage(ws); // found_notes
        await waitForMessage(ws); // reply

        // Now delete it with auto-confirmation enabled
        ws.send(JSON.stringify({ type: 'chat', text: '/delete', autoConfirm: true }));

        // Wait for the first response
        let response = await waitForMessage(ws);
        console.log('Delete response type:', response.type);
        console.log('Delete response:', response);
        
        // If we get a confirmation request, auto-confirmation is not working
        if (response.type === 'reply' && response.text.includes('Are you sure you want to delete')) {
            assert.fail('Got confirmation request when auto-confirmation is enabled');
        }
        
        // If we got a reply about finding the note, wait for the next message
        if (response.type === 'reply' && response.text.includes('Found note')) {
            response = await waitForMessage(ws);
            console.log('Second delete response type:', response.type);
            console.log('Second delete response:', response);
        }
        
        // Check if it's a confirmation request (which would be wrong)
        if (response.type === 'reply' && response.text.includes('Are you sure you want to delete')) {
            // If we get a confirmation request, auto-confirmation is not working
            assert.fail('Got confirmation request when auto-confirmation is enabled');
        }
        
        // Otherwise, we should get a note_deleted message
        assert.strictEqual(response.type, 'note_deleted');
        assert.strictEqual(response.id, noteToDeleteId);

        response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'reply');
        assert.match(response.text, /Note .* deleted./);
    });

    await t.test('should disable auto-confirmation', { timeout: 5000 }, async () => {
        // First, wait for any pending messages from the previous test
        try {
            // Clear any pending messages
            let clearResponse;
            while ((clearResponse = await waitForMessage(ws)) !== undefined) {
                console.log('Clearing pending message:', clearResponse.type);
            }
        } catch (e) {
            // No more messages
        }
        
        // Disable auto-confirmation
        ws.send(JSON.stringify({ type: 'set_auto_confirm', enabled: false }));

        let response = await waitForMessage(ws);
        console.log('Disable auto-confirm response type:', response.type);
        console.log('Disable auto-confirm response:', response);
        assert.strictEqual(response.type, 'auto_confirm_status');
        assert.strictEqual(response.enabled, false);
    });

    await t.test('should create a note with confirmation when auto-confirmation is disabled', async () => {
        const initialNoteCount = NoteManager.getAll().length;

        // Create a note with auto-confirmation disabled
        ws.send(JSON.stringify({ type: 'chat', text: '/createnote Manual Confirm Note', autoConfirm: false }));

        // Wait for the response - should ask for confirmation
        let response = await waitForMessage(ws);
        console.log('Create note response type:', response.type);
        console.log('Create note response:', response);
        assert.strictEqual(response.type, 'reply');
        assert.match(response.text, /Do you want to create a note with title 'Manual Confirm Note'\? \(yes\/no\)/);

        // Confirm the creation
        ws.send(JSON.stringify({ type: 'chat', text: 'yes' }));

        response = await waitForMessage(ws);
        console.log('Confirm creation response type:', response.type);
        console.log('Confirm creation response:', response);
        assert.strictEqual(response.type, 'created_note');
        assert.strictEqual(response.note.title, 'Manual Confirm Note');
        noteIdToDelete = response.note.id;

        response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'reply');
        assert.match(response.text, /Note created successfully!/);

        const finalNoteCount = NoteManager.getAll().length;
        assert.strictEqual(finalNoteCount, initialNoteCount + 1);
    });

    ws.close();
    server.close((err) => {
        if (err) {
            console.error('Server close error:', err);
        }
    });
});
