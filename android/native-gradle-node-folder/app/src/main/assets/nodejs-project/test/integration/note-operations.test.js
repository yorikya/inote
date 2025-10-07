const test = require('node:test');
const assert = require('node:assert');
const testUtils = require('../test-utils');

test('Note Operations Integration Test', async (t) => {
    await testUtils.withTestServer(async (server) => {
        await testUtils.withTestClient(server, async (ws) => {
            // Test 1: Enable auto-confirmation
            await t.test('should enable auto-confirmation', async () => {
                ws.send(JSON.stringify({ type: 'set_auto_confirm', enabled: true }));

                const responses = await testUtils.waitForMessages(ws, 2);
                assert.strictEqual(responses[0].type, 'auto_confirm_status');
                assert.strictEqual(responses[0].enabled, true);
                assert.strictEqual(responses[1].type, 'reply');
                assert.match(responses[1].text, /Auto confirmation enabled/);
            });

            // Test 2: Create a note with auto-confirmation
            await t.test('should create a note with auto-confirmation', async () => {
                const initialNoteCount = server.testNoteManager.getAll().length;

                ws.send(JSON.stringify({ type: 'chat', text: '/createnote Test Note' }));

                const responses = await testUtils.waitForMessages(ws, 2);
                assert.strictEqual(responses[0].type, 'created_note');
                assert.strictEqual(responses[0].note.title, 'Test Note');
                assert.strictEqual(responses[1].type, 'reply');
                assert.match(responses[1].text, /Note created successfully/);

                const finalNoteCount = server.testNoteManager.getAll().length;
                assert.strictEqual(finalNoteCount, initialNoteCount + 1);
            });

            // Test 3: Find a note
            await t.test('should find a note', async () => {
                ws.send(JSON.stringify({ type: 'chat', text: '/findnote Test Note' }));

                const responses = await testUtils.waitForMessages(ws, 2);
                assert.strictEqual(responses[0].type, 'found_notes');
                assert.strictEqual(responses[0].notes.length, 1);
                assert.strictEqual(responses[0].notes[0].title, 'Test Note');
                assert.strictEqual(responses[1].type, 'reply');
                assert.match(responses[1].text, /Found 1 note/);
            });

            // Test 4: Update a note
            await t.test('should update a note', async () => {
                ws.send(JSON.stringify({ type: 'chat', text: '/findnote Test Note' }));
                await testUtils.waitForMessages(ws, 2); // found_notes and reply

                ws.send(JSON.stringify({ type: 'chat', text: '/edit Updated Test Note' }));

                const responses = await testUtils.waitForMessages(ws, 2);
                assert.strictEqual(responses[0].type, 'note_updated');
                assert.strictEqual(responses[0].note.title, 'Updated Test Note');
                assert.strictEqual(responses[1].type, 'reply');
                assert.match(responses[1].text, /Note updated/);
            });

            // Test 5: Mark a note as done
            await t.test('should mark a note as done', async () => {
                ws.send(JSON.stringify({ type: 'chat', text: '/findnote Updated Test Note' }));
                await testUtils.waitForMessages(ws, 2); // found_notes and reply

                ws.send(JSON.stringify({ type: 'chat', text: '/markdone' }));

                const responses = await testUtils.waitForMessages(ws, 2);
                assert.strictEqual(responses[0].type, 'note_updated');
                assert.strictEqual(responses[0].note.done, true);
                assert.strictEqual(responses[1].type, 'reply');
                assert.match(responses[1].text, /Note marked as done/);
            });

            // Test 6: Delete a note
            await t.test('should delete a note', async () => {
                ws.send(JSON.stringify({ type: 'chat', text: '/findnote Updated Test Note' }));
                await testUtils.waitForMessages(ws, 2); // found_notes and reply

                const initialNoteCount = server.testNoteManager.getAll().length;

                ws.send(JSON.stringify({ type: 'chat', text: '/delete' }));

                const responses = await testUtils.waitForMessages(ws, 2);
                assert.strictEqual(responses[0].type, 'note_deleted');
                assert.strictEqual(responses[1].type, 'reply');
                assert.match(responses[1].text, /deleted/);

                const finalNoteCount = server.testNoteManager.getAll().length;
                assert.strictEqual(finalNoteCount, initialNoteCount - 1);
            });

            // Test 7: Disable auto-confirmation
            await t.test('should disable auto-confirmation', async () => {
                ws.send(JSON.stringify({ type: 'set_auto_confirm', enabled: false }));

                const responses = await testUtils.waitForMessages(ws, 2);
                assert.strictEqual(responses[0].type, 'auto_confirm_status');
                assert.strictEqual(responses[0].enabled, false);
                assert.strictEqual(responses[1].type, 'reply');
                assert.match(responses[1].text, /Auto confirmation disabled/);
            });

            // Test 8: Create a note with confirmation
            await t.test('should create a note with confirmation', async () => {
                const initialNoteCount = server.testNoteManager.getAll().length;

                ws.send(JSON.stringify({ type: 'chat', text: '/createnote Manual Note' }));

                // Should ask for confirmation
                let response = await testUtils.waitForMessage(ws);
                assert.strictEqual(response.type, 'reply');
                assert.match(response.text, /Do you want to create a note/);

                // Confirm the creation
                ws.send(JSON.stringify({ type: 'chat', text: 'yes' }));

                const responses = await testUtils.waitForMessages(ws, 2);
                assert.strictEqual(responses[0].type, 'created_note');
                assert.strictEqual(responses[0].note.title, 'Manual Note');
                assert.strictEqual(responses[1].type, 'reply');
                assert.match(responses[1].text, /Note created successfully/);

                const finalNoteCount = server.testNoteManager.getAll().length;
                assert.strictEqual(finalNoteCount, initialNoteCount + 1);
            });
        });
    });
});
