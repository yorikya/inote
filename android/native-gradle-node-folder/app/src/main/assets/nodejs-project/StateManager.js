const state = new Map();

const StateManager = {
  initializeState(ws) {
    state.set(ws, {
      mode: 'initial',
      autoConfirm: false,
      findContext: {
        notes: [],
        selectedNote: null,
      },
      pendingConfirmation: null,
      parameterCollection: null,
      aiCommandConfirmation: null,
    });
  },
  setAutoConfirm(ws, enabled) {
    const currentState = state.get(ws);
    if (currentState) {
      currentState.autoConfirm = enabled;
      state.set(ws, currentState);
    }
  },
  getAutoConfirm(ws) {
    const currentState = state.get(ws);
    return currentState ? currentState.autoConfirm : false;
  },

  getState(ws) {
    return state.get(ws);
  },

  setState(ws, newState) {
    state.set(ws, { ...state.get(ws), ...newState });
  },

  clearState(ws) {
    state.delete(ws);
  },

  clearAllStates() {
    state.clear();
  },
};

module.exports = StateManager;