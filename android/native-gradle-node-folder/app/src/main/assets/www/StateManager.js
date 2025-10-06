// StateManager.js - Application State Management Module
// Handles all application state including contexts, pending operations, and chat history

var StateManager = {
    // -------- Core Settings --------
    settings: { 
        lang: "en" 
    },
    
    // -------- Find Context Management --------
    currentFindContext: null,
    
    // -------- Chat History Management --------
    // Note: General chat history removed - AI conversations are note-specific
    
    // -------- AI Conversation Management --------
    aiConversationMode: null,
    aiConversationNote: null,
    aiConversationHistory: [],
    
    // -------- Pending Operations State --------
    pendingNoteCreation: null,
    pendingNoteDeletion: null,
    pendingNoteMarkDone: null,
    pendingSubNoteCreation: null,
    pendingCommandCompletion: null,
    
    // -------- Story Editing Mode State --------
    storyEditingMode: null,
    pendingStoryUpdate: null,
    
    // -------- Find Context Management Functions --------
    setCurrentFindContext: function(foundNotes) {
        this.currentFindContext = foundNotes;
    },
    
    getCurrentFindContext: function() {
        return this.currentFindContext;
    },
    
    clearCurrentFindContext: function() {
        this.currentFindContext = null;
    },
    
    // -------- Chat History Management Functions --------
    // Note: General chat history removed - AI conversations are note-specific
    // For general questions, use gemini_question action without chat history
    
    // -------- AI Conversation Mode Functions --------
    setAiConversationMode: function(note) {
        this.aiConversationMode = true;
        this.aiConversationNote = note;
    },
    
    getAiConversationMode: function() {
        return this.aiConversationMode;
    },
    
    getAiConversationNote: function() {
        return this.aiConversationNote;
    },
    
    clearAiConversationMode: function() {
        this.aiConversationMode = null;
        this.aiConversationNote = null;
        this.aiConversationHistory = [];
    },
    
    addToAiConversationHistory: function(userMessage, aiResponse) {
        if (this.aiConversationHistory.length === 0) {
            // Initialize conversation history
            this.aiConversationHistory = [];
        }
        
        // Add the conversation turn
        this.aiConversationHistory.push({
            user: userMessage,
            ai: aiResponse,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 10 conversation turns to avoid memory issues
        if (this.aiConversationHistory.length > 10) {
            this.aiConversationHistory = this.aiConversationHistory.slice(-10);
        }
    },
    
    getAiConversationHistory: function() {
        return this.aiConversationHistory;
    },
    
    // -------- Pending Note Creation Functions --------
    setPendingNoteCreation: function(title, parentId) {
        this.pendingNoteCreation = { title: title, parentId: parentId };
    },
    
    getPendingNoteCreation: function() {
        return this.pendingNoteCreation;
    },
    
    clearPendingNoteCreation: function() {
        this.pendingNoteCreation = null;
    },
    
    // -------- Pending Note Deletion Functions --------
    setPendingNoteDeletion: function(noteId) {
        this.pendingNoteDeletion = noteId;
    },
    
    getPendingNoteDeletion: function() {
        return this.pendingNoteDeletion;
    },
    
    clearPendingNoteDeletion: function() {
        this.pendingNoteDeletion = null;
    },
    
    // -------- Pending Note Mark Done Functions --------
    setPendingNoteMarkDone: function(noteId) {
        this.pendingNoteMarkDone = noteId;
    },
    
    getPendingNoteMarkDone: function() {
        return this.pendingNoteMarkDone;
    },
    
    clearPendingNoteMarkDone: function() {
        this.pendingNoteMarkDone = null;
    },
    
    // -------- Pending Sub-Note Creation Functions --------
    setPendingSubNoteCreation: function(parentNoteId) {
        this.pendingSubNoteCreation = { parentNoteId: parentNoteId };
    },
    
    getPendingSubNoteCreation: function() {
        return this.pendingSubNoteCreation;
    },
    
    clearPendingSubNoteCreation: function() {
        this.pendingSubNoteCreation = null;
    },
    
    
    // -------- Story Editing Mode Functions --------
    setStoryEditingMode: function(noteId, noteTitle) {
        this.storyEditingMode = {
            noteId: noteId,
            noteTitle: noteTitle,
            accumulatedMessages: []
        };
    },
    
    getStoryEditingMode: function() {
        return this.storyEditingMode;
    },
    
    clearStoryEditingMode: function() {
        this.storyEditingMode = null;
    },
    
    addToStoryEditing: function(text) {
        if (this.storyEditingMode) {
            // Add a dot at the end of each message for better sentence structure
            var textWithDot = text.trim();
            if (textWithDot && !textWithDot.endsWith('.') && !textWithDot.endsWith('!') && !textWithDot.endsWith('?')) {
                textWithDot += '.';
            }
            this.storyEditingMode.accumulatedMessages.push(textWithDot);
        }
    },
    
    getAccumulatedStoryText: function() {
        if (this.storyEditingMode && this.storyEditingMode.accumulatedMessages.length > 0) {
            return this.storyEditingMode.accumulatedMessages.join(" ");
        }
        return "";
    },
    
    // -------- Pending Story Update Functions --------
    setPendingStoryUpdate: function(noteId, description) {
        this.pendingStoryUpdate = { noteId: noteId, description: description };
    },
    
    getPendingStoryUpdate: function() {
        return this.pendingStoryUpdate;
    },
    
    clearPendingStoryUpdate: function() {
        this.pendingStoryUpdate = null;
    },
    
    // -------- Command Completion Functions --------
    setPendingCommandCompletion: function(command, action) {
        this.pendingCommandCompletion = { command: command, action: action };
    },
    
    getPendingCommandCompletion: function() {
        return this.pendingCommandCompletion;
    },
    
    clearPendingCommandCompletion: function() {
        this.pendingCommandCompletion = null;
    },
    
    // -------- Clear All States Function --------
    clearAllStates: function() {
        this.currentFindContext = null;
        this.aiConversationMode = null;
        this.aiConversationNote = null;
        this.aiConversationHistory = [];
        this.pendingNoteCreation = null;
        this.pendingNoteDeletion = null;
        this.pendingNoteMarkDone = null;
        this.pendingSubNoteCreation = null;
        this.pendingCommandCompletion = null;
        this.storyEditingMode = null;
        this.pendingStoryUpdate = null;
    }
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateManager;
}