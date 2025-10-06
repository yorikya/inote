// Test dialog rendering with different approaches
console.log("🧪 Testing Dialog Rendering Approaches");

// Mock DroidScript app object
global.app = {
    ShowMessage: function(message, title) {
        console.log("✅ app.ShowMessage works - Simple dialog approach");
        console.log("DEBUG: Title:", title);
        console.log("DEBUG: Message:", message);
        return this;
    },
    CreateDialog: function(title) {
        console.log("DEBUG: Creating custom dialog:", title);
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
                console.log("DEBUG: Showing custom dialog - DIALOG SHOULD BE VISIBLE NOW");
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
var ImageManager = require('../ImageManager.js');

function testDialogApproaches() {
    console.log("📱 Test: Dialog Rendering Approaches");
    
    try {
        // Test the upload dialog (should use app.ShowMessage first)
        ImageManager.showImageUploadDialog("20", function(error, imagePath) {
            if (error) {
                console.log("✅ Upload cancelled as expected:", error);
            } else {
                console.log("❌ Upload should have been cancelled");
            }
        });
        
        console.log("✅ Dialog rendering test completed");
        
    } catch (e) {
        console.log("❌ Test failed:", e.message);
    }
}

// Run tests
testDialogApproaches();

console.log("🎉 Dialog rendering test completed!");
