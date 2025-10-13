# Note Speaker

**Note Speaker** is a sophisticated note-taking application that revolutionizes personal information management through conversational AI interaction. The application serves as an intelligent personal assistant for creating, organizing, and interacting with notes using natural language.

This project is currently undergoing a migration from its original DroidScript backend to a new, more robust backend powered by **Node.js on Mobile**.

## Project Goal and Vision

The primary goal of **Note Speaker** is to provide a seamless and intelligent note-taking experience based on a **voice-first, context-aware** design philosophy.

### Core Capabilities:
- **Conversational Note Management**: Create, edit, and organize notes through natural language commands.
- **Hierarchical Organization**: Support parent-child note relationships for complex project management.
- **AI-Powered Assistance**: Provide contextual help and suggestions using the Gemini API.
- **Visual and Voice Interface**: Combine a chat-based interface with a visual note explorer.
- **Real-time Synchronization**: Maintain a live connection between the frontend and the backend.

## Migration to Node.js Backend

### Current Status

The project has been successfully migrated to run on a Node.js backend. The basic functionalities, such as serving the frontend, handling WebSocket connections, and performing CRUD operations on notes, are in place. However, several advanced features from the original DroidScript version are yet to be implemented.

### Development Roadmap

Here is a list of the major features and capabilities that are next on the development roadmap:

#### 1. Stateful Conversational Flows

The current backend is largely stateless. The next step is to implement a state management system to handle multi-step conversational flows.

- **Confirmation Prompts**: The backend needs to ask for confirmation before performing critical actions (e.g., creating or deleting notes).
- **Context-Aware Commands**: Implement logic to handle contextual commands (e.g., running `/editdescription` on a note that was just found).
- **Story Editing Mode**: Add the dedicated mode for editing long-form note descriptions.

#### 2. Comprehensive Command Router and NLP

The command handling needs to be expanded to support natural language and the full range of commands.

- **Natural Language Intent Detection**: Implement a more sophisticated command router that can understand natural language commands (e.g., "create a new note") in addition to slash commands.
- **Full Command Implementation**: Add support for all the commands from the original application, including `/markdone`, `/delete`, `/createsub`, and `/talkai`.

#### 3. Full AI Integration

The current AI service is a stub and needs to be fully integrated.

- **Contextual AI Conversations**: Implement the `AIService` to handle contextual conversations about notes using the Gemini API.
- **AI-Powered Suggestions**: Explore and implement AI-powered features like daily summaries and automatic note organization.

#### 4. Native-like Features

Features that relied on the DroidScript environment need to be re-architected for the new Node.js environment.

- **Image/File Picker**: Develop a new solution for image uploads. This will likely involve the frontend (WebView) initiating the file selection and sending the data to the backend.

## Getting Started

### Prerequisites (recommended versions):
- Java JDK 8 (1.8)
- Android Studio (use the bundled Gradle and SDK manager)
- Android SDK Platform Tools & SDK Build-Tools 25.0.3
- CMake (install from the Android SDK Manager)
- Gradle: use the included Gradle wrapper.
- Node.js and npm (latest LTS recommended)

### Build & Setup

1. Clone the repository.
2. Create the node project and install npm deps:

```bash
# from the repository root
cd android/native-gradle-node-folder/app/src/main/assets/nodejs-project
npm install
node min.js # run the server

// or

npm run start
```

3. Download the "Node.js on Mobile" shared library zip (the sample used `nodejs-mobile-v0.1.6`):
	 - https://github.com/janeasystems/nodejs-mobile/releases/download/nodejs-mobile-v0.1.6/nodejs-mobile-v0.1.6-android.zip
4. Copy the `bin/` folder from the downloaded zip to the sample's `app/libnode` folder so the binaries are available to the app at runtime. After copying you should have:

```text
android/native-gradle-node-folder/app/libnode/bin/arm64-v8a/libnode.so
android/native-gradle-node-folder/app/libnode/bin/armeabi-v7a/libnode.so
android/native-gradle-node-folder/app/libnode/bin/x86/libnode.so
android/native-gradle-node-folder/app/libnode/bin/x86_64/libnode.so
```

5. Open the Android project in Android Studio by importing the Gradle project at `android/native-gradle-node-folder/`.
6. Build & Run the app on a device.

### How to Build

1.  Navigate to the Android project directory:

    ```bash
    cd android/native-gradle-node-folder/
    ```

2.  Run the Gradle build command:

    ```bash
    ./gradlew clean assembleDebug
    ```

// or `npm run build`

### How to Run Tests

The project includes an end-to-end test suite to verify the core conversational flows of the Node.js backend.

1.  Navigate to the Node.js project directory:

    ```bash
    cd android/native-gradle-node-folder/app/src/main/assets/nodejs-project
    ```

2.  Run the test script:

    ```bash
    npm run test
    ```

    This will execute the tests in the `test/` directory and report the results.




### Notes & Troubleshooting
- The sample copies the `nodejs-project` and `www` folders from assets to the application's FilesDir at runtime.
- The Node.js entry point is `min.js`.
- If Gradle/Android Studio prompts for SDK build-tools or CMake, install the versions it requests.