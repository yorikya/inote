function parseSlashCommand(text) {
  if (!text || !text.startsWith('/')) return null;
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  return { cmd, args };
}

function getAvailableCommands() {
  return [
    { action: 'slash_create_note', command: '/createnote', category: 'Create', description: 'Create a note', examples: ['/createnote groceries'], requiresParam: true },
    { action: 'slash_find_note', command: '/findnote', category: 'Find', description: 'Find notes by title', examples: ['/findnote groceries'], requiresParam: true },
    { action: 'slash_find_by_id', command: '/findbyid', category: 'Find', description: 'Find note by id', examples: ['/findbyid 1'], requiresParam: true },
    { action: 'slash_show_parents', command: '/showparents', category: 'Show', description: 'Show parent notes', examples: ['/showparents'], requiresParam: false },
    { action: 'slash_upload_image', command: '/uploadimage', category: 'Edit', description: 'Upload an image to the selected note', examples: ['/uploadimage'], requiresParam: false }
  ];
}

module.exports = { parseSlashCommand, getAvailableCommands };
