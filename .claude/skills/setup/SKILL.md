---
name: setup
description: Run initial NanoClawbster setup. Use when user wants to install dependencies, configure Discord, register their admin channel, or start the background service. Triggers on "setup", "install", "configure nanoclawbster", or first-time setup requests.
---

# NanoClawbster Setup

## Primary Path: bash setup.sh

For new installations, the recommended approach is a single command:

```bash
bash setup.sh
```

This runs the bootstrap (Node.js + npm install) then automatically launches an interactive wizard that handles:

1. **Docker** — detects, installs, or starts Docker
2. **Credentials** — prompts for Discord bot token, Claude auth (API key or OAuth), and assistant name
3. **Container image** — builds the agent container with streamed output
4. **Admin channel** — auto-detects the bot owner via Discord API, creates a DM channel, and registers it as the admin group
5. **Service** — builds TypeScript and installs/starts the system service (systemd on Linux, launchd on macOS, nohup fallback for WSL)
6. **Verification** — confirms everything is running and prints a summary

The wizard detects existing state (`.env`, registered groups, running service) at each step and offers to skip or reconfigure.

## Secondary Path: Claude Code Skill

For power users or troubleshooting individual steps, use `npx tsx setup/index.ts --step <name>` with the steps below. Steps emit structured status blocks to stdout. Verbose logs go to `logs/setup.log`.

**Principle:** When something is broken or missing, fix it. Don't tell the user to go fix it themselves unless it genuinely requires their manual action (e.g. pasting a secret token). If a dependency is missing, install it. If a service won't start, diagnose and repair. Ask the user for permission when needed, then do the work.

**UX Note:** Use `AskUserQuestion` for all user-facing questions.

## 1. Bootstrap (Node.js + Dependencies)

Run `bash setup.sh` and parse the status block.

