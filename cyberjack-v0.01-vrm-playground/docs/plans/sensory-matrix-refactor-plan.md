# Рефакторинг конструкторов промптов перед интеграцией сенсорной матрицы

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Убрать мёртвый код и дублирование в конструкторах промптов, чтобы сенсорная матрица (`sensory-matrix.json`, 668 вариантов) могла быть подключена как единственный источник «личного ощущения» персонажа.

**Architecture:** Сейчас промпт персонажа строят только два конструктора (`buildPromptPayload` → `compileReactionFrame` → `buildReactionSystemPrompt` + `buildReactionTurnMessage`). Всё остальное — мёртвый код или метаданные, не попадающие в LLM-вызов. Сенсорика (stimulus/texture/rhythm/bodilyResponse/aftereffect) теряется: до речевого промпта доходит только компактный сигнал `describeObservationSignal`.

**Tech Stack:** TypeScript, better-sqlite3, Vitest.

**Ветка:** `feat/localization` (НЕ `agent/legacy-audit` — скилл устарел). Есть незакоммиченные изменения — перед стартом зафиксировать текущее состояние.

---

## Контекст: что уже установлено (не перепроверять)

### Живые конструкторы (единственные)
- `src/prompts/buildPromptPayload.ts` — собирает `PromptPayload` + `systemPrompt`
- `src/narrative/reactionFrame.ts` — `compileReactionFrame`, `buildReactionSystemPrompt`, `buildReactionTurnMessage`
- `src/prompts/buildPromptPayloadWrapper.ts` — DB-обёртка над `buildPromptPayload`
- `src/orchestration/characterTurnContext.ts` — единая точка входа для всех turn-путей

### Мёртвый код (никогда не вызывается)
- `src/prompts/buildStateSummary.ts` — `buildStateSummary` (только определён)
- `src/prompts/buildMemoryInsights.ts` — `buildMemoryInsights` (только определён)
- `src/prompts/buildRecentEventsSummary.ts` — `buildRecentEventsSummary` (жив только тип `EventRecord`, который импортируют `buildPromptPayload` и `buildMemoryInsights`)
- `src/prompts/semanticTranslator.ts` — `translateStateToPrompt` (только определён)
- `src/prompts/openRouterPromptBuilder.ts` — 3 функции (только `PromptPhysicalState` импортируется `semanticTranslator`)
- `src/infrastructure/actionSensoryProfile.ts` — `AUTHORED_SENSORY_PROFILES` (33 легаси-ключа, не матчатся с текущими action id)

### Дублирование между system и user промптом
Оба `buildReactionSystemPrompt` и `buildReactionTurnMessage` содержат:
- `relationshipBeliefs` (память об отношениях)
- `relevantEpisodes` (недавний опыт)
- `commandOutcome` (исход команды)
- `canonicalFacts` (факты о себе) — частично

### Путь сенсорики (теряется)
```
action.sensory (5 полей) → sensoryExperienceText → subjectiveText
                              ↓
                    currentStateSummary.interpretation  ← МЕТАДАННЫЕ, не в промпте
                              ↓
                    episode record (память)
```
В речевой промпт попадает только `describeObservationSignal` (компактный сигнал).

### Конфликты с матрицей (из прошлого анализа)
1. `intimateNarrationFor` перезаписывает sensory для 6 интимных действий (17 ячеек матрицы)
2. `sensoryExperienceText` дублирует texture/zone (уже есть в матрице)
3. per-point vs per-action селектор
4. device-путь (`describeDeviceSensation`/`sexMachineVector`) не читает матрицу
5. `AUTHORED_SENSORY_PROFILES` — мёртвый параллельный источник

---

## Фаза 0: Фиксация текущего состояния

### Task 0.1: Зафиксировать baseline

**Objective:** Зафиксировать текущее состояние ветки перед рефакторингом.

**Files:**
- Нет изменений кода

**Step 1:** Проверить, что тесты зелёные до начала.

```bash
cd /home/cyberkitty/Projects/cyberjack/cyberjack-v0.01
npx vitest run 2>&1 | tail -30
```

