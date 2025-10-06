// DailySummary.js - Scheduled Tasks Module
// Handles daily note summarization and other scheduled operations

var DailySummary = {
    // -------- Configuration --------
    summaryInterval: 720, // 12 hours in minutes (720 minutes = 12 hours)
    isRepeating: true,
    
    // -------- Alarm Management --------
    setupDailySummary: function() {
        // Fire twice daily (every 12 hours = 720 minutes), repeating
        app.SetAlarm("sumerizeNotesDaily", 5, this.isRepeating); //TODO: change to 720 minutes after testing
        console.log("Daily summary alarm set for every " + this.summaryInterval + " minutes");
    },
    
    // -------- Daily Summary Processing --------
    processDailySummary: function() {
        console.log("DEBUG: sumerizeNotesDaily function called at " + new Date().toString());
        console.log("DEBUG: Daily summary function called!");
        
        try {
            // Load notes from file - use the same path as the main app
            var notesContent = app.ReadFile("notes.json");
            console.log("DEBUG: Notes file content length: " + notesContent.length);
            var notesData = JSON.parse(notesContent);
            
            // Calculate 24 hours ago timestamp
            var now = new Date();
            var twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
            
            // Filter notes created in the last 24 hours (excluding deleted notes)
            var recentNotes = this.getRecentNotes(notesData, twentyFourHoursAgo);
            
            console.log("DEBUG: Found " + recentNotes.length + " recent notes");
            
            if (recentNotes.length === 0) {
                this.handleNoRecentNotes(now);
                return;
            }
            
            // Prepare notes data for Gemini
            var notesForSummary = this.prepareNotesForSummary(recentNotes);
            
            // Create prompt for Gemini
            var prompt = AIService.createDailySummaryPrompt(notesForSummary);
            
            console.log("DEBUG: Calling Gemini API with prompt length: " + prompt.length);
            
            // Call Gemini API
            AIService.callGeminiForSummary(prompt, function(summary) {
                DailySummary.handleSummaryResponse(summary, now);
            });
            
        } catch (error) {
            this.handleSummaryError(error);
        }
    },
    
    // -------- Helper Functions --------
    getRecentNotes: function(notesData, twentyFourHoursAgo) {
        var recentNotes = [];
        for (var i = 0; i < notesData.notes.length; i++) {
            var note = notesData.notes[i];
            if (!note.deleted && note.creation_date) {
                var noteDate = new Date(note.creation_date);
                if (noteDate >= twentyFourHoursAgo) {
                    recentNotes.push(note);
                }
            }
        }
        return recentNotes;
    },
    
    prepareNotesForSummary: function(recentNotes) {
        var notesForSummary = [];
        for (var j = 0; j < recentNotes.length; j++) {
            var note = recentNotes[j];
            var noteInfo = {
                title: note.title,
                description: note.description || "",
                id: note.id,
                done: note.done || false
            };
            notesForSummary.push(noteInfo);
        }
        return notesForSummary;
    },
    
    handleNoRecentNotes: function(now) {
        console.log("DEBUG: No recent notes found");
        console.log("INFO: No new notes created in the last 24 hours.");
        
        // Send message to chat
        var noNotesMessage = "📅 **Daily Summary** (" + now.toLocaleDateString() + ")\n\nNo new notes created in the last 24 hours.";
        WebSocketHandler.broadcast({
            type: "reply",
            text: noNotesMessage
        });
    },
    
    handleSummaryResponse: function(summary, now) {
        console.log("DEBUG: Gemini API callback received, summary length: " + (summary ? summary.length : 0));
        if (summary) {
            // Send summary to chat
            var summaryMessage = "📅 **Daily Summary** (" + now.toLocaleDateString() + ")\n\n" + summary;
            console.log("DEBUG: Broadcasting summary message");
            
            // Broadcast to all connected clients
            WebSocketHandler.broadcast({
                type: "reply",
                text: summaryMessage
            });
            
            // Show notification via console
            console.log("INFO: Your daily note summary is ready! Check the chat.");
        } else {
            console.log("DEBUG: Gemini API returned null/empty summary");
            console.log("ERROR: Failed to generate summary. Please try again later.");
            
            // Send error message to chat
            var errorMessage = "📅 **Daily Summary** (" + new Date().toLocaleDateString() + ")\n\n❌ Failed to generate summary. Please try again later.";
            WebSocketHandler.broadcast({
                type: "reply",
                text: errorMessage
            });
        }
    },
    
    handleSummaryError: function(error) {
        console.log("Error in daily summary: " + error.message);
        console.log("ERROR: Error generating daily summary: " + error.message);
        
        // Send error message to chat
        var errorMessage = "📅 **Daily Summary** (" + new Date().toLocaleDateString() + ")\n\n❌ Error generating daily summary: " + error.message;
        WebSocketHandler.broadcast({
            type: "reply",
            text: errorMessage
        });
    },
    
    // -------- Manual Summary Generation --------
    generateManualSummary: function() {
        console.log("DEBUG: Manual summary generation requested");
        this.processDailySummary();
    },
    
    // -------- Configuration Management --------
    setSummaryInterval: function(minutes) {
        this.summaryInterval = minutes;
        console.log("Daily summary interval set to " + minutes + " minutes");
    },
    
    getSummaryInterval: function() {
        return this.summaryInterval;
    },
    
    setRepeating: function(repeating) {
        this.isRepeating = repeating;
        console.log("Daily summary repeating set to " + repeating);
    },
    
    getRepeating: function() {
        return this.isRepeating;
    },
    
    // -------- Status and Information --------
    getSummaryStatus: function() {
        return {
            interval: this.summaryInterval,
            repeating: this.isRepeating,
            status: "active"
        };
    },
    
    // -------- Utility Functions --------
    formatSummaryMessage: function(summary, date) {
        return "📅 **Daily Summary** (" + date.toLocaleDateString() + ")\n\n" + summary;
    },
    
    formatNoNotesMessage: function(date) {
        return "📅 **Daily Summary** (" + date.toLocaleDateString() + ")\n\nNo new notes created in the last 24 hours.";
    },
    
    formatErrorMessage: function(error, date) {
        return "📅 **Daily Summary** (" + date.toLocaleDateString() + ")\n\n❌ Error generating daily summary: " + error.message;
    }
};
