
function parseSlashCommand(text) {
  if (!text || !text.startsWith('/')) return null;
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  return { cmd, args };
}

function getAvailableCommands(ws, stateManager) {
  const state = stateManager ? stateManager.getState(ws) : null;
  
  // If no state or in initial mode, return main menu commands
  if (!state || state.mode === 'initial') {
    return [
      { action: 'slash_create_note', command: '/createnote', category: 'Create', description: 'Create a note', examples: ['/createnote groceries'], requiresParam: true },
      { action: 'slash_find_note', command: '/findnote', category: 'Find', description: 'Find notes by title', examples: ['/findnote groceries'], requiresParam: true },
      { action: 'slash_find_by_id', command: '/findbyid', category: 'Find', description: 'Find note by id', examples: ['/findbyid 1'], requiresParam: true },
      { action: 'slash_show_parents', command: '/showparents', category: 'Show', description: 'Show parent notes', examples: ['/showparents'], requiresParam: false }
    ];
  }
  
  // If in confirmation mode, return yes/no commands
  if (state.mode === 'pending_confirmation') {
    return [
      { action: 'confirm_yes', command: 'yes', category: 'Confirmation', description: 'Confirm the action', examples: ['yes'], requiresParam: false },
      { action: 'confirm_no', command: 'no', category: 'Confirmation', description: 'Cancel the action', examples: ['no'], requiresParam: false }
    ];
  }
  
  // If in find context (note selected), return note-specific commands
  if (state.mode === 'find_context' && state.findContext && state.findContext.selectedNote) {
    return [
      { action: 'slash_back', command: '/back', category: 'Navigation', description: 'Return to main menu', examples: ['/back'], requiresParam: false },
      { action: 'slash_edit_description', command: '/editdescription', category: 'Edit', description: 'Edit note description', examples: ['/editdescription'], requiresParam: true },
      { action: 'slash_mark_done', command: '/markdone', category: 'Edit', description: 'Mark note as done', examples: ['/markdone'], requiresParam: false },
      { action: 'slash_delete', command: '/delete', category: 'Edit', description: 'Delete the note', examples: ['/delete'], requiresParam: false },
      { action: 'slash_create_subnote', command: '/createsubnote', category: 'Create', description: 'Create a sub-note', examples: ['/createsubnote'], requiresParam: true },
      { action: 'slash_talk_ai', command: '/talkai', category: 'AI', description: 'Talk to AI about this note', examples: ['/talkai'], requiresParam: false },
      { action: 'slash_upload_image', command: '/uploadimage', category: 'Edit', description: 'Upload an image to the note', examples: ['/uploadimage'], requiresParam: false },
      // Add navigation commands
      { action: 'slash_show_parents', command: '/showparents', category: 'Navigation', description: 'Show all parent notes', examples: ['/showparents'], requiresParam: false },
      { action: 'slash_find_note', command: '/findnote', category: 'Navigation', description: 'Find notes by title', examples: ['/findnote groceries'], requiresParam: true },
      { action: 'slash_find_by_id', command: '/findbyid', category: 'Navigation', description: 'Find note by id', examples: ['/findbyid 1'], requiresParam: true }
    ];
  }
  
  // If in story editing mode, return editing commands
  if (state.mode === 'story_editing') {
    return [
      { action: 'stop_editing', command: '/stopediting', category: 'Edit', description: 'Stop editing and save', examples: ['/stopediting'], requiresParam: false }
    ];
  }
  
  // If in AI conversation mode, return conversation commands
  if (state.mode === 'ai_conversation') {
    return [
      { action: 'stop_ai', command: '/stop', category: 'AI', description: 'Stop AI conversation', examples: ['/stop'], requiresParam: false },
      { action: 'exit_ai', command: 'exit', category: 'AI', description: 'Exit AI conversation', examples: ['exit'], requiresParam: false },
      { action: 'cancel_ai', command: 'cancel', category: 'AI', description: 'Cancel AI conversation', examples: ['cancel'], requiresParam: false }
    ];
  }
  
  // If in pending sub-note creation mode, return creation commands
  if (state.mode === 'pending_subnote_creation') {
    return [
      { action: 'confirm_yes', command: 'yes', category: 'Confirmation', description: 'Create the sub-note', examples: ['yes'], requiresParam: false },
      { action: 'confirm_no', command: 'no', category: 'Confirmation', description: 'Cancel sub-note creation', examples: ['no'], requiresParam: false }
    ];
  }
  
  // If in parameter collection mode, return input commands
  if (state.mode === 'parameter_collection') {
    return [
      { action: 'cancel_input', command: 'cancel', category: 'Cancel', description: 'Cancel current command', examples: ['cancel'], requiresParam: false },
      { action: 'help_input', command: 'help', category: 'Help', description: 'Show help for current command', examples: ['help'], requiresParam: false }
    ];
  }
  
  // Default fallback - return main menu commands
  return [
    { action: 'slash_create_note', command: '/createnote', category: 'Create', description: 'Create a note', examples: ['/createnote groceries'], requiresParam: true },
    { action: 'slash_find_note', command: '/findnote', category: 'Find', description: 'Find notes by title', examples: ['/findnote groceries'], requiresParam: true },
    { action: 'slash_find_by_id', command: '/findbyid', category: 'Find', description: 'Find note by id', examples: ['/findbyid 1'], requiresParam: true },
    { action: 'slash_show_parents', command: '/showparents', category: 'Show', description: 'Show parent notes', examples: ['/showparents'], requiresParam: false }
  ];
}

module.exports = {
  parseSlashCommand,
  getAvailableCommands
};
