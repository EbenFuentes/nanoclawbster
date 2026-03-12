---
name: ugg-builds
description: Look up League of Legends champion builds, runes, items, and counters from u.gg
---

# U.GG Build Lookup

When a user asks about a League of Legends champion build, look up the latest data.

## How to look up builds

1. Normalize the champion name (e.g. "Lee Sin" → "lee-sin", "Miss Fortune" → "miss-fortune")
2. Search for the build:
   ```
   WebSearch: "u.gg {champion} {role} build current patch"
   ```
3. Use `WebFetch` on the u.gg result URL to extract build details
4. If WebFetch returns insufficient data (u.gg is client-rendered), use the search result snippets directly — they often contain the key info (runes, items, win rate)

## URLs

- Build: `https://u.gg/lol/champions/{champion}/build`
- Role-specific: append `?role={role}` (support, jungle, mid, adc, top)
- Counters: `https://u.gg/lol/champions/{champion}/counters`

## Screenshot (REQUIRED — always do this)

Always take a full-page screenshot of the u.gg build page and include it with your response. Do this every time, no exceptions:

```bash
mkdir -p /workspace/ipc/attachments/
agent-browser open "https://u.gg/lol/champions/{champion}/build"
agent-browser wait --load networkidle
agent-browser wait 3000
agent-browser screenshot --full /workspace/ipc/attachments/{champion}-build.png
```

Then send via `send_message` with the screenshot attached:
- `text`: the build summary
- `files`: `["{champion}-build.png"]`

## Response format

Send the response via `send_message` with the screenshot attached. Present the build cleanly in the text:
- **Runes:** Primary tree + keystones, secondary tree + runes, stat shards
- **Summoner spells**
- **Items:** Starting → Core → Situational
- **Skill order:** Max order (e.g. Q > E > W)
- **Win rate** and **pick rate** if available

Default to the highest win rate build unless the user asks for something specific.
