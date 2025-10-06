// Simple Upload Test
// Tests the native DroidScript upload functionality

console.log("🧪 Testing Native Image Upload");

// Mock DroidScript app object
global.app = {
    CreateDialog: function(title) {
        console.log("DEBUG: Creating dialog:", title);
        return {
            SetSize: function(w, h) { console.log("DEBUG: Dialog size:", w, h); },
            AddLayout: function(layout) { console.log("DEBUG: Adding layout to dialog"); },
            Show: function() { console.log("DEBUG: Showing dialog"); },
            Close: function() { console.log("DEBUG: Closing dialog"); }
        };
    },
    CreateLayout: function(type, orientation) {
        console.log("DEBUG: Creating layout:", type, orientation);
        return {
            SetPadding: function(p) { console.log("DEBUG: Setting padding:", p); },
            SetBackColor: function(color) { console.log("DEBUG: Setting background:", color); },
            AddChild: function(child) { console.log("DEBUG: Adding child to layout"); }
        };
    },
    CreateText: function(text, w, h, type) {
        console.log("DEBUG: Creating text:", text);
        return {
            SetTextSize: function(size) { console.log("DEBUG: Setting text size:", size); },
            SetTextColor: function(color) { console.log("DEBUG: Setting text color:", color); }
        };
    },
    CreateButton: function(text) {
        console.log("DEBUG: Creating button:", text);
        return {
            SetSize: function(w, h) { console.log("DEBUG: Button size:", w, h); },
            SetBackColor: function(color) { console.log("DEBUG: Button background:", color); },
            SetTextColor: function(color) { console.log("DEBUG: Button text color:", color); },
            SetTextSize: function(size) { console.log("DEBUG: Button text size:", size); },
            SetMargins: function(m) { console.log("DEBUG: Button margins:", m); },
            SetOnTouch: function(callback) { console.log("DEBUG: Setting button callback"); }
        };
    },
    CreateFilePicker: function() {
        console.log("DEBUG: Creating file picker");
        return {
            SetType: function(type) { console.log("DEBUG: Setting picker type:", type); },
            SetOnResult: function(callback) { console.log("DEBUG: Setting picker callback"); },
            Show: function() { console.log("DEBUG: Showing file picker"); },
            GetFile: function() { return "test_image.jpg"; }
        };
    },
    CreateCamera: function() {
        console.log("DEBUG: Creating camera");
        return {
            SetOnResult: function(callback) { console.log("DEBUG: Setting camera callback"); },
            Show: function() { console.log("DEBUG: Showing camera"); },
            GetFile: function() { return "test_photo.jpg"; }
        };
    },
    IsFolder: function(path) { return false; },
    CreateFolder: function(path) { console.log("DEBUG: Creating folder:", path); },
    CopyFile: function(src, dst) { console.log("DEBUG: Copying file:", src, "->", dst); return true; },
    IsFile: function(path) { return true; }
};

// Load ImageManager
const ImageManager = require('./ImageManager.js');

// Test the upload dialog
console.log("📱 Test 1: Upload Dialog Creation");
try {
    ImageManager.showImageUploadDialog('20', function(error, imagePath) {
        if (error) {
            console.log("❌ Upload failed:", error);
        } else {
            console.log("✅ Upload successful:", imagePath);
        }
    });
    console.log("✅ Upload dialog test passed");
} catch (error) {
    console.log("❌ Upload dialog test failed:", error.message);
}

// Test image picker
console.log("📷 Test 2: Image Picker");
try {
    ImageManager.openImagePicker('20', function(error, imagePath) {
        if (error) {
            console.log("❌ Image picker failed:", error);
        } else {
            console.log("✅ Image picker successful:", imagePath);
        }
    });
    console.log("✅ Image picker test passed");
} catch (error) {
    console.log("❌ Image picker test failed:", error.message);
}

// Test camera
console.log("📸 Test 3: Camera");
try {
    ImageManager.openCamera('20', function(error, imagePath) {
        if (error) {
            console.log("❌ Camera failed:", error);
        } else {
            console.log("✅ Camera successful:", imagePath);
        }
    });
    console.log("✅ Camera test passed");
} catch (error) {
    console.log("❌ Camera test failed:", error.message);
}

console.log("🎉 All tests completed!");
