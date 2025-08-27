const axios = require('axios');
const config = require('../config/config.js');
const logger = require('../utils/logger.js');

class AIService {
    constructor() {
        this.geminiApiKey = config.GEMINI_API_KEY;
        this.geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`;

        this.conversationHistory = new Map();
        this.MAX_HISTORY_LENGTH = 10; // Keep last 10 exchanges per user
        this.HISTORY_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes

        // Clean up old conversations periodically
        setInterval(() => this.cleanupConversations(), this.HISTORY_CLEANUP_INTERVAL);
    }

    async generateResponse(userMessage, userContext = {}) {
        try {
            const userId = userContext.username || 'unknown';

            // Get or initialize conversation history
            let history = this.conversationHistory.get(userId) || [];

            // Build system message with context
            const systemMessage = this.buildSystemMessage(userContext);

            // Prepare messages array for Gemini
            const formattedHistory = history.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.content }]
            }));

            const messages = [
                { role: 'user', parts: [{ text: systemMessage }] }, // Gemini uses 'user' for system prompts too
                ...formattedHistory,
                { role: 'user', parts: [{ text: userMessage }] }
            ];

            // Call Google Gemini API
            const response = await axios.post(this.geminiUrl, {
                contents: messages,
                generationConfig: {
                    maxOutputTokens: 1000,
                    temperature: 0.7,
                    topP: 0.9,
                    topK: 1,
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
                ]
            });

            const aiResponse = response.data.candidates[0].content.parts[0].text;

            // Update conversation history
            history.push(
                { role: 'user', content: userMessage },
                { role: 'assistant', content: aiResponse }
            );

            // Trim history if too long
            if (history.length > this.MAX_HISTORY_LENGTH * 2) {
                history = history.slice(-this.MAX_HISTORY_LENGTH * 2);
            }

            this.conversationHistory.set(userId, history);

            logger.info(`Generated AI response for user ${userId}`);
            return aiResponse;

        } catch (error) {
            logger.error('Google Gemini API error:', error.response ? error.response.data : error.message);

            // Handle specific error types or general failure
            if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
                const errorMessage = error.response.data.error.message;
                if (errorMessage.includes('API key not valid')) {
                    throw new Error('API key invalid');
                } else if (errorMessage.includes('quota')) {
                    throw new Error('API quota exceeded');
                }
            } else if (error.request) {
                throw new Error('timeout');
            }

            throw new Error('Failed to generate AI response');
        }
    }

    buildSystemMessage(userContext) {
        const { username, displayName, guildName, channelName, isDM } = userContext;

        let systemMessage = `You are an intelligent and helpful Discord bot assistant. You provide thoughtful, engaging, and contextually appropriate responses to users.

Key guidelines:
- Be conversational, friendly, and helpful
- Keep responses concise but informative
- Use appropriate Discord formatting when helpful (like **bold** or *italic*)
- Avoid being overly formal - match the casual Discord atmosphere
- Don't mention that you're an AI unless directly asked
- Be curious and engaging, ask follow-up questions when appropriate
- If someone asks about your capabilities, explain that you can have conversations, answer questions, and help with various topics

Current context:`;

        if (username) {
            systemMessage += `\n- User: ${displayName || username}`;
        }

        if (isDM) {
            systemMessage += `\n- Location: Direct message`;
        } else if (guildName) {
            systemMessage += `\n- Server: ${guildName}`;
            if (channelName) {
                systemMessage += `\n- Channel: #${channelName}`;
            }
        }

        systemMessage += `\n\nRespond naturally and helpfully to the user's message.`;

        return systemMessage;
    }

    async analyzeMessage(message, requestedAnalysis = 'sentiment') {
        try {
            let prompt;
            let geminiPrompt;

            switch (requestedAnalysis) {
                case 'sentiment':
                    geminiPrompt = `Analyze the sentiment of this message and respond with JSON: {"sentiment": "positive/negative/neutral", "confidence": 0.0-1.0, "explanation": "brief explanation"}

Message: "${message}"`;
                    break;

                case 'toxicity':
                    geminiPrompt = `Analyze this message for toxicity and respond with JSON: {"is_toxic": true/false, "severity": "low/medium/high", "confidence": 0.0-1.0, "categories": ["category1", "category2"]}

Message: "${message}"`;
                    break;

                default:
                    throw new Error('Unsupported analysis type');
            }

            const response = await axios.post(this.geminiUrl, {
                contents: [{ role: 'user', parts: [{ text: geminiPrompt }] }]
            });

            return JSON.parse(response.data.candidates[0].content.parts[0].text);

        } catch (error) {
            logger.error('Error analyzing message:', error.response ? error.response.data : error.message);
            throw error;
        }
    }

    cleanupConversations() {
        const cutoffTime = Date.now() - (60 * 60 * 1000); // 1 hour ago

        for (const [userId, history] of this.conversationHistory.entries()) {
            if (history.length === 0) {
                this.conversationHistory.delete(userId);
                continue;
            }

            // Remove conversations that haven't been active
            // This is a simple cleanup - in production you might want more sophisticated logic
            if (Math.random() < 0.1) { // Randomly cleanup 10% of conversations each cycle
                this.conversationHistory.delete(userId);
            }
        }

        logger.info(`Cleaned up conversation history. Active conversations: ${this.conversationHistory.size}`);
    }

    clearUserHistory(userId) {
        this.conversationHistory.delete(userId);
        logger.info(`Cleared conversation history for user ${userId}`);
    }

    getConversationStats() {
        return {
            totalConversations: this.conversationHistory.size,
            totalMessages: Array.from(this.conversationHistory.values())
                .reduce((total, history) => total + history.length, 0)
        };
    }
}

module.exports = new AIService();