const https = require('https');

class AICommandAgent {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.debugMode = process.env.NODE_ENV !== 'production';
  }

  /**
   * Process free text input and return structured command sequence
   * @param {string} userInput - The user's free text request
   * @param {Array} notes - Array of notes with id and title
   * @param {Array} availableCommands - Array of available commands
   * @returns {Promise<Object>} - Structured response with commands or clarification
   */
  async processFreeText(userInput, notes, availableCommands) {
    if (!this.apiKey || this.apiKey === 'test-key') {
      return {
        error: 'Gemini API key not set. Use /set-gemini-api-key <key> to set it.',
        clarification_needed: false
      };
    }

    try {
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
        console.log('Sending prompt to Gemini:', prompt.substring(0, 200) + '...');
      }
      
      const response = await this.sendToGemini(prompt);
      if (this.debugMode) {
        console.log('Received response from Gemini');
      }
      
      return this.parseResponse(response, userInput);
    } catch (error) {
      console.error('AICommandAgent error:', error);
      return {
        error: 'Failed to process request with AI. Please try using specific commands.',
        clarification_needed: false
      };
    }
  }

  /**
   * Build the prompt for Gemini API
   */
  buildPrompt(userInput, notesContext, commandsContext) {
    // Limit context size to avoid overwhelming the API
    const limitedNotes = notesContext.slice(0, 50); // Limit to 50 notes max
    const limitedCommands = commandsContext.slice(0, 10); // Limit to 10 commands max
    
    return `Analyze this note management request and respond with JSON.

Request: "${userInput}"

Notes: ${JSON.stringify(limitedNotes)}

Commands: ${JSON.stringify(limitedCommands)}

Respond with JSON:
{
  "understood": "what user wants",
  "commands": [{"command": "/findbyid", "args": ["3"]}],
  "clarification_needed": false
}

If unclear, set clarification_needed=true.`;
  }

  /**
   * Send request to Gemini API
   */
  async sendToGemini(prompt) {
    const postData = JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 2048,
        stopSequences: ["```", "\n\n", "IMPORTANT:"]
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
      ]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              console.error('Gemini API error:', res.statusCode, data);
              reject(`Gemini API error: ${res.statusCode} - ${data}`);
              return;
            }
            
            const response = JSON.parse(data);
            
            // Check for API errors in response
            if (response.error) {
              console.error('Gemini API returned error:', response.error);
              reject(`Gemini API error: ${response.error.message || 'Unknown error'}`);
              return;
            }
            
            resolve(response);
          } catch (error) {
            console.error('Error parsing Gemini API response:', error);
            console.error('Raw response:', data);
            reject('Error: Could not parse response from Gemini API.');
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
   * Parse Gemini response into structured format
   */
  parseResponse(response, userInput = '') {
    try {
      // Add debugging only in debug mode
      if (this.debugMode) {
        console.log('AI Response structure:', JSON.stringify(response, null, 2));
      }
      
      const candidate = response.candidates && response.candidates[0];
      if (!candidate || !candidate.content) {
        console.error('No candidate or content in response:', response);
        return {
          error: 'Invalid response from AI. Please try again.',
          clarification_needed: false
        };
      }

      const parts = candidate.content.parts;
      if (!parts || !Array.isArray(parts) || parts.length === 0) {
        console.error('No parts in candidate content:', candidate.content);
        
        // Check if this is a safety or policy violation
        if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
          return {
            error: 'Request was blocked by safety filters. Please try rephrasing your request.',
            clarification_needed: false
          };
        }
        
        // Check if this is a stop reason with no content
        if (candidate.finishReason === 'STOP' && !candidate.content.parts) {
          // Try to provide a helpful fallback based on the user input
          const lowerInput = userInput.toLowerCase();
          if (lowerInput.includes('create') && lowerInput.includes('note')) {
            return {
              understood: "You want to create a note",
              commands: [{ command: "/createnote", args: [userInput.replace(/create.*note/i, '').trim() || "New Note"] }],
              clarification_needed: false,
              suggestions: [],
              note_matches: []
            };
          } else if (lowerInput.includes('find') || lowerInput.includes('search')) {
            return {
              understood: "You want to find notes",
              commands: [{ command: "/findnote", args: [userInput.replace(/find|search/i, '').trim() || "notes"] }],
              clarification_needed: false,
              suggestions: [],
              note_matches: []
            };
          } else {
            return {
              error: 'AI response was empty. Please try using specific commands like /createnote or /findnote.',
              clarification_needed: false
            };
          }
        }
        
        return {
          error: 'No content parts in AI response. Please try again.',
          clarification_needed: false
        };
      }

      const part = parts[0];
      if (!part || !part.text) {
        console.error('No text in first part:', part);
        return {
          error: 'No text response from AI. Please try again.',
          clarification_needed: false
        };
      }

      // Try to parse JSON response
      if (this.debugMode) {
        console.log('AI response text:', part.text);
      }
      
      // Try multiple JSON extraction patterns
      let jsonMatch = part.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Try to find JSON in code blocks
        jsonMatch = part.text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          jsonMatch[0] = jsonMatch[1];
        }
      }
      
      if (!jsonMatch) {
        // Try to find any JSON-like structure
        jsonMatch = part.text.match(/\{[^{}]*"understood"[^{}]*\}/);
      }
      
      if (!jsonMatch) {
        console.error('No JSON found in AI response:', part.text);
        return {
          error: 'AI response was not in expected JSON format. Please try again.',
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
          const text = part.text;
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
                error: 'AI response contains invalid JSON. Please try again.',
                clarification_needed: false
              };
            }
          } else {
            return {
              error: 'AI response contains invalid JSON. Please try again.',
              clarification_needed: false
            };
          }
        }
      }
      
      // Validate required fields
      if (!parsed.understood || !Array.isArray(parsed.commands)) {
        return {
          error: 'AI response missing required fields. Please try again.',
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
      console.error('Error parsing AI response:', error);
      return {
        error: 'Failed to parse AI response. Please try again.',
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

module.exports = AICommandAgent;