**Expected:** Все тесты проходят (или зафиксировать список уже падающих — они НЕ должны быть связаны с рефакторингом).

**Step 2:** Создать stash-точку для незакоммиченных изменений.

```bash
cd /home/cyberkitty/Projects/cyberjack
git stash push -u -m "pre-sensory-refactor baseline"
```

**Expected:** `git status` чистый.

**Step 3:** Создать ветку рефакторинга.

```bash
git checkout -b refactor/sensory-matrix-integration
```

**Expected:** `git branch --show-current` → `refactor/sensory-matrix-integration`

---

## Фаза 1: Удаление мёртвого кода

### Task 1.1: Удалить buildStateSummary.ts

**Objective:** Удалить мёртвый конструктор соматики (дублирует `physiologicalPosition` + `compileExpressionMode`).

**Files:**
- Delete: `src/prompts/buildStateSummary.ts`

**Step 1:** Подтвердить отсутствие импортов.

```bash
cd /home/cyberkitty/Projects/cyberjack/cyberjack-v0.01
grep -rn "buildStateSummary" src/ --include=*.ts
```

**Expected:** Только определение в самом файле (строка `export function buildStateSummary`).

**Step 2:** Удалить файл.

```bash
rm src/prompts/buildStateSummary.ts
```

**Step 3:** Проверить компиляцию.

```bash
npx tsc --noEmit 2>&1 | grep -i "buildStateSummary" || echo "OK: no references"
```

**Expected:** `OK: no references`

**Step 4:** Commit.

```bash
git add -A && git commit -m "refactor: remove dead buildStateSummary"
```

### Task 1.2: Удалить buildMemoryInsights.ts

**Objective:** Удалить мёртвый конструктор инсайтов.

**Files:**
- Delete: `src/prompts/buildMemoryInsights.ts`

**Step 1:** Подтвердить отсутствие импортов.

```bash
grep -rn "buildMemoryInsights" src/ --include=*.ts
```

**Expected:** Только определение в самом файле.

**Step 2:** Удалить файл.

```bash
rm src/prompts/buildMemoryInsights.ts
```

**Step 3:** Проверить компиляцию.

```bash
npx tsc --noEmit 2>&1 | grep -i "buildMemoryInsights" || echo "OK: no references"
```

**Expected:** `OK: no references`

**Step 4:** Commit.

```bash
git add -A && git commit -m "refactor: remove dead buildMemoryInsights"
```

### Task 1.3: Удалить buildRecentEventsSummary.ts (сохранив тип EventRecord)

**Objective:** Удалить мёртвую функцию, но перенести тип `EventRecord` в `buildPromptPayload.ts` (он живой).

**Files:**
- Modify: `src/prompts/buildPromptPayload.ts` (добавить тип `EventRecord`)
- Delete: `src/prompts/buildRecentEventsSummary.ts`

**Step 1:** Найти все импорты `EventRecord`.

```bash
grep -rn "EventRecord" src/ --include=*.ts
```

**Expected:** `buildPromptPayload.ts` (импорт), `buildMemoryInsights.ts` (уже удалён в Task 1.2).

**Step 2:** Добавить тип `EventRecord` в `buildPromptPayload.ts` (заменить импорт).

В `src/prompts/buildPromptPayload.ts` заменить строку:
```ts
import { EventRecord } from './buildRecentEventsSummary';
```
на:
```ts
export interface EventRecord {
    id: number;
    timestamp: string;
    action_type: string;
    action_payload: string; // JSON
    result_payload: string; // JSON
}
```

**Step 3:** Удалить файл.

```bash
rm src/prompts/buildRecentEventsSummary.ts
```

**Step 4:** Проверить компиляцию.

```bash
npx tsc --noEmit 2>&1 | grep -i "buildRecentEventsSummary\|EventRecord" || echo "OK: no broken references"
```

**Expected:** `OK: no broken references`

**Step 5:** Commit.

```bash
git add -A && git commit -m "refactor: remove dead buildRecentEventsSummary, inline EventRecord type"
```

