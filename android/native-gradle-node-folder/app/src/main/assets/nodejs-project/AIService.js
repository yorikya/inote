const https = require('https');

// The actual function you will run in your Node.js code
async function searchTheInternet(searchQuery) {
  console.log(`Searching the internet for: ${searchQuery}`);

  // Use DuckDuckGo's Instant Answer API
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_html=1&skip_disambig=1`;

  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          // Create a search URL that users can click
          const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`;
          
          // Build response with search link
          let response = '';
          
          // If we got an abstract or definition, include it
          if (result.Abstract) {
            response += `${result.Abstract}\n\n`;
          }
          
          // If we got related topics, include them
          if (result.RelatedTopics && result.RelatedTopics.length > 0) {
            response += 'Related topics:\n';
            result.RelatedTopics.slice(0, 3).forEach(topic => {
              if (topic.Text) {
                response += `• ${topic.Text}\n`;
              }
            });
            response += '\n';
          }
          
          // Always include the search link
          response += `🔍 Full search results: ${searchUrl}\n`;
          
          // Also suggest specific educational resources for academic topics
          if (searchQuery.toLowerCase().includes('general relativity') || 
              searchQuery.toLowerCase().includes('physics') ||
              searchQuery.toLowerCase().includes('black holes')) {
            response += `\n📚 Educational resources:\n`;
            response += `• MIT OpenCourseWare: https://ocw.mit.edu/search/?q=${encodeURIComponent(searchQuery)}\n`;
            response += `• Khan Academy: https://www.khanacademy.org/search?search_again=1&page_search_query=${encodeURIComponent(searchQuery)}\n`;
            response += `• YouTube: https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}\n`;
          }
          
          resolve(response || `I couldn't find specific information, but you can search here: ${searchUrl}`);
        } catch (error) {
          console.error('Error parsing search results:', error);
          // Even if parsing fails, provide a search link
          const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`;
          resolve(`🔍 Search for "${searchQuery}": ${searchUrl}`);
        }
      });
    }).on('error', (error) => {
      console.error('Search error:', error);
      // Even on error, provide a search link
      const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`;
      resolve(`🔍 Search for "${searchQuery}": ${searchUrl}`);
    });
  });
}

// The definition you send to Gemini
const searchTool = {
  functionDeclarations: [
    {
      name: 'searchTheInternet',
      description: 'Searches the web for relevant information, such as user manuals for specific car models.',
      parameters: {
        type: 'OBJECT',
        properties: {
          searchQuery: {
            type: 'STRING',
            description: 'The search query to use.'
          }
        },
        required: ['searchQuery']
      }
    }
  ]
};
class AIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.conversationHistory = [];
    this.lastResponse = '';
  }

  startConversation(noteContext) {
    this.conversationHistory = [
      { role: 'user', parts: [{ text: `You are a helpful assistant. Please format your responses using simple markdown. Use * for emphasis and newlines for structure. Do not use any other formatting.

When you receive search results:
1. ALWAYS show the search link first (it will be marked with isSearchLink: true)
2. If there are relevant results, summarize them and include their links
3. Format links as: [Link text](URL)
4. Always provide at least the main search link so users can explore further

This is the note context: ${noteContext}` }] },
      { role: 'model', parts: [{ text: 'OK, I have the context. What do you want to know?' }] }
    ];
  }

  stopConversation() {
    this.conversationHistory = [];
  }

  getLastResponse() {
    return this.lastResponse;
  }

  async _sendRequest() {
    const postData = JSON.stringify({
      contents: this.conversationHistory,
      tools: [searchTool],
      generationConfig: {
        temperature: 0.9,
        topK: 1,
        topP: 1,
        maxOutputTokens: 2048,
        stopSequences: []
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
            const response = JSON.parse(data);
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

  async sendMessage(message) {
    if (!this.apiKey) {
      return 'Error: Gemini API key not set.';
    }

    this.conversationHistory.push({ role: 'user', parts: [{ text: message }] });

    while (true) {
      const response = await this._sendRequest();
      const candidate = response.candidates && response.candidates[0];

      if (!candidate || !candidate.content) {
        console.log('Invalid response from Gemini API:', response);
        return 'Error: Invalid response from Gemini API.';
      }

      const part = candidate.content.parts[0];

      if (part.functionCall) {
        const functionCall = part.functionCall;
        if (functionCall.name === 'searchTheInternet') {
          const query = functionCall.args.searchQuery;
          const searchResults = await searchTheInternet(query);

          this.conversationHistory.push({
            role: 'model',
            parts: [part]
          }, {
            role: 'tool',
            parts: [{
              functionResponse: {
                name: 'searchTheInternet',
                response: {
                  content: searchResults,
                }
              }
            }]
          });
          // Continue loop to get final answer
        } else {
          return `Error: Unknown function call ${functionCall.name}`;
        }
      } else if (part.text) {
        this.conversationHistory.push(candidate.content);
        this.lastResponse = part.text;
        return part.text;
      }
    }
  }
}

module.exports = AIService;
