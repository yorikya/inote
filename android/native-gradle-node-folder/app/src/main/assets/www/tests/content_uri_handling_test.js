// Test: Content URI Handling for Android File Picker
// Tests that content:// URIs from Android file picker are properly handled

// Mock DroidScript app object
global.app = {
    // Mock ChooseFile that returns content URI (like real Android)
    ChooseFile: function(title, type, callback) {
        console.log("DEBUG: Mock ChooseFile called with:", title, type);
        
        // Simulate Android returning a content URI
        setTimeout(() => {
            var contentUri = "content://com.android.providers.media.documents/document/image%3A1000100892";
            console.log("DEBUG: Mock content URI selected:", contentUri);
            callback(contentUri);
        }, 100);
    },
    
    // Mock file operations
    ReadFile: function(filename) {
        if (filename === "notes.json") {
            return JSON.stringify({
                notes: [
                    {
                        id: "1",
                        title: "Test Note",
                        description: "Test description",
                        parent_id: null,
                        done: false,
                        creation_date: new Date().toISOString(),
                        images: [],
                        deleted: false
                    }
                ],
                last_note_id: 1
            });
        }
        throw new Error("File not found: " + filename);
    },
    
    WriteFile: function(filename, content) {
        console.log("DEBUG: Mock write to", filename, "length:", content.length);
        return true;
    },
    
    // Mock popup for warnings
    ShowPopup: function(message) {
        console.log("DEBUG: Mock popup:", message);
    }
};

// Load required modules
const path = require('path');
const fs = require('fs');

// Load modules in dependency order
eval(fs.readFileSync(path.join(__dirname, '../StateManager.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../NoteManager.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../ImageManager.js'), 'utf8'));

// Test runner
function runTest(testName, testFunction) {
    console.log(`\n🧪 Running: ${testName}`);
    try {
        testFunction();
        console.log(`✅ PASSED: ${testName}`);
        return true;
    } catch (error) {
        console.log(`❌ FAILED: ${testName}`);
        console.log(`   Error: ${error.message}`);
        return false;
    }
}

// Test 1: Content URI format validation
function testContentUriValidation() {
    console.log("DEBUG: Testing content URI format validation...");
    
    var contentUris = [
        "content://com.android.providers.media.documents/document/image%3A1000100892",
        "content://media/external/images/media/12345",
        "content://com.google.android.apps.photos.contentprovider/0/1/content%3A//media/external/images/media/12345/ORIGINAL/NONE/image%2Fjpeg/1234567890"
    ];
    
    var regularPaths = [
        "/storage/emulated/0/DCIM/Camera/IMG_20241002_123456.jpg",
        "/storage/emulated/0/Pictures/image.png",
        "/sdcard/Download/photo.jpeg"
    ];
    
    var invalidPaths = [
        "/path/to/document.pdf",
        "/path/to/video.mp4",
        "/path/to/file.txt",
        "/path/to/file"
    ];
    
    // Test content URIs (should all be valid)
    for (var i = 0; i < contentUris.length; i++) {
        if (!ImageManager.isValidImageFormat(contentUris[i])) {
            throw new Error("Content URI rejected: " + contentUris[i]);
        }
    }
    console.log("DEBUG: All content URIs accepted correctly");
    
    // Test regular valid paths
    for (var i = 0; i < regularPaths.length; i++) {
        if (!ImageManager.isValidImageFormat(regularPaths[i])) {
            throw new Error("Valid path rejected: " + regularPaths[i]);
        }
    }
    console.log("DEBUG: All regular valid paths accepted correctly");
    
    // Test invalid paths (should be rejected)
    for (var i = 0; i < invalidPaths.length; i++) {
        if (ImageManager.isValidImageFormat(invalidPaths[i])) {
            throw new Error("Invalid path accepted: " + invalidPaths[i]);
        }
    }
    console.log("DEBUG: All invalid paths rejected correctly");
}

