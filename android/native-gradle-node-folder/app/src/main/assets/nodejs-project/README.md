# native-gradle-node-project

This folder contains a minimal Node.js backend bundled as app assets for development and local testing.

How to run locally

1. Install dependencies (once):

```bash
cd android/native-gradle-node-folder/app/src/main/assets/nodejs-project
npm install --no-audit --no-fund
```

2. Start the server:

```bash
# foreground
node min.js

# or background
nohup node min.js > min.log 2>&1 & disown
```

3. Open the frontend UI in your browser:

```
http://127.0.0.1:30000/
```

Notes

- Uploaded images are stored under `images/` relative to this folder when uploaded as base64 via WebSocket.
- The frontend (in `../www`) has been copied from the original note-speaker project and patched to auto-detect emulator host (10.0.2.2).
- To test uploads from the web UI, use the upload modal; the frontend sends `upload_file` messages over WebSocket with `fileData` (base64) or `imagePath` pointing to a native path.

Next steps

- Wire real AI integration in `AIService.js` if you provide API credentials.
- Add automated tests for `NoteManager`.