### Task 1.4: Удалить semanticTranslator.ts и openRouterPromptBuilder.ts

**Objective:** Удалить мёртвый старый конструктор промптов (полностью заменён `reactionFrame`).

**Files:**
- Delete: `src/prompts/semanticTranslator.ts`
- Delete: `src/prompts/openRouterPromptBuilder.ts`

**Step 1:** Подтвердить отсутствие импортов.

```bash
grep -rn "semanticTranslator\|translateStateToPrompt\|openRouterPromptBuilder\|buildCharacterSystemPrompt\|buildEventLog\|buildUserPromptForCurrentTick" src/ --include=*.ts
```

**Expected:** Только определения в самих файлах (и взаимный импорт `PromptPhysicalState`).

**Step 2:** Удалить оба файла.

```bash
rm src/prompts/semanticTranslator.ts src/prompts/openRouterPromptBuilder.ts
```

**Step 3:** Проверить компиляцию.

```bash
npx tsc --noEmit 2>&1 | grep -i "semanticTranslator\|openRouterPromptBuilder\|PromptPhysicalState" || echo "OK: no references"
```

**Expected:** `OK: no references`

**Step 4:** Commit.

```bash
git add -A && git commit -m "refactor: remove dead semanticTranslator and openRouterPromptBuilder"
```

### Task 1.5: Удалить AUTHORED_SENSORY_PROFILES (легаси-сенсорика)

**Objective:** Удалить 33 мёртвых легаси-ключа, которые не матчатся с текущими action id.

**Files:**
- Modify: `src/infrastructure/actionSensoryProfile.ts` (удалить `AUTHORED_SENSORY_PROFILES`)
- Modify: `src/infrastructure/syncActionPresets.ts` (удалить `updateLegacySensory` блок)
- Modify: `src/infrastructure/actionSensoryProfile.test.ts` (обновить тест)

**Step 1:** Найти все использования `AUTHORED_SENSORY_PROFILES`.

```bash
grep -rn "AUTHORED_SENSORY_PROFILES" src/ --include=*.ts
```

**Expected:** `actionSensoryProfile.ts` (определение), `syncActionPresets.ts` (импорт + `updateLegacySensory`), `actionSensoryProfile.test.ts` (импорт).

**Step 2:** Удалить `AUTHORED_SENSORY_PROFILES` из `actionSensoryProfile.ts`.

Удалить весь блок `export const AUTHORED_SENSORY_PROFILES: Record<string, SensoryProfile> = { ... };` (строки с `breath_blow` по `effect_refractory`).

**Step 3:** Удалить `updateLegacySensory` блок из `syncActionPresets.ts`.

Удалить:
```ts
const updateLegacySensory = db.prepare('UPDATE action_presets SET values_json = json_patch(values_json, ?) WHERE id = ?');
for (const [id, sensory] of Object.entries(AUTHORED_SENSORY_PROFILES)) {
    updateLegacySensory.run(JSON.stringify({ description: sensory.stimulus, sensory }), id);
}
```
И убрать `AUTHORED_SENSORY_PROFILES` из импорта (оставить `completeActionSensoryProfile`, `SensoryProfile`).

**Step 4:** Обновить `actionSensoryProfile.test.ts`.

Удалить импорт `AUTHORED_SENSORY_PROFILES` и любые тесты, которые на него ссылаются. Оставить тесты `completeActionSensoryProfile`.

**Step 5:** Запустить тесты.

```bash
npx vitest run src/infrastructure/actionSensoryProfile.test.ts 2>&1 | tail -20
```

**Expected:** PASS (или тест удалён, если ссылался только на легаси-ключи).

**Step 6:** Commit.

```bash
git add -A && git commit -m "refactor: remove dead AUTHORED_SENSORY_PROFILES legacy keys"
```

---

## Фаза 2: Устранение дублирования между system и user промптом

### Task 2.1: Убрать дублирование relationshipBeliefs и relevantEpisodes