// Test 2: Complete content URI flow
function testContentUriFlow() {
    return new Promise((resolve, reject) => {
        console.log("DEBUG: Testing complete content URI flow...");
        
        // Initialize storage
        ImageManager.initializeStorage();
        
        // Load notes
        NoteManager.loadNotes();
        
        // Test opening image picker (should return content URI)
        ImageManager.openImagePicker("1", function(success, imagePath, error) {
            try {
                console.log("DEBUG: Content URI picker callback - success:", success, "path:", imagePath, "error:", error);
                
                if (!success) {
                    throw new Error("Content URI picker failed: " + error);
                }
                
                if (!imagePath) {
                    throw new Error("No content URI returned");
                }
                
                if (!imagePath.startsWith('content://')) {
                    throw new Error("Expected content URI, got: " + imagePath);
                }
                
                console.log("DEBUG: Content URI flow completed successfully");
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    });
}

// Test 3: Content URI addition to note
function testContentUriAdditionToNote() {
    return new Promise((resolve, reject) => {
        console.log("DEBUG: Testing content URI addition to note...");
        
        var testContentUri = "content://com.android.providers.media.documents/document/image%3A1000100892";
        
        // Add content URI to note
        var updatedNote = NoteManager.addImageToNote("1", testContentUri);
        
        if (!updatedNote) {
            reject(new Error("Failed to add content URI to note"));
            return;
        }
        
        if (!updatedNote.images || updatedNote.images.length === 0) {
            reject(new Error("Content URI not added to note images array"));
            return;
        }
        
        var addedUri = updatedNote.images[updatedNote.images.length - 1];
        if (addedUri !== testContentUri) {
            reject(new Error("Content URI not correctly stored. Expected: " + testContentUri + ", Got: " + addedUri));
            return;
        }
        
        console.log("DEBUG: Content URI successfully added to note");
        console.log("DEBUG: Note now has", updatedNote.images.length, "images");
        console.log("DEBUG: Stored URI:", addedUri);
        resolve();
    });
}

// Test 4: Mixed URI types validation
function testMixedUriTypes() {
    console.log("DEBUG: Testing mixed URI types validation...");
    
    var contentUri = "content://com.android.providers.media.documents/document/image%3A1000100892";
    var filePath = "/storage/emulated/0/DCIM/Camera/IMG_20241002_123456.jpg";
    var invalidPath = "/path/to/document.pdf";
    
    // Test that both valid types are accepted
    if (!ImageManager.isValidImageFormat(contentUri)) {
        throw new Error("Content URI validation failed: " + contentUri);
    }
    
    if (!ImageManager.isValidImageFormat(filePath)) {
        throw new Error("File path validation failed: " + filePath);
    }
    
    // Test that invalid path is rejected
    if (ImageManager.isValidImageFormat(invalidPath)) {
        throw new Error("Invalid path was accepted: " + invalidPath);
    }
    
    console.log("DEBUG: Mixed URI types validation working correctly");
    console.log("DEBUG: Content URI accepted:", contentUri);
    console.log("DEBUG: File path accepted:", filePath);
    console.log("DEBUG: Invalid path rejected:", invalidPath);
}

// Run all tests
async function runAllTests() {
    console.log("🚀 Starting Content URI Handling Tests\n");
    
    var passed = 0;
    var total = 0;
    
    // Synchronous tests
    total++; if (runTest("Content URI Format Validation", testContentUriValidation)) passed++;
    total++; if (runTest("Mixed URI Types Validation", testMixedUriTypes)) passed++;
    
    // Asynchronous tests
    try {
        total++;
        console.log("\n🧪 Running: Content URI Flow");
        await testContentUriFlow();
        console.log("✅ PASSED: Content URI Flow");
        passed++;
    } catch (error) {
        console.log("❌ FAILED: Content URI Flow");
        console.log("   Error:", error.message);
    }
    
    try {
        total++;
        console.log("\n🧪 Running: Content URI Addition to Note");
        await testContentUriAdditionToNote();
        console.log("✅ PASSED: Content URI Addition to Note");
        passed++;
    } catch (error) {
        console.log("❌ FAILED: Content URI Addition to Note");
        console.log("   Error:", error.message);
    }
    
    // Summary
    console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log("🎉 All content URI tests passed!");
        console.log("\n✅ Content URI handling is working correctly");
        console.log("✅ Android file picker content:// URIs are now supported");
        console.log("✅ File path storage works with both content URIs and regular paths");
        console.log("✅ Format validation properly handles content URIs");
        
        console.log("\n🔧 The original error should now be resolved:");
        console.log("   Before: content://...documents/document/image%3A1000100892 → Invalid format");
        console.log("   After:  content://...documents/document/image%3A1000100892 → Valid, stored successfully");
    } else {
        console.log("⚠️  Some tests failed - check implementation");
        process.exit(1);
    }
}

// Run tests
runAllTests().catch(console.error);
