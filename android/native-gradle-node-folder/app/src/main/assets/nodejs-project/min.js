
/*
Fuller port of note-speaker backend logic into a single min.js file.
Implements: persistent NoteManager (file-based JSON), CommandRouter for
slash-commands, a tiny AIService stub, HTTP endpoints for images, and
WebSocket message handling compatible with the frontend.
*/

const http = require('http');
const url = require('url');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.NODE_PORT || 30000;
const HOST = '0.0.0.0'; // Bind to all network interfaces instead of just localhost

const NoteManager = require('./NoteManager');
const CommandRouter = require('./CommandRouter');
const AIService = require('./AIService');
const StateManager = require('./StateManager');
const ImageManager = require('./ImageManager');

// HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  const p = parsedUrl.pathname;
  
  
  // Serve images saved under /image/<rel>
  if (p && p.startsWith('/image/')) {
    const filename = decodeURIComponent(p.replace('/image/', ''));
    const fp = path.join(__dirname, 'images', filename);
    if (require('fs').existsSync(fp)) {
      const ext = path.extname(fp).toLowerCase();
      const map = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.gif': 'image/gif' };
      const type = map[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      const stream = require('fs').createReadStream(fp);
      stream.pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Image not found');
    return;
  }

  // Serve static frontend files from the www directory
  const wwwRoot = path.join(__dirname, '..', 'www');
  let relPath = p === '/' ? '/index.html' : (p || '/index.html');
  // Strip leading slash
  if (relPath.startsWith('/')) relPath = relPath.slice(1);
  const fp = path.join(wwwRoot, relPath);
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

function send(ws, obj) { 
  try { 
    ws.send(JSON.stringify(obj)); 
  } catch (e) { 
    console.error('send err', e); 
  } 
}

function sendUpdatedCommands(ws) {
  const commands = CommandRouter.getAvailableCommands(ws, StateManager);
  send(ws, { type: 'available_commands', commands });
}

function formatNoteTree(note, children) {
  let result = '';
  
  // Format parent note with icon and styling
  result += `📝 ${note.title} (ID: ${note.id})`;
  
  // Add parent indicator if it's a parent note
  if (!note.parent_id) {
    result += ' [Parent]';
  }
  
  // Add description if exists
  if (note.description && note.description.trim()) {
    result += `\n   💬 ${note.description}`;
  }
  
  // Add status if marked as done
  if (note.is_done) {
    result += '\n   ✅ Completed';
  }
  
  // Add image count if any
  const imageCount = ImageManager.getNoteImages(note.id).length;
  if (imageCount > 0) {
    result += `\n   📷 ${imageCount} image${imageCount > 1 ? 's' : ''}`;
  }
  
  // Add children if any
  if (children && children.length > 0) {
    result += `\n   📋 Sub-notes (${children.length}):`;
    children.forEach((child, index) => {
      result += `\n      ${index + 1}. ${child.title} (ID: ${child.id})`;
      if (child.is_done) {
        result += ' ✅';
      }
    });
  }
  
  return result;
}

async function processCommandWithParsed(ws, parsed, autoConfirm) {
  // console.log('DEBUG: processCommandWithParsed called with command:', parsed.cmd, 'args:', parsed.args);
  // Handle slash commands
  switch (parsed.cmd) {
    case '/createnote': {
      const noteTitle = parsed.args.join(' ');
      
      // Check if auto-confirmation is enabled
      if (autoConfirm || StateManager.getAutoConfirm(ws)) {
        // Auto-create the note
        const newNote = NoteManager.create(noteTitle);
        send(ws, { type: 'created_note', note: newNote });
        send(ws, { type: 'reply', text: `Note '${newNote.title}' (ID: ${newNote.id}) created successfully!` });
        return;
      }
      
      // Otherwise, ask for confirmation
      StateManager.setState(ws, {
        mode: 'pending_confirmation',
        pendingConfirmation: {
          action: 'create_note',
          data: { title: noteTitle },
        },
      });
      sendUpdatedCommands(ws);
      send(ws, { type: 'reply', text: `Do you want to create a note with title '${noteTitle}'? (yes/no)` });
      return;
    }
      
    case '/findnote': {
      const notes = NoteManager.findByTitle(parsed.args.join(' '));
      StateManager.setState(ws, { mode: 'find_context', findContext: { notes, selectedNote: notes.length === 1 ? notes[0] : null } });
      send(ws, { type: 'found_notes', notes });
      sendUpdatedCommands(ws);
      
      if (notes.length === 0) {
        send(ws, { type: 'reply', text: '❌ No notes have been found' });
      } else if (notes.length === 1) {
        const note = notes[0];
        const children = NoteManager.findChildren(note.id);
        const tree = formatNoteTree(note, children);
        send(ws, { type: 'reply', text: `✨ Found note:\n\n${tree}` });
      } else {
        let noteList = `✨ Found ${notes.length} notes:\n\n`;
        notes.forEach((note, index) => {
          noteList += `${index + 1}. 📝 ${note.title} (ID: ${note.id})`;
          if (note.is_done) {
            noteList += ' ✅';
          }
          noteList += '\n';
        });
        noteList += `\n💡 Use /selectsubnote [id] to select a note`;
        send(ws, { type: 'reply', text: noteList });
      }
      return;
    }
      
    case '/findbyid': {
      const noteId = parsed.args[0];
      const note = NoteManager.findById(noteId)[0];
      if (note) {
        const children = NoteManager.findChildren(note.id);
        const notesToShow = [note, ...children];
        const tree = formatNoteTree(note, children);
        StateManager.setState(ws, { mode: 'find_context', findContext: { notes: notesToShow, selectedNote: note } });
        send(ws, { type: 'found_notes', notes: notesToShow });
        sendUpdatedCommands(ws);
        send(ws, { type: 'reply', text: `✨ Found note:\n\n${tree}` });
      } else {
        send(ws, { type: 'reply', text: '❌ Note not found' });
      }
      return;
    }
      
    case '/showparents': {
      const allNotes = NoteManager.getAll();
      const parentNotes = allNotes.filter(note => !note.parent_id);
      
      // Reset to initial state since we're showing all parent notes
      StateManager.initializeState(ws);
      sendUpdatedCommands(ws);
      
      send(ws, { type: 'found_notes', notes: parentNotes });
      if (parentNotes.length === 0) {
        send(ws, { type: 'reply', text: '❌ No parent notes have been found' });
      } else {
        let noteList = `📚 Parent notes (${parentNotes.length}):\n\n`;
        parentNotes.forEach((note, index) => {
          noteList += `${index + 1}. 📝 ${note.title} (ID: ${note.id})`;
          if (note.is_done) {
            noteList += ' ✅';
          }
          const childCount = NoteManager.findChildren(note.id).length;
          if (childCount > 0) {
            noteList += ` 📋 ${childCount}`;
          }
          noteList += '\n';
        });
        send(ws, { type: 'reply', text: noteList });
      }
      return;
    }
      
    default:
      send(ws, { type: 'reply', text: `Unknown command: ${parsed.cmd}` });
      return;
  }
}


// Helper function to handle confirmation actions
async function handleConfirmationAction(ws, action, data, autoConfirm) {
  switch (action) {
    case 'create_note': {
      const newNote = NoteManager.create(data.title, data.description, data.parent_id);
      send(ws, { type: 'created_note', note: newNote });
      send(ws, { type: 'reply', text: `Note '${newNote.title}' (ID: ${newNote.id}) created successfully!` });
      
      // Set context for newly created note
      StateManager.setState(ws, {
        mode: 'find_context',
        findContext: { selectedNote: newNote, results: [newNote] }
      });
      
      const followUpText = autoConfirm 
        ? `What would you like to do with this note? (/editdescription, /uploadimage, /createsubnote, /markdone, /delete, /talkai, /selectsubnote)`
        : `What would you like to do with this note? (/editdescription, /uploadimage, /createsubnote, /markdone, /delete)`;
      
      send(ws, { type: 'reply', text: followUpText });
      sendUpdatedCommands(ws);
      return true; // Don't reset state
    }
    
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
      
    case 'add_image_to_note': {
      const { noteId, imagePath } = data;
      const notes = NoteManager.findById(noteId);
      if (notes && notes.length > 0) {
        const note = notes[0];
        if (!note.images) note.images = [];
        
        if (!note.images.includes(imagePath)) {
          note.images.push(imagePath);
          NoteManager.update(noteId, { images: note.images });
          const updatedNote = NoteManager.findById(noteId)[0];
          send(ws, { type: 'note_updated', note: updatedNote });
          send(ws, { type: 'reply', text: `Image added to note '${note.title}' (ID: ${note.id}).` });
        } else {
          send(ws, { type: 'reply', text: 'Image already exists in this note.' });
        }
      } else {
        send(ws, { type: 'reply', text: 'Note not found.' });
      }
      return true; // Don't reset state
    }
  }
  return false; // Reset state
}

// Helper function to handle parameter collection
async function handleParameterCollection(ws, text, lowerText, autoConfirm) {
  const state = StateManager.getState(ws);
  const paramInfo = state.parameterCollection;
  
  if (lowerText === 'cancel') {
    StateManager.setState(ws, { mode: 'initial', parameterCollection: null });
    sendUpdatedCommands(ws);
    send(ws, { type: 'reply', text: 'Command cancelled.' });
    return true;
  }
  
  if (lowerText === 'help') {
    send(ws, { type: 'reply', text: `Help: ${paramInfo.message} Type 'cancel' to cancel this command.` });
    return true;
  }
  
  if (text.trim()) {
    const fullCommand = `${paramInfo.command} ${text.trim()}`;
    const parsed = CommandRouter.parseSlashCommand(fullCommand);
    
    if (parsed) {
      StateManager.setState(ws, { mode: 'initial', parameterCollection: null });
      sendUpdatedCommands(ws);
      await processCommandWithParsed(ws, parsed, autoConfirm);
      return true;
    }
  }
  
  send(ws, { type: 'reply', text: paramInfo.message });
  return true;
}

// Helper function to handle state-specific modes
async function handleStateModes(ws, text, lowerText, autoConfirm) {
  const state = StateManager.getState(ws);
  
  // Story editing mode
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
      return true;
    }
    const newDescription = (state.descriptionBuffer || '') + text + '\n';
    StateManager.setState(ws, { descriptionBuffer: newDescription });
    send(ws, { type: 'reply', text: 'Content added. Continue typing or say /stopediting.' });
    return true;
  }
  
  // Sub-note creation mode
  if (state.mode === 'pending_subnote_creation') {
    const parentNote = state.findContext.selectedNote;
    
    if (autoConfirm || StateManager.getAutoConfirm(ws)) {
      const newNote = NoteManager.create(text, '', parentNote.id);
      send(ws, { type: 'created_note', note: newNote });
      send(ws, { type: 'reply', text: `Sub-note '${newNote.title}' (ID: ${newNote.id}) created under '${parentNote.title}' (ID: ${parentNote.id}).` });
      
      StateManager.setState(ws, {
        mode: 'find_context',
        findContext: { selectedNote: parentNote, results: [parentNote] }
      });
      
      send(ws, { type: 'reply', text: `Returned to parent note '${parentNote.title}' (ID: ${parentNote.id}) context. What would you like to do? (/editdescription, /uploadimage, /createsubnote, /markdone, /delete)` });
      sendUpdatedCommands(ws);
      return true;
    }
    
    StateManager.setState(ws, {
      mode: 'pending_confirmation',
      pendingConfirmation: {
        action: 'create_note',
        data: { title: text, parent_id: parentNote.id },
      },
      findContext: state.findContext
    });
    send(ws, { type: 'reply', text: `Create sub-note '${text}' under '${parentNote.title}' (ID: ${parentNote.id})? (yes/no)` });
    return true;
  }
  
  // AI conversation mode
  if (state.mode === 'ai_conversation') {
    if (['/stop', 'exit', 'cancel'].includes(lowerText)) {
      StateManager.setState(ws, { mode: 'find_context' });
      send(ws, { type: 'reply', text: 'AI conversation ended.' });
      return true;
    }
    const aiResponse = await AIService.chatWithNote(state.aiConversationNoteId, text);
    send(ws, { type: 'ai_reply', text: aiResponse.reply });
    return true;
  }
  
  return false; // Not handled
}

