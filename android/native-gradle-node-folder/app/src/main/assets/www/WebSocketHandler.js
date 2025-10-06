// WebSocketHandler.js - WebSocket Communication Module
// Handles all WebSocket server operations, message routing, and client communication

var WebSocketHandler = {
    // -------- WebSocket Server Configuration --------
    server: null,
    webView: null,
    port: 8080,
    Settings: { lang: "en", autoConfirm: false },
    
    // -------- Settings Initialization --------
    initializeSettings: function() {
        // Settings is now initialized as a property of WebSocketHandler
    },
    
    // -------- Server Initialization --------
    initializeServer: function() {
        // Initialize settings
        this.initializeSettings();
        
        // Create and start the web server to serve HTML and handle WebSocket
        this.server = app.CreateWebServer(this.port);
        this.server.SetFolder(app.GetAppPath());
        this.server.SetOnReceive(this.onWsReceive.bind(this));
        
        // Try to set up HTTP request handler for serving images
        try {
            if (typeof this.server.SetOnRequest === 'function') {
                this.server.SetOnRequest(this.onHttpRequest.bind(this));
                console.log("✅ HTTP request handler set up for image serving");
                this.httpImageServing = true;
            } else {
                console.log("⚠️ SetOnRequest not available - using WebSocket fallback");
                this.httpImageServing = false;
            }
        } catch (e) {
            console.log("⚠️ HTTP request handler setup failed:", e.message);
            this.httpImageServing = false;
        }
        
        this.server.Start();
        
        // Initialize image serving system
        this.initializeImageServing();
        
        // Create WebView to display the HTML content directly
        this.webView = app.CreateWebView(1.0, 1.0, "FillXY");
        this.webView.LoadHtml(HTML_CONTENT);
        app.AddLayout(this.webView);
        
        console.log("WebSocket server started on port " + this.port);
    },
    
    // -------- Message Broadcasting --------
    broadcast: function(obj) {
        var msg = (typeof obj === "string") ? obj : JSON.stringify(obj);
        this.server.SendText(msg); // no ip/id → broadcast to all clients
    },
    
    sendToClient: function(obj, ip, id) {
        var msg = (typeof obj === "string") ? obj : JSON.stringify(obj);
        this.server.SendText(msg, ip, id);
    },
    
    // -------- WebSocket-based Image Serving --------
    handleImageRequest: function(o, ip, id) {
        try {
            var imagePath = o.imagePath;
            if (!imagePath) {
                this.sendToClient({ 
                    type: "image_error", 
                    error: "No image path provided",
                    requestId: o.requestId
                }, ip, id);
                return;
            }
            
            // Try HTTP serving first if available
            if (this.httpImageServing) {
                var imageUrl = this.generateImageUrl(imagePath);
                
                if (imageUrl) {
                    this.sendToClient({
                        type: "image_url",
                        imagePath: imagePath,
                        imageUrl: imageUrl,
                        requestId: o.requestId
                    }, ip, id);
                    return;
                }
            }
            
            // Fallback to WebSocket-based image serving
            this.serveImageViaWebSocket(imagePath, o.requestId, ip, id);
            
        } catch (e) {
            console.log("DEBUG: Error in handleImageRequest:", e.message);
            this.sendToClient({ 
                type: "image_error", 
                error: "Error loading image: " + e.message,
                requestId: o.requestId
            }, ip, id);
        }
    },
        
        // -------- Image Cleanup Functions --------
        handleCleanupBrokenImage: function(o, ip, id) {
            try {
                console.log("DEBUG: handleCleanupBrokenImage called with:", o.imagePath);
                
                var imagePath = o.imagePath;
                if (!imagePath) {
                    console.log("DEBUG: No image path provided for cleanup");
                    this.sendToClient({ 
                        type: "cleanup_error", 
                        error: "No image path provided" 
                    }, ip, id);
                    return;
                }
                
                // Find all notes that contain this image path
                var allNotes = NoteManager.getAllNotes();
                var updatedNotes = [];
                
                allNotes.forEach(function(note) {
                    if (note.images && note.images.length > 0 && note.images.indexOf(imagePath) > -1) {
                        console.log("DEBUG: Removing broken image from note", note.id, ":", imagePath);
                        var updatedNote = NoteManager.removeImageFromNote(note.id, imagePath);
                        if (updatedNote) {
                            updatedNotes.push(note.id);
                        }
                    }
                });
                
                if (updatedNotes.length > 0) {
                    console.log("DEBUG: Cleanup completed for", updatedNotes.length, "notes");
                    this.sendToClient({ 
                        type: "cleanup_complete", 
                        imagePath: imagePath,
                        updatedNotes: updatedNotes
                    }, ip, id);
                } else {
                    console.log("DEBUG: No notes found with this image path");
                    this.sendToClient({ 
                        type: "cleanup_complete", 
                        imagePath: imagePath,
                        updatedNotes: []
                    }, ip, id);
                }
                
            } catch (e) {
                console.log("DEBUG: Error in handleCleanupBrokenImage:", e.message);
                this.sendToClient({ 
                    type: "cleanup_error", 
                    error: "Error cleaning up image: " + e.message 
                }, ip, id);
            }
        },
        
        // -------- Debug File API Testing --------
    handleTestFileApis: function(o, ip, id) {
        try {
            console.log("DEBUG: Testing DroidScript file APIs");
            var testPath = o.testPath || "/storage/emulated/0/Pictures/debug_image.jpg";
            
            var results = {
                testPath: testPath,
                apis: {},
                readTest: null,
                error: null
            };
            
            // Test available file APIs
            results.apis.FileExists = typeof app.FileExists;
            results.apis.IsFile = typeof app.IsFile;
            results.apis.ReadFile = typeof app.ReadFile;
            results.apis.WriteFile = typeof app.WriteFile;
            results.apis.GetFileSize = typeof app.GetFileSize;
            results.apis.FileExists_available = typeof app.FileExists === 'function';
            results.apis.IsFile_available = typeof app.IsFile === 'function';
            
            console.log("DEBUG: Available APIs:", JSON.stringify(results.apis, null, 2));
            
            // Test file existence methods
            if (typeof app.FileExists === 'function') {
                try {
                    results.FileExists_result = app.FileExists(testPath);
                    console.log("DEBUG: app.FileExists result:", results.FileExists_result);
                } catch (e) {
                    results.FileExists_error = e.message;
                    console.log("DEBUG: app.FileExists error:", e.message);
                }
            }
            
            if (typeof app.IsFile === 'function') {
                try {
                    results.IsFile_result = app.IsFile(testPath);
                    console.log("DEBUG: app.IsFile result:", results.IsFile_result);
                } catch (e) {
                    results.IsFile_error = e.message;
                    console.log("DEBUG: app.IsFile error:", e.message);
                }
            }
            
            // Test file reading
            try {
                var fileContent = app.ReadFile(testPath);
                if (fileContent) {
                    results.readTest = {
                        success: true,
                        contentLength: fileContent.length,
                        contentType: typeof fileContent
                    };
                    console.log("DEBUG: File read successful, length:", fileContent.length);
                } else {
                    results.readTest = {
                        success: false,
                        reason: "ReadFile returned null/undefined"
                    };
                    console.log("DEBUG: File read failed - returned null/undefined");
                }
            } catch (readError) {
                results.readTest = {
                    success: false,
                    error: readError.message
                };
                console.log("DEBUG: File read error:", readError.message);
            }
            
            // Test base64 reading
            try {
                var base64Content = app.ReadFile(testPath, "base64");
                if (base64Content) {
                    results.base64Test = {
                        success: true,
                        contentLength: base64Content.length,
                        startsWithValidBase64: /^[A-Za-z0-9+/]/.test(base64Content)
                    };
                    console.log("DEBUG: Base64 read successful, length:", base64Content.length);
                } else {
                    results.base64Test = {
                        success: false,
                        reason: "ReadFile base64 returned null/undefined"
                    };
                    console.log("DEBUG: Base64 read failed - returned null/undefined");
                }
            } catch (base64Error) {
                results.base64Test = {
                    success: false,
                    error: base64Error.message
                };
                console.log("DEBUG: Base64 read error:", base64Error.message);
            }
            
            this.sendToClient({
                type: "file_api_test_results",
                results: results
            }, ip, id);
            
        } catch (e) {
            console.log("DEBUG: Error in handleTestFileApis:", e.message);
            this.sendToClient({
                type: "file_api_test_results",
                error: e.message
            }, ip, id);
        }
    },
    
    // -------- HTTP Request Handler for Image Serving --------
    onHttpRequest: function(request, response) {
        try {
            console.log("DEBUG: HTTP request received:", request.url);
            
            // Handle image requests
            if (request.url.startsWith('/image/')) {
                this.handleHttpImageRequest(request, response);
                return;
            }
            
            // Handle other requests normally
            response.status = 404;
            response.data = "Not Found";
            
        } catch (e) {
            console.log("ERROR: HTTP request handler error:", e.message);
            response.status = 500;
            response.data = "Internal Server Error";
        }
    },
    
    // Handle HTTP image requests
    handleHttpImageRequest: function(request, response) {
        try {
            // Extract image path from URL: /image/base64encodedpath
            var urlParts = request.url.split('/');
            if (urlParts.length < 3) {
                response.status = 400;
                response.data = "Invalid image URL";
                return;
            }
            
            var encodedPath = urlParts[2];
            var imagePath = decodeURIComponent(atob(encodedPath));
            
            console.log("DEBUG: Serving image via HTTP:", imagePath);
            
            // Try to read the image
            var imageData = null;
            var contentType = "image/jpeg";
            
            try {
                // Determine content type from path
                var ext = imagePath.toLowerCase();
                if (ext.includes('.png')) contentType = "image/png";
                else if (ext.includes('.gif')) contentType = "image/gif";
                else if (ext.includes('.webp')) contentType = "image/webp";
                else if (ext.includes('.bmp')) contentType = "image/bmp";
                
                // Try to read the image file
                if (typeof app.ReadFile === 'function') {
                    imageData = app.ReadFile(imagePath, "base64");
                }
                
                if (imageData && imageData.length > 0) {
                    console.log("DEBUG: Successfully read image for HTTP serving, size:", imageData.length);
                    
                    // Set response headers
                    response.status = 200;
                    response.headers = {
                        "Content-Type": contentType,
                        "Cache-Control": "public, max-age=3600",
                        "Access-Control-Allow-Origin": "*"
                    };
                    
                    // Send the base64 data directly - DroidScript will handle the conversion
                    response.data = imageData;
                    response.encoding = "base64";
                    
                } else {
                    console.log("DEBUG: Failed to read image for HTTP serving");
                    response.status = 404;
                    response.data = "Image not found";
                }
                
            } catch (readError) {
                console.log("DEBUG: Error reading image for HTTP:", readError.message);
                response.status = 500;
                response.data = "Error reading image";
            }
            
        } catch (e) {
            console.log("ERROR: HTTP image request error:", e.message);
            response.status = 500;
            response.data = "Internal Server Error";
        }
    },
    
    // Generate HTTP URL for image
    generateImageUrl: function(imagePath) {
        if (!imagePath) return null;
        
        try {
            // Encode the image path as base64 for URL safety
            var encodedPath = btoa(encodeURIComponent(imagePath));
            var imageUrl = "http://localhost:" + this.port + "/image/" + encodedPath;
            
            console.log("DEBUG: Generated image URL:", imageUrl);
            return imageUrl;
            
        } catch (e) {
            console.log("ERROR: Failed to generate image URL:", e.message);
            return null;
        }
    },
    
    // -------- Image Serving System --------
    initializeImageServing: function() {
        console.log("Initializing image serving system...");
        
        // Create image cache for better performance
        this.imageCache = {};
        this.imageCacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        console.log("Image serving system initialized");
    },
    
    // Serve image via WebSocket (since SetOnRequest not available)
    serveImageViaWebSocket: function(imagePath, requestId, ip, id) {
        try {
            console.log("DEBUG: Serving image via WebSocket:", imagePath);
            
            // Check cache first
            if (this.imageCache[imagePath]) {
                var cached = this.imageCache[imagePath];
                if (Date.now() - cached.timestamp < this.imageCacheTimeout) {
                    console.log("DEBUG: Serving image from cache");
                    this.sendToClient({
                        type: "image_data",
                        imagePath: imagePath,
                        contentType: cached.contentType,
                        data: cached.data,
                        requestId: requestId
                    }, ip, id);
                    return;
                }
            }
            
            // Check if file exists
            if (typeof app.FileExists === 'function' && !app.FileExists(imagePath)) {
                console.log("DEBUG: Image file not found:", imagePath);
                this.sendToClient({
                    type: "image_error",
                    error: "Image file not found: " + imagePath,
                    imagePath: imagePath,
                    requestId: requestId
                }, ip, id);
                return;
            }
            
            // Read image as base64
            if (typeof app.ReadFile === 'function') {
                var imageData = app.ReadFile(imagePath, "base64");
                
                if (imageData && imageData.length > 0) {
                    // Determine content type from file extension
                    var contentType = "image/jpeg";
                    var ext = imagePath.toLowerCase();
                    if (ext.includes('.png')) contentType = "image/png";
                    else if (ext.includes('.gif')) contentType = "image/gif";
                    else if (ext.includes('.webp')) contentType = "image/webp";
                    else if (ext.includes('.bmp')) contentType = "image/bmp";
                    
                    // Cache the image
                    this.imageCache[imagePath] = {
                        data: imageData,
                        contentType: contentType,
                        timestamp: Date.now()
                    };
                    
                    console.log("DEBUG: Image served successfully via WebSocket, size:", imageData.length);
                    this.sendToClient({
                        type: "image_data",
                        imagePath: imagePath,
                        contentType: contentType,
                        data: imageData,
                        requestId: requestId
                    }, ip, id);
                } else {
                    console.log("DEBUG: Failed to read image data");
                    this.sendToClient({
                        type: "image_error",
                        error: "Failed to read image data",
                        imagePath: imagePath,
                        requestId: requestId
                    }, ip, id);
                }
            } else {
                console.log("DEBUG: ReadFile function not available");
                this.sendToClient({
                    type: "image_error",
                    error: "ReadFile function not available",
                    imagePath: imagePath,
                    requestId: requestId
                }, ip, id);
            }
        } catch (e) {
            console.log("ERROR: Failed to serve image via WebSocket:", e.message);
            this.sendToClient({
                type: "image_error",
                error: "Error serving image: " + e.message,
                imagePath: imagePath,
                requestId: requestId
            }, ip, id);
        }
    },
    
    // -------- Message Handling --------
    onWsReceive: function(msg, ip, id) {
        // Handle empty or null messages
        if (!msg || msg.trim() === "") {
            this.sendToClient({ type: "reply", text: "Empty message received" }, ip, id);
            return;
        }
        
        // Expect JSON: {type:'chat', text:'...', lang:'en'|'he'}
        try {
            var o = JSON.parse(msg);
            
            // Validate required fields
            if (!o.type) {
                this.sendToClient({ type: "reply", text: "Missing message type" }, ip, id);
                return;
            }
            
            // Route message based on type
            this.routeMessage(o, ip, id);
            
        } catch (e) {
            // Better error handling - log the problematic message
            console.log("JSON Parse Error - Received message: " + msg);
            console.log("Error: " + e.message);
            // Use default values for ip and id if they're not available
            var defaultIp = ip || "127.0.0.1";
            var defaultId = id || 1;
            this.sendToClient({ type: "reply", text: "Bad JSON: " + e.message }, defaultIp, defaultId);
        }
    },
    
    // -------- Message Routing --------
    routeMessage: function(o, ip, id) {
        console.log("DEBUG: onWsReceive - routing message type:", o.type);
        console.log("DEBUG: onWsReceive - full message:", JSON.stringify(o, null, 2));
        switch (o.type) {
        case "chat":
            this.handleChatMessage(o, ip, id);
            break;
        case "set_auto_confirm":
            this.handleSetAutoConfirm(o, ip, id);
            break;
            case "debug":
                this.handleDebugMessage(o, ip, id);
                break;
            case "story_update":
                this.handleStoryUpdate(o, ip, id);
                break;
            case "save_settings":
                this.handleSaveSettings(o, ip, id);
                break;
            case "get_commands":
                this.handleGetCommands(o, ip, id);
                break;
            case "get_all_notes":
                this.handleGetAllNotes(o, ip, id);
                break;
            case "cleanup_missing_images":
                this.handleCleanupMissingImages(o, ip, id);
                break;
            case "upload_complete":
                this.handleUploadComplete(o, ip, id);
                break;
            case "upload_cancelled":
                this.handleUploadCancelled(o, ip, id);
                break;
            case "upload_file":
                this.handleFileUpload(o, ip, id);
                break;
            case "convert_content_uri":
                this.handleContentUriConversion(o, ip, id);
                break;
            case "request_image":
                this.handleImageRequest(o, ip, id);
                break;
            case "cleanup_broken_image":
                this.handleCleanupBrokenImage(o, ip, id);
                break;
            case "test_file_apis":
                this.handleTestFileApis(o, ip, id);
                break;
            case "request_file_picker":
                this.handleFilePickerRequest(o, ip, id);
                break;
            default:
                this.sendToClient({ type: "reply", text: "Unknown message type: " + o.type }, ip, id);
        }
    },
    
    // -------- Auto Confirm Handler --------
    handleSetAutoConfirm: function(o, ip, id) {
        console.log("DEBUG: Setting auto confirm to:", o.enabled);
        this.Settings.autoConfirm = o.enabled === true;
        this.sendToClient({ type: "reply", text: `Auto confirmation ${o.enabled ? 'enabled' : 'disabled'}` }, ip, id);
    },

    // -------- Chat Message Handling --------
    handleChatMessage: function(o, ip, id) {
        // Validate chat message
        if (!o.text) {
            this.sendToClient({ type: "reply", text: "Missing text in chat message" }, ip, id);
            return;
        }
        
        this.Settings.lang = (o.lang === "he") ? "he" : "en";
        this.Settings.autoConfirm = o.autoConfirm === true;
        
        // Also update global Settings for detectIntent
        if (typeof global !== 'undefined' && global.Settings) {
            global.Settings.lang = this.Settings.lang;
            global.Settings.autoConfirm = this.Settings.autoConfirm;
        }
        
        // Also set global Settings for formatOutcome access
        if (typeof global !== 'undefined') {
            global.Settings = this.Settings;
        }
        
        
        console.log("DEBUG: onWsReceive - calling detectIntent with text='" + o.text + "'");
        
        // Debug: Check pending states before detectIntent
        var pendingNote = StateManager.getPendingNoteCreation();
        var pendingDeletion = StateManager.getPendingNoteDeletion();
        var pendingMarkDone = StateManager.getPendingNoteMarkDone();
        var pendingSubNote = StateManager.getPendingSubNoteCreation();
        var pendingUpdate = StateManager.getPendingStoryUpdate();
        console.log("DEBUG: Pending states before detectIntent - Note:", pendingNote, "Deletion:", pendingDeletion, "MarkDone:", pendingMarkDone, "SubNote:", pendingSubNote, "Update:", pendingUpdate);
        
        // Make sure global Settings is synced with this.Settings
        if (typeof global !== 'undefined') {
            global.Settings = this.Settings;
        }
        var det = CommandRouter.detectIntent(o.text, this.Settings);
        console.log("DEBUG: onWsReceive - detectIntent returned:", JSON.stringify(det));
        
        // Handle auto confirmation for sub-note creation
        if (det.action === "sub_note_name" && this.Settings.autoConfirm) {
            var pendingSubNote = StateManager.getPendingSubNoteCreation();
            if (pendingSubNote) {
                var subNoteName = det.params?.name || "untitled";
                
                // Auto-proceed with sub-note creation
                var note = NoteManager.createNote(subNoteName, "", pendingSubNote.parentNoteId);
                StateManager.clearPendingSubNoteCreation();
                
                // Find the parent note and set it as current context
                var parentNote = NoteManager.findNotesById(pendingSubNote.parentNoteId);
                if (parentNote && parentNote.length > 0) {
                    StateManager.setCurrentFindContext(parentNote);
                    var isHebrew = (this.Settings.lang === "he");
                    var successMsg = isHebrew ?
                        "תת-פתק נוצר בהצלחה! ID: " + note.id + ", כותרת: '" + note.title + "'\n\n" +
                        "חזרתי להקשר של הפתק הראשי '" + parentNote[0].title + "'. מה תרצה לעשות? (/editdescription /delete /createsub /markdone /talkai /selectsubnote)" :
                        "Sub-note created successfully! ID: " + note.id + ", Title: '" + note.title + "'\n\n" +
                        "Returned to parent note '" + parentNote[0].title + "' context. What would you like to do? (/editdescription /delete /createsub /markdone /talkai /selectsubnote)";
                    
                    this.sendToClient({ type: "reply", text: successMsg }, ip, id);
                    // Send available commands
                    var commands = this.getAvailableCommands();
                    this.sendToClient({ type: "available_commands", commands: commands }, ip, id);
                    return;
                }
            }
        }
        
        // Handle slash commands that need to set state BEFORE formatOutcome
        if (det.action === "slash_createsub") {
            var context = StateManager.getCurrentFindContext();
            if (context && context.length > 0) {
                var note = context[0].note || context[0];
                StateManager.setPendingSubNoteCreation(note.id);
                console.log("DEBUG: Set pending sub-note creation for note ID:", note.id);
            }
        }
        
        // Handle other commands that set pending states
        console.log("DEBUG: Checking slash_createnote - action:", det.action, "hasParameter:", det.params?.hasParameter, "title:", det.params?.title);
        if (det.action === "slash_create_note" && det.params?.hasParameter && det.params?.title) {
            StateManager.setPendingNoteCreation(det.params.title, null);
            console.log("DEBUG: Set pending note creation for title:", det.params.title);
        }
        
        
        // Handle sub-commands that set pending states
        if (det.action === "find_sub_edit_description") {
            var context = StateManager.getCurrentFindContext();
            if (context && context.length > 0) {
                var note = context[0].note || context[0];
                StateManager.setStoryEditingMode(note.id, note.title);
                StateManager.clearCurrentFindContext();
                console.log("DEBUG: Set story editing mode for note ID:", note.id, "title:", note.title);
                console.log("DEBUG: Story editing mode after setting:", StateManager.getStoryEditingMode());
            }
        }
        
        if (det.action === "slash_editdescription") {
            var context = StateManager.getCurrentFindContext();
            if (context && context.length > 0) {
                var note = context[0].note || context[0];
                StateManager.setStoryEditingMode(note.id, note.title);
                // Don't clear context here - let formatOutcome handle it
                console.log("DEBUG: Set story editing mode for note ID:", note.id, "title:", note.title);
                console.log("DEBUG: Story editing mode after setting:", StateManager.getStoryEditingMode());
            }
        }
        
        if (det.action === "slash_talkai") {
            var context = StateManager.getCurrentFindContext();
            if (context && context.length > 0) {
                var note = context[0].note || context[0];
                StateManager.setAiConversationMode(note); // Pass the full note object
                // Don't clear context here - let formatOutcome handle it
                console.log("DEBUG: Set AI conversation mode for note ID:", note.id, "title:", note.title);
                console.log("DEBUG: AI conversation mode after setting:", StateManager.getAiConversationMode());
            }
        }
        
        if (det.action === "find_sub_delete" || det.action === "slash_delete") {
            var context = StateManager.getCurrentFindContext();
            if (context && context.length > 0) {
                var note = context[0].note || context[0];
                StateManager.setPendingNoteDeletion(note.id);
                console.log("DEBUG: Set pending note deletion for note ID:", note.id);
            }
        }
        
        if (det.action === "find_sub_mark_done") {
            var context = StateManager.getCurrentFindContext();
            if (context && context.length > 0) {
                var note = context[0].note || context[0];
                StateManager.setPendingNoteMarkDone(note.id);
                console.log("DEBUG: Set pending note mark done for note ID:", note.id);
            }
        }
        
        if (det.action === "slash_markdone") {
            var context = StateManager.getCurrentFindContext();
            if (context && context.length > 0) {
                var note = context[0].note || context[0];
                StateManager.setPendingNoteMarkDone(note.id);
                console.log("DEBUG: Set pending note mark done for note ID:", note.id);
            }
        }
        
        if (det.action === "find_sub_talk_ai") {
            var context = StateManager.getCurrentFindContext();
            if (context && context.length > 0) {
                var note = context[0].note || context[0];
                StateManager.setAiConversationMode(note);
                StateManager.clearCurrentFindContext();
                console.log("DEBUG: Set AI conversation mode for note ID:", note.id);
            }
        }
        
        if (det.action === "slash_selectsubnote") {
            // No state setting needed for selectsubnote - it's handled in formatOutcome
            console.log("DEBUG: Processing slash_selectsubnote command");
        }
        
        // Handle confirmation responses
        if (det.action === "confirmation_yes") {
            var response = this.handleConfirmationResponse(o.text);
            if (response) {
                console.log("DEBUG: handleConfirmationResponse returned:", response);
                this.sendToClient({ type: "reply", text: response }, ip, id);
                return;
            }
        }
        
        if (det.action === "confirmation_no") {
            var response = this.handleConfirmationResponse(o.text);
            if (response) {
                console.log("DEBUG: handleConfirmationResponse returned:", response);
                this.sendToClient({ type: "reply", text: response }, ip, id);
                return;
            }
        }
        
        // Check for yes/no responses to confirmations AFTER setting pending states
        // But skip this check if we're waiting for a sub-note name or in AI conversation mode
        if (!StateManager.getPendingSubNoteCreation() && det.action !== "ai_conversation") {
            var response = this.handleConfirmationResponse(o.text);
            if (response) {
                console.log("DEBUG: handleConfirmationResponse returned:", response);
                this.sendToClient({ type: "reply", text: response }, ip, id);
                return;
            }
        } else {
            if (StateManager.getPendingSubNoteCreation()) {
                console.log("DEBUG: Skipping handleConfirmationResponse because waiting for sub-note name");
            } else if (det.action === "ai_conversation") {
                console.log("DEBUG: Skipping handleConfirmationResponse because in AI conversation mode");
            }
        }
        
        // Handle AI conversation asynchronously (before formatOutcome)
        if (det.action === "ai_conversation") {
            var message = det.params?.message;
            if (message) {
                var note = StateManager.getAiConversationNote();
                var conversationHistory = StateManager.getAiConversationHistory();
                
                var noteContext = "📝 **Note: " + note.title + "**";
                if (note.description) {
                    noteContext += "\nDescription: " + note.description;
                }
                
                // Build conversation history context
                var historyContext = "";
                if (conversationHistory && conversationHistory.length > 0) {
                    historyContext = "\n\n**Previous Conversation:**\n";
                    for (var i = 0; i < conversationHistory.length; i++) {
                        var turn = conversationHistory[i];
                        historyContext += "User: " + turn.user + "\n";
                        historyContext += "AI: " + turn.ai + "\n\n";
                    }
                }
                
                // Create a direct prompt for Gemini with the user's question and note context
                var prompt = noteContext + historyContext + "\n\nUser's current question: " + message;
                
                // Call Gemini directly with the user's question and context
                var self = this;
                var clientIp = ip;
                var clientId = id;
                AIService.callGeminiForQuestion(prompt, function(geminiResponse) {
                    console.log("DEBUG: Gemini response received for AI conversation, length:", geminiResponse ? geminiResponse.length : 0);
                    
                    // Check if response is valid
                    if (!geminiResponse || geminiResponse.trim() === "") {
                        console.log("DEBUG: Empty Gemini response, using fallback");
                        geminiResponse = "I'm sorry, I couldn't process your question right now. Please try again.";
                    }
                    
                    // Add to conversation history
                    StateManager.addToAiConversationHistory(message, geminiResponse);
                    
                    // Send the response back to the client
                    self.sendToClient({ type: "reply", text: geminiResponse }, clientIp, clientId);
                });
                
                // Send temporary response while Gemini processes
                this.sendToClient({ type: "reply", text: "🤖 Processing your question..." }, ip, id);
                return;
            }
        }
        
        var out = this.formatOutcome(det, ip, id);
        console.log("DEBUG: onWsReceive - formatOutcome returned:", typeof out === 'string' ? out : JSON.stringify(out));
        
        // Note: No general chat history - AI conversations are note-specific
        
        // Send regular response (no more graph data)
        console.log("DEBUG: Sending regular response");
        if (typeof out === 'object' && out.action === 'show_upload_modal') {
            // Send object directly for upload modal
            this.sendToClient({ type: "reply", text: out }, ip, id);
        } else {
            // Send string response
            this.sendToClient({ type: "reply", text: out }, ip, id);
        }
    },
    
    // -------- Debug Message Handling --------
    handleDebugMessage: function(o, ip, id) {
        switch (o.action) {
            case "get_notes":
                var notesJson = JSON.stringify(NoteManager.getNotesData(), null, 2);
                this.sendToClient({ type: "debug_notes", notes: notesJson }, ip, id);
                break;
            case "clear_notes":
                // Clear all notes
                NoteManager.clearAllNotes();
                this.sendToClient({ type: "debug_cleared" }, ip, id);
                break;
            default:
                this.sendToClient({ type: "reply", text: "Unknown debug action: " + o.action }, ip, id);
        }
    },
    
    // -------- Story Update Handling --------
    handleStoryUpdate: function(o, ip, id) {
        if (o.noteId && o.description) {
            var updatedNote = NoteManager.updateNoteDescription(o.noteId, o.description);
            if (updatedNote) {
                var isHebrew = (this.Settings.lang === "he");
                var message = isHebrew ? 
                    "תיאור הסיפור '" + updatedNote.title + "' עודכן בהצלחה!" :
                    "Story description for '" + updatedNote.title + "' updated successfully!";
                this.sendToClient({ type: "reply", text: message }, ip, id);
            } else {
                this.sendToClient({ type: "reply", text: "Failed to update story description" }, ip, id);
            }
        } else {
            this.sendToClient({ type: "reply", text: "Missing noteId or description" }, ip, id);
        }
    },
    
    // -------- Settings Handling --------
    handleSaveSettings: function(o, ip, id) {
        try {
            var settings = {
                geminiApiKey: o.geminiApiKey || "AIzaSyC9dXJT4ol3i2VoK6aqLjX5S7IMKSjwNC4"
            };
            app.WriteFile("settings.json", JSON.stringify(settings, null, 2));
            this.sendToClient({ type: "reply", text: "Settings saved successfully!" }, ip, id);
        } catch (error) {
            this.sendToClient({ type: "reply", text: "Error saving settings: " + error.message }, ip, id);
        }
    },
    
    // -------- Commands Handling --------
    handleGetCommands: function(o, ip, id) {
        try {
            var commands = this.getAvailableCommands();
            this.sendToClient({ type: "available_commands", commands: commands }, ip, id);
        } catch (error) {
            this.sendToClient({ type: "reply", text: "Error getting commands: " + error.message }, ip, id);
        }
    },
    
    handleGetAllNotes: function(o, ip, id) {
        try {
            var allNotes = NoteManager.getAllNotes();
            
            // Debug: Print all notes with all fields
            console.log("DEBUG: All notes with fields:");
            for (var i = 0; i < allNotes.length; i++) {
                var note = allNotes[i];
                console.log("Note " + i + ":", JSON.stringify(note, null, 2));
            }
            
            this.sendToClient({ type: "all_notes", notes: allNotes }, ip, id);
        } catch (error) {
            this.sendToClient({ type: "reply", text: "Error getting notes: " + error.message }, ip, id);
        }
    },
    
    handleCleanupMissingImages: function(o, ip, id) {
        try {
            var noteId = o.noteId;
            var removedImages = o.removedImages || [];
            
            // Update the note to remove missing image references
            for (var i = 0; i < removedImages.length; i++) {
                NoteManager.removeImageFromNote(noteId, removedImages[i]);
            }
            
            console.log("Cleaned up missing images for note", noteId, ":", removedImages.length, "images removed");
            this.sendToClient({ type: "reply", text: "Cleaned up " + removedImages.length + " missing images" }, ip, id);
        } catch (e) {
            console.log("Error cleaning up missing images:", e.message);
            this.sendToClient({ type: "reply", text: "Error cleaning up images: " + e.message }, ip, id);
        }
    },

    handleContentUriConversion: function(o, ip, id) {
        try {
            console.log("DEBUG: handleContentUriConversion called");
            console.log("DEBUG: Message object:", JSON.stringify(o, null, 2));
            console.log("DEBUG: Content URI:", o.contentUri);
            console.log("DEBUG: Client IP:", ip, "ID:", id);
            
            var contentUri = o.contentUri;
            if (!contentUri || !contentUri.startsWith('content://')) {
                console.log("DEBUG: Invalid content URI provided:", contentUri);
                this.sendToClient({ 
                    type: "uri_conversion_error", 
                    error: "Invalid content URI provided" 
                }, ip, id);
                return;
            }
            
            // Try to convert content URI to file path using DroidScript
            var filePath = null;
            var conversionSucceeded = false;
            
            if (typeof app.Uri2Path === 'function') {
                console.log("DEBUG: app.Uri2Path function is available");
                console.log("DEBUG: Calling app.Uri2Path with:", contentUri);
                
                try {
                    filePath = app.Uri2Path(contentUri);
                    console.log("DEBUG: app.Uri2Path returned:", filePath);
                    
                    // Check if conversion actually succeeded
                    if (filePath && filePath !== "null" && filePath !== "undefined" && filePath.length > 0) {
                        console.log("DEBUG: URI conversion succeeded:", filePath);
                        conversionSucceeded = true;
                    } else {
                        console.log("DEBUG: URI conversion returned null/empty, trying direct access");
                    }
                } catch (uriError) {
                    console.log("DEBUG: app.Uri2Path threw error:", uriError.message);
                }
            } else {
                console.log("DEBUG: app.Uri2Path not available in this DroidScript version");
            }
            
            if (conversionSucceeded) {
                console.log("DEBUG: Sending uri_conversion_success response");
                var response = { 
                    type: "uri_conversion_success", 
                    contentUri: contentUri,
                    filePath: filePath 
                };
                console.log("DEBUG: Response:", JSON.stringify(response, null, 2));
                this.sendToClient(response, ip, id);
            } else {
                // Fallback: Try to read content URI directly and send image data
                console.log("DEBUG: Attempting direct content URI access");
                
                try {
                    if (typeof app.ReadFile === 'function') {
                        console.log("DEBUG: Trying to read content URI directly as base64");
                        var imageData = app.ReadFile(contentUri, "base64");
                        
                        if (imageData && imageData.length > 0) {
                            console.log("DEBUG: Successfully read content URI, data length:", imageData.length);
                            
                            // Determine content type
                            var contentType = "image/jpeg";
                            if (contentUri.toLowerCase().includes("png")) contentType = "image/png";
                            else if (contentUri.toLowerCase().includes("gif")) contentType = "image/gif";
                            else if (contentUri.toLowerCase().includes("webp")) contentType = "image/webp";
                            
                            // Send image data directly instead of conversion
                            this.sendToClient({ 
                                type: "image_data", 
                                imagePath: contentUri,
                                contentType: contentType,
                                data: imageData,
                                requestId: o.requestId || "content_uri_" + Date.now()
                            }, ip, id);
                            return;
                        }
                    }
                } catch (readError) {
                    console.log("DEBUG: Direct content URI read failed:", readError.message);
                }
                
                // Final fallback: Send error
                console.log("DEBUG: All content URI access methods failed");
                this.sendToClient({ 
                    type: "uri_conversion_error", 
                    error: "Content URI cannot be accessed due to Android storage restrictions" 
                }, ip, id);
            }
        } catch (e) {
            console.log("DEBUG: Exception in handleContentUriConversion:", e.message);
            console.log("DEBUG: Stack trace:", e.stack);
            this.sendToClient({ 
                type: "uri_conversion_error", 
                error: "Error converting content URI: " + e.message 
            }, ip, id);
        }
    },
    
    handleUploadComplete: function(o, ip, id) {
        try {
            console.log("DEBUG: handleUploadComplete called with:", JSON.stringify(o, null, 2));
            var noteId = o.noteId;
            var imagePath = o.imagePath;
            var error = o.error;
            
            if (error) {
                console.log("DEBUG: Upload failed:", error);
                this.sendToClient({ type: "reply", text: "Upload failed: " + error }, ip, id);
            } else if (imagePath) {
                console.log("DEBUG: Adding image to note:", noteId, "imagePath:", imagePath);
                // Add image to note
                var updatedNote = NoteManager.addImageToNote(noteId, imagePath);
                console.log("DEBUG: Updated note:", JSON.stringify(updatedNote, null, 2));
                if (updatedNote) {
                    var imageCount = updatedNote.images.length;
                    var message = "Image successfully added to note (total " + imageCount + " images)";
                    console.log("DEBUG: Upload successful:", imagePath, "total images:", imageCount);
                    this.sendToClient({ type: "reply", text: message }, ip, id);
                } else {
                    console.log("DEBUG: Failed to add image to note");
                    this.sendToClient({ type: "reply", text: "Error adding image to note" }, ip, id);
                }
            } else {
                console.log("DEBUG: No imagePath provided");
                this.sendToClient({ type: "reply", text: "No image path provided" }, ip, id);
            }
        } catch (e) {
            console.log("DEBUG: Error handling upload completion:", e.message);
            console.log("DEBUG: Error stack:", e.stack);
            this.sendToClient({ type: "reply", text: "Error processing upload: " + e.message }, ip, id);
        }
    },
    
    handleUploadCancelled: function(o, ip, id) {
        try {
            console.log("DEBUG: handleUploadCancelled called with:", JSON.stringify(o, null, 2));
            var noteId = o.noteId;
            
            console.log("DEBUG: Upload cancelled for note:", noteId);
            this.sendToClient({ type: "reply", text: "Image upload cancelled" }, ip, id);
        } catch (e) {
            console.log("DEBUG: Error handling upload cancellation:", e.message);
            this.sendToClient({ type: "reply", text: "Error processing cancellation: " + e.message }, ip, id);
        }
    },
    
    handleFileUpload: function(o, ip, id) {
        try {
            console.log("DEBUG: handleFileUpload called with:", JSON.stringify(o, null, 2));
            var noteId = o.noteId;
            var filename = o.filename;
            var fileData = o.fileData;
            var imagePath = o.imagePath; // New field for native file paths
            var fileSize = o.fileSize;
            var fileType = o.fileType;
            
            console.log("DEBUG: Processing file upload for note:", noteId);
            console.log("DEBUG: Filename:", filename);
            console.log("DEBUG: Image path:", imagePath);
            console.log("DEBUG: File size:", fileSize, "bytes");
            console.log("DEBUG: File type:", fileType);
            
            var finalImagePath = null;
            
            // Handle native file paths (from DroidScript picker)
            if (imagePath && !fileData) {
                console.log("DEBUG: Using native file path:", imagePath);
                finalImagePath = imagePath;
            }
            // Handle base64 file data (from web upload) - use file path approach
            else if (fileData) {
                console.log("DEBUG: Using file path storage approach for base64 data");
                console.log("DEBUG: File data length:", fileData.length);
                console.log("DEBUG: File data preview:", fileData.substring(0, 100) + "...");
                
                // For web uploads, we need to create a mock file path since we're not actually saving files
                // This is a temporary solution - in a real app, you'd want to save the file somewhere
                var mockPath = "/storage/emulated/0/Pictures/" + filename;
                console.log("DEBUG: Using mock file path for web upload:", mockPath);
                finalImagePath = mockPath;
            }
            else {
                console.log("DEBUG: No file data or path provided");
                this.sendToClient({ 
                    type: "upload_error", 
                    error: "No file data or path provided" 
                }, ip, id);
                return;
            }
            
            if (finalImagePath) {
                console.log("DEBUG: File path ready:", finalImagePath);
                
                // Add image to note
                var updatedNote = NoteManager.addImageToNote(noteId, finalImagePath);
                if (updatedNote) {
                    var imageCount = updatedNote.images.length;
                    var message = "Image successfully uploaded and added to note (total " + imageCount + " images)";
                    console.log("DEBUG: Upload successful:", finalImagePath, "total images:", imageCount);
                    
                    // Send success response to upload page
                    this.sendToClient({ 
                        type: "upload_success", 
                        imagePath: finalImagePath,
                        message: message 
                    }, ip, id);
                } else {
                    console.log("DEBUG: Failed to add image to note");
                    this.sendToClient({ 
                        type: "upload_error", 
                        error: "Failed to add image to note" 
                    }, ip, id);
                }
            } else {
                console.log("DEBUG: Failed to process file");
                this.sendToClient({ 
                    type: "upload_error", 
                    error: "Failed to process file" 
                }, ip, id);
            }
        } catch (e) {
            console.log("DEBUG: Error handling file upload:", e.message);
            console.log("DEBUG: Error stack:", e.stack);
            this.sendToClient({ 
                type: "upload_error", 
                error: "Error processing file upload: " + e.message 
            }, ip, id);
        }
    },
    
    saveImageFile: function(base64Data, filename) {
        try {
            console.log("DEBUG: Using file path storage approach (no file saving)");
            console.log("DEBUG: Base64 data length:", base64Data.length);
            console.log("DEBUG: Base64 data preview:", base64Data.substring(0, 50) + "...");
            
            // With file path storage approach, we don't actually save files
            // Instead, we create a mock file path for the original file
            var mockPath = "/storage/emulated/0/Pictures/" + filename;
            console.log("DEBUG: Using mock file path for web upload:", mockPath);
            console.log("DEBUG: User will be warned not to delete original files");
            
            return mockPath;
        } catch (e) {
            console.log("ERROR: Failed to process image file path:", e.message);
            console.log("ERROR: Stack trace:", e.stack);
            return null;
        }
    },
    
    // -------- Confirmation Response Handling --------
    handleConfirmationResponse: function(text) {
        var isHebrew = (this.Settings.lang === "he");
        var lowerText = text.toLowerCase().trim();
        
        console.log("DEBUG: handleConfirmationResponse called with text:", text);
        
        // Check if auto confirmation is enabled and we have pending states
        var pendingNote = StateManager.getPendingNoteCreation();
        var pendingDeletion = StateManager.getPendingNoteDeletion();
        var pendingMarkDone = StateManager.getPendingNoteMarkDone();
        var pendingSubNote = StateManager.getPendingSubNoteCreation();
        
        if (this.Settings.autoConfirm && (pendingNote || pendingDeletion || pendingMarkDone || pendingSubNote)) {
            console.log("DEBUG: Auto confirmation enabled - proceeding automatically");
            // Auto-proceed with "yes" for all confirmations
            lowerText = "yes";
        }
        
        // Check what pending states exist
        var pendingNote = StateManager.getPendingNoteCreation();
        var pendingDeletion = StateManager.getPendingNoteDeletion();
        var pendingMarkDone = StateManager.getPendingNoteMarkDone();
        
        // Check for yes responses
        var yesPatterns = isHebrew ? 
            [/\b(כן|כן כן|כן בבקשה|כן אני רוצה|כן תודה)\b/] :
            [/\b(yes|yeah|yep|yup|sure|ok|okay|please|do it)\b/];
        
        // Check for no responses  
        var noPatterns = isHebrew ?
            [/\b(לא|לא תודה|לא רוצה|לא עכשיו|בטל|ביטול)\b/] :
            [/\b(no|nope|nah|cancel|don't|don't want)\b/, /\bstop\b(?!\s+(editing|recording|writing))/];
        
        for (var pattern of yesPatterns) {
            if (pattern.test(lowerText)) {
                // Check if we have a pending note creation
                var pendingNote = StateManager.getPendingNoteCreation();
                if (pendingNote) {
                    var note = NoteManager.createNote(pendingNote.title, "", pendingNote.parentId);
                    StateManager.clearPendingNoteCreation();
                    
                    // If this is a sub-note creation (has parentId), return to parent context
                    if (pendingNote.parentId) {
                        // Find the parent note and set it as current context
                        var parentNote = NoteManager.findNotesById(pendingNote.parentId);
                        if (parentNote && parentNote.length > 0) {
                            StateManager.setCurrentFindContext(parentNote);
                            if (isHebrew) {
                                return "תת-פתק נוצר בהצלחה! ID: " + note.id + ", כותרת: '" + note.title + "'\n\n" +
                                       "חזרתי להקשר של הפתק הראשי '" + parentNote[0].title + "'. מה תרצה לעשות? (/editdescription /delete /createsub /markdone /talkai /selectsubnote)";
                            }
                            return "Sub-note created successfully! ID: " + note.id + ", Title: '" + note.title + "'\n\n" +
                                   "Returned to parent note '" + parentNote[0].title + "' context. What would you like to do? (/editdescription /delete /createsub /markdone /talkai /selectsubnote)";
                        }
                    }
                    
                    // For regular notes, clear find context
                    StateManager.clearCurrentFindContext();
                    if (isHebrew) {
                        return "פתק נוצר בהצלחה! ID: " + note.id + ", כותרת: '" + note.title + "'";
                    }
                    return "Note created successfully! ID: " + note.id + ", Title: '" + note.title + "'";
                }
                
                
                // Check if we have a pending story update
                var pendingUpdate = StateManager.getPendingStoryUpdate();
                if (pendingUpdate) {
                    var updatedNote = NoteManager.updateNoteDescription(pendingUpdate.noteId, pendingUpdate.description);
                    StateManager.clearPendingStoryUpdate();
                    if (updatedNote) {
                        if (isHebrew) {
                            return "תיאור הסיפור '" + updatedNote.title + "' עודכן בהצלחה!";
                        }
                        return "Story description for '" + updatedNote.title + "' updated successfully!";
                    } else {
                        if (isHebrew) {
                            return "שגיאה בעדכון תיאור הסיפור.";
                        }
                        return "Error updating story description.";
                    }
                }
                
                // Check if we have a pending note deletion
                var pendingDeletion = StateManager.getPendingNoteDeletion();
                if (pendingDeletion) {
                    var deletedNote = NoteManager.deleteNote(pendingDeletion);
                    StateManager.clearPendingNoteDeletion();
                    StateManager.clearCurrentFindContext(); // Clear find context after action
                    if (isHebrew) {
                        return "הפתק '" + deletedNote.title + "' נמחק בהצלחה!";
                    }
                    return "Note '" + deletedNote.title + "' deleted successfully!";
                }
                
                // Check if we have a pending note mark done
                var pendingMarkDone = StateManager.getPendingNoteMarkDone();
                if (pendingMarkDone) {
                    var markedNote = NoteManager.markNoteAsDone(pendingMarkDone);
                    StateManager.clearPendingNoteMarkDone();
                    StateManager.clearCurrentFindContext(); // Clear find context after action
                    if (isHebrew) {
                        return "הפתק '" + markedNote.title + "' סומן כהושלם בהצלחה!";
                    }
                    return "Note '" + markedNote.title + "' marked as done successfully!";
                }
            }
        }
        
        for (var pattern of noPatterns) {
            if (pattern.test(lowerText)) {
                console.log("DEBUG: No pattern matched:", pattern);
                // User declined - cancel any pending actions
                var pendingNote = StateManager.getPendingNoteCreation();
                var pendingDeletion = StateManager.getPendingNoteDeletion();
                var pendingMarkDone = StateManager.getPendingNoteMarkDone();
                var pendingSubNote = StateManager.getPendingSubNoteCreation();
                
                console.log("DEBUG: Pending states - Note:", pendingNote, "Deletion:", pendingDeletion, "MarkDone:", pendingMarkDone, "SubNote:", pendingSubNote);
                
                if (pendingNote) {
                    StateManager.clearPendingNoteCreation();
                    if (isHebrew) {
                        return "יצירת הפתק בוטלה.";
                    }
                    return "Note creation cancelled.";
                }
                
                if (pendingDeletion) {
                    StateManager.clearPendingNoteDeletion();
                    if (isHebrew) {
                        return "מחיקת הפתק בוטלה.";
                    }
                    return "Note deletion cancelled.";
                }
                
                if (pendingMarkDone) {
                    StateManager.clearPendingNoteMarkDone();
                    if (isHebrew) {
                        return "סימון הפתק כהושלם בוטל.";
                    }
                    return "Note mark done cancelled.";
                }
                
                if (pendingSubNote) {
                    console.log("DEBUG: Cancelling sub-note creation");
                    StateManager.clearPendingSubNoteCreation();
                    StateManager.clearCurrentFindContext();
                    if (isHebrew) {
                        return "יצירת התת-פתק בוטלה.";
                    }
                    return "Sub-note creation cancelled.";
                }
                
                // Check for pending story update
                var pendingUpdate = StateManager.getPendingStoryUpdate();
                if (pendingUpdate) {
                    StateManager.clearPendingStoryUpdate();
                    if (isHebrew) {
                        return "עדכון תיאור הסיפור בוטל.";
                    }
                    return "Story description update cancelled.";
                }
            }
        }
        
        return null; // No confirmation response detected
    },
    
    // -------- Command Generation --------
    getAvailableCommands: function() {
        var lang = this.Settings.lang || "en";
        var commands = [];
        
        // Check current application state
        var currentFindContext = StateManager.getCurrentFindContext();
        var storyEditingMode = StateManager.getStoryEditingMode();
        var aiConversationMode = StateManager.getAiConversationMode();
        var pendingNoteCreation = StateManager.getPendingNoteCreation();
        var pendingNoteDeletion = StateManager.getPendingNoteDeletion();
        var pendingNoteMarkDone = StateManager.getPendingNoteMarkDone();
        var pendingSubNoteCreation = StateManager.getPendingSubNoteCreation();
        
        // Debug: Current context state
        
        // Define command metadata
        var commandMetadata = {
            slash_create_note: { 
                category: "📝 Create", 
                description: "Creating a new note",
                examples: ["/createnote groceries", "/createnote my task"],
                requiresParam: true,
                contexts: ["main"] // Only in main context
            },
            slash_find_note: { 
                category: "🔍 Find", 
                description: "Searching for notes by title",
                examples: ["/findnote shopping", "/findnote my tasks"],
                requiresParam: true,
                contexts: ["main"] // Only in main context
            },
            slash_find_by_id: { 
                category: "🔍 Find", 
                description: "Finding note by ID number",
                examples: ["/findbyid 5", "/findbyid 12"],
                requiresParam: true,
                contexts: ["main"] // Only in main context
            },
            slash_show_parents: { 
                category: "📋 Show", 
                description: "Showing all parent notes",
                examples: ["/showparents"],
                requiresParam: false,
                contexts: ["main", "find_context"] // Available in main and find contexts
            },
            slash_help: { 
                category: "❓ Help", 
                description: "Showing available commands",
                examples: ["/help"],
                requiresParam: false,
                contexts: ["main", "find_context", "story_editing", "ai_conversation", "pending_creation"] // Available in all contexts
            },
            slash_editdescription: { 
                category: "✏️ Edit", 
                description: "Editing note description",
                examples: ["/editdescription"],
                requiresParam: false,
                contexts: ["find_context"] // Only when a note is found
            },
            slash_markdone: { 
                category: "✅ Mark", 
                description: "Marking the current note as done",
                examples: ["/markdone"],
                requiresParam: false,
                contexts: ["find_context"] // Only when a note is found
            },
            slash_delete: { 
                category: "🗑️ Delete", 
                description: "Deleting the current note",
                examples: ["/delete"],
                requiresParam: false,
                contexts: ["find_context"] // Only when a note is found
            },
            slash_createsub: { 
                category: "📝 Create", 
                description: "Creating a sub-note under current note",
                examples: ["/createsub"],
                requiresParam: false,
                contexts: ["find_context"] // Only when a note is found
            },
            slash_uploadimage: { 
                category: "🖼️ Image", 
                description: "Uploading an image to the current note",
                examples: ["/uploadimage"],
                requiresParam: false,
                contexts: ["find_context"] // Only when a note is found
            },
            slash_teststorage: { 
                category: "🔧 Debug", 
                description: "Testing storage permissions and directories",
                examples: ["/teststorage"],
                requiresParam: false,
                contexts: ["any"] // Available in any context
            },
            slash_talkai: { 
                category: "🤖 AI", 
                description: "Starting AI conversation about current note",
                examples: ["/talkai"],
                requiresParam: false,
                contexts: ["find_context"] // Only when a note is found
            },
            slash_savelastmessage: { 
                category: "🤖 AI", 
                description: "Saving last AI response as sub-note",
                examples: ["/savelastmessage"],
                requiresParam: false,
                contexts: ["ai_conversation"] // Only during AI conversation
            },
            slash_selectsubnote: { 
                category: "🔍 Navigate", 
                description: "Selecting a sub-note by number",
                examples: ["/selectsubnote 2", "/selectsub 3", "/sub 4"],
                requiresParam: true,
                contexts: ["find_context"] // Only when a note is found
            },
            slash_stopediting: { 
                category: "📝 Edit", 
                description: "Stopping description editing mode",
                examples: ["/stopediting"],
                requiresParam: false,
                contexts: ["story_editing"] // Only when editing
            },
            slash_back: { 
                category: "🔙 Back", 
                description: "Going back to previous context",
                examples: ["/back"],
                requiresParam: false,
                contexts: ["find_context", "story_editing", "ai_conversation", "pending_creation"] // Available in most contexts
            },
            yes_response: { 
                category: "✅ Confirm", 
                description: "Confirming the action",
                examples: ["yes", "y", "yeah", "sure", "ok"],
                requiresParam: false,
                contexts: ["pending_creation"] // Only when waiting for confirmation
            },
            no_response: { 
                category: "❌ Decline", 
                description: "Declining the action",
                examples: ["no", "n", "nope", "cancel"],
                requiresParam: false,
                contexts: ["pending_creation"] // Only when waiting for confirmation
    }
};

        // Determine current context
        var currentContext = "main"; // Default
        
        // Determine context based on current state
        // Check context conditions
        
        if (storyEditingMode) {
            currentContext = "story_editing";
        } else if (aiConversationMode) {
            currentContext = "ai_conversation";
        } else if (pendingNoteCreation || pendingNoteDeletion || pendingNoteMarkDone || pendingSubNoteCreation) {
            currentContext = "pending_creation";
        } else if (currentFindContext && currentFindContext.length > 0) {
            currentContext = "find_context";
        }
        
        // Context determined
        
        // Extract commands based on current context
        for (var action in commandMetadata) {
            if (action.startsWith("slash_") || action.endsWith("_response")) {
                var metadata = commandMetadata[action];
                
                // Check if this command is available in current context
                if (metadata.contexts.includes(currentContext)) {
                    // Map action to command prefix
                    var commandMap = {
                        'slash_create_note': '/createnote',
                        'slash_find_note': '/findnote',
                        'slash_find_by_id': '/findbyid',
                        'slash_show_parents': '/showparents',
                        'slash_help': '/help',
                        'slash_editdescription': '/editdescription',
                        'slash_markdone': '/markdone',
                        'slash_delete': '/delete',
                        'slash_createsub': '/createsub',
                        'slash_uploadimage': '/uploadimage',
                        'slash_teststorage': '/teststorage',
                        'slash_talkai': '/talkai',
                        'slash_savelastmessage': '/savelastmessage',
                        'slash_selectsubnote': '/selectsubnote',
                        'slash_stopediting': '/stopediting',
                        'slash_back': '/back',
                        'yes_response': 'yes',
                        'no_response': 'no'
                    };
                    
                    var command = commandMap[action];
                    if (command) {
                        // Adding command to available list
                        commands.push({
                            action: action,
                            command: command,
                            category: metadata.category,
                            description: metadata.description,
                            examples: metadata.examples,
                            requiresParam: metadata.requiresParam
                        });
                    }
                }
            }
        }
        
        // Return available commands
        return commands;
    },
    
    // -------- Format Outcome (moved from main.js) --------
    formatOutcome: function(r, ip, id) {
        var isHebrew = (this.Settings.lang === "he");
        
        if (r.action === "unknown") {
            if (isHebrew) {
                return "לא הבנתי. נסה לומר: 'צור פתק על קניות' או 'מצא את הפתקים שלי'";
            }
            return "I didn't understand that. Try saying: 'create a note about groceries' or 'find my notes'";
        }
        
        if (r.action === "unknown_command") {
            if (isHebrew) {
                return "לא הבנתי את הפקודה. נסה להשתמש בפקודות הזמינות או אמור '/help' לרשימת פקודות.";
            }
            return "I didn't understand that command. Try using the available commands or say '/help' for a list of commands.";
        }
        
        if (r.action === "gemini_question") {
            // This should only happen when explicitly requested via /talkai command
            // For now, redirect to help since AI should only be used in specific contexts
            if (isHebrew) {
                return "🤖 AI זמין רק במצב שיחה עם פתק ספציפי. השתמש ב-'/talkai' כדי להתחיל שיחה עם AI על פתק.";
            }
            return "🤖 AI is only available when talking with a specific note. Use '/talkai' to start an AI conversation about a note.";
        }
        
        // Handle slash commands first
        if (r.action === "slash_create_note") {
            if (r.params?.hasParameter && r.params?.title) {
                // User provided title with command - create directly
                var title = r.params.title;
                // Note: setPendingNoteCreation is now handled in handleChatMessage before formatOutcome
                if (isHebrew) {
                    return "האם תרצה ליצור פתק בשם '" + title + "'? (כן/לא)";
                }
                return "Do you want to create a note with title '" + title + "'? (yes/no)";
            } else {
                // No title provided - ask for it
                CommandRouter.setPendingCommandCompletion("create_note", "slash_create_note");
                if (isHebrew) {
                    return "מה השם של הפתק החדש?";
                }
                return "What should be the title of the new note?";
            }
        }
        
        
        if (r.action === "slash_find_note") {
            if (r.params?.hasParameter && r.params?.query) {
                // User provided query with command - search directly
                var query = r.params.query;
                var foundNotes = NoteManager.findNotesByTitle(query);
                
                if (foundNotes.length === 0) {
                    if (isHebrew) {
                        return "לא נמצאו פתקים עבור '" + query + "'";
                    }
                    return "No notes found for '" + query + "'";
                }
                
                // Set the found notes in context for sub-commands
                StateManager.setCurrentFindContext(foundNotes);
                
                if (foundNotes.length === 1) {
                    var note = foundNotes[0].note || foundNotes[0];
                    // Find children of this note
                    var children = NoteManager.findNoteChildren(note.id);
                    // Create simple text tree representation
                    var treeText = NoteManager.createNoteTree(note, children);
                    
                    if (isHebrew) {
                        return "נמצא פתק אחד: '" + note.title + "' (ID: " + note.id + ").\n\n" + treeText + "\n\nמה תרצה לעשות? (/editdescription /delete /createsub /markdone /talkai /selectsubnote)";
                    }
                    return "Found 1 note: '" + note.title + "' (ID: " + note.id + ").\n\n" + treeText + "\n\nWhat would you like to do? (/editdescription /delete /createsub /markdone /talkai /selectsubnote)";
                } else {
                    var noteList = "";
                    for (var i = 0; i < Math.min(foundNotes.length, 5); i++) {
                        var note = foundNotes[i].note || foundNotes[i];
                        var statusIcon = note.done ? "✅" : "➡️";
                        noteList += (i + 1) + ". " + statusIcon + " '" + note.title + "' (ID: " + note.id + ")\n";
                    }
                    if (isHebrew) {
                        return "נמצאו " + foundNotes.length + " פתקים:\n" + noteList + "\nאיזה פתק תרצה לבחור? (אמור את המספר או השם)";
                    }
                    return "Found " + foundNotes.length + " notes:\n" + noteList + "\nWhich note would you like to select? (say the number or name)";
                }
            } else {
                // No query provided - ask for it
                CommandRouter.setPendingCommandCompletion("find_note", "slash_find_note");
                if (isHebrew) {
                    return "מה השם של הפתק שאתה מחפש?";
                }
                return "What is the name of the note you're looking for?";
            }
        }
        
        if (r.action === "slash_find_by_id") {
            if (r.params?.hasParameter && r.params?.query) {
                // User provided ID with command - search directly
                var query = r.params.query;
                var foundNotes = NoteManager.findNotesById(query);
                
                if (foundNotes.length === 0) {
                    if (isHebrew) {
                        return "לא נמצא פתק עם מזהה '" + query + "'";
                    }
                    return "No note found with ID '" + query + "'";
                }
                
                // Set the found notes in context for sub-commands
                StateManager.setCurrentFindContext(foundNotes);
                
                var note = foundNotes[0];
                // Find children of this note
                var children = NoteManager.findNoteChildren(note.id);
                // Create simple text tree representation
                var treeText = NoteManager.createNoteTree(note, children);
                
                if (isHebrew) {
                    return "נמצא פתק: '" + note.title + "' (ID: " + note.id + ").\n\n" + treeText + "\n\nמה תרצה לעשות? (/editdescription /delete /createsub /markdone /talkai /selectsubnote)";
                }
                return "Found note: '" + note.title + "' (ID: " + note.id + ").\n\n" + treeText + "\n\nWhat would you like to do? (/editdescription /delete /createsub /markdone /talkai /selectsubnote)";
            } else {
                // No ID provided - ask for it
                CommandRouter.setPendingCommandCompletion("find_by_id", "slash_find_by_id");
                if (isHebrew) {
                    return "מה המזהה של הפתק שאתה מחפש?";
                }
                return "What is the ID of the note you're looking for?";
            }
        }
        
        if (r.action === "slash_show_parents") {
            // Get all notes that don't have a parent (parent_id is null)
            var parentNotes = [];
            var allNotes = NoteManager.getAllNotes();
            for (var i = 0; i < allNotes.length; i++) {
                var note = allNotes[i];
                if (!note.deleted && !note.parent_id) {
                    parentNotes.push(note);
                }
            }
            
            if (parentNotes.length === 0) {
                if (isHebrew) {
                    return "לא נמצאו פתקים ראשיים.";
                }
                return "No parent notes found.";
            }
            
            // Sort by creation date (newest first)
            parentNotes.sort(function(a, b) {
                return new Date(b.creation_date) - new Date(a.creation_date);
            });
            
            var noteList = "";
            for (var j = 0; j < parentNotes.length; j++) {
                var note = parentNotes[j];
                var statusIcon = note.done ? "✅" : "➡️";
                var children = NoteManager.findNoteChildren(note.id);
                var childrenCount = children.length;
                
                noteList += (j + 1) + ". " + statusIcon + " '" + note.title + "' (ID: " + note.id + ")";
                if (childrenCount > 0) {
                    noteList += " [" + childrenCount + " sub-note" + (childrenCount > 1 ? "s" : "") + "]";
                }
                noteList += "\n";
            }
            
            if (isHebrew) {
                return "נמצאו " + parentNotes.length + " פתקים ראשיים:\n\n" + noteList + "\nלעבודה עם פתק ספציפי, השתמש ב-`/findnote [שם]` או `/findbyid [מספר]`.";
            }
            return "Found " + parentNotes.length + " parent notes:\n\n" + noteList + "\nTo work with a specific note, use `/findnote [name]` or `/findbyid [number]`.";
        }
        
        if (r.action === "slash_auto_confirm_on") {
            this.Settings.autoConfirm = true;
            if (isHebrew) {
                return "✅ אישור אוטומטי הופעל! כל הפעולות ימשיכו אוטומטית ללא אישור.";
            }
            return "✅ Auto confirmation enabled! All actions will proceed automatically without confirmation.";
        }
        
        if (r.action === "slash_auto_confirm_off") {
            this.Settings.autoConfirm = false;
            if (isHebrew) {
                return "❌ אישור אוטומטי בוטל! כל הפעולות ידרשו אישור ידני.";
            }
            return "❌ Auto confirmation disabled! All actions will require manual confirmation.";
        }
        
        if (r.action === "slash_uploadimage") {
            console.log("DEBUG: Upload image command received");
            var context = StateManager.getCurrentFindContext();
            console.log("DEBUG: Current find context:", context);
            
            if (!context || context.length === 0) {
                console.log("DEBUG: No find context found");
                if (isHebrew) {
                    return "לא נמצאו פתקים להעלאת תמונה. נסה לחפש קודם.";
                }
                return "No notes found to upload image to. Try searching first.";
            }
            
            var note = context[0].note || context[0];
            console.log("DEBUG: Found note for upload:", note.id, note.title);
            var currentImages = NoteManager.getNoteImages(note.id);
            console.log("DEBUG: Current images count:", currentImages.length);
            
            // Check if note already has maximum images
            if (currentImages.length >= 5) {
                console.log("DEBUG: Note already has maximum images");
                if (isHebrew) {
                    return "הפתק כבר מכיל 5 תמונות (המקסימום). מחק תמונה קיימת לפני הוספת חדשה.";
                }
                return "Note already has 5 images (maximum). Delete an existing image before adding a new one.";
            }
            
            console.log("DEBUG: Opening native DroidScript file picker");
            
            // Use native DroidScript file picker instead of HTML
            var self = this;
            ImageManager.openImagePicker(note.id, function(success, imagePath, error) {
                if (success && imagePath) {
                    console.log("DEBUG: Native file picker success:", imagePath);
                    
                    // Add image to note
                    var updatedNote = NoteManager.addImageToNote(note.id, imagePath);
                    if (updatedNote) {
                        var imageCount = updatedNote.images.length;
                        var message = "✅ Image successfully added to note '" + note.title + "' (total " + imageCount + " images)";
                        
                        // If under the limit, offer to add more images with clear instructions
                        if (imageCount < ImageManager.maxImagesPerNote) {
                            var remaining = ImageManager.maxImagesPerNote - imageCount;
                            message += "\n\n📷 **Multiple Image Upload**";
                            message += "\n• DroidScript supports one image at a time";
                            message += "\n• To add more images: Type `/uploadimage` again";
                            message += "\n• Remaining slots: " + remaining + "/" + ImageManager.maxImagesPerNote;
                        } else {
                            message += "\n\n📷 Maximum images reached (" + ImageManager.maxImagesPerNote + " images per note).";
                        }
                        
                        console.log("DEBUG: Image added successfully:", imagePath, "total images:", imageCount);
                        
                        // Send success message back to client
                        self.sendToClient({ 
                            type: "reply",
                            text: message
                        }, ip, id);
                    } else {
                        console.log("DEBUG: Failed to add image to note");
                        self.sendToClient({ 
                            type: "reply", 
                            text: "❌ Failed to add image to note" 
                        }, ip, id);
                    }
                } else {
                    console.log("DEBUG: Native file picker failed:", error);
                    var errorMessage = error || "File selection cancelled or failed";
                    self.sendToClient({ 
                        type: "reply", 
                        text: "❌ Image upload failed: " + errorMessage 
                    }, ip, id);
                }
            });
            
            var uploadMessage = "📁 Opening native file picker...";
            uploadMessage += "\n\n💡 **Note**: DroidScript supports uploading one image at a time.";
            uploadMessage += "\nTo add multiple images, repeat the `/uploadimage` command.";
            
            return uploadMessage;
        }
        
        if (r.action === "slash_teststorage") {
            console.log("DEBUG: Test storage command received");
            try {
                // Test the file path storage system
                ImageManager.initializeStorage();
                
                var testResult = "🔧 **File Path Storage Test**\n\n";
                testResult += "📁 **Storage Configuration:**\n";
                testResult += "• Approach: File path storage (no copying)\n";
                testResult += "• Max images per note: " + ImageManager.maxImagesPerNote + "\n";
                testResult += "• Supported formats: " + ImageManager.supportedFormats.join(", ") + "\n\n";
                
                testResult += "🔍 **API Availability:**\n";
                testResult += "• ChooseFile: " + (typeof app.ChooseFile === 'function' ? "✅ Available" : "❌ Not available") + "\n";
                testResult += "• CreateIntent: " + (typeof app.CreateIntent === 'function' ? "✅ Available" : "❌ Not available") + "\n";
                testResult += "• FileExists: " + (typeof app.FileExists === 'function' ? "✅ Available" : "❌ Not available") + "\n";
                testResult += "• ReadFile: " + (typeof app.ReadFile === 'function' ? "✅ Available" : "❌ Not available") + "\n\n";
                
                testResult += "⚠️ **Important Notes:**\n";
                testResult += "• Images are stored as file paths to original locations\n";
                testResult += "• Do not delete or move original image files\n";
                testResult += "• Permission issues may prevent image display\n";
                testResult += "• Use `/cleanupimages` to remove broken links\n";
                
                return testResult;
            } catch (e) {
                console.log("DEBUG: Storage test error:", e.message);
                return "❌ Storage test failed: " + e.message;
            }
        }
        
        if (r.action === "slash_test_file_apis") {
            console.log("DEBUG: Test file APIs command received");
            
            // Send immediate feedback
            this.sendToClient({ type: "reply", text: "🔧 Testing DroidScript file APIs..." }, ip, id);
            
            // Trigger the test
            this.handleTestFileApis({ testPath: "/storage/emulated/0/Pictures/debug_image.jpg" }, ip, id);
            
            return "Testing file APIs...";
        }
        
        if (r.action === "slash_test_storage") {
            console.log("DEBUG: Test storage command received");
            try {
                // Test the internal storage system
                ImageManager.initializeStorage();
                
                var testResult = "🔧 **Internal Storage Test**\n\n";
                testResult += "📁 **Storage Configuration:**\n";
                testResult += "• Approach: Internal app storage (copying files)\n";
                testResult += "• Storage folder: " + (ImageManager.storageFolder || "Not initialized") + "\n";
                testResult += "• Max images per note: " + ImageManager.maxImagesPerNote + "\n";
                testResult += "• Supported formats: " + ImageManager.supportedFormats.join(", ") + "\n\n";
                
                testResult += "🔍 **API Availability:**\n";
                testResult += "• ChooseFile: " + (typeof app.ChooseFile === 'function' ? "✅ Available" : "❌ Not available") + "\n";
                testResult += "• GetPrivateFolder: " + (typeof app.GetPrivateFolder === 'function' ? "✅ Available" : "❌ Not available") + "\n";
                testResult += "• MakeFolder: " + (typeof app.MakeFolder === 'function' ? "✅ Available" : "❌ Not available") + "\n";
                testResult += "• CopyFile: " + (typeof app.CopyFile === 'function' ? "✅ Available" : "❌ Not available") + "\n";
                testResult += "• WriteFile: " + (typeof app.WriteFile === 'function' ? "✅ Available" : "❌ Not available") + "\n";
                testResult += "• DeleteFile: " + (typeof app.DeleteFile === 'function' ? "✅ Available" : "❌ Not available") + "\n\n";
                
                // Test actual file writing
                testResult += "🧪 **File Write Test:**\n";
                try {
                    if (ImageManager.storageFolder && typeof app.WriteFile === 'function') {
                        var testFilename = "test_" + Date.now() + ".txt";
                        var testPath = ImageManager.storageFolder + testFilename;
                        var testData = "Test file content";
                        
                        console.log("DEBUG: Testing file write to:", testPath);
                        var writeSuccess = app.WriteFile(testPath, testData);
                        
                        if (writeSuccess) {
                            testResult += "• Write test: ✅ SUCCESS\n";
                            testResult += "• Test file: " + testFilename + "\n";
                            
                            // Try to read it back
                            if (typeof app.ReadFile === 'function') {
                                var readData = app.ReadFile(testPath);
                                if (readData === testData) {
                                    testResult += "• Read test: ✅ SUCCESS\n";
                                } else {
                                    testResult += "• Read test: ⚠️ Data mismatch\n";
                                }
                            }
                            
                            // Clean up test file
                            if (typeof app.DeleteFile === 'function') {
                                app.DeleteFile(testPath);
                                testResult += "• Cleanup: ✅ Test file removed\n";
                            }
                        } else {
                            testResult += "• Write test: ❌ FAILED\n";
                            testResult += "• Issue: app.WriteFile returned false\n";
                        }
                    } else {
                        testResult += "• Write test: ❌ SKIPPED (storage not available)\n";
                    }
                } catch (testError) {
                    testResult += "• Write test: ❌ ERROR: " + testError.message + "\n";
                }
                
                testResult += "\n✅ **Benefits:**\n";
                testResult += "• No permission issues - uses app's private folder\n";
                testResult += "• Images always accessible by the app\n";
                testResult += "• Automatic cleanup when images removed from notes\n";
                testResult += "• Works on all Android versions\n";
                
                return testResult;
            } catch (e) {
                console.log("DEBUG: Storage test error:", e.message);
                return "❌ Storage test failed: " + e.message;
            }
        }
        
        if (r.action === "slash_manage_storage") {
            console.log("DEBUG: Manage storage command received");
            try {
                var storageInfo = "🗂️ **Storage Management**\n\n";
                
                if (ImageManager.storageFolder) {
                    storageInfo += "📁 **Internal Storage:**\n";
                    storageInfo += "• Location: " + ImageManager.storageFolder + "\n";
                    storageInfo += "• Status: ✅ Active\n";
                    storageInfo += "• Type: App private folder (no permissions needed)\n\n";
                    
                    storageInfo += "🔧 **Available Actions:**\n";
                    storageInfo += "• `/cleanupimages` - Remove broken image links\n";
                    storageInfo += "• `/uploadimage` - Add new images to current note\n";
                    storageInfo += "• Images are automatically copied to internal storage\n";
                    storageInfo += "• Original files can be safely deleted after upload\n\n";
                    
                    storageInfo += "ℹ️ **How It Works:**\n";
                    storageInfo += "1. When you upload an image, it's copied to app storage\n";
                    storageInfo += "2. The app always has access to these copies\n";
                    storageInfo += "3. No permission issues or broken links\n";
                    storageInfo += "4. Images are deleted when removed from notes\n";
                } else {
                    storageInfo += "⚠️ **Storage Not Initialized:**\n";
                    storageInfo += "• Internal storage is not available\n";
                    storageInfo += "• Using fallback file path storage\n";
                    storageInfo += "• May experience permission issues\n\n";
                    
                    storageInfo += "🔧 **Try:**\n";
                    storageInfo += "• Restart the app to reinitialize storage\n";
                    storageInfo += "• Check app permissions in Android settings\n";
                }
                
                return storageInfo;
            } catch (e) {
                console.log("DEBUG: Manage storage error:", e.message);
                return "❌ Storage management failed: " + e.message;
            }
        }
        
        if (r.action === "slash_cleanup_images") {
            console.log("DEBUG: Cleanup images command received");
            try {
                // Get all notes and check for broken images
                var allNotes = NoteManager.getAllNotes();
                var brokenImages = [];
                var totalImages = 0;
                
                allNotes.forEach(function(note) {
                    if (note.images && note.images.length > 0) {
                        note.images.forEach(function(imagePath) {
                            totalImages++;
                            // Check if file exists
                            var exists = false;
                            try {
                                if (typeof app.FileExists === 'function') {
                                    exists = app.FileExists(imagePath);
                                } else {
                                    // Try to read the file as a test
                                    var testRead = app.ReadFile(imagePath);
                                    exists = (testRead !== null && testRead !== undefined);
                                }
                            } catch (e) {
                                exists = false;
                            }
                            
                            if (!exists) {
                                brokenImages.push({
                                    path: imagePath,
                                    noteId: note.id,
                                    noteTitle: note.title
                                });
                            }
                        });
                    }
                });
                
                if (brokenImages.length === 0) {
                    return "✅ All " + totalImages + " images are accessible. No cleanup needed.";
                } else {
                    // Clean up broken images
                    var cleanedNotes = [];
                    brokenImages.forEach(function(brokenImg) {
                        // Use NoteManager.removeImageFromNote to properly remove the broken image
                        var updatedNote = NoteManager.removeImageFromNote(brokenImg.noteId, brokenImg.path);
                        if (updatedNote) {
                            cleanedNotes.push(brokenImg.noteTitle);
                        }
                    });
                    
                    return "🧹 Cleaned up " + brokenImages.length + " broken image links from " + cleanedNotes.length + " notes.\n" +
                           "Remaining: " + (totalImages - brokenImages.length) + " accessible images.";
                }
            } catch (e) {
                console.log("DEBUG: Cleanup images error:", e.message);
                return "❌ Cleanup failed: " + e.message;
            }
        }
        
        if (r.action === "slash_help") {
            if (isHebrew) {
                return "🆘 **פקודות זמינות:**\n\n" +
                       "📝 **פקודות יצירה:**\n" +
                       "• `/createnote [שם]` - צור פתק חדש\n" +
                       "🔍 **פקודות חיפוש:**\n" +
                       "• `/findnote [שם]` - חפש פתקים\n" +
                       "• `/findbyid [מספר]` - חפש לפי מזהה\n\n" +
                       "📋 **פקודות הצגה:**\n" +
                       "• `/showparents` - הצג פתקים ראשיים\n\n" +
                       "🖼️ **פקודות תמונות:**\n" +
                       "• `/uploadimage` - העלה תמונה לפתק\n" +
                       "• `/cleanupimages` - הסר קישורי תמונות שבורים\n" +
                       "• `/testfileapis` - בדוק גישה למערכת קבצים\n" +
                       "• `/teststorage` - בדוק מערכת אחסון תמונות\n\n" +
                       "🔙 **פקודות ניווט:**\n" +
                       "• `/back` - חזור להקשר הקודם\n\n" +
                       "⚙️ **הגדרות:**\n" +
                       "• `/autoconfirmon` - הפעל אישור אוטומטי\n" +
                       "• `/autoconfirmoff` - בטל אישור אוטומטי\n\n" +
                       "💡 **דוגמאות מהירות:**\n" +
                       "• `/createnote רשימת קניות`\n" +
                       "• `/findnote מוצרים`\n" +
                       "• `/findbyid 5`\n" +
                       "• `/showparents`\n\n" +
                       "ℹ️ **הערה:** כל פורמטי הפקודות נתמכים:\n" +
                       "• Snake case: `/create_note`, `/find_note`, `/find_by_id`\n" +
                       "• Kebab case: `/create-note`, `/find-note`, `/find-by-id`\n" +
                       "• Camel case: `/createNote`, `/findNote`, `/findById`\n" +
                       "• הקצר ביותר: `/create`, `/find`, `/id`, `/parents`";
            }
            return "🆘 **Available Commands:**\n\n" +
                   "📝 **Create Commands:**\n" +
                   "• `/createnote [title]` - Create a new note\n" +
                   "🔍 **Find Commands:**\n" +
                   "• `/findnote [title]` - Search for notes\n" +
                   "• `/findbyid [number]` - Find by ID\n\n" +
                   "📋 **Show Commands:**\n" +
                   "• `/showparents` - Show parent notes\n\n" +
                   "🖼️ **Image Commands:**\n" +
                   "• `/uploadimage` - Upload image to note\n" +
                   "• `/cleanupimages` - Remove broken image links\n" +
                   "• `/testfileapis` - Test file system access\n" +
                   "• `/teststorage` - Test image storage system\n" +
                   "• `/managestorage` - View storage management info\n\n" +
                   "✏️ **Edit Commands:**\n" +
                   "• `/editdescription` - Edit note description\n" +
                   "• `/stopediting` - Stop editing description\n" +
                   "• `/markdone` - Mark note as done\n" +
                   "• `/delete` - Delete note\n" +
                   "• `/createsub` - Create sub-note\n" +
                   "• `/selectsubnote [number]` - Select sub-note\n\n" +
                   "🤖 **AI Commands:**\n" +
                   "• `/talkai` - Start AI conversation\n\n" +
                   "⚙️ **Settings Commands:**\n" +
                   "• `/autoconfirmon` - Enable auto confirmation\n" +
                   "• `/autoconfirmoff` - Disable auto confirmation\n\n" +
                   "🔙 **Navigation Commands:**\n" +
                   "• `/back` - Go back to previous context\n\n" +
                   "💡 **Quick Examples:**\n" +
                   "• `/createnote shopping list`\n" +
                   "• `/findnote groceries`\n" +
                   "• `/findbyid 5`\n" +
                   "• `/showparents`\n\n" +
                   "ℹ️ **Note:** All command formats are supported:\n" +
                   "• Snake case: `/create_note`, `/find_note`, `/find_by_id`\n" +
                   "• Kebab case: `/create-note`, `/find-note`, `/find-by-id`\n" +
                   "• Camel case: `/createNote`, `/findNote`, `/findById`\n" +
                   "• Shortest: `/create`, `/find`, `/id`, `/parents`";
        }
        
        // Handle story content during editing mode
        if (r.action === "story_content") {
            console.log("DEBUG: formatOutcome - processing story_content action");
            var content = r.params?.content;
            if (content) {
                StateManager.addToStoryEditing(content);
                console.log("DEBUG: Added to story editing:", content);
                if (isHebrew) {
                    return "✅ הוספתי לתיאור הסיפור. המשך לכתוב או אמור 'עצור עריכת תיאור' לסיום.";
                }
                return "✅ Added to story description. Continue writing or say 'stop editing description' to finish.";
            }
            return "";
        }
        
        // Handle stop editing description
        if (r.action === "stop_editing_description") {
            var editingMode = StateManager.getStoryEditingMode();
            if (editingMode) {
                var accumulatedText = StateManager.getAccumulatedStoryText();
                if (accumulatedText.trim()) {
                    // Set pending story update for confirmation
                    StateManager.setPendingStoryUpdate(editingMode.noteId, accumulatedText);
                    StateManager.clearStoryEditingMode();
                    
                    if (isHebrew) {
                        return "האם תרצה לעדכן את התיאור של '" + editingMode.noteTitle + "' עם: '" + accumulatedText + "'? (כן/לא)";
                    }
                    return "Do you want to update the description for '" + editingMode.noteTitle + "' with: '" + accumulatedText + "'? (yes/no)";
                } else {
                    StateManager.clearStoryEditingMode();
                    if (isHebrew) {
                        return "לא נוסף תוכן לתיאור הסיפור.";
                    }
                    return "No content was added to the story description.";
                }
            }
            if (isHebrew) {
                return "לא נמצא מצב עריכת סיפור פעיל.";
            }
            return "No active story editing mode found.";
        }
        
        // Handle note selection from multiple results
        if (r.action === "note_selection") {
            console.log("DEBUG: formatOutcome - note_selection action detected");
            console.log("DEBUG: formatOutcome - r.params:", JSON.stringify(r.params));
            
            var context = StateManager.getCurrentFindContext();
            console.log("DEBUG: formatOutcome - currentFindContext:", JSON.stringify(context));
            
            if (!context || context.length === 0) {
                console.log("DEBUG: formatOutcome - no context found");
                if (isHebrew) {
                    return "לא נמצאו פתקים לבחירה. נסה לחפש קודם.";
                }
                return "No notes found to select. Try searching first.";
            }
            
            var selectionType = r.params?.selectionType;
            var value = r.params?.value;
            console.log("DEBUG: formatOutcome - selectionType='" + selectionType + "', value='" + value + "'");
            var selectedNote = null;
            
            if (selectionType === "id") {
                // Find by ID
                for (var i = 0; i < context.length; i++) {
                    var note = context[i].note || context[i];
                    if (note.id === value) {
                        selectedNote = note;
                        break;
                    }
                }
            } else if (selectionType === "title") {
                // Find by exact title match
                for (var i = 0; i < context.length; i++) {
                    var note = context[i].note || context[i];
                    if (note.title.toLowerCase() === value.toLowerCase()) {
                        selectedNote = note;
                        break;
                    }
                }
            }
            
            if (!selectedNote) {
                if (isHebrew) {
                    return "לא נמצא פתק תואם. נסה שוב עם מזהה או שם מדויק.";
                }
                return "No matching note found. Try again with ID or exact title.";
            }
            
            // Update context with selected note
            StateManager.setCurrentFindContext([selectedNote]);
            
            // Find children of the selected note
            var children = NoteManager.findNoteChildren(selectedNote.id);
            console.log("DEBUG: Selected note children:", JSON.stringify(children));
            
            // Create simple text tree representation
            var treeText = NoteManager.createNoteTree(selectedNote, children);
            console.log("DEBUG: Created tree text:", treeText);
            
            if (isHebrew) {
                return "נבחר הפתק: '" + selectedNote.title + "' (ID: " + selectedNote.id + ").\n\n" + treeText + "\n\nמה תרצה לעשות? (/editdescription /delete /createsub /markdone /talkai /selectsubnote)";
            }
            return "Selected note: '" + selectedNote.title + "' (ID: " + selectedNote.id + ").\n\n" + treeText + "\n\nWhat would you like to do? (/editdescription /delete /createsub /markdone /talkai /selectsubnote)";
        }
        
        // Handle sub-commands
        if (r.action === "find_sub_create") {
            var context = StateManager.getCurrentFindContext();
            if (!context || context.length === 0) {
                if (isHebrew) {
                    return "לא נמצאו פתקים לעבודה. נסה לחפש קודם.";
                }
                return "No notes found to work with. Try searching first.";
            }
            
            var note = context[0].note || context[0];
            // Note: setPendingSubNoteCreation is now handled in handleChatMessage before formatOutcome
            if (isHebrew) {
                return "אצור תת-פתק תחת '" + note.title + "'. מה השם של התת-פתק?";
            }
            return "I'll create a sub-note under '" + note.title + "'. What should be the name of the sub-note?";
        }
        
        if (r.action === "find_sub_edit_description") {
            var context = StateManager.getCurrentFindContext();
            if (!context || context.length === 0) {
                if (isHebrew) {
                    return "לא נמצאו פתקים לעריכה. נסה לחפש קודם.";
                }
                return "No notes found to edit. Try searching first.";
            }
            
            var note = context[0].note || context[0];
            
            // Note: setStoryEditingMode is now handled in handleChatMessage before formatOutcome
            
            if (isHebrew) {
                return "אתחיל מצב עריכת תיאור עבור '" + note.title + "'. הקלד או הקלט את התוכן החדש. לסיום אמור 'עצור עריכת תיאור'.";
            }
            return "I'll start description editing mode for '" + note.title + "'. Type or record the new content. To finish, say 'stop editing description'.";
        }
        
        if (r.action === "find_sub_delete") {
            var context = StateManager.getCurrentFindContext();
            if (!context || context.length === 0) {
                if (isHebrew) {
                    return "לא נמצאו פתקים למחיקה. נסה לחפש קודם.";
                }
                return "No notes found to delete. Try searching first.";
            }
            
            var note = context[0].note || context[0];
            // Note: setPendingNoteDeletion is now handled in handleChatMessage before formatOutcome
            if (isHebrew) {
                return "האם תרצה למחוק את הפתק '" + note.title + "'? (כן/לא)";
            }
            return "Do you want to delete the note '" + note.title + "'? (yes/no)";
        }
        
        if (r.action === "find_sub_mark_done") {
            var context = StateManager.getCurrentFindContext();
            if (!context || context.length === 0) {
                if (isHebrew) {
                    return "לא נמצאו פתקים לסימון. נסה לחפש קודם.";
                }
                return "No notes found to mark. Try searching first.";
            }
            
            var note = context[0].note || context[0];
            
            // Check if note has children and if they are all completed
            var children = NoteManager.findNoteChildren(note.id);
            if (children.length > 0 && !NoteManager.areAllChildrenCompleted(note.id)) {
                var incompleteChildren = NoteManager.getIncompleteChildren(note.id);
                var incompleteList = "";
                for (var i = 0; i < incompleteChildren.length; i++) {
                    incompleteList += (i + 1) + ". " + incompleteChildren[i].title + " (ID: " + incompleteChildren[i].id + ")\n";
                }
                
                if (isHebrew) {
                    return "לא ניתן לסמן את הפתק '" + note.title + "' כהושלם כי יש תת-פתקים שלא הושלמו:\n" + incompleteList + "\nאנא השלם את התת-פתקים קודם.";
                }
                return "Cannot mark note '" + note.title + "' as done because it has incomplete sub-notes:\n" + incompleteList + "\nPlease complete the sub-notes first.";
            }
            
            // Note: setPendingNoteMarkDone is now handled in handleChatMessage before formatOutcome
            if (isHebrew) {
                return "האם תרצה לסמן את הפתק '" + note.title + "' כהושלם? (כן/לא)";
            }
            return "Do you want to mark the note '" + note.title + "' as done? (yes/no)";
        }
        
        if (r.action === "find_sub_talk_ai") {
            var context = StateManager.getCurrentFindContext();
            if (!context || context.length === 0) {
                if (isHebrew) {
                    return "לא נמצאו פתקים לשיחה. נסה לחפש קודם.";
                }
                return "No notes found to discuss. Try searching first.";
            }
            
            var note = context[0].note || context[0];
            
            // Note: setAiConversationMode is now handled in handleChatMessage before formatOutcome
            
            if (isHebrew) {
                return "🤖 התחלתי שיחה עם AI על הפתק '" + note.title + "'. אמור 'cancel' לסיום השיחה.";
            }
            return "🤖 Started AI conversation about note '" + note.title + "'. Say 'cancel' to end the conversation.";
        }
        
        if (r.action === "find_sub_select") {
            var context = StateManager.getCurrentFindContext();
            if (!context || context.length === 0) {
                if (isHebrew) {
                    return "לא נמצאו פתקים לבחירה. נסה לחפש קודם.";
                }
                return "No notes found to select from. Try searching first.";
            }
            
            var parentNote = context[0].note || context[0];
            var subNoteId = r.params?.subNoteId;
            
            if (!subNoteId) {
                if (isHebrew) {
                    return "אנא ציין את מזהה התת-פתק. לדוגמה: /selectsubnote 2";
                }
                return "Please specify the sub-note ID. For example: /selectsubnote 2";
            }
            
            // Find the sub-note by ID
            var subNotes = NoteManager.findNoteChildren(parentNote.id);
            var selectedSubNote = null;
            
            for (var i = 0; i < subNotes.length; i++) {
                if (subNotes[i].id === subNoteId) {
                    selectedSubNote = subNotes[i];
                    break;
                }
            }
            
            if (!selectedSubNote) {
                if (isHebrew) {
                    return "לא נמצא תת-פתק עם מזהה " + subNoteId + " תחת '" + parentNote.title + "'";
                }
                return "No sub-note found with ID " + subNoteId + " under '" + parentNote.title + "'";
            }
            
            // Update context with the selected sub-note
            StateManager.setCurrentFindContext([selectedSubNote]);
            
            // Find children of the selected sub-note
            var children = NoteManager.findNoteChildren(selectedSubNote.id);
            var treeText = NoteManager.createNoteTree(selectedSubNote, children);
            
            if (isHebrew) {
                return "נבחר תת-פתק: '" + selectedSubNote.title + "' (ID: " + selectedSubNote.id + ").\n\n" + treeText + "\n\nמה תרצה לעשות? (/editdescription /delete /createsub /markdone /talkai /selectsubnote)";
            }
            return "Selected sub-note: '" + selectedSubNote.title + "' (ID: " + selectedSubNote.id + ").\n\n" + treeText + "\n\nWhat would you like to do? (/editdescription /delete /createsub /markdone /talkai /selectsubnote)";
        }
        
        // Handle cancel/abort action in find mode
        if (r.action === "cancel_action") {
            StateManager.clearCurrentFindContext();
            if (isHebrew) {
                return "פעולה בוטלה.";
            }
            return "Action cancelled.";
        }
        
        // Handle AI conversation mode
        if (r.action === "ai_conversation") {
            // AI conversation is now handled asynchronously in handleChatMessage
            // This should not be reached, but return a fallback just in case
            return "🤖 Processing your question...";
        }
        
        // Find sub-commands as slash commands
        if (r.action === "slash_editdescription") {
            return this.formatOutcome({action: "find_sub_edit_description", params: r.params, confidence: 1}, ip, id);
        }
        if (r.action === "slash_markdone") {
            return this.formatOutcome({action: "find_sub_mark_done", params: r.params, confidence: 1}, ip, id);
        }
        if (r.action === "slash_delete") {
            return this.formatOutcome({action: "find_sub_delete", params: r.params, confidence: 1}, ip, id);
        }
        if (r.action === "slash_createsub") {
            return this.formatOutcome({action: "find_sub_create", params: r.params, confidence: 1}, ip, id);
        }
        if (r.action === "slash_talkai") {
            // Note: setAiConversationMode is now handled in handleChatMessage before formatOutcome
            // Just return the confirmation message
            var context = StateManager.getCurrentFindContext();
            if (!context || context.length === 0) {
                if (isHebrew) {
                    return "לא נמצאו פתקים לשיחה עם AI. נסה לחפש קודם.";
                }
                return "No notes found for AI conversation. Try searching first.";
            }
            
            var note = context[0].note || context[0];
            // Clear context after getting the note info
            StateManager.clearCurrentFindContext();
            
            if (isHebrew) {
                return "🤖 התחלתי שיחה עם AI על הפתק '" + note.title + "'. אמור 'cancel' לסיום השיחה.";
            }
            return "🤖 Started AI conversation about note '" + note.title + "'. Say 'cancel' to end the conversation.";
        }
        if (r.action === "slash_savelastmessage") {
            // Check if we're in AI conversation mode
            var aiConversationMode = StateManager.getAiConversationMode();
            if (!aiConversationMode) {
                if (isHebrew) {
                    return "לא נמצא במצב שיחה עם AI. השתמש ב-/talkai כדי להתחיל שיחה.";
                }
                return "Not in AI conversation mode. Use /talkai to start a conversation.";
            }
            
            // Get the AI conversation note
            var aiNote = StateManager.getAiConversationNote();
            if (!aiNote) {
                if (isHebrew) {
                    return "לא נמצא פתק לשיחה עם AI.";
                }
                return "No note found for AI conversation.";
            }
            
            // Get the last AI response from conversation history
            var conversationHistory = StateManager.getAiConversationHistory();
            if (!conversationHistory || conversationHistory.length === 0) {
                if (isHebrew) {
                    return "לא נמצאו הודעות AI לשמירה.";
                }
                return "No AI messages found to save.";
            }
            
            // Get the last AI response
            var lastTurn = conversationHistory[conversationHistory.length - 1];
            var lastAiResponse = lastTurn.ai;
            
            // Create a short title from the first few words of the AI response
            var titleWords = lastAiResponse.split(' ').slice(0, 5).join(' ');
            if (titleWords.length > 50) {
                titleWords = titleWords.substring(0, 47) + "...";
            }
            
            // Add date prefix to description
            var now = new Date();
            var datePrefix = now.toLocaleDateString() + " " + now.toLocaleTimeString() + " - ";
            var description = datePrefix + lastAiResponse;
            
            // Create the sub-note
            try {
                var subNote = NoteManager.createNote(titleWords, description, aiNote.id);
                
                // Clear AI conversation mode
                StateManager.clearAiConversationMode();
                
                if (isHebrew) {
                    return "✅ שמרתי את התגובה האחרונה של AI כתת-פתק: '" + titleWords + "' (ID: " + subNote.id + ")";
                }
                return "✅ Saved last AI response as sub-note: '" + titleWords + "' (ID: " + subNote.id + ")";
            } catch (error) {
                if (isHebrew) {
                    return "❌ שגיאה בשמירת תת-הפתק: " + error.message;
                }
                return "❌ Error saving sub-note: " + error.message;
            }
        }
        if (r.action === "slash_selectsubnote") {
            return this.formatOutcome({action: "find_sub_select", params: r.params, confidence: 1}, ip, id);
        }
        
        if (r.action === "slash_stopediting") {
            // Check if we're in story editing mode
            var storyEditingMode = StateManager.getStoryEditingMode();
            if (!storyEditingMode) {
                if (isHebrew) {
                    return "לא נמצא במצב עריכת תיאור.";
                }
                return "Not in description editing mode.";
            }
            
            // Get the current story content
            var storyContent = StateManager.getStoryEditingContent();
            if (!storyContent || storyContent.trim() === "") {
                if (isHebrew) {
                    return "לא נוסף תוכן לעריכה. עריכת התיאור בוטלה.";
                }
                return "No content added for editing. Description editing cancelled.";
            }
            
            // Update the note with the new description
            var noteId = storyEditingMode.noteId;
            var note = NoteManager.findNotesById(noteId);
            if (note) {
                NoteManager.updateNoteDescription(noteId, storyContent);
                StateManager.clearStoryEditingMode();
                
                if (isHebrew) {
                    return "✅ תיאור הפתק '" + note.title + "' עודכן בהצלחה!";
                }
                return "✅ Note description for '" + note.title + "' updated successfully!";
            } else {
                StateManager.clearStoryEditingMode();
                if (isHebrew) {
                    return "❌ לא ניתן למצוא את הפתק. עריכת התיאור בוטלה.";
                }
                return "❌ Could not find the note. Description editing cancelled.";
            }
        }
        
        if (r.action === "slash_back") {
            // Clear all pending states and modes
            StateManager.clearPendingNoteCreation();
            StateManager.clearPendingNoteDeletion();
            StateManager.clearPendingNoteMarkDone();
            StateManager.clearPendingSubNoteCreation();
            StateManager.clearStoryEditingMode();
            StateManager.clearAiConversationMode();
            StateManager.clearCurrentFindContext();
            
            if (isHebrew) {
                return "✅ בוטל. חזרתי למצב רגיל.";
            }
            return "✅ Cancelled. Back to normal mode.";
        }
        
        if (r.action === "confirmation_yes") {
            // This should be handled in handleChatMessage, but just in case
            var response = this.handleConfirmationResponse(r.params?.text || "yes");
            return response || "Confirmation processed.";
        }
        
        if (r.action === "confirmation_no") {
            // This should be handled in handleChatMessage, but just in case
            var response = this.handleConfirmationResponse(r.params?.text || "no");
            return response || "Cancellation processed.";
        }
        
        if (r.action === "unknown_slash_command") {
            var command = r.params?.command || "unknown";
            if (isHebrew) {
                return "לא ידוע פקודה: " + command + ". נסה /help לרשימת פקודות זמינות.";
            }
            return "Unknown command: " + command + ". Try /help for available commands.";
        }
        
        // Handle cancel AI conversation
        if (r.action === "cancel_ai_conversation") {
            StateManager.clearAiConversationMode();
            StateManager.clearCurrentFindContext();
            if (isHebrew) {
                return "שיחה עם AI בוטלה. חזרת למצב הראשי.";
            }
            return "AI conversation cancelled. Back to main mode.";
        }
        
        // Handle sub-note name collection
        console.log("DEBUG: formatOutcome - processing sub_note_name action");
        if (r.action === "sub_note_name") {
            var pendingSubNote = StateManager.getPendingSubNoteCreation();
            if (!pendingSubNote) {
                if (isHebrew) {
                    return "לא נמצאה פעולת יצירת תת-פתק ממתינה.";
                }
                return "No pending sub-note creation found.";
            }
            
            var subNoteName = r.params?.name || "untitled";
            // Set pending note creation for confirmation
            StateManager.setPendingNoteCreation(subNoteName, pendingSubNote.parentNoteId);
            StateManager.clearPendingSubNoteCreation();
            StateManager.clearCurrentFindContext();
            
            // Note: Auto confirmation is now handled in handleChatMessage before formatOutcome
            
            if (isHebrew) {
                return "האם תרצה ליצור תת-פתק בשם '" + subNoteName + "'? (כן/לא)";
            }
            return "Do you want to create a sub-note with title '" + subNoteName + "'? (yes/no)";
        }
        
        if (isHebrew) {
            return "הבנתי את הבקשה שלך ואני מעבד אותה.";
        }
        return "I understood your request and I'm processing it.";
    },
    
    // -------- File Picker Request Handler --------
    handleFilePickerRequest: function(o, ip, id) {
        console.log("DEBUG: File picker request received for note:", o.noteId);
        
        try {
            // Use ImageManager to show the native file picker
            ImageManager.showImageUploadDialog(o.noteId, function(error, imagePath) {
                if (error) {
                    console.log("DEBUG: File picker error:", error);
                    this.sendToClient({ 
                        type: "reply", 
                        text: "File selection cancelled: " + error 
                    }, ip, id);
                } else {
                    console.log("DEBUG: File selected:", imagePath);
                    // Send the selected file back to the frontend
                    this.sendToClient({ 
                        type: "file_selected", 
                        imagePath: imagePath,
                        noteId: o.noteId
                    }, ip, id);
                }
            }.bind(this));
        } catch (e) {
            console.log("DEBUG: Error in file picker request:", e.message);
            this.sendToClient({ 
                type: "reply", 
                text: "Error opening file picker: " + e.message 
            }, ip, id);
        }
    },
    
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketHandler;
}
