const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const db = require('../db/panel')
const mysqlPool = require('../db')
const axios = require('axios')
const crypto = require('crypto')

// ═══════════════════════════════════════════════════
// PLANS DEFINITION — خصائص كل حزمة
// ═══════════════════════════════════════════════════
const PLANS = {
  'Echo Trial': {
    name: 'Echo Trial | تجربة شيفرة',
    emoji: '🌟',
    color: 0x9333ea,
    price: 'Free',
    features: {
      players: true, vehicles: true, bans: true, gangs: true,
      stashes: true, investigate: true, dupeScanner: true,
      screenshots: true, liveConsole: true, playerActions: true, queue: true,
    },
    navBlocked: [],
  },
  'Echo Lite': {
    name: 'Echo Lite | شيفرة لايت',
    emoji: '🥉',
    color: 0x6b7280,
    price: '$9.99/mo',
    features: {
      players: true, vehicles: true, bans: true, gangs: false,
      stashes: false, investigate: false, dupeScanner: false,
      screenshots: false, liveConsole: false, playerActions: false, queue: false,
    },
    navBlocked: ['gangs', 'stashes', 'investigate', 'dupe-scanner', 'screenshots', 'online', 'queue'],
  },
  'Echo Pro': {
    name: 'Echo Pro | شيفرة برو',
    emoji: '🥈',
    color: 0x3b82f6,
    price: '$19.99/mo',
    features: {
      players: true, vehicles: true, bans: true, gangs: true,
      stashes: true, investigate: true, dupeScanner: true,
      screenshots: false, liveConsole: false, playerActions: false, queue: false,
    },
    navBlocked: ['screenshots', 'online', 'queue'],
  },
  'Echo Max': {
    name: 'Echo Max | شيفرة ماكس',
    emoji: '👑',
    color: 0xe53e3e,
    price: '$39.99/mo',
    features: {
      players: true, vehicles: true, bans: true, gangs: true,
      stashes: true, investigate: true, dupeScanner: true,
      screenshots: true, liveConsole: true, playerActions: true, queue: true,
    },
    navBlocked: [],
  },
}

function generateLicenseKey(plan) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const rand = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  const prefix = plan === 'Echo Max' ? 'SHF-MAX' : plan === 'Echo Pro' ? 'SHF-PRO' : plan === 'Echo Trial' ? 'SHF-TRL' : 'SHF-LIT'
  return `${prefix}-${rand(4)}-${rand(4)}`
}

function addDuration(duration) {
  const now = new Date()
  const match = duration.toLowerCase().match(/(\d+)(m|month|y|year|d|day|w|week)/)
  if (!match) return null
  const [, num, unit] = match
  const n = parseInt(num)
  if (unit.startsWith('m')) now.setMonth(now.getMonth() + n)
  else if (unit.startsWith('y')) now.setFullYear(now.getFullYear() + n)
  else if (unit.startsWith('d')) now.setDate(now.getDate() + n)
  else if (unit.startsWith('w')) now.setDate(now.getDate() + n * 7)
  return now
}

