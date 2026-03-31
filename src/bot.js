import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import * as dotenv from 'dotenv'
import { getDino, createDino } from './db.js'
import { handleMessage } from './handlers.js'
import { STAGE_EMOJI } from './dino.js'
import { stagePersonalityImage, STAGE_IMAGES } from './images.js'
dotenv.config()

const logger = pino({ level: 'silent' })

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./data/auth')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: true,
    browser: ['Dino Bot', 'Chrome', '1.0.0'],
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n🦖 Scan the QR code above with WhatsApp\n')
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
          : true

      console.log('Connection closed —', lastDisconnect?.error?.message)
      if (shouldReconnect) {
        console.log('Reconnecting...')
        startBot()
      } else {
        console.log('Logged out. Delete ./data/auth and restart to re-pair.')
      }
    }

    if (connection === 'open') {
      console.log('🦕 Dino Bot is online!')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (msg.key.fromMe) continue
      if (!msg.message) continue

      const jid  = msg.key.remoteJid
      const phone = jid.replace('@s.whatsapp.net', '').replace('@g.us', '')

      // Skip group messages for now — only DMs
      if (jid.endsWith('@g.us')) continue

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        ''

      if (!text.trim()) continue

      // Get or create dino for this user
      let dino = getDino(phone)
      if (!dino) {
        dino = createDino(phone)
        await sock.sendMessage(jid, {
          text: `🥚 *tap tap*\n\n_A mysterious egg has appeared in your WhatsApp..._\n\nTalk to it. Feed it links. See what hatches.\n\nType /help to get started.`,
        })
        return
      }

      const send = (text) => sock.sendMessage(jid, { text })
      await sock.sendPresenceUpdate('composing', jid)

      try {
        await handleMessage(dino, text, send)

        // Update bot profile to reflect this user's dino
        const emoji = STAGE_EMOJI[dino.stage]
        const displayName = dino.name ? `${emoji} ${dino.name}` : `${emoji} Dino`
        try {
          await sock.updateProfileName(displayName)
          await sock.updateProfilePicture(sock.user.id, stagePersonalityImage(dino.stage, dino.personality))
        } catch (profileErr) {
          console.error('Profile update error:', profileErr.message)
        }
      } catch (err) {
        console.error('Handler error:', err)
        await send('_*dino confused*_ 🥚')
      }

      await sock.sendPresenceUpdate('paused', jid)
    }
  })
}

startBot().catch(console.error)
