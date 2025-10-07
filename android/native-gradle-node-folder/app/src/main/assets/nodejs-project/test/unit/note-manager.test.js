const test = require('node:test');
const assert = require('node:assert');
const NoteManager = require('../../NoteManager');

test('NoteManager.create', (t) => {
    // Clean up before test
    NoteManager.clearAll();

    // Test creating a note with just title
    const note1 = NoteManager.create('Test Note 1');
    assert.strictEqual(note1.title, 'Test Note 1');
    assert.strictEqual(note1.description, '');
    assert.strictEqual(note1.parent_id, null);
    assert.strictEqual(note1.done, false);
    assert.ok(note1.id);
    assert.ok(note1.created_at);

    // Test creating a note with title and description
    const note2 = NoteManager.create('Test Note 2', 'Test Description');
    assert.strictEqual(note2.title, 'Test Note 2');
    assert.strictEqual(note2.description, 'Test Description');

    // Test creating a note with parent
    const note3 = NoteManager.create('Child Note', '', note1.id);
    assert.strictEqual(note3.parent_id, note1.id);
});

test('NoteManager.update', (t) => {
    // Clean up before test
    NoteManager.clearAll();

    // Create a note to update
    const note = NoteManager.create('Original Title');

    // Update title
    const updated = NoteManager.update(note.id, { title: 'Updated Title' });
    assert.strictEqual(updated.title, 'Updated Title');

    // Update description
    NoteManager.update(note.id, { description: 'Updated Description' });
    const noteWithDesc = NoteManager.findById(note.id)[0];
    assert.strictEqual(noteWithDesc.description, 'Updated Description');

    // Update done status
    NoteManager.update(note.id, { done: true });
    const doneNote = NoteManager.findById(note.id)[0];
    assert.strictEqual(doneNote.done, true);

    // Test updating non-existent note
    const notUpdated = NoteManager.update('non-existent-id', { title: 'New Title' });
    assert.strictEqual(notUpdated, null);
});

test('NoteManager.delete', (t) => {
    // Clean up before test
    NoteManager.clearAll();

    // Create a note to delete
    const note = NoteManager.create('Note to Delete');
    const noteId = note.id;

    // Delete the note
    const deleted = NoteManager.delete(noteId);
    assert.strictEqual(deleted, true);

    // Verify it's gone
    const found = NoteManager.findById(noteId);
    assert.strictEqual(found.length, 0);

    // Test deleting non-existent note
    const notDeleted = NoteManager.delete('non-existent-id');
    assert.strictEqual(notDeleted, false);
});

test('NoteManager.findById', (t) => {
    // Clean up before test
    NoteManager.clearAll();

    // Create a note to find
    const note = NoteManager.create('Find Me');

    // Find the note
    const found = NoteManager.findById(note.id);
    assert.strictEqual(found.length, 1);
    assert.strictEqual(found[0].id, note.id);

    // Test finding non-existent note
    const notFound = NoteManager.findById('non-existent-id');
    assert.strictEqual(notFound.length, 0);
});

test('NoteManager.findByTitle', (t) => {
    // Clean up before test
    NoteManager.clearAll();

    // Create notes with similar titles
    NoteManager.create('Shopping List');
    NoteManager.create('Work Tasks');
    NoteManager.create('Shopping Items');

    // Find notes with "shopping" in title
    const shoppingNotes = NoteManager.findByTitle('shopping');
    assert.strictEqual(shoppingNotes.length, 2);
    assert.ok(shoppingNotes.every(note => note.title.toLowerCase().includes('shopping')));

    // Find exact match
    const exactNotes = NoteManager.findByTitle('Shopping List');
    assert.strictEqual(exactNotes.length, 1);
    assert.strictEqual(exactNotes[0].title, 'Shopping List');

    // Find non-existent title
    const notFound = NoteManager.findByTitle('Non-existent');
    assert.strictEqual(notFound.length, 0);
});

test('NoteManager.getAll', (t) => {
    // Clean up before test
    NoteManager.clearAll();

    // Create some notes
    NoteManager.create('Note 1');
    NoteManager.create('Note 2');
    NoteManager.create('Note 3');

    // Get all notes
    const allNotes = NoteManager.getAll();
    assert.strictEqual(allNotes.length, 3);

    // Clean up
    NoteManager.clearAll();

    // Verify empty
    const emptyNotes = NoteManager.getAll();
    assert.strictEqual(emptyNotes.length, 0);
});