**Objective:** Оставить `relationshipBeliefs` и `relevantEpisodes` только в system-промпте (долговременная память), убрать из user-промпта (ситуативный).

**Files:**
- Modify: `src/narrative/reactionFrame.ts` (функция `buildReactionTurnMessage`)

**Step 1:** Найти дубли в `buildReactionTurnMessage`.

В `buildReactionTurnMessage` (строки ~765+) найти и удалить:
```ts
const relationshipBeliefs = frame.continuity.relationshipBeliefs.slice(0, 2);
const relevantEpisodes = frame.continuity.relevantEpisodes.slice(0, 2);
```
и их использование в возвращаемом массиве:
```ts
relationshipBeliefs.length ? `[Память об отношениях]\n${relationshipBeliefs.map(v => `- ${v}`).join('\n')}` : '',
...
relevantEpisodes.length ? `[Недавний опыт]\n${relevantEpisodes.map(v => `- ${v}`).join('\n')}` : '',
```

**Step 2:** Проверить, что `buildReactionSystemPrompt` всё ещё содержит эти блоки (они должны остаться там).

```bash
grep -n "relationshipBeliefs\|relevantEpisodes" src/narrative/reactionFrame.ts
```

**Expected:** `buildReactionSystemPrompt` содержит оба, `buildReactionTurnMessage` — нет.

**Step 3:** Запустить тесты reactionFrame.

```bash
npx vitest run src/narrative/reactionFrame.test.ts 2>&1 | tail -20
```

**Expected:** PASS (возможно, нужно обновить тесты, которые проверяли наличие этих блоков в turn-промпте).

**Step 4:** Commit.

```bash
git add -A && git commit -m "refactor: dedupe relationshipBeliefs and relevantEpisodes (system-only)"
```

### Task 2.2: Убрать дублирование commandOutcome

**Objective:** Оставить `commandOutcome` только в user-промпте (ситуативный исход текущего хода), убрать из system-промпта.

**Files:**
- Modify: `src/narrative/reactionFrame.ts` (функция `buildReactionSystemPrompt`)

**Step 1:** Найти дубль в `buildReactionSystemPrompt`.

В `buildReactionSystemPrompt` (строки ~706+) найти и удалить блок:
```ts
commandOutcome
    ? `[Авторитетный исход команды]\nКоманда «${commandOutcome.actionLabel}» ${commandOutcome.status === 'performed' ? 'уже выполняется в этом ходе' : 'не привела к новому действию'}. ...`
    : '',
```
и переменную `const commandOutcome = frame.event.commandOutcome;` если она больше не нужна.

**Step 2:** Проверить, что `buildReactionTurnMessage` всё ещё содержит `commandOutcome` (должен остаться).

```bash
grep -n "commandOutcome" src/narrative/reactionFrame.ts
```

**Expected:** `buildReactionTurnMessage` содержит, `buildReactionSystemPrompt` — нет.

**Step 3:** Запустить тесты.

```bash
npx vitest run src/narrative/reactionFrame.test.ts 2>&1 | tail -20
```

**Expected:** PASS (обновить тест `Авторитетный исход команды` если он проверял system-промпт).

**Step 4:** Commit.

```bash
git add -A && git commit -m "refactor: dedupe commandOutcome (user-only)"
```

### Task 2.3: Убрать дублирование canonicalFacts

**Objective:** Оставить `canonicalFacts` только в system-промпте (стабильная идентичность), убрать из user-промпта.

**Files:**
- Modify: `src/narrative/reactionFrame.ts` (функция `buildReactionTurnMessage`)

**Step 1:** Найти дубль в `buildReactionTurnMessage`.

Удалить:
```ts
const canonicalFacts = frame.continuity.canonicalFacts.slice(0, 3);
```
и:
```ts
canonicalFacts.length ? `[Факты о себе]\n${canonicalFacts.map(v => `- ${v}`).join('\n')}` : '',
```

**Step 2:** Проверить, что `buildReactionSystemPrompt` содержит `canonicalFacts` (через `owned()` в блоке «Твой характер»).

