// Test direct storage approach when standard storage methods fail
// This test verifies that the app can fall back to direct app directory storage

const assert = require('assert');

console.log("🧪 Testing Direct Storage Fallback");
console.log("📱 Test: Direct App Directory Storage");

// Mock DroidScript APIs that return problematic values
global.app = {
    GetAppPath: function() {
        console.log("DEBUG: GetAppPath called");
        return "/sdcard/DroidScript/main";
    },
    GetInternalFolder: function() {
        console.log("DEBUG: GetInternalFolder called");
        return "/sdcard"; // Problematic: returns /sdcard instead of proper internal path
    },
    GetExternalFolder: function() {
        console.log("DEBUG: GetExternalFolder called");
        return ""; // Problematic: returns empty string
    },
    IsFolder: function(path) {
        console.log("DEBUG: IsFolder called with:", path);
        // Mock that most directories don't exist or aren't writable
        if (path.includes("/sdcard/images/")) {
            return false; // Directory doesn't exist
        }
        if (path.includes("/sdcard/DroidScript/main/images/")) {
            return false; // Directory doesn't exist
        }
        return false;
    },
    MakeFolder: function(path) {
        console.log("DEBUG: MakeFolder called with:", path);
        // Mock that directory creation fails for most paths
        if (path.includes("/sdcard/images/")) {
            return false; // Directory creation fails
        }
        if (path.includes("/sdcard/DroidScript/main/images/")) {
            return false; // Directory creation fails
        }
        return false;
    },
    WriteFile: function(filename, content) {
        console.log("DEBUG: WriteFile called with:", filename, "content:", content);
        // Mock that only the direct app path is writable
        if (filename.includes("/sdcard/DroidScript/main/")) {
            return true; // Direct app path is writable
        }
        return false; // All other paths are not writable
    },
    DeleteFile: function(filename) {
        console.log("DEBUG: DeleteFile called with:", filename);
        return true; // Mock as successful
    }
};

// Load ImageManager
const ImageManager = require('../ImageManager.js');

// Test 1: Storage directory detection with problematic APIs
console.log("\n1. Testing storage directory detection with problematic APIs...");
try {
    ImageManager.initializeStorage();
    console.log("DEBUG: Selected storage directory:", ImageManager.imagesDir);
    assert(ImageManager.imagesDir, "Storage directory should be selected");
    assert(ImageManager.imagesDir.includes("/sdcard/DroidScript/main/"), "Should use direct app path");
    console.log("✅ Storage directory detection test passed");
} catch (e) {
    console.log("❌ Storage directory detection test failed:", e.message);
    assert.fail("Storage directory detection test failed: " + e.message);
}

// Test 2: Image path generation with direct storage
console.log("\n2. Testing image path generation with direct storage...");
try {
    var imagePath = ImageManager.generateImagePath(20, "test.jpg");
    console.log("DEBUG: Generated image path:", imagePath);
    assert(imagePath, "Image path should be generated");
    assert(imagePath.includes("note_20_"), "Image path should contain note ID");
    assert(imagePath.includes(".jpg"), "Image path should contain file extension");
    assert(imagePath.includes("/sdcard/DroidScript/main/"), "Image path should use direct app path");
    console.log("✅ Image path generation test passed");
} catch (e) {
    console.log("❌ Image path generation test failed:", e.message);
    assert.fail("Image path generation test failed: " + e.message);
}

// Test 3: Fallback when all storage methods fail
console.log("\n3. Testing fallback when all storage methods fail...");
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

console.log("\n🎉 Direct storage test completed successfully!");
console.log("✅ All direct storage tests passed!");

console.log("\n📋 Summary:");
console.log("• Direct app directory storage is detected correctly");
console.log("• Fallback mechanisms work when standard storage fails");
console.log("• Image paths are generated correctly with direct storage");
console.log("• Final fallback works when all storage methods fail");
