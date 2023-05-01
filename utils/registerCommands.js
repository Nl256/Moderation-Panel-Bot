// utils/registerCommands.js
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

async function registerCommands(commands, config) {
  const rest = new REST({ version: '9' }).setToken(config.token);

  try {
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands },
    );
    console.log('Successfully registered slash commands.');
  } catch (error) {
    console.error(error);
  }
}

module.exports = registerCommands;
