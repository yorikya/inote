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

test('Basic Note Operations Test', { timeout: 10000 }, async (t) => {
    const PORT = process.env.NODE_PORT || 30000;
    const ws = new WebSocket(`ws://localhost:${PORT}`);

    // Wait for connection
    await new Promise(resolve => {
        ws.on('open', resolve);
    });

    // Test 1: Create a note
    await t.test('should create a note', async () => {
        const initialNoteCount = NoteManager.getAll().length;

        // Create a note
        ws.send(JSON.stringify({ type: 'chat', text: '/createnote Test Note' }));

        // Wait for the confirmation request
        let response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'reply');
        assert.match(response.text, /Do you want to create a note with title 'Test Note'\? \(yes\/no\)/);

        // Confirm the creation
        ws.send(JSON.stringify({ type: 'chat', text: 'yes' }));

        response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'created_note');
        assert.strictEqual(response.note.title, 'Test Note');

        const finalNoteCount = NoteManager.getAll().length;
        assert.strictEqual(finalNoteCount, initialNoteCount + 1);
    });

    // Test 2: Find a note
    await t.test('should find a note', async () => {
        // Find the note
        ws.send(JSON.stringify({ type: 'chat', text: '/findnote Test Note' }));

        // Wait for the response
        let response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'found_notes');
        assert.strictEqual(response.notes.length, 1);
        assert.strictEqual(response.notes[0].title, 'Test Note');

        response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'reply');
        assert.match(response.text, /Found 1 note/);
    });

    // Test 3: Update a note
    await t.test('should update a note', async () => {
        // First, find the note
        ws.send(JSON.stringify({ type: 'chat', text: '/findnote Test Note' }));
        await waitForMessage(ws); // found_notes
        await waitForMessage(ws); // reply

        // Update the note
        ws.send(JSON.stringify({ type: 'chat', text: '/edit Updated Test Note' }));

        // Wait for the confirmation request
        let response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'reply');
        assert.match(response.text, /Are you sure you want to update note 'Test Note'\? \(yes\/no\)/);

        // Confirm the update
        ws.send(JSON.stringify({ type: 'chat', text: 'yes' }));

        response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'note_updated');
        assert.strictEqual(response.note.title, 'Updated Test Note');
    });

    // Test 4: Mark a note as done
    await t.test('should mark a note as done', async () => {
        // First, find the note
        ws.send(JSON.stringify({ type: 'chat', text: '/findnote Updated Test Note' }));
        await waitForMessage(ws); // found_notes
        await waitForMessage(ws); // reply

        // Mark the note as done
        ws.send(JSON.stringify({ type: 'chat', text: '/markdone' }));

        // Wait for the confirmation request
        let response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'reply');
        assert.match(response.text, /Are you sure you want to mark note 'Updated Test Note' as done\? \(yes\/no\)/);

        // Confirm the action
        ws.send(JSON.stringify({ type: 'chat', text: 'yes' }));

        response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'note_updated');
        assert.strictEqual(response.note.done, true);
    });

    // Test 5: Delete a note
    await t.test('should delete a note', async () => {
        // First, find the note
        ws.send(JSON.stringify({ type: 'chat', text: '/findnote Updated Test Note' }));
        await waitForMessage(ws); // found_notes
        await waitForMessage(ws); // reply

        // Delete the note
        ws.send(JSON.stringify({ type: 'chat', text: '/delete' }));

        // Wait for the confirmation request
        let response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'reply');
        assert.match(response.text, /Are you sure you want to delete note 'Updated Test Note'\? \(yes\/no\)/);

        // Confirm the deletion
        ws.send(JSON.stringify({ type: 'chat', text: 'yes' }));

        response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'note_deleted');
    });

    // Close the connection
    ws.close();
});
