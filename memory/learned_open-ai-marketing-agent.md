# open-ai-marketing-agent

**Source:** https://github.com/SamurAIGPT/ai-marketing-agent.git
**Category:** business

# AI Marketing Agent

An AI agent for marketing strategy — email campaigns, multi-channel content planning, and product marketing — backed by real campaign and analytics APIs.

Part of [Agency Agents OS](https://github.com/Anil-matcha/agency-agents-os), an open ecosystem of specialized AI agents for real business work.

## Related Projects

- [Agency Agents OS](https://github.com/Anil-matcha/agency-agents-os) — the central catalog this repo is part of.
- [ai-ads-agent](https://github.com/SamurAIGPT/ai-ads-agent) — paid-media counterpart to this repo's organic marketing sub-agents.
- [ai-social-agent](https://github.com/SamurAIGPT/ai-social-agent) — publishes the campaigns this repo plans.
- [ai-content-repurposing-agent](https://github.com/SamurAIGPT/ai-content-repurposing-agent) — turns campaign source video into supporting clips.
- [MuAPI MCP docs](https://muapi.ai/docs/mcp) — connect this repo's `SKILL.md` files via MCP.
- [MuAPI Agent Skills](https://muapi.ai/docs/agent-skills) — background on the `SKILL.md` pattern this repo uses.
- [MuAPI access keys](https://muapi.ai/access-keys) — create the API key this agent needs.

## What this covers

This repo is the generic marketing entry point of Agency Agents OS: lifecycle and campaign email drafting, multi-channel content campaign planning, and product positioning/launch-asset planning. It is not the place for paid media or organic social — those get their own dedicated umbrellas so each agent's workflow, connections, and approval boundaries stay scoped to one job.

- Paid media (ad copy, targeting, spend) lives in `ai-ads-agent`.
- Organic social (posting, scheduling, community) lives in `ai-social-agent`.

## Sub-agents

| Agent | What it does | Status |
|---|---|---|
| [Email Marketing](agents/email-marketing/SKILL.md) | Drafts and sequences lifecycle and campaign emails from a brief | Coming Soon |
| [Content Campaign Strategy](agents/content-campaign-strategy/SKILL.md) | Plans a multi-channel content campaign around a launch or theme | Coming Soon |
| [Product Marketing](agents/product-marketing/SKILL.md) | Positioning, messaging, and launch-asset planning for a new product or feature | Coming Soon |

## Required Muapi APIs

These sub-agents are planned against the following Muapi capability names. None are live yet — see Status below.

- `marketing.send_email` — dispatch drafted email sequences through a connected sending capability
- `marketing.campaign_analytics` — pull campaign performance (opens, clicks, conversions) to inform strategy
- `analytics.ga4_report` — pull site/funnel analytics to ground content and positioning decisions in real traffic data

## Setup

1. Create a Muapi account and API key at [muapi.ai](https://muapi.ai).
2. Review the full capability surface in the Muapi OpenAPI schema: https://api.muapi.ai/openapi.json
3. Load the SKILL.md file for the sub-agent you want into your agent runtime (Claude, or any other SKILL.md-compatible runtime).
4. Provide the required inputs listed in that sub-agent's SKILL.md (brief, audience, launch details, etc.).


## Using with an AI agent

Every sub-agent's `SKILL.md` is model- and runtime-agnostic — it's plain Markdown, so it works with any LLM agent, not just Claude. Two integration paths:

**As an MCP connection (the agent gets live Muapi tools):**

Muapi runs an MCP server at `https://api.muapi.ai/mcp` that any MCP-compatible client can connect to — Cursor, Windsurf, Claude, or your own custom agent.

- **Cursor / Windsurf / other clients with a header field:** connect to `https://api.muapi.ai/mcp` with an `Authorization: Bearer YOUR_MUAPI_KEY` header.
- **claude.ai / Claude Cowork / other connector UIs with no header field:** use the URL-embedded key form instead, `https://api.muapi.ai/mcp/YOUR_MUAPI_KEY`, via Settings → Connectors → Add custom connector.
- **Claude Code / Claude Desktop:** `claude mcp add muapi -e MUAPI_API_KEY=YOUR_MUAPI_KEY -- muapi mcp serve` (uses the muapi CLI's stdio transport — Claude Code's HTTP MCP client doesn't reliably inject tools).

Full setup details for every client: [muapi.ai/docs/mcp](https://muapi.ai/docs/mcp).

**As agent instructions (any LLM follows the workflow directly):**

Drop a sub-agent's `SKILL.md` into a Claude Code project's `.claude/skills/` directory, paste it into a custom-GPT/Project's system instructions, hand it to an autonomous agent framework as a tool spec, or attach it directly in a chat conversation — then ask the agent to follow it.

## Read-only vs. write actions

- **Email drafting is `draft-only`.** The agent produces subject lines, copy, and sequencing — it does not send anything.
- **Sending is `requires-approval-to-publish`.** Dispatching a drafted sequence through `marketing.send_email` always requires an explicit human approval step before anything goes out.
- Content and positioning planning are inherently draft/plan outputs — they produce documents for a human to review, not published artifacts.

## Status and limitations

All three sub-agents are **Coming Soon**. They are blocked on `marketing.send_email`, `marketing.campaign_analytics`, and `analytics.ga4_report` — none of which are live on Muapi yet, since Muapi's current API surface is focused on generative media (image, video, audio) rather than marketing/analytics tooling. Once these capabilities ship, each SKILL.md will be updated from a planning document into a working agent definition.

## Contributing

See the central [CONTRIBUTING.md](https://github.com/Anil-matcha/agency-agents-os/blob/main/CONTRIBUTING.md) in Agency Agents OS for how to propose changes across the ecosystem.

## License

MIT — see [LICENSE](LICENSE).
