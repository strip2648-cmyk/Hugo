# Модули

| Модул | Фајл | Акции |
|---|---|---|
| runtime | `core/runtime.js` | run / chat / goal |
| циклус | `cognition/loop.js` | `goal`, `plan` |
| меморија | `memory/store.js` | `remember`, `recall`, `memory_*`, `graph_*` |
| алатки | `tools/registry.js` | `tool_call`, `tools_*` |
| агенти | `agents/registry.js` | `agent_route|run|orchestrate` |
| очи | `eyes/actions.js` | `browser_open|read|search|click|type|form|screenshot|tabs|eval` |
| глас | `voice/speech.js` | `voice_transcript|speak|listen|wake|languages` |
| бизнис | `business/*.js` | `campaign_*`, `crm_*`, `analytics_report`, `social_publish` |
| автоматизација | `automation/*.js` | `schedule_*`, `reminders_*`, `daily_digest`, `morning_brief`, `evening_review`, `autolearn_run`, `memory_sync`, `memory_backup`, `secrets_scan` |
| интеграции | `integrations/*.js` | `integrations_*`, `mcp_*` |

| host | `host/host.js` | детекција, shell, PowerShell, WSL, процеси, апликации, clipboard, екран, говор |
| фајлови | `tools/impl/files.js` | `file_*`, `path_resolve` |
| сајтови | `sites/*.js`, `tools/impl/sites.js` | `fb_*`, `yt_*` преку твојот Chrome |
| вид | `eyes/vision.js` | `vision_page`, `vision_ask`, `vision_screen` |
| рутер | `cognition/router.js` | природни команди mk/en → вистински алатки |
| верификација | `cognition/verify.js` | независна проверка пред да се пријави успех |
| потврди | `lib/confirm.js` | гейт за деструктивни акции |
| синхронизација | `tools/sync.js` | `registry:sync`, `registry:check` |
