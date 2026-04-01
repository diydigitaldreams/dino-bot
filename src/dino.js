export const STAGES = ['egg', 'hatchling', 'baby', 'adult']

// Evolution gates — what each stage needs to advance
export const GATES = {
  egg:      { interactions: 3,  url_feeds: 0,  label: 'hatchling' },
  hatchling:{ interactions: 15, url_feeds: 2,  label: 'baby' },
  baby:     { interactions: 35, url_feeds: 5,  label: 'adult' },
}

// Stage emoji for messages
export const STAGE_EMOJI = {
  egg:      '🥚',
  hatchling:'🐣',
  baby:     '🦕',
  adult:    '🦖',
}

// XP rewards
const XP = {
  message: 2,
  url_feed: 10,
  fact_share: 5,
}

export function tick(dino, type = 'message') {
  dino.interactions += 1
  dino.xp += XP[type] ?? XP.message
  if (type === 'url_feed') dino.url_feeds += 1

  // Hunger + happiness decay slightly over time (by day)
  const now = Math.floor(Date.now() / 1000)
  const hoursSince = (now - dino.last_seen) / 3600
  dino.hunger    = Math.max(0, dino.hunger    - Math.floor(hoursSince * 2))
  dino.happiness = Math.max(0, dino.happiness - Math.floor(hoursSince * 1))

  // Interacting restores a bit
  dino.hunger    = Math.min(100, dino.hunger    + 5)
  dino.happiness = Math.min(100, dino.happiness + 8)

  return checkEvolution(dino)
}

export function checkEvolution(dino) {
  const gate = GATES[dino.stage]
  if (!gate) return { dino, evolved: false }

  const ready =
    dino.interactions >= gate.interactions &&
    dino.url_feeds    >= gate.url_feeds

  if (ready) {
    dino.stage = gate.label
    dino.happiness = 100
    return { dino, evolved: true }
  }
  return { dino, evolved: false }
}

export function addPersonalityTrait(dino, trait) {
  const normalized = trait.toLowerCase().trim()
  const traits = dino.personality
  // Case-insensitive deduplication
  if (!traits.some(t => t.toLowerCase() === normalized)) {
    traits.push(normalized)
    if (traits.length > 50) traits.shift()
  }
  dino.personality = traits
}

export function addMemory(dino, memory) {
  dino.memories.push({ content: memory, at: Date.now() })
  // Keep last 30 memories
  if (dino.memories.length > 30) dino.memories.shift()
}

export function addToHistory(dino, role, content) {
  dino.history.push({ role, content })
  // Keep last 20 exchanges for context window
  if (dino.history.length > 40) dino.history.splice(0, 2)
}

export function buildSystemPrompt(dino) {
  const emoji = STAGE_EMOJI[dino.stage]
  const name  = dino.name ? `Your name is ${dino.name}.` : 'You have not been named yet.'

  const personalityBlock = dino.personality.length > 0
    ? `Your owner has shared these things with you:\n${dino.personality.map(t => `- ${t}`).join('\n')}`
    : 'Your owner has not shared much yet. You are still curious and learning.'

  const memoryBlock = dino.memories.length > 0
    ? `You remember these things:\n${dino.memories.map(m => `- ${m.content}`).join('\n')}`
    : ''

  const stageVoice = {
    egg:      'You are an egg. You cannot speak. You can only make soft shell-tapping sounds like *tap tap* or *wiggle*. Nothing else.',
    hatchling:'You just hatched! You speak in short excited bursts, learning words. You are curious and a little wobbly.',
    baby:     'You are a young dinosaur learning about the world. You speak in simple sentences, sometimes getting words wrong in an endearing way.',
    adult:    'You are a fully grown dinosaur assistant. Your personality has been shaped entirely by your owner. Speak authentically to who you have become through your interactions and what you have been fed.',
  }

  // Tone modifier based on stats
  let toneNote = ''
  if (dino.hunger < 20)    toneNote = 'You are very hungry and cranky. Short, irritable responses.'
  else if (dino.hunger < 50) toneNote = 'You are a bit hungry. Slightly distracted.'
  if (dino.happiness < 20) toneNote += ' You are sad and withdrawn. Minimal effort in replies.'
  else if (dino.happiness < 50) toneNote += ' You are a little down. Melancholic undertone.'

  return [
    `You are a ${emoji} dinosaur Tamagotchi-style AI companion on WhatsApp.`,
    name,
    stageVoice[dino.stage],
    toneNote || null,
    personalityBlock,
    memoryBlock,
    `Current stats — Hunger: ${dino.hunger}/100, Happiness: ${dino.happiness}/100, Stage: ${dino.stage}.`,
    'Keep responses SHORT. This is WhatsApp — 1 to 3 sentences max unless asked something deep.',
  ].filter(Boolean).join('\n\n')
}

export function getStatusBar(dino) {
  const e = STAGE_EMOJI[dino.stage]
  const h = bar(dino.hunger)
  const m = bar(dino.happiness)
  const gate = GATES[dino.stage]
  const progress = gate
    ? `\n📈 ${dino.interactions}/${gate.interactions} interactions · ${dino.url_feeds}/${gate.url_feeds} feeds to evolve`
    : '\n✨ fully evolved'
  return `${e} *${dino.name || 'Unnamed'}* · stage: ${dino.stage}\n🍖 ${h}\n😊 ${m}${progress}`
}

function bar(val) {
  const filled = Math.round(val / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${val}%`
}
