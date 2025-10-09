
// In your WebSocket message handler, find where you handle the /uploadimage command
// and make sure it sends the trigger_image_upload message with noteId

if (text.toLowerCase() === '/uploadimage') {
  const currentNote = conversationState.currentNoteId 
    ? NoteManager.findById(conversationState.currentNoteId)[0] 
    : null;
  
  if (!currentNote) {
    ws.send(JSON.stringify({
      type: 'reply',
      text: lang === 'he' 
        ? 'אנא בחר תחילה פתק עם /findbyid או /find'
        : 'Please select a note first with /findbyid or /find'
    }));
    return;
  }
  
  const currentImageCount = currentNote.images ? currentNote.images.length : 0;
  
  if (currentImageCount >= 5) {
    ws.send(JSON.stringify({
      type: 'reply',
      text: lang === 'he'
        ? 'הגעת למקסימום של 5 תמונות לפתק. השתמש ב-/cleanupimages כדי להסיר תמונות.'
        : 'Maximum 5 images per note reached. Use /cleanupimages to remove images.'
    }));
    return;
  }
  
  // Send trigger message with noteId
  ws.send(JSON.stringify({
    type: 'trigger_image_upload',
    noteId: conversationState.currentNoteId,  // This is the key part!
    currentImageCount: currentImageCount
  }));
  
  ws.send(JSON.stringify({
    type: 'reply',
    text: lang === 'he'
      ? '📷 פתח את חלון העלאת התמונות. בחר עד 5 תמונות.'
      : '📷 Opening image upload window. Select up to 5 images.'
  }));
  return;
}
