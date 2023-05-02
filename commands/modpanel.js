// commands/modpanel.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const mysql = require('mysql2/promise');

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'Users',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Function to get the config from the database
async function getConfig() {
  try {
    const [rows] = await pool.query('SELECT * FROM config');
    return rows[0];
  } catch (error) {
    console.error(error);
  }
}

async function query(sql, values) {
  try {
    const [rows] = await pool.query(sql, values);
    return rows;
  } catch (error) {
    console.error(error);
  }
}

// Function to send a punishment DM to a user
async function sendPunishmentDM(user, action, reason) {
  try {
    const dmChannel = await user.createDM();
    await dmChannel.send(`You have been **${action}** for the following reason: **${reason}**`);
  } catch (error) {
    console.error(`Error sending DM to ${user.tag}:`, error);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modpanel')
    .setDescription('A moderation panel for issuing punishments')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('The action to perform: mute, kick, or ban')
        .setRequired(true))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to perform the action on')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for the action')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('The duration of the mute in minutes')
        .setRequired(false)),
  async execute(interaction, config) {
    // Check if the user has an allowed role
    const memberRoles = interaction.member.roles.cache.map(role => role.name);
    if (!config.allowedRoles.some(role => memberRoles.includes(role))) {
      return interaction.reply('You do not have permission to use this command.');
    }

    // Get the command options
    const action = interaction.options.getString('action');
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const duration = interaction.options.getInteger('duration');

    // Check if the target user is immune
    if (config.immuneUsers.includes(targetUser.id)) {
      return interaction.reply('This user is immune to moderation actions.');
    }

    // Perform the requested action
    switch (action) {
      case 'mute':
        // Send punishment DM
        await sendPunishmentDM(targetUser, 'muted', reason, duration);

        // Find or create the Muted role
        let mutedRole = interaction.guild.roles.cache.find(role => role.name === 'Muted');
        if (!mutedRole) {
          try {
            mutedRole = await interaction.guild.roles.create({
              name: 'Muted',
              color: '#808080',
              permissions: [],
            });

            // Apply the role to all channels
            interaction.guild.channels.cache.forEach(async channel => {
              await channel.permissionOverwrites.create(mutedRole, {
                SEND_MESSAGES: false,
                ADD_REACTIONS: false,
              });
            });
          } catch
          (error) {
            console.error(error);
            return interaction.reply('Error creating the Muted role.');
            }
          }
                // Add the Muted role to the target user
    await interaction.guild.members.cache.get(targetUser.id).roles.add(mutedRole);
    interaction.reply(`Muted ${targetUser.tag} for: ${reason} (${duration} minutes)`);
    // Add mute data to the database
    await query('INSERT INTO mutes (user_id, duration) VALUES (?, ?)', [targetUser.id, duration]);
    // Remove the Muted role from the target user after 5 minutes
    setTimeout(async () => {
      await targetMember.roles.remove(mutedRole);
      interaction.followUp(`Unmuted ${targetUser.tag}.`);
    }, duration * 60000);

    // Delete mute data from the database
    await query('DELETE FROM mutes WHERE user_id = ?', [targetUser.id]);
    // check muted users
    const mutedUsers = await query('SELECT * FROM mutes');
    console.log('Muted users:', mutedUsers);
    // remove the Muted role from the target user and delete mute data from the database
    await interaction.guild.members.cache.get(targetUser.id).roles.remove(mutedRole);
    await query('DELETE FROM mutes WHERE user_id = ?', [targetUser.id]);
    interaction.reply(`Unmuted ${targetUser.tag}.`);
    break;

  case 'kick':
    // Send punishment DM
    await sendPunishmentDM(targetUser, 'kicked', reason);

    // Kick the target user
    await interaction.guild.members.cache.get(targetUser.id).kick(reason);
    interaction.reply(`Kicked ${targetUser.tag} for: ${reason}`);
    break;

  case 'ban':
    // Send punishment DM
    await sendPunishmentDM(targetUser, 'banned', reason);

    // Ban the target user
    await interaction.guild.members.cache.get(targetUser.id).ban({ reason });
    interaction.reply(`Banned ${targetUser.tag} for: ${reason}`);
    break;

  default:
    interaction.reply('Invalid action. Use "mute", "kick", or "ban".');
}
},
};