**Step 3:** Запустить тесты.

```bash
npx vitest run src/narrative/reactionFrame.test.ts src/prompts/characterPerspective.test.ts 2>&1 | tail -20
```

**Expected:** PASS.

**Step 4:** Commit.

```bash
git add -A && git commit -m "refactor: dedupe canonicalFacts (system-only)"
```

---

## Фаза 3: Исправление «личного ощущения»

### Task 3.1: Исправить третье лицо в buildCurrentStateObservationText

**Objective:** Перевести fallback-текст состояния с третьего лица на второе (персонаж говорит о себе «ты», не «актив»).

**Files:**
- Modify: `src/narrative/interactionObservation.ts` (функция `buildCurrentStateObservationText`)

**Step 1:** Найти функцию.

В `buildCurrentStateObservationText` (строки ~294+) заменить `stateDescriptions` с третьего лица на второе:

```ts
const stateDescriptions: Record<InteractionObservation['behavioralState'], string> = {
    responsive: 'Ты сохраняешь осмысленный контакт с окружением.',
    subspace: 'Твои реакции замедлены, внимание погружено в ощущения.',
    overload: 'Ты перегружена ощущениями и реагируешь с задержкой.',
    freeze: 'Ты неподвижна и скована.',
    panic: 'Ты в панике и стремишься прекратить воздействие.',
    defiance: 'Ты собрана и активно отвергаешь воздействие.',
    unresponsive: 'Ты истощена и почти не отвечаешь на внешние стимулы.',
};
```

**Step 2:** Проверить, что `buildCurrentStateObservationText` используется только как fallback (не для UI/нарратора).

```bash
grep -rn "buildCurrentStateObservationText" src/ --include=*.ts
```

**Expected:** `buildPromptPayload.ts` (fallback), `chipGenerator.ts` (UI-чип — проверить, нужен ли там второй/третий род).

**Step 3:** Если `chipGenerator.ts` использует для UI (не для персонажа), оставить там отдельный текст или принять второе лицо.

**Step 4:** Запустить тесты.

```bash
npx vitest run src/narrative/interactionObservation.test.ts 2>&1 | tail -20
```

**Expected:** PASS (обновить тесты, если проверяли «Актив»).

**Step 5:** Commit.

```bash
git add -A && git commit -m "fix: second-person fallback state text (personal sensation)"
```

### Task 3.2: Убрать мета-инструкции из конца user-промпта

**Objective:** Убрать длинный технический абзац-инструкцию из `buildReactionTurnMessage`, который выбивает из роли.

**Files:**
- Modify: `src/narrative/reactionFrame.ts` (функция `buildReactionTurnMessage`)

**Step 1:** Найти финальный абзац.

В `buildReactionTurnMessage` найти и сократить финальный элемент массива:
```ts
`Что ты действительно произносишь сейчас? ${frame.event.requiresSpeech ? 'Пустой ответ здесь не означает твоё молчание: речевая реакция уже выбрана, поэтому дай ей слышимое содержание. ' : ''}Запиши только собственные слышимые слова. Не выдавай цитату собеседника за свои слова и не повторяй дословно собственную недавнюю реплику. Твои движения уже отображаются игрой и в ответе не описываются.`
```

**Step 2:** Заменить на компактную форму (сохранить только критичные ограничения):

```ts
`Что ты произносишь сейчас?${frame.event.requiresSpeech ? ' Речевая реакция уже выбрана — дай ей слышимое содержание.' : ''}`
```

**Step 3:** Проверить, что тесты, проверяющие «не повторяй дословно» и «речевая реакция уже выбрана», обновлены.

```bash
grep -n "не повторяй дословно\|речевая реакция уже выбрана\|Что ты действительно произносишь" src/narrative/reactionFrame.test.ts
```

**Expected:** Найти и обновить эти ассерты.

**Step 4:** Запустить тесты.

```bash
npx vitest run src/narrative/reactionFrame.test.ts 2>&1 | tail -20
```

**Expected:** PASS.

**Step 5:** Commit.

