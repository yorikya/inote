/**
 * Shared Utilities for Note Secretary App
 * Common functions and utilities used across all pages
 */

class SharedUtils {
  constructor() {
    this.settings = {
      lang: "en",
      geminiApiKey: "AIzaSyC9dXJT4ol3i2VoK6aqLjX5S7IMKSjwNC4",
      autoConfirm: false
    };
    this.loadSettings();
  }

  loadSettings() {
    // Load settings from localStorage
    const key = localStorage.getItem('geminiApiKey');
    if (key) this.settings.geminiApiKey = key;
    
    const autoConfirm = localStorage.getItem('globalAutoConfirm');
    if (autoConfirm) this.settings.autoConfirm = autoConfirm === 'true';
  }

  saveSettings() {
    localStorage.setItem('geminiApiKey', this.settings.geminiApiKey);
    localStorage.setItem('globalAutoConfirm', this.settings.autoConfirm.toString());
  }

  // WebSocket communication
  sendToWorker(messageObject) {
    if (window.SharedWebSocket) {
      SharedWebSocket.send(messageObject);
    } else {
      console.error('SharedWebSocket not available');
    }
  }

  // Message handling
  addMessage(text, who, targetElement = 'log') {
    const logEl = document.getElementById(targetElement);
    if (!logEl) return;
    
    const div = document.createElement("div");
    div.className = "msg " + who;
    const mc = document.createElement("div");
    mc.className = "msg-content";
    mc.innerHTML = this.linkifyText(text);
    div.appendChild(mc);
    logEl.appendChild(div);
    this.saveMessageToHistory(text, who);
    this.scrollToBottom(targetElement);
  }

  linkifyText(text) {
    const u = (s) => s.replace(/[&<]/g, c => c === '&' ? '&amp;' : '&lt;');
    return u(text).replace(/(https?:[^\s]+)|(www[^\s]+)/gi, (url) => {
      const href = url.startsWith('www.') ? 'https://' + url : url;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
  }

  scrollToBottom(targetElement = 'log') {
    const logEl = document.getElementById(targetElement);
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
  }

  saveMessageToHistory(text, who) {
    let h = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    h.push({ text, who, timestamp: new Date().toISOString() });
    if (h.length > 100) h = h.slice(-100);
    localStorage.setItem('chatHistory', JSON.stringify(h));
  }

  loadChatHistory(targetElement = 'log') {
    const h = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    const logEl = document.getElementById(targetElement);
    if (!logEl) return;
    
    logEl.innerHTML = '';
    h.forEach(m => this.addMessage(m.text, m.who, targetElement));
  }

  clearChatHistory() {
    localStorage.removeItem('chatHistory');
    const logEl = document.getElementById('log');
    if (logEl) logEl.innerHTML = '';
  }

  // Connection status
  updateConnectionStatus(connected) {
    const statusLed = document.getElementById('statusLed');
    const statusText = document.getElementById('statusText');
    if (!statusLed || !statusText) return;
    
    if (connected) {
      statusLed.className = 'connection-led connected';
      statusText.textContent = 'Connected';
    } else {
      statusLed.className = 'connection-led disconnected';
      statusText.textContent = 'Connecting...';
    }
  }

  // Toast notifications
  showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #333;
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      z-index: 10000;
      font-size: 14px;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  // Image handling
  convertImagePathForDisplay(path) {
    if (!path || path.startsWith('http') || path.startsWith('content://')) return path;
    return `http://127.0.0.1:30000/image/${path}`;
  }

  resizeAndCompressImage(file, callback) {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      let width = img.width, height = img.height;
      if (width > 800) { height = height * 800 / width; width = 800; }
      if (height > 600) { width = width * 600 / height; height = 600; }
      canvas.width = width; 
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
    
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.readAsDataURL(file);
  }

  // HTML escaping
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // Command history
  addToCommandHistory(command) {
    let history = JSON.parse(localStorage.getItem('commandHistory') || '[]');
    history = history.filter(cmd => cmd !== command);
    history.unshift(command);
    if (history.length > 10) history = history.slice(0, 10);
    localStorage.setItem('commandHistory', JSON.stringify(history));
  }

  getCommandHistory() {
    return JSON.parse(localStorage.getItem('commandHistory') || '[]');
  }

  // Speech synthesis
  async speakText(text, lang = null) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang || (this.settings.lang === "he" ? "he-IL" : "en-US");
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Speech synthesis error:', error);
    }
  }

  // Speech recognition
  startSpeechRecognition(callback, lang = null) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.addMessage("❌ Speech Recognition not supported.", "sys");
      return null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang || (this.settings.lang === "he" ? "he-IL" : "en-US");
      
      recognition.onresult = (e) => {
        let final = "", interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          e.results[i].isFinal ? final += transcript : interim += transcript;
        }
        if (callback) callback(final || interim);
      };
      
      recognition.onerror = (e) => {
        this.addMessage("❌ Speech error: " + e.error, "sys");
        recognition.stop();
      };
      
      recognition.start();
      return recognition;
    } catch (error) {
      this.addMessage("❌ Failed to start speech recognition: " + error.message, "sys");
      return null;
    }
  }

  // Modal handling
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('show');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('show');
  }

  // Form validation
  validateRequired(inputs) {
    for (const input of inputs) {
      if (!input.value.trim()) {
        input.focus();
        return false;
      }
    }
    return true;
  }

  // URL parameter handling
  getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle function
  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
}

// Create global instance
const sharedUtilsInstance = new SharedUtils();

// Expose the instance as SharedUtils
window.SharedUtils = sharedUtilsInstance;

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SharedUtils;
}
