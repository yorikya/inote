const test = require('node:test');
const assert = require('node:assert');
const EventEmitter = require('events');
const StateManager = require('../../StateManager');

// Create a mock WebSocket for testing
class MockWebSocket extends EventEmitter {
    send(data) {
        this.emit('sent', data);
    }
}

test('StateManager.initializeState', (t) => {
    const ws = new MockWebSocket();

    // Initialize state
    StateManager.initializeState(ws);

    // Check that state was initialized
    const state = StateManager.getState(ws);
    assert.strictEqual(state.mode, 'idle');
    assert.strictEqual(state.autoConfirm, false);
    assert.deepStrictEqual(state.pendingConfirmation, null);
    assert.deepStrictEqual(state.findContext, null);
});

test('StateManager.setState', (t) => {
    const ws = new MockWebSocket();

    // Initialize state
    StateManager.initializeState(ws);

    // Set new state
    StateManager.setState(ws, { mode: 'test_mode' });

    // Check that state was updated
    const state = StateManager.getState(ws);
    assert.strictEqual(state.mode, 'test_mode');

    // Set multiple properties
    StateManager.setState(ws, { 
        mode: 'another_mode',
        testProp: 'test_value'
    });

    // Check that both properties were updated
    const updatedState = StateManager.getState(ws);
    assert.strictEqual(updatedState.mode, 'another_mode');
    assert.strictEqual(updatedState.testProp, 'test_value');
});

test('StateManager.setAutoConfirm', (t) => {
    const ws = new MockWebSocket();

    // Initialize state
    StateManager.initializeState(ws);

    // Enable auto-confirm
    StateManager.setAutoConfirm(ws, true);

    // Check that auto-confirm was enabled
    assert.strictEqual(StateManager.getAutoConfirm(ws), true);

    // Disable auto-confirm
    StateManager.setAutoConfirm(ws, false);

    // Check that auto-confirm was disabled
    assert.strictEqual(StateManager.getAutoConfirm(ws), false);
});

test('StateManager.clearState', (t) => {
    const ws = new MockWebSocket();

    // Initialize state and set some values
    StateManager.initializeState(ws);
    StateManager.setState(ws, { mode: 'test_mode', testProp: 'test_value' });
    StateManager.setAutoConfirm(ws, true);

    // Clear state
    StateManager.clearState(ws);

    // Check that state was cleared
    const state = StateManager.getState(ws);
    assert.strictEqual(state, undefined);
});
