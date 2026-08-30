# Интеграция сенсорной матрицы в промпт персонажа

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Подключить сенсорную матрицу (`sensory-matrix.json`, 668 вариантов) как источник «личного ощущения» персонажа — заменить компактный сигнал `describeObservationSignal` на полный телесный блок (stimulus/texture/rhythm/bodilyResponse/aftereffect).

**Architecture:** Матрица уже написана и селектор `resolveSensoryVariant(actionId, pointId, seed)` создан (Phase 4 рефакторинга). Осталось: (1) вставить выбранный вариант в `event.experience` реакционного фрейма, (2) исправить `pointLabel` (сейчас передаётся `pointId` — английский id вместо русского названия), (3) выбрать seed по `exposureCount`.

**Tech Stack:** TypeScript, better-sqlite3, Vitest.

**Ветка:** `feat/localization`. Рабочее дерево грязное (ego-state, локализация) — коммитить только свои файлы.

---

## Согласованные решения (из обсуждения)

1. **Формат** — 5 полей матрицы разворачиваются в 5 отдельных строк (не сливать в абзац).
2. **Куда вставлять** — в turn-сообщение (`buildReactionTurnMessage`), блок «Внутренний сигнал текущего момента» (ситуативный «текущий момент»), НЕ в system-промпт.
3. **Выбор варианта** — seed = `exposureCount` (уже есть в `pointState`): первый раз → вариант 0, повтор → вариант 1, и т.д. Естественная прогрессия «не повторяйся».
4. **`describeObservationSignal`** — оставить как fallback, когда матрица не покрывает пару `(action, point)`.
5. **`pointLabel`** — исправить: передавать русское название точки (`presetRepo.getPointPreset(pointId)?.label`), а не `pointId`.

---

## Контекст: что уже установлено (не перепроверять)

### Текущий путь сенсорики
```
buildPromptPayload.ts (строка 471): pointLabel: currentPointId  ← БАГ: передаёт id, не label
        ↓
compileReactionFrame → event.target = input.pointLabel (строка 615)
        ↓
experienceText (строка 173) → describeObservationSignal (компактный сигнал)
        ↓
buildReactionTurnMessage → блок «[Внутренний сигнал текущего момента]»
```

### Селектор (уже создан)
`src/domain/sensoryMatrix.ts`:
- `resolveSensoryVariant(actionId, pointId, seed)` → `SensoryVariant | null`
- `SensoryVariant = { stimulus, texture, rhythm, bodilyResponse, aftereffect }`

### Доступные данные в buildPromptPayload
- `currentActionId` = `latestResult?.tickMeta?.inputs?.action.actionKey` (строка 403)
- `currentPointId` = `latestResult?.tickMeta?.inputs?.point.pointId` (строка 404)
- `exposureBeforeTick` = `Number(latestResult?.tickMeta?.inputs?.point.exposureCount ?? 0)` (строка 453)
- `presetRepo.getPointPreset(pointId)?.label` — русское название точки

---

## Фаза 1: Исправить pointLabel (русское название точки)

### Task 1.1: Передавать label вместо id

**Objective:** В промпте персонаж должен видеть «лицо», а не «face».

**Files:**
- Modify: `src/prompts/buildPromptPayload.ts` (строка ~471)

**Step 1:** Найти строку.

```bash
grep -n "pointLabel: currentPointId" src/prompts/buildPromptPayload.ts
```

**Expected:** строка 471.

**Step 2:** Заменить на резолв русского label.

В `buildPromptPayload.ts` перед `compileReactionFrame` добавить резолв:

```ts
const currentPointLabel = currentPointId
    ? presetRepo.getPointPreset(currentPointId)?.label || currentPointId
    : undefined;
```

И заменить в вызове `compileReactionFrame`:

```ts
pointLabel: currentPointLabel,
```

**Step 3:** Проверить, что `getPointPreset` возвращает label.

