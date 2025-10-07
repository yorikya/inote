
/*
Fuller port of note-speaker backend logic into a single min.js file.
Implements: persistent NoteManager (file-based JSON), CommandRouter for
slash-commands, a tiny AIService stub, HTTP endpoints for images, and
WebSocket message handling compatible with the frontend.
*/

const http = require('http');
const url = require('path');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.NODE_PORT || 30000;

const NoteManager = require('./NoteManager');
const CommandRouter = require('./CommandRouter');
const AIService = require('./AIService');
const StateManager = require('./StateManager');
const ImageManager = require('./ImageManager');

// HTTP server
const server = http.createServer((req, res) => {
  const p = url.parse(req.url).pathname;
  // Handle image upload
  if (p === '/uploadimage' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString(); // Convert Buffer to string
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { noteId, imageData, filename } = data;
        
        // Check if note exists
        const note = NoteManager.findById(noteId)[0];
        if (!note) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Note not found' }));
          return;
        }
        
        // Check image limit
        if (ImageManager.hasReachedImageLimit(noteId)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Maximum 5 images per note' }));
          return;
        }
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(imageData, 'base64');
        
        // Save image
        const imagePath = ImageManager.saveImage(noteId, imageBuffer, filename);
        
        // Update note with image path
        const images = note.images || [];
        images.push(imagePath);
        NoteManager.update(noteId, { images });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          imagePath,
          note: NoteManager.findById(noteId)[0]
        }));
      } catch (error) {
        console.error('Error uploading image:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to upload image' }));
      }
    });
    return;
  }
  
  // Serve images saved under /image/<rel>
  if (p && p.startsWith('/image/')) {
    const rel = decodeURIComponent(p.replace('/image/', ''));
    const fp = path.join(__dirname, rel);
    if (require('fs').existsSync(fp)) {
      const stream = require('fs').createReadStream(fp);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      stream.pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Image not found');
    return;
  }

  // Serve static frontend files from the www directory
  const wwwRoot = path.join(__dirname, '..', 'www');
  let relPath = p === '/' ? '/index.html' : p;
  // Strip leading slash
  if (relPath.startsWith('/')) relPath = relPath.slice(1);
  const fp = path.join(wwwRoot, relPath || 'index.html');
  if (require('fs').existsSync(fp) && require('fs').statSync(fp).isFile()) {
    const ext = path.extname(fp).toLowerCase();
    const map = { '.html': 'text/html', '.htm': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };
    const type = map[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    const stream = require('fs').createReadStream(fp);
    stream.pipe(res);
    return;
  }

  // default health text
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('min.js backend running');
});

const wss = new WebSocket.Server({ server });

wss.on('error', (error) => {
  console.error('WebSocket Server Error:', error);
});

function send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (e) { console.error('send err', e); } }

