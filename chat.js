const { SlashCommandBuilder } = require('discord.js');
const openaiService = require('../services/openaiService.js');
const logger = require('../utils/logger.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chat')
        .setDescription('Have an AI conversation')
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('Your message to the AI')
                .setRequired(true)
                .setMaxLength(2000)
        )
        .addBooleanOption(option =>
            option
                .setName('private')
                .setDescription('Make the response visible only to you')
                .setRequired(false)
        ),
    
    async execute(interaction) {
        const message = interaction.options.getString('message');
        const isPrivate = interaction.options.getBoolean('private') || false;
        
        // Defer reply since AI response might take time
        await interaction.deferReply({ ephemeral: isPrivate });
        
        try {
            // Get user info for context
            const userContext = {
                username: interaction.user.username,
                displayName: interaction.member?.displayName || interaction.user.username,
                guildName: interaction.guild?.name || 'Direct Message'
            };
            
            const aiResponse = await openaiService.generateResponse(message, userContext);
            
            // Try to send DM to user
            try {
                const dmChannel = await interaction.user.createDM();
                
                // Send the AI response in DM
                if (aiResponse.length > 2000) {
                    const truncated = aiResponse.substring(0, 1997) + '...';
                    await dmChannel.send(`${truncated}\n\n*Response was truncated due to length limits.*`);
                } else {
                    await dmChannel.send(aiResponse);
                }
                
                // Send follow-up message in DM
                await dmChannel.send('💬 You can continue our conversation here! Just send me messages directly without using `/chat` - I\'ll respond to everything you say in DMs.');
                
                // Reply to the slash command
                await interaction.editReply({ 
                    content: '📨 I\'ve sent you a DM! You can continue our conversation there without using `/chat` again.' 
                });
                
            } catch (dmError) {
                logger.warn(`Could not send DM to ${interaction.user.tag}:`, dmError);
                
                // Fallback: send response in the channel if DM fails
                if (aiResponse.length > 2000) {
                    const truncated = aiResponse.substring(0, 1997) + '...';
                    await interaction.editReply({
                        content: `${truncated}\n\n*Response was truncated due to length limits.*\n\n⚠️ I couldn't send you a DM - please check your privacy settings if you'd like to chat privately!`
                    });
                } else {
                    await interaction.editReply({ 
                        content: `${aiResponse}\n\n⚠️ I couldn't send you a DM - please check your privacy settings if you'd like to chat privately!` 
                    });
                }
            }
            
            logger.info(`AI chat command used by ${interaction.user.tag} in ${userContext.guildName}`);
            
        } catch (error) {
            logger.error('Error in chat command:', error);
            
            let errorMessage = 'Sorry, I encountered an error while generating a response.';
            
            if (error.message.includes('rate limit')) {
                errorMessage = 'I\'m currently rate limited. Please try again in a few moments.';
            } else if (error.message.includes('API key')) {
                errorMessage = 'There\'s an issue with my AI service configuration. Please contact an administrator.';
            }
            
            await interaction.editReply({ content: errorMessage });
        }
    },
};
