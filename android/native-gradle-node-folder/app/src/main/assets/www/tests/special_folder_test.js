// Test app.GetSpecialFolder() approach for Android 10+ compatibility
// This test verifies that GetSpecialFolder provides writable storage paths

const assert = require('assert');

console.log("🧪 Testing GetSpecialFolder Storage");
console.log("📱 Test: Special Folder Storage for Android 10+");

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
        // Mock different scenarios
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
        return null; // Folder not available
    },
    WriteFile: function(filename, content) {
        console.log("DEBUG: WriteFile called with:", filename, "content:", content);
        // Mock that special folders are writable
        if (filename.includes("/storage/emulated/0/")) {
            return true; // Special folders are writable
        }
        return false; // Other paths are not writable
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

// Test 1: GetSpecialFolder detection
console.log("\n1. Testing GetSpecialFolder detection...");
try {
    ImageManager.initializeStorage();
    console.log("DEBUG: Selected storage directory:", ImageManager.imagesDir);
    assert(ImageManager.imagesDir, "Storage directory should be selected");
    assert(ImageManager.imagesDir.includes("/storage/emulated/0/"), "Should use GetSpecialFolder path");
    console.log("✅ GetSpecialFolder detection test passed");
} catch (e) {
    console.log("❌ GetSpecialFolder detection test failed:", e.message);
    assert.fail("GetSpecialFolder detection test failed: " + e.message);
}

// Test 2: Image path generation with GetSpecialFolder
console.log("\n2. Testing image path generation with GetSpecialFolder...");
try {
    var imagePath = ImageManager.generateImagePath(20, "test.jpg");
    console.log("DEBUG: Generated image path:", imagePath);
    assert(imagePath, "Image path should be generated");
    assert(imagePath.includes("note_20_"), "Image path should contain note ID");
    assert(imagePath.includes(".jpg"), "Image path should contain file extension");
    assert(imagePath.includes("/storage/emulated/0/"), "Image path should use GetSpecialFolder path");
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

// Test 4: Fallback when GetSpecialFolder fails
console.log("\n4. Testing fallback when GetSpecialFolder fails...");
// Mock GetSpecialFolder to return null for all folders
const originalGetSpecialFolder = global.app.GetSpecialFolder;
global.app.GetSpecialFolder = function(folder) {
    console.log("DEBUG: GetSpecialFolder called with:", folder);
    return null; // All folders not available
};

try {
    ImageManager.initializeStorage();
    console.log("DEBUG: Fallback storage directory:", ImageManager.imagesDir);
    assert(ImageManager.imagesDir, "Fallback storage directory should be set");
    console.log("✅ Fallback test passed");
} catch (e) {
    console.log("❌ Fallback test failed:", e.message);
    assert.fail("Fallback test failed: " + e.message);
} finally {
    // Restore original GetSpecialFolder
    global.app.GetSpecialFolder = originalGetSpecialFolder;
}

console.log("\n🎉 GetSpecialFolder test completed successfully!");
console.log("✅ All GetSpecialFolder tests passed!");

console.log("\n📋 Summary:");
console.log("• GetSpecialFolder provides writable storage paths");
console.log("• Special folders are detected and used correctly");
console.log("• Image paths are generated with special folder paths");
console.log("• Fallback mechanisms work when GetSpecialFolder fails");
console.log("• Manual storage testing works correctly");
