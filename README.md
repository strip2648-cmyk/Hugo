# HUGO / JARVIS v7.0.0

HUGO е локален, автономен асистент за меморија, природни команди, автоматизација, browser control и бизнис алатки. Работи без API клучеви и без задолжителен cloud AI. За веб-акции користи Chrome преку CDP.

## Барања

- Node.js 20 или понов
- npm
- Chrome/Chromium само ако се користат browser функциите

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

Подетален список има во [ENV.md](ENV.md), а архитектурата и модулите се опишани во [ARCHITECTURE.md](ARCHITECTURE.md) и [MODULES.md](MODULES.md).

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
