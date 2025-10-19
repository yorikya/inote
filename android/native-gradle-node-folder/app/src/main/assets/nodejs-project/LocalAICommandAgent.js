const http = require('http');

class LocalAICommandAgent {
  constructor(model = 'llama3.2:1b', host = '127.0.0.1', port = 11434) {
    this.model = model;
    this.host = host;
    this.port = port;
    this.debugMode = process.env.NODE_ENV !== 'production';
    this.fallbackToKeywordMatching = true; // Enable fallback for mobile
  }

  /**
   * Process free text input and return structured command sequence using local Ollama
   * @param {string} userInput - The user's free text request
   * @param {Array} notes - Array of notes with id and title
   * @param {Array} availableCommands - Array of available commands
   * @returns {Promise<Object>} - Structured response with commands or clarification
   */
  async processFreeText(userInput, notes, availableCommands) {
    try {
      // Try Ollama first (for development/desktop)
      if (await this.isOllamaAvailable()) {
        return await this.processWithOllama(userInput, notes, availableCommands);
      }
    } catch (error) {
      console.log('Ollama not available, using fallback...');
    }
    
    // Fallback to keyword matching for mobile
    if (this.fallbackToKeywordMatching) {
      return this.processWithKeywordMatching(userInput, notes, availableCommands);
    }
    
    return {
      error: 'AI processing not available. Please use specific commands like /createnote, /findnote, etc.',
      clarification_needed: false
    };
  }

