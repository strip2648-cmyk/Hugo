# gbrain

**Source:** https://github.com/garrytan/gbrain.git
**Category:** memory

# GBrain

**Give the agent you already use a memory you control.** GBrain stores explicit facts with their sources, supports corrections and withdrawal, and makes the same memory available across your agents. Start with keyless memory and keyword retrieval; add semantic search, synthesis, and background enrichment when you need them.

## Choose your setup

1. **Add GBrain to my existing agent — recommended.** Keep your agent's identity and save memory inside its environment. No new personal-agent identity or private repository is required. Start with the guide for **[Grok Bot](docs/guides/grok-bot.md)**, **[Muse](docs/guides/muse.md)**, or **[Codex / Claude Code](docs/tutorials/connect-coding-agent.md)**. [Other harnesses](#connect-gbrain-to-your-ai-client-mcp).
2. **Connect my existing hosted brain.** Grant access on the brain host, then install the private connection inside the intended harness. Follow **[hosted harness access](docs/guides/hosted-harness-access.md)**. The default profile can read and write memory; delegation is an explicit choice.

Grok **Bot** and Grok **Build** are different products. Muse's personal agent and **Muse Code** are different products too. Muse already has native editable memory; GBrain adds an explicit, portable record with provenance and shared access. See each guide's dated evidence and remaining verification steps.

I'm Garry Tan, President and CEO of Y Combinator. I built GBrain to run my own AI agents. It's the production brain behind my OpenClaw and Hermes deployments: **155,795 pages, 24,589 people, 5,340 companies**, 66 cron jobs running autonomously. My agent ingests meetings, emails, tweets, voice calls, and original ideas while I sleep. It enriches every person and company it encounters. It fixes its own citations and consolidates memory overnight. I wake up smarter than when I went to bed — and so will you.

**It works as a company brain too.** Each person on the team gets their own slice of the brain, scoped by login. When you query, you only see what you're allowed to see — never another person's notes, never another team's data. We fuzz-tested this across every way you can read the brain (search, list, lookup, multi-source reads) and got zero leaks. Drop GBrain in as your team's shared institutional memory — the [company-brain](https://www.ycombinator.com/rfs#company-brain) shape on YC's Request for Startups. If you're building in that space, you might as well build on this. **[Tutorial: set up GBrain as your company brain →](docs/tutorials/company-brain.md)**

Lots of personal-knowledge systems give you keyword matching and grep in a box. GBrain does that, and adds two things nobody else ships together:

- **A synthesis layer that gives you the actual answer.** Synthesized, well-cited prose across people, companies, deals, and ideas. Not "here are 10 chunks that mention your query"; an actual answer with citations and an explicit note on what the brain doesn't know yet. The gap analysis is the part that changes how you use the brain.
- **A self-wiring knowledge graph.** Every page write extracts entity refs and creates typed edges (`attended`, `works_at`, `invested_in`, `founded`, `advises`) with zero LLM calls. Ask "who works at Acme AI?" or "what did Bob invest in this quarter?" and get answers vector search alone can't reach. Benchmarked: **P@5 49.1%, R@5 97.9%** on a 240-page Opus-generated rich-prose corpus, **+31.4 points P@5** over its graph-disabled variant and over ripgrep-BM25 + vector-only RAG by a similar margin. Full BrainBench scorecards live in the sibling [gbrain-evals](https://github.com/garrytan/gbrain-evals) repo.

The point of building a 150K-page brain is to use it as a strategic moat. To never lose context. To query what's in your own head without re-reading it. The brain layer is what makes the moat usable. The 24/7 dream cycle is what keeps it sharp. Both run on your hardware, your DB, your keys.

It's easier to ship a daemon that runs 24/7 to ingest, enrich, and consolidate than it is to keep an agent in chat working hard. GBrain is that daemon, generalized. Install in 30 minutes. Your agent does the work. As my personal agent gets smarter, so does yours.

> **Start keyless.** Your harness subscription and any separately configured model API usage are different costs. The optional personal-agent bootstrap takes about 15 minutes; always-on enrichment needs its own compute and API configuration.

> **LLMs:** fetch [`llms.txt`](llms.txt) for the documentation map, or [`llms-full.txt`](llms-full.txt) for the same map with core docs inlined in one fetch. **Agents:** start with [`AGENTS.md`](AGENTS.md) (or [`CLAUDE.md`](CLAUDE.md) if you're Claude Code).

## What this looks like

Say you have a meeting with Alice tomorrow. You want to walk in remembering what she works on, when you last talked, and what's still open between you. Here's what you'd type, and what you'd get back.

**You ask:**

> "What do I need to know before my meeting with Alice tomorrow?"

**Most personal-knowledge tools give you back a list of pages.** Something like:

```
1. people/alice — Alice runs engineering at Acme...
2. meetings/2026-03-15-alice-q1 — Q1 product review with Alice...
3. meetings/2026-01-08-acme-kickoff — Kickoff meeting with Acme team...
4. customers/acme — Acme is a series-B fintech we work with...
5. notes/2026-04-22 — Quick chat with Alice about pricing...
```

Five pages you now have to open and read yourself to actually prepare. The tool found the right material, but it didn't do the work.

**GBrain gives you back the answer, with sources:**

```
Alice runs engineering at Acme (a series-B fintech). You last spoke
on April 22 in a quick pricing chat. Three things are still open
from that conversation:

1. She owes you the security review for the new tier
   (deadline was May 1; no update since).
2. You committed to pricing for a 500-seat tier
   (you sent it April 25; no response yet).
3. She mentioned they're hiring a CISO; you said you'd intro
   someone from your network.

Heads up: nothing's been added to the brain about Alice or Acme
since April 22, six weeks ago. She may have replied through email
or Slack DM, channels the brain doesn't see. Worth asking her to
catch up before assuming any of this is still current.
```

Every claim has a source page behind it. The "heads up" at the end tells you what the brain doesn't know yet, so you can ask Alice about it directly instead of being surprised. The brain just did your meeting prep.

This is the difference between a search engine and a brain. Search finds the pages. The brain reads them for you and writes the answer.

## Install

Requires **Bun 1.3.11 or newer**. Existing worker installations should follow the
[authorization and queue upgrade guide](docs/guides/authorization-upgrade.md)
before restarting services with this version.

> [!WARNING]
> **GBrain is NOT distributed on npm.** The npm package named `gbrain` is an unrelated
> package with no connection to this project. Do not run `npm install -g gbrain` or
> `bun add -g gbrain` — you'll get something else, and it can shadow the real binary on
> your PATH. Install and upgrade ONLY via the documented paths below
> (`bun install -g github:garrytan/gbrain`, or `git clone` + `bun install && bun link`).
> If you already ran the npm install by mistake: `npm uninstall -g gbrain` /
> `bun remove -g gbrain`, then reinstall from GitHub. `gbrain doctor` detects a
> shadowing npm install and prints the fix.

Start with the agent you already use. For Grok Bot and Muse, the dedicated guides above install an isolated launcher, repairable runtime, and memory in a verified persistent directory. For a coding agent, paste:

```text
Add GBrain memory to this existing agent. Read and follow:
https://raw.githubusercontent.com/garrytan/gbrain/master/INSTALL_FOR_AGENTS.md
Keep my current identity and instructions. Start keyless, preserve unrelated
configuration, and use the memory-only path. Do not c