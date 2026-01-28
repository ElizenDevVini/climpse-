# Climpse

**AI that watches you work. Learns your patterns. Does them for you.**

You install it. You forget it. Days later, it says:

> "I noticed you open Twitter → Gmail → Stripe every morning. Want me to handle this?"

One click. Automated.

## How It Works

1. **Install Climpse** — run the setup wizard
2. **Work normally** — Climpse observes your app usage in the background
3. **Patterns emerge** — after a few days, it detects your repeated workflows
4. **You approve** — get a notification, click yes, and it runs for you

Climpse tracks which apps and windows you use, finds sequences you repeat, and offers to automate them. No cloud. No telemetry. Everything stays on your machine.

## Install

```bash
# Clone and install
git clone https://github.com/ElizenDevVini/climpse-.git
cd climpse-
npm install
npm run build

# Or use the install script
curl -fsSL https://raw.githubusercontent.com/ElizenDevVini/climpse-/main/install.sh | bash
```

## Quick Start

```bash
# Configure Climpse (API key, permissions, workspace)
climpse setup

# Start observing
climpse start

# Check status
climpse status

# After a few days, check what it learned
climpse patterns
```

## Commands

| Command | Description |
|---------|-------------|
| `climpse setup` | Run the setup wizard |
| `climpse start` | Start the background daemon |
| `climpse stop` | Stop the daemon |
| `climpse status` | Check if Climpse is running |
| `climpse patterns` | List learned patterns |
| `climpse patterns --approve <name>` | Approve a pattern for automation |
| `climpse patterns --reject <name>` | Reject a pattern |
| `climpse logs` | View today's activity log |
| `climpse logs -n 50` | View last 50 activity entries |

## What It Detects

Climpse watches your **app switches** — which applications you open and in what order. It finds sequences you repeat at least 3 times and asks an LLM whether the sequence is an automatable workflow.

Examples of patterns it can detect:

- **Morning routine**: Open Twitter → Gmail → Stripe Dashboard every day at 9 AM
- **Development flow**: Open VS Code → Terminal → Browser in sequence
- **Review cycle**: Open GitHub → Slack → Jira repeatedly

## Pattern Files

Detected patterns are saved as Markdown in `~/climpse/patterns/`:

```markdown
# morning-sites

## Observed
User opens these apps/sites in sequence:
1. Twitter (twitter.com)
2. Gmail (mail.google.com)
3. Stripe Dashboard (dashboard.stripe.com)

Observed 8 times over 12 days.
Usually between 08:00-09:59.

## Confidence
High (User opens Twitter, Gmail, Stripe Dashboard in sequence,
observed 8 times. Usually around 09:00.)

## Automation
1. Open https://twitter.com
2. Open https://mail.google.com
3. Open https://dashboard.stripe.com

## Status
Pending user approval
```

## Privacy

- **100% local.** Nothing leaves your machine except LLM API calls for pattern analysis.
- All activity data stored in `~/climpse/activity/` (SQLite databases, one per day).
- Screenshots stored locally, auto-pruned after 48 hours.
- API key stored in `~/.climpse/config.json`.
- **Open source.** Audit it yourself.

## LLM Providers

Climpse uses an LLM to analyze detected sequences and determine if they're automatable workflows. Supported providers:

| Provider | Models | Notes |
|----------|--------|-------|
| **Anthropic** | Claude Sonnet, etc. | Recommended |
| **OpenAI** | GPT-4o, etc. | |
| **Ollama** | Any local model | Fully offline, no API key needed |

## Architecture

```
src/
├── index.ts              # CLI entry (commander)
├── commands/             # CLI command handlers
├── wizard/               # Setup wizard (@clack/prompts)
├── observer/             # Activity tracking (active-win, screenshots, OCR)
├── patterns/             # Pattern detection & LLM analysis
├── automation/           # Workflow execution (browser, OS)
├── daemon/               # Background service (launchd, systemd)
└── notify/               # System notifications & daily digest
```

### Key Dependencies

- `active-win` — track active app + window title
- `screenshot-desktop` — periodic screenshots
- `tesseract.js` — local OCR for screen content
- `better-sqlite3` — activity storage
- `@clack/prompts` — interactive CLI wizard
- `execa` — shell/OS automation
- `node-notifier` — system notifications
- `@anthropic-ai/sdk` / `openai` — LLM integration

## How It's Different

| | Clawdbot | Climpse |
|---|----------|---------|
| **Approach** | You tell it what to do | It learns what you do |
| **Interaction** | Command-based | Observation-based |
| **Prompt** | "Do X" | "I noticed you do X" |
| **Setup** | Configure each task | Install and forget |

## Requirements

- Node.js 20+
- macOS 12+ or Linux (X11)
- Screen Recording permission (macOS) for window title access

## File Structure

```
~/.climpse/
└── config.json           # API keys, settings

~/climpse/
├── activity/             # Raw activity logs (SQLite per day)
├── patterns/             # Learned workflows (Markdown)
└── memory/               # Long-term observations
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Type check
npm run lint
```

## License

MIT