```bash
sqlite3 cyberjack.sqlite "SELECT id, label FROM point_presets WHERE id IN ('face','belly','neck','chest','feet','clitoris','vagina','lips','hands','head');"
```

**Expected:** `face|Лицо`, `belly|Живот`, `neck|Шея`, `chest|Грудь`, `feet|Ступни`, `clitoris|Клитор`, `vagina|Влагалище`, `lips|Губы`, `hands|Кисти`, `head|Голова`.

**Step 4:** Запустить тест.

```bash
npx vitest run src/prompts/characterPerspective.test.ts 2>&1 | tail -10
```

**Expected:** PASS.

**Step 5:** Commit.

```bash
git add cyberjack-v0.01/src/prompts/buildPromptPayload.ts
git commit -m "fix: resolve point label (Russian) instead of raw pointId in prompt"
```

---

## Фаза 2: Вставить матрицу в event.experience

### Task 2.1: Добавить сенсорный вариант в ReactionFrame

**Objective:** Добавить поле `sensoryVariant` в `ReactionFrame.event`, чтобы turn-сообщение могло его развернуть.

**Files:**
- Modify: `src/narrative/reactionFrame.ts` (интерфейс `ReactionFrame` + `compileReactionFrame`)

**Step 1:** Добавить поле в интерфейс `ReactionFrame['event']`.

В `src/narrative/reactionFrame.ts`, в интерфейсе `ReactionFrame` (блок `event: { ... }`), добавить:

```ts
        sensoryVariant?: {
            stimulus: string;
            texture: string;
            rhythm: string;
            bodilyResponse: string;
            aftereffect: string;
        };
```

**Step 2:** Добавить поле в `CompileFrameInput`.

В интерфейсе `CompileFrameInput` добавить:

```ts
    sensoryVariant?: ReactionFrame['event']['sensoryVariant'];
```

**Step 3:** Прокинуть в `compileReactionFrame` return.

В `compileReactionFrame`, в блоке `event: { ... }`, добавить:

```ts
            sensoryVariant: input.sensoryVariant,
```

**Step 4:** Запустить typecheck.

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Expected:** clean.

**Step 5:** Commit.

```bash
git add cyberjack-v0.01/src/narrative/reactionFrame.ts
git commit -m "feat: add sensoryVariant field to reaction frame event"
```

### Task 2.2: Резолвить вариант в buildPromptPayload

**Objective:** Выбрать вариант из матрицы по `(actionId, pointId, exposureCount)` и передать в `compileReactionFrame`.

**Files:**
- Modify: `src/prompts/buildPromptPayload.ts`

**Step 1:** Добавить импорт.

```ts
import { resolveSensoryVariant } from '../domain/sensoryMatrix';
```

**Step 2:** Резолвить вариант перед `compileReactionFrame`.

После строки `const exposureBeforeTick = ...` (строка 453) добавить:

```ts
const sensoryVariant = currentActionId && currentPointId
    ? resolveSensoryVariant(currentActionId, currentPointId, exposureBeforeTick)
    : null;
```

**Step 3:** Передать в `compileReactionFrame`.

В вызове `compileReactionFrame` добавить:

```ts
        sensoryVariant: sensoryVariant || undefined,
```

**Step 4:** Запустить typecheck.

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Expected:** clean.

**Step 5:** Commit.

```bash
git add cyberjack-v0.01/src/prompts/buildPromptPayload.ts
git commit -m "feat: resolve sensory variant from matrix by action/point/exposure"
```

### Task 2.3: Развернуть вариант в turn-сообщении

**Objective:** В `buildReactionTurnMessage` заменить компактный сигнал на полный блок из 5 полей (с fallback на `describeObservationSignal`).

**Files:**
- Modify: `src/narrative/reactionFrame.ts` (функция `buildReactionTurnMessage`)

**Step 1:** Найти текущий блок `eventPerspective`.

В `buildReactionTurnMessage` (строки ~770) найти:

