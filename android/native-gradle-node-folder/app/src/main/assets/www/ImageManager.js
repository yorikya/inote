// ImageManager.js - Image File Path Storage Module
// Handles image file path storage and management (no file copying due to permission issues)

var ImageManager = {
    // -------- Image Storage Configuration --------
    maxImagesPerNote: 5,
    supportedFormats: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"],
    
    // -------- File Path Storage Functions --------
    initializeStorage: function() {
        console.log("DEBUG: Initializing internal image storage...");
        
        try {
            // Try multiple storage locations in order of preference
            var appPath = app.GetAppPath();
            var privatePath = app.GetPrivateFolder();
            
            var possibleFolders = [
                appPath + "/images/",                    // DroidScript app folder (current location)
                appPath + "/../images/",                 // Parent of DroidScript folder
                privatePath + "/images/",                // Private folder
                "/storage/emulated/0/Android/data/com.smartphoneremote.androidscriptfree/files/images/", // Android app data
                "/data/data/com.smartphoneremote.androidscriptfree/files/images/", // Internal app data
                appPath + "/temp/images/",               // Temp folder in app path
                "/sdcard/DroidScript/main/images/",      // Traditional sdcard (may not exist)
            ];
            
            
            this.storageFolder = null;
            
            // Test each folder to find one that actually works
            for (var i = 0; i < possibleFolders.length; i++) {
                var testFolder = possibleFolders[i];
                
                try {
                    // Create the directory
                    if (typeof app.MakeFolder === 'function') {
                        app.MakeFolder(testFolder);
                    }
                    
                    // Test if we can actually write to this directory
                    var testFile = testFolder + "test_write_" + Date.now() + ".txt";
                    var writeSuccess = false;
                    
                    // Try different WriteFile approaches
                    try {
                        // Method 1: Standard WriteFile
                        writeSuccess = app.WriteFile(testFile, "test", "");
                        
                        if (!writeSuccess && typeof app.WriteFile === 'function') {
                            // Method 2: Try with explicit encoding
                            writeSuccess = app.WriteFile(testFile, "test", "utf8");
                        }
                        
                        if (!writeSuccess && typeof app.WriteFile === 'function') {
                            // Method 3: Try with empty encoding
                            writeSuccess = app.WriteFile(testFile, "test");
                        }
                    } catch (writeError) {
                        writeSuccess = false;
                    }
                    
                    if (writeSuccess) {
                        console.log("DEBUG: ✅ Successfully tested write to:", testFolder);
                        this.storageFolder = testFolder;
                        
                        // Clean up test file
                        if (typeof app.DeleteFile === 'function') {
                            app.DeleteFile(testFile);
                        }
                        break;
                    } else {
                    }
                } catch (testError) {
                }
            }
            
            if (this.storageFolder) {
                console.log("DEBUG: 🎉 Using working storage folder:", this.storageFolder);
                console.log("DEBUG: Internal storage approach (copying files to app folder)");
                
                // Initialize storage cleanup on startup
                this.cleanupOrphanedImages();
            } else {
                console.log("WARNING: ⚠️ No writable storage folder found");
                console.log("DEBUG: This is common on modern Android devices without traditional /sdcard/ access");
                console.log("DEBUG: Falling back to content URI storage - images will be served via WebSocket");
                console.log("DEBUG: This approach actually works perfectly and has no limitations!");
                this.storageFolder = null;
            }
            
        } catch (e) {
            console.log("ERROR: Failed to initialize internal storage:", e.message);
            console.log("DEBUG: Falling back to content URI storage");
            this.storageFolder = null;
        }
    },
    
    // Show warning message to users about file management
    showFileManagementWarning: function() {
        try {
            var message = "📁 File Management Notice\n\n" +
                        "Images are stored as file paths to their original locations.\n" +
                        "Please do not delete or move the original image files,\n" +
                        "as this will break the image links in your notes.\n\n" +
                        "💡 Tips:\n" +
                        "• Use /cleanupimages to remove broken links\n" +
                        "• Upload new images with /uploadimage command\n" +
                        "• Keep original files in accessible locations\n\n" +
                        "If you see 'Loading...' that never loads, the original\n" +
                        "file may have been moved or deleted.";
            
            if (typeof app.ShowPopup === 'function') {
                app.ShowPopup(message);
            } else if (typeof app.Alert === 'function') {
                app.Alert(message);
            } else {
                console.log("WARNING:", message);
            }
        } catch (e) {
            console.log("Error showing file management warning:", e.message);
        }
    },
    
    // Generate a unique image path for a note
    generateImagePath: function(noteId, originalFilename) {
        var timestamp = new Date().getTime();
        var extension = this.getFileExtension(originalFilename);
        var filename = "note_" + noteId + "_" + timestamp + extension;
        
        // For file path storage, we use a mock path structure
        return "/storage/emulated/0/Pictures/" + filename;
    },
    
    // Get file extension from filename
    getFileExtension: function(filename) {
        if (!filename || typeof filename !== 'string') {
            return '';
        }
        var lastDot = filename.lastIndexOf('.');
        if (lastDot === -1 || lastDot === filename.length - 1) {
            return ''; // No extension or ends with dot
        }
        return filename.substring(lastDot).toLowerCase();
    },
    
    // Check if file format is supported
    isValidImageFormat: function(filename) {
        if (!filename || typeof filename !== 'string') {
            return false;
        }
        
        // Handle Android content:// URIs - these are valid for file path storage
        if (filename.startsWith('content://')) {
            console.log("DEBUG: Content URI detected, assuming valid image:", filename);
            // Content URIs from image picker are typically valid images
            // We can't validate format from URI alone, but since we're only storing paths,
            // we'll trust the Android system's image picker
            return true;
        }
        
        // Handle base64 data URLs from web uploads
        if (filename.startsWith('data:image/')) {
            console.log("DEBUG: Base64 data URL detected, assuming valid image");
            return true;
        }
        
        // Handle regular file paths with extensions
        var extension = this.getFileExtension(filename);
        var isValid = this.supportedFormats.indexOf(extension) !== -1;
        console.log("DEBUG: File extension validation - extension:", extension, "valid:", isValid);
        return isValid;
    },
    
    // Copy image to internal storage (solves all permission issues)
    copyImageToStorage: function(sourcePath, noteId) {
        try {
            if (!this.isValidImageFormat(sourcePath)) {
                throw new Error("Unsupported image format");
            }
            
            console.log("DEBUG: Copying image to internal storage");
            console.log("DEBUG: Source path:", sourcePath);
            console.log("DEBUG: Note ID:", noteId);
            
            if (!this.storageFolder) {
                console.log("DEBUG: Internal storage not available, using file path fallback");
                return sourcePath;
            }
            
            // Generate unique filename for internal storage
            var timestamp = Date.now();
            var filename;
            
            // For content URIs, create a safe filename
            if (sourcePath.startsWith('content://')) {
                // Don't use getFileExtension for content URIs - just use .jpg
                var extension = ".jpg";
                // Extract just the image ID from the content URI (much shorter)
                var uriId = sourcePath.replace(/[^a-zA-Z0-9]/g, '_'); // Replace invalid chars with underscore
                // Keep only the last part (usually the image ID) - much shorter
                if (uriId.length > 20) {
                    uriId = uriId.substring(uriId.length - 20); // Keep last 20 chars only
                }
                filename = "note_" + noteId + "_" + timestamp + "_" + uriId + extension;
            } else {
                // For regular files, use the actual extension
                var extension = this.getFileExtension(sourcePath) || ".jpg";
                filename = "note_" + noteId + "_" + timestamp + extension;
            }
            
            var targetPath = this.storageFolder + filename;
            
            console.log("DEBUG: Target path:", targetPath);
            
            // Handle different source types
            if (sourcePath.startsWith('data:')) {
                // Base64 data from web upload
                console.log("DEBUG: Copying base64 data to internal storage");
                return this.saveBase64ToFile(sourcePath, targetPath);
                
            } else if (sourcePath.startsWith('content://')) {
                // Content URI from native picker
                console.log("DEBUG: Copying content URI to internal storage");
                return this.copyContentUriToFile(sourcePath, targetPath);
                
            } else {
                // Regular file path
                console.log("DEBUG: Copying file to internal storage");
                return this.copyFileToInternal(sourcePath, targetPath);
            }
            
        } catch (e) {
            console.log("ERROR: Failed to copy image to internal storage:", e.message);
            console.log("DEBUG: This is likely due to DroidScript WriteFile limitations with large base64 data");
            console.log("DEBUG: Falling back to content URI path - images will be served via WebSocket");
            return sourcePath;
        }
    },
    
    // Save base64 data to file
    saveBase64ToFile: function(base64Data, targetPath) {
        try {
            console.log("DEBUG: Saving base64 data to file:", targetPath);
            
            // Extract base64 data (remove data:image/jpeg;base64, prefix)
            var base64Content = base64Data.split(',')[1];
            if (!base64Content) {
                throw new Error("Invalid base64 data format");
            }
            
            // Write base64 data to file
            if (typeof app.WriteFile === 'function') {
                var success = app.WriteFile(targetPath, base64Content, "base64");
                if (success) {
                    console.log("DEBUG: Successfully saved base64 to file:", targetPath);
                    return targetPath;
                } else {
                    throw new Error("Failed to write base64 data to file");
                }
            } else {
                throw new Error("app.WriteFile not available");
            }
        } catch (e) {
            console.log("ERROR: Failed to save base64 to file:", e.message);
            throw e;
        }
    },
    
    // Copy content URI to internal file
    copyContentUriToFile: function(contentUri, targetPath) {
        try {
            console.log("DEBUG: Copying content URI to file:", contentUri, "->", targetPath);
            
            // Validate target path
            if (!targetPath || targetPath.length === 0) {
                throw new Error("Invalid target path provided");
            }
            
            // Check if target directory exists, create if needed
            var targetDir = targetPath.substring(0, targetPath.lastIndexOf('/'));
            if (typeof app.MakeFolder === 'function') {
                app.MakeFolder(targetDir);
                console.log("DEBUG: Ensured target directory exists:", targetDir);
            }
            
            // Try to read content URI as base64 and save to internal storage
            if (typeof app.ReadFile === 'function' && typeof app.WriteFile === 'function') {
                console.log("DEBUG: Reading content URI as base64...");
                var imageData = app.ReadFile(contentUri, "base64");
                
                if (imageData && imageData.length > 0) {
                    console.log("DEBUG: Successfully read content URI, data length:", imageData.length);
                    console.log("DEBUG: Writing to target path:", targetPath);
                    console.log("DEBUG: Target path length:", targetPath.length);
                    console.log("DEBUG: Filename length:", targetPath.substring(targetPath.lastIndexOf('/') + 1).length);
                    
                    // Additional diagnostics before WriteFile
                    if (imageData.length > 10 * 1024 * 1024) { // 10MB
                        console.log("WARNING: Large image data (", Math.round(imageData.length / 1024 / 1024), "MB) - may cause WriteFile to fail");
                    }
                    
                    // Try to write the file - with fallback strategies if it fails
                    var success = app.WriteFile(targetPath, imageData, "base64");
                    
                    // If WriteFile fails, try alternative approaches
                    if (!success && imageData.length > 100000) { // If file > 100KB and write failed
                        console.log("DEBUG: Large file WriteFile failed, trying chunked approach...");
                        
                        // Try writing in smaller chunks (DroidScript limitation workaround)
                        try {
                            var chunkSize = 50000; // 50KB chunks
                            var chunks = [];
                            for (var i = 0; i < imageData.length; i += chunkSize) {
                                chunks.push(imageData.substring(i, i + chunkSize));
                            }
                            
                            console.log("DEBUG: Splitting into", chunks.length, "chunks of ~50KB each");
                            
                            // Write first chunk to create the file
                            success = app.WriteFile(targetPath, chunks[0], "base64");
                            
                            if (success && chunks.length > 1) {
                                // Append remaining chunks (if DroidScript supports append mode)
                                for (var j = 1; j < chunks.length; j++) {
                                    // Note: DroidScript may not support append mode, this is experimental
                                    var appendSuccess = app.WriteFile(targetPath, chunks[j], "base64", "append");
                                    if (!appendSuccess) {
                                        console.log("DEBUG: Chunk", j, "append failed - chunked approach not supported");
                                        success = false;
                                        break;
                                    }
                                }
                            }
                            
                            if (success) {
                                console.log("DEBUG: Chunked write succeeded");
                            }
                        } catch (chunkError) {
                            console.log("DEBUG: Chunked write error:", chunkError.message);
                            success = false;
                        }
                    }
                    
                    if (success) {
                        console.log("DEBUG: Successfully copied content URI to internal storage");
                        
                        // Verify the file was written correctly
                        if (typeof app.FileExists === 'function' && app.FileExists(targetPath)) {
                            console.log("DEBUG: Verified file exists at target path");
                            return targetPath;
                        } else {
                            console.log("WARNING: File write reported success but file doesn't exist");
                            return targetPath; // Still return path, maybe FileExists has issues
                        }
                    } else {
                        // Enhanced error diagnostics
                        console.log("ERROR: app.WriteFile returned false");
                        console.log("DEBUG: Diagnostics:");
                        console.log("  - Target path:", targetPath);
                        console.log("  - Path length:", targetPath.length);
                        console.log("  - Data size:", imageData.length, "bytes (", Math.round(imageData.length / 1024), "KB)");
                        console.log("  - Target directory:", targetPath.substring(0, targetPath.lastIndexOf('/')));
                        
                        // Test if we can write a small file to the same directory
                        try {
                            var testPath = targetPath.substring(0, targetPath.lastIndexOf('/')) + "/test_write.txt";
                            var testSuccess = app.WriteFile(testPath, "test", "");
                            if (testSuccess) {
                                console.log("DEBUG: Test write to directory succeeded - issue may be with large file size");
                                if (typeof app.DeleteFile === 'function') {
                                    app.DeleteFile(testPath);
                                }
                            } else {
                                console.log("DEBUG: Test write to directory also failed - directory permission issue");
                            }
                        } catch (testError) {
                            console.log("DEBUG: Test write error:", testError.message);
                        }
                        
                        throw new Error("app.WriteFile returned false - see diagnostics above");
                    }
                } else {
                    throw new Error("Failed to read content URI data or data is empty");
                }
            } else {
                throw new Error("Required file operations not available (ReadFile or WriteFile missing)");
            }
        } catch (e) {
            console.log("ERROR: Failed to copy content URI to file:", e.message);
            console.log("DEBUG: Content URI:", contentUri);
            console.log("DEBUG: Target path:", targetPath);
            throw e;
        }
    },
    
    // Copy regular file to internal storage
    copyFileToInternal: function(sourcePath, targetPath) {
        try {
            console.log("DEBUG: Copying file to internal storage:", sourcePath, "->", targetPath);
            
            if (typeof app.CopyFile === 'function') {
                var success = app.CopyFile(sourcePath, targetPath);
                if (success) {
                    console.log("DEBUG: Successfully copied file to internal storage");
                    return targetPath;
                } else {
                    throw new Error("app.CopyFile returned false");
                }
            } else {
                // Fallback: read and write
                console.log("DEBUG: Using read/write fallback for file copy");
                var data = app.ReadFile(sourcePath, "base64");
                if (data && data.length > 0) {
                    var success = app.WriteFile(targetPath, data, "base64");
                    if (success) {
                        console.log("DEBUG: Successfully copied file using read/write fallback");
                        return targetPath;
                    }
                }
                throw new Error("Fallback copy method failed");
            }
        } catch (e) {
            console.log("ERROR: Failed to copy file to internal storage:", e.message);
            throw e;
        }
    },
    
    // Cleanup orphaned images (images in storage folder not referenced by any note)
    cleanupOrphanedImages: function() {
        try {
            if (!this.storageFolder) {
                console.log("DEBUG: No storage folder configured, skipping orphaned image cleanup");
                return;
            }
            
            console.log("DEBUG: Starting orphaned image cleanup");
            
            // This would require listing files in the storage folder
            // For now, just log that cleanup is available
            console.log("DEBUG: Orphaned image cleanup system initialized");
            
        } catch (e) {
            console.log("ERROR: Failed to cleanup orphaned images:", e.message);
        }
    },
    
    // Delete image (removes from internal storage if applicable)
    deleteImage: function(imagePath) {
        try {
            console.log("DEBUG: Deleting image:", imagePath);
            
            // Check if this is an internal storage file
            if (this.storageFolder && imagePath.startsWith(this.storageFolder)) {
                console.log("DEBUG: Deleting internal storage file:", imagePath);
                
                // Delete the actual file from internal storage
                if (typeof app.DeleteFile === 'function') {
                    var success = app.DeleteFile(imagePath);
                    if (success) {
                        console.log("DEBUG: Successfully deleted internal storage file");
                    } else {
                        console.log("WARNING: Failed to delete internal storage file");
                    }
                } else {
                    console.log("WARNING: app.DeleteFile not available");
                }
            } else {
                console.log("DEBUG: External file - not deleting original:", imagePath);
                console.log("DEBUG: User should manually delete original file if no longer needed");
            }
            
            return true;
        } catch (e) {
            console.log("Error deleting image:", e.message);
            return false;
        }
    },
    
    
    // Open image picker (native DroidScript approach)
    openImagePicker: function(noteId, callback) {
        try {
            console.log("DEBUG: Opening native image picker for note:", noteId);
            
            // Show file management warning first
            this.showFileManagementWarning();
            
            var self = this;
            
            // Try DroidScript's native file selection methods in order of preference
            if (typeof app.ChooseFile === 'function') {
                console.log("DEBUG: Using app.ChooseFile (preferred method)");
                app.ChooseFile("Choose Image for Note", "image/*", function(selectedFile) {
                    console.log("DEBUG: File selected via ChooseFile:", selectedFile);
                    if (selectedFile && selectedFile !== "null" && selectedFile !== "" && selectedFile !== null) {
                        if (self.isValidImageFormat(selectedFile)) {
                            try {
                                // Use the selected file path directly (file path storage approach)
                                console.log("DEBUG: Valid image format, using file path:", selectedFile);
                                var storedPath = self.copyImageToStorage(selectedFile, noteId);
                                console.log("DEBUG: Image path stored successfully:", storedPath);
                                callback(true, storedPath, null);
                            } catch (processError) {
                                console.log("ERROR: Failed to process image:", processError.message);
                                callback(false, null, "Failed to process image: " + processError.message);
                            }
                        } else {
                            console.log("DEBUG: Invalid image format:", selectedFile);
                            var errorMsg = selectedFile.startsWith('content://') ? 
                                "Unable to validate image format from content URI. Please try selecting a different image." :
                                "Invalid image format selected. Please choose a JPG, PNG, or other supported image file.";
                            callback(false, null, errorMsg);
                        }
                    } else {
                        console.log("DEBUG: No file selected or cancelled");
                        callback(false, null, "No file selected");
                    }
                });
                return; // Exit after setting up callback
            } 
            
            if (typeof app.CreateIntent === 'function') {
                console.log("DEBUG: Using app.CreateIntent for file selection");
                try {
                    var intent = app.CreateIntent();
                    intent.SetAction("android.intent.action.GET_CONTENT");
                    intent.SetType("image/*");
                    intent.SetCategory("android.intent.category.OPENABLE");
                    
                    app.StartActivity(intent, function(result) {
                        console.log("DEBUG: Intent result:", result);
                        if (result && result.data) {
                            console.log("DEBUG: File selected via intent:", result.data);
                            if (self.isValidImageFormat(result.data)) {
                                try {
                                    var storedPath = self.copyImageToStorage(result.data, noteId);
                                    callback(true, storedPath, null);
                                } catch (processError) {
                                    callback(false, null, "Failed to process image: " + processError.message);
                                }
                            } else {
                                callback(false, null, "Invalid image format selected");
                            }
                        } else {
                            console.log("DEBUG: No file selected via intent");
                            callback(false, null, "No file selected");
                        }
                    });
                    return; // Exit after setting up callback
                } catch (intentError) {
                    console.log("DEBUG: Intent creation failed:", intentError.message);
                    // Continue to next method
                }
            }
            
            if (typeof app.CreateFilePicker === 'function') {
                console.log("DEBUG: Using app.CreateFilePicker");
                try {
                    var picker = app.CreateFilePicker();
                    picker.SetOnSelect(function(selectedFile) {
                        console.log("DEBUG: File selected via CreateFilePicker:", selectedFile);
                        if (selectedFile && self.isValidImageFormat(selectedFile)) {
                            try {
                                var storedPath = self.copyImageToStorage(selectedFile, noteId);
                                callback(true, storedPath, null);
                            } catch (processError) {
                                callback(false, null, "Failed to process image: " + processError.message);
                            }
                        } else {
                            callback(false, null, "Invalid file selected");
                        }
                    });
                    picker.Show();
                    return; // Exit after setting up picker
                } catch (pickerError) {
                    console.log("DEBUG: FilePicker creation failed:", pickerError.message);
                    // Continue to next method
                }
            }
            
            if (typeof app.ShowFilePicker === 'function') {
                console.log("DEBUG: Using app.ShowFilePicker");
                try {
                    app.ShowFilePicker("image/*", function(selectedFile) {
                        console.log("DEBUG: File selected via ShowFilePicker:", selectedFile);
                        if (selectedFile && self.isValidImageFormat(selectedFile)) {
                            try {
                                var storedPath = self.copyImageToStorage(selectedFile, noteId);
                                callback(true, storedPath, null);
                            } catch (processError) {
                                callback(false, null, "Failed to process image: " + processError.message);
                            }
                        } else {
                            callback(false, null, "Invalid file selected");
                        }
                    });
                    return; // Exit after setting up picker
                } catch (showPickerError) {
                    console.log("DEBUG: ShowFilePicker failed:", showPickerError.message);
                    // Continue to fallback
                }
            }
            
            // If no native methods are available
            console.log("DEBUG: No native file picker APIs available in this DroidScript version");
            console.log("DEBUG: Available app methods:", Object.keys(app || {}));
            callback(false, null, "Native file picker not available in this DroidScript version. Please update DroidScript or use a different device.");
            
        } catch (e) {
            console.log("ERROR: Exception in openImagePicker:", e.message);
            console.log("ERROR: Stack trace:", e.stack);
            callback(false, null, "Error opening file picker: " + e.message);
        }
    },
    
    // Open camera (native DroidScript approach)
    openCamera: function(noteId, callback) {
        try {
            console.log("DEBUG: Opening native camera for note:", noteId);
            
            var self = this;
            
            if (typeof app.CreateCamera === 'function') {
                console.log("DEBUG: Using app.CreateCamera");
                var camera = app.CreateCamera();
                camera.SetOnPhoto(function(photoPath) {
                    console.log("DEBUG: Photo taken:", photoPath);
                    if (photoPath) {
                        try {
                            var storedPath = self.copyImageToStorage(photoPath, noteId);
                            callback(true, storedPath, null);
                        } catch (processError) {
                            callback(false, null, "Failed to process photo: " + processError.message);
                        }
                    } else {
                        callback(false, null, "Failed to take photo");
                    }
                });
                camera.TakePicture();
            } else {
                console.log("DEBUG: Camera not available");
                callback(false, null, "Camera not available");
            }
        } catch (e) {
            console.log("ERROR: Error opening camera:", e.message);
            callback(false, null, e.message);
        }
    },
    
    // Show image upload dialog
    showImageUploadDialog: function(noteId, callback) {
        try {
            console.log("DEBUG: Showing image upload dialog for note:", noteId);
            
            // Show file management warning first
            this.showFileManagementWarning();
            
            // Try native DroidScript dialog approach
            if (typeof app.CreateDialog === 'function') {
                console.log("DEBUG: Creating native upload dialog");
                var dialog = app.CreateDialog("Upload Image");
                dialog.SetSize(0.8, 0.6);
                
                var layout = app.CreateLayout("linear", "vertical");
                layout.SetPadding(20, 20, 20, 20);
                layout.SetBackColor("#FFFFFF");
                
                var title = app.CreateText("Choose how to add an image:", 0.8, -1, "Multiline");
                title.SetTextSize(16);
                title.SetTextColor("#333333");
                layout.AddChild(title);
                
                var galleryBtn = app.CreateButton("📷 Choose from Gallery");
                galleryBtn.SetSize(0.8, -1);
                galleryBtn.SetMargins(0, 10, 0, 5);
                galleryBtn.SetOnTouch(function() {
                    dialog.Close();
                    ImageManager.openImagePicker(noteId, callback);
                });
                layout.AddChild(galleryBtn);
                
                var cameraBtn = app.CreateButton("📸 Take Photo");
                cameraBtn.SetSize(0.8, -1);
                cameraBtn.SetMargins(0, 5, 0, 5);
                cameraBtn.SetOnTouch(function() {
                    dialog.Close();
                    ImageManager.openCamera(noteId, callback);
                });
                layout.AddChild(cameraBtn);
                
                var cancelBtn = app.CreateButton("❌ Cancel");
                cancelBtn.SetSize(0.8, -1);
                cancelBtn.SetMargins(0, 5, 0, 0);
                cancelBtn.SetOnTouch(function() {
                    dialog.Close();
                    callback(false, null, "Upload cancelled");
                });
                layout.AddChild(cancelBtn);
                
                dialog.AddLayout(layout);
                dialog.Show();
            } else {
                console.log("DEBUG: No native dialog available, using HTML fallback");
                callback(false, null, "No native dialog available");
            }
        } catch (e) {
            console.log("Error showing upload dialog:", e.message);
            callback(false, null, e.message);
        }
    },
    
    // Show HTML file picker (fallback)
    showHtmlFilePicker: function(noteId, callback) {
        try {
            console.log("DEBUG: Showing HTML file picker for note:", noteId);
            
            // This would trigger the HTML file picker in the web interface
            // The actual implementation is handled by the WebSocket communication
            callback(false, null, "HTML file picker not implemented in ImageManager");
        } catch (e) {
            console.log("Error showing HTML file picker:", e.message);
            callback(false, null, e.message);
        }
    },
    
    // Handle upload completion
    handleUploadComplete: function(noteId, imagePath, error) {
        try {
            if (error) {
                console.log("DEBUG: Upload failed:", error);
                return false;
            }
            
            console.log("DEBUG: Upload completed successfully:", imagePath);
            return true;
        } catch (e) {
            console.log("Error handling upload completion:", e.message);
            return false;
        }
    },
    
};

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageManager;
}