- If NODE_OK=false → Node.js is missing or too old. Use `AskUserQuestion: Would you like me to install Node.js 22?` If confirmed:
  - macOS: `brew install node@22` (if brew available) or install nvm then `nvm install 22`
  - Linux: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs`, or nvm
  - After installing Node, re-run `bash setup.sh`
- If DEPS_OK=false → Read `logs/setup.log`. Try: delete `node_modules` and `package-lock.json`, re-run `bash setup.sh`. If native module build fails, install build tools (`xcode-select --install` on macOS, `build-essential` on Linux), then retry.
- If NATIVE_OK=false → better-sqlite3 failed to load. Install build tools and re-run.
- Record PLATFORM and IS_WSL for later steps.

## 2. Check Environment

Run `npx tsx setup/index.ts --step environment` and parse the status block.

- If HAS_REGISTERED_GROUPS=true → note existing config, offer to skip or reconfigure
- Record DOCKER value for step 3

## 3. Container Runtime

### 3a. Choose runtime

Check the preflight results for `APPLE_CONTAINER` and `DOCKER`, and the PLATFORM from step 1.

- PLATFORM=linux → Docker (only option)
- PLATFORM=macos + APPLE_CONTAINER=installed → Use `AskUserQuestion: Docker (default, cross-platform) or Apple Container (native macOS)?` If Apple Container, run `/convert-to-apple-container` now, then skip to 3c.
- PLATFORM=macos + APPLE_CONTAINER=not_found → Docker (default)

### 3a-docker. Install Docker

- DOCKER=running → continue to 3b
- DOCKER=installed_not_running → start Docker: `open -a Docker` (macOS) or `sudo systemctl start docker` (Linux). Wait 15s, re-check with `docker info`.
- DOCKER=not_found → Use `AskUserQuestion: Docker is required for running agents. Would you like me to install it?` If confirmed:
  - macOS: install via `brew install --cask docker`, then `open -a Docker` and wait for it to start. If brew not available, direct to Docker Desktop download at https://docker.com/products/docker-desktop
  - Linux: install with `curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER`. Note: user may need to log out/in for group membership.

### 3b. Apple Container conversion gate (if needed)

**If the chosen runtime is Apple Container**, you MUST check whether the source code has already been converted from Docker to Apple Container. Do NOT skip this step. Run:

```bash
grep -q "CONTAINER_RUNTIME_BIN = 'container'" src/container-runtime.ts && echo "ALREADY_CONVERTED" || echo "NEEDS_CONVERSION"
```

**If NEEDS_CONVERSION**, the source code still uses Docker as the runtime. You MUST run the `/convert-to-apple-container` skill NOW, before proceeding to the build step.

**If ALREADY_CONVERTED**, the code already uses Apple Container. Continue to 3c.

**If the chosen runtime is Docker**, no conversion is needed — Docker is the default. Continue to 3c.

### 3c. Build and test

Run `npx tsx setup/index.ts --step container -- --runtime <chosen>` and parse the status block.

**If BUILD_OK=false:** Read `logs/setup.log` tail for the build error.
- Cache issue (stale layers): `docker builder prune -f` (Docker) or `container builder stop && container builder rm && container builder start` (Apple Container). Retry.
- Dockerfile syntax or missing files: diagnose from the log and fix, then retry.

**If TEST_OK=false but BUILD_OK=true:** The image built but won't run. Check logs — common cause is runtime not fully started. Wait a moment and retry the test.

## 4. Claude Authentication (No Script)

If HAS_ENV=true from step 2, read `.env` and check for `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`. If present, confirm with user: keep or reconfigure?

AskUserQuestion: Claude subscription (Pro/Max) vs Anthropic API key?

**Subscription:** Tell user to run `claude setup-token` in another terminal, copy the token, add `CLAUDE_CODE_OAUTH_TOKEN=<token>` to `.env`. Do NOT collect the token in chat.

**API key:** Tell user to add `ANTHROPIC_API_KEY=<key>` to `.env`.

## 5. Discord Bot Token (No Script)

If `.env` already has `DISCORD_BOT_TOKEN`, confirm with user: keep or reconfigure?

If missing, tell user to create a Discord bot:
1. Go to https://discord.com/developers/applications
2. Create a new application → go to Bot tab → Reset Token → copy
3. Enable Privileged Gateway Intents: Message Content, Server Members, Presence
4. OAuth2 → URL Generator → select "bot" scope → Send Messages, Read Message History, Use Slash Commands
5. Invite the bot to their server using the generated URL
6. Paste the token into `.env` as `DISCORD_BOT_TOKEN=<token>`

## 6. Register Channel

Run `npx tsx setup/index.ts --step register -- --jid "dc:CHANNEL_ID" --name "channel-name" --trigger "@TriggerWord" --folder "main"` plus `--no-trigger-required` if DM, `--is-admin` for the admin channel, `--assistant-name "Name"` if not Andy.

## 7. Mount Allowlist

AskUserQuestion: Agent access to external directories?

**No:** `npx tsx setup/index.ts --step mounts -- --empty`
**Yes:** Collect paths/permissions. `npx tsx setup/index.ts --step mounts -- --json '{"allowedRoots":[...],"blockedPatterns":[],"nonMainReadOnly":true}'`

## 8. Start Service

If service already running: unload first.
- macOS: `launchctl unload ~/Library/LaunchAgents/com.nanoclawbster.plist`
- Linux: `systemctl --user stop nanoclawbster` (or `systemctl stop nanoclawbster` if root)

Run `npx tsx setup/index.ts --step service` and parse the status block.

**If FALLBACK=wsl_no_systemd:** WSL without systemd detected. Tell user they can either enable systemd in WSL (`echo -e "[boot]\nsystemd=true" | sudo tee /etc/wsl.conf` then restart WSL) or use the generated `start-nanoclawbster.sh` wrapper.

**If DOCKER_GROUP_STALE=true:** The user was added to the docker group after their session started — the systemd service can't reach the Docker socket. Ask user to run these two commands:

1. Immediate fix: `sudo setfacl -m u:$(whoami):rw /var/run/docker.sock`
2. Persistent fix (re-applies after every Docker restart):
```bash
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/socket-acl.conf << 'EOF'
[Service]
ExecStartPost=/usr/bin/setfacl -m u:USERNAME:rw /var/run/docker.sock
EOF
sudo systemctl daemon-reload
```
Replace `USERNAME` with the actual username (from `whoami`). Run the two `sudo` commands separately — the `tee` heredoc first, then `daemon-reload`. After user confirms setfacl ran, re-run the service step.

**If SERVICE_LOADED=false:**
- Read `logs/setup.log` for the error.
- macOS: check `launchctl list | grep nanoclawbster`. If PID=`-` and status non-zero, read `logs/nanoclawbster.error.log`.
- Linux: check `systemctl --user status nanoclawbster`.
- Re-run the service step after fixing.

## 9. Verify

Run `npx tsx setup/index.ts --step verify` and parse the status block.

**If STATUS=failed, fix each:**
- SERVICE=stopped → `npm run build`, then restart: `launchctl kickstart -k gui/$(id -u)/com.nanoclawbster` (macOS) or `systemctl --user restart nanoclawbster` (Linux) or `bash start-nanoclawbster.sh` (WSL nohup)
- SERVICE=not_found → re-run step 8
- CREDENTIALS=missing → re-run step 4
- REGISTERED_GROUPS=0 → re-run step 6
- MOUNT_ALLOWLIST=missing → `npx tsx setup/index.ts --step mounts -- --empty`

Tell user to test: send a message in their registered chat. Show: `tail -f logs/nanoclawbster.log`

## Troubleshooting

**Service not starting:** Check `logs/nanoclawbster.error.log`. Common: wrong Node path (re-run step 8), missing `.env` (step 4).

**Container agent fails ("Claude Code process exited with code 1"):** Ensure Docker is running — `open -a Docker` (macOS Docker), `container system start` (Apple Container), or `sudo systemctl start docker` (Linux). Check container logs in `groups/main/logs/container-*.log`.

**No response to messages:** Check trigger pattern. Admin DM doesn't need prefix. Check DB: `npx tsx setup/index.ts --step verify`. Check `logs/nanoclawbster.log`.

**Unload service:** macOS: `launchctl unload ~/Library/LaunchAgents/com.nanoclawbster.plist` | Linux: `systemctl --user stop nanoclawbster`