```ts
const eventPerspective = frame.event.directlyExperienced
    ? `[Внутренний сигнал текущего момента]\nТы прямо сейчас переживаешь воздействие «${frame.event.action}» в области «${frame.event.target}». ${frame.event.experience} Это ориентир для твоего решения, а не готовый текст реплики.`
    : `[То, что ты видишь сейчас]\n...`;
```

**Step 2:** Заменить на развёртку матрицы.

```ts
const sensoryBlock = frame.event.sensoryVariant
    ? [
        frame.event.sensoryVariant.stimulus,
        frame.event.sensoryVariant.texture,
        frame.event.sensoryVariant.rhythm,
        frame.event.sensoryVariant.bodilyResponse,
        frame.event.sensoryVariant.aftereffect,
    ].filter(Boolean).join('\n')
    : frame.event.experience;

const eventPerspective = frame.event.directlyExperienced
    ? `[Внутренний сигнал текущего момента]\nТы прямо сейчас переживаешь воздействие «${frame.event.action}» в области «${frame.event.target}».\n\n${sensoryBlock}\n\nЭто ориентир для твоего решения, а не готовый текст реплики.`
    : `[То, что ты видишь сейчас]\nТы видишь, что воздействие «${frame.event.action}» направлено на ${frame.event.affectedCharacter}, в область «${frame.event.target}». ${frame.event.experience}\nТы видишь только внешние признаки и не чувствуешь чужое воздействие своим телом.`;
```

**Step 3:** Запустить тесты.

```bash
npx vitest run src/narrative/reactionFrame.test.ts src/prompts/characterPerspective.test.ts 2>&1 | tail -20
```

**Expected:** PASS (обновить тесты, если проверяли точный текст `experience`).

**Step 4:** Commit.

```bash
git add cyberjack-v0.01/src/narrative/reactionFrame.ts
git commit -m "feat: render full sensory block from matrix in turn message"
```

---

## Фаза 3: Верификация

### Task 3.1: Прогнать probe-скрипт

**Objective:** Убедиться, что 20 событий теперь показывают полный сенсорный блок.

**Step 1:** Запустить probe.

```bash
npx tsx scripts/probe-sensory-matrix.ts 2>&1 | grep -vE 'TagLoader|Adapter|HTTP 429|Provider returned|remedy_hint|limit_source|provider_error|is_byok|user_id|raw'
```

**Expected:** В каждом `[Внутренний сигнал текущего момента]` — 5 строк телесного описания (не «ощущение скорее неприятно»), и `область «лицо»` вместо `область «face»`.

**Step 2:** Проверить fallback — пара вне матрицы (например, `act_struggle_cuffs` × `hands` — есть в матрице; проверить `act_interrogate` × `mind_state` — есть; для чистого fallback использовать несуществующую пару).

**Step 3:** Полный прогон тестов.

```bash
npx vitest run 2>&1 | tail -15
```

**Expected:** 615+ passed, только 2 pre-existing падения (`characterSpeechDelivery.test.ts`).

**Step 4:** Typecheck.

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Expected:** clean.

---

## Итоговая карта изменений

| Фаза | Что сделано | Файлы |
|---|---|---|
| 1 | pointLabel → русское название | `buildPromptPayload.ts` |
| 2.1 | `sensoryVariant` в ReactionFrame | `reactionFrame.ts` |
| 2.2 | Резолв варианта по exposureCount | `buildPromptPayload.ts` |
| 2.3 | Развёртка 5 полей в turn-сообщении | `reactionFrame.ts` |
| 3 | Верификация | — |

## Что НЕ входит (следующие фазы)

- **Device-путь** (`describeDeviceSensation`/`sexMachineVector` → `resolveDeviceVariant`) — секс-машина пока использует свой генератор.
- **Удаление `intimateNarrationFor`** — он всё ещё перезаписывает sensory для 6 интимных действий (fallback остаётся).
- **Дедупликация `openThreads`** — всплыла в тесте (один диалог 3 раза), отдельный фикс.
- **Капитализация «Ты»** в начале сигнала — косметика, отдельно.
