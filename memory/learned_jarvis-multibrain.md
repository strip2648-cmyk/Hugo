# jarvis-multibrain

**Source:** https://github.com/pguilp25/jarvis.git
**Category:** cognition

# JARVIS — a multi-brain coding agent built on free/cheap models

JARVIS coordinates a handful of **free and very cheap** LLMs — NVIDIA NIM, OpenRouter, DeepInfra, Groq, Gemini — to approximate frontier-model coding quality for **a few cents a task**, just slower. The bet behind it: instead of one weak model thinking alone, have several models plan independently, critique each other, merge the best plan, implement it, and then *verify the result by running it* — and push as much of the hard, error-prone bookkeeping as possible into a **deterministic harness** so the weak model only ever has to make a small, local decision.

The most developed part — and the part worth using — is the **coding agent ("Deep Code")**: a four-stage pipeline (UNDERSTAND → PLAN → IMPLEMENT → REVIEW) aimed at solving real GitHub issues on real repositories. On the SWE-bench Pro Python set it **resolves ~63% of a hard tuned subset and ~52% of a held-out set it was never tuned against**, and on the SWE-bench Pro **Go** set it now **resolves ~55% of a 20-instance subset** — from models that individually are nowhere near that level (see [Benchmarks](#benchmarks)).

---

## ⚠️ Honest status — what to actually use

This is a research project, not a finished product. Be selective:

- ✅ **Use the coding agent (Deep Code).** This is where almost all the engineering went. It plans, edits real files, runs its own checks, and ships a patch. It's the real deal.
- 🧪 **`medium_chat` is a promising experiment** — a new multi-brain *chat* backbone (3 proposers + a merger). It works surprisingly well and is opt-in; see [The experimental chat backbone](#the-experimental-chat-backbone-medium_chat).
- ⚠️ **Everything else works but is far from optimal** — the legacy general chat, web search, image gen, formatting. They run, but they haven't had the attention the coder has.
- 🚫 **Don't rely on the auto-router.** The classifier that decides "is this chat / a question / a coding task" is the weakest link. Skip it: go straight to Deep Code.

**The recommended way to use JARVIS:**

```bash
python ui_main.py      # opens the web UI
```

Then in the UI: paste your **free API keys** in Settings → API Keys, set your **project path** in Settings → Project, and run your coding task in **Deep Code** mode. That's the path that's been tuned and tested.

API keys are read from env vars (or the UI settings): `OPENROUTER_API_KEY(S)`, `NVIDIA_API_KEY`, `DEEPINFRA_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY(S)`. You need OpenRouter at minimum; the rest add redundancy.

---

## How it works

A single free/weak model is decent but not frontier-level, and — more importantly — it's *unreliable*: it loses track of indentation, edits the wrong line, forgets which file it's in, reinvents a format. JARVIS's whole design is two ideas stacked together.

### 1. Multi-brain: plan independently, debate, merge

```
UNDERSTAND  →  PLAN  →  IMPLEMENT  →  REVIEW
              (2 drafts        (one coder,    (run a repro,
               → 1 merger)      JSON-ops)      route a fix)
```

- **PLAN** — two planners draft a plan *independently* and in parallel (**deepseek-v4-flash** and **gpt-oss-120b** — deliberately diverse, open, non-frontier models). A merger (**deepseek-v4-flash**) then consolidates them into one plan, taking the most *correct and complete* approach rather than the longest. Disagreement between drafts is a feature: it surfaces the parts that are actually hard.
- **IMPLEMENT** — the coder (**deepseek-v4-flash**) executes one plan step at a time through structured **JSON-ops** tool calls — `read_file`, `edit_file`, `create_file`, `search_text`, `find_refs`, `run_code`, `finish`, etc. — not by dumping a blob of text.
- **REVIEW (self-verify)** — after the patch, JARVIS *writes precise behavioural checks (and/or a small reproduction) from the task's own description, runs the edited code*, and if a required behaviour fails — or the patch broke one that worked before — routes a corrective fix back to the coder. A check is only trusted when it *flips* fail→pass between the original and edited tree, so brittle checks can't cause a false approval. **It never reads the project's hidden test suite** — that would be cheating; it tests what the task actually *says*. Works on **any repo** — a homemade project (local bwrap sandbox + your active venv's deps) as well as a benchmarked one (the instance's Docker image). Opt-in: enable with `python3 main.py --verify` or `JARVIS_ENABLE_REVIEW=1`.

The whole pipeline runs on **deepseek-v4-flash** (pinned to the official DeepSeek provider first on OpenRouter for speed), with **gpt-oss-120b** as a second, diverse planner voice.

### 2. The harness computes the global state; the model only acts locally

This is the idea that makes weak models reliable. Anything global, stateful, or easy to get wrong is handled deterministically by the harness, so the model is left with a single small move:

- **Edits are number-first and content-verified.** The coder copies a line from the view (which carries both its line number *and* its content) and the harness applies the change by anchoring on both — so a stale line number self-corrects and a wrong anchor is rejected instead of silently corrupting the file.
- **Indentation is computed, not guessed.** The file view encodes each line's indent as a number; the harness re-emits the real whitespace. The model never counts spaces.
- **Edits run through safety gates** before they land: a parse check (reject + revert on a syntax error the edit introduced); an undefined-name / dangling-reference check (you can't delete a symbol that's still called); a **final-state dangling-*call* gate** (if the finished patch calls a symbol that's defined nowhere — because a later edit silently dropped its definition — it routes back to re-add it); a plan **step-integrity** guard (a distinct plan step is never lost to a duplicate number); an **interface-coverage oracle** (every function the issue *names* as a target must actually be modified); and an apply-time guard that refuses to overwrite a working file with empty content.
- **The code map, symbol lookups, stale-read detection, and "which file am I in" are all the harness's job.** The model asks; the harness answers with ground truth.

The slogan, from the project's own notes: *the harness computes the global, the model acts local.*

---

## What's been built (the last few hundred commits)

Much of this repo's history is hard-won, offline-verified fixes to make weak models behave. The big themes:

- **A reflex library for the coder.** Instead of vague advice, the coder's prompt carries concrete, *triggered* reflexes drawn from real observed failures: read from the source you gated on; "all / every / collect" means *accumulate*, don't overwrite; produce the exact type/literal a test expects; bytes stay bytes until you decode them; remove a symbol and fix every call site in one edit; a missing third-party import is the environment, not your bug. (A repeatedly-validated lesson: for weak models, *concrete* reflexes beat elegant abstract principles — when we tried replacing them with general principles, the score dropped.)
- **Delivery-loss guards.** A whole class of failures turned out to be the *machinery* silently discarding the model's *correct* work — a dropped plan step, a leaked tool-call blob that collapsed a plan, a self-verify revert that discarded a needed definition, a defined method clobbered by a later edit. These are now caught deterministically. On a held-out audit, **every remaining failure was a genuine reasoning/contract miss — zero were machinery bugs.**
- **A self-verifying reviewer** under a strict *snapshot-and-revert invariant*: the review can only help or be neutral, **never ship a patch worse than the coder's original.** The repro author sees the changed symbols' *signatures only* — not the implementation — so it can't be primed into rubber-stamping a buggy patch.
- **Robust, fast provider routing.** 