  async isOllamaAvailable() {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: this.host,
        port: this.port,
        path: '/api/tags',
        method: 'GET',
        timeout: 1000
      }, (res) => {
        resolve(res.statusCode === 200);
      });
      
      req.on('error', () => resolve(false));
      req.on('timeout', () => resolve(false));
      req.end();
    });
  }

  async processWithOllama(userInput, notes, availableCommands) {
    // Build optimized context with only ID and title
    const notesContext = notes.map(note => ({
      id: note.id,
      title: note.title
    }));

    // Build command context
    const commandsContext = availableCommands.map(cmd => ({
      command: cmd.command,
      description: cmd.description,
      requiresParam: cmd.requiresParam
    }));

    const prompt = this.buildPrompt(userInput, notesContext, commandsContext);
    if (this.debugMode) {
      console.log('Sending prompt to Ollama:', prompt.substring(0, 200) + '...');
    }
    
    const response = await this.sendToOllama(prompt);
    if (this.debugMode) {
      console.log('Received response from Ollama');
    }
    
    return this.parseResponse(response, userInput);
  }

  processWithKeywordMatching(userInput, notes, availableCommands) {
    const lowerInput = userInput.toLowerCase();
    
    // Create note pattern
    if (lowerInput.includes('create') && lowerInput.includes('note') && !lowerInput.includes('sub')) {
      const noteTitle = userInput.replace(/create.*note/i, '').trim() || "New Note";
      return {
        understood: `Create note "${noteTitle}"`,
        commands: [{ command: "/createnote", args: [noteTitle] }],
        clarification_needed: false,
        suggestions: [],
        note_matches: []
      };
    }
    
    // Create sub-note pattern
    if (lowerInput.includes('create') && lowerInput.includes('sub') && lowerInput.includes('note')) {
      // Try to extract sub-note title and parent note
      const subNoteMatch = userInput.match(/create.*sub.*note.*for\s+(.+?)\s+under\s+(.+)/i) ||
                           userInput.match(/create.*subnote\s+(.+?)\s+under\s+(.+)/i);
      
      if (subNoteMatch) {
        const subNoteTitle = subNoteMatch[1].trim();
        const parentNoteTitle = subNoteMatch[2].trim();
        
        // Find matching parent note
        const matchingNotes = notes.filter(note => 
          note.title.toLowerCase().includes(parentNoteTitle.toLowerCase())
        );
        
        if (matchingNotes.length === 1) {
          return {
            understood: `Create sub-note "${subNoteTitle}" under "${matchingNotes[0].title}"`,
            commands: [
              { command: "/findbyid", args: [matchingNotes[0].id] },
              { command: "/createsubnote", args: [subNoteTitle] }
            ],
            clarification_needed: false,
            suggestions: [],
            note_matches: []
          };
        } else if (matchingNotes.length > 1) {
          return {
            understood: `Create sub-note "${subNoteTitle}" under a parent note`,
            commands: [
              { command: "/findnote", args: [parentNoteTitle] },
              { command: "/createsubnote", args: [subNoteTitle] }
            ],
            clarification_needed: false,
            suggestions: [],
            note_matches: matchingNotes.map(n => ({ id: n.id, title: n.title }))
          };
        }
      }
    }
    
    // Find note pattern
    if (lowerInput.includes('find') || lowerInput.includes('search')) {
      const searchTerm = userInput.replace(/find|search/i, '').trim() || "notes";
      return {
        understood: `Find notes matching "${searchTerm}"`,
        commands: [{ command: "/findnote", args: [searchTerm] }],
        clarification_needed: false,
        suggestions: [],
        note_matches: []
      };
    }
    
    // Default fallback
    return {
      error: 'Could not understand your request. Try using specific commands like /createnote, /findnote, etc.',
      clarification_needed: false
    };
  }

  /**
   * Build the prompt for Ollama
   */
  buildPrompt(userInput, notesContext, commandsContext) {
    // Limit context size to avoid overwhelming the model
    const limitedNotes = notesContext.slice(0, 20); // Limit to 20 notes max
    const limitedCommands = commandsContext.slice(0, 8); // Limit to 8 commands max
    
    return `You are a command interpreter. Respond with ONLY valid JSON, no other text.

Request: "${userInput}"

Notes: ${JSON.stringify(limitedNotes)}

Commands: ${JSON.stringify(limitedCommands)}

Return JSON:
{"understood":"what user wants","commands":[{"command":"/findbyid","args":["3"]}],"clarification_needed":false}`;
  }

  /**
   * Send request to Ollama API
   */
  async sendToOllama(prompt) {
    const postData = JSON.stringify({
      model: this.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.8,
        max_tokens: 512
      }
    });

    const options = {
      hostname: this.host,
      port: this.port,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              console.error('Ollama API error:', res.statusCode, data);
              reject(`Ollama API error: ${res.statusCode} - ${data}`);
              return;
            }
            
            const response = JSON.parse(data);
            
            // Check for API errors in response
            if (response.error) {
              console.error('Ollama API returned error:', response.error);
              reject(`Ollama API error: ${response.error}`);
              return;
            }
            
            resolve(response);
          } catch (error) {
            console.error('Error parsing Ollama API response:', error);
            console.error('Raw response:', data);
            reject('Error: Could not parse response from Ollama API.');
          }
        });
      });

      req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
        reject(`Problem with request: ${e.message}`);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Parse Ollama response into structured format
   */
  parseResponse(response, userInput = '') {
    try {
      // Add debugging only in debug mode
      if (this.debugMode) {
        console.log('Ollama Response structure:', JSON.stringify(response, null, 2));
      }
      
      if (!response.response) {
        console.error('No response in Ollama output:', response);
        return {
          error: 'Invalid response from local AI. Please try again.',
          clarification_needed: false
        };
      }

      const responseText = response.response;
      if (this.debugMode) {
        console.log('Ollama response text:', responseText);
      }
      
      // Try to parse JSON response - look for JSON anywhere in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in Ollama response:', responseText);
        
        // Try to extract basic intent from the text as fallback
        const lowerText = responseText.toLowerCase();
        if (lowerText.includes('create') && lowerText.includes('note')) {
          const noteTitle = userInput.replace(/create.*note/i, '').trim() || "New Note";
          return {
            understood: `Create note "${noteTitle}"`,
            commands: [{ command: "/createnote", args: [noteTitle] }],
            clarification_needed: false,
            suggestions: [],
            note_matches: []
          };
        } else if (lowerText.includes('find') || lowerText.includes('search')) {
          const searchTerm = userInput.replace(/find|search/i, '').trim() || "notes";
          return {
            understood: `Find notes matching "${searchTerm}"`,
            commands: [{ command: "/findnote", args: [searchTerm] }],
            clarification_needed: false,
            suggestions: [],
            note_matches: []
          };
        }
        
        return {
          error: 'Local AI response was not in expected JSON format. Please try again.',
          clarification_needed: false
        };
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('Failed to parse JSON:', jsonMatch[0], parseError);
        
        // Try to fix incomplete JSON
        let fixedJson = jsonMatch[0];
        
        // If JSON is incomplete, try to close it
        if (fixedJson.includes('"args"') && !fixedJson.includes(']')) {
          // Find the last incomplete array and close it
          const lastBracket = fixedJson.lastIndexOf('[');
          if (lastBracket !== -1) {
            const beforeBracket = fixedJson.substring(0, lastBracket);
            const afterBracket = fixedJson.substring(lastBracket);
            
            // Count unclosed brackets
            let openBrackets = 0;
            let openBraces = 0;
            for (let i = 0; i < afterBracket.length; i++) {
              if (afterBracket[i] === '[') openBrackets++;
              if (afterBracket[i] === ']') openBrackets--;
              if (afterBracket[i] === '{') openBraces++;
              if (afterBracket[i] === '}') openBraces--;
            }
            
            // Close the JSON
            fixedJson = beforeBracket + afterBracket;
            for (let i = 0; i < openBrackets; i++) fixedJson += ']';
            for (let i = 0; i < openBraces; i++) fixedJson += '}';
          }
        }
        
        // Try parsing the fixed JSON
        try {
          parsed = JSON.parse(fixedJson);
          console.log('Successfully fixed incomplete JSON');
        } catch (fixError) {
          console.error('Could not fix JSON:', fixError);
          
          // Last resort: try to extract basic info from the text
          const text = responseText;
          const understoodMatch = text.match(/"understood":\s*"([^"]+)"/);
          const commandMatches = text.match(/"command":\s*"([^"]+)"/g);
          const argsMatches = text.match(/"args":\s*\[([^\]]*)\]/g);
          
          if (understoodMatch && commandMatches) {
            console.log('Attempting to extract info from malformed JSON');
            const commands = [];
            
            for (let i = 0; i < commandMatches.length; i++) {
              const cmdMatch = commandMatches[i].match(/"command":\s*"([^"]+)"/);
              if (cmdMatch) {
                const command = cmdMatch[1];
                let args = [];
                
                if (argsMatches && argsMatches[i]) {
                  const argsText = argsMatches[i].match(/"args":\s*\[([^\]]*)\]/);
                  if (argsText && argsText[1]) {
                    // Extract quoted strings from args
                    const argMatches = argsText[1].match(/"([^"]+)"/g);
                    if (argMatches) {
                      args = argMatches.map(arg => arg.replace(/"/g, ''));
                    }
                  }
                }
                
                commands.push({ command, args });
              }
            }
            
            if (commands.length > 0) {
              parsed = {
                understood: understoodMatch[1],
                commands: commands,
                clarification_needed: false,
                suggestions: [],
                note_matches: []
              };
              console.log('Successfully extracted info from malformed JSON');
            } else {
              return {
                error: 'Local AI response contains invalid JSON. Please try again.',
                clarification_needed: false
              };
            }
          } else {
            return {
              error: 'Local AI response contains invalid JSON. Please try again.',
              clarification_needed: false
            };
          }
        }
      }
      
      // Validate required fields
      if (!parsed.understood || !Array.isArray(parsed.commands)) {
        return {
          error: 'Local AI response missing required fields. Please try again.',
          clarification_needed: false
        };
      }

      return {
        understood: parsed.understood,
        commands: parsed.commands,
        clarification_needed: parsed.clarification_needed || false,
        suggestions: parsed.suggestions || [],
        note_matches: parsed.note_matches || []
      };
    } catch (error) {
      console.error('Error parsing Ollama response:', error);
      return {
        error: 'Failed to parse local AI response. Please try again.',
        clarification_needed: false
      };
    }
  }

  /**
   * Generate clarification message for ambiguous requests
   */
  generateClarificationMessage(aiResponse) {
    let message = `I need clarification for your request:\n\n`;
    message += `**What I understood:** ${aiResponse.understood}\n\n`;
    
    if (aiResponse.suggestions && aiResponse.suggestions.length > 0) {
      message += `**Suggestions:**\n`;
      aiResponse.suggestions.forEach((suggestion, index) => {
        message += `${index + 1}. ${suggestion}\n`;
      });
      message += `\n`;
    }
    
    if (aiResponse.note_matches && aiResponse.note_matches.length > 0) {
      message += `**Found multiple matching notes:**\n`;
      aiResponse.note_matches.forEach((note, index) => {
        message += `${index + 1}. "${note.title}" (ID: ${note.id})\n`;
      });
      message += `\nPlease be more specific or use a note ID.\n`;
    }
    
    message += `\nYou can also use /back to return to the main menu.`;
    
    return message;
  }

  /**
   * Generate confirmation message for proposed commands
   */
  generateConfirmationMessage(aiResponse) {
    let message = `I understand you want to:\n\n`;
    message += `**${aiResponse.understood}**\n\n`;
    message += `**Proposed actions:**\n`;
    
    aiResponse.commands.forEach((cmd, index) => {
      const args = cmd.args && cmd.args.length > 0 ? cmd.args.join(' ') : '';
      message += `${index + 1}. ${cmd.command}${args ? ' ' + args : ''}\n`;
    });
    
    message += `\nDo you want me to proceed? (yes/no)`;
    
    return message;
  }
}

module.exports = LocalAICommandAgent;
