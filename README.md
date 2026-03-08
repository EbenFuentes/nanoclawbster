<p align="center">
  <img src="assets/nanoclawbster-logo.png" alt="NanoClawbster" width="400">
</p>

<h3 align="center">Your personal AI assistant, now with claws.</h3>

<p align="center">
  <a href="https://github.com/sskarz/nanoclawbster"><img src="https://img.shields.io/badge/GitHub-NanoClawbster-red?logo=github" alt="GitHub"></a>&nbsp;
</p>

---

# NanoClawbster

A lightweight AI agent bot for Discord. Runs Claude agents in isolated Docker containers per conversation. Self-hostable, privacy-first.

## Prerequisites

- Node.js 20+
- Docker (or Apple Container on macOS)
- [Claude Code](https://claude.ai/code) installed
- A Discord bot token — create one at https://discord.com/developers/applications
  - Enable: Message Content Intent, Server Members Intent, Presence Intent
  - Bot permissions: Send Messages, Read Message History, Use Slash Commands
- Either an `ANTHROPIC_API_KEY` **or** Claude Code OAuth (used for running agents)

## Setup

```bash
git clone https://github.com/sskarz/nanoclawbster.git
cd nanoclawbster
cp .env.example .env
# Edit .env — set DISCORD_BOT_TOKEN and optionally ANTHROPIC_API_KEY
claude
```

Then in Claude Code, run:
```
/setup
```

This will:
1. Check your environment (Node, Docker, credentials)
2. Build the agent container image
3. Configure and start the background service (launchd on macOS, systemd on Linux)
4. Register your first Discord channel as the admin group

## First Run

Once running, invite your bot to a Discord server and send it a message. The admin group (set during `/setup`) gets a confirmation message when the bot comes online.

To register additional Discord channels, message the bot in your admin channel:
> register this channel as "my-group"

## Configuration

See `.env.example` for all available options with descriptions.

## Architecture

- **Host process**: Node.js service that watches Discord for messages and manages agent containers
- **Agent containers**: Isolated Docker containers running Claude via the Agents SDK — one per active conversation
- **IPC**: JSON task files written to `/data/ipc/` for inter-process coordination
- **Memory**: Per-group markdown files + SQLite for message history

Full architecture docs in `docs/SPEC.md`.

### Admin Privileges

Each registered group has an `is_admin` flag in the database. Admin agents get extra tools:

| Tool | Description |
|------|-------------|
| `register_group` | Register new groups for the bot |
| `get_stats` | View usage and system statistics |
| `restart_self` | Restart the host service |
| `pull_and_deploy` | Pull from GitHub, build, rebuild Docker if needed, restart |
| `test_container_build` | Test-build the Docker image without deploying |

All agents (admin or not) have access to: `send_message`, `schedule_task`, `list_tasks`, `pause_task`, `resume_task`, `cancel_task`.

**Key files:**

| File | What it does |
|------|-------------|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/channels/discord.ts` | Discord connection, mentions, attachments, embeds |
| `src/ipc.ts` | IPC watcher and task processing |
| `src/router.ts` | Message formatting and outbound routing |
| `src/container-runner.ts` | Spawns agent containers with mounts |
| `src/task-scheduler.ts` | Runs scheduled tasks |
| `src/db.ts` | SQLite operations |
| `container/agent-runner/src/composio-mcp.ts` | Composio MCP server for agent containers |
| `groups/*/CLAUDE.md` | Per-group memory (isolated) |

## Development

```bash
# TypeScript check
npm run build

# Run tests
npm test

# Run locally (no service)
npm run dev
```

## Usage

In Discord, @mention the bot:
```
@NanoClawbster what's on my calendar today?
@NanoClawbster send me a summary of my GitHub PRs every morning at 9am
@NanoClawbster every Monday at 8am, compile AI news from Hacker News and message me a briefing
```

## Credits

NanoClawbster is inspired by [NanoClaw](https://github.com/qwibitai/NanoClaw) by [qwibitai](https://github.com/qwibitai). The core architecture — container isolation, agent SDK integration, the message loop — draws from that project. NanoClawbster adds the Discord channel, Composio MCP, and a lobster.

## License

MIT
