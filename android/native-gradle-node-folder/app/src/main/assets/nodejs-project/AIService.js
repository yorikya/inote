const https = require('https');

class AIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.conversationHistory = [];
  }

  startConversation(noteContext) {
    this.conversationHistory = [
      { role: 'user', parts: [{ text: `You are a helpful assistant. Please format your responses using simple markdown. Use * for emphasis and newlines for structure. Do not use any other formatting.\n\nThis is the note context: ${noteContext}` }] },
      { role: 'model', parts: [{ text: 'OK, I have the context. What do you want to know?' }] }
    ];
  }

  stopConversation() {
    this.conversationHistory = [];
  }

  async sendMessage(message) {
    if (!this.apiKey) {
      return 'Error: Gemini API key not set.';
    }

    this.conversationHistory.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const postData = JSON.stringify({
      contents: this.conversationHistory,
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
            if (response.candidates && response.candidates.length > 0 && response.candidates[0].content) {
              const modelResponse = response.candidates[0].content;
              this.conversationHistory.push(modelResponse);
              resolve(modelResponse.parts[0].text);
            } else {
                console.log('Invalid response from Gemini API:', response);
              resolve('Error: Invalid response from Gemini API.');
            }
          } catch (error) {
            console.error('Error parsing Gemini API response:', error);
            resolve('Error: Could not parse response from Gemini API.');
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
}

module.exports = AIService;