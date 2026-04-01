import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import * as dotenv from 'dotenv'
import { getDino, createDino } from './db.js'
import { handleMessage } from './handlers.js'
import { STAGE_EMOJI } from './dino.js'
import { stagePersonalityImage } from './images.js'
import qrcode from 'qrcode-terminal'
dotenv.config()

const logger = pino({ level: 'silent' })

// Profile update debounce — max once per hour per user
const profileLastUpdated = {}
const PROFILE_COOLDOWN_MS = 60 * 60 * 1000

// Message deduplication — track last 100 message IDs
const seenMessages = new Set()
const MAX_SEEN = 100

// Simple message queue — max 5 concurrent, prevents WA rate limiting
let activeWorkers = 0
const MAX_WORKERS = 5
const queue = []

function enqueue(fn) {
  queue.push(fn)
  processQueue()
}

async function processQueue() {
  if (activeWorkers >= MAX_WORKERS || queue.length === 0) return
  activeWorkers++
  const fn = queue.shift()
  try { await fn() } catch (e) { console.error('Queue error:', e.message) }
  finally {
    activeWorkers--
    // Small delay between messages — reduces WA abuse detection risk
    await new Promise(r => setTimeout(r, 300))
    processQueue()
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./data/auth')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: false,
    browser: ['Dino Bot', 'Chrome', '1.0.0'],
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrcode.generate(qr, { small: true })
      console.log('\n🦖 Scan the QR code with WhatsApp\n')
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

      // Deduplicate
      const msgId = msg.key.id
      if (seenMessages.has(msgId)) continue
      seenMessages.add(msgId)
      if (seenMessages.size > MAX_SEEN) {
        const first = seenMessages.values().next().value
        seenMessages.delete(first)
      }

      const jid   = msg.key.remoteJid
      const phone = jid.replace('@s.whatsapp.net', '').replace('@g.us', '')

      if (jid.endsWith('@g.us')) continue

      // Truncate input — no giant messages
      const raw =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.extendedTextMessage?.canonicalUrl ||
        ''

      // Also grab any URL from WhatsApp link previews
      const previewUrl = msg.message.extendedTextMessage?.canonicalUrl || ''
      const text = (previewUrl ? `${raw.trim()} ${previewUrl}` : raw.trim()).slice(0, 2000)
      if (!text) continue

      enqueue(async () => {
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

        const prevStage = dino.stage

        try {
          await handleMessage(dino, text, send)

          // Only update profile on evolution OR once per hour — not every message
          const now = Date.now()
          const evolved = dino.stage !== prevStage
          const cooldownPassed = !profileLastUpdated[phone] ||
            (now - profileLastUpdated[phone]) > PROFILE_COOLDOWN_MS

          if (evolved || cooldownPassed) {
            profileLastUpdated[phone] = now
            const emoji = STAGE_EMOJI[dino.stage]
            const displayName = dino.name ? `${emoji} ${dino.name}` : `${emoji} Dino`
            try {
              await sock.updateProfileName(displayName)
              await sock.updateProfilePicture(
                sock.user.id,
                stagePersonalityImage(dino.stage, dino.personality)
              )
            } catch (profileErr) {
              console.error('Profile update error:', profileErr.message)
            }
          }
        } catch (err) {
          console.error('Handler error:', err)
          await send('_*dino confused*_ 🥚')
        }

        await sock.sendPresenceUpdate('paused', jid)
      })
    }
  })

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down gracefully...')
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

startBot().catch(console.error)

