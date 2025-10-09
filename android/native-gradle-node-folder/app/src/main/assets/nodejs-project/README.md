# native-gradle-node-project

This folder contains a minimal Node.js backend bundled as app assets for development and local testing.

How to run locally

1. Install dependencies (once):

```bash
cd android/native-gradle-node-folder/app/src/main/assets/nodejs-project
npm install --no-audit --no-fund
```

2. Start the server:

```bash
# foreground
node min.js

# or background
nohup node min.js > min.log 2>&1 & disown
```

3. Open the frontend UI in your browser:

```
http://127.0.0.1:30000/
```

Notes

- Uploaded images are stored under `images/` relative to this folder when uploaded as base64 via WebSocket.
- The frontend (in `../www`) has been copied from the original note-speaker project and patched to auto-detect emulator host (10.0.2.2).
- To test uploads from the web UI, use the upload modal; the frontend sends `upload_file` messages over WebSocket with `fileData` (base64) or `imagePath` pointing to a native path.

## Commands Tree Structure

The application uses a context-aware command system where available commands change based on the current state:

### 1. **Initial State** (`mode: 'initial'`)
Main menu commands available when no specific context is active:
- `/createnote` - Create a new note
- `/findnote` - Find notes by title
- `/findbyid` - Find note by ID
- `/showparents` - Show parent notes

### 2. **Note Context** (`mode: 'find_context'`)
Commands available when a note is selected:
- `/editdescription` - Edit note description
- `/markdone` - Mark note as done
- `/delete` - Delete the note
- `/createsubnote` - Create a sub-note
- `/talkai` - Talk to AI about this note
- `/selectsubnote` - Select a sub-note
- `/uploadimage` - Upload an image to the note

### 3. **Story Editing** (`mode: 'story_editing'`)
Commands available when editing a note description:
- `/stopediting` - Stop editing and save

### 4. **Confirmation State** (`mode: 'pending_confirmation'`)
Commands available when waiting for user confirmation:
- `yes` - Confirm the action
- `no` - Cancel the action

### 5. **AI Conversation** (`mode: 'ai_conversation'`)
Commands available during AI conversation:
- `/stop` - Stop AI conversation
- `exit` - Exit AI conversation
- `cancel` - Cancel AI conversation

### 6. **Parameter Collection** (`mode: 'parameter_collection'`)
Commands available when collecting command parameters:
- `cancel` - Cancel current command
- `help` - Show help for current command

### 7. **Sub-note Creation** (`mode: 'pending_subnote_creation'`)
Commands available when creating a sub-note:
- `yes` - Create the sub-note
- `no` - Cancel sub-note creation

## State Transitions

```
Initial → Find Context (via /findnote or /findbyid)
Find Context → Story Editing (via /editdescription)
Find Context → AI Conversation (via /talkai)
Find Context → Confirmation (via /delete, /markdone, /createsubnote)
Story Editing → Find Context (via /stopediting)
AI Conversation → Find Context (via /stop, exit, cancel)
Confirmation → Find Context (via yes/no)
Parameter Collection → Command Execution (via parameter input)
```

Next steps

- Wire real AI integration in `AIService.js` if you provide API credentials.
- Add automated tests for `NoteManager`.
