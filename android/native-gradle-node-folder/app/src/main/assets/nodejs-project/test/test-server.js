const WebSocket = require('ws');
const { NoteManager } = require('../NoteManager');
const { StateManager } = require('../StateManager');
const CommandRouter = require('../CommandRouter');
const AIService = require('../AIService');

class TestServer {
    constructor() {
        this.port = 0; // Will be assigned dynamically
        this.server = null;
        this.wss = null;
        this.notes = [];
    }

    async start() {
        return new Promise((resolve) => {
            // Create a test-specific NoteManager
            this.testNoteManager = {
                create: (title, description, parent_id) => {
                    const note = {
                        id: Date.now().toString(),
                        title,
                        description: description || '',
                        parent_id: parent_id || null,
                        done: false,
                        created_at: new Date().toISOString()
                    };
                    this.notes.push(note);
                    return note;
                },
                update: (id, patch) => {
                    const note = this.notes.find(n => n.id === id);
                    if (note) {
                        Object.assign(note, patch);
                        return note;
                    }
                    return null;
                },
                delete: (id) => {
                    const index = this.notes.findIndex(n => n.id === id);
                    if (index !== -1) {
                        this.notes.splice(index, 1);
                        return true;
                    }
                    return false;
                },
                findById: (id) => {
                    const note = this.notes.find(n => n.id === id);
                    return note ? [note] : [];
                },
                findByTitle: (title) => {
                    return this.notes.filter(n => n.title.includes(title));
                },
                getAll: () => this.notes,
                clearAll: () => { this.notes = []; }
            };

            // Create WebSocket server
            this.wss = new WebSocket.Server({ port: 0 }, () => {
                this.port = this.wss.address().port;
                console.log(`Test server started on port ${this.port}`);
                resolve();
            });

            // Handle connections
            this.wss.on('connection', (ws) => {
                console.log('Test client connected');
                StateManager.initializeState(ws);

                // Send connection message
                ws.send(JSON.stringify({ type: 'reply', text: 'Connected to test server' }));

                // Handle messages
                ws.on('message', async (msg) => {
                    let o = null;
                    try { o = JSON.parse(msg); } catch (e) { 
                        ws.send(JSON.stringify({ type: 'reply', text: 'Bad JSON' })); 
                        return; 
                    }
                    if (!o.type) { 
                        ws.send(JSON.stringify({ type: 'reply', text: 'Missing message type' })); 
                        return; 
                    }

                    try {
                        switch (o.type) {
                            case 'chat': await this.handleChat(ws, o); break;
                            case 'set_auto_confirm': 
                                StateManager.setAutoConfirm(ws, o.enabled);
                                ws.send(JSON.stringify({ type: 'auto_confirm_status', enabled: o.enabled }));
                                ws.send(JSON.stringify({ type: 'reply', text: `Auto confirmation ${o.enabled ? 'enabled' : 'disabled'}` }));
                                break;
                            default: ws.send(JSON.stringify({ type: 'reply', text: 'Unknown message type: ' + o.type }));
                        }
                    } catch (e) { 
                        console.error('message handling error', e); 
                        ws.send(JSON.stringify({ type: 'reply', text: 'Internal server error' })); 
                    }
                });

                ws.on('close', () => {
                    console.log('Test client disconnected');
                    StateManager.clearState(ws);
                });
            });
        });
    }

