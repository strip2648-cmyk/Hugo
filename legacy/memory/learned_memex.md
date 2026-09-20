# memex

**Source:** https://github.com/vndee/memex.git
**Category:** memory

# Memex

A **local-first** temporal knowledge graph memory layer for AI agents. Single Go binary, zero dependencies beyond SQLite. Runs entirely on your machine with Ollama — no API keys required.

Inspired by Vannevar Bush's 1945 vision of a personal knowledge machine, Memex gives AI agents persistent, searchable, graph-structured memory with temporal awareness.

![Knowledge Browser](assets/001.png)
![Hybrid Search Results](assets/002.png)
![Interactive Graph Explorer](assets/003.png)

## Features

- **Local-first and private** - Runs as a single Go binary with embedded SQLite, works out of the box with Ollama, and keeps data on your machine.
- **Flexible model providers** - Supports Ollama (local), OpenAI, Gemini, Vertex AI, Azure, and Groq, with per-knowledge-base model and credential isolation.
- **Low-cost ingestion pipeline** - Uses zero-LLM rule-based extraction for structured signals (errors, commits, config changes), with LLM fallback for rich text.
- **Automatic memory capture** - Learns passively via editor hooks (`PostToolUse`, `PreCompact`, `UserPromptSubmit`) and records feedback/corrections for closed-loop improvement.
- **Temporal knowledge graph core** - Builds entities, relations, and episodes with 3-tier entity resolution, bitemporal modeling, and relation strengthening instead of duplicate edges.
- **Advanced graph retrieval** - Full N-hop subgraph extraction, Personalized PageRank scoring, weight-aware traversal, edge-type filtering, community-seeded expansion, temporal path queries, and graph-to-text summarization for richer LLM context.
- **Hybrid retrieval and lifecycle** - Combines BM25 + vector + graph traversal with RRF, plus decay, pruning, and consolidation to keep memory relevant over time.
- **Multiple interfaces** - Includes a full MCP server (25 tools), HTTP API (20+ endpoints), and a 3-pane Bubble Tea TUI with graph explorer.
- **Operationally ready** - Provides async ingestion jobs with retries and one-command editor integration via `memex init` (Claude Code, Cursor, Windsurf, VS Code, Zed).

## Quick Start

```bash
# Build
go build -o memex ./cmd/memex/

# Auto-configure your AI editors (Claude Code, Cursor, Windsurf, VS Code, Zed)
./memex init

# Create a knowledge base with local Ollama (no API keys needed)
# Requires: ollama pull nomic-embed-text && ollama pull llama3.2
./memex kb create my-project --name "My Project"

# Or use a cloud provider
./memex kb create my-project \
  --embed gemini/gemini-embedding-001 \
  --llm gemini/gemini-2.5-flash \
  --name "My Project"

# Store memories (rule-based extraction for errors/commits, LLM for rich text)
./memex store "Alice is a senior engineer working on Project Atlas" --kb my-project
./memex store "Project Atlas uses Kafka and targets Q3 completion" --kb my-project

# Search
./memex search "who works on Atlas?" --kb my-project

# Search with advanced graph options
./memex search "who works on Atlas?" --kb my-project \
  --graph-scorer pagerank --edge-types works_on,knows --expand-communities

# Traverse the graph from a specific entity
./memex graph <entity-id> --kb my-project --hops 3 --format text

# Launch the TUI
./memex tui

# Start the MCP server (for Claude, Cursor, etc.)
./memex mcp

# Start the HTTP API
./memex serve
```

## Architecture

```
Text Input
    |
    v
+-----------+     +-------------+      +-------------+      +-----------+     +-------------+
| Ingestion | --> | Rule-Based  | -?-> | LLM Extract | ---> | Entity    | --> | Relation    |
| Queue     |     | Extract     |      | (fallback)  |      | Resolution|     | Upsert &    |
|           |     | (zero cost) |      |             |      | & Merge   |     | Strengthen  |
+-----------+     +-------------+      +-------------+      +-----------+     +-------------+
                                                              |
                                                              v
                                                      +---------------+
                                                      | Embed & Store |
                                                      | (SQLite +     |
                                                      |  vec index)   |
                                                      +---------------+
                                                              |
                  +-------------------------------------------+
                  |               |               |
                  v               v               v
            +-----------+   +-----------+   +----------------------+
            | BM25 FTS  |   | Vector    |   | Graph Traversal      |
            | Search    |   | Search    |   | (BFS / PageRank /    |
            +-----------+   +-----------+   |  Weighted / Temporal)|
                  |               |         +----------------------+
                  |               |               |
                  +-------+-------+-------+-------+
                          |               |
                          v               v
                    +----------+   +-----------+
                    | RRF      |   | Community |
                    | Fusion   |   | Expansion |
                    +----------+   +-----------+
```

## How Memory Strengthening Works

When the same fact is ingested multiple times, Memex recognizes existing relations and strengthens them rather than creating duplicates:

```bash
./memex store "Alice works on Project Atlas" --kb my-project
# Creates: Alice --[WORKS_ON, weight=0.50]--> Project Atlas

./memex store "Alice is working on the Atlas project" --kb my-project
# Strengthens: Alice --[WORKS_ON, weight=0.75]--> Project Atlas (not a duplicate)
```

Weights are combined using probability union: `w = 1 - (1-a)(1-b)`, bounded to [0, 1] and monotonically increasing with each observation. This means frequently mentioned facts become high-confidence edges in the graph.

During lifecycle management:
- **Consolidation** merges duplicate entities and deduplicates any resulting duplicate edges
- **Pruning** deduplicates fragmented relations before deleting — combined weight may exceed the prune threshold, saving them from deletion

## Graph Retrieval

Memex exposes the knowledge graph directly, giving agents rich structural context beyond keyword and vector search.

### Subgraph Extraction

Retrieve the full N-hop ego-graph around any entity as structured JSON or natural language text:

```bash
# JSON subgraph (nodes + edges with metadata)
./memex graph <entity-id> --kb my-project --hops 3

# Natural language summary for LLM context
./memex graph <entity-id> --kb my-project --hops 2 --format text
```

Text output is designed for direct injection into LLM prompts:

```
Context from knowledge graph:

Alice (person, seed): Software engineer at Acme
  - works_on Project Atlas [weight: 0.90, since 2025-01-15]
  - knows Bob [weight: 0.75, since 2025-02-01]

Project Atlas (project, 1 hop): Internal platform for data processing
  - uses Kafka [weight: 0.85, since 2025-01-20]
```

### Graph Scoring Strategies

Control how the graph channel ranks entities during hybrid search:

| Scorer | Flag | Description |
|--------|------|-------------|
| **BFS** (default) | `--graph-scorer bfs` | Score = `1/hops`. Closer neighbors rank higher. |
| **PageRank** | `--graph-scorer pagerank` | Personalized PageRank from seed nodes. Hub entities rank higher. |
| **Weighted** | `--graph-scorer weighted` | Cumulative edge-weight product along path. High-confidence paths dominate. |

### Filtering & Temporal Queries

```bash
# Only traverse specific relation types
./memex search "Atlas" --kb my-project --edge-types works_on,manages

# Only traverse edges with weight >= 0.5
./memex search "Atlas" --kb my-project --graph-scorer weighted --min-weight 0.5

# Expand seeds with their community members before graph traversal
./memex search "Atlas" --kb my-project --expand-communities

# Query the graph as it was at a specific point in time
./m