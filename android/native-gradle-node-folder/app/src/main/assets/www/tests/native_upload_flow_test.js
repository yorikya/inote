// Test the complete native upload flow
// This test simulates the full upload process from frontend to backend

const assert = require('assert');

// Mock DroidScript APIs
global.app = {
    WriteFile: function(filename, content) {
        console.log("DEBUG: Writing file:", filename, "content length:", content.length);
        return true;
    },
    ReadFile: function(filename) {
        console.log("DEBUG: Reading file:", filename);
        return '{"notes":[]}';
    },
    CreateDialog: function(title) {
        console.log("DEBUG: Creating dialog:", title);
        return {
            SetSize: function(w, h) { 
                console.log("DEBUG: Dialog size:", w, h); 
                return this;
            },
            AddLayout: function(layout) { 
                console.log("DEBUG: Adding layout to dialog"); 
                return this;
            },
            Show: function() { 
                console.log("DEBUG: Showing dialog - DIALOG SHOULD BE VISIBLE NOW");
                return this;
            },
            Close: function() { 
                console.log("DEBUG: Closing dialog"); 
                return this;
            }
        };
    },
    CreateLayout: function(type, orientation) {
        console.log("DEBUG: Creating layout:", type, orientation);
        return {
            AddChild: function(child) { 
                console.log("DEBUG: Adding child to layout"); 
                return this;
            },
            SetPadding: function(l, t, r, b) { console.log("DEBUG: Layout padding:", l, t, r, b); return this; },
            SetBackColor: function(color) { console.log("DEBUG: Layout background:", color); return this; }
        };
    },
    CreateText: function(text, width, height, options) {
        console.log("DEBUG: Creating text:", text);
        return {
            SetTextSize: function(size) { console.log("DEBUG: Text size:", size); return this; },
            SetTextColor: function(color) { console.log("DEBUG: Text color:", color); return this; },
            SetMargins: function(l, t, r, b) { console.log("DEBUG: Text margins:", l, t, r, b); return this; }
        };
    },
    CreateButton: function(text, width, height, options) {
        console.log("DEBUG: Creating button:", text);
        return {
            SetMargins: function(l, t, r, b) { console.log("DEBUG: Button margins:", l, t, r, b); return this; },
            SetBackColor: function(color) { console.log("DEBUG: Button background:", color); return this; },
            SetTextColor: function(color) { console.log("DEBUG: Button text color:", color); return this; },
            SetOnTouch: function(callback) { console.log("DEBUG: Setting button callback"); return this; }
        };
    },
    CreateFilePicker: function(type) {
        console.log("DEBUG: Creating file picker:", type);
        return {
            SetOnSelect: function(callback) {
                console.log("DEBUG: Setting file picker callback");
                // Simulate file selection
                setTimeout(function() {
                    callback("test_image.jpg");
                }, 1000);
            },
            Show: function() {
                console.log("DEBUG: Showing file picker");
                console.log("DEBUG: FILE PICKER SHOULD BE VISIBLE NOW");
            }
        };
    },
    CreateCamera: function() {
        console.log("DEBUG: Creating camera");
        return {
            SetOnResult: function(callback) {
                console.log("DEBUG: Setting camera callback");
                // Simulate photo taken
                setTimeout(function() {
                    callback("OK");
                }, 1000);
            },
            Show: function() {
                console.log("DEBUG: Showing camera");
                console.log("DEBUG: CAMERA SHOULD BE VISIBLE NOW");
            },
            GetFile: function() {
                return "test_photo.jpg";
            }
        };
    },
    HasPermission: function(permission) {
        console.log("DEBUG: Checking permission:", permission);
        return true; // Mock as granted
    },
    RequestPermission: function(permission) {
        console.log("DEBUG: Requesting permission:", permission);
        return true;
    }
};

// Load required modules
const NoteManager = require('../NoteManager.js');
const ImageManager = require('../ImageManager.js');
const WebSocketHandler = require('../WebSocketHandler.js');

console.log("🧪 Testing Native Upload Flow");
console.log("📱 Test: Complete Upload Process");

// Test 1: Create a test note
console.log("\n1. Creating test note...");
var testNote = NoteManager.createNote("Test Note for Upload", "Test description");
console.log("✅ Test note created:", testNote.id);

// Test 2: Test native file picker request
console.log("\n2. Testing native file picker request...");
var mockWebSocketMessage = {
    type: 'request_file_picker',
    noteId: testNote.id
};

var mockIp = '127.0.0.1';
var mockId = 1;

try {
    WebSocketHandler.handleFilePickerRequest(mockWebSocketMessage, mockIp, mockId);
    console.log("✅ File picker request handled successfully");
} catch (e) {
    console.log("❌ Error handling file picker request:", e.message);
    assert.fail("File picker request failed: " + e.message);
}

// Test 3: Test file upload with native path
console.log("\n3. Testing file upload with native path...");
var mockUploadMessage = {
    type: 'upload_file',
    noteId: testNote.id,
    filename: 'test_image.jpg',
    fileData: null, // No base64 data for native files
    imagePath: '/storage/emulated/0/DCIM/Camera/test_image.jpg'
};

try {
    WebSocketHandler.handleFileUpload(mockUploadMessage, mockIp, mockId);
    console.log("✅ File upload with native path handled successfully");
} catch (e) {
    console.log("❌ Error handling file upload:", e.message);
    assert.fail("File upload failed: " + e.message);
}

// Test 4: Verify image was added to note
console.log("\n4. Verifying image was added to note...");
var updatedNote = NoteManager.getNoteById(testNote.id);
if (updatedNote && updatedNote.images && updatedNote.images.length > 0) {
    console.log("✅ Image successfully added to note");
    console.log("📷 Image path:", updatedNote.images[0]);
} else {
    console.log("❌ Image was not added to note");
    assert.fail("Image was not added to note");
}

// Test 5: Test multiple image uploads
console.log("\n5. Testing multiple image uploads...");
var mockUploadMessage2 = {
    type: 'upload_file',
    noteId: testNote.id,
    filename: 'test_image2.jpg',
    fileData: null,
    imagePath: '/storage/emulated/0/DCIM/Camera/test_image2.jpg'
};

try {
    WebSocketHandler.handleFileUpload(mockUploadMessage2, mockIp, mockId);
    console.log("✅ Second image upload handled successfully");
} catch (e) {
    console.log("❌ Error handling second image upload:", e.message);
    assert.fail("Second image upload failed: " + e.message);
}

// Test 6: Verify multiple images
console.log("\n6. Verifying multiple images...");
var finalNote = NoteManager.getNoteById(testNote.id);
if (finalNote && finalNote.images && finalNote.images.length === 2) {
    console.log("✅ Multiple images successfully added to note");
    console.log("📷 Total images:", finalNote.images.length);
    console.log("📷 Image paths:", finalNote.images);
} else {
    console.log("❌ Multiple images were not added correctly");
    console.log("📷 Expected 2 images, got:", finalNote.images ? finalNote.images.length : 0);
    assert.fail("Multiple images not added correctly");
}

console.log("\n🎉 Native upload flow test completed successfully!");
console.log("✅ All tests passed!");
