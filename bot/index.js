const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const API_URL = process.env.API_URL || 'http://localhost:3001';
const BOT_SECRET = process.env.BOT_SECRET || 'super_secret_bot_key';
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || 'YOUR_ADMIN_ROLE_ID';
const GUILD_ID = process.env.GUILD_ID || null;
const STORE_URL = process.env.STORE_URL || 'store.Echo.com';

const commands = [
  new SlashCommandBuilder()
    .setName('license')
    .setDescription('إدارة رخص متجر شفره')
    // 1. Create
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('إنشاء رخصة جديدة لشخص')
        .addUserOption(option => option.setName('user').setDescription('المستخدم المراد إنشاء الرخصة له').setRequired(true))
        .addStringOption(option =>
          option.setName('plan')
            .setDescription('اختر الخطة المطلوبة')
            .setRequired(true)
            .addChoices(
              { name: '🌟 Echo Trial — فترة تجريبية (24 ساعة)', value: 'Trial' },
              { name: '🥉 Echo Lite — حزمة أساسية', value: 'Lite' },
              { name: '🥈 Echo Pro — حزمة متقدمة', value: 'Pro' },
              { name: '👑 Echo Max — جميع المميزات', value: 'Max' }
            ))
        .addStringOption(option => option.setName('duration').setDescription('مدة الرخصة (مثال: 1d, 1w, 1m, 1y)').setRequired(true))
        .addStringOption(option => option.setName('server_name').setDescription('اسم السيرفر الذي سيظهر في اللوحة').setRequired(true))
        .addStringOption(option => option.setName('server_ip').setDescription('(IP) أيدي سيرفر الفايف إم').setRequired(false))
    )
    // 2. Info
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('استعلام عن حالة ومعلومات رخصة معينة')
        .addStringOption(option => option.setName('key').setDescription('مفتاح الرخصة').setRequired(false))
        .addUserOption(option => option.setName('user').setDescription('المستخدم المراد الاستعلام عنه').setRequired(false))
    )
    // 3. List
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('عرض قائمة بجميع الرخص الموجودة')
        .addStringOption(option => 
          option.setName('filter')
            .setDescription('تصفية الرخص')
            .setRequired(false)
            .addChoices(
              { name: '🟢 النشطة فقط', value: 'active' },
              { name: '🔴 الملغية فقط', value: 'revoked' },
              { name: '🟡 المنتهية فقط', value: 'expired' },
              { name: '👑 Elite فقط', value: 'elite' },
              { name: '🥈 Premium فقط', value: 'premium' },
              { name: '🥉 Basic فقط', value: 'basic' }
            ))
    )
    // 4. Revoke
    .addSubcommand(subcommand =>
      subcommand
        .setName('revoke')
        .setDescription('إلغاء وسحب رخصة من شخص')
        .addStringOption(option => option.setName('key').setDescription('مفتاح الرخصة').setRequired(false))
        .addUserOption(option => option.setName('user').setDescription('المستخدم المراد سحب رخصه').setRequired(false))
    )
    // 5. Delete
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('حذف رخصة نهائياً من قاعدة البيانات')
        .addStringOption(option => option.setName('key').setDescription('مفتاح الرخصة').setRequired(false))
        .addUserOption(option => option.setName('user').setDescription('المستخدم المراد حذف رخصه').setRequired(false))
    )
    // 6. Cleanup
    .addSubcommand(subcommand =>
      subcommand
        .setName('cleanup')
        .setDescription('حذف جميع الرخص الملغية والمنتهية دفعة واحدة')
    )
    // 7. Stats
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('إحصائيات شاملة لجميع الرخص والأرباح 📊')
    )
    // 8. Extend
    .addSubcommand(subcommand =>
      subcommand
        .setName('extend')
        .setDescription('تمديد صلاحية رخصة موجودة')
        .addStringOption(option => option.setName('key').setDescription('مفتاح الرخصة').setRequired(true))
        .addStringOption(option => option.setName('duration').setDescription('المدة المراد إضافتها (مثال: 1m, 1y, 7d)').setRequired(true))
    )
];

client.once('ready', async () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  
  // Presence Update Logic
  let presenceStep = 0;
  const updatePresence = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/stats`, { headers: { 'Authorization': `Bearer ${BOT_SECRET}` } });
      const onlineServers = response.data.stats.active || 0;
      
      if (presenceStep === 0) {
        // Custom Status (shows text directly in profile)
        client.user.setPresence({
          activities: [{ name: 'custom', state: 'Echo Panel | discord.gg/haPZZ3BpPZ', type: 4 }],
          status: 'online'
        });
        presenceStep = 1;
      } else {
        client.user.setPresence({
          activities: [{ name: 'custom', state: `Panel server : (${onlineServers})`, type: 4 }],
          status: 'online'
        });
        presenceStep = 0;
      }
    } catch (e) { console.error('[Bot] Presence Error:', e.message); }
  };
  
  updatePresence();
  setInterval(updatePresence, 15000);

  try {
    console.log('Cleaning up old commands...');
    // Clear Global Commands
    await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
    
    // Clear Guild Commands if GUILD_ID is provided
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: [] });
      await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
      console.log(`Successfully reloaded application (/) commands for guild: ${GUILD_ID}`);
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log('Successfully reloaded global application (/) commands.');
    }
  } catch (error) {
    console.error('Command Registration Error:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'license') {
    // 🔒 Bulletproof Security Check
    const hasAdminRole = interaction.member.roles.cache.has(ADMIN_ROLE_ID);
    const hasAdminPerm = interaction.member.permissions.has('Administrator');
    
    if (!hasAdminRole && !hasAdminPerm) {
      console.log(`[Bot] Unauthorized access attempt by ${interaction.user.tag} (${interaction.user.id})`);
      return interaction.reply({ 
        content: '❌ **خطأ في الصلاحيات:**\nهذا الأمر مخصص فقط للإدارة العليا ولا يمكنك استخدامه.', 
        ephemeral: true 
      });
    }

    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: [4096] });

    try {
      if (subcommand === 'create') {
        const targetUser = interaction.options.getUser('user');
        const plan = interaction.options.getString('plan');
        const duration = interaction.options.getString('duration');
        const server_name = interaction.options.getString('server_name');
        const server_ip = interaction.options.getString('server_ip');

        const response = await axios.post(`${API_URL}/api/generate-license`, { 
          discordId: targetUser.id, 
          slots: 1, 
          duration, 
          ip: server_ip, 
          productName: `Echo ${plan}`,
          initialServerName: server_name
        }, { headers: { 'Authorization': `Bearer ${BOT_SECRET}` } });
        
        if (response.data.success) {
          const { licenseKey, expiresAt } = response.data;
          const embed = new EmbedBuilder()
            .setTitle('👑 New License Generated')
            .setColor('#22c55e')
            .setDescription(`A new license has been created and sent to the user's DMs.`)
            .addFields(
              { name: '🔑 License Key', value: `\`${licenseKey}\``, inline: false },
              { name: '👤 Owner', value: `<@${targetUser.id}>`, inline: true },
              { name: '📦 Plan', value: `\`${plan}\``, inline: true },
              { name: '⏳ Duration', value: `\`${duration}\``, inline: true },
              { name: '📅 Expires At', value: `\`${new Date(expiresAt).toLocaleString('en-US')}\``, inline: false },
              { name: '🏷️ Server Name', value: `${server_name}`, inline: true },
              { name: '🌐 Server IP', value: `\`${server_ip || 'Not Linked'}\``, inline: true }
            )
            .setFooter({ text: `Echo Store • ${STORE_URL}`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

          try { await targetUser.send({ embeds: [embed] }); } catch (e) {}
          await interaction.editReply({ embeds: [embed] });
        }
      }
      else if (subcommand === 'info') {
        const key = interaction.options.getString('key');
        const user = interaction.options.getUser('user');
        
        let url = `${API_URL}/api/admin/licenses`;
        if (key) url = `${API_URL}/api/admin/license/${key}`;
        else if (user) url += `?discordId=${user.id}`;
        else return interaction.editReply('❌ يجب تقديم مفتاح الرخصة أو منشن للمستخدم.');

        const response = await axios.get(url, { headers: { 'Authorization': `Bearer ${BOT_SECRET}` } });
        const data = response.data;
        
        if (key && data.license) {
          const l = data.license;
          const expired = new Date(l.expires_at) < new Date();
          const statusEmoji = !l.is_active ? '🔴' : expired ? '🟡' : '🟢';
          const statusText = !l.is_active ? 'Revoked' : expired ? 'Expired' : 'Active';

          const embed = new EmbedBuilder()
            .setTitle('ℹ️ License Information')
            .setColor(l.is_active && !expired ? '#3b82f6' : '#ef4444')
            .addFields(
              { name: '🔑 Key', value: `\`${l.license_key}\``, inline: false },
              { name: '👤 Owner', value: `<@${l.owner_discord_id}>`, inline: true },
              { name: '🏷️ Status', value: `${statusEmoji} **${statusText}**`, inline: true },
              { name: '📦 Plan', value: `\`${l.product_name}\``, inline: true },
              { name: '🌐 Linked IP', value: `\`${l.server_ip || 'None'}\``, inline: true },
              { name: '📅 Expiry Date', value: `\`${new Date(l.expires_at).toLocaleString('en-US')}\``, inline: false },
              { name: '🏪 Store', value: `[Echo Store](${STORE_URL})`, inline: true }
            )
            .setFooter({ text: 'Echo Panel System' })
            .setTimestamp();
          await interaction.editReply({ embeds: [embed] });
        } else if (user && data.licenses) {
          const embed = new EmbedBuilder()
            .setTitle(`📋 Licenses for ${user.username}`)
            .setColor('#3b82f6')
            .setDescription(data.licenses.map(l => {
              const expired = new Date(l.expires_at) < new Date();
              const statusEmoji = !l.is_active ? '🔴' : expired ? '🟡' : '🟢';
              return `${statusEmoji} \`${l.license_key}\` | **${l.product_name}**`;
            }).join('\n') || 'No licenses found.')
            .setTimestamp();
          await interaction.editReply({ embeds: [embed] });
        } else {
          await interaction.editReply('❌ License not found.');
        }
      }
      else if (subcommand === 'list') {
        const filter = interaction.options.getString('filter');
        let url = `${API_URL}/api/admin/licenses`;
        if (filter) url += `?filter=${filter}`;

        const response = await axios.get(url, { headers: { 'Authorization': `Bearer ${BOT_SECRET}` } });
        const licenses = response.data.licenses;

        const embed = new EmbedBuilder()
          .setTitle(`📋 License List — Filter: ${filter || 'All'}`)
          .setColor('#6366f1')
          .setDescription(licenses.slice(0, 15).map(l => {
            const expired = new Date(l.expires_at) < new Date();
            const statusEmoji = !l.is_active ? '🔴' : expired ? '🟡' : '🟢';
            return [
              `${statusEmoji} \`${l.license_key}\``,
              `> 👤 <@${l.owner_discord_id}> | 📦 **${l.product_name}**`,
              `> 🏷️ Server: **${l.server_name || 'No Data'}**`,
              `> 📅 Expiry: \`${new Date(l.expires_at).toLocaleString('en-US')}\``
            ].join('\n');
          }).join('\n\n') || 'No results found.')
          .setFooter({ text: `Total Licenses: ${licenses.length}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }
      else if (subcommand === 'revoke') {
        const key = interaction.options.getString('key');
        const user = interaction.options.getUser('user');
        
        if (key) {
          await axios.post(`${API_URL}/api/admin/license/revoke`, { key }, { headers: { 'Authorization': `Bearer ${BOT_SECRET}` } });
          await interaction.editReply(`🚫 تم إيقاف الرخصة \`${key}\`.`);
        } else if (user) {
          // You might need an endpoint for mass revoke, but for now we'll delete/revoke by user
          await interaction.editReply('ℹ️ سيتم دعم الإيقاف بالمنشن قريباً. استخدم المفتاح حالياً.');
        }
      }
      else if (subcommand === 'delete') {
        const key = interaction.options.getString('key');
        const user = interaction.options.getUser('user');
        await axios.post(`${API_URL}/api/admin/license/delete`, { key, discordId: user?.id }, { headers: { 'Authorization': `Bearer ${BOT_SECRET}` } });
        await interaction.editReply(`🗑️ تمت عملية الحذف بنجاح.`);
      }
      else if (subcommand === 'cleanup') {
        const response = await axios.post(`${API_URL}/api/admin/licenses/cleanup`, {}, { headers: { 'Authorization': `Bearer ${BOT_SECRET}` } });
        await interaction.editReply(`🧹 تم حذف **${response.data.count}** رخصة.`);
      }
      else if (subcommand === 'stats') {
        const response = await axios.get(`${API_URL}/api/admin/stats`, { headers: { 'Authorization': `Bearer ${BOT_SECRET}` } });
        const s = response.data.stats;
        const embed = new EmbedBuilder()
          .setTitle('إحصائيات المتجر 📊')
          .setColor('#f1c40f')
          .addFields(
            { name: 'الإجمالي', value: `\`${s.total}\``, inline: true },
            { name: 'النشطة', value: `\`${s.active}\``, inline: true },
            { name: 'المنتهية', value: `\`${s.expired}\``, inline: true }
          );
        await interaction.editReply({ embeds: [embed] });
      }
      else if (subcommand === 'extend') {
        const key = interaction.options.getString('key');
        const duration = interaction.options.getString('duration');
        const response = await axios.post(`${API_URL}/api/admin/license/extend`, { key, duration }, { headers: { 'Authorization': `Bearer ${BOT_SECRET}` } });
        if (response.data.success) {
          const newExpiry = new Date(response.data.newExpiry).toLocaleString('en-US');
          const embed = new EmbedBuilder()
            .setTitle('⏳ License Extended')
            .setColor('#22c55e')
            .setDescription(`The license key has been successfully extended.`)
            .addFields(
              { name: '🔑 Key', value: `\`${key}\``, inline: true },
              { name: '📅 New Expiry', value: `\`${newExpiry}\``, inline: true },
              { name: '⏳ Added', value: `\`${duration}\``, inline: true }
            )
            .setFooter({ text: 'Echo Panel • Renewed' })
            .setTimestamp();
          await interaction.editReply({ embeds: [embed] });
        } else {
          await interaction.editReply(`❌ Extension Failed: ${response.data.error || 'Unknown Error'}`);
        }
      }
    } catch (error) {
      console.error(error);
      await interaction.editReply('❌ فشل تنفيذ الأمر.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
