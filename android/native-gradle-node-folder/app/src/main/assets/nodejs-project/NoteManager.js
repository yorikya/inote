const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'notes.json');

const NoteManager = {
  notes: [],
  lastId: 0,
  load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw || '[]');
        this.notes = parsed || [];
        this.lastId = this.notes.reduce((m, n) => Math.max(m, parseInt(n.id || 0)), 0);
      } else {
        this.notes = [];
        this.lastId = 0;
        this.save();
      }
    } catch (e) {
      console.error('NoteManager.load error', e);
      this.notes = [];
      this.lastId = 0;
    }
  },
  save() {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(this.notes, null, 2), 'utf8'); } catch (e) { console.error('NoteManager.save error', e); }
  },
  create(title, description = '', parent_id = null) {
    const id = (++this.lastId).toString();
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
  findByTitle(q) { const lower = (q||'').toLowerCase(); return this.notes.filter(n => !n.deleted && (n.title||'').toLowerCase().includes(lower)); },
  findById(id) { return this.notes.filter(n => !n.deleted && n.id === id); },
  findChildren(parentId) { return this.notes.filter(n => !n.deleted && n.parent_id === parentId); },
  getAll() { return this.notes.filter(n => !n.deleted); },
  clearAll() { this.notes = []; this.lastId = 0; this.save(); }
};

NoteManager.load();
module.exports = NoteManager;
