// Test dialog functionality
console.log("🧪 Testing Native Dialog");

// Mock DroidScript app object with more realistic behavior
global.app = {
    ShowMessage: function(message, title) {
        console.log("DEBUG: Showing message dialog:", title);
        console.log("DEBUG: Message:", message);
        console.log("DEBUG: MESSAGE DIALOG SHOULD BE VISIBLE NOW");
        return this;
    },
    OpenUrl: function(url) {
        console.log("DEBUG: Opening URL:", url);
        console.log("DEBUG: HTML UPLOAD PAGE SHOULD BE VISIBLE NOW");
        return this;
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
    CreateLayout: function(type, orientation) {
        console.log("DEBUG: Creating layout:", type, orientation);
        return {
            AddChild: function(child) { 
                console.log("DEBUG: Adding child to layout"); 
                return this;
            }
        };
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
            SetPadding: function(l, t, r, b) { console.log("DEBUG: Layout padding:", l, t, r, b); return this; },
            SetBackColor: function(color) { console.log("DEBUG: Layout background:", color); return this; },
            AddChild: function(child) { console.log("DEBUG: Adding child to layout"); return this; }
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
    IsFolder: function(path) { return false; },
    CreateFolder: function(path) { console.log("DEBUG: Creating folder:", path); },
    CopyFile: function(src, dst) { console.log("DEBUG: Copying file:", src, "->", dst); return true; },
    IsFile: function(path) { return true; },
    WriteFile: function(path, data) { console.log("DEBUG: Writing file:", path); return true; },
    DeleteFile: function(path) { console.log("DEBUG: Deleting file:", path); return true; }
};

// Load ImageManager
var ImageManager = require('./ImageManager.js');

function testUploadDialog() {
    console.log("📱 Test: Upload Dialog Creation");
    
    try {
        // Test the upload dialog
        ImageManager.showImageUploadDialog("20", function(error, imagePath) {
            if (error) {
                console.log("❌ Upload failed:", error);
            } else {
                console.log("✅ Upload successful:", imagePath);
            }
        });
        
        console.log("✅ Upload dialog test completed");
        
    } catch (e) {
        console.log("❌ Test failed:", e.message);
    }
}

// Run tests
testUploadDialog();

console.log("🎉 Dialog test completed!");