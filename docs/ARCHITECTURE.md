# Архитектура

```
CLI / UI / gateway / говор / распоред
        |
  core/runtime.js     еден мозок (run / chat / goal)
        |
  core/actions.js     акции од сите модули
        |
cognition/ planner -> executor -> observer -> replan -> reflector
memory/    store, embed, graph, temporal, backlinks, dedupe, conversations
tools/     registry + 14 модули (без клучеви)
agents/    4820 агенти: рутирање + оркестрација
eyes/      Chrome преку CDP (сопствен WebSocket клиент)
voice/     браузер Web Speech
business/  campaigns, crm, analytics, publisher
automation/scheduler, reminders, digest, autolearn, memorysync
integrations/registry, health, mcp
```

Правила: една одговорност по модул; сіте повики оди низ runtime; нема клучеви; состојбата е во `memory/`.
