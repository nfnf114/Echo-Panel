const express = require('express')
const router = express.Router()
const axios = require('axios')
const jwt = require('jsonwebtoken')
const db = require('../db/panel')

const DISCORD_API = 'https://discord.com/api/v10'

// Step 1: Redirect to Discord OAuth
router.get('/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    // ✅ الصلاحيات المطلوبة:
    // identify    = الاسم والأفاتار والبانر
    // guilds      = معرفة السيرفرات الموجود فيها
    // guilds.join = إضافته للسيرفر تلقائياً
    scope: 'identify guilds guilds.join',
  })
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`)
})

// Step 2: Discord callback
router.get('/discord/callback', async (req, res) => {
  const { code } = req.query
  if (!code) return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`)

  try {
    // Exchange code for token
    const tokenRes = await axios.post(`${DISCORD_API}/oauth2/token`,
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )

    const { access_token } = tokenRes.data

    // Get user info
    const userRes = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` }
    })
    const discordUser = userRes.data

    // ── Auto-join Discord server if DISCORD_GUILD_ID is set ──
    if (process.env.DISCORD_GUILD_ID && process.env.DISCORD_BOT_TOKEN) {
      try {
        await axios.put(
          `${DISCORD_API}/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUser.id}`,
          { access_token },
          {
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            }
          }
        )
      } catch (joinErr) {
        // لا تفشل لو الانضمام لم ينجح (ممكن يكون عضو بالفعل - 204)
        if (joinErr.response?.status !== 204) {
          console.warn('[Auth] Guild join warning:', joinErr.response?.data?.message || joinErr.message)
        }
      }
    }

    // Check if owner
    const isOwner = discordUser.id === process.env.DISCORD_OWNER_ID ? 1 : 0

    // Check license if not owner
    if (!isOwner) {
      const license = db.prepare(`SELECT * FROM licenses WHERE discord_id = ? AND active = 1`).get(discordUser.id)
      if (!license) return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_license`)
      if (new Date(license.expires_at) < new Date()) return res.redirect(`${process.env.FRONTEND_URL}/login?error=license_expired`)
    }

    // Upsert user in DB
    db.prepare(`
      INSERT INTO users (discord_id, username, avatar, is_owner) VALUES (?, ?, ?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET username=excluded.username, avatar=excluded.avatar
    `).run(discordUser.id, discordUser.username, discordUser.avatar, isOwner)

    // Get server info for this user
    const server = db.prepare(`
      SELECT s.* FROM servers s 
      JOIN licenses l ON l.key = s.license_key 
      WHERE l.discord_id = ? LIMIT 1
    `).get(discordUser.id)

    // Create JWT - use same field names as AuthCallback.tsx expects
    const avatarUrl = discordUser.avatar 
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` 
      : `https://cdn.discordapp.com/embed/avatars/0.png`

    const payload = {
      discordId: discordUser.id,
      id: discordUser.id,
      username: discordUser.username,
      avatarUrl: avatarUrl,
      avatar: discordUser.avatar,
      isOwner: !!isOwner,
      serverId: server?.id,
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'Echo_fallback', { expiresIn: '7d' })
    res.redirect(`${process.env.FRONTEND_URL}/auth-callback?token=${token}`)
  } catch (err) {
    console.error('Auth error:', err.message)
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`)
  }
})

module.exports = router
