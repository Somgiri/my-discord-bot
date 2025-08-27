const openaiService = require('../services/openaiService.js');
const logger = require('../utils/logger.js');
const config = require('../config/config.js');

class MessageHandler {
    constructor() {
        this.conversationCooldowns = new Map();
        this.COOLDOWN_DURATION = 5000; // 5 seconds between AI responses per user
    }
    
    async handleMessage(message, client) {
        const isMentioned = message.mentions.has(client.user);
        const isDM = message.channel.type === 1; // DM channel type
        
        // In servers: Only respond if mentioned
        // In DMs: Always respond
        if (!isDM && !isMentioned) {
            return;
        }
        
        // Check cooldown
        const userId = message.author.id;
        const now = Date.now();
        const cooldownEnd = this.conversationCooldowns.get(userId);
        
        if (cooldownEnd && now < cooldownEnd) {
            const remainingTime = Math.ceil((cooldownEnd - now) / 1000);
            await message.reply(`Please wait ${remainingTime} more seconds before asking me something else.`);
            return;
        }
        
        // Set typing indicator
        await message.channel.sendTyping();
        
        try {
            // Prepare message content (remove bot mention if present)
            let content = message.content;
            if (isMentioned) {
                content = content.replace(/<@!?\d+>/g, '').trim();
            }
            
            // Skip if message is empty after cleaning
            if (!content) {
                await message.reply('Hi there! What would you like to talk about?');
                return;
            }
            
            // Get user context
            const userContext = {
                username: message.author.username,
                displayName: message.member?.displayName || message.author.username,
                guildName: message.guild?.name || 'Direct Message',
                channelName: message.channel.name || 'DM',
                isDM: isDM
            };
            
            // Generate AI response
            const aiResponse = await openaiService.generateResponse(content, userContext);
            
            // Split long messages into chunks
            const chunks = this.splitMessage(aiResponse);
            
            for (const chunk of chunks) {
                await message.reply(chunk);
            }
            
            // Set cooldown
            this.conversationCooldowns.set(userId, now + this.COOLDOWN_DURATION);
            
            // Clean up old cooldowns periodically
            this.cleanupCooldowns();
            
            logger.info(`AI response sent to ${message.author.tag} in ${userContext.guildName}`);
            
        } catch (error) {
            logger.error('Error generating AI response:', error);
            
            let errorMessage = 'Sorry, I encountered an error while processing your message.';
            
            if (error.message.includes('rate limit')) {
                errorMessage = 'I\'m currently experiencing high traffic. Please try again in a few moments.';
            } else if (error.message.includes('API key')) {
                errorMessage = 'There\'s a configuration issue on my end. Please contact an administrator.';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'My response took too long to generate. Please try a shorter message.';
            }
            
            await message.reply(errorMessage);
        }
    }
    
    splitMessage(text, maxLength = 2000) {
        if (text.length <= maxLength) {
            return [text];
        }
        
        const chunks = [];
        let currentChunk = '';
        
        // Split by sentences first
        const sentences = text.split(/(?<=[.!?])\s+/);
        
        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > maxLength) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                    currentChunk = '';
                }
                
                // If single sentence is too long, split by words
                if (sentence.length > maxLength) {
                    const words = sentence.split(' ');
                    for (const word of words) {
                        if ((currentChunk + ' ' + word).length > maxLength) {
                            if (currentChunk) {
                                chunks.push(currentChunk.trim());
                                currentChunk = word;
                            } else {
                                // Single word is too long, force split
                                chunks.push(word.substring(0, maxLength - 3) + '...');
                            }
                        } else {
                            currentChunk += (currentChunk ? ' ' : '') + word;
                        }
                    }
                } else {
                    currentChunk = sentence;
                }
            } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
        }
        
        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks;
    }
    
    cleanupCooldowns() {
        const now = Date.now();
        for (const [userId, cooldownEnd] of this.conversationCooldowns.entries()) {
            if (now >= cooldownEnd) {
                this.conversationCooldowns.delete(userId);
            }
        }
    }
}

module.exports = new MessageHandler();
