# Dino Bot — Audit

Audit of current codebase against FRAMEWORK.md.

---

## PASS ✅

- Multi-user isolation via per-file JSON storage
- Egg stage never calls AI
- Evolution cannot be skipped (sequential gate checks)
- History capped at 40 entries
- Memories capped at 30 entries
- Personality capped at 50 traits
- Hunger/happiness clamped 0–100
- All commands implemented (/status, /name, /feed, /help)
- URL scraping + AI summarization pipeline working
- Trait extraction from natural language patterns
- Profile picture updates on each message

---

## FAIL ❌ — Issues Found

### 1. Personality has no effect on profile picture color [CRITICAL]
**Framework says:** Profile picture color is a weighted blend of personality trait categories.
**Current code:** `images.js` uses static hardcoded colors per stage only. Personality is completely ignored.
**Fix:** Derive color from trait category analysis before generating PNG.

### 2. Trait deduplication is case-sensitive [MEDIUM]
**Framework says:** Traits are normalized to lowercase and deduplicated case-insensitively.
**Current code:** `traits.includes(trait)` — "I love music" and "i love music" both get stored.
**Fix:** Normalize all traits to lowercase before storing and comparing.

### 3. `getAllDinos` uses `await import()` inside non-async scope [BUG]
**Current code:** `getAllDinos` is not async but uses `await import('fs')` — this will throw.
**Fix:** Use static import at top of file (already imported elsewhere, just use it).

### 4. `zlib.crc32` may not exist on all Node builds [BUG]
**Current code:** `import { deflateSync, crc32 } from 'zlib'` — `crc32` was added in Node 22 but is not guaranteed stable across all builds.
**Fix:** Implement a pure JS CRC32 to remove the dependency.

### 5. Trait extraction patterns miss many natural statements [MEDIUM]
**Framework says:** Extract from a broad range of personal statements.
**Current code:** Only 4 regex patterns — misses "I think", "I believe", "I spend time", "I grew up", etc.
**Fix:** Expand pattern set.

### 6. Low hunger/happiness has no effect on AI tone [LOW]
**Framework says:** Low stats affect system prompt tone.
**Current code:** Stats are reported but not used to modify voice.
**Fix:** Add tone modifier to system prompt based on stat levels.

### 7. No `.gitignore` — auth and dino data would be committed [CRITICAL]
**Fix:** Add `.gitignore` excluding `data/`, `node_modules/`, `.env`.

### 8. `saveDino` unused import in `dino.js` [CLEANUP]
**Current code:** `import { saveDino } from './db.js'` at top of dino.js but `saveDino` is never called there.
**Fix:** Remove unused import.

---

## Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Personality → profile picture not connected | CRITICAL | To fix |
| 2 | Case-sensitive trait deduplication | MEDIUM | To fix |
| 3 | getAllDinos async bug | BUG | To fix |
| 4 | zlib.crc32 unstable | BUG | To fix |
| 5 | Narrow trait extraction | MEDIUM | To fix |
| 6 | Stats not affecting AI tone | LOW | To fix |
| 7 | No .gitignore | CRITICAL | To fix |
| 8 | Unused import in dino.js | CLEANUP | To fix |
