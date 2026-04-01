import {
  tick, addPersonalityTrait, addMemory,
  addToHistory, buildSystemPrompt, getStatusBar,
  STAGE_EMOJI, checkEvolution,
} from './dino.js'
import { chat } from './ai.js'
import { extractUrls, extractPersonalityTraits, processUrl } from './memory.js'
import { saveDino } from './db.js'

// Entry point — route message based on dino stage
export async function handleMessage(dino, text, send) {
  const urls   = extractUrls(text)
  const isUrl  = urls.length > 0
  const isCmd  = text.startsWith('/')

  if (isCmd) return handleCommand(dino, text, send)

  // Process any URLs silently first
  let urlFed = false
  if (isUrl) {
    await send('_🦕 nom nom... processing that..._')
    for (const url of urls) {
      try {
        const result = await processUrl(url)
        if (result) {
          addMemory(dino, `From ${result.url} (${result.title}): ${result.summary}`)
          urlFed = true
        } else {
          await send(`_couldn't read that link — might be paywalled or blocked_`)
        }
      } catch (err) {
        console.error('URL processing error:', err.message)
        await send(`_had trouble digesting that link, try another one_`)
      }
    }
  }

  // Extract personality traits from message
  const traits = extractPersonalityTraits(text)
  for (const trait of traits) addPersonalityTrait(dino, trait)

  // Tick and check evolution
  const type = urlFed ? 'url_feed' : traits.length > 0 ? 'fact_share' : 'message'
  const { evolved } = tick(dino, type)

  // Egg stage — no AI, only physical responses
  if (dino.stage === 'egg') {
    const responses = ['*tap tap*', '*wiggle wiggle*', '*crack...*', '*warm rumble*', '🥚✨']
    const reply = responses[Math.floor(Math.random() * responses.length)]
    if (urlFed) await send('🥚 *the egg glows faintly as it absorbs the data...*')
    else await send(reply)
    if (evolved) await sendEvolution(dino, send)
    saveDino(dino)
    return
  }

  // All other stages — use AI
  const systemPrompt = buildSystemPrompt(dino)
  let userMsg = text
  if (urlFed) userMsg = `[fed you some URLs: ${urls.join(', ')}]\n\n${text}`

  try {
    const reply = await chat(systemPrompt, dino.history, userMsg)
    addToHistory(dino, 'user', userMsg)
    addToHistory(dino, 'assistant', reply)
    await send(reply)
    if (evolved) await sendEvolution(dino, send)
  } catch (err) {
    await send('_*dino brain glitched*_ 🦕 try again in a sec')
    console.error('AI error:', err.message)
  }

  saveDino(dino)
}

async function handleCommand(dino, text, send) {
  const [cmd, ...args] = text.trim().split(' ')

  switch (cmd.toLowerCase()) {
    case '/status':
      await send(getStatusBar(dino))
      break

    case '/name':
      if (!args.length) { await send('Usage: /name YourDinoName'); break }
      dino.name = args.join(' ').slice(0, 32)
      await send(`${STAGE_EMOJI[dino.stage]} *${dino.name}* — I have a name now! 🎉`)
      break

    case '/feed': {
      dino.hunger    = Math.min(100, dino.hunger + 30)
      dino.happiness = Math.min(100, dino.happiness + 10)
      const snacks = ['🍖', '🌿', '🦴', '🍇', '🥩']
      await send(`${snacks[Math.floor(Math.random() * snacks.length)]} *nom nom* +30 hunger`)
      break
    }

    case '/help':
      await send(
        `*Dino Bot Commands*\n\n` +
        `/status — see your dino's stats\n` +
        `/name <name> — give your dino a name\n` +
        `/feed — give your dino a snack\n` +
        `/help — this message\n\n` +
        `_Feed your dino URLs and tell it things about yourself to help it grow!_`
      )
      break

    default:
      await send(`_unknown command_ — try /help`)
  }

  saveDino(dino)
}

async function sendEvolution(dino, send) {
  const msgs = {
    hatchling: `🐣 *CRACK* — the egg has hatched!! Say hello to your new companion${dino.name ? ` ${dino.name}` : ''}! Keep talking and feeding me URLs to help me grow!`,
    baby:      `🦕 *WOAH* — ${dino.name || 'your dino'} is growing up! Now a baby dinosaur with a real personality forming...`,
    adult:     `🦖 *ROOAAR* — ${dino.name || 'your dino'} is fully grown! The dino you raised is now your AI assistant, shaped entirely by you.`,
  }
  await send(msgs[dino.stage] ?? '✨ something changed...')
}
