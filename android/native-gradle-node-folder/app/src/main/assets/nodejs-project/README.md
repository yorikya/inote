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

### 8. **AI Command Confirmation** (`mode: 'ai_command_confirmation'`)
Commands available when AI proposes command sequences:
- `yes` - Confirm and execute AI proposed commands
- `no` - Cancel AI proposed commands
- `/back` - Return to main menu

## State Transitions

```
Initial → Find Context (via /findnote or /findbyid)
Initial → AI Command Confirmation (via free text input)
Find Context → Story Editing (via /editdescription)
Find Context → AI Conversation (via /talkai)
Find Context → Confirmation (via /delete, /markdone, /createsubnote)
Story Editing → Find Context (via /stopediting)
AI Conversation → Find Context (via /stop, exit, cancel)
Confirmation → Find Context (via yes/no)
AI Command Confirmation → Initial (via yes/no/back)
Parameter Collection → Command Execution (via parameter input)
```

## Key Features Implemented

### 🤖 AI Agent Free Text Processing
The application now supports natural language command processing using AI:

#### **Free Text Detection**
- Automatically detects non-slash input when in `initial` mode
- Processes natural language requests like "create subnote milk under weekly shopping list"
- No need to remember specific command syntax

#### **AI Command Processing**
- **Desktop/Development**: Uses local Ollama LLM for advanced natural language understanding
- **Mobile/Production**: Falls back to intelligent keyword matching for common patterns
- Analyzes available notes (ID + title only for efficiency)
- Generates structured command sequences
- Handles ambiguous requests with clarification
- No API keys required - works completely offline

#### **Confirmation Flow**
- Always requires user confirmation (even with auto-confirm enabled)
- Shows clear explanation of what AI understood
- Lists proposed commands before execution
- Allows cancellation with "no" or "/back"

#### **Sequential Command Execution**
- Executes proposed commands one by one
- Provides status updates during execution
- Returns to main menu after completion
- Handles errors gracefully

#### **Context Optimization**
- Sends only note ID and title to minimize processing overhead
- Supports up to 1000 notes efficiently
- Filters out `/talkai` and `/uploadimage` commands
- **Desktop**: Uses lightweight local model (llama3.2:1b) for fast responses
- **Mobile**: Uses pattern-based keyword matching for instant responses

### 📝 Example Usage Flow

```
User: "create subnote milk under weekly shopping list"
  ↓
AI: "I understand you want to:
  1. Find note 'Weekly Shopping List' (ID: 3)
  2. Create subnote 'Milk' under it
  
Do you want me to proceed? (yes/no)"
  ↓
User: "yes"
  ↓
System: "Executing: /findbyid 3"
System: "Executing: /createsubnote Milk"
System: "All commands executed. Returned to main menu."
```

### 🔧 Technical Implementation

- **State Management**: Added `ai_command_confirmation` mode with proposed commands storage
- **Error Handling**: Graceful fallback to regular commands if AI fails
- **Hybrid AI Integration**: Ollama for desktop development, keyword matching for mobile
- **Command Filtering**: Excludes problematic commands like `/talkai` and `/uploadimage`
- **Back Navigation**: `/back` always available to return to main menu
- **Mobile-Friendly**: Works on mobile devices without external dependencies
- **No External Dependencies**: Runs completely offline

## Ollama Setup (for AI Features)

The AI agent features require Ollama to be installed and running:

### 1. Install Ollama
```bash
# macOS
brew install ollama

# Linux/Windows - see https://ollama.ai/download
```

### 2. Start Ollama Service
```bash
# Start as service (recommended)
brew services start ollama

# Or run manually
ollama serve
```

### 3. Pull Required Model
```bash
# Pull lightweight model (1.3GB)
ollama pull llama3.2:1b
```

### 4. Verify Installation
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Should return model information
```

The AI agent will automatically use the local Ollama instance - no API keys required!

## Mobile Deployment

For mobile apps, the system automatically falls back to **intelligent keyword matching**:

### ✅ **Supported Mobile Patterns:**
- `"create note [title]"` → `/createnote [title]`
- `"create subnote [title] under [parent]"` → `/findbyid [parent_id]` + `/createsubnote [title]`
- `"find notes about [query]"` → `/findnote [query]`
- `"search for [query]"` → `/findnote [query]`

### 📱 **Mobile Benefits:**
- **No Dependencies**: Works without Ollama or external APIs
- **Fast Response**: Instant keyword matching
- **Offline**: Completely offline operation
- **Lightweight**: No large model files needed
- **Battery Friendly**: Minimal CPU usage

### 🔧 **How It Works:**
1. **Desktop**: Tries Ollama first, falls back to keyword matching
2. **Mobile**: Uses keyword matching directly (Ollama not available)
3. **Pattern Recognition**: Matches common command patterns
4. **Note Matching**: Finds relevant notes by title similarity

Next steps

- Add automated tests for `NoteManager`.
- Consider adding more sophisticated prompt engineering for better command parsing.
- Expand keyword matching patterns for more complex requests.
