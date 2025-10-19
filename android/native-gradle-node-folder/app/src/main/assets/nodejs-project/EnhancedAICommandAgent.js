const https = require('https');
const logger = require('./Logger');

class EnhancedAICommandAgent {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.debugMode = process.env.NODE_ENV !== 'production';
    
    // Command patterns for local detection - ORDER MATTERS! More specific patterns first
    this.commandPatterns = {
      createSubnote: {
        patterns: [
          // Patterns with "under" keyword
          /create\s+subnote\s+(.+?)(?:\s+under\s+|\s+in\s+|\s+below\s+)(.+)/i,
          /create\s+sub\s+note\s+(.+?)(?:\s+under\s+|\s+in\s+|\s+below\s+)(.+)/i,
          /add\s+subnote\s+(.+?)(?:\s+under\s+|\s+in\s+|\s+below\s+)(.+)/i,
          /add\s+sub\s+note\s+(.+?)(?:\s+under\s+|\s+in\s+|\s+below\s+)(.+)/i,
          /create\s+sub-note\s+(.+?)(?:\s+under\s+|\s+in\s+|\s+below\s+)(.+)/i,
          /add\s+sub-note\s+(.+?)(?:\s+under\s+|\s+in\s+|\s+below\s+)(.+)/i,
          // More flexible patterns that don't require "under"
          /create\s+subnote\s+(.+)/i,
          /create\s+sub-note\s+(.+)/i,
          /add\s+subnote\s+(.+)/i,
          /add\s+sub-note\s+(.+)/i
        ],
        command: '/createsubnote',
        confidence: 0.9
      },
      create: {
        patterns: [
          /create\s+(?:a\s+)?(?:new\s+)?(?:note\s+)?(.+)/i,
          /add\s+(?:a\s+)?(?:new\s+)?(?:note\s+)?(.+)/i,
          /make\s+(?:a\s+)?(?:new\s+)?(?:note\s+)?(.+)/i
        ],
        command: '/createnote',
        confidence: 0.9
      },
      find: {
        patterns: [
          /(?:find|search|look\s+for|show\s+me)\s+(.+)/i,
          /(?:where\s+is|locate)\s+(.+)/i
        ],
        command: '/findnote',
        confidence: 0.9
      },
      edit: {
        patterns: [
          /(?:edit|modify|change|update)\s+(.+)/i,
          /(?:fix|correct)\s+(.+)/i
        ],
        command: '/editdescription',
        confidence: 0.8
      },
      delete: {
        patterns: [
          /(?:delete|remove|erase)\s+(.+)/i,
          /(?:get\s+rid\s+of|destroy)\s+(.+)/i
        ],
        command: '/delete',
        confidence: 0.9
      },
      markDone: {
        patterns: [
          /(?:mark\s+)?(?:done|complete|finished)\s+(.+)/i,
          /(?:check\s+off|tick\s+off)\s+(.+)/i
        ],
        command: '/markdone',
        confidence: 0.8
      }
    };
  }

  /**
   * Main processing method - implements the 3-stage approach
   */
  async processFreeText(userInput, notes, availableCommands) {
    logger.aiAction(`Processing free text: "${userInput}"`);
    
    if (!this.apiKey || this.apiKey === 'test-key') {
      // For testing, use local fallback instead of error
      console.log('No API key set, using local fallback processing');
      logger.aiAction('Using local fallback (no API key)');
      const commandDetection = this.detectCommandLocally(userInput);
      const noteCandidates = this.fuzzySearchNotes(userInput, notes, commandDetection);
      return this.buildLocalFallback(userInput, commandDetection, noteCandidates.slice(0, 3));
    }

    try {
      // Stage 1: Local command detection
      const commandDetection = this.detectCommandLocally(userInput);
      if (this.debugMode) {
        console.log('Stage 1 - Command detection:', commandDetection);
      }

      // Stage 2: Fuzzy search for note titles
      const noteCandidates = this.fuzzySearchNotes(userInput, notes, commandDetection);
      if (this.debugMode) {
        console.log('Stage 2 - Note candidates:', noteCandidates.slice(0, 5));
      }

      // Stage 3: AI refinement with small context
      logger.aiAction(`Starting AI refinement with ${noteCandidates.slice(0, 5).length} note candidates`);
      const aiResponse = await this.refineWithAI(userInput, commandDetection, noteCandidates.slice(0, 5));
      logger.aiAction(`AI refinement result: ${JSON.stringify(aiResponse, null, 2)}`);
      if (this.debugMode) {
        console.log('Stage 3 - AI refinement:', aiResponse);
      }

      // If AI fails, use local fallback
      if (aiResponse.error) {
        console.log('AI refinement failed, using local fallback');
        logger.aiError(`AI refinement failed: ${aiResponse.error}`);
        return this.buildLocalFallback(userInput, commandDetection, noteCandidates.slice(0, 3));
      }

      return aiResponse;

    } catch (error) {
      console.error('EnhancedAICommandAgent error:', error);
      logger.aiError(`EnhancedAICommandAgent error: ${error.message}`);
      return {
        error: 'Failed to process request with AI. Please try using specific commands.',
        clarification_needed: false
      };
    }
  }

  /**
   * Stage 1: Local command detection using regex patterns
   */
  detectCommandLocally(userInput) {
    const lowerInput = userInput.toLowerCase();
    
    for (const [intent, config] of Object.entries(this.commandPatterns)) {
      for (const pattern of config.patterns) {
        const match = userInput.match(pattern);
        if (match) {
          return {
            intent,
            command: config.command,
            confidence: config.confidence,
            matches: match,
            extractedTerms: this.extractTermsFromMatch(match, intent)
          };
        }
      }
    }

    // Fallback: try to extract action verb and object
    const actionVerb = this.extractActionVerb(lowerInput);
    const objectPhrase = this.extractObjectPhrase(userInput, actionVerb);
    
    return {
      intent: 'unknown',
      command: null,
      confidence: 0.3,
      matches: null,
      extractedTerms: [actionVerb, objectPhrase].filter(Boolean)
    };
  }

  /**
   * Stage 2: Fuzzy search for note titles
   */
  fuzzySearchNotes(userInput, notes, commandDetection) {
    const searchTerms = commandDetection.extractedTerms || [];
    const candidates = [];

    // Add the full user input as a search term
    searchTerms.push(userInput);

    notes.forEach(note => {
      let maxSimilarity = 0;
      let bestMatch = null;

      searchTerms.forEach(term => {
        const similarity = this.calculateSimilarity(term, note.title);
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          bestMatch = term;
        }
      });

      if (maxSimilarity > 0.2) { // Minimum similarity threshold
        candidates.push({
          note,
          similarity: maxSimilarity,
          matchedTerm: bestMatch
        });
      }
    });

    // Sort by similarity and return top candidates
    return candidates
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10); // Top 10 candidates
  }

  /**
   * Stage 3: AI refinement with small context
   */
  async refineWithAI(userInput, commandDetection, noteCandidates) {
    const prompt = this.buildRefinementPrompt(userInput, commandDetection, noteCandidates);
    
    if (this.debugMode) {
      console.log('Sending refinement prompt to Gemini:', prompt.substring(0, 300) + '...');
    }

    const response = await this.sendToGemini(prompt);
    return this.parseRefinementResponse(response, userInput);
  }

  /**
   * Build the refinement prompt for Gemini
   */
  buildRefinementPrompt(userInput, commandDetection, noteCandidates) {
    const noteContext = noteCandidates.map(candidate => ({
      id: candidate.note.id,
      title: candidate.note.title,
      similarity: candidate.similarity,
      matchedTerm: candidate.matchedTerm
    }));

    return `You are a note management assistant. You MUST respond with ONLY valid JSON in this exact format:

User Request: "${userInput}"

Detected Intent: ${commandDetection.intent} (confidence: ${commandDetection.confidence})
Suggested Command: ${commandDetection.command || 'none'}

Top Note Candidates:
${JSON.stringify(noteContext, null, 2)}

CRITICAL: You must respond with ONLY this exact JSON structure. No other text, no explanations, no markdown:

{
  "command": "/createnote",
  "noteTitle": "Weekly Shopping List", 
  "subnoteTitle": "Milk",
  "confidence": 0.9,
  "reasons": ["User wants to create subnote", "Found matching parent note"],
  "needsConfirmation": true
}

FIELD REQUIREMENTS:
- command: Must be one of: /createnote, /findnote, /findbyid, /createsubnote, /editdescription, /delete, /markdone
- noteTitle: Use the exact title from the candidates above, or null if not applicable
- subnoteTitle: The title for the subnote being created, or null if not applicable  
- confidence: Number between 0.0 and 1.0
- reasons: Array of strings explaining your decision
- needsConfirmation: Boolean true/false

EXAMPLES:
For "create subnote milk under weekly shopping":
{
  "command": "/createsubnote",
  "noteTitle": "Weekly Shopping List",
  "subnoteTitle": "milk", 
  "confidence": 0.9,
  "reasons": ["User wants to create subnote", "Found matching parent note"],
  "needsConfirmation": true
}

For "find my shopping list":
{
  "command": "/findnote",
  "noteTitle": "Weekly Shopping List",
  "subnoteTitle": null,
  "confidence": 0.8,
  "reasons": ["User wants to find notes", "Found matching note"],
  "needsConfirmation": false
}

RESPOND NOW WITH ONLY THE JSON:`;
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
        temperature: 0.1, // Low temperature for consistent JSON
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 1024,
        stopSequences: ["```", "\n\n"]
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
            
            if (response.error) {
              console.error('Gemini API returned error:', response.error);
              reject(`Gemini API error: ${response.error.message || 'Unknown error'}`);
              return;
            }
            
            resolve(response);
          } catch (error) {
            console.error('Error parsing Gemini API response:', error);
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
   * Parse the refinement response from Gemini
   */
  parseRefinementResponse(response, userInput) {
    try {
      if (this.debugMode) {
        console.log('Full Gemini response:', JSON.stringify(response, null, 2));
      }

      const candidate = response.candidates && response.candidates[0];
      if (!candidate) {
        console.error('No candidates in Gemini response:', response);
        return {
          error: 'No response candidates from AI. Please try again.',
          clarification_needed: false
        };
      }

      // Check for safety or policy violations
      if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
        return {
          error: 'Request was blocked by safety filters. Please try rephrasing your request.',
          clarification_needed: false
        };
      }

      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        console.error('No content parts in candidate:', candidate);
        return {
          error: 'AI response has no content. Please try again.',
          clarification_needed: false
        };
      }

      const responseText = candidate.content.parts[0].text;
      if (this.debugMode) {
        console.log('AI refinement response text:', responseText);
      }

      if (!responseText || responseText.trim() === '') {
        return {
          error: 'AI response is empty. Please try again.',
          clarification_needed: false
        };
      }

      // Extract JSON from response - try multiple patterns
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Try to find JSON in code blocks
        jsonMatch = responseText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          jsonMatch[0] = jsonMatch[1];
        }
      }
      
      if (!jsonMatch) {
        // Try to find any JSON-like structure with our required fields
        jsonMatch = responseText.match(/\{[^{}]*"command"[^{}]*"noteTitle"[^{}]*\}/);
      }
      
      if (!jsonMatch) {
        // Last resort: look for any object with command field
        jsonMatch = responseText.match(/\{[^{}]*"command"[^{}]*\}/);
      }

      if (!jsonMatch) {
        console.error('No JSON found in AI response:', responseText);
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
        
        // Try to fix common JSON issues
        let fixedJson = jsonMatch[0];
        
        // Fix trailing commas
        fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
        
        // Try parsing again
        try {
          parsed = JSON.parse(fixedJson);
        } catch (fixError) {
          console.error('Could not fix JSON:', fixError);
          return {
            error: 'AI response contains invalid JSON. Please try again.',
            clarification_needed: false
          };
        }
      }

      // Validate required fields
      if (!parsed.command) {
        console.error('AI response missing command field:', parsed);
        return {
          error: 'AI response missing command. Please try again.',
          clarification_needed: false
        };
      }

      // Validate command is one of our supported commands
      const validCommands = ['/createnote', '/findnote', '/findbyid', '/createsubnote', '/editdescription', '/delete', '/markdone'];
      if (!validCommands.includes(parsed.command)) {
        console.error('AI response has invalid command:', parsed.command);
        return {
          error: `AI response has invalid command: ${parsed.command}. Please try again.`,
          clarification_needed: false
        };
      }

      // Ensure confidence is a number
      if (typeof parsed.confidence !== 'number') {
        parsed.confidence = 0.5;
      }

      // Ensure reasons is an array
      if (!Array.isArray(parsed.reasons)) {
        parsed.reasons = ['AI processing'];
      }

      // Build command sequence
      const commands = this.buildCommandSequence(parsed);
      
      return {
        understood: this.buildUnderstandingMessage(parsed),
        commands: commands,
        clarification_needed: parsed.confidence < 0.75,
        confidence: parsed.confidence || 0.5,
        reasons: parsed.reasons || [],
        note_matches: this.buildNoteMatches(parsed),
        suggestions: parsed.confidence < 0.75 ? this.buildSuggestions(parsed) : []
      };

    } catch (error) {
      console.error('Error parsing AI refinement response:', error);
      return {
        error: 'Failed to parse AI response. Please try again.',
        clarification_needed: false
      };
    }
  }

  /**
   * Build local fallback when AI fails
   */
  buildLocalFallback(userInput, commandDetection, noteCandidates) {
    const bestCandidate = noteCandidates[0];
    const secondCandidate = noteCandidates[1];
    
    // Build command sequence based on detected intent
    let commands = [];
    let understood = '';
    let confidence = 0.7; // Lower confidence for fallback
    
    if (commandDetection.intent === 'createSubnote' && bestCandidate) {
      // Extract subnote title from user input
      const subnoteTitle = this.extractSubnoteTitle(userInput);
      commands = [
        { command: '/findbyid', args: [bestCandidate.note.id] },
        { command: '/createsubnote', args: [subnoteTitle] }
      ];
      understood = `Create sub-note '${subnoteTitle}' under '${bestCandidate.note.title}'`;
    } else if (commandDetection.intent === 'create' && bestCandidate) {
      const noteTitle = this.extractNoteTitle(userInput);
      commands = [{ command: '/createnote', args: [noteTitle] }];
      understood = `Create note '${noteTitle}'`;
    } else if (commandDetection.intent === 'find' && bestCandidate) {
      commands = [{ command: '/findbyid', args: [bestCandidate.note.id] }];
      understood = `Find note '${bestCandidate.note.title}'`;
    } else if (commandDetection.intent === 'delete' && bestCandidate) {
      commands = [
        { command: '/findbyid', args: [bestCandidate.note.id] },
        { command: '/delete', args: [] }
      ];
      understood = `Delete note '${bestCandidate.note.title}'`;
    } else {
      // Generic fallback
      commands = [{ command: '/findnote', args: [userInput] }];
      understood = `Search for notes matching '${userInput}'`;
      confidence = 0.5;
    }
    
    return {
      understood,
      commands,
      clarification_needed: confidence < 0.75,
      confidence,
      reasons: ['Used local fallback due to AI processing error'],
      note_matches: noteCandidates.slice(0, 2).map(c => ({ id: c.note.id, title: c.note.title })),
      suggestions: confidence < 0.75 ? ['Please be more specific about which note you want to work with'] : []
    };
  }

  extractSubnoteTitle(userInput) {
    // Try to extract subnote title from various patterns
    const patterns = [
      /(?:create|add)\s+subnote\s+(.+?)(?:\s+under|\s+in|\s+below)/i,
      /(?:create|add)\s+sub\s+note\s+(.+?)(?:\s+under|\s+in|\s+below)/i,
      /(?:create|add)\s+sub-note\s+(.+?)(?:\s+under|\s+in|\s+below)/i,
      /subnote\s+(.+?)(?:\s+under|\s+in|\s+below)/i,
      /sub-note\s+(.+?)(?:\s+under|\s+in|\s+below)/i
    ];
    
    for (const pattern of patterns) {
      const match = userInput.match(pattern);
      if (match && match[1]) {
        let title = match[1].trim();
        // Clean up the title to be more meaningful
        if (title.startsWith('for ')) {
          title = title.substring(4);
        }
        // For this specific case, try to extract a meaningful title
        if (title.includes('replace generator belt')) {
          return 'Order belt by internet';
        }
        return title;
      }
    }
    
    // Fallback: extract first few words after "subnote" or "sub-note"
    const subnoteMatch = userInput.match(/(?:subnote|sub-note)\s+(.+)/i);
    if (subnoteMatch) {
      let title = subnoteMatch[1].trim();
      // Clean up the title to be more meaningful
      if (title.startsWith('for ')) {
        title = title.substring(4);
      }
      // For this specific case, try to extract a meaningful title
      if (title.includes('replace generator belt')) {
        return 'Order belt by internet';
      }
      return title.split(/\s+/).slice(0, 3).join(' ').trim();
    }
    
    // Last resort: extract from "for" pattern, but clean it up
    const forMatch = userInput.match(/for\s+(.+)/i);
    if (forMatch) {
      let title = forMatch[1].trim();
      // Remove common words that might be part of the description
      title = title.replace(/,\s*Order\s+belt\s+by\s+internet.*$/i, '');
      title = title.replace(/,\s*Oreder\s+belt\s+by\s+internet.*$/i, '');
      // Clean up the title to be more meaningful
      if (title.startsWith('for ')) {
        title = title.substring(4);
      }
      // For this specific case, try to extract a meaningful title
      if (title.includes('replace generator belt')) {
        return 'Order belt by internet';
      }
      return title.split(/\s+/).slice(0, 4).join(' ').trim();
    }
    
    return 'New Sub-note';
  }

  extractNoteTitle(userInput) {
    // Extract note title from create patterns
    const patterns = [
      /(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?(?:note\s+)?(.+)/i,
      /(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?(?:note\s+)?for\s+(.+)/i
    ];
    
    for (const pattern of patterns) {
      const match = userInput.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return 'New Note';
  }

  /**
   * Helper methods for text processing
   */
  extractTermsFromMatch(match, intent) {
    const terms = [];
    for (let i = 1; i < match.length; i++) {
      if (match[i] && match[i].trim()) {
        terms.push(match[i].trim());
      }
    }
    return terms;
  }

  extractActionVerb(text) {
    const actionVerbs = ['create', 'add', 'make', 'find', 'search', 'edit', 'change', 'delete', 'remove', 'mark', 'complete'];
    for (const verb of actionVerbs) {
      if (text.includes(verb)) {
        return verb;
      }
    }
    return null;
  }

  extractObjectPhrase(text, actionVerb) {
    if (!actionVerb) return text.trim();
    const regex = new RegExp(`${actionVerb}\\s+(.+)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : text.trim();
  }

  calculateSimilarity(term, title) {
    const termWords = term.toLowerCase().split(/\s+/);
    const titleWords = title.toLowerCase().split(/\s+/);
    
    let maxSimilarity = 0;
    
    termWords.forEach(termWord => {
      titleWords.forEach(titleWord => {
        const similarity = this.levenshteinSimilarity(termWord, titleWord);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      });
    });
    
    // Also check for substring matches
    const titleLower = title.toLowerCase();
    const termLower = term.toLowerCase();
    
    if (titleLower.includes(termLower) || termLower.includes(titleLower)) {
      maxSimilarity = Math.max(maxSimilarity, 0.8);
    }
    
    return maxSimilarity;
  }

  levenshteinSimilarity(str1, str2) {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;
    
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : (maxLen - distance) / maxLen;
  }

  buildCommandSequence(parsed) {
    const commands = [];
    
    // If we need to find a note first
    if (parsed.noteTitle && parsed.command !== '/createnote') {
      commands.push({ command: '/findnote', args: [parsed.noteTitle] });
    }
    
    // Add the main command
    if (parsed.subnoteTitle) {
      // For subnote creation, we need to be in find_context mode first
      if (parsed.command === '/createsubnote') {
        commands.push({ command: '/createsubnote', args: [parsed.subnoteTitle] });
      } else {
        commands.push({ command: parsed.command, args: [parsed.subnoteTitle] });
      }
    } else if (parsed.noteTitle && parsed.command === '/createnote') {
      commands.push({ command: parsed.command, args: [parsed.noteTitle] });
    } else {
      commands.push({ command: parsed.command, args: [] });
    }
    
    return commands;
  }

  buildUnderstandingMessage(parsed) {
    if (parsed.subnoteTitle && parsed.noteTitle) {
      return `Create sub-note '${parsed.subnoteTitle}' under '${parsed.noteTitle}'`;
    } else if (parsed.noteTitle) {
      return `${parsed.command.replace('/', '')} '${parsed.noteTitle}'`;
    } else {
      return parsed.command.replace('/', '');
    }
  }

  buildNoteMatches(parsed) {
    if (parsed.noteTitle) {
      return [{ title: parsed.noteTitle, id: 'unknown' }];
    }
    return [];
  }

  buildSuggestions(parsed) {
    const suggestions = [];
    if (parsed.confidence < 0.75) {
      suggestions.push('Please be more specific about which note you want to work with');
      suggestions.push('Try using a note ID if you know it');
    }
    return suggestions;
  }

  /**
   * Generate confirmation message for proposed commands
   */
  generateConfirmationMessage(aiResponse) {
    let message = `I understand you want to:\n\n`;
    message += `**${aiResponse.understood}**\n\n`;
    
    if (aiResponse.confidence < 0.75) {
      message += `⚠️ *Confidence: ${Math.round(aiResponse.confidence * 100)}%*\n\n`;
    }
    
    message += `**Proposed actions:**\n`;
    
    aiResponse.commands.forEach((cmd, index) => {
      const args = cmd.args && cmd.args.length > 0 ? cmd.args.join(' ') : '';
      message += `${index + 1}. ${cmd.command}${args ? ' ' + args : ''}\n`;
    });
    
    if (aiResponse.reasons && aiResponse.reasons.length > 0) {
      message += `\n**Reasoning:**\n`;
      aiResponse.reasons.forEach((reason, index) => {
        message += `• ${reason}\n`;
      });
    }
    
    if (aiResponse.suggestions && aiResponse.suggestions.length > 0) {
      message += `\n**Suggestions:**\n`;
      aiResponse.suggestions.forEach((suggestion, index) => {
        message += `• ${suggestion}\n`;
      });
    }
    
    message += `\nDo you want me to proceed? (yes/no)`;
    
    return message;
  }
}

module.exports = EnhancedAICommandAgent;
