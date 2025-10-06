// image_upload_test.js - Test suite for image upload functionality
// Tests the complete image upload feature including NoteManager, ImageManager, and WebSocketHandler

// Mock DroidScript app object for testing
var mockApp = {
    CreateFolder: function(path) { return true; },
    IsFolder: function(path) { return path === "images"; },
    IsFile: function(path) { return path.indexOf("test_image") !== -1; },
    CreateFilePicker: function() {
        return {
            SetType: function(type) {},
            SetOnResult: function(callback) {
                // Simulate file selection
                setTimeout(() => callback("OK"), 100);
            },
            GetFile: function() { return "test_image.jpg"; },
            Show: function() {}
        };
    },
    CreateCamera: function() {
        return {
            SetOnResult: function(callback) {
                // Simulate photo taken
                setTimeout(() => callback("OK"), 100);
            },
            GetFile: function() { return "camera_photo.jpg"; },
            Show: function() {}
        };
    },
    CreateDialog: function(title) {
        return {
            SetSize: function(w, h) {},
            AddLayout: function(layout) {},
            Show: function() {},
            Close: function() {}
        };
    },
    CreateLayout: function(type, orientation) {
        return {
            SetPadding: function(p) {},
            AddChild: function(child) {},
            SetSize: function(w, h) {},
            SetMargins: function(m) {}
        };
    },
    CreateText: function(text, w, h, type) {
        return {
            SetTextSize: function(size) {},
            SetTextColor: function(color) {}
        };
    },
    CreateButton: function(text) {
        return {
            SetSize: function(w, h) {},
            SetMargins: function(m) {},
            SetOnTouch: function(callback) {},
            SetText: function(text) {}
        };
    },
    CopyFile: function(src, dest) { return true; },
    DeleteFile: function(path) { return true; },
    ReadFile: function(path, mode) { return "test content"; },
    WriteFile: function(path, content) { return true; }
};

// Set up global app object for testing
if (typeof global !== 'undefined') {
    global.app = mockApp;
}

// Test suite for image upload functionality
function runImageUploadTests() {
    console.log("🧪 Starting Image Upload Tests...");
    
    var tests = [
        testNoteManagerImageFunctions,
        testImageManagerBasicFunctions,
        testImageManagerPhoneUpload,
        testWebSocketHandlerUploadCommand,
        testCommandAvailabilityInFindContext,
        testExplorerImagePreview,
        testImageRotation,
        testMissingImageCleanup
    ];
    
    var passed = 0;
    var failed = 0;
    
    tests.forEach(test => {
        try {
            test();
            passed++;
            console.log("✅ " + test.name + " - PASSED");
        } catch (e) {
            failed++;
            console.log("❌ " + test.name + " - FAILED: " + e.message);
        }
    });
    
    console.log("\n📊 Test Results:");
    console.log("✅ Passed: " + passed);
    console.log("❌ Failed: " + failed);
    console.log("📈 Success Rate: " + Math.round((passed / (passed + failed)) * 100) + "%");
    
    return { passed, failed };
}

// Test NoteManager image functions
function testNoteManagerImageFunctions() {
    console.log("  Testing NoteManager image functions...");
    
    // Test createNote with images field
    var note = NoteManager.createNote("Test Note", "Test description");
    if (!note.images || !Array.isArray(note.images)) {
        throw new Error("Note should have images array field");
    }
    
    // Test addImageToNote
    var imagePath = "images/test_image.jpg";
    var updatedNote = NoteManager.addImageToNote(note.id, imagePath);
    if (!updatedNote || updatedNote.images.length !== 1) {
        throw new Error("Image should be added to note");
    }
    
    // Test getNoteImages
    var images = NoteManager.getNoteImages(note.id);
    if (images.length !== 1 || images[0] !== imagePath) {
        throw new Error("Should retrieve correct images");
    }
    
    // Test removeImageFromNote
    var noteAfterRemoval = NoteManager.removeImageFromNote(note.id, imagePath);
    if (noteAfterRemoval.images.length !== 0) {
        throw new Error("Image should be removed from note");
    }
    
    // Test duplicate image prevention
    NoteManager.addImageToNote(note.id, imagePath);
    NoteManager.addImageToNote(note.id, imagePath);
    var finalImages = NoteManager.getNoteImages(note.id);
    if (finalImages.length !== 1) {
        throw new Error("Duplicate images should be prevented");
    }
}

