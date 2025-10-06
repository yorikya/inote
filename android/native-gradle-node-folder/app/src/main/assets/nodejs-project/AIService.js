const NoteManager = require('./NoteManager');

const AIService = {
  chatWithNote(noteId, message) {
    const note = NoteManager.findById(noteId)[0];
    const context = note ? `Note: ${note.title}\n${note.description}` : 'No note context';
    return Promise.resolve({ reply: `AI (stub) response about the note:\n${context}\nUser: ${message}` });
  }
};

module.exports = AIService;