```bash
git add -A && git commit -m "refactor: trim meta-instructions from turn prompt (role immersion)"
```

---

## Фаза 4: Подготовка точки вставки сенсорики (без самой интеграции)

### Task 4.1: Создать селектор сенсорной матрицы

**Objective:** Создать модуль, который по `(actionId, pointId)` возвращает вариант из матрицы. Это подготовка — сам вызов в промпт будет в следующей фазе.

**Files:**
- Create: `src/domain/sensoryMatrix.ts`

**Step 1:** Написать модуль с загрузкой матрицы и выбором варианта.

```ts
import fs from 'fs';
import path from 'path';

export type SensoryField = 'stimulus' | 'texture' | 'rhythm' | 'bodilyResponse' | 'aftereffect';
export type SensoryVariant = Record<SensoryField, string>;

interface MatrixCell {
    actionId: string;
    pointId: string;
    kind: 'point' | 'systemic';
    variants: SensoryVariant[];
}

interface DeviceMode {
    label: string;
    pointId: string;
    tags: string[];
    cells: SensoryVariant[];
}

interface SensoryMatrix {
    cells: MatrixCell[];
    devices: {
        lab_sex_machine: {
            modes: Record<string, DeviceMode>;
        };
    };
}

const matrixPath = path.resolve(process.cwd(), 'src/infrastructure/data/sensory/sensory-matrix.json');

let cached: SensoryMatrix | null = null;

export function loadSensoryMatrix(): SensoryMatrix {
    if (cached) return cached;
    cached = JSON.parse(fs.readFileSync(matrixPath, 'utf8')) as SensoryMatrix;
    return cached;
}

/** Выбор варианта по (action, point). Детерминированный по seed для воспроизводимости. */
export function resolveSensoryVariant(
    actionId: string,
    pointId: string,
    seed: number = 0,
): SensoryVariant | null {
    const matrix = loadSensoryMatrix();
    const cell = matrix.cells.find(c => c.actionId === actionId && c.pointId === pointId);
    if (!cell || !cell.variants.length) return null;
    const index = Math.abs(seed) % cell.variants.length;
    return cell.variants[index];
}

/** Выбор варианта для режима секс-машины. */
export function resolveDeviceVariant(
    deviceId: string,
    modeId: string,
    seed: number = 0,
): SensoryVariant | null {
    const matrix = loadSensoryMatrix();
    const device = (matrix.devices as any)[deviceId];
    const mode = device?.modes?.[modeId];
    if (!mode || !mode.cells.length) return null;
    const index = Math.abs(seed) % mode.cells.length;
    return mode.cells[index];
}
```

**Step 2:** Написать тест.

Create: `src/domain/sensoryMatrix.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { loadSensoryMatrix, resolveSensoryVariant, resolveDeviceVariant } from './sensoryMatrix';

describe('sensoryMatrix', () => {
    it('loads the matrix with all cells filled', () => {
        const matrix = loadSensoryMatrix();
        expect(matrix.cells.length).toBeGreaterThan(0);
        for (const cell of matrix.cells) {
            for (const variant of cell.variants) {
                expect(variant.stimulus).toBeTruthy();
                expect(variant.texture).toBeTruthy();
                expect(variant.rhythm).toBeTruthy();
                expect(variant.bodilyResponse).toBeTruthy();
                expect(variant.aftereffect).toBeTruthy();
            }
        }
    });

    it('resolves a point variant deterministically', () => {
        const a = resolveSensoryVariant('act_slap', 'face', 1);
        const b = resolveSensoryVariant('act_slap', 'face', 1);
        expect(a).toEqual(b);
        expect(a?.stimulus).toBeTruthy();
    });

    it('returns null for unknown action/point', () => {
        expect(resolveSensoryVariant('nonexistent', 'face')).toBeNull();
    });

    it('resolves device variants', () => {
        const v = resolveDeviceVariant('lab_sex_machine', 'circular_saw', 0);
        expect(v?.stimulus).toBeTruthy();
    });
});
```

**Step 3:** Запустить тест.

