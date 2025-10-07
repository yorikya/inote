const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ImageManager {
    constructor() {
        // Create images directory if it doesn't exist
        this.imagesDir = path.join(__dirname, 'images');
        if (!fs.existsSync(this.imagesDir)) {
            fs.mkdirSync(this.imagesDir, { recursive: true });
        }
    }

    // Get the storage path for a note's images
    getNoteImagePath(noteId) {
        return path.join(this.imagesDir, `note_${noteId}`);
    }

    // Create directory for note images if it doesn't exist
    ensureNoteImageDir(noteId) {
        const noteDir = this.getNoteImagePath(noteId);
        if (!fs.existsSync(noteDir)) {
            fs.mkdirSync(noteDir, { recursive: true });
        }
        return noteDir;
    }

    // Save an image for a note
    saveImage(noteId, imageData, originalName) {
        const noteDir = this.ensureNoteImageDir(noteId);

        // Generate unique filename
        const ext = path.extname(originalName) || '.jpg';
        const hash = crypto.randomBytes(8).toString('hex');
        const filename = `img_${hash}${ext}`;
        const filepath = path.join(noteDir, filename);

        // Save the image
        fs.writeFileSync(filepath, imageData);

        // Return relative path for storage
        return path.relative(__dirname, filepath);
    }

    // Get all images for a note
    getNoteImages(noteId) {
        const noteDir = this.getNoteImagePath(noteId);
        if (!fs.existsSync(noteDir)) {
            return [];
        }

        try {
            const files = fs.readdirSync(noteDir);
            return files.map(file => path.relative(__dirname, path.join(noteDir, file)));
        } catch (error) {
            console.error('Error reading note images:', error);
            return [];
        }
    }

    // Delete an image
    deleteImage(imagePath) {
        try {
            const fullPath = path.join(__dirname, imagePath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting image:', error);
            return false;
        }
    }

    // Delete all images for a note
    deleteNoteImages(noteId) {
        const noteDir = this.getNoteImagePath(noteId);
        if (!fs.existsSync(noteDir)) {
            return true;
        }

        try {
            fs.rmSync(noteDir, { recursive: true, force: true });
            return true;
        } catch (error) {
            console.error('Error deleting note images:', error);
            return false;
        }
    }

    // Check if note has reached image limit (5 images)
    hasReachedImageLimit(noteId) {
        return this.getNoteImages(noteId).length >= 5;
    }
}

module.exports = new ImageManager();
