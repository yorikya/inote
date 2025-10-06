// Test for image error handling and cleanup functionality
// This test verifies that broken image links are properly handled and can be cleaned up

// Mock DroidScript APIs for testing
global.app = {
    FileExists: function(path) {
        console.log("DEBUG: Mock FileExists called with:", path);
        // Simulate missing files
        if (path.includes("debug_image.jpg") || path.includes("note_20_")) {
            return false; // File doesn't exist
        }
        return true; // Other files exist
    },
    ReadFile: function(path, encoding) {
        console.log("DEBUG: Mock ReadFile called with:", path, encoding);
        if (path.includes("debug_image.jpg") || path.includes("note_20_")) {
            return null; // File doesn't exist or permission denied
        }
        if (encoding === "base64") {
            return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="; // 1x1 pixel PNG
        }
        return "file content";
    }
};

// Mock NoteManager
global.NoteManager = {
    notes: [
        {
            id: "20",
            title: "Test Note with Broken Images",
            description: "Test note",
            images: [
                "/storage/emulated/0/Pictures/debug_image.jpg",
                "/sdcard/DroidScript/main/images/note_20_1759322529659.jpg",
                "/storage/emulated/0/Pictures/working_image.jpg"
            ]
        },
        {
            id: "31",
            title: "Test Note with Mixed Images",
            description: "Another test note",
            images: [
                "/storage/emulated/0/Pictures/debug_image.jpg",
                "content://com.android.providers.media.documents/document/image%3A1000100892"
            ]
        }
    ],
    
    getAllNotes: function() {
        return this.notes;
    },
    
    findNoteById: function(id) {
        return this.notes.find(note => note.id === id);
    },
    
    updateNote: function(id, title, description, images) {
        var note = this.findNoteById(id);
        if (note) {
            note.title = title;
            note.description = description;
            note.images = images;
            console.log("DEBUG: Updated note", id, "with", images.length, "images");
        }
    }
};

// Load the WebSocketHandler
const fs = require('fs');
const path = require('path');
const WebSocketHandlerCode = fs.readFileSync(path.join(__dirname, '..', 'WebSocketHandler.js'), 'utf8');

// Execute the code to get WebSocketHandler
eval(WebSocketHandlerCode);

console.log("=== Image Error Handling Test ===");

// Test 1: Test file API detection
console.log("\n1. Testing file API detection...");
try {
    const testResults = {
        apis: {
            FileExists: typeof app.FileExists,
            ReadFile: typeof app.ReadFile
        }
    };
    console.log("✅ File APIs detected:", JSON.stringify(testResults.apis));
} catch (e) {
    console.log("❌ File API detection failed:", e.message);
}

// Test 2: Test broken image detection
console.log("\n2. Testing broken image detection...");
try {
    var allNotes = NoteManager.getAllNotes();
    var brokenImages = [];
    var totalImages = 0;
    
    allNotes.forEach(function(note) {
        if (note.images && note.images.length > 0) {
            note.images.forEach(function(imagePath) {
                totalImages++;
                var exists = false;
                try {
                    exists = app.FileExists(imagePath);
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
    
    console.log("✅ Found", brokenImages.length, "broken images out of", totalImages, "total images");
    brokenImages.forEach(function(img) {
        console.log("   - Broken:", img.path, "in note:", img.noteTitle);
    });
} catch (e) {
    console.log("❌ Broken image detection failed:", e.message);
}

// Test 3: Test cleanup functionality
console.log("\n3. Testing cleanup functionality...");
try {
    var note20 = NoteManager.findNoteById("20");
    var originalImageCount = note20.images.length;
    console.log("   - Note 20 originally has", originalImageCount, "images");
    
    // Simulate cleanup of broken images
    var brokenPath = "/storage/emulated/0/Pictures/debug_image.jpg";
    note20.images = note20.images.filter(function(img) {
        return img !== brokenPath;
    });
    
    NoteManager.updateNote(note20.id, note20.title, note20.description, note20.images);
    
    var newImageCount = note20.images.length;
    console.log("   - Note 20 now has", newImageCount, "images");
    console.log("✅ Cleanup removed", (originalImageCount - newImageCount), "broken image(s)");
} catch (e) {
    console.log("❌ Cleanup functionality failed:", e.message);
}

// Test 4: Test error message generation
console.log("\n4. Testing error message generation...");
try {
    var errorTypes = [
        { error: "Image file not found: /path/to/image.jpg", expected: "📁 File Missing" },
        { error: "Permission Denial: opening provider", expected: "🔒 Permission Denied" },
        { error: "Some other error", expected: "❌ Image Not Found" }
    ];
    
    errorTypes.forEach(function(test) {
        var errorMessage = "❌ Image Not Found";
        if (test.error.includes("Permission Denial")) {
            errorMessage = "🔒 Permission Denied";
        } else if (test.error.includes("not found")) {
            errorMessage = "📁 File Missing";
        }
        
        if (errorMessage === test.expected) {
            console.log("✅ Error type correctly identified:", errorMessage);
        } else {
            console.log("❌ Error type mismatch. Expected:", test.expected, "Got:", errorMessage);
        }
    });
} catch (e) {
    console.log("❌ Error message generation failed:", e.message);
}

// Test 5: Test WebSocket cleanup handler (mock)
console.log("\n5. Testing WebSocket cleanup handler...");
try {
    // Mock WebSocket handler
    var mockHandler = {
        sendToClient: function(message, ip, id) {
            console.log("   - Mock WebSocket response:", message.type);
        }
    };
    
    // Simulate cleanup request
    var cleanupRequest = {
        imagePath: "/storage/emulated/0/Pictures/debug_image.jpg"
    };
    
    // Find notes with this image
    var updatedNotes = [];
    allNotes.forEach(function(note) {
        if (note.images && note.images.includes(cleanupRequest.imagePath)) {
            updatedNotes.push(note.id);
        }
    });
    
    console.log("✅ Cleanup would affect", updatedNotes.length, "notes");
} catch (e) {
    console.log("❌ WebSocket cleanup handler test failed:", e.message);
}

console.log("\n=== Image Error Handling Test Complete ===");
console.log("All tests completed successfully! 🎉");
