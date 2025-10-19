
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
const LocalAICommandAgent = require('./LocalAICommandAgent');
const EnhancedAICommandAgent = require('./EnhancedAICommandAgent');
const CommandProcessor = require('./CommandProcessor');
const logger = require('./Logger');

const aiService = new AIService(NoteManager.getSetting('gemini_api_key'));
const aiCommandAgent = new LocalAICommandAgent();
const enhancedAICommandAgent = new EnhancedAICommandAgent(NoteManager.getSetting('gemini_api_key'));

// AI Action Statistics
const AIStats = {
  success: 0,
  failure: 0,
  
  incrementSuccess: function() {
    this.success++;
    logger.aiAction(`AI Action Success: ${this.success}`);
    console.log(`[AI_STATS] Success incremented to: ${this.success}`);
    this.broadcastStats();
  },
  
  incrementFailure: function() {
    this.failure++;
    logger.aiAction(`AI Action Failure: ${this.failure}`);
    console.log(`[AI_STATS] Failure incremented to: ${this.failure}`);
    this.broadcastStats();
  },
  
  broadcastStats: function() {
    // Broadcast to all connected clients
    console.log(`[AI_STATS] Broadcasting stats: success=${this.success}, failure=${this.failure}`);
    wss.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        const message = JSON.stringify({
          type: 'ai_stats_update',
          success: this.success,
          failure: this.failure
        });
        console.log(`[AI_STATS] Sending to client: ${message}`);
        client.send(message);
      }
    });
  },
  
  getStats: function() {
    return {
      success: this.success,
      failure: this.failure,
      total: this.success + this.failure,
      successRate: this.success + this.failure > 0 ? Math.round((this.success / (this.success + this.failure)) * 100) : 0
    };
  }
};

// Add this helper function near the top of the file
async function fetchGoogleTTS(text, lang) {
  const https = require('https');
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text)}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(Buffer.concat(chunks).toString('base64'));
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

// HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  const p = parsedUrl.pathname;
  
  
  // Serve log files
  if (p === '/logs/download') {
    try {
      const logContent = logger.getCombinedLogContent();
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="app-logs.txt"',
        'Content-Length': Buffer.byteLength(logContent)
      });
      res.end(logContent);
      logger.info('Log file downloaded');
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error reading log file: ' + error.message);
      logger.error('Error downloading log file: ' + error.message);
    }
    return;
  }
  
  // Serve log statistics
  if (p === '/logs/stats') {
    try {
      const stats = logger.getLogStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats, null, 2));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error getting log stats: ' + error.message);
    }
    return;
  }
  
  // Clear logs
  if (p === '/logs/clear' && req.method === 'POST') {
    try {
      const success = logger.clearLogs();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success }));
      logger.info('Logs cleared via HTTP request');
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error clearing logs: ' + error.message);
    }
    return;
  }
  
  // Get AI statistics
  if (p === '/ai/stats') {
    try {
      const stats = AIStats.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error getting AI stats: ' + error.message);
    }
    return;
  }
  
  // Serve images saved under /image/<rel>
  if (p && p.startsWith('/image/')) {
    const filename = decodeURIComponent(p.replace('/image/', ''));
    console.log('[ImageServer] === Image Request Start ===');
    console.log('[ImageServer] Requested image:', filename);
    console.log('[ImageServer] Request URL:', p);
    console.log('[ImageServer] Current working directory:', __dirname);
    
    // Try multiple possible image locations
    const possiblePaths = [
      path.join(__dirname, 'images', filename),
      path.join(__dirname, filename),
      // Handle note_X folder structure
      path.join(__dirname, 'images', filename.split('/').pop()),
      // Try path with note_ prefix
      path.join(__dirname, 'images', 'note_' + filename.split('_')[0], filename)
    ];

    console.log('[ImageServer] Possible paths to check:');
    possiblePaths.forEach((p, i) => console.log(`[ImageServer] ${i+1}. ${p}`));
    
    let fp = null;
    for (const testPath of possiblePaths) {
      console.log(`[ImageServer] Checking path: ${testPath}`);
      if (require('fs').existsSync(testPath)) {
        fp = testPath;
        console.log(`[ImageServer] ✓ Found image at: ${fp}`);

        // Get file stats for additional info
        const stats = require('fs').statSync(fp);
        console.log(`[ImageServer] File size: ${stats.size} bytes`);
        console.log(`[ImageServer] File modified: ${stats.mtime}`);
        break;
      } else {
        console.log(`[ImageServer] ✗ File not found at: ${testPath}`);
      }
    }
    
    if (fp) {
      const ext = path.extname(fp).toLowerCase();
      const map = { 
        '.png': 'image/png', 
        '.jpg': 'image/jpeg', 
        '.jpeg': 'image/jpeg', 
        '.svg': 'image/svg+xml', 
        '.gif': 'image/gif' 
      };
      const type = map[ext] || 'application/octet-stream';
      res.writeHead(200, { 
        'Content-Type': type,
        'Cache-Control': 'public, max-age=31536000'
      });
      const stream = require('fs').createReadStream(fp);
      stream.on('error', (err) => {
        console.error('Error reading image file:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error reading image');
      });
      stream.pipe(res);
      return;
    }
    
    console.error('Image not found:', filename, 'tried paths:', possiblePaths);
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
  result += `📝 ${note.title} 🔗ID: ${note.id}`;
  
  // Add parent indicator if it's a parent note
  if (!note.parent_id) {
    result += ' 📂';
  }
  
  // Add status indicator
  result += note.done ? ' ✅' : ' ⏳';

  // Add description preview if exists
  if (note.description && note.description.trim()) {
    const preview = note.description.length > 50 
      ? note.description.substring(0, 50) + '...' 
      : note.description;
    result += `\n   [${preview}]`;
  }
  
  // Status indicator already added above
  
  // Add image count if any
  const imageCount = ImageManager.getNoteImages(note.id).length;
  if (imageCount > 0) {
    result += `\n   📷 ${imageCount} image${imageCount > 1 ? 's' : ''}`;
  }
  
  // Add children if any
  if (children && children.length > 0) {
    result += `\n   📋 Sub-notes (${children.length}):`;
    children.forEach((child, index) => {
      result += `\n      ${index + 1}. ${child.title} 🔗ID: ${child.id}`;
      result += child.done ? ' ✅' : ' ⏳';

      // Add description preview for child if exists
      if (child.description && child.description.trim()) {
        const preview = child.description.length > 50 
          ? child.description.substring(0, 50) + '...' 
          : child.description;
        result += `\n         [${preview}]`;
      }
    });
  }
  
  return result;
}

function handleCreateNoteCommand(ws, parsed, autoConfirm) {
  const noteTitle = parsed.args.join(' ');
  if (autoConfirm || StateManager.getAutoConfirm(ws)) {
    const newNote = NoteManager.create(noteTitle);
    send(ws, { type: 'created_note', note: newNote });
    const tree = formatNoteTree(newNote, []);
    send(ws, { type: 'reply', text: `✨ New note created:

${tree}` });
    
    // Return to main menu after note creation
    StateManager.setState(ws, {
      mode: 'initial',
      findContext: { selectedNote: null, results: [] }
    });
    
    sendUpdatedCommands(ws);
  } else {
    StateManager.setState(ws, {
      mode: 'pending_confirmation',
      pendingConfirmation: { action: 'create_note', data: { title: noteTitle } },
    });
    sendUpdatedCommands(ws);
    send(ws, { type: 'reply', text: `🤔 Do you want to create a note with title '${noteTitle}'? (yes/no)` });
  }
}

function handleFindNoteCommand(ws, parsed) {
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
      if (note.done) {
        noteList += ' ✅';
      }
      noteList += '\n';
    });
    noteList += `\n💡 Use /findbyid [id] to select a note`;
    send(ws, { type: 'reply', text: noteList });
  }
}

function handleFindByIdCommand(ws, parsed) {
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
}

function handleShowParentsCommand(ws) {
  const allNotes = NoteManager.getAll();
  const parentNotes = allNotes.filter(note => !note.parent_id);
  StateManager.initializeState(ws);
  sendUpdatedCommands(ws);
  send(ws, { type: 'found_notes', notes: parentNotes });

  if (parentNotes.length === 0) {
    send(ws, { type: 'reply', text: '❌ No parent notes have been found' });
  } else {
    let noteList = `📚 Parent notes (${parentNotes.length}):\n\n`;
    parentNotes.forEach((note, index) => {
      const children = NoteManager.findChildren(note.id);
      const tree = formatNoteTree(note, children);
      noteList += `${index + 1}. ${tree}`;
      
      // Add separator line between notes (but not after the last one)
      if (index < parentNotes.length - 1) {
        noteList += `\n------------------------------\n`;
      }
    });
    send(ws, { type: 'reply', text: noteList });
  }
}

