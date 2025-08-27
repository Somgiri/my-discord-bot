const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config/config.js');
const logger = require('../utils/logger.js');

class CommandHandler {
    constructor() {
        this.commands = [];
        this.loadCommands();
    }
    
    loadCommands() {
        const commandsPath = path.join(__dirname, '..', 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                this.commands.push(command.data.toJSON());
                logger.info(`Loaded command: ${command.data.name}`);
            } else {
                logger.warn(`Command at ${filePath} is missing required "data" or "execute" property.`);
            }
        }
    }
    
    async deployCommands(clientId, guildId = null) {
        const rest = new REST().setToken(config.DISCORD_TOKEN);
        
        try {
            logger.info('Started refreshing application (/) commands.');
            
            let route;
            if (guildId) {
                // Deploy to specific guild (faster for development)
                route = Routes.applicationGuildCommands(clientId, guildId);
                logger.info(`Deploying commands to guild ${guildId}`);
            } else {
                // Deploy globally (takes up to 1 hour to propagate)
                route = Routes.applicationCommands(clientId);
                logger.info('Deploying commands globally');
            }
            
            const data = await rest.put(route, {
                body: this.commands,
            });
            
            logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
            return data;
            
        } catch (error) {
            logger.error('Error deploying commands:', error);
            throw error;
        }
    }
    
    async deleteCommands(clientId, guildId = null) {
        const rest = new REST().setToken(config.DISCORD_TOKEN);
        
        try {
            let route;
            if (guildId) {
                route = Routes.applicationGuildCommands(clientId, guildId);
            } else {
                route = Routes.applicationCommands(clientId);
            }
            
            await rest.put(route, { body: [] });
            logger.info('Successfully deleted all application (/) commands.');
            
        } catch (error) {
            logger.error('Error deleting commands:', error);
            throw error;
        }
    }
}

module.exports = new CommandHandler();