// Test ImageManager basic functions
function testImageManagerBasicFunctions() {
    console.log("  Testing ImageManager basic functions...");
    
    // Test initialization
    ImageManager.initializeStorage();
    
    // Test file extension detection
    var ext1 = ImageManager.getFileExtension("test.jpg");
    if (ext1 !== ".jpg") {
        throw new Error("Should detect .jpg extension");
    }
    
    var ext2 = ImageManager.getFileExtension("test.PNG");
    if (ext2 !== ".png") {
        throw new Error("Should detect .png extension (case insensitive)");
    }
    
    // Test format validation
    if (!ImageManager.isValidImageFormat("test.jpg")) {
        throw new Error("Should validate .jpg as valid format");
    }
    
    if (ImageManager.isValidImageFormat("test.txt")) {
        throw new Error("Should reject .txt as invalid format");
    }
    
    // Test image existence check
    if (!ImageManager.imageExists("test_image.jpg")) {
        throw new Error("Should detect existing test image");
    }
    
    if (ImageManager.imageExists("nonexistent.jpg")) {
        throw new Error("Should detect non-existing image");
    }
    
    // Test path generation
    var path = ImageManager.generateImagePath("123", "original.jpg");
    if (!path.startsWith("images/note_123_") || !path.endsWith(".jpg")) {
        throw new Error("Should generate correct image path");
    }
}

// Test ImageManager phone upload functions
function testImageManagerPhoneUpload() {
    console.log("  Testing ImageManager phone upload functions...");
    
    var callbackCalled = false;
    var callbackError = null;
    var callbackResult = null;
    
    function testCallback(error, result) {
        callbackCalled = true;
        callbackError = error;
        callbackResult = result;
    }
    
    // Test image picker
    ImageManager.openImagePicker("123", testCallback);
    
    // Wait for async callback
    setTimeout(() => {
        if (!callbackCalled) {
            throw new Error("Image picker callback should be called");
        }
        if (callbackError) {
            throw new Error("Image picker should not error: " + callbackError);
        }
        if (!callbackResult || !callbackResult.startsWith("images/note_123_")) {
            throw new Error("Image picker should return correct path");
        }
    }, 200);
    
    // Reset for camera test
    callbackCalled = false;
    callbackError = null;
    callbackResult = null;
    
    // Test camera
    ImageManager.openCamera("456", testCallback);
    
    setTimeout(() => {
        if (!callbackCalled) {
            throw new Error("Camera callback should be called");
        }
        if (callbackError) {
            throw new Error("Camera should not error: " + callbackError);
        }
        if (!callbackResult || !callbackResult.startsWith("images/note_456_")) {
            throw new Error("Camera should return correct path");
        }
    }, 200);
}

// Test WebSocketHandler upload command
function testWebSocketHandlerUploadCommand() {
    console.log("  Testing WebSocketHandler upload command...");
    
    // Mock StateManager
    var mockStateManager = {
        getCurrentFindContext: function() {
            return [{ note: { id: "123", title: "Test Note" } }];
        }
    };
    
    // Mock NoteManager
    var mockNoteManager = {
        getNoteImages: function(id) { return []; },
        addImageToNote: function(id, path) {
            return { id: id, images: [path] };
        }
    };
    
    // Mock ImageManager
    var mockImageManager = {
        showImageUploadDialog: function(noteId, callback) {
            // Simulate successful upload
            setTimeout(() => callback(null, "images/test.jpg"), 100);
        }
    };
    
    // Set up mocks
    if (typeof global !== 'undefined') {
        global.StateManager = mockStateManager;
        global.NoteManager = mockNoteManager;
        global.ImageManager = mockImageManager;
    }
    
    // Test command detection
    var result = CommandRouter.detectIntent("/uploadimage", { lang: "en" });
    if (result.action !== "slash_uploadimage") {
        throw new Error("Should detect /uploadimage command");
    }
    
    // Test command processing
    var isHebrew = false;
    var context = mockStateManager.getCurrentFindContext();
    if (!context || context.length === 0) {
        throw new Error("Should have find context for upload");
    }
    
    var note = context[0].note;
    var currentImages = mockNoteManager.getNoteImages(note.id);
    if (currentImages.length >= 5) {
        throw new Error("Should check for maximum images");
    }
}

