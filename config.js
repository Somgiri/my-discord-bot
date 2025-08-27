// Configuration management for the Discord bot
require('dotenv').config();

const config = {
    // Discord Bot Configuration
    DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
    CLIENT_ID: process.env.CLIENT_ID || '',
    GUILD_ID: process.env.GUILD_ID || '', // Optional: for guild-specific command deployment
    
    // AI Service Configuration
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    AI_SERVICE: process.env.AI_SERVICE || 'simple', // 'openai', 'gemini', 'ollama', 'simple'
    
    // Bot Settings
    BOT_PREFIX: process.env.BOT_PREFIX || '!',
    MAX_MESSAGE_LENGTH: parseInt(process.env.MAX_MESSAGE_LENGTH) || 2000,
    COMMAND_COOLDOWN: parseInt(process.env.COMMAND_COOLDOWN) || 3000, // 3 seconds
    
    // Rate Limiting
    RATE_LIMIT_REQUESTS: parseInt(process.env.RATE_LIMIT_REQUESTS) || 5,
    RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 minute
    
    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    
    // Development
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // Validation
    validate() {
        const required = ['DISCORD_TOKEN', 'GEMINI_API_KEY'];
        const missing = required.filter(key => !this[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
        
        return true;
    }
};

// Validate configuration on load
try {
    config.validate();
} catch (error) {
    console.error('Configuration validation failed:', error.message);
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
}

module.exports = config;
