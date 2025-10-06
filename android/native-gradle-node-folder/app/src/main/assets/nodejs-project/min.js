/*
Fuller port of note-speaker backend logic into a single min.js file.
Implements: persistent NoteManager (file-based JSON), CommandRouter for
slash-commands, a tiny AIService stub, HTTP endpoints for images, and
WebSocket message handling compatible with the frontend.

This keeps the API surface compatible with the placeholder frontend while
providing the richer operations you described (create/edit/delete/subnotes,
append long descriptions, upload images, AI chat using note context, etc.).
*/

const http = require('http');
const url = require('url');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

const NoteManager = require('./NoteManager');
const CommandRouter = require('./CommandRouter');
const AIService = require('./AIService');

// HTTP server
const server = http.createServer((req, res) => {
  const p = url.parse(req.url).pathname;
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

function send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (e) { console.error('send err', e); } }

async function handleChat(ws, o) {
  if (o.text && o.text.startsWith('/')) {
    // delegate to CommandRouter using simple interface
    const parsed = CommandRouter.parseSlashCommand(o.text);
    if (!parsed) { send(ws, { type: 'reply', text: 'Bad command' }); return; }
    switch (parsed.cmd) {
      case '/createnote':
        if (!parsed.args.length) { send(ws, { type: 'reply', text: 'Usage: /createnote TITLE' }); return; }
        const title = parsed.args.join(' ');
        send(ws, { type: 'created_note', note: NoteManager.create(title) });
        return;
      case '/findnote':
        if (!parsed.args.length) { send(ws, { type: 'reply', text: 'Usage: /findnote QUERY' }); return; }
        send(ws, { type: 'found_notes', notes: NoteManager.findByTitle(parsed.args.join(' ')) });
        return;
      case '/findbyid':
        if (!parsed.args.length) { send(ws, { type: 'reply', text: 'Usage: /findbyid ID' }); return; }
        send(ws, { type: 'found_notes', notes: NoteManager.findById(parsed.args[0]) });
        return;
      case '/showparents':
        send(ws, { type: 'found_notes', notes: NoteManager.getAll().filter(n => !n.parent_id) });
        return;
      default:
        send(ws, { type: 'reply', text: 'Unknown slash command' });
        return;
    }
  }

  if (o.action === 'ai_chat' && o.noteId) {
    try { const r = await AIService.chatWithNote(o.noteId, o.text || ''); send(ws, { type: 'ai_reply', text: r.reply }); } catch (e) { send(ws, { type: 'reply', text: 'AI error' }); }
    return;
  }

  if (o.appendToNoteId && o.text) {
    const updated = NoteManager.appendToDescription(o.appendToNoteId, o.text);
    if (updated) send(ws, { type: 'note_updated', note: updated }); else send(ws, { type: 'reply', text: 'Note not found' });
    return;
  }

  send(ws, { type: 'reply', text: 'Echo: ' + (o.text || '') });
}


wss.on('connection', (ws) => {
  console.log('Client connected');

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
        case 'debug': if (o.action === 'get_notes') send(ws, { type: 'debug_notes', notes: JSON.stringify(NoteManager.getAll(), null, 2) }); if (o.action === 'clear_notes') { NoteManager.clearAll(); send(ws, { type: 'debug_cleared' }); } break;
        case 'upload_file': {
          // Accept either a native imagePath (existing on device/server) or base64 fileData
          if (!o.noteId) { send(ws, { type: 'upload_error', error: 'Missing noteId' }); break; }
          const imagesDir = path.join(__dirname, 'images');
          if (!require('fs').existsSync(imagesDir)) require('fs').mkdirSync(imagesDir);

          if (o.fileData && o.imagePath) {
            // base64 data - save to images/<imagePath>
            try {
              const b = Buffer.from(o.fileData, 'base64');
              const dest = path.join(__dirname, o.imagePath);
              const destDir = path.dirname(dest);
              if (!require('fs').existsSync(destDir)) require('fs').mkdirSync(destDir, { recursive: true });
              require('fs').writeFileSync(dest, b);
              const updated3 = NoteManager.addImage(o.noteId, o.imagePath);
              if (updated3) send(ws, { type: 'upload_success', imagePath: o.imagePath, message: 'Image saved and added to note', note: updated3 }); else send(ws, { type: 'upload_error', error: 'Note not found' });
            } catch (e) { console.error('save base64 error', e); send(ws, { type: 'upload_error', error: 'Failed to save image' }); }
          } else if (o.imagePath) {
            // Native path was provided. If file exists on server, copy to images dir; otherwise store the path as-is
            try {
              const src = o.imagePath;
              const filename = path.basename(src);
              const destRel = path.join('images', `note_${o.noteId}_${Date.now()}_${filename}`);
              const dest = path.join(__dirname, destRel);
              // If src exists on server filesystem, copy; else just record provided path
              if (require('fs').existsSync(src)) {
                const destDir = path.dirname(dest);
                if (!require('fs').existsSync(destDir)) require('fs').mkdirSync(destDir, { recursive: true });
                require('fs').copyFileSync(src, dest);
                const updated4 = NoteManager.addImage(o.noteId, destRel);
                if (updated4) send(ws, { type: 'upload_success', imagePath: destRel, message: 'Image copied and added to note', note: updated4 }); else send(ws, { type: 'upload_error', error: 'Note not found' });
              } else {
                // Save the path as-is (frontend may reference it)
                const updated5 = NoteManager.addImage(o.noteId, o.imagePath);
                if (updated5) send(ws, { type: 'upload_success', imagePath: o.imagePath, message: 'Image path recorded (source not on server)', note: updated5 }); else send(ws, { type: 'upload_error', error: 'Note not found' });
              }
            } catch (e) { console.error('native path handling error', e); send(ws, { type: 'upload_error', error: 'Failed to handle native path' }); }
          } else {
            send(ws, { type: 'upload_error', error: 'Missing fileData or imagePath' });
          }
        } break;
        case 'set_auto_confirm': send(ws, { type: 'reply', text: `Auto confirmation ${o.enabled ? 'enabled' : 'disabled'}` }); break;
        case 'request_file_picker': send(ws, { type: 'reply', text: 'Native file picker not available in Node backend (handled by Android)' }); break;
        default: send(ws, { type: 'reply', text: 'Unknown message type: ' + o.type });
      }
    } catch (e) { console.error('message handling error', e); send(ws, { type: 'reply', text: 'Internal server error' }); }
  });

  ws.on('close', () => console.log('Client disconnected'));
  send(ws, { type: 'reply', text: 'Connected to min.js backend' });
});

server.listen(PORT, () => console.log('min.js backend listening on', PORT));

module.exports = { server, wss, NoteManager };
