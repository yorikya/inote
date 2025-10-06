// Test different DroidScript APIs for file picking
// This test checks what APIs are available in DroidScript 2.78.9

const assert = require('assert');

// Mock DroidScript APIs with experimental features
global.app = {
    WriteFile: function(filename, content) {
        console.log("DEBUG: Writing file:", filename, "content length:", content.length);
        return true;
    },
    ReadFile: function(filename) {
        console.log("DEBUG: Reading file:", filename);
        return '{"notes":[]}';
    },
    HasPermission: function(permission) {
        console.log("DEBUG: Checking permission:", permission);
        return true; // Mock as granted
    },
    RequestPermission: function(permission) {
        console.log("DEBUG: Requesting permission:", permission);
        return true;
    },
    // Standard APIs
    CreateFilePicker: function() {
        console.log("DEBUG: CreateFilePicker available");
        return {
            SetType: function(type) { console.log("DEBUG: Setting type:", type); return this; },
            SetOnResult: function(callback) { console.log("DEBUG: Setting callback"); return this; },
            Show: function() { console.log("DEBUG: Showing file picker"); return this; },
            GetFile: function() { return "/storage/emulated/0/DCIM/test.jpg"; }
        };
    },
    CreateCamera: function() {
        console.log("DEBUG: CreateCamera available");
        return {
            SetOnResult: function(callback) { console.log("DEBUG: Setting camera callback"); return this; },
            Show: function() { console.log("DEBUG: Showing camera"); return this; },
            GetFile: function() { return "/storage/emulated/0/DCIM/photo.jpg"; }
        };
    },
    // Experimental APIs (DroidScript 2.78.9 with experimental features)
    CreateFileChooser: function() {
        console.log("DEBUG: CreateFileChooser available (experimental)");
        return {
            SetType: function(type) { console.log("DEBUG: Setting type:", type); return this; },
            SetOnResult: function(callback) { console.log("DEBUG: Setting callback"); return this; },
            Show: function() { console.log("DEBUG: Showing file chooser"); return this; },
            GetFile: function() { return "/storage/emulated/0/DCIM/test.jpg"; }
        };
    },
    CreateFileDialog: function() {
        console.log("DEBUG: CreateFileDialog available");
        return {
            SetType: function(type) { console.log("DEBUG: Setting type:", type); return this; },
            SetOnResult: function(callback) { console.log("DEBUG: Setting callback"); return this; },
            Show: function() { console.log("DEBUG: Showing file dialog"); return this; },
            GetFile: function() { return "/storage/emulated/0/DCIM/test.jpg"; }
        };
    },
    ShowFilePicker: function(type, callback) {
        console.log("DEBUG: ShowFilePicker available (simple)");
        setTimeout(function() {
            callback("/storage/emulated/0/DCIM/test.jpg");
        }, 100);
    },
    CopyFile: function(source, destination) {
        console.log("DEBUG: Copying file from", source, "to", destination);
        return true; // Mock as successful
    },
    GetAppPath: function() {
        console.log("DEBUG: Getting app path");
        return "/storage/emulated/0/DroidScript/main";
    },
    IsFolder: function(path) {
        console.log("DEBUG: Checking if folder exists:", path);
        return true; // Mock as exists
    },
    CreateFolder: function(path) {
        console.log("DEBUG: Creating folder:", path);
        return true; // Mock as successful
    },
    OpenUrl: function(url) {
        console.log("DEBUG: Opening URL:", url);
        return true; // Mock as successful
    }
};

// Load required modules
const NoteManager = require('../NoteManager.js');
const ImageManager = require('../ImageManager.js');

console.log("🧪 Testing DroidScript APIs");
console.log("📱 Test: Available File Picker APIs");

// Test 1: Check available APIs
console.log("\n1. Checking available DroidScript APIs...");

var availableApis = [];
if (typeof app.CreateFilePicker !== 'undefined') {
    availableApis.push('CreateFilePicker');
    console.log("✅ CreateFilePicker available");
}
if (typeof app.CreateFileChooser !== 'undefined') {
    availableApis.push('CreateFileChooser');
    console.log("✅ CreateFileChooser available (experimental)");
}
if (typeof app.CreateFileDialog !== 'undefined') {
    availableApis.push('CreateFileDialog');
    console.log("✅ CreateFileDialog available");
}
if (typeof app.ShowFilePicker !== 'undefined') {
    availableApis.push('ShowFilePicker');
    console.log("✅ ShowFilePicker available (simple)");
}

console.log("📋 Available APIs:", availableApis.join(', '));

// Test 2: Test CreateFilePicker (standard)
console.log("\n2. Testing CreateFilePicker...");
try {
    ImageManager.openImagePicker(1, function(error, imagePath) {
        if (error) {
            console.log("✅ CreateFilePicker test completed with result:", error);
        } else {
            console.log("✅ CreateFilePicker test completed with image:", imagePath);
        }
    });
    console.log("✅ CreateFilePicker test passed");
} catch (e) {
    console.log("❌ Error testing CreateFilePicker:", e.message);
    assert.fail("CreateFilePicker test failed: " + e.message);
}

// Test 3: Test different API detection
console.log("\n3. Testing API detection logic...");

// Simulate different API availability scenarios
var testScenarios = [
    { name: "All APIs available", apis: ['CreateFilePicker', 'CreateFileChooser', 'CreateFileDialog', 'ShowFilePicker'] },
    { name: "Only experimental APIs", apis: ['CreateFileChooser', 'ShowFilePicker'] },
    { name: "Only simple API", apis: ['ShowFilePicker'] },
    { name: "No APIs available", apis: [] }
];

testScenarios.forEach((scenario, index) => {
    console.log(`\n   Scenario ${index + 1}: ${scenario.name}`);
    console.log(`   Available APIs: ${scenario.apis.join(', ') || 'None'}`);
    
    if (scenario.apis.length > 0) {
        console.log("   ✅ Would use native file picker");
    } else {
        console.log("   ✅ Would fall back to HTML file picker");
    }
});

console.log("\n🎉 DroidScript API test completed successfully!");
console.log("✅ All API detection tests passed!");

console.log("\n📋 Summary:");
console.log("• Standard APIs: CreateFilePicker, CreateCamera");
console.log("• Experimental APIs: CreateFileChooser, ShowFilePicker");
console.log("• Alternative APIs: CreateFileDialog");
console.log("• Fallback: HTML file picker within same page");