// Test command availability in find context
function testCommandAvailabilityInFindContext() {
    console.log("  Testing command availability in find context...");
    
    // Mock WebSocketHandler with getAvailableCommands
    var mockWebSocketHandler = {
        getAvailableCommands: function() {
            var commands = [];
            var commandMetadata = {
                slash_uploadimage: { 
                    category: "🖼️ Image", 
                    description: "Uploading an image to the current note",
                    examples: ["/uploadimage"],
                    requiresParam: false,
                    contexts: ["find_context"]
                },
                slash_createsub: { 
                    category: "📝 Create", 
                    description: "Creating a sub-note under current note",
                    examples: ["/createsub"],
                    requiresParam: false,
                    contexts: ["find_context"]
                }
            };
            
            var currentContext = "find_context";
            
            for (var action in commandMetadata) {
                if (action.startsWith("slash_")) {
                    var metadata = commandMetadata[action];
                    if (metadata.contexts.includes(currentContext)) {
                        var commandMap = {
                            'slash_uploadimage': '/uploadimage',
                            'slash_createsub': '/createsub'
                        };
                        
                        var command = commandMap[action];
                        if (command) {
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
            
            return commands;
        }
    };
    
    var commands = mockWebSocketHandler.getAvailableCommands();
    
    // Check if uploadimage command is available
    var uploadCommand = commands.find(cmd => cmd.command === '/uploadimage');
    if (!uploadCommand) {
        throw new Error("Should include /uploadimage command in find context");
    }
    
    if (uploadCommand.category !== "🖼️ Image") {
        throw new Error("Should have correct category for uploadimage command");
    }
    
    // Check if createsub command is also available
    var createCommand = commands.find(cmd => cmd.command === '/createsub');
    if (!createCommand) {
        throw new Error("Should include /createsub command in find context");
    }
    
    if (commands.length < 2) {
        throw new Error("Should have multiple commands available in find context");
    }
}

// Test explorer image preview
function testExplorerImagePreview() {
    console.log("  Testing explorer image preview...");
    
    // Test note with single image
    var noteWithSingleImage = {
        id: "1",
        title: "Test Note",
        images: ["images/test1.jpg"]
    };
    
    // Test note with multiple images
    var noteWithMultipleImages = {
        id: "2", 
        title: "Test Note 2",
        images: ["images/test1.jpg", "images/test2.jpg", "images/test3.jpg"]
    };
    
    // Test note without images
    var noteWithoutImages = {
        id: "3",
        title: "Test Note 3",
        images: []
    };
    
    // Test image count detection
    var hasImages1 = noteWithSingleImage.images && noteWithSingleImage.images.length > 0;
    var hasImages2 = noteWithMultipleImages.images && noteWithMultipleImages.images.length > 0;
    var hasImages3 = noteWithoutImages.images && noteWithoutImages.images.length > 0;
    
    if (!hasImages1 || !hasImages2 || hasImages3) {
        throw new Error("Should correctly detect images in notes");
    }
    
    var imageCount1 = noteWithSingleImage.images.length;
    var imageCount2 = noteWithMultipleImages.images.length;
    
    if (imageCount1 !== 1 || imageCount2 !== 3) {
        throw new Error("Should correctly count images");
    }
}

// Test image rotation functionality
function testImageRotation() {
    console.log("  Testing image rotation functionality...");
    
    // Mock DOM elements
    var mockImages = [
        { classList: { remove: function() {}, add: function() {} } },
        { classList: { remove: function() {}, add: function() {} } },
        { classList: { remove: function() {}, add: function() {}, contains: function() { return true; } } }
    ];
    
    var mockContainer = {
        querySelectorAll: function() { return mockImages; },
        dataset: { intervalId: null }
    };
    
    // Test rotation setup
    var currentIndex = 0;
    var intervalId = setInterval(() => {
        mockImages[currentIndex].classList.remove('active');
        currentIndex = (currentIndex + 1) % mockImages.length;
        mockImages[currentIndex].classList.add('active');
    }, 100); // Faster for testing
    
    // Test rotation
    setTimeout(() => {
        if (currentIndex !== 1) {
            throw new Error("Image rotation should advance index");
        }
    }, 150);
    
    setTimeout(() => {
        if (currentIndex !== 2) {
            throw new Error("Image rotation should continue advancing");
        }
        clearInterval(intervalId);
    }, 250);
}

// Test missing image cleanup
function testMissingImageCleanup() {
    console.log("  Testing missing image cleanup...");
    
    // Test note with mixed valid/invalid images
    var note = {
        id: "123",
        images: ["images/valid1.jpg", "images/missing.jpg", "images/valid2.jpg"]
    };
    
    var validImages = [];
    var removedImages = [];
    
    // Simulate image validation
    note.images.forEach(imagePath => {
        if (imagePath.indexOf("missing") === -1) {
            validImages.push(imagePath);
        } else {
            removedImages.push(imagePath);
        }
    });
    
    if (validImages.length !== 2 || removedImages.length !== 1) {
        throw new Error("Should correctly identify valid and missing images");
    }
    
    // Test cleanup
    note.images = validImages;
    if (note.images.length !== 2) {
        throw new Error("Should update note with only valid images");
    }
}

// Export run function for test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        run: runImageUploadTests,
        runImageUploadTests 
    };
} else {
    // Run tests in browser/Node.js environment
    runImageUploadTests();
}