// Helper function to check if command needs parameter collection
function needsParameterCollection(ws, parsed) {
  const availableCommands = CommandRouter.getAvailableCommands(ws, StateManager);
  const commandInfo = availableCommands.find(cmd => cmd.command === parsed.cmd);
  
  if (commandInfo && commandInfo.requiresParam) {
    const hasParams = parsed.args && parsed.args.length > 0 && parsed.args.join(' ').trim() !== '';
    return !hasParams;
  }
  return false;
}

// Helper function to start parameter collection
function startParameterCollection(ws, command, message) {
  StateManager.setState(ws, {
    mode: 'parameter_collection',
    parameterCollection: {
      command: command,
      message: message
    }
  });
  sendUpdatedCommands(ws);
  send(ws, { type: 'reply', text: message });
}

async function processCommandWithParsed(ws, parsed, autoConfirm) {
  // Check if command needs parameter collection
  if (needsParameterCollection(ws, parsed)) {
    switch (parsed.cmd) {
      case '/createnote':
        startParameterCollection(ws, '/createnote', 'Please provide a title for the note:');
        return;
      case '/findnote':
        startParameterCollection(ws, '/findnote', 'Please provide a search query to find notes:');
        return;
      case '/findbyid':
        startParameterCollection(ws, '/findbyid', 'Please provide a note ID to find:');
        return;
      case '/set-gemini-api-key':
        startParameterCollection(ws, '/set-gemini-api-key', 'Please provide the Gemini API key:');
        return;
    }
  }

  switch (parsed.cmd) {
    case '/createnote':
      handleCreateNoteCommand(ws, parsed, autoConfirm);
      break;
    case '/findnote':
      handleFindNoteCommand(ws, parsed);
      break;
    case '/findbyid':
      handleFindByIdCommand(ws, parsed);
      break;
    case '/showparents':
      handleShowParentsCommand(ws);
      break;
    case '/set-gemini-api-key':
      const apiKey = parsed.args[0];
      if (apiKey) {
        NoteManager.setSetting('gemini_api_key', apiKey);
        aiService.apiKey = apiKey;
        send(ws, { type: 'reply', text: 'Gemini API key set for AI conversations.' });
      } else {
        send(ws, { type: 'reply', text: 'Usage: /set-gemini-api-key <key>' });
      }
      break;
    default:
      send(ws, { type: 'reply', text: `Unknown command: ${parsed.cmd}` });
      break;
  }
}


