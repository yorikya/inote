const fs = require('fs');
const path = require('path');

// Determine the data file based on environment and test suite
function getDataFile() {
  if (process.env.NODE_ENV === 'test') {
    // Check for specific test suite data file
    const testSuite = process.env.TEST_SUITE;
    if (testSuite) {
      return path.join(__dirname, 'test', `notes.${testSuite}.json`);
    }
    // Fallback to general test file
    return path.join(__dirname, 'test', 'notes.test.json');
  }
  return path.join(__dirname, 'notes.json');
}

const DATA_FILE = getDataFile();

const NoteManager = {
  notes: [],
  latestNoteId: 0, // Add latestNoteId
  load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(raw || '{ "notes": [], "latestNoteId": 0 }'); // Parse data object
        this.notes = data.notes || [];
        this.latestNoteId = data.latestNoteId || 0; // Load latestNoteId
      } else {
        this.notes = [];
        this.latestNoteId = 0;
        this.save();
      }
    } catch (e) {
      console.error('NoteManager.load error', e);
      this.notes = [];
      this.latestNoteId = 0;
    }
  },
  save() {
    try {
      const data = {
        notes: this.notes,
        latestNoteId: this.latestNoteId
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('NoteManager.save error', e);
    }
  },
  create(title, description = '', parent_id = null) {
    this.latestNoteId++; // Increment latestNoteId
    const id = this.latestNoteId.toString(); // Use latestNoteId as the new ID
    const note = { id, title, description, parent_id, done: false, images: [], deleted: false, creation_date: new Date().toISOString() };
    this.notes.push(note);
    this.save();
    return note;
  },
  update(id, patch) {
    const idx = this.notes.findIndex(n => n.id === id && !n.deleted);
    if (idx === -1) return null;
    this.notes[idx] = Object.assign({}, this.notes[idx], patch);
    this.save();
    return this.notes[idx];
  },
  appendToDescription(id, text) {
    const n = this.notes.find(x => x.id === id && !x.deleted);
    if (!n) return null;
    n.description = (n.description || '') + '\n' + text;
    this.save();
    return n;
  },
  delete(id) {
    const n = this.notes.find(x => x.id === id && !x.deleted);
    if (!n) return false;
    n.deleted = true;
    this.save();
    return true;
  },
  addImage(noteId, imagePath) {
    const note = this.notes.find(n => n.id === noteId && !n.deleted);
    if (!note) return null;
    note.images = note.images || [];
    note.images.push(imagePath);
    this.save();
    return note;
  },
  removeImage(noteId, imagePath) {
    const note = this.notes.find(n => n.id === noteId && !n.deleted);
    if (!note || !note.images) return null;
    note.images = note.images.filter(p => p !== imagePath);
    this.save();
    return note;
  },
  findByTitle(q) { const lower = (q||'').toLowerCase(); return this.notes.filter(n => !n.deleted && (n.title||'').toLowerCase().includes(lower)); },
  findById(id) { return this.notes.filter(n => !n.deleted && n.id === id); },
  findChildren(parentId) { return this.notes.filter(n => !n.deleted && n.parent_id === parentId); },
  getAll() { return this.notes.filter(n => !n.deleted); },
  clearAll() {
    this.notes = [];
    this.latestNoteId = 0; // Reset latestNoteId
    this.save();
  }
};

NoteManager.load();
module.exports = NoteManager;