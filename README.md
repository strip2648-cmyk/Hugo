# HUGO / JARVIS v7.0.0

HUGO е локален, автономен асистент за меморија, природни команди, автоматизација, browser control и бизнис алатки. Работи без API клучеви и без задолжителен cloud AI. За веб-акции користи Chrome преку CDP.

## Барања

- Node.js 20 или понов
- npm
- Chrome/Chromium само ако се користат browser функциите

## Брзо стартување

Откако репото е клонирано и Ollama е инсталирана, изврши ја единствената setup команда од коренот на проектот:

```bash
chmod +x setup.sh && ./setup.sh
```

Script-от проверува Node.js 20+, инсталира npm dependencies, креира `.env` со default вредности, проверува дали работи `ollama serve`, го презема моделот од `HUGO_LOCAL_AI_MODEL`, стартува Chrome/Chromium во background и на крај го стартува HUGO. Ако Ollama не работи, ќе испише: `Ollama не работи. Стартувај 'ollama serve' во посебен терминал`.

Провери ја верзијата:

```bash
node --version
npm --version
```

## Инсталација и прв старт

Отвори терминал во коренот на репото и изврши:

```bash
npm install
npm run doctor
npm test
```

Потоа стартувај го HUGO:

```bash
npm start
```

За стопирање притисни `Ctrl+C`. За брза проверка без стартување на сервисите користи `npm run capabilities`.

## Како се отвора UI

Во еден терминал остави го ова да работи:

```bash
npm run ui
```

Потоа отвори го следниот URL во browser:

```text
http://127.0.0.1:8765/
```

Ако е поставен `HUGO_DEVICE_TOKEN`, додај го како query параметар:

```text
http://127.0.0.1:8765/?token=ТВОЈОТ_ТОКЕН
```

`npm start` го стартува UI, scheduler и reminders заедно. Gateway е опционален и се активира само кога е поставен `HUGO_DEVICE_TOKEN`.

## Најкорисни команди

```bash
npm run doctor                 # конфигурација и environment
npm run capabilities           # достапни можности
npm run chat -- "помош"        # разговорна команда
npm run exec -- "време во Скопје"
npm run goal -- "организирај ги задачите"
npm run tools                  # листа на алатки
npm run tools:audit            # статус на алатките
npm run agents                 # статистика за агенти
npm run memory:stats           # статистика за меморија
npm run memory:recall -- "тема"
npm run digest                 # дневен извештај
npm run brief                  # утрински brief
npm run review                 # вечерна проверка
npm run secrets:scan           # проверка пред sync/push
```

## Chrome и browser функции

За поврзување со постоечки Chrome debug профил:

```bash
npm run chrome:attach
```

Ако Chrome не е отворен, HUGO може да стартува изолиран профил:

```bash
npm run chrome
```

Примери:

```bash
npm run exec -- "Отвори Facebook"
npm run exec -- "Отвори YouTube и пушти Imagine Dragons"
npm run exec -- "Направи test.txt со Hello"
```

HUGO не зачувува лозинки или cookies. Објавување на социјални мрежи и деструктивни операции бараат изрична потврда.

## Environment

Сите променливи се опционални. Копирај `.env.example` во `.env` ако сакаш локална конфигурација:

```bash
cp .env.example .env
```

Најважни поставки:

| Променлива | Стандардно | Намена |
|---|---:|---|
| `HUGO_DEVICE_TOKEN` | празно | заштита на UI и gateway |
| `HUGO_UI_PORT` | `8765` | UI порта |
| `HUGO_GATEWAY_PORT` | `8787` | gateway порта |
| `HUGO_CHROME_PORT` | `9222` | Chrome CDP порта |
| `HUGO_CHROME_BIN` | auto | патека до Chrome/Chromium |
| `HUGO_LOCAL_AI_ENDPOINT` | празно | опционален локален AI endpoint |
| `HUGO_TZ` | `Europe/Skopje` | временска зона |
| `HUGO_LOG_LEVEL` | `info` | `error`, `warn`, `info` или `debug` |

Подетален список има во [docs/ENV.md](docs/ENV.md), а архитектурата и модулите се опишани во [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) и [docs/MODULES.md](docs/MODULES.md).

## Ollama (опционален бесплатен локален AI)

На Linux инсталирај го Ollama и стартувај го локалниот runtime:

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
```

Во втор терминал преземи го моделот и активирај ја конфигурацијата:

```bash
ollama pull llama3.2
cp .env.example .env
npm run doctor
npm start
```

`.env.example` го поставува `OLLAMA_MODEL=llama3.2`. Endpoint-от по default е `http://127.0.0.1:11434`. Ако Ollama не работи, HUGO автоматски се враќа на постоечкото локално rule-based reasoning и не паѓа.

## Пет проверки

Изврши ги од коренот на репото:

```bash
npm run test:all
node -e "const r=require('./scripts/cognition/router'); for (const [q,a] of [['отвори fb','fb_open'],['отвори yt','yt_open'],['отвори google','browser_open']]) { const h=r.routeStep(q); if (!h || h.action !== a) throw Error(q + ' -> ' + (h && h.action)); } console.log('routing aliases: PASS')"
node -e "const p=require('./scripts/cognition/planner').decompose('generate avatar'); if (p.steps.some(s => s.action === 'generate_avatar')) throw Error('planned tool selected'); console.log('planned-tool guard: PASS')"
npm run chat -- "објасни кратко што е локален AI модел"
npm run capabilities
```

Првата команда ги извршува сите automated tests. Четвртата треба да врати одговор од Ollama кога `ollama serve` работи; петтата ќе го прикаже активниот модел и endpoint во capabilities report.

## Тестирање и registry

```bash
npm test
npm run test:jarvis
npm run test:all
npm run registry:check
npm run registry:sync
```

`npm test` го извршува основниот suite. Browser тестовите се environment-зависни и бараат достапен Chrome.

## Git и memory sync

Memory sync може да користи git repo и branch преку `HUGO_REPO` и `HUGO_BRANCH`. Пред sync секогаш провери ги тајните:

```bash
npm run secrets:scan
npm run memory:sync -- --no-push
```

`git push` не се извршува автоматски од обичен тест или од стартување на HUGO. Провери го `git diff` и статусот пред намерно да испратиш промени.

## Структура

- `scripts/cli/hugo.js` - CLI entry point
- `scripts/core/` - runtime и actions
- `scripts/cognition/` - parsing, planning и verification
- `scripts/memory/` - memory store, graph и индекси
- `scripts/tools/` - registry и локални алатки
- `scripts/ui/` и `scripts/gateway/` - HTTP интерфејси
- `scripts/eyes/` и `scripts/sites/` - Chrome/browser контрола
- `scripts/tests/` - автоматски тестови
- `data/` и `memory/` - каталози и локална состојба