    async stop() {
        return new Promise((resolve) => {
            if (this.wss) {
                this.wss.close(() => {
                    console.log('Test server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    async handleChat(ws, o) {
        const state = StateManager.getState(ws);
        const text = o.text || '';
        const lowerText = text.toLowerCase();
        const autoConfirm = StateManager.getAutoConfirm(ws);

        // Handle confirmation
        if (state.mode === 'pending_confirmation') {
            if (autoConfirm || lowerText === 'yes') {
                const { action, data } = state.pendingConfirmation;
                switch (action) {
                    case 'create_note':
                        const newNote = this.testNoteManager.create(data.title, data.description, data.parent_id);
                        ws.send(JSON.stringify({ type: 'created_note', note: newNote }));
                        ws.send(JSON.stringify({ type: 'reply', text: `Note created successfully! ID: ${newNote.id}` }));
                        break;
                    case 'delete_note':
                        this.testNoteManager.delete(data.id);
                        ws.send(JSON.stringify({ type: 'note_deleted', id: data.id }));
                        ws.send(JSON.stringify({ type: 'reply', text: `Note ${data.id} deleted.` }));
                        break;
                    case 'update_description':
                        this.testNoteManager.update(data.id, { description: data.description });
                        ws.send(JSON.stringify({ type: 'note_updated', note: this.testNoteManager.findById(data.id)[0] }));
                        ws.send(JSON.stringify({ type: 'reply', text: `Note description updated.` }));
                        break;
                    case 'mark_done':
                        this.testNoteManager.update(data.id, { done: true });
                        ws.send(JSON.stringify({ type: 'note_updated', note: this.testNoteManager.findById(data.id)[0] }));
                        ws.send(JSON.stringify({ type: 'reply', text: `Note marked as done.` }));
                        break;
                }
                StateManager.initializeState(ws);
                return;
            } else if (lowerText === 'no') {
                ws.send(JSON.stringify({ type: 'reply', text: 'Operation cancelled.' }));
                StateManager.initializeState(ws);
                return;
            }
        }

        // Parse command
        const parsed = CommandRouter.parse(text);
        if (!parsed) {
            ws.send(JSON.stringify({ type: 'reply', text: 'Echo: ' + text }));
            return;
        }

        // Handle commands
        switch (parsed.command) {
            case '/createnote':
                const title = parsed.args.join(' ');
                if (!title) {
                    ws.send(JSON.stringify({ type: 'reply', text: 'Usage: /createnote TITLE' }));
                    return;
                }

                if (autoConfirm) {
                    const newNote = this.testNoteManager.create(title);
                    ws.send(JSON.stringify({ type: 'created_note', note: newNote }));
                    ws.send(JSON.stringify({ type: 'reply', text: `Note created successfully! ID: ${newNote.id}` }));
                    return;
                }

                StateManager.setState(ws, {
                    mode: 'pending_confirmation',
                    pendingConfirmation: {
                        action: 'create_note',
                        data: { title },
                    },
                });
                ws.send(JSON.stringify({ type: 'reply', text: `Do you want to create a note with title '${title}'? (yes/no)` }));
                return;

            case '/findnote':
                if (!parsed.args.length) {
                    ws.send(JSON.stringify({ type: 'reply', text: 'Usage: /findnote QUERY' }));
                    return;
                }
                const notes = this.testNoteManager.findByTitle(parsed.args.join(' '));
                StateManager.setState(ws, { mode: 'find_context', findContext: { notes, selectedNote: notes.length === 1 ? notes[0] : null } });
                ws.send(JSON.stringify({ type: 'found_notes', notes });
                if (notes.length === 1) {
                    ws.send(JSON.stringify({ type: 'reply', text: `Found note '${notes[0].title}'. What would you like to do?` }));
                } else {
                    ws.send(JSON.stringify({ type: 'reply', text: `Found ${notes.length} notes.` }));
                }
                return;

            case '/edit':
                if (state.mode !== 'find_context' || !state.findContext.selectedNote) {
                    ws.send(JSON.stringify({ type: 'reply', text: 'Please find a note first' }));
                    return;
                }
                const newTitle = parsed.args.join(' ');
                if (!newTitle) {
                    ws.send(JSON.stringify({ type: 'reply', text: 'Usage: /edit NEW_TITLE' }));
                    return;
                }

                if (autoConfirm) {
                    const updatedNote = this.testNoteManager.update(state.findContext.selectedNote.id, { title: newTitle });
                    ws.send(JSON.stringify({ type: 'note_updated', note: updatedNote }));
                    ws.send(JSON.stringify({ type: 'reply', text: 'Note updated.' }));
                    return;
                }

                StateManager.setState(ws, {
                    mode: 'pending_confirmation',
                    pendingConfirmation: {
                        action: 'update_description',
                        data: { id: state.findContext.selectedNote.id, title: newTitle },
                    },
                });
                ws.send(JSON.stringify({ type: 'reply', text: `Do you want to update the note title to '${newTitle}'? (yes/no)` }));
                return;

            case '/delete':
                if (state.mode !== 'find_context' || !state.findContext.selectedNote) {
                    ws.send(JSON.stringify({ type: 'reply', text: 'Please find a note first' }));
                    return;
                }

                if (autoConfirm) {
                    this.testNoteManager.delete(state.findContext.selectedNote.id);
                    ws.send(JSON.stringify({ type: 'note_deleted', id: state.findContext.selectedNote.id }));
                    ws.send(JSON.stringify({ type: 'reply', text: `Note ${state.findContext.selectedNote.id} deleted.` }));
                    return;
                }

                StateManager.setState(ws, {
                    mode: 'pending_confirmation',
                    pendingConfirmation: {
                        action: 'delete_note',
                        data: { id: state.findContext.selectedNote.id },
                    },
                });
                ws.send(JSON.stringify({ type: 'reply', text: `Do you want to delete this note? (yes/no)` }));
                return;

            case '/markdone':
                if (state.mode !== 'find_context' || !state.findContext.selectedNote) {
                    ws.send(JSON.stringify({ type: 'reply', text: 'Please find a note first' }));
                    return;
                }

                if (autoConfirm) {
                    this.testNoteManager.update(state.findContext.selectedNote.id, { done: true });
                    ws.send(JSON.stringify({ type: 'note_updated', note: this.testNoteManager.findById(state.findContext.selectedNote.id)[0] }));
                    ws.send(JSON.stringify({ type: 'reply', text: `Note marked as done.` }));
                    return;
                }

                StateManager.setState(ws, {
                    mode: 'pending_confirmation',
                    pendingConfirmation: {
                        action: 'mark_done',
                        data: { id: state.findContext.selectedNote.id },
                    },
                });
                ws.send(JSON.stringify({ type: 'reply', text: `Do you want to mark this note as done? (yes/no)` }));
                return;

            default:
                ws.send(JSON.stringify({ type: 'reply', text: 'Unknown slash command' }));
                return;
        }
    }
}

module.exports = TestServer;
