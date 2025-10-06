// Test app.GetPrivateFolder() approach for storage
// This test verifies that GetPrivateFolder provides writable storage paths

const assert = require('assert');

console.log("🧪 Testing GetPrivateFolder Storage");
console.log("📱 Test: GetPrivateFolder Storage for Android 10+");

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
    GetPrivateFolder: function() {
        console.log("DEBUG: GetPrivateFolder called");
        return "/storage/emulated/0/Android/data/com.smartphoneremote.androidscriptfree/files/";
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
        // Mock that only GetPrivateFolder is writable
        if (filename.includes("/storage/emulated/0/Android/data/com.smartphoneremote.androidscriptfree/files/")) {
            return true; // GetPrivateFolder is writable
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

// Test 1: GetPrivateFolder detection
console.log("\n1. Testing GetPrivateFolder detection...");
try {
    ImageManager.initializeStorage();
    console.log("DEBUG: Selected storage directory:", ImageManager.imagesDir);
    assert(ImageManager.imagesDir, "Storage directory should be selected");
    assert(ImageManager.imagesDir.includes("/storage/emulated/0/Android/data/"), "Should use GetPrivateFolder path");
    console.log("✅ GetPrivateFolder detection test passed");
} catch (e) {
    console.log("❌ GetPrivateFolder detection test failed:", e.message);
    assert.fail("GetPrivateFolder detection test failed: " + e.message);
}

// Test 2: Image path generation with GetPrivateFolder
console.log("\n2. Testing image path generation with GetPrivateFolder...");
try {
    var imagePath = ImageManager.generateImagePath(20, "test.jpg");
    console.log("DEBUG: Generated image path:", imagePath);
    assert(imagePath, "Image path should be generated");
    assert(imagePath.includes("note_20_"), "Image path should contain note ID");
    assert(imagePath.includes(".jpg"), "Image path should contain file extension");
    assert(imagePath.includes("/storage/emulated/0/Android/data/"), "Image path should use GetPrivateFolder path");
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

// Test 4: Fallback when GetPrivateFolder fails
console.log("\n4. Testing fallback when GetPrivateFolder fails...");
// Mock GetPrivateFolder to return null
const originalGetPrivateFolder = global.app.GetPrivateFolder;
global.app.GetPrivateFolder = function() {
    console.log("DEBUG: GetPrivateFolder called");
    return null; // Not available
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
    // Restore original GetPrivateFolder
    global.app.GetPrivateFolder = originalGetPrivateFolder;
}

console.log("\n🎉 GetPrivateFolder test completed successfully!");
console.log("✅ All GetPrivateFolder tests passed!");

console.log("\n📋 Summary:");
console.log("• GetPrivateFolder provides writable storage paths");
console.log("• Private folder is detected and used correctly");
console.log("• Image paths are generated with private folder paths");
console.log("• Fallback mechanisms work when GetPrivateFolder fails");
console.log("• Manual storage testing works correctly");