async function handleChat(ws, o) {
  const state = StateManager.getState(ws);
  const text = o.text || '';
  const lowerText = text.toLowerCase();
  
  // Check if autoConfirm is set in the message, otherwise use the value from StateManager
  const autoConfirm = o.autoConfirm !== undefined ? o.autoConfirm : StateManager.getAutoConfirm(ws);
  
  // Store the autoConfirm setting in StateManager if it's set in the message
  if (o.autoConfirm !== undefined) {
    StateManager.setAutoConfirm(ws, autoConfirm);
  }

  // Handle confirmation
  if (state.mode === 'pending_confirmation') {
    // Check if auto-confirmation is enabled
    if (autoConfirm || StateManager.getAutoConfirm(ws)) {
      // Auto-confirm the action
      const { action, data } = state.pendingConfirmation;
      switch (action) {
        case 'create_note':
          const newNote = NoteManager.create(data.title, data.description, data.parent_id);
          send(ws, { type: 'created_note', note: newNote });
          send(ws, { type: 'reply', text: `Note created successfully! ID: ${newNote.id}` });
          break;
        case 'delete_note':
          NoteManager.delete(data.id);
          send(ws, { type: 'note_deleted', id: data.id });
          send(ws, { type: 'reply', text: `Note ${data.id} deleted.` });
          break;
        case 'update_description':
          NoteManager.update(data.id, { description: data.description });
          send(ws, { type: 'note_updated', note: NoteManager.findById(data.id)[0] });
          send(ws, { type: 'reply', text: `Note description updated.` });
          break;
        case 'mark_done':
          NoteManager.update(data.id, { done: true });
          send(ws, { type: 'note_updated', note: NoteManager.findById(data.id)[0] });
          send(ws, { type: 'reply', text: `Note marked as done.` });
          break;
        case 'add_image':
          // Image is already saved, just confirm it was added
          const updatedNoteWithImage = NoteManager.findById(data.noteId)[0];
          send(ws, { type: 'note_updated', note: updatedNoteWithImage });
          send(ws, { type: 'reply', text: `Image "${data.imageName}" added to note.` });
          break;
        case 'confirm_image_upload':
          // Image was uploaded and confirmed, add it to the note
          const note = NoteManager.findById(data.noteId)[0];
          if (note) {
            const images = note.images || [];
            images.push(data.imagePath);
            NoteManager.update(data.noteId, { images });
            send(ws, { type: 'note_updated', note: NoteManager.findById(data.noteId)[0] });
            send(ws, { type: 'reply', text: `Image "${data.imageName}" added to note.` });
          }
          break;
        case 'add_image_to_note': {
          const { noteId, imagePath } = data;
          const notes = NoteManager.findById(noteId);
          if (notes && notes.length > 0) {
            const note = notes[0];
            
            // Check if image already exists to prevent duplicates
            if (!note.images) {
              note.images = [];
            }
            
            if (!note.images.includes(imagePath)) {
              note.images.push(imagePath);
              NoteManager.update(noteId, { images: note.images });
              
              const updatedNote = NoteManager.findById(noteId)[0];
              send(ws, { type: 'note_updated', note: updatedNote });
              send(ws, { type: 'reply', text: `Image added to note '${note.title}'.` });
            } else {
              send(ws, { type: 'reply', text: 'Image already exists in this note.' });
            }
          } else {
            send(ws, { type: 'reply', text: 'Note not found.' });
          }
          StateManager.initializeState(ws);
          return;
        }
      }
      StateManager.initializeState(ws); // Reset state
      return;
    }
    
    // If auto-confirmation is disabled, proceed with normal confirmation flow
    if (lowerText === 'yes') {
      const { action, data } = state.pendingConfirmation;
      switch (action) {
        case 'create_note':
          const newNote = NoteManager.create(data.title, data.description, data.parent_id);
          send(ws, { type: 'created_note', note: newNote });
          send(ws, { type: 'reply', text: `Note created successfully! ID: ${newNote.id}` });
          break;
        case 'delete_note':
          NoteManager.delete(data.id);
          send(ws, { type: 'note_deleted', id: data.id });
          send(ws, { type: 'reply', text: `Note ${data.id} deleted.` });
          break;
        case 'update_description':
          NoteManager.update(data.id, { description: data.description });
          send(ws, { type: 'note_updated', note: NoteManager.findById(data.id)[0] });
          send(ws, { type: 'reply', text: `Note description updated.` });
          break;
        case 'mark_done':
          NoteManager.update(data.id, { done: true });
          send(ws, { type: 'note_updated', note: NoteManager.findById(data.id)[0] });
          send(ws, { type: 'reply', text: `Note marked as done.` });
          break;
        case 'add_image':
          // Image is already saved, just confirm it was added
          const updatedNoteWithImage = NoteManager.findById(data.noteId)[0];
          send(ws, { type: 'note_updated', note: updatedNoteWithImage });
          send(ws, { type: 'reply', text: `Image "${data.imageName}" added to note.` });
          break;
        case 'confirm_image_upload':
          // Image was uploaded and confirmed, add it to the note
          const note = NoteManager.findById(data.noteId)[0];
          if (note) {
            const images = note.images || [];
            images.push(data.imagePath);
            NoteManager.update(data.noteId, { images });
            send(ws, { type: 'note_updated', note: NoteManager.findById(data.noteId)[0] });
            send(ws, { type: 'reply', text: `Image "${data.imageName}" added to note.` });
          }
          break;
        case 'add_image_to_note': {
          const { noteId, imagePath } = data;
          const notes = NoteManager.findById(noteId);
          if (notes && notes.length > 0) {
            const note = notes[0];
            
            // Check if image already exists to prevent duplicates
            if (!note.images) {
              note.images = [];
            }
            
            if (!note.images.includes(imagePath)) {
              note.images.push(imagePath);
              NoteManager.update(noteId, { images: note.images });
              
              const updatedNote = NoteManager.findById(noteId)[0];
              send(ws, { type: 'note_updated', note: updatedNote });
              send(ws, { type: 'reply', text: `Image added to note '${note.title}'.` });
            } else {
              send(ws, { type: 'reply', text: 'Image already exists in this note.' });
            }
          } else {
            send(ws, { type: 'reply', text: 'Note not found.' });
          }
          StateManager.initializeState(ws);
          return;
        }
      }
      StateManager.initializeState(ws); // Reset state
      return;
    } else if (lowerText === 'no') {
      // If user says no to adding image, we should remove it
      if (state.pendingConfirmation.action === 'add_image') {
        const { noteId, imagePath } = state.pendingConfirmation.data;
        // Remove the image from the note
        const note = NoteManager.findById(noteId)[0];
        if (note && note.images) {
          const updatedImages = note.images.filter(img => img.path !== imagePath);
          NoteManager.update(noteId, { images: updatedImages });
          // Optionally delete the file from disk
          ImageManager.deleteImage(imagePath);
        }
      }
      send(ws, { type: 'reply', text: 'Operation cancelled.' });
      StateManager.initializeState(ws); // Reset state
      return;
    }
  }

  // Handle story editing mode
  if (state.mode === 'story_editing') {
    if (lowerText === '/stopediting') {
      StateManager.setState(ws, {
        mode: 'pending_confirmation',
        pendingConfirmation: {
          action: 'update_description',
          data: { id: state.storyEditingNoteId, description: state.descriptionBuffer },
        },
      });
      send(ws, { type: 'reply', text: `Do you want to save the new description? (yes/no)` });
      return;
    }
    const newDescription = (state.descriptionBuffer || '') + text + '\n';
    StateManager.setState(ws, { descriptionBuffer: newDescription });
    send(ws, { type: 'reply', text: 'Content added. Continue typing or say /stopediting.' });
    return;
  }

  // Handle sub-note creation
  if (state.mode === 'pending_subnote_creation') {
    const parentNote = state.findContext.selectedNote;
    
    // Check if auto-confirmation is enabled
    if (autoConfirm || StateManager.getAutoConfirm(ws)) {
      // Auto-create the sub-note without asking for confirmation
      const newNote = NoteManager.create(text, '', parentNote.id);
      send(ws, { type: 'created_note', note: newNote });
      send(ws, { type: 'reply', text: `Sub-note created successfully! ID: ${newNote.id}, Title: '${text}'` });
      StateManager.initializeState(ws); // Reset state
      return;
    }
    
    // Otherwise, ask for confirmation
    StateManager.setState(ws, {
      mode: 'pending_confirmation',
      pendingConfirmation: {
        action: 'create_note',
        data: { title: text, parent_id: parentNote.id },
      },
    });
    send(ws, { type: 'reply', text: `Create sub-note '${text}' under '${parentNote.title}'? (yes/no)` });
    return;
  }

  // Handle AI conversation mode
  if (state.mode === 'ai_conversation') {
    if (['/stop', 'exit', 'cancel'].includes(lowerText)) {
      StateManager.setState(ws, { mode: 'find_context' });
      send(ws, { type: 'reply', text: 'AI conversation ended.' });
      return;
    }
    const aiResponse = await AIService.chatWithNote(state.aiConversationNoteId, text);
    send(ws, { type: 'ai_reply', text: aiResponse.reply });
    return;
  }

  if (text.startsWith('/')) {
    const parsed = CommandRouter.parseSlashCommand(text);
    if (!parsed) { send(ws, { type: 'reply', text: 'Bad command' }); return; }

    // State-dependent commands
    if (state.mode === 'find_context') {
      switch (parsed.cmd) {
        case '/delete':
          const noteToDelete = state.findContext.selectedNote;
          if (noteToDelete) {
            // Check if auto-confirmation is enabled
            if (autoConfirm || StateManager.getAutoConfirm(ws)) {
              // Auto-delete the note
              NoteManager.delete(noteToDelete.id);
              send(ws, { type: 'note_deleted', id: noteToDelete.id });
              send(ws, { type: 'reply', text: `Note ${noteToDelete.id} deleted.` });
              return;
            }
            
            // Otherwise, ask for confirmation
            StateManager.setState(ws, {
              mode: 'pending_confirmation',
              pendingConfirmation: {
                action: 'delete_note',
                data: { id: noteToDelete.id, title: noteToDelete.title },
              },
            });
            send(ws, { type: 'reply', text: `Are you sure you want to delete note '${noteToDelete.title}'? (yes/no)` });
          } else {
            send(ws, { type: 'reply', text: 'No note selected.' });
          }
          return;
        case '/editdescription':
          const noteToEdit = state.findContext.selectedNote;
          if (noteToEdit) {
            StateManager.setState(ws, { mode: 'story_editing', storyEditingNoteId: noteToEdit.id, descriptionBuffer: '' });
            send(ws, { type: 'reply', text: `Editing description for '${noteToEdit.title}'. Type your description. Say /stopediting when you are done.` });
          } else {
            send(ws, { type: 'reply', text: 'No note selected.' });
          }
          return;
        case '/markdone':
          const noteToMark = state.findContext.selectedNote;
          if (noteToMark) {
            // Check if auto-confirmation is enabled
            if (autoConfirm || StateManager.getAutoConfirm(ws)) {
              // Auto-mark the note as done
              NoteManager.update(noteToMark.id, { done: true });
              send(ws, { type: 'note_updated', note: NoteManager.findById(noteToMark.id)[0] });
              send(ws, { type: 'reply', text: `Note marked as done.` });
              return;
            }
            
            // Otherwise, ask for confirmation
            StateManager.setState(ws, {
              mode: 'pending_confirmation',
              pendingConfirmation: {
                action: 'mark_done',
                data: { id: noteToMark.id, title: noteToMark.title },
              },
            });
            send(ws, { type: 'reply', text: `Are you sure you want to mark note '${noteToMark.title}' as done? (yes/no)` });
          } else {
            send(ws, { type: 'reply', text: 'No note selected.' });
          }
          return;
        case '/talkai':
          const noteToTalk = state.findContext.selectedNote;
          if (noteToTalk) {
            StateManager.setState(ws, { mode: 'ai_conversation', aiConversationNoteId: noteToTalk.id });
            send(ws, { type: 'reply', text: `Starting AI conversation about '${noteToTalk.title}'. Say /stop to end.` });
          } else {
            send(ws, { type: 'reply', text: 'No note selected.' });
          }
          return;
        case '/selectsubnote':
          if (parsed.args.length > 0) {
            const noteId = parsed.args[0];
            const selectedNote = state.findContext.notes.find(n => String(n.id) === noteId);
            if (selectedNote) {
              StateManager.setState(ws, { findContext: { ...state.findContext, selectedNote } });
              send(ws, { type: 'reply', text: `Selected note '${selectedNote.title}'.` });
            } else {
              send(ws, { type: 'reply', text: 'Note not found in current context.' });
            }
          } else {
            send(ws, { type: 'reply', text: 'Usage: /selectsubnote [id]' });
          }
          return;
        case '/uploadimage':
          const noteToUpload = state.findContext.selectedNote;
          if (noteToUpload) {
            // Check if already has 5 images
            if (ImageManager.hasReachedImageLimit(noteToUpload.id)) {
              send(ws, { type: 'reply', text: 'Maximum 5 images per note. Please delete some images first.' });
              return;
            }
            
            // Send message to frontend to open file picker
            send(ws, { 
              type: 'request_image_upload', 
              data: { 
                noteId: noteToUpload.id,
                currentImageCount: ImageManager.getNoteImages(noteToUpload.id).length
              } 
            });
          } else {
            send(ws, { type: 'reply', text: 'No note selected.' });
          }
          return;
      }
    }

    // General commands
    switch (parsed.cmd) {
      case '/createnote':
        if (!parsed.args.length) { send(ws, { type: 'reply', text: 'Usage: /createnote TITLE' }); return; }
        const title = parsed.args.join(' ');
        
        // Check if auto-confirmation is enabled
        if (autoConfirm || StateManager.getAutoConfirm(ws)) {
          // Auto-create the note
          const newNote = NoteManager.create(title);
          send(ws, { type: 'created_note', note: newNote });
          send(ws, { type: 'reply', text: `Note created successfully! ID: ${newNote.id}` });
          return;
        }
        
        // Otherwise, ask for confirmation
        StateManager.setState(ws, {
          mode: 'pending_confirmation',
          pendingConfirmation: {
            action: 'create_note',
            data: { title },
          },
        });
        send(ws, { type: 'reply', text: `Do you want to create a note with title '${title}'? (yes/no)` });
        return;
      case '/findnote':
        if (!parsed.args.length) { send(ws, { type: 'reply', text: 'Usage: /findnote QUERY' }); return; }
        const notes = NoteManager.findByTitle(parsed.args.join(' '));
        StateManager.setState(ws, { mode: 'find_context', findContext: { notes, selectedNote: notes.length === 1 ? notes[0] : null } });
        send(ws, { type: 'found_notes', notes });
        if (notes.length === 1) {
          send(ws, { type: 'reply', text: `Found note '${notes[0].title}'. What would you like to do?` });
        } else {
          send(ws, { type: 'reply', text: `Found ${notes.length} notes.` });
        }
        return;
      case '/findbyid':
        if (!parsed.args.length) { send(ws, { type: 'reply', text: 'Usage: /findbyid ID' }); return; }
        const note = NoteManager.findById(parsed.args[0])[0];
        if (note) {
          const children = NoteManager.findChildren(note.id);
          const notesToShow = [note, ...children];
          StateManager.setState(ws, { mode: 'find_context', findContext: { notes: notesToShow, selectedNote: note } });
          send(ws, { type: 'found_notes', notes: notesToShow });
          send(ws, { type: 'reply', text: `Found note '${note.title}'. What would you like to do?` });
        } else {
          send(ws, { type: 'reply', text: 'Note not found.' });
        }
        return;
      case '/showparents':
        send(ws, { type: 'found_notes', notes: NoteManager.getAll().filter(n => !n.parent_id) });
        return;
      case '/createsubnote':
          let parentNote = null;
          if (parsed.args.length > 0) {
            const parentNoteId = parsed.args[0];
            parentNote = NoteManager.findById(parentNoteId)[0];
            if (!parentNote) {
              send(ws, { type: 'reply', text: 'Parent note not found.' });
              return;
            }
          } else {
            if (state.mode === 'find_context') {
              parentNote = state.findContext.selectedNote;
            }
          }

          if (parentNote) {
            StateManager.setState(ws, { mode: 'pending_subnote_creation', findContext: { ...state.findContext, selectedNote: parentNote } });
            send(ws, { type: 'reply', text: 'What is the title of the sub-note?' });
          } else {
            send(ws, { type: 'reply', text: 'No parent note selected. Use /findnote first or specify a parent note ID.' });
          }
          return;
      case '/editnotedescription':
        if (parsed.args.length < 3) {
          send(ws, { type: 'reply', text: 'Usage: /editnote [id] [property] [value]' });
          return;
        }
        const [noteId, property, ...valueParts] = parsed.args;
        const value = valueParts.join(' ');
        const noteToUpdate = NoteManager.findById(noteId)[0];

        if (!noteToUpdate) {
          send(ws, { type: 'reply', text: 'Note not found.' });
          return;
        }

        if (property.toLowerCase() === 'description') {
          NoteManager.update(noteId, { description: value });
          send(ws, { type: 'note_updated', note: NoteManager.findById(noteId)[0] });
          send(ws, { type: 'reply', text: `Note description updated.` });
        } else {
          send(ws, { type: 'reply', text: `Property '${property}' cannot be edited.` });
        }
        return;
      default:
        send(ws, { type: 'reply', text: 'Unknown slash command' });
        return;
    }
  }

  send(ws, { type: 'reply', text: 'Echo: ' + (o.text || '') });
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  StateManager.initializeState(ws);

  ws.on('message', async (msg) => {
    let o = null;
    try { o = JSON.parse(msg); } catch (e) { send(ws, { type: 'reply', text: 'Bad JSON' }); return; }
    if (!o.type) { send(ws, { type: 'reply', text: 'Missing message type' }); return; }
    try {
      switch (o.type) {
        case 'chat': await handleChat(ws, o); break;
        case 'get_commands': send(ws, { type: 'available_commands', commands: CommandRouter.getAvailableCommands() }); break;
        case 'get_all_notes': send(ws, { type: 'all_notes', notes: NoteManager.getAll() }); break;
        case 'create_note': send(ws, { type: 'created_note', note: NoteManager.create(o.title || 'Untitled', o.description || '', o.parent_id || null) }); break;
        case 'update_note': const updated = NoteManager.update(o.id, o.patch || {}); if (updated) send(ws, { type: 'note_updated', note: updated }); else send(ws, { type: 'reply', text: 'Note not found' }); break;
        case 'delete_note': if (NoteManager.delete(o.id)) send(ws, { type: 'note_deleted', id: o.id }); else send(ws, { type: 'reply', text: 'Note not found' }); break;
        case 'set_auto_confirm': StateManager.setAutoConfirm(ws, o.enabled); send(ws, { type: 'auto_confirm_status', enabled: o.enabled }); break;
        case 'debug': if (o.action === 'get_notes') send(ws, { type: 'debug_notes', notes: JSON.stringify(NoteManager.getAll(), null, 2) }); if (o.action === 'clear_notes') { NoteManager.clearAll(); send(ws, { type: 'debug_cleared' }); } break;
        
        case 'image_upload': {
          const { noteId, imageData, imageName } = o;
          
          // Validate inputs
          if (!noteId || !imageData || !imageName) {
            send(ws, { type: 'reply', text: 'Invalid image upload data. Missing noteId, imageData, or imageName.' });
            break;
          }

          // Find the note
          const notes = NoteManager.findById(noteId);
          if (!notes || notes.length === 0) {
            send(ws, { type: 'reply', text: `Note with ID ${noteId} not found.` });
            break;
          }

          const note = notes[0];

          // Save the image file
          const imagesDir = path.join(__dirname, 'images');
          if (!require('fs').existsSync(imagesDir)) {
            require('fs').mkdirSync(imagesDir, { recursive: true });
          }

          const timestamp = Date.now();
          const sanitizedName = imageName.replace(/[^a-zA-Z0-9._-]/g, '_');
          const fileName = `note_${noteId}_${timestamp}_${sanitizedName}`;
          const filePath = path.join(imagesDir, fileName);
          const relativeFilePath = `images/${fileName}`;

          try {
            // Decode base64 and save
            const buffer = Buffer.from(imageData, 'base64');
            require('fs').writeFileSync(filePath, buffer);
            console.log(`Image saved to: ${filePath}`);

            // Store the image path in state for confirmation
            StateManager.setState(ws, {
              mode: 'pending_confirmation',
              pendingConfirmation: {
                action: 'add_image_to_note',
                data: { noteId, imagePath: relativeFilePath, imageName }
              }
            });

            send(ws, { 
              type: 'reply', 
              text: `Image '${imageName}' uploaded successfully. Add it to note '${note.title}'? (yes/no)` 
            });
          } catch (error) {
            console.error('Error saving image:', error);
            send(ws, { type: 'reply', text: `Failed to save image: ${error.message}` });
          }
          break;
        }
        
        case 'request_file_picker': send(ws, { type: 'reply', text: 'Native file picker not available in Node backend (handled by Android)' }); break;
        default: send(ws, { type: 'reply', text: 'Unknown message type: ' + o.type });
      }
    } catch (e) { console.error('message handling error', e); send(ws, { type: 'reply', text: 'Internal server error' }); } 
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    StateManager.clearState(ws);
  });

  send(ws, { type: 'reply', text: 'Connected to min.js backend' });
});

// Only start the server if not being imported as a module
if (require.main === module) {
  server.listen(PORT, () => {
    const { port } = server.address();
    console.log(`NODE_PORT=${port}`);
    console.log(`min.js backend listening on port ${port}`);
  });
}

module.exports = { server, wss, NoteManager }