// Helper function to handle find context commands
function handleFindContextCommands(ws, parsed, state, autoConfirm) {
  switch (parsed.cmd) {
    case '/back':
      StateManager.initializeState(ws);
      sendUpdatedCommands(ws);
      send(ws, { type: 'reply', text: '🏠 Returned to main menu. You can now create or find notes.' });
      return true;
      
    case '/delete':
      const noteToDelete = state.findContext.selectedNote;
      if (!noteToDelete) {
        send(ws, { type: 'reply', text: 'No note selected.' });
        return true;
      }
      
      if (autoConfirm || StateManager.getAutoConfirm(ws)) {
        NoteManager.delete(noteToDelete.id);
        send(ws, { type: 'note_deleted', id: noteToDelete.id });
        send(ws, { type: 'reply', text: `Note '${noteToDelete.title}' (ID: ${noteToDelete.id}) deleted.` });
        return true;
      }
      
      StateManager.setState(ws, {
        mode: 'pending_confirmation',
        pendingConfirmation: {
          action: 'delete_note',
          data: { id: noteToDelete.id, title: noteToDelete.title },
        },
      });
      sendUpdatedCommands(ws);
      send(ws, { type: 'reply', text: `Are you sure you want to delete note '${noteToDelete.title}' (ID: ${noteToDelete.id})? (yes/no)` });
      return true;
      
    case '/editdescription':
      const noteToEdit = state.findContext.selectedNote;
      if (!noteToEdit) {
        send(ws, { type: 'reply', text: 'No note selected.' });
        return true;
      }
      StateManager.setState(ws, { mode: 'story_editing', storyEditingNoteId: noteToEdit.id, descriptionBuffer: '' });
      sendUpdatedCommands(ws);
      send(ws, { type: 'reply', text: `Editing description for '${noteToEdit.title}' (ID: ${noteToEdit.id}). Type your description. Say /stopediting when you are done.` });
      return true;
      
    case '/markdone':
      const noteToMark = state.findContext.selectedNote;
      if (!noteToMark) {
        send(ws, { type: 'reply', text: 'No note selected.' });
        return true;
      }
      
      if (autoConfirm || StateManager.getAutoConfirm(ws)) {
        NoteManager.update(noteToMark.id, { done: true });
        const updatedNote = NoteManager.findById(noteToMark.id)[0];
        send(ws, { type: 'note_updated', note: updatedNote });
        send(ws, { type: 'reply', text: `Note '${updatedNote.title}' (ID: ${updatedNote.id}) marked as done.` });
        return true;
      }
      
      StateManager.setState(ws, {
        mode: 'pending_confirmation',
        pendingConfirmation: {
          action: 'mark_done',
          data: { id: noteToMark.id, title: noteToMark.title },
        },
      });
      sendUpdatedCommands(ws);
      send(ws, { type: 'reply', text: `Are you sure you want to mark note '${noteToMark.title}' (ID: ${noteToMark.id}) as done? (yes/no)` });
      return true;
      
    case '/talkai':
      const noteToTalk = state.findContext.selectedNote;
      if (!noteToTalk) {
        send(ws, { type: 'reply', text: 'No note selected.' });
        return true;
      }
      StateManager.setState(ws, { mode: 'ai_conversation', aiConversationNoteId: noteToTalk.id });
      sendUpdatedCommands(ws);
      send(ws, { type: 'reply', text: `Starting AI conversation about '${noteToTalk.title}' (ID: ${noteToTalk.id}). Say /stop to end.` });
      return true;
      
    case '/selectsubnote':
      if (parsed.args.length === 0) {
        send(ws, { type: 'reply', text: 'Usage: /selectsubnote [id]' });
        return true;
      }
      const noteId = parsed.args[0];
      const selectedNote = state.findContext.notes.find(n => String(n.id) === noteId);
      if (selectedNote) {
        StateManager.setState(ws, { findContext: { ...state.findContext, selectedNote } });
        sendUpdatedCommands(ws);
        send(ws, { type: 'reply', text: `Selected note '${selectedNote.title}' (ID: ${selectedNote.id}).` });
      } else {
        send(ws, { type: 'reply', text: 'Note not found in current context.' });
      }
      return true;
      
    case '/uploadimage':
      const noteToUpload = state.findContext.selectedNote;
      if (!noteToUpload) {
        send(ws, { type: 'reply', text: 'No note selected.' });
        return true;
      }
      
      if (ImageManager.hasReachedImageLimit(noteToUpload.id)) {
        send(ws, { type: 'reply', text: 'Maximum 5 images per note. Please delete some images first.' });
        return true;
      }
      
      send(ws, { 
        type: 'request_image_upload', 
        data: { 
          noteId: noteToUpload.id,
          currentImageCount: ImageManager.getNoteImages(noteToUpload.id).length
        } 
      });
      return true;
  }
  return false; // Not handled
}

// Main handleChat function - now much simpler
async function handleChat(ws, o) {
  const state = StateManager.getState(ws);
  const text = o.text || '';
  const lowerText = text.toLowerCase();
  
  // Handle auto-confirm setting
  const autoConfirm = o.autoConfirm !== undefined ? o.autoConfirm : StateManager.getAutoConfirm(ws);
  if (o.autoConfirm !== undefined) {
    StateManager.setAutoConfirm(ws, autoConfirm);
  }

  // Handle parameter collection mode
  if (state.mode === 'parameter_collection' && state.parameterCollection) {
    if (await handleParameterCollection(ws, text, lowerText, autoConfirm)) return;
  }

  // Handle confirmation mode
  if (state.mode === 'pending_confirmation') {
    if (autoConfirm || StateManager.getAutoConfirm(ws)) {
      const { action, data } = state.pendingConfirmation;
      const shouldNotReset = await handleConfirmationAction(ws, action, data, autoConfirm);
      if (!shouldNotReset) {
        StateManager.initializeState(ws);
        sendUpdatedCommands(ws);
      }
      return;
    }
    
    if (lowerText === 'yes') {
      const { action, data } = state.pendingConfirmation;
      const shouldNotReset = await handleConfirmationAction(ws, action, data, autoConfirm);
      if (!shouldNotReset) {
        StateManager.initializeState(ws);
        sendUpdatedCommands(ws);
      }
      return;
    } else if (lowerText === 'no') {
      // Handle image removal if needed
      if (state.pendingConfirmation.action === 'add_image') {
        const { noteId, imagePath } = state.pendingConfirmation.data;
        const note = NoteManager.findById(noteId)[0];
        if (note && note.images) {
          const updatedImages = note.images.filter(img => img.path !== imagePath);
          NoteManager.update(noteId, { images: updatedImages });
          ImageManager.deleteImage(imagePath);
        }
      }
      send(ws, { type: 'reply', text: 'Operation cancelled.' });
      StateManager.initializeState(ws);
      sendUpdatedCommands(ws);
      return;
    }
  }

  // Handle other state modes
  if (await handleStateModes(ws, text, lowerText, autoConfirm)) return;

  // Handle slash commands
  if (text.startsWith('/')) {
    const parsed = CommandRouter.parseSlashCommand(text);
    if (!parsed) {
      send(ws, { type: 'reply', text: 'Bad command' });
      return;
    }

    // Handle find context commands
    if (state.mode === 'find_context') {
      if (handleFindContextCommands(ws, parsed, state, autoConfirm)) return;
    }

    // Handle general commands
    await processCommandWithParsed(ws, parsed, autoConfirm);
    return;
  }

  // Echo if not in parameter collection mode
  if (state.mode !== 'parameter_collection') {
    send(ws, { type: 'reply', text: 'Echo: ' + (o.text || '') });
  }
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  StateManager.initializeState(ws);
  sendUpdatedCommands(ws);

  ws.on('message', async (msg) => {
    let o = null;
    try { o = JSON.parse(msg); } catch (e) { send(ws, { type: 'reply', text: 'Bad JSON' }); return; }
    if (!o.type) { send(ws, { type: 'reply', text: 'Missing message type' }); return; }
    try {
      switch (o.type) {
        case 'chat': await handleChat(ws, o); break;
        case 'get_commands': send(ws, { type: 'available_commands', commands: CommandRouter.getAvailableCommands(ws, StateManager) }); break;
        case 'get_all_notes': send(ws, { type: 'all_notes', notes: NoteManager.getAll() }); break;
        case 'create_note': send(ws, { type: 'created_note', note: NoteManager.create(o.title || 'Untitled', o.description || '', o.parent_id || null) }); break;
        case 'update_note': const updated = NoteManager.update(o.id, o.patch || {}); if (updated) send(ws, { type: 'note_updated', note: updated }); else send(ws, { type: 'reply', text: 'Note not found' }); break;
        case 'delete_note': if (NoteManager.delete(o.id)) send(ws, { type: 'note_deleted', id: o.id }); else send(ws, { type: 'reply', text: 'Note not found' }); break;
        case 'restore_context':
          const noteToRestore = NoteManager.findById(o.noteId)[0];
          if (noteToRestore) {
            const children = NoteManager.findChildren(noteToRestore.id);
            const notesToShow = [noteToRestore, ...children];
            StateManager.setState(ws, { mode: 'find_context', findContext: { notes: notesToShow, selectedNote: noteToRestore } });
            send(ws, { type: 'found_notes', notes: notesToShow });
            sendUpdatedCommands(ws);
            send(ws, { type: 'reply', text: `Restored context to note '${noteToRestore.title}' (ID: ${noteToRestore.id}).` });
          }
          break;
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
          const relativeFilePath = fileName;

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
              text: `Image "${imageName}" uploaded successfully. Add it to note "${note.title}" (ID: ${note.id})? (yes/no)` 
            });
          } catch (error) {
            console.error('Error saving image:', error);
            send(ws, { type: 'reply', text: `Failed to save image: ${error.message}` });
          }
          break;
        }
        
        
        
default: send(ws, { type: 'reply', text: 'Unknown message type: ' + o.type });
      }
    } catch (e) { console.error('message handling error', e); send(ws, { type: 'reply', text: 'Internal server error' }); } 
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    StateManager.clearState(ws);
  });

  // Connection established - no need to send message to user
});

// Start the server with HOST binding
server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`WebSocket server ready on ws://${HOST}:${PORT}`);
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { server, wss };
}