function daysLeft(expiresAt) {
  const diff = new Date(expiresAt) - new Date()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function buildLicenseEmbed(l, plan) {
  const expired = new Date(l.expires_at) < new Date()
  const planInfo = PLANS[l.plan] || PLANS['Echo Lite'] || { emoji: '❓', color: 0x808080, features: {} }
  const statusEmoji = !l.active ? '🔴' : expired ? '🟡' : '🟢'
  const statusText = !l.active ? 'Revoked' : expired ? 'Expired' : 'Active'
  const remaining = !expired && l.active ? `${daysLeft(l.expires_at)} يوم متبقي` : '-'

  const featureList = Object.entries(planInfo.features)
    .map(([k, v]) => `${v ? '✅' : '❌'} ${k}`)
    .join('\n')

  return new EmbedBuilder()
    .setColor(planInfo.color)
    .setTitle(`${planInfo.emoji} ${l.plan} License — ${l.server_name || 'Unnamed Server'}`)
    .setDescription([
      `> **${statusEmoji} ${statusText}**`,
      '',
      `**🔑 Key:** \`${l.key}\``,
      `**👤 Owner:** <@${l.discord_id}>`,
      `**🌐 Server IP:** \`${l.server_ip}\``,
      `**🏷️ Server Name:** ${l.server_name || '—'}`,
      `**📅 Expires:** ${new Date(l.expires_at).toLocaleDateString('ar-SA')}`,
      `**⏳ Remaining:** ${remaining}`,
    ].join('\n'))
    .addFields(
      { name: `${planInfo.emoji} Plan Features`, value: featureList, inline: false }
    )
    .setFooter({ text: `Echo Panel • Created: ${new Date(l.created_at).toLocaleDateString('ar-SA')}` })
    .setTimestamp()
}

const commands = [
  new SlashCommandBuilder()
    .setName('license')
    .setDescription('إدارة رخص لوحة Echo Panel')
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('إنشاء رخصة جديدة لشخص')
      .addUserOption(o => o.setName('user').setDescription('حساب الشخص في الديسكورد').setRequired(true))
      .addStringOption(o => o.setName('server_ip').setDescription('أيدي سيرفر الفايف إم (IP)').setRequired(true))
      .addStringOption(o => o.setName('server_name').setDescription('اسم السيرفر (مثال: سيرفر الأحلام)').setRequired(true))
      .addStringOption(o => o
        .setName('plan')
        .setDescription('نوع الحزمة / الباقة')
        .setRequired(true)
        .addChoices(
          { name: '🌟 Echo Trial — فتره تجريبيه (24 ساعة)', value: 'Echo Trial' },
          { name: '🥉 Echo Lite — حزمة أساسية', value: 'Echo Lite' },
          { name: '🥈 Echo Pro — حزمة متقدمة', value: 'Echo Pro' },
          { name: '👑 Echo Max — جميع المميزات', value: 'Echo Max' },
        )
      )
      .addStringOption(o => o.setName('duration').setDescription('مدة الرخصة (مثال: 1d, 1w, 1m, 1y)').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('عرض قائمة بجميع الرخص الموجودة')
      .addStringOption(o => o
        .setName('filter')
        .setDescription('تصفية الرخص')
        .setRequired(false)
        .addChoices(
          { name: '🟢 النشطة فقط', value: 'active' },
          { name: '🔴 الملغية فقط', value: 'revoked' },
          { name: '🟡 المنتهية فقط', value: 'expired' },
          { name: '👑 Elite فقط', value: 'Elite' },
          { name: '🥈 Premium فقط', value: 'Premium' },
          { name: '🥉 Basic فقط', value: 'Basic' },
        )
      )
    )
    .addSubcommand(sub => sub
      .setName('revoke')
      .setDescription('إلغاء وسحب رخصة من شخص')
      .addStringOption(o => o.setName('key').setDescription('مفتاح الرخصة (اختياري)').setRequired(false))
      .addUserOption(o => o.setName('user').setDescription('الشخص المراد سحب رخصته (اختياري)').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('استعلام عن حالة ومعلومات رخصة معينة')
      .addStringOption(o => o.setName('key').setDescription('مفتاح الرخصة').setRequired(false))
      .addUserOption(o => o.setName('user').setDescription('أو استعلم بحساب الديسكورد').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('stats')
      .setDescription('📊 إحصائيات شاملة لجميع الرخص والأرباح')
    )
    .addSubcommand(sub => sub
      .setName('delete')
      .setDescription('🗑️ حذف رخصة نهائياً من قاعدة البيانات')
      .addStringOption(o => o.setName('key').setDescription('مفتاح الرخصة المراد حذفها').setRequired(false))
      .addUserOption(o => o.setName('user').setDescription('أو اختر المستخدم لحذف رخصته').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('extend')
      .setDescription('تمديد صلاحية رخصة موجودة')
      .addStringOption(o => o.setName('key').setDescription('مفتاح الرخصة').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('المدة المراد إضافتها (مثال: 1m, 1y, 7d)').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setDescription('🧹 حذف جميع الرخص الملغية والمنتهية دفعةً واحدة')
    ),
  new SlashCommandBuilder()
    .setName('restore')
    .setDescription('♻️ إعادة إدخال جميع الأشخاص الموثقين إلى سيرفر معين (Joiner)')
    .addStringOption(o => o.setName('guild_id').setDescription('ID السيرفر المراد إدخال الناس إليه').setRequired(true))
    .addIntegerOption(o => o.setName('limit').setDescription('أقصى عدد للأشخاص (اختياري)').setRequired(false)),
].map(c => c.toJSON())

async function startBot() {
  if (!process.env.DISCORD_TOKEN) {
    console.log('[Bot] No DISCORD_TOKEN set, skipping bot startup.')
    return
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] })

  client.once('ready', async () => {
    console.log(`[Bot] Logged in as ${client.user.tag}`)
    
    let presenceStep = 0
    const updatePresence = () => {
      try {
        // Fix: Use correct column 'online' (integer 1) from servers table
        const onlineServers = db.prepare("SELECT COUNT(*) as count FROM servers WHERE online = 1").get().count
        
        if (presenceStep === 0) {
          // Show branding and link
          client.user.setPresence({
            activities: [{ name: `Echo Panel | discord.gg/haPZZ3BpPZ`, type: 3 }], // Type 3 is WATCHING
            status: 'online'
          })
          presenceStep = 1
        } else {
          // Show live stats
          client.user.setPresence({
            activities: [{ name: `Panel server : (${onlineServers})`, type: 3 }],
            status: 'online'
          })
          presenceStep = 0
        }
      } catch (e) {
        console.error('[Bot] Presence Update Error:', e.message)
      }
    }
    updatePresence()
    setInterval(updatePresence, 15000)

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN)
    try {
      if (process.env.DISCORD_GUILD_ID) {
        await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.DISCORD_GUILD_ID), { body: commands })
        console.log('[Bot] Guild Slash commands registered.')
      } else {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands })
        console.log('[Bot] Global Slash commands registered.')
      }
    } catch (e) { console.error('[Bot] Failed to register commands:', e.message) }
  })

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return
    if (interaction.commandName !== 'license') return

    // Give the bot time to process (Fixes Unknown Integration)
    await interaction.deferReply({ ephemeral: true })

    // 🔒 حماية البوت: مخصص للمالك فقط
    const allowedUserId = '1277012258005712957'
    if (interaction.user.id !== allowedUserId && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.editReply({ content: '❌ عذراً، هذا البوت مخصص للمالك فقط ولا يمكنك استخدامه.' })
    }

    const sub = interaction.options.getSubcommand()

    // ── CREATE ──
    if (sub === 'create') {
      const target = interaction.options.getUser('user')
      const serverIp = interaction.options.getString('server_ip')
      const serverName = interaction.options.getString('server_name')
      const plan = interaction.options.getString('plan')
      const expires = addDuration(duration)

      if (!expires) return interaction.editReply({ content: '❌ صيغة المدة غير صحيحة. مثال: `1month` `3month` `1year`' })

      const existing = db.prepare(`SELECT * FROM licenses WHERE discord_id = ? AND server_ip = ? AND active = 1`).get(target.id, serverIp)
      if (existing) return interaction.editReply({ content: `⚠️ يوجد رخصة نشطة لهذا المستخدم: \`${existing.key}\`` })

      const key = generateLicenseKey(plan)
      db.prepare(`INSERT INTO licenses (key, discord_id, discord_username, server_ip, server_name, plan, expires_at) VALUES (?,?,?,?,?,?,?)`).run(
        key, target.id, target.username, serverIp, serverName, plan, expires.toISOString()
      )

      const planInfo = PLANS[plan]
      const featureList = Object.entries(planInfo.features).map(([k, v]) => `${v ? '✅' : '❌'} ${k}`).join('\n')

      const dmEmbed = new EmbedBuilder()
        .setColor(planInfo.color)
        .setTitle(`${planInfo.emoji} تم إنشاء رخصتك — ${plan}`)
        .setDescription([
          `> 🇸🇦 مرحباً **${target.username}**! تم إنشاء رخصتك بنجاح.`,
          '',
          `**🔑 الرخصة:** \`${key}\``,
          `**📅 الانتهاء:** ${expires.toLocaleDateString('ar-SA')}`,
          `**⏳ المدة:** ${duration}`,
          `**🌐 IP السيرفر:** \`${serverIp}\``,
          `**🏷️ اسم السيرفر:** ${serverName}`,
          '',
          `**${planInfo.emoji} الحزمة:** ${plan}`,
          `**📦 المميزات:**`,
          featureList,
          '',
          '> ضع ملف السكربت في سيرفرك وأدخل الرخصة في ملف الكونفق لتبدأ!'
        ].join('\n'))
        .setFooter({ text: 'Echo Panel • store.Echo.com' })
        .setTimestamp()

      try { await target.send({ embeds: [dmEmbed] }) } catch {}

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(planInfo.color)
          .setTitle('✅ تم إنشاء الرخصة بنجاح')
          .addFields(
            { name: '👤 المستخدم', value: `${target.tag}`, inline: true },
            { name: `${planInfo.emoji} الحزمة`, value: plan, inline: true },
            { name: '🔑 الرخصة', value: `\`${key}\``, inline: true },
            { name: '🌐 السيرفر', value: `${serverName}\n\`${serverIp}\``, inline: true },
            { name: '📅 الانتهاء', value: expires.toLocaleDateString('ar-SA'), inline: true },
            { name: '⏳ الأيام المتبقية', value: `${daysLeft(expires.toISOString())} يوم`, inline: true },
          )
          .setTimestamp()]
      })
    }

    // ── LIST ──
    else if (sub === 'list') {
      const filter = interaction.options.getString('filter')
      
      let query = `SELECT * FROM licenses ORDER BY created_at DESC`
      let licenses = db.prepare(query).all()

      // Apply filters
      if (filter === 'active') licenses = licenses.filter(l => l.active && new Date(l.expires_at) > new Date())
      else if (filter === 'revoked') licenses = licenses.filter(l => !l.active)
      else if (filter === 'expired') licenses = licenses.filter(l => l.active && new Date(l.expires_at) < new Date())
      else if (filter === 'Elite' || filter === 'Premium' || filter === 'Basic') licenses = licenses.filter(l => l.plan === filter)

      if (!licenses.length) return interaction.editReply({ content: '📋 لا توجد رخص مطابقة.' })

      // Build paginated embeds (5 per page)
      const PAGE_SIZE = 5
      const pages = []
      for (let i = 0; i < licenses.length; i += PAGE_SIZE) {
        const chunk = licenses.slice(i, i + PAGE_SIZE)
        const embed = new EmbedBuilder()
          .setColor(0xe53e3e)
          .setTitle(`📋 قائمة الرخص ${filter ? `(${filter})` : ''} — الصفحة ${Math.floor(i/PAGE_SIZE)+1}/${Math.ceil(licenses.length/PAGE_SIZE)}`)
          .setDescription(chunk.map(l => {
            const expired = new Date(l.expires_at) < new Date()
            const statusEmoji = !l.active ? '🔴' : expired ? '🟡' : '🟢'
            const planInfo = PLANS[l.plan] || PLANS['Echo Lite'] || { emoji: '❓', color: 0x808080, features: {} }
            const days = !expired && l.active ? `${daysLeft(l.expires_at)}d` : 'EXP'
            return [
              `${statusEmoji} ${planInfo.emoji} \`${l.key}\``,
              `> 👤 <@${l.discord_id}> | 🏷️ **${l.server_name || 'No Name'}** | 🌐 \`${l.server_ip}\``,
              `> ⏳ ${days} | 📅 ${new Date(l.expires_at).toLocaleDateString('ar-SA')}`
            ].join('\n')
          }).join('\n\n'))
          .setFooter({ text: `إجمالي الرخص: ${licenses.length} | الصفحة ${Math.floor(i/PAGE_SIZE)+1}` })
          .setTimestamp()
        pages.push(embed)
      }

      await interaction.editReply({ embeds: [pages[0]] })
    }

    // ── REVOKE ──
    else if (sub === 'revoke') {
      const key = interaction.options.getString('key')
      const targetUser = interaction.options.getUser('user')

      if (!key && !targetUser) return interaction.editReply({ content: '❌ يجب إدخال مفتاح الرخصة أو اختيار الشخص.' })

      let license
      if (key) license = db.prepare(`SELECT * FROM licenses WHERE key = ? AND active = 1`).get(key)
      else license = db.prepare(`SELECT * FROM licenses WHERE discord_id = ? AND active = 1`).get(targetUser.id)

      if (!license) return interaction.editReply({ content: `❌ لا توجد رخصة نشطة.` })

      db.prepare(`UPDATE licenses SET active = 0 WHERE key = ?`).run(license.key)
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xe53e3e)
          .setTitle('🚫 تم سحب الرخصة')
          .setDescription(`تم إيقاف: \`${license.key}\`\nالخاصة بـ: <@${license.discord_id}>\nالسيرفر: **${license.server_name || license.server_ip}**`)
          .setTimestamp()],
        })
    }

    // ── INFO ──
    else if (sub === 'info') {
      const key = interaction.options.getString('key')
      const targetUser = interaction.options.getUser('user')
      
      let license
      if (key) license = db.prepare(`SELECT * FROM licenses WHERE key = ?`).get(key)
      else if (targetUser) license = db.prepare(`SELECT * FROM licenses WHERE discord_id = ? ORDER BY created_at DESC LIMIT 1`).get(targetUser.id)

      if (!license) return interaction.editReply({ content: `❌ الرخصة غير موجودة.` })

      await interaction.editReply({ embeds: [buildLicenseEmbed(license)] })
    }

    // ── DELETE ──
    else if (sub === 'delete') {
      const key = interaction.options.getString('key')
      const targetUser = interaction.options.getUser('user')

      if (!key && !targetUser) return interaction.editReply({ content: '❌ يجب إدخال مفتاح الرخصة أو اختيار المستخدم.' })

      let license
      if (key) license = db.prepare(`SELECT * FROM licenses WHERE key = ?`).get(key)
      else license = db.prepare(`SELECT * FROM licenses WHERE discord_id = ? ORDER BY created_at DESC LIMIT 1`).get(targetUser.id)

      if (!license) return interaction.reply({ content: `❌ الرخصة غير موجودة.`, ephemeral: true })

      // Confirm with button
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`confirm_delete_${license.key}`).setLabel('تأكيد الحذف النهائي').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancel_delete').setLabel('إلغاء').setStyle(ButtonStyle.Secondary),
      )

      const planInfo = PLANS[license.plan] || { emoji: '❓', color: 0x808080 }
      const expired = new Date(license.expires_at) < new Date()
      const statusText = !license.active ? '🔴 ملغية' : expired ? '🟡 منتهية' : '🟢 نشطة'

      const msg = await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xe53e3e)
          .setTitle('⚠️ تأكيد الحذف النهائي')
          .setDescription([
            `هل أنت متأكد أنك تريد **حذف** هذه الرخصة نهائياً؟`,
            `> لا يمكن التراجع عن هذا الإجراء!`,
            ``,
            `**🔑 الرخصة:** \`${license.key}\``,
            `**${planInfo.emoji} الباقة:** ${license.plan}`,
            `**👤 المستخدم:** <@${license.discord_id}>`,
            `**🌐 السيرفر:** ${license.server_name || license.server_ip}`,
            `**الحالة:** ${statusText}`,
          ].join('\n'))
          .setTimestamp()],
        components: [row],
        ephemeral: true,
      })

      const collector = msg.createMessageComponentCollector({ time: 30000 })
      collector.on('collect', async i => {
        if (i.customId === `confirm_delete_${license.key}`) {
          // Delete license and its server from DB
          db.prepare(`DELETE FROM licenses WHERE key = ?`).run(license.key)
          db.prepare(`DELETE FROM servers WHERE license_key = ?`).run(license.key)
          db.prepare(`DELETE FROM server_admins WHERE server_id IN (SELECT id FROM servers WHERE license_key = ?)`).run(license.key)
          await i.update({
            embeds: [new EmbedBuilder()
              .setColor(0x22c55e)
              .setTitle('✅ تم الحذف النهائي')
              .setDescription(`تم حذف الرخصة \`${license.key}\` نهائياً من قاعدة البيانات.`)
              .setTimestamp()],
            components: []
          })
        } else {
          await i.update({ content: '❌ تم إلغاء الحذف.', embeds: [], components: [] })
        }
        collector.stop()
      })
      collector.on('end', async (_, reason) => {
        if (reason === 'time') {
          await msg.edit({ components: [] }).catch(() => {})
        }
      })
    }

    // ── EXTEND ──
    else if (sub === 'extend') {
      const key = interaction.options.getString('key')
      const duration = interaction.options.getString('duration')

      const license = db.prepare(`SELECT * FROM licenses WHERE key = ?`).get(key)
      if (!license) return interaction.editReply({ content: `❌ الرخصة غير موجودة.` })

      const now = new Date(license.expires_at)
      const match = duration.toLowerCase().match(/(\d+)(m|month|y|year|d|day|w|week)/)
      if (!match) return interaction.editReply({ content: '❌ صيغة المدة غير صحيحة. مثال: `1month` `1year` `7day`' })
      
      const [, num, unit] = match
      const n = parseInt(num)
      if (unit.startsWith('m')) now.setMonth(now.getMonth() + n)
      else if (unit.startsWith('y')) now.setFullYear(now.getFullYear() + n)
      else if (unit.startsWith('d')) now.setDate(now.getDate() + n)
      else if (unit.startsWith('w')) now.setDate(now.getDate() + n * 7)

      db.prepare(`UPDATE licenses SET expires_at = ?, active = 1 WHERE key = ?`).run(now.toISOString(), key)

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle('⏳ تم تمديد الرخصة بنجاح')
          .setDescription([
            `تم تمديد صلاحية الرخصة: \`${key}\``,
            `**📅 التاريخ الجديد:** ${now.toLocaleDateString('ar-SA')}`,
            `**⏳ المدة المضافة:** ${duration}`,
            `**👤 المستخدم:** <@${license.discord_id}>`,
            '',
            `[Echo Store Discord](https://discord.gg/haPZZ3BpPZ)`
          ].join('\n'))
          .setTimestamp()]
      })
    }

    // ── CLEANUP ──
    else if (sub === 'cleanup') {
      const expired = db.prepare(`SELECT * FROM licenses WHERE active = 0 OR expires_at < datetime('now')`).all()

      if (!expired.length) return interaction.editReply({ content: '✅ لا توجد رخص منتهية أو ملغية للحذف.' })

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_cleanup').setLabel(`حذف ${expired.length} رخصة`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancel_cleanup').setLabel('إلغاء').setStyle(ButtonStyle.Secondary),
      )

      const msg = await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xe53e3e)
          .setTitle('🧹 تنظيف الرخص')
          .setDescription([
            `سيتم حذف **${expired.length}** رخصة منتهية أو ملغية نهائياً:`,
            ``,
            expired.map(l => `> 🔴 \`${l.key}\` — ${l.plan} — <@${l.discord_id}>`).join('\n'),
            ``,
            `**⚠️ لا يمكن التراجع عن هذا الإجراء!**`,
          ].join('\n'))
          .setTimestamp()],
        components: [row],
        ephemeral: true,
      })

      const collector = msg.createMessageComponentCollector({ time: 30000 })
      collector.on('collect', async i => {
        if (i.customId === 'confirm_cleanup') {
          const keys = expired.map(l => l.key)
          for (const key of keys) {
            db.prepare(`DELETE FROM licenses WHERE key = ?`).run(key)
            db.prepare(`DELETE FROM servers WHERE license_key = ?`).run(key)
          }
          await i.update({
            embeds: [new EmbedBuilder()
              .setColor(0x22c55e)
              .setTitle('✅ تم التنظيف')
              .setDescription(`تم حذف **${keys.length}** رخصة منتهية/ملغية نهائياً من قاعدة البيانات.`)
              .setTimestamp()],
            components: []
          })
        } else {
          await i.update({ content: '❌ تم إلغاء العملية.', embeds: [], components: [] })
        }
        collector.stop()
      })
    }

    // ── STATS ──
    else if (sub === 'stats') {
      const all = db.prepare(`SELECT * FROM licenses`).all()
      const active = all.filter(l => l.active && new Date(l.expires_at) > new Date())
      const expired = all.filter(l => l.active && new Date(l.expires_at) < new Date())
      const revoked = all.filter(l => !l.active)

      const byPlan = { 'Echo Lite': 0, 'Echo Pro': 0, 'Echo Max': 0, 'Echo Trial': 0 }
      active.forEach(l => { if (byPlan[l.plan] !== undefined) byPlan[l.plan]++ })

      const embed = new EmbedBuilder()
        .setColor(0xe53e3e)
        .setTitle('📊 إحصائيات Echo Panel')
        .addFields(
          { name: '📦 إجمالي الرخص', value: `${all.length}`, inline: true },
          { name: '🟢 النشطة', value: `${active.length}`, inline: true },
          { name: '🟡 المنتهية', value: `${expired.length}`, inline: true },
          { name: '🔴 الملغية', value: `${revoked.length}`, inline: true },
          { name: '🌟 Trial', value: `${byPlan['Echo Trial']}`, inline: true },
          { name: '🥉 Lite', value: `${byPlan['Echo Lite']}`, inline: true },
          { name: '🥈 Pro', value: `${byPlan['Echo Pro']}`, inline: true },
          { name: '👑 Max', value: `${byPlan['Echo Max']}`, inline: true },
        )
        .setFooter({ text: 'Echo Panel • Billing Stats' })
        .setTimestamp()

      await interaction.editReply({ embeds: [embed] })
    }

    // ── RESTORE (JOINER) ──
    else if (interaction.commandName === 'restore') {
      await interaction.deferReply({ ephemeral: true })
      
      const allowedUserId = '1277012258005712957'
      if (interaction.user.id !== allowedUserId && interaction.user.id !== interaction.guild.ownerId) {
        return interaction.editReply({ content: '❌ عذراً، هذا الأمر مخصص للمالك فقط.' })
      }

      const targetGuildId = interaction.options.getString('guild_id')
      const limit = interaction.options.getInteger('limit') || 1000

      try {
        const [users] = await mysqlPool.execute('SELECT * FROM discord_users LIMIT ?', [limit])
        if (users.length === 0) return interaction.editReply({ content: '⚠️ لا يوجد مستخدمون موثقون في قاعدة البيانات.' })

        await interaction.editReply({ content: `⏳ جاري البدء في عملية الإدخال لـ **${users.length}** شخص إلى السيرفر: \`${targetGuildId}\`...` })

        let successCount = 0
        let errorCount = 0

        for (const user of users) {
          try {
            // Discord API Join User
            // Method: PUT /guilds/{guild.id}/members/{user.id}
            await axios.put(`https://discord.com/api/v10/guilds/${targetGuildId}/members/${user.discord_id}`, 
              { access_token: user.access_token },
              { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' } }
            )
            successCount++
          } catch (err) {
            // If token expired, we could try to refresh it here
            errorCount++
            console.error(`[Joiner] Failed for ${user.discord_id}:`, err.response?.data || err.message)
          }
          // Small delay to avoid rate limits
          await new Promise(r => setTimeout(r, 500))
        }

        await interaction.followUp({ 
          content: `✅ اكتملت عملية الإدخال!\n🟢 ناجح: **${successCount}**\n🔴 فشل: **${errorCount}**\n📍 السيرفر: \`${targetGuildId}\``,
          ephemeral: true 
        })
      } catch (e) {
        console.error('[Restore Error]:', e)
        await interaction.editReply({ content: '❌ حدث خطأ أثناء تنفيذ العملية.' })
      }
    }
  })


  await client.login(process.env.DISCORD_TOKEN)
}

startBot().catch(e => console.error('[Bot] Error:', e.message))

module.exports = { PLANS }
