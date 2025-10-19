/**
 * Command Processor - Handles sequential command execution with proper state management
 * This ensures that commands like /findnote followed by /createsubnote work correctly
 */

const logger = require('./Logger');

class CommandProcessor {
  constructor(ws, stateManager, noteManager) {
    this.ws = ws;
    this.stateManager = stateManager;
    this.noteManager = noteManager;
    this.debugMode = process.env.NODE_ENV !== 'production';
  }

  /**
   * Process a sequence of commands with proper state management
   * @param {Array} commands - Array of command objects with {command, args}
   * @param {Function} send - Function to send messages to client
   * @param {Function} sendUpdatedCommands - Function to update available commands
   * @returns {Promise<Object>} - Result of the command sequence
   */
  async processCommandSequence(commands, send, sendUpdatedCommands) {
    if (this.debugMode) {
      console.log('CommandProcessor: Processing command sequence:', commands);
    }

    const results = [];
    let currentState = this.stateManager.getState(this.ws);
    
    // Ensure state is properly initialized
    if (!currentState) {
      currentState = { mode: 'initial' };
    }

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const fullCommand = `${cmd.command} ${cmd.args ? cmd.args.join(' ') : ''}`.trim();
      
      if (this.debugMode) {
        console.log(`CommandProcessor: Executing command ${i + 1}/${commands.length}: ${fullCommand}`);
        console.log('Current state before command:', currentState.mode);
      }

      try {
        // Log command execution
        logger.aiAction(`Executing command: ${fullCommand}`);
        
        // Execute the command
        const result = await this.executeCommand(cmd, currentState, send, sendUpdatedCommands);
        results.push(result);

        // Update current state after command execution
        currentState = this.stateManager.getState(this.ws);
        
        // Ensure state is properly initialized
        if (!currentState) {
          currentState = { mode: 'initial' };
        }
        
        logger.aiAction(`Command result: ${JSON.stringify(result, null, 2)}`);
        
        if (this.debugMode) {
          console.log('State after command:', currentState.mode);
        }

        // Add delay between commands to ensure state transitions complete
        if (i < commands.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`CommandProcessor: Error executing command ${fullCommand}:`, error);
        results.push({
          success: false,
          command: fullCommand,
          error: error.message
        });
      }
    }

