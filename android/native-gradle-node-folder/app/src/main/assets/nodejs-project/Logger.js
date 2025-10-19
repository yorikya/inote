const fs = require('fs');
const path = require('path');

/**
 * Logger - Handles file logging with rotation and AI action tracking
 */
class Logger {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(__dirname, 'logs');
    this.maxFileSize = options.maxFileSize || 5 * 1024 * 1024; // 5MB
    this.maxFiles = options.maxFiles || 5;
    this.logFile = path.join(this.logDir, 'app.log');
    this.currentFileSize = 0;
    
    // Ensure log directory exists
    this.ensureLogDir();
    
    // Get current file size
    this.updateFileSize();
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Update current file size
   */
  updateFileSize() {
    if (fs.existsSync(this.logFile)) {
      const stats = fs.statSync(this.logFile);
      this.currentFileSize = stats.size;
    } else {
      this.currentFileSize = 0;
    }
  }

  /**
   * Rotate log files if needed
   */
  rotateLogs() {
    if (this.currentFileSize >= this.maxFileSize) {
      // Move existing files
      for (let i = this.maxFiles - 1; i > 0; i--) {
        const oldFile = path.join(this.logDir, `app.log.${i}`);
        const newFile = path.join(this.logDir, `app.log.${i + 1}`);
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxFiles - 1) {
            // Delete the oldest file
            fs.unlinkSync(oldFile);
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }
      
      // Move current log to .1
      const rotatedFile = path.join(this.logDir, 'app.log.1');
      if (fs.existsSync(this.logFile)) {
        fs.renameSync(this.logFile, rotatedFile);
      }
      
      // Reset file size
      this.currentFileSize = 0;
    }
  }

  /**
   * Write log entry to file
   */
  writeLog(level, message, prefix = '') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${prefix}${message}\n`;
    
    // Rotate if needed
    this.rotateLogs();
    
    // Write to file
    fs.appendFileSync(this.logFile, logEntry);
    
    // Update file size
    this.updateFileSize();
  }

  /**
   * Log AI action with special prefix
   */
  aiAction(message) {
    this.writeLog('AI_ACT_AGENT', message, '[AI_ACT_AGENT] ');
  }

  /**
   * Log AI command processing
   */
  aiCommand(message) {
    this.writeLog('AI_CMD', message, '[AI_CMD] ');
  }

  /**
   * Log AI response
   */
  aiResponse(message) {
    this.writeLog('AI_RESP', message, '[AI_RESP] ');
  }

  /**
   * Log AI error
   */
  aiError(message) {
    this.writeLog('AI_ERR', message, '[AI_ERR] ');
  }

  /**
   * Log general info
   */
  info(message) {
    this.writeLog('INFO', message);
  }

  /**
   * Log warning
   */
  warn(message) {
    this.writeLog('WARN', message);
  }

  /**
   * Log error
   */
  error(message) {
    this.writeLog('ERROR', message);
  }

  /**
   * Log debug
   */
  debug(message) {
    this.writeLog('DEBUG', message);
  }

  /**
   * Get log file content
   */
  getLogContent() {
    try {
      if (fs.existsSync(this.logFile)) {
        return fs.readFileSync(this.logFile, 'utf8');
      }
      return 'No log file found.';
    } catch (error) {
      return `Error reading log file: ${error.message}`;
    }
  }

  /**
   * Get all log files (including rotated ones)
   */
  getAllLogFiles() {
    const files = [];
    
    // Current log file
    if (fs.existsSync(this.logFile)) {
      files.push({
        name: 'app.log',
        path: this.logFile,
        size: fs.statSync(this.logFile).size
      });
    }
    
    // Rotated log files
    for (let i = 1; i <= this.maxFiles; i++) {
      const rotatedFile = path.join(this.logDir, `app.log.${i}`);
      if (fs.existsSync(rotatedFile)) {
        files.push({
          name: `app.log.${i}`,
          path: rotatedFile,
          size: fs.statSync(rotatedFile).size
        });
      }
    }
    
    return files;
  }

  /**
   * Get combined log content from all files
   */
  getCombinedLogContent() {
    const files = this.getAllLogFiles();
    let combinedContent = '';
    
    // Read files in reverse order (newest first)
    files.reverse().forEach(file => {
      try {
        const content = fs.readFileSync(file.path, 'utf8');
        combinedContent += `\n=== ${file.name} (${file.size} bytes) ===\n`;
        combinedContent += content;
        combinedContent += '\n';
      } catch (error) {
        combinedContent += `\n=== Error reading ${file.name} ===\n`;
        combinedContent += `Error: ${error.message}\n`;
      }
    });
    
    return combinedContent;
  }

  /**
   * Clear all log files
   */
  clearLogs() {
    try {
      // Clear current log file
      if (fs.existsSync(this.logFile)) {
        fs.writeFileSync(this.logFile, '');
      }
      
      // Clear rotated log files
      for (let i = 1; i <= this.maxFiles; i++) {
        const rotatedFile = path.join(this.logDir, `app.log.${i}`);
        if (fs.existsSync(rotatedFile)) {
          fs.unlinkSync(rotatedFile);
        }
      }
      
      this.currentFileSize = 0;
      return true;
    } catch (error) {
      console.error('Error clearing logs:', error);
      return false;
    }
  }

  /**
   * Get log statistics
   */
  getLogStats() {
    const files = this.getAllLogFiles();
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    return {
      totalFiles: files.length,
      totalSize: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      maxFileSize: this.maxFileSize,
      maxFiles: this.maxFiles,
      files: files
    };
  }
}

// Create singleton instance
const logger = new Logger({
  logDir: path.join(__dirname, 'logs'),
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 5
});

module.exports = logger;
