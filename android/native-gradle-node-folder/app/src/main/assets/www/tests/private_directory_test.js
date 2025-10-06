// Test app's private directory approach for storage
// This test verifies that the app's private directory is writable

const assert = require('assert');

console.log("🧪 Testing Private Directory Storage");
console.log("📱 Test: App's Private Directory for Storage");

// Mock DroidScript APIs
global.app = {
    GetAppPath: function() {
        console.log("DEBUG: GetAppPath called");
        return "/sdcard/DroidScript/main";
    },
    GetInternalFolder: function() {
        console.log("DEBUG: GetInternalFolder called");
        return "/sdcard";
    },
    GetExternalFolder: function() {
        console.log("DEBUG: GetExternalFolder called");
        return "";
    },
    GetSpecialFolder: function(folder) {
        console.log("DEBUG: GetSpecialFolder called with:", folder);
        // Mock that GetSpecialFolder returns paths but they're not writable
        if (folder === "Documents") {
            return "/storage/emulated/0/Documents";
        }
        if (folder === "Downloads") {
            return "/storage/emulated/0/Download";
        }
        if (folder === "Pictures") {
            return "/storage/emulated/0/Pictures";
        }
        if (folder === "DCIM") {
            return "/storage/emulated/0/DCIM";
        }
        return null;
    },
    WriteFile: function(filename, content) {
        console.log("DEBUG: WriteFile called with:", filename, "content:", content);
        // Mock that only the private directory is writable
        if (filename.includes("/storage/emulated/0/Android/data/com.smartphoneremote.androidscriptfree/files/DroidScript/main/")) {
            return true; // Private directory is writable
        }
        // Mock that app directory is NOT writable to force private directory usage
        if (filename.includes("/sdcard/DroidScript/main/")) {
            return false; // App directory is not writable
        }
        return false; // All other paths are not writable
    },
    DeleteFile: function(filename) {
        console.log("DEBUG: DeleteFile called with:", filename);
        return true; // Mock as successful
    },
    IsFolder: function(path) {
        console.log("DEBUG: IsFolder called with:", path);
        return true; // Mock as existing
    },
    MakeFolder: function(path) {
        console.log("DEBUG: MakeFolder called with:", path);
        return true; // Mock as successful
    }
};

// Load ImageManager
const ImageManager = require('../ImageManager.js');

// Test 1: Private directory detection
console.log("\n1. Testing private directory detection...");
try {
    ImageManager.initializeStorage();
    console.log("DEBUG: Selected storage directory:", ImageManager.imagesDir);
    assert(ImageManager.imagesDir, "Storage directory should be selected");
    assert(ImageManager.imagesDir.includes("/storage/emulated/0/Android/data/"), "Should use private directory");
    console.log("✅ Private directory detection test passed");
} catch (e) {
    console.log("❌ Private directory detection test failed:", e.message);
    assert.fail("Private directory detection test failed: " + e.message);
}

// Test 2: Image path generation with private directory
console.log("\n2. Testing image path generation with private directory...");
try {
    var imagePath = ImageManager.generateImagePath(20, "test.jpg");
    console.log("DEBUG: Generated image path:", imagePath);
    assert(imagePath, "Image path should be generated");
    assert(imagePath.includes("note_20_"), "Image path should contain note ID");
    assert(imagePath.includes(".jpg"), "Image path should contain file extension");
    assert(imagePath.includes("/storage/emulated/0/Android/data/"), "Image path should use private directory");
    console.log("✅ Image path generation test passed");
} catch (e) {
    console.log("❌ Image path generation test failed:", e.message);
    assert.fail("Image path generation test failed: " + e.message);
}

// Test 3: Manual storage test
console.log("\n3. Testing manual storage test...");
try {
    ImageManager.testStorage();
    console.log("DEBUG: Manual storage test completed");
    console.log("✅ Manual storage test passed");
} catch (e) {
    console.log("❌ Manual storage test failed:", e.message);
    assert.fail("Manual storage test failed: " + e.message);
}

// Test 4: Fallback when private directory fails
console.log("\n4. Testing fallback when private directory fails...");
// Mock WriteFile to return false for private directory
const originalWriteFile = global.app.WriteFile;
global.app.WriteFile = function(filename, content) {
    console.log("DEBUG: WriteFile called with:", filename, "content:", content);
    // Mock that private directory is not writable, but app directory is
    if (filename.includes("/sdcard/DroidScript/main/")) {
        return true; // App directory is writable
    }
    return false; // All other paths are not writable
};

try {
    ImageManager.initializeStorage();
    console.log("DEBUG: Fallback storage directory:", ImageManager.imagesDir);
    assert(ImageManager.imagesDir, "Fallback storage directory should be set");
    assert(ImageManager.imagesDir.includes("/sdcard/DroidScript/main/"), "Should use app directory as fallback");
    console.log("✅ Fallback test passed");
} catch (e) {
    console.log("❌ Fallback test failed:", e.message);
    assert.fail("Fallback test failed: " + e.message);
} finally {
    // Restore original WriteFile
    global.app.WriteFile = originalWriteFile;
}

console.log("\n🎉 Private directory test completed successfully!");
console.log("✅ All private directory tests passed!");

console.log("\n📋 Summary:");
console.log("• Private directory provides writable storage paths");
console.log("• App's private directory is detected and used correctly");
console.log("• Image paths are generated with private directory paths");
console.log("• Fallback mechanisms work when private directory fails");
console.log("• Manual storage testing works correctly");