```bash
npx vitest run src/domain/sensoryMatrix.test.ts 2>&1 | tail -20
```

**Expected:** PASS (4 теста).

**Step 4:** Commit.

```bash
git add -A && git commit -m "feat: add sensory matrix selector (resolveSensoryVariant)"
```

### Task 4.2: Зафиксировать решение по intimateNarration

**Objective:** Решить, что делать с `intimateNarrationFor` (перезаписывает sensory для 6 интимных действий).

**Решение (рекомендуемое):** Оставить `intimateNarrationFor` как fallback для случаев, когда матрица не покрывает `(action, point)`, но приоритет отдать матрице. Это минимальное изменение, не ломающее текущее поведение.

**Files:**
- Modify: `src/orchestration/compileTickAction.ts` (порядок применения)

**Step 1:** Найти текущий порядок.

В `compileTickAction.ts` (строки ~106-113):
```ts
const intimateNarration = intimateNarrationFor(
    payload.presetId,
    payload.pointId,
    payload.customPayload?.sustainedSource,
);
if (intimateNarration) {
    compiledAction = { ...compiledAction, ...intimateNarration };
}
```

**Step 2:** Задокументировать решение (комментарий), НЕ менять код в этой фазе.

Добавить комментарий:
```ts
// NOTE: intimateNarrationFor currently OVERRIDES matrix sensory for intimate
// actions. During matrix integration (next phase), the matrix selector takes
// priority and intimateNarrationFor becomes a fallback for uncovered pairs.
```

**Step 3:** Commit (только комментарий).

```bash
git add -A && git commit -m "docs: note intimateNarration vs matrix priority decision"
```

---

## Фаза 5: Верификация и финальный отчёт

### Task 5.1: Полный прогон тестов

**Objective:** Убедиться, что рефакторинг ничего не сломал.

**Step 1:** Запустить все тесты.

```bash
cd /home/cyberkitty/Projects/cyberjack/cyberjack-v0.01
npx vitest run 2>&1 | tail -40
```

**Expected:** Все тесты проходят (или список падающих идентичен baseline из Task 0.1).

**Step 2:** Проверить компиляцию.

```bash
npx tsc --noEmit 2>&1 | tail -20
```

**Expected:** Нет ошибок (или только pre-existing).

**Step 3:** Проверить, что мёртвые файлы удалены.

```bash
ls src/prompts/buildStateSummary.ts src/prompts/buildMemoryInsights.ts src/prompts/buildRecentEventsSummary.ts src/prompts/semanticTranslator.ts src/prompts/openRouterPromptBuilder.ts 2>&1
```

**Expected:** `No such file or directory` для всех 5.

**Step 4:** Commit финальное состояние (если есть незакоммиченные правки тестов).

```bash
git add -A && git commit -m "test: update tests after prompt constructor refactor"
```

---

## Итоговая карта изменений

| Фаза | Что сделано | Файлы |
|---|---|---|
| 0 | Baseline + ветка | — |
| 1 | Удалено 5 мёртвых файлов + 33 легаси-ключа | 6 файлов |
| 2 | Убрано дублирование 4 блоков | `reactionFrame.ts` |
| 3 | Второе лицо + компактные инструкции | `interactionObservation.ts`, `reactionFrame.ts` |
| 4 | Селектор матрицы + решение по intimateNarration | `sensoryMatrix.ts` (new), `compileTickAction.ts` |
| 5 | Верификация | — |

## Что НЕ входит в этот план (следующая фаза)

- **Интеграция матрицы в `event.experience`** реакционного фрейма (замена `describeObservationSignal` на полный вариант из матрицы).
- **Интеграция device-пути** (`describeDeviceSensation`/`sexMachineVector` → `resolveDeviceVariant`).
- **Удаление `intimateNarrationFor`** в пользу матрицы (после подтверждения покрытия).
- **Удаление `sensoryExperienceText`** дублирующих texture/zone (после интеграции).

Эти задачи — отдельный план «Интеграция сенсорной матрицы», который пишется после завершения этого рефакторинга.