// Helper function to handle confirmation actions
async function handleConfirmationAction(ws, action, data, autoConfirm) {
  switch (action) {
    case 'create_note': {
      const newNote = NoteManager.create(data.title, data.description, data.parent_id);
      send(ws, { type: 'created_note', note: newNote });
      const children = NoteManager.findChildren(newNote.id);
      const tree = formatNoteTree(newNote, children);
      send(ws, { type: 'reply', text: `✅ Note created successfully!\n\n${tree}` });
      
      // Return to main menu after note creation
      StateManager.setState(ws, {
        mode: 'initial',
        findContext: { selectedNote: null, results: [] }
      });
      
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
      
    case 'mark_pending':
      NoteManager.update(data.id, { done: false });
      send(ws, { type: 'note_updated', note: NoteManager.findById(data.id)[0] });
      send(ws, { type: 'reply', text: `Note marked as pending.` });
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

// Helper function to handle AI command processing
async function handleAICommandProcessing(ws, text, lowerText, autoConfirm) {
  const state = StateManager.getState(ws);
  
  // Only process free text in initial mode
  if (state.mode !== 'initial') {
    return false;
  }
  
  // Skip if text starts with slash (regular command)
  if (text.startsWith('/')) {
    return false;
  }
  
  // Skip empty text
  if (!text.trim()) {
    return false;
  }
  
  try {
    send(ws, { type: 'thinking' });
    
    // Log AI action start
    logger.aiAction(`Processing free text input: "${text}"`);
    
    // Get all notes and available commands for context
    const allNotes = NoteManager.getAll();
    const availableCommands = CommandRouter.getAvailableCommands(ws, StateManager);
    
    // Filter commands to exclude /talkai and /uploadimage
    const filteredCommands = availableCommands.filter(cmd => 
      !cmd.command.includes('talkai') && 
      !cmd.command.includes('uploadimage')
    );
    
    logger.aiAction(`Context: ${allNotes.length} notes, ${filteredCommands.length} commands available`);
    
    // Process with Enhanced AI agent (3-stage approach)
    const aiResponse = await enhancedAICommandAgent.processFreeText(text, allNotes, filteredCommands);
    
    logger.aiAction(`AI response: ${JSON.stringify(aiResponse, null, 2)}`);
    
    send(ws, { type: 'thinking_done' });
    
    // Handle AI response
    if (aiResponse.error) {
      send(ws, { type: 'reply', text: aiResponse.error });
      return true;
    }
    
    if (aiResponse.clarification_needed) {
      const clarificationMessage = enhancedAICommandAgent.generateConfirmationMessage(aiResponse);
      send(ws, { type: 'reply', text: clarificationMessage });
      return true;
    }
    
    // Store proposed commands and show confirmation
    StateManager.setState(ws, {
      mode: 'ai_command_confirmation',
      aiCommandConfirmation: {
        proposedCommands: aiResponse.commands,
        currentCommandIndex: 0,
        originalRequest: text,
        aiExplanation: aiResponse.understood
      }
    });
    
    sendUpdatedCommands(ws);
    
    const confirmationMessage = enhancedAICommandAgent.generateConfirmationMessage(aiResponse);
    send(ws, { type: 'reply', text: confirmationMessage });
    
    return true;
  } catch (error) {
    console.error('AI command processing error:', error);
    send(ws, { type: 'thinking_done' });
    send(ws, { type: 'reply', text: 'Failed to process your request with AI. Please try using specific commands.' });
    return true;
  }
}

// Helper function to handle AI command confirmation
async function handleAICommandConfirmation(ws, text, lowerText, autoConfirm) {
  const state = StateManager.getState(ws);
  
  if (state.mode !== 'ai_command_confirmation') {
    return false;
  }
  
  const aiConfirmation = state.aiCommandConfirmation;
  if (!aiConfirmation) {
    return false;
  }
  
  if (lowerText === 'yes') {
    // Execute proposed commands using CommandProcessor
    send(ws, { type: 'reply', text: 'Executing commands...' });
    
    logger.aiAction(`User confirmed AI commands: ${JSON.stringify(aiConfirmation.proposedCommands, null, 2)}`);
    
    try {
      const commandProcessor = new CommandProcessor(ws, StateManager, NoteManager);
      const result = await commandProcessor.processCommandSequence(aiConfirmation.proposedCommands, send, sendUpdatedCommands);
      
      logger.aiAction(`Command execution result: ${JSON.stringify(result, null, 2)}`);
      
      if (result.success) {
        send(ws, { type: 'reply', text: 'All commands executed successfully.' });
        logger.aiAction('All AI commands executed successfully');
        AIStats.incrementSuccess();
      } else {
        send(ws, { type: 'reply', text: 'Some commands failed to execute.' });
        logger.aiError('Some AI commands failed to execute');
        AIStats.incrementFailure();
      }
      
      // Return to main menu after execution
      StateManager.initializeState(ws);
      sendUpdatedCommands(ws);
      
    } catch (error) {
      console.error('Error executing AI commands:', error);
      logger.aiError(`Error executing AI commands: ${error.message}`);
      send(ws, { type: 'reply', text: 'Error executing some commands. Returned to main menu.' });
      StateManager.initializeState(ws);
      sendUpdatedCommands(ws);
    }
    
    return true;
  } else if (lowerText === 'no' || lowerText === '/back') {
    // Cancel AI commands
    StateManager.initializeState(ws);
    sendUpdatedCommands(ws);
    send(ws, { type: 'reply', text: 'AI commands cancelled. Returned to main menu.' });
    AIStats.incrementFailure();
    return true;
  }
  
  return false;
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
    if (lowerText === '/stoptalkai') {
      aiService.stopConversation();
      const { findContext } = state;
      StateManager.setState(ws, { mode: 'find_context', findContext });
      sendUpdatedCommands(ws);
      send(ws, { type: 'reply', text: 'AI conversation ended. Returning to note context.' });
      return true;
    }
    
    if (lowerText === '/savetonote') {
      const lastResponse = aiService.getLastResponse();
      if (!lastResponse) {
        send(ws, { type: 'reply', text: 'No AI response to save.' });
        return true;
      }
      
      const { findContext, aiConversationNoteId } = state;
      const parentNote = findContext.selectedNote;
      
      if (!parentNote) {
        send(ws, { type: 'reply', text: 'No parent note found.' });
        return true;
      }
      
      // Find the last user message
      const conversationHistory = aiService.conversationHistory;
      let lastUserMessage = "";
      
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const entry = conversationHistory[i];
        if (entry.role === 'user' && entry.parts && entry.parts[0] && entry.parts[0].text) {
          lastUserMessage = entry.parts[0].text;
          break;
        }
      }
      
      // Use Gemini to generate a concise title based on the question and response
      send(ws, { type: 'thinking' });
      try {
        // Create a temporary AI service instance for title generation
        const tempAIService = new AIService(aiService.apiKey);
        tempAIService.startConversation("");
        
        const titlePrompt = `Create a concise and informative title (max 60 characters) for a note that answers this question: "${lastUserMessage}". The response contains information about: ${lastResponse.substring(0, 200)}...`;
        const generatedTitle = await tempAIService.sendMessage(titlePrompt);
        
        // Clean up the title - remove quotes and ensure it's not too long
        let title = generatedTitle.replace(/["']/g, '').trim();
        if (title.length > 60) title = title.substring(0, 60);
        
        // Create a new sub-note with the AI response and generated title
        const newNote = NoteManager.create(title, lastResponse, parentNote.id);
        send(ws, { type: 'thinking_done' });
        send(ws, { type: 'created_note', note: newNote });
        send(ws, { type: 'reply', text: `AI response saved as sub-note "${newNote.title}" (ID: ${newNote.id}) under "${parentNote.title}" (ID: ${parentNote.id}).` });
      } catch (error) {
        console.error("Error generating title:", error);
        // Fallback to a simple title if AI generation fails
        const fallbackTitle = lastUserMessage.length > 0 
          ? lastUserMessage.substring(0, 50) + (lastUserMessage.length > 50 ? "..." : "")
          : "AI Response";
        
        const newNote = NoteManager.create(fallbackTitle, lastResponse, parentNote.id);
        send(ws, { type: 'thinking_done' });
        send(ws, { type: 'created_note', note: newNote });
        send(ws, { type: 'reply', text: `AI response saved as sub-note "${newNote.title}" (ID: ${newNote.id}) under "${parentNote.title}" (ID: ${parentNote.id}).` });
      }
      
      return true;
    }
    
    send(ws, { type: 'thinking' });
    const aiResponse = await aiService.sendMessage(text);
    send(ws, { type: 'thinking_done' });
    send(ws, { type: 'reply', text: aiResponse });
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
      
    // Add navigation commands
    case '/showparents':
      handleShowParentsCommand(ws);
      return true;
      
    case '/findnote':
      handleFindNoteCommand(ws, parsed);
      return true;
      
    case '/findbyid':
      handleFindByIdCommand(ws, parsed);
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
      send(ws, { type: 'reply', text: `🗑️ Are you sure you want to delete note '${noteToDelete.title}' 🔗ID: ${noteToDelete.id}? (yes/no)` });
      return true;
      
    case '/editdescription':
      const noteToEdit = state.findContext.selectedNote;
      if (!noteToEdit) {
        send(ws, { type: 'reply', text: 'No note selected.' });
        return true;
      }

      const newDescription = parsed.args.join(' ');
      if (newDescription) {
        NoteManager.update(noteToEdit.id, { description: newDescription });
        send(ws, { type: 'note_updated', note: NoteManager.findById(noteToEdit.id)[0] });
        send(ws, { type: 'reply', text: `Note description updated.` });
      } else {
        StateManager.setState(ws, { mode: 'story_editing', storyEditingNoteId: noteToEdit.id, descriptionBuffer: '' });
        sendUpdatedCommands(ws);
        send(ws, { type: 'reply', text: `📝 Editing description for '${noteToEdit.title}' 🔗ID: ${noteToEdit.id}. Type your description. Say /stopediting when you are done.` });
      }
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
      send(ws, { type: 'reply', text: `✅ Are you sure you want to mark note '${noteToMark.title}' 🔗ID: ${noteToMark.id} as done? (yes/no)` });
      return true;
      
    case '/markpending':
    case '/markundone':
      const noteToUnmark = state.findContext.selectedNote;
      if (!noteToUnmark) {
        send(ws, { type: 'reply', text: 'No note selected.' });
        return true;
      }
      
      if (autoConfirm || StateManager.getAutoConfirm(ws)) {
        NoteManager.update(noteToUnmark.id, { done: false });
        const updatedNote = NoteManager.findById(noteToUnmark.id)[0];
        send(ws, { type: 'note_updated', note: updatedNote });
        send(ws, { type: 'reply', text: `Note '${updatedNote.title}' (ID: ${updatedNote.id}) marked as pending.` });
        return true;
      }
      
      StateManager.setState(ws, {
        mode: 'pending_confirmation',
        pendingConfirmation: {
          action: 'mark_pending',
          data: { id: noteToUnmark.id, title: noteToUnmark.title },
        },
      });
      sendUpdatedCommands(ws);
      send(ws, { type: 'reply', text: `⏳ Are you sure you want to mark note '${noteToUnmark.title}' 🔗ID: ${noteToUnmark.id} as pending? (yes/no)` });
      return true;
      
    case '/talkai':
      const noteToTalk = state.findContext.selectedNote;
      if (!noteToTalk) {
        send(ws, { type: 'reply', text: 'No note selected.' });
        return true;
      }
      const apiKey = NoteManager.getSetting('gemini_api_key');
      if (!apiKey) {
        send(ws, { type: 'reply', text: 'Gemini API key not set. Use /set-gemini-api-key <key> to set it.' });
        return true;
      }
      aiService.apiKey = apiKey;
      const noteContent = `Title: ${noteToTalk.title}\nDescription: ${noteToTalk.description}`;
      aiService.startConversation(noteContent);
      StateManager.setState(ws, { mode: 'ai_conversation', aiConversationNoteId: noteToTalk.id, findContext: state.findContext });
      sendUpdatedCommands(ws);
      send(ws, { type: 'reply', text: `🤖 Starting AI conversation about '${noteToTalk.title}' 🔗ID: ${noteToTalk.id}. To end the conversation, type /stoptalkai.` });
      return true;
      
    case '/createsubnote':
      const parentNote = state.findContext.selectedNote;
      if (!parentNote) {
        send(ws, { type: 'reply', text: 'No note selected.' });
        return true;
      }

      const subnoteTitle = parsed.args.join(' ');
      if (subnoteTitle) {
        // Title is provided, create sub-note directly
        const newNote = NoteManager.create(subnoteTitle, '', parentNote.id);
        send(ws, { type: 'created_note', note: newNote });
        send(ws, { type: 'reply', text: `📋 Sub-note '${newNote.title}' 🔗ID: ${newNote.id} created under '${parentNote.title}' 🔗ID: ${parentNote.id}.` });
      } else {
        // No title, ask for it
        StateManager.setState(ws, { mode: 'pending_subnote_creation', findContext: state.findContext });
        sendUpdatedCommands(ws);
        send(ws, { type: 'reply', text: `What is the title of the sub-note for '${parentNote.title}'?` });
      }
      return true;

    case '/selectsubnote':
      const subnoteId = parsed.args[0];
      if (!subnoteId) {
        send(ws, { type: 'reply', text: 'Please provide a sub-note ID to select.' });
        return true;
      }

      // Find the sub-note
      const subnote = NoteManager.findById(subnoteId)[0];
      if (!subnote) {
        send(ws, { type: 'reply', text: `Sub-note with ID ${subnoteId} not found.` });
        return true;
      }

      // Update state to select the sub-note
      StateManager.setState(ws, {
        mode: 'find_context',
        findContext: { selectedNote: subnote, results: [subnote] }
      });
      
      send(ws, { type: 'reply', text: `Selected sub-note '${subnote.title}' 🔗ID: ${subnote.id}. What would you like to do? (/editdescription, /uploadimage, /createsubnote, /markdone, /delete)` });
      sendUpdatedCommands(ws);
      return true;

    case '/deleteimage':
      const noteWithImage = state.findContext.selectedNote;
      if (!noteWithImage) {
        send(ws, { type: 'reply', text: 'No note selected.' });
        return true;
      }
      const imagePath = parsed.args.join(' ');
      if (!imagePath) {
        send(ws, { type: 'reply', text: 'No image specified.' });
        return true;
      }

      // Remove image from note
      NoteManager.removeImage(noteWithImage.id, imagePath);

      // Delete image from filesystem
      ImageManager.deleteImage(imagePath);

      const updatedNote = NoteManager.findById(noteWithImage.id)[0];
      send(ws, { type: 'note_updated', note: updatedNote });
      send(ws, { type: 'reply', text: `Image ${imagePath} deleted from note '${updatedNote.title}'.` });
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

  // Handle AI command confirmation
  if (await handleAICommandConfirmation(ws, text, lowerText, autoConfirm)) return;

  // Handle AI command processing (free text in initial mode)
  if (await handleAICommandProcessing(ws, text, lowerText, autoConfirm)) return;

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

async function handleImageUpload(ws, o) {
  const { noteId, imageData, imageName } = o;

  // Validate inputs
  if (!noteId || !imageData || !imageName) {
    send(ws, { type: 'reply', text: 'Invalid image upload data. Missing noteId, imageData, or imageName.' });
    return;
  }

  // Find the note
  const notes = NoteManager.findById(noteId);
  if (!notes || notes.length === 0) {
    send(ws, { type: 'reply', text: `Note with ID ${noteId} not found.` });
    return;
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
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  StateManager.initializeState(ws);
  sendUpdatedCommands(ws);
  
  // Send initial AI statistics
  const stats = AIStats.getStats();
  console.log(`[AI_STATS] Sending initial stats to new client: success=${stats.success}, failure=${stats.failure}`);
  send(ws, { type: 'ai_stats_update', success: stats.success, failure: stats.failure });

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
        case 'update_note':
          try {
            const { noteId, updates } = o;
            console.log('[Backend] Updating note:', noteId, 'with:', updates);
            
            // Update the note
            NoteManager.update(noteId, updates);
            
            // Get the updated note
            const updatedNote = NoteManager.findById(noteId)[0];
            
            // Send confirmation
            send(ws, { 
              type: 'note_updated', 
              note: updatedNote 
            });
            
            console.log('[Backend] Note updated successfully:', updatedNote);
          } catch (error) {
            console.error('[Backend] Error updating note:', error);
            send(ws, { 
              type: 'error', 
              message: 'Failed to update note: ' + error.message 
            });
          }
          break;
        case 'delete_note':
          try {
            const { noteId } = o;
            console.log('[Backend] Deleting note:', noteId);
            
            // Delete the note
            NoteManager.delete(noteId);
            
            // Send confirmation
            send(ws, { 
              type: 'note_deleted', 
              id: noteId 
            });
            
            console.log('[Backend] Note deleted successfully:', noteId);
          } catch (error) {
            console.error('[Backend] Error deleting note:', error);
            send(ws, { 
              type: 'error', 
              message: 'Failed to delete note: ' + error.message 
            });
          }
          break;
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
        case 'image_upload':
          await handleImageUpload(ws, o);
          break;
        case 'save_settings':
          if (o.geminiApiKey) {
            NoteManager.setSetting('gemini_api_key', o.geminiApiKey);
            aiService.apiKey = o.geminiApiKey;
            send(ws, { type: 'reply', text: 'API key saved successfully for AI conversations!' });
          } else {
            send(ws, { type: 'reply', text: 'Invalid settings format.' });
          }
          break;
        case 'request_tts':
          try {
            const audioData = await fetchGoogleTTS(o.text, o.lang || 'en');
            send(ws, { type: 'tts_audio', audioData });
          } catch (error) {
            console.error('TTS error:', error);
            send(ws, { type: 'error', message: 'TTS failed' });
          }
          break;
        case 'reset_ai_stats':
          AIStats.success = 0;
          AIStats.failure = 0;
          AIStats.broadcastStats();
          send(ws, { type: 'reply', text: 'AI statistics reset successfully.' });
          break;
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
