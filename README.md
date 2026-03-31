# 🦖 Dino Bot

Tamagotchi-style WhatsApp AI companion. Starts as an egg, evolves based on how you care for it. Feed it URLs and personal facts — it builds its own personality from what you give it.

## Setup

```bash
cp .env.example .env
# fill in your OpenRouter API key

npm install
npm start
```

Scan the QR code with WhatsApp. That's it.

## Evolution Stages

| Stage | Trigger |
|-------|---------|
| 🥚 Egg | Start |
| 🐣 Hatchling | 5 interactions + 1 URL feed |
| 🦕 Baby | 20 interactions + 3 URL feeds |
| 🦖 Adult | 50 interactions + 8 URL feeds |

## Commands

| Command | Description |
|---------|-------------|
| `/status` | View dino stats |
| `/name <name>` | Name your dino |
| `/feed` | Give a snack |
| `/help` | Show commands |

## How Personality Works

- Tell it things about yourself → stored as traits
- Send it URLs → scraped, summarized, absorbed into memory
- The system prompt is rebuilt fresh each message from accumulated data
- No two dinos are the same

## Stack

- **Baileys** — WhatsApp connection (unofficial, scan QR)
- **OpenRouter** — AI backend (free tier, deepseek by default)
- **SQLite** — per-user dino state persistence
- **Cheerio** — URL scraping
