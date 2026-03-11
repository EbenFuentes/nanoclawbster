---
name: ugg-builds
description: Look up League of Legends champion builds, runes, items, and counters from u.gg
---

# U.GG Build Lookup

When a user asks about a League of Legends champion build, look up the latest data.

## How to look up builds

**IMPORTANT: Use WebSearch first — it's fast and reliable. Do NOT use agent-browser unless WebSearch fails to find build data.**

1. Normalize the champion name (e.g. "Lee Sin" → "lee sin", "Miss Fortune" → "miss fortune")
2. Search for the build:
   ```
   WebSearch: "u.gg {champion} {role} build current patch"
   ```
3. Use `WebFetch` on the u.gg result URL to extract build details
4. If WebFetch returns insufficient data (u.gg is client-rendered), use the search result snippets directly — they often contain the key info (runes, items, win rate)

## Only use agent-browser as a last resort

If WebSearch + WebFetch don't give enough detail, then use the browser:
```bash
agent-browser open "https://u.gg/lol/champions/{champion}/build"
agent-browser snapshot
```
Limit browser to 3-4 snapshots max. Extract what you can and respond — don't loop.

## URLs

- Build: `https://u.gg/lol/champions/{champion}/build`
- Role-specific: append `?role={role}` (support, jungle, mid, adc, top)
- Counters: `https://u.gg/lol/champions/{champion}/counters`

## Response format

Send the response via `send_message` promptly. Present the build cleanly:
- **Runes:** Primary tree + keystones, secondary tree + runes, stat shards
- **Summoner spells**
- **Items:** Starting → Core → Situational
- **Skill order:** Max order (e.g. Q > E > W)
- **Win rate** and **pick rate** if available

Default to the highest win rate build unless the user asks for something specific.
