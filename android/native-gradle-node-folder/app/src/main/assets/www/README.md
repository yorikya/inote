# 🧪 Note Speaker Test Suite

Simple end-to-end (E2E) test framework for the Note Speaker application using only Node.js and built-in modules.

## 🚀 Quick Start

### Run All Tests
```bash
node test_runner.js all
```

### Run Specific Tests
```bash
# Run individual test
node test_runner.js tests/note_taking_flow.js

# Run using npm scripts
npm test                    # Run all tests
npm run test:note          # Note taking flow
npm run test:basic         # Basic operations
npm run test:editing       # Editing flow
npm run test:subnotes      # Sub-note operations
npm run test:ai            # AI conversation
npm run test:errors         # Error handling
npm run test:example       # Example flow
```

## 📋 Test Suites

### 1. **Note Taking Flow** (`tests/note_taking_flow.js`)
Tests the complete note lifecycle:
- ✅ Create note with confirmation
- ✅ Find note by ID
- ✅ Edit note description
- ✅ Delete note with confirmation

### 2. **Basic Operations** (`tests/basic_operations.js`)
Tests fundamental CRUD operations:
- ✅ Create note
- ✅ Find note by ID
- ✅ Find note by title
- ✅ Show parent notes
- ✅ Delete note

### 3. **Editing Flow** (`tests/editing_flow.js`)
Tests the complete editing workflow:
- ✅ Start description editing mode
- ✅ Add content to description
- ✅ Stop editing with confirmation
- ✅ Verify description update

### 4. **Sub-Note Operations** (`tests/sub_note_operations.js`)
Tests sub-note creation and navigation:
- ✅ Create parent note
- ✅ Create sub-note under parent
- ✅ Select sub-note by ID
- ✅ Edit sub-note description

### 5. **AI Conversation** (`tests/ai_conversation.js`)
Tests AI conversation functionality:
- ✅ Start AI conversation about note
- ✅ Ask AI questions
- ✅ Cancel AI conversation

### 6. **Error Handling** (`tests/error_handling.js`)
Tests error handling and edge cases:
- ✅ Invalid commands
- ✅ Non-existent notes
- ✅ Edit without context
- ✅ Invalid sub-note selection

### 7. **Example Flow** (`tests/example_flow.js`)
Tests your specific example flow:
1. Create note → 2. Find note → 3. Edit description → 4. Find again → 5. Delete

## 🎯 Your Example Flow Test

The framework includes a specific test for your exact example flow:

```
1. User: /createnote test title
2. Agent: Do you want to create a note with title 'test title'? (yes/no)
3. User: yes
4. Agent: Note created successfully! ID: 1, Title: 'test title'
5. User: /findbyid 1
6. Agent: Found note: 'test title' (ID: 1). What would you like to do?
7. User: /editdescription
8. Agent: I'll start description editing mode for 'test title'. Type or record...
9. User: this note describe test
10. Agent: ✅ Added to story description. Continue writing or say 'stop editing description' to finish.
11. User: /stopediting
12. Agent: Do you want to update the description for 'test title' with: 'this note describe test.'? (yes/no)
13. User: yes
14. Agent: ✅ Note description for 'test title' updated successfully!
15. User: /findbyid 1
16. Agent: Found note: 'test title' (ID: 1). What would you like to do?
17. User: /delete
18. Agent: Do you want to delete the note 'test title'? (yes/no)
19. User: yes
20. Agent: Note 'test title' deleted successfully!
```

## 🔧 Test Structure

Each test file must:
1. **Export a `run` function** that contains the test logic
2. **Use `assert`** for assertions
3. **Simulate user interactions** and expected responses
4. **Record test steps** for debugging

## 📊 Test Reports

The framework provides comprehensive test reports including:
- **Total Tests**: Number of tests run
- **Passed/Failed**: Success/failure counts
- **Success Rate**: Percentage of tests passed
- **Failed Tests**: Details of any failures
- **Duration**: Time taken to run tests

## 🎉 Success Criteria

A successful test run should show:
- ✅ All tests passed
- 🎉 100% success rate
- 📊 Comprehensive coverage of all functionality

## 📁 Project Structure

```
my_assitant/
├── test_runner.js              # Main test runner
├── package.json                # npm scripts and metadata
├── README.md                   # This file
└── tests/                      # Test files directory
    ├── note_taking_flow.js     # Complete note lifecycle
    ├── basic_operations.js     # CRUD operations
    ├── editing_flow.js         # Editing workflow
    ├── sub_note_operations.js  # Sub-note functionality
    ├── ai_conversation.js      # AI conversation
    ├── error_handling.js       # Error handling
    └── example_flow.js         # Your specific example
```

## 🚀 Usage Examples

```bash
# Run all tests
node test_runner.js all

# Run specific test
node test_runner.js tests/example_flow.js

# Run with npm
npm test
npm run test:example
```

## 🎯 Key Features

- **✅ No frameworks** - Just Node.js and built-in modules
- **✅ Simple usage** - `node test_runner.js <test_file>`
- **✅ Clear output** - Step-by-step test execution
- **✅ Test summary** - Pass/fail rates and duration
- **✅ Easy to extend** - Add new test files easily
- **✅ Comprehensive coverage** - All major functionality tested

This gives you a lightweight, framework-free E2E testing system that's exactly what you requested! 🎉
