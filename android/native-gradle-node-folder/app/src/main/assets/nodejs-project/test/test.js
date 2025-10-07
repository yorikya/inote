const test = require('node:test');
const assert = require('node:assert');
const { server, wss, NoteManager } = require('../min.js');
const WebSocket = require('ws');

function waitForMessage(ws) {
    return new Promise(resolve => {
        ws.once('message', (data) => resolve(JSON.parse(data.toString())));
    });
}

test('Note Speaker E2E Test with Confirmations', async (t) => {
    const PORT = server.address().port;
    const ws = new WebSocket(`ws://localhost:${PORT}`);

    await new Promise(resolve => ws.on('open', resolve));
    await waitForMessage(ws); // Wait for connection message

    let noteIdToDelete;

    await t.test('should create a note with confirmation', async () => {
        ws.send(JSON.stringify({ type: 'chat', text: '/createnote Confirmation Note' }));
        
        let response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'reply');
        assert.match(response.text, /Do you want to create a note with title 'Confirmation Note'\? \(yes\/no\)/);

        ws.send(JSON.stringify({ type: 'chat', text: 'yes' }));

        response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'created_note');
        assert.strictEqual(response.note.title, 'Confirmation Note');
        noteIdToDelete = response.note.id;

        response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'reply');
        assert.match(response.text, /Note created successfully!/);
    });

    await t.test('should cancel note creation', async () => {
        const initialNoteCount = NoteManager.getAll().length;

        ws.send(JSON.stringify({ type: 'chat', text: '/createnote Cancel Test' }));

        let response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'reply');
        assert.match(response.text, /Do you want to create a note with title 'Cancel Test'\? \(yes\/no\)/);

        ws.send(JSON.stringify({ type: 'chat', text: 'no' }));

        response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'reply');
        assert.strictEqual(response.text, 'Operation cancelled.');

        const finalNoteCount = NoteManager.getAll().length;
        assert.strictEqual(finalNoteCount, initialNoteCount);
    });

    await t.test('should delete a note with confirmation', async () => {
        // Find the note first to enter find_context
        ws.send(JSON.stringify({ type: 'chat', text: `/findbyid ${noteIdToDelete}` }));
        await waitForMessage(ws); // found_notes
        await waitForMessage(ws); // reply

        // Now delete it
        ws.send(JSON.stringify({ type: 'chat', text: '/delete' }));

        let response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'reply');
        assert.match(response.text, /Are you sure you want to delete note 'Confirmation Note'\? \(yes\/no\)/);

        ws.send(JSON.stringify({ type: 'chat', text: 'yes' }));

        response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'note_deleted');
        assert.strictEqual(response.id, noteIdToDelete);

        response = await waitForMessage(ws);
        assert.strictEqual(response.type, 'reply');
        assert.match(response.text, /Note .* deleted./);
    });

    ws.close();
    server.close((err) => {
        if (err) {
            console.error('Server close error:', err);
        }
    });
});