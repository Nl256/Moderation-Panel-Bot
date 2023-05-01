// index.js
const fs = require('fs');
const { Client, Intents } = require('discord.js');
const config = require('./config.json');
const registerCommands = require('./utils/registerCommands');

const client = new Client({ intents: [Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_BANS, Intents.FLAGS.GUILD_MESSAGES] });

// Read the command files and register the slash commands
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const commands = commandFiles.map(file => {
  const command = require(`./commands/${file}`);
  return command.data.toJSON();
});

registerCommands(commands, config);

// Handle the moderation panel command
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const command = commands.find(cmd => cmd.name === interaction.commandName);

  if (command) {
    try {
      const cmdModule = require(`./commands/${command.name}`);
      await cmdModule.execute(interaction, config);
    } catch (error) {
      console.error(error);
      interaction.reply('There was an error while executing this command.');
    }
  }
});

client.login(config.token);
