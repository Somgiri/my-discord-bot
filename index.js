const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config/config.js');
const logger = require('./utils/logger.js');
const messageHandler = require('./handlers/messageHandler.js');

// Create Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

// Create a collection to store commands
client.commands = new Collection();

// Load commands dynamically
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        logger.info(`Loaded command: ${command.data.name}`);
    } else {
        logger.warn(`Command at ${filePath} is missing required "data" or "execute" property.`);
    }
}

// Bot ready event
client.once('ready', async () => {
    logger.info(`Bot is online as ${client.user.tag}!`);
    
    // Set bot activity status
    client.user.setActivity('AI conversations', { type: ActivityType.Listening });
    client.user.setStatus('online');
    
    // Deploy slash commands
    try {
        const commandHandler = require('./handlers/commandHandler.js');
        await commandHandler.deployCommands(client.user.id);
        logger.info('Slash commands deployed successfully!');
    } catch (error) {
        logger.error('Failed to deploy slash commands:', error);
    }
});

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        logger.warn(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
        logger.info(`Command ${interaction.commandName} executed by ${interaction.user.tag}`);
    } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}:`, error);
        
        const errorMessage = 'There was an error while executing this command!';
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
});

// Handle regular messages
client.on('messageCreate', async message => {
    // Ignore messages from bots (including self)
    if (message.author.bot) return;
    
    try {
        await messageHandler.handleMessage(message, client);
    } catch (error) {
        logger.error('Error handling message:', error);
        
        try {
            await message.reply('Sorry, I encountered an error while processing your message. Please try again later.');
        } catch (replyError) {
            logger.error('Error sending error reply:', replyError);
        }
    }
});

// Handle errors
client.on('error', error => {
    logger.error('Discord client error:', error);
});

// Handle rate limits
client.on('rateLimit', rateLimitData => {
    logger.warn('Rate limited:', rateLimitData);
});

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('unhandledRejection', error => {
    logger.error('Unhandled promise rejection:', error);
});

// Login to Discord
client.login(config.DISCORD_TOKEN).catch(error => {
    logger.error('Failed to login to Discord:', error);
    process.exit(1);
});