    return {
      success: results.every(r => r.success !== false),
      results: results,
      finalState: this.stateManager.getState(this.ws)
    };
  }

  /**
   * Execute a single command with proper state handling
   */
  async executeCommand(cmd, currentState, send, sendUpdatedCommands) {
    const { command, args } = cmd;
    
    // Handle special command sequences
    if (command === '/findnote' && args && args.length > 0) {
      return await this.handleFindNote(args[0], send, sendUpdatedCommands);
    }
    
    if (command === '/findbyid' && args && args.length > 0) {
      return await this.handleFindById(args[0], send, sendUpdatedCommands);
    }
    
    if (command === '/createsubnote' && args && args.length > 0) {
      return await this.handleCreateSubnote(args[0], send, sendUpdatedCommands);
    }
    
    if (command === '/createnote' && args && args.length > 0) {
      return await this.handleCreateNote(args[0], send, sendUpdatedCommands);
    }
    
    if (command === '/delete') {
      return await this.handleDelete(send, sendUpdatedCommands);
    }
    
    if (command === '/markdone') {
      return await this.handleMarkDone(send, sendUpdatedCommands);
    }
    
    if (command === '/editdescription' && args && args.length > 0) {
      return await this.handleEditDescription(args[0], send, sendUpdatedCommands);
    }

    // Fallback to generic command execution
    return await this.handleGenericCommand(command, args, send, sendUpdatedCommands);
  }

  /**
   * Handle /findnote command
   */
  async handleFindNote(searchTerm, send, sendUpdatedCommands) {
    const notes = this.noteManager.getAll();
    const matchingNotes = notes.filter(note => 
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) && !note.deleted
    );

    if (matchingNotes.length === 0) {
      send(this.ws, { type: 'reply', text: `No notes found matching "${searchTerm}"` });
      return { success: false, message: 'No notes found' };
    }

    if (matchingNotes.length === 1) {
      // Single match - select the note
      const note = matchingNotes[0];
      this.stateManager.setState(this.ws, {
        mode: 'find_context',
        findContext: { selectedNote: note, results: [note] }
      });
      
      sendUpdatedCommands(this.ws);
      send(this.ws, { type: 'reply', text: `✨ Found note:\n\n📝 ${note.title} 🔗ID: ${note.id} ⏳\n   [${note.description || 'No description'}]` });
      
      return { success: true, note: note };
    } else {
      // Multiple matches - show options
      let message = `Found ${matchingNotes.length} notes matching "${searchTerm}":\n\n`;
      matchingNotes.forEach((note, index) => {
        message += `${index + 1}. 📝 ${note.title} 🔗ID: ${note.id}\n`;
      });
      message += `\nPlease be more specific or use /findbyid <id> to select a specific note.`;
      
      send(this.ws, { type: 'reply', text: message });
      return { success: true, notes: matchingNotes };
    }
  }

  /**
   * Handle /findbyid command
   */
  async handleFindById(noteId, send, sendUpdatedCommands) {
    const notes = this.noteManager.findById(noteId);
    
    if (!notes || notes.length === 0) {
      send(this.ws, { type: 'reply', text: `Note with ID ${noteId} not found.` });
      return { success: false, message: 'Note not found' };
    }
    
    const note = notes[0]; // findById returns an array

    this.stateManager.setState(this.ws, {
      mode: 'find_context',
      findContext: { selectedNote: note, results: [note] }
    });
    
    sendUpdatedCommands(this.ws);
    send(this.ws, { type: 'reply', text: `✨ Found note:\n\n📝 ${note.title} 🔗ID: ${note.id} ⏳\n   [${note.description || 'No description'}]` });
    
    return { success: true, note: note };
  }

  /**
   * Handle /createsubnote command
   */
  async handleCreateSubnote(subnoteTitle, send, sendUpdatedCommands) {
    const state = this.stateManager.getState(this.ws);
    
    if (state.mode !== 'find_context' || !state.findContext || !state.findContext.selectedNote) {
      send(this.ws, { type: 'reply', text: 'No note selected. Please find a note first using /findnote or /findbyid.' });
      return { success: false, message: 'No note selected' };
    }

    const parentNote = state.findContext.selectedNote;
    const newNote = this.noteManager.create(subnoteTitle, '', parentNote.id);
    
    send(this.ws, { type: 'created_note', note: newNote });
    send(this.ws, { type: 'reply', text: `📋 Sub-note '${newNote.title}' 🔗ID: ${newNote.id} created under '${parentNote.title}' 🔗ID: ${parentNote.id}.` });
    
    return { success: true, note: newNote };
  }

  /**
   * Handle /createnote command
   */
  async handleCreateNote(noteTitle, send, sendUpdatedCommands) {
    const newNote = this.noteManager.create(noteTitle, '', null);
    
    send(this.ws, { type: 'created_note', note: newNote });
    send(this.ws, { type: 'reply', text: `📋 Note '${newNote.title}' 🔗ID: ${newNote.id} created.` });
    
    return { success: true, note: newNote };
  }

  /**
   * Handle /delete command
   */
  async handleDelete(send, sendUpdatedCommands) {
    const state = this.stateManager.getState(this.ws);
    
    if (state.mode !== 'find_context' || !state.findContext || !state.findContext.selectedNote) {
      send(this.ws, { type: 'reply', text: 'No note selected. Please find a note first using /findnote or /findbyid.' });
      return { success: false, message: 'No note selected' };
    }

    const note = state.findContext.selectedNote;
    this.noteManager.delete(note.id);
    
    send(this.ws, { type: 'reply', text: `🗑️ Note '${note.title}' 🔗ID: ${note.id} deleted.` });
    
    // Return to main menu after deletion
    this.stateManager.initializeState(this.ws);
    sendUpdatedCommands(this.ws);
    
    return { success: true, deletedNote: note };
  }

  /**
   * Handle /markdone command
   */
  async handleMarkDone(send, sendUpdatedCommands) {
    const state = this.stateManager.getState(this.ws);
    
    if (state.mode !== 'find_context' || !state.findContext || !state.findContext.selectedNote) {
      send(this.ws, { type: 'reply', text: 'No note selected. Please find a note first using /findnote or /findbyid.' });
      return { success: false, message: 'No note selected' };
    }

    const note = state.findContext.selectedNote;
    this.noteManager.update(note.id, { done: true });
    
    send(this.ws, { type: 'reply', text: `✅ Note '${note.title}' 🔗ID: ${note.id} marked as done.` });
    
    return { success: true, note: note };
  }

  /**
   * Handle /editdescription command
   */
  async handleEditDescription(description, send, sendUpdatedCommands) {
    const state = this.stateManager.getState(this.ws);
    
    if (state.mode !== 'find_context' || !state.findContext || !state.findContext.selectedNote) {
      send(this.ws, { type: 'reply', text: 'No note selected. Please find a note first using /findnote or /findbyid.' });
      return { success: false, message: 'No note selected' };
    }

    const note = state.findContext.selectedNote;
    this.noteManager.update(note.id, { description: description });
    
    send(this.ws, { type: 'reply', text: `📝 Description updated for '${note.title}' 🔗ID: ${note.id}.` });
    
    return { success: true, note: note };
  }

  /**
   * Handle generic commands (fallback)
   */
  async handleGenericCommand(command, args, send, sendUpdatedCommands) {
    // This is a fallback for commands not specifically handled above
    send(this.ws, { type: 'reply', text: `Executing: ${command} ${args ? args.join(' ') : ''}` });
    
    // You could add more generic command handling here if needed
    
    return { success: true, message: 'Generic command executed' };
  }
}

module.exports = CommandProcessor;
