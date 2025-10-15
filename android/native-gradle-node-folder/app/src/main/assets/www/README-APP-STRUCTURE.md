# Note Secretary App Structure

## Overview

The Note Secretary app has been restructured to use a single-page application (SPA) architecture with a main frame wrapper that loads the WebSocket client only once. This eliminates duplicate WebSocket connections and provides a unified interface across all pages.

## Architecture

### Main Frame (`app.html`)
- **Purpose**: Main application wrapper that loads once
- **Features**:
  - Loads WebSocket client (`shared-websocket.js`) only once
  - Loads shared utilities (`shared-utils.js`) once
  - Manages page navigation dynamically
  - Provides common UI elements (header, navigation, connection status)
  - Handles WebSocket connection status globally

### Page Structure (`pages/` directory)
- **`chat.html`**: Chat interface content (no full HTML structure)
- **`explorer.html`**: Note explorer content (no full HTML structure)  
- **`settings.html`**: Settings page content (no full HTML structure)

### Shared Components

#### `shared-websocket.js`
- **Purpose**: WebSocket client that maintains a single connection
- **Features**:
  - Persistent WebSocket connection across all pages
  - Service Worker integration for connection management
  - Message queuing and retry logic
  - Connection status management

#### `shared-utils.js`
- **Purpose**: Common utilities and functions used across all pages
- **Features**:
  - Message handling and display
  - Chat history management
  - Image processing utilities
  - Speech recognition and synthesis
  - Toast notifications
  - Form validation
  - URL parameter handling

## Benefits

### 1. Single WebSocket Connection
- **Before**: Each HTML page loaded `shared-websocket.js` separately, potentially creating multiple connections
- **After**: Only one WebSocket connection is established and shared across all pages

### 2. Unified State Management
- **Before**: Each page managed its own state independently
- **After**: Shared settings and state management through `SharedUtils`

### 3. Consistent UI/UX
- **Before**: Each page had its own header, navigation, and connection status
- **After**: Unified header, navigation, and connection status across all pages

### 4. Code Reusability
- **Before**: Duplicate code across pages for common functionality
- **After**: Shared utilities eliminate code duplication

### 5. Better Performance
- **Before**: Full page reloads when navigating between pages
- **After**: Dynamic content loading without full page reloads

## Usage

### Starting the App
1. Open `app.html` in your browser
2. The app will automatically load the chat page
3. Use the navigation menu to switch between pages

### Navigation
- **Chat**: Main chat interface for interacting with the AI
- **Explorer**: Browse and manage notes
- **Settings**: Configure API keys and app settings

### WebSocket Integration
All pages automatically have access to the shared WebSocket connection through:
- `SharedWebSocket` - WebSocket client instance
- `SharedUtils` - Common utilities and functions

## File Structure

```
www/
├── app.html                 # Main application frame
├── shared-websocket.js     # WebSocket client (loaded once)
├── shared-utils.js         # Shared utilities (loaded once)
├── common.css              # Common styles
├── style.css               # Main styles
├── explorer.css            # Explorer-specific styles
├── service-worker.js       # Service worker for WebSocket management
└── pages/                  # Page content (no full HTML structure)
    ├── chat.html           # Chat page content
    ├── explorer.html       # Explorer page content
    └── settings.html       # Settings page content
```

## Migration from Old Structure

### Old Structure Issues
- Each HTML page (`index.html`, `explorer.html`, `settings.html`) loaded `shared-websocket.js` independently
- Potential for multiple WebSocket connections
- Duplicate code across pages
- Full page reloads when navigating

### New Structure Benefits
- Single WebSocket connection shared across all pages
- Unified state management
- Better performance with dynamic loading
- Cleaner code organization
- Consistent user experience

## Development Notes

### Adding New Pages
1. Create a new HTML file in the `pages/` directory
2. Add the page definition to `app.html` in the `pages` object
3. Add navigation button in the side menu
4. Implement page-specific functionality in the new HTML file

### WebSocket Handlers
- Register handlers using `SharedWebSocket.registerHandler(type, callback)`
- Handlers are automatically available across all pages
- Use `SharedUtils.sendToWorker(message)` to send messages

### Shared Utilities
- Use `SharedUtils` for common functionality
- All utilities are available globally
- Settings are managed through `SharedUtils.settings`

## Browser Compatibility

- Modern browsers with WebSocket support
- Service Worker support (for connection management)
- ES6+ JavaScript features
- Web Speech API (for speech recognition/synthesis)

## Performance Considerations

- WebSocket connection is established once and reused
- Page content is loaded dynamically (no full page reloads)
- Shared utilities reduce code duplication
- Service Worker handles connection management in background
