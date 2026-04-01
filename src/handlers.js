import {
  tick, addPersonalityTrait, addMemory,
  addToHistory, buildSystemPrompt, getStatusBar,
  STAGE_EMOJI, GATES,
} from './dino.js'
import { chat } from './ai.js'
import { extractUrls, extractPersonalityTraits, processUrl } from './memory.js'
import { saveDino } from './db.js'

export async function handleMessage(dino, text, send) {
  const urls  = extractUrls(text)
  const isUrl = urls.length > 0
  const isCmd = text.startsWith('/')

  if (isCmd) return handleCommand(dino, text, send)

  let urlFed = false
  if (isUrl) {
    await send('_nom nom... processing that..._')
    for (const url of urls) {
      try {
        const result = await processUrl(url)
        if (result) {
          addMemory(dino, `From ${result.url} (${result.title}): ${result.summary}`)
          urlFed = true
          await send(`_absorbed: ${result.title}_`)
        } else {
          await send(`_couldn't read that link, might be paywalled_`)
        }
      } catch (err) {
        console.error('URL processing error:', err.message)
        await send(`_had trouble with that link, try another_`)
      }
    }
  }

  const traits = extractPersonalityTraits(text)
  for (const trait of traits) addPersonalityTrait(dino, trait)

  const type = urlFed ? 'url_feed' : traits.length > 0 ? 'fact_share' : 'message'
  const { evolved } = tick(dino, type)

  if (dino.stage === 'egg') {
    const responses = ['*tap tap*', '*wiggle wiggle*', '*crack...*', '*warm rumble*', '🥚✨']
    if (urlFed) await send('🥚 *the egg glows faintly as it absorbs the data...*')
    else await send(responses[Math.floor(Math.random() * responses.length)])
    if (evolved) await sendEvolution(dino, send)
    saveDino(dino)
    return
  }

  const systemPrompt = buildSystemPrompt(dino)
  const userMsg = urlFed ? `[absorbed URLs: ${urls.join(', ')}]\n\n${text}` : text

  try {
    const reply = await chat(systemPrompt, dino.history, userMsg)
    addToHistory(dino, 'user', userMsg)
    addToHistory(dino, 'assistant', reply)
    await send(reply)
    if (evolved) await sendEvolution(dino, send)
  } catch (err) {
    await send('_dino brain glitched, try again in a sec_')
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

    case '/crack': {
      const gate = GATES[dino.stage]
      if (!gate) { await send('_already fully evolved_ 🦖'); break }
      dino.stage = gate.label
      dino.happiness = 100
      await sendEvolution(dino, send)
      break
    }

    case '/help':
      await send(
        `*Dino Bot Commands*\n\n` +
        `/status - see your dino stats\n` +
        `/name <n> - give your dino a name\n` +
        `/feed - give a snack\n` +
        `/crack - force evolve to next stage\n` +
        `/help - this message\n\n` +
        `_Talk to it, send it URLs, tell it about yourself to help it grow!_`
      )
      break

    default:
      await send(`_unknown command, try /help_`)
  }

  saveDino(dino)
}

async function sendEvolution(dino, send) {
  const msgs = {
    hatchling: `🐣 *CRACK* — the egg has hatched!! Keep talking and feeding me URLs to help me grow!`,
    baby:      `🦕 *WOAH* — ${dino.name || 'your dino'} is growing up! Baby dino with a real personality forming...`,
    adult:     `🦖 *ROOAAR* — ${dino.name || 'your dino'} is fully grown! Shaped entirely by you.`,
  }
  await send(msgs[dino.stage] ?? '✨ something changed...')
}
