// Test storage directory detection and selection
// This test verifies that the app can find and use writable storage directories

const assert = require('assert');

console.log("🧪 Testing Storage Directory Detection");
console.log("📱 Test: Storage Directory Selection");

// Mock DroidScript APIs
global.app = {
    GetAppPath: function() {
        console.log("DEBUG: GetAppPath called");
        return "/sdcard/DroidScript/main";
    },
    GetInternalFolder: function() {
        console.log("DEBUG: GetInternalFolder called");
        return "/data/data/com.smartphoneremote.androidscriptfree/files";
    },
    GetExternalFolder: function() {
        console.log("DEBUG: GetExternalFolder called");
        return "/sdcard/Android/data/com.smartphoneremote.androidscriptfree/files";
    },
    IsFolder: function(path) {
        console.log("DEBUG: IsFolder called with:", path);
        // Mock different scenarios
        if (path.includes("internal")) {
            return true; // Internal folder exists
        }
        if (path.includes("external")) {
            return false; // External folder doesn't exist
        }
        if (path.includes("app")) {
            return true; // App folder exists
        }
        return false;
    },
    MakeFolder: function(path) {
        console.log("DEBUG: MakeFolder called with:", path);
        return true; // Mock as successful
    },
    WriteFile: function(filename, content) {
        console.log("DEBUG: WriteFile called with:", filename, "content:", content);
        // Mock different scenarios
        if (filename.includes("/data/data/")) {
            return true; // Internal storage is writable
        }
        if (filename.includes("/sdcard/Android/data/")) {
            return false; // External storage is not writable
        }
        if (filename.includes("/sdcard/DroidScript/")) {
            return true; // App storage is writable
        }
        if (filename.includes("/Internal/")) {
            return true; // DroidScript internal prefix is writable
        }
        if (filename.includes("/External/")) {
            return false; // DroidScript external prefix is not writable
        }
        return false;
    },
    DeleteFile: function(filename) {
        console.log("DEBUG: DeleteFile called with:", filename);
        return true; // Mock as successful
    }
};

// Load ImageManager
const ImageManager = require('../ImageManager.js');

// Test 1: Storage directory detection
console.log("\n1. Testing storage directory detection...");
try {
    ImageManager.initializeStorage();
    console.log("DEBUG: Selected storage directory:", ImageManager.imagesDir);
    assert(ImageManager.imagesDir, "Storage directory should be selected");
    assert(ImageManager.imagesDir.includes("/data/data/"), "Should prefer internal storage");
    console.log("✅ Storage directory detection test passed");
} catch (e) {
    console.log("❌ Storage directory detection test failed:", e.message);
    assert.fail("Storage directory detection test failed: " + e.message);
}

// Test 2: Image path generation
console.log("\n2. Testing image path generation...");
try {
    var imagePath = ImageManager.generateImagePath(20, "test.jpg");
    console.log("DEBUG: Generated image path:", imagePath);
    assert(imagePath, "Image path should be generated");
    assert(imagePath.includes("note_20_"), "Image path should contain note ID");
    assert(imagePath.includes(".jpg"), "Image path should contain file extension");
    console.log("✅ Image path generation test passed");
} catch (e) {
    console.log("❌ Image path generation test failed:", e.message);
    assert.fail("Image path generation test failed: " + e.message);
}

// Test 3: Fallback when no storage is available
console.log("\n3. Testing fallback when no storage is available...");
// Mock all storage as unavailable
const originalWriteFile = global.app.WriteFile;
global.app.WriteFile = function(filename, content) {
    console.log("DEBUG: WriteFile called with:", filename, "content:", content);
    return false; // All storage is not writable
};

try {
    ImageManager.initializeStorage();
    console.log("DEBUG: Fallback storage directory:", ImageManager.imagesDir);
    assert(ImageManager.imagesDir, "Fallback storage directory should be set");
    assert(ImageManager.imagesDir === "images/", "Should use fallback directory");
    console.log("✅ Fallback storage test passed");
} catch (e) {
    console.log("❌ Fallback storage test failed:", e.message);
    assert.fail("Fallback storage test failed: " + e.message);
} finally {
    // Restore original WriteFile
    global.app.WriteFile = originalWriteFile;
}

// Test 4: Directory creation
console.log("\n4. Testing directory creation...");
try {
    ImageManager.initializeStorage();
    console.log("DEBUG: Directory creation test completed");
    assert(ImageManager.imagesDir, "Directory should be created");
    console.log("✅ Directory creation test passed");
} catch (e) {
    console.log("❌ Directory creation test failed:", e.message);
    assert.fail("Directory creation test failed: " + e.message);
}

console.log("\n🎉 Storage directory test completed successfully!");
console.log("✅ All storage directory tests passed!");

console.log("\n📋 Summary:");
console.log("• Storage directories are detected correctly");
console.log("• Writable directories are selected properly");
console.log("• Fallback mechanisms work when no storage is available");
console.log("• Directory creation is handled gracefully");
console.log("• Image paths are generated correctly");
