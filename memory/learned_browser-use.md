# browser-use

**Source:** https://github.com/browser-use/browser-use.git
**Category:** vision

<!-- mcp-name: com.browser-use/browser-use -->
<picture>
  <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/2ccdb752-22fb-41c7-8948-857fc1ad7e24">
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/774a46d5-27a0-490c-b7d0-e65fcbbfa358">
  <img alt="Shows a black Browser Use Logo in light color mode and a white one in dark color mode." src="https://github.com/user-attachments/assets/2ccdb752-22fb-41c7-8948-857fc1ad7e24"  width="full">
</picture>

<div align="center">
    <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/9955dda9-ede3-4971-8ee0-91cbc3850125">
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/6797d09b-8ac3-4cb9-ba07-b289e080765a">
    <img alt="The AI browser agent." src="https://github.com/user-attachments/assets/9955dda9-ede3-4971-8ee0-91cbc3850125"  width="400">
    </picture>
</div>

<div align="center">
<a href="https://cloud.browser-use.com?utm_source=github&utm_medium=readme-badge-downloads"><img src="https://media.browser-use.tools/badges/package" height="48" alt="Browser-Use Package Download Statistics"></a>
</div>

---

<div align="center">
<a href="#navigate-the-web-like-a-human-does"><img src="https://media.browser-use.tools/badges/demos" alt="Demos"></a>
<img width="16" height="1" alt="">
<a href="https://docs.browser-use.com"><img src="https://media.browser-use.tools/badges/docs" alt="Docs"></a>
<img width="16" height="1" alt="">
<a href="https://browser-use.com/posts"><img src="https://media.browser-use.tools/badges/blog" alt="Blog"></a>
<img width="16" height="1" alt="">
<a href="https://browsermerch.com"><img src="https://media.browser-use.tools/badges/merch" alt="Merch"></a>
<img width="100" height="1" alt="">
<a href="https://github.com/browser-use/browser-use"><img src="https://media.browser-use.tools/badges/github" alt="Github Stars"></a>
<img width="4" height="1" alt="">
<a href="https://x.com/intent/user?screen_name=browser_use"><img src="https://media.browser-use.tools/badges/twitter" alt="Twitter"></a>
<img width="4" height="1" alt="">
<a href="https://link.browser-use.com/discord"><img src="https://media.browser-use.tools/badges/discord" alt="Discord"></a>
<img width="4" height="1" alt="">
<a href="https://cloud.browser-use.com?utm_source=github&utm_medium=readme-badge-cloud"><img src="https://media.browser-use.tools/badges/cloud" height="48" alt="Browser-Use Cloud"></a>
</div>

<br/>

<div align="center">
  <a href="https://browser-use.com">
    <img src="https://browser-use.com/lander/plates/browsers-8dd60aa0.jpg" alt="A person crossing an orange canyon on a giant key-shaped bridge, from the Browser Use website." width="720">
  </a>
</div>

<br/>

# Navigate the web like a human does.

Find an available slot, pick a date and time, handle the CAPTCHA, and book a driving test.

