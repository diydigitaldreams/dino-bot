# Dino Bot — Framework

## What It Is

Dino Bot is a Tamagotchi-style WhatsApp AI companion. Each user who messages the bot gets their own dinosaur that starts as an egg and evolves based on care and interaction. The dino develops a unique personality and appearance shaped entirely by what its owner feeds it — messages, facts, and URLs.

No two dinos are the same. A dino raised on reggaeton playlists and horror movie reviews will look and speak differently from one raised on Python tutorials and astrophysics papers.

---

## Core Principles

1. **Identity through feeding** — The dino has no preset personality. It becomes what it is given.
2. **Care drives growth** — Evolution is earned, not timed. Neglect has consequences.
3. **Appearance reflects personality** — The profile picture color and character are derived from accumulated traits, not stage alone.
4. **Stage constrains voice** — A hatchling cannot give life advice. An adult can.
5. **Multi-user isolation** — Every phone number is its own universe. Dinos do not share state.
6. **Lightweight by design** — No database dependencies. JSON files. Runs on a $50 mini PC.

---

## Architecture

```
WhatsApp (Baileys)
      │
      ▼
  bot.js          — connection, QR auth, message routing, profile sync
      │
      ▼
  handlers.js     — message parsing, command routing, evolution announcements
      │
    ┌─┴──────────────────┐
    │                    │
memory.js            dino.js
URL scraping         state machine
trait extraction     evolution logic
                     system prompt builder
                     status bar
    │                    │
    └─────────┬──────────┘
              │
           ai.js          — OpenRouter API calls (chat + summarization)
              │
           db.js           — per-user JSON file storage
              │
          images.js        — profile picture generation (personality-driven color)
```

---

## Data Flow: How a Message Becomes Personality

```
User sends message
      │
      ├── Contains URL?
      │     └── scrapeUrl() → extract text → summarizeUrl() via AI
      │           └── addMemory(dino, summary)         [stored in memories[]]
      │
      ├── Contains personal statement?
      │     └── extractPersonalityTraits()
      │           └── addPersonalityTrait(dino, trait) [stored in personality[]]
      │
      ├── tick(dino, type)
      │     ├── increment interactions, xp, url_feeds
      │     ├── decay hunger/happiness by time elapsed
      │     ├── restore hunger/happiness from interaction
      │     └── checkEvolution() → maybe advance stage
      │
      └── buildSystemPrompt(dino)
            ├── stage voice (constrains how dino speaks)
            ├── personality[] → dino knows what owner cares about
            ├── memories[]    → dino knows what it has been fed
            └── stats         → hunger/happiness affects tone
```

---

## Personality System

### Extraction

Personality traits are extracted from natural language using pattern matching:

| Pattern | Example input | Extracted trait |
|---------|--------------|-----------------|
| `i (love\|like\|enjoy\|hate) X` | "I love reggaeton" | "i love reggaeton" |
| `my favorite X is Y` | "My favorite film is Hereditary" | "my favorite film is hereditary" |
| `i'm a/an X` | "I'm a software engineer" | "i'm a software engineer" |
| `i work (as\|in\|on\|with) X` | "I work in cybersecurity" | "i work in cybersecurity" |

Traits are normalized to lowercase, deduplicated case-insensitively, and capped at 50 (FIFO).

### Categorization

Traits are categorized into personality buckets for appearance derivation:

| Category | Keywords | Profile color |
|----------|----------|---------------|
| creative | music, art, film, design, writing, poetry, dance | coral/pink |
| tech | code, programming, software, ai, data, engineering | blue |
| nature | hiking, plants, animals, outdoors, ocean, garden | green |
| social | people, friends, community, culture, travel | amber |
| dark | horror, crime, death, noir, metal, goth | deep purple |
| food | cooking, food, restaurant, coffee, eating | orange |
| sport | fitness, sport, gym, running, football | teal |

A dino's profile picture color is a weighted blend of these categories based on how many traits fall into each bucket. A dino with 8 tech traits and 2 creative traits skews blue with a coral tint.

### Memory

URL memories are summaries of scraped content stored as timestamped entries. They are injected into the system prompt as contextual knowledge the dino "remembers." Cap: 30 entries (FIFO).

---

## Evolution System

### Stages

| Stage | Emoji | Voice | AI active |
|-------|-------|-------|-----------|
| egg | 🥚 | Physical only (*tap tap*, *wiggle*) | No |
| hatchling | 🐣 | Short excited bursts, learning words | Yes (limited) |
| baby | 🦕 | Simple sentences, occasional word errors | Yes |
| adult | 🦖 | Full personality, shaped by owner | Yes (full) |

### Gates

Evolution requires BOTH interaction count AND url feeds to be met:

| Transition | Interactions | URL feeds |
|-----------|-------------|-----------|
| egg → hatchling | 5 | 1 |
| hatchling → baby | 20 | 3 |
| baby → adult | 50 | 8 |

### Stats

- **Hunger** — decays 2 per hour, restored 5 per interaction, restored 30 by `/feed`
- **Happiness** — decays 1 per hour, restored 8 per interaction
- Both are capped 0–100
- Low hunger/happiness affects system prompt tone (future: explicit tone modifier)

---

## Profile Picture System

The profile picture must reflect the dino's current state:

1. **Base color** — derived from personality trait categories (weighted blend)
2. **Stage tint** — overlaid to indicate evolution stage
3. **Format** — 256×256 PNG, generated in pure Node.js (no image dependencies)

The color updates every time the bot receives a message and handles a response.

---

## Commands

| Command | Description |
|---------|-------------|
| `/status` | Hunger, happiness, XP, stage, progress to next evolution |
| `/name <n>` | Name the dino (max 32 chars) |
| `/feed` | +30 hunger, +10 happiness |
| `/help` | Command list |

---

## Storage

Each dino is stored as a JSON file at `data/dinos/<phone>.json`.

### Schema

```json
{
  "phone": "17871234567",
  "name": "Rex",
  "stage": "baby",
  "hunger": 72,
  "happiness": 85,
  "xp": 145,
  "interactions": 23,
  "url_feeds": 4,
  "personality": ["i love horror films", "i work in cybersecurity"],
  "memories": [
    { "content": "From https://... (Title): key points...", "at": 1711900000000 }
  ],
  "history": [
    { "role": "user", "content": "hey" },
    { "role": "assistant", "content": "*wiggle*" }
  ],
  "created_at": 1711800000000,
  "last_seen": 1711900000000
}
```

---

## Deployment

- Runs on EliteDesk Mini (Ubuntu) via `npm start`
- Auth persisted at `data/auth/` — no re-scan needed on restart
- Keep-alive: `pm2 start src/bot.js --name dino-bot`
- Optional VPS mirror for uptime guarantee

---

## What Must Always Be True (Invariants)

1. Every phone number maps to exactly one dino file
2. Personality traits are always lowercase and deduplicated
3. Profile picture color always reflects personality, not just stage
4. Egg stage never calls the AI
5. Evolution is never skipped (egg cannot jump to adult)
6. History never exceeds 40 entries (20 exchanges)
7. Memories never exceed 30 entries
8. Personality never exceeds 50 traits
9. Hunger and happiness are always clamped 0–100
10. Auth files are never committed to git