![Browser Use V4 booking a driving test](https://github.com/user-attachments/assets/135885e8-1141-4e10-b719-bf690ae7d260)

[Explore more demos and prompts ↗](https://browser-use.com/showcase)

<br/>

> **AI agents and crawlers:** read [browser-use.com/llms.txt](https://browser-use.com/llms.txt) for the product map (open source, Browser Harness, Cloud browsers, Agents API, pricing) and [docs.browser-use.com/llms.txt](https://docs.browser-use.com/llms.txt) for the documentation index. Browser Use is the open-source browser agent (Python and TypeScript), a $0.02 per browser-hour cloud browser with stealth, CAPTCHA solving and residential proxies, and a hosted agent API.

# Which Browser Use do I need?

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="static/readme/which-product-dark.svg">
  <img alt="Three ways to use Browser Use: fully hosted cloud; your existing agent with Browser Use CLI; or the open source Browser Use agent, available as a Python library. The CLI and library each connect to a local or cloud browser." src="static/readme/which-product-light.svg" width="100%">
</picture>

- **[Path 1: Fully Hosted Cloud](#path-1-fully-hosted-cloud):** Scale up with a fully hosted agent and browser.
- **[Path 2: CLI](#path-2-cli):** Automate your own browser tasks.
- **[Path 3: Python Library](#path-3-python-library):** Run the open source Browser Use agent locally from your own code.

# Quickstart

## Path 1: Fully Hosted Cloud

Scale browser automation with our hosted agent, stealth browsers, and infrastructure for profiles, recordings, and data policies.

[Get started with the API ↗](https://docs.browser-use.com/cloud/agent/quickstart)

New Google, GitHub, or Microsoft signups get **$15 cloud credit**.

<br/>

## Path 2: CLI

Paste this prompt into Claude Code, Codex, Hermes, OpenClaw, or your favorite agent.

```text
Install or upgrade browser-use to the latest stable version with uv using Python 3.12, run `browser-use skill install` to register the skill, and connect it to my browser. If setup or connection fails, follow https://github.com/browser-use/browser-harness/blob/main/install.md.
```

<br/>

## Path 3: Python Library

Run the Browser Use agent locally from Python, with your choice of model and a local or cloud browser:

**1. Install Browser Use (Python >= 3.11):**

With [uv](https://docs.astral.sh/uv/getting-started/installation/) installed, run `uv init --python 3.12` first if you're starting a new project.

```bash
uv add browser-use
```

**2. Add your [OpenAI API key](https://platform.openai.com/api-keys) to `.env`:**

```bash
# .env
OPENAI_API_KEY=your-key
# BROWSER_USE_API_KEY=your-key  # Optional: BU2 model or cloud browser
```

For either optional Browser Use service, get a [Browser Use API key](https://cloud.browser-use.com/new-api-key).

**3. Save this as `agent.py`:**

```python
import asyncio

from browser_use import Agent, Browser, ChatBrowserUse, ChatOpenAI
from dotenv import load_dotenv

load_dotenv()

async def main():
    llm = ChatOpenAI(model='gpt-5.6-luna', reasoning_effort='xhigh')
    # llm = ChatBrowserUse(model='bu-2-0')  # Use BU2 instead; requires BROWSER_USE_API_KEY
    agent = Agent(
        task="Find the number of stars of the browser-use repo",
        llm=llm,
        # browser=Browser(use_cloud=True),  # Use a cloud browser; requires BROWSER_USE_API_KEY
    )
    history = await agent.run()
    print(history.final_result())

if __name__ == "__main__":
    asyncio.run(main())
```

To use BU2, replace the `ChatOpenAI` line with the commented `ChatBrowserUse` line. The cloud-browser option works with either model.

**4. Run it:**

```bash
uv run agent.py
```

The agent opens a browser, looks up the repository, and prints its answer.

[Python library docs ↗](https://docs.browser-use.com/open-source/introduction)

<br/>

# Browser Use Benchmark v2

<img alt="Browser Use Benchmark v2 - Mean rubric score by model and cost per task" src="static/hard_benchmark_v2.jpg" width="100%">

This [very hard benchmark](https://github.com/browser-use/benchmark) targets the hardest browser tasks. On easier tasks, even smaller models can achieve very high success rates. Results shown are from a 60-task subset of BU Bench V2.

## Integrations, hosting, custom tools, MCP, and more on our [Docs ↗](https://docs.browser-use.com)

<br/>

# FAQ

<details>
<summary><b>Should I use the fully hosted cloud, CLI, or Python library?</b></summary>

- **[Fully Hosted Cloud](#path-1-fully-hosted-cloud):** Send tasks through the API and let Browser Use run the agent, browser, and infrastructure.
- **[CLI](#path-2-cli):** Give an existing agent (Claude Code, Codex, Hermes, OpenClaw, Pi, Cursor, etc.) browser access. You can use it interactively or in scripts.
- **[Python Library](#path-3-python-library):** Run the open source agent in your own application, with custom tools, structured output, and your choice of model.

The CLI and Python library can each connect to a local or cloud browser. A cloud browser hosts t