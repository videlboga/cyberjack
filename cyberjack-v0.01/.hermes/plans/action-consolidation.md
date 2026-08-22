# Консолидация системы действий Cyberjack

## Проблема

Действия (action presets) живут в **четырёх** источниках, которые расходятся:

1. `src/infrastructure/seed.ts` — inline `actions[]` (58 классических: contact/intimate/pose/effect/context). Схема: `{id, label, type, tags, validTargets, values, contextConfig, requireContexts, removeContexts, requiresItem}`.
2. `src/infrastructure/actionSpecialization.ts` — `targets` map (9 действий), **перезаписывает** `validTargets` при каждом старте сервера.
3. `src/infrastructure/data/presets/actions.json` — 79 «новых» пресетов. Схема: `{id, name, description, categories[], tags[], validTargets[], vector{}, contextConfig?, requireContexts?, removeContexts?, requiresItem?, sensory?}`.
4. `src/orchestration/resolveTickConsequences.ts` — `effect_refractory` создаётся на лету при оргазме.

Плюс **осиротевшие** пресеты `sustained_sexual_pulse` / `sustained_vibration_pulse` / `sustained_electro_pulse` — существуют только в живой БД, нигде в коде не создаются (INSERT удалён исторически, остались только label в locales и ссылки в `backgroundTimeTick.ts`/`sustainedEffects.ts`).

## Цель

Единый источник истины — `actions.json`. Все пресеты (включая классические и `sustained_*`) живут там. `syncActionPresets()` — единственная точка записи пресетов в БД при старте. `validTargets` — только в `actions.json`; UI читает его из API, без хардкод-оверрайдов.

## Шаги

### 1. Перенести 58 классических действий из `seed.ts` в `actions.json`
- Конвертировать схему: `label`→`name`, `type`→`categories[0]`, `values`→`vector`, `validTargets` остаётся на верхнем уровне.
- `values` в seed.ts уже в диапазоне 0..1 (нормализованные), НЕ legacy 0..10. В actions.json новые пресеты используют 0..10 + `powerBase`. Нужно проверить `normalizeAuthoredActionVector` (actionVectorScale.ts): он определяет legacy-шкалу по `powerBase` или значению >1. Классические действия (0..1, без powerBase) останутся как есть — корректно.
- `effect_*`/`context_*`/`device_sensory_*`/`pose_kneeling` — тоже перенести (это пресеты-контексты).
- `finger_insertion`, `act_start_oral_giving`, `act_deepen_oral` — уже есть в actions.json (дублируются в seed.ts). Удалить из seed.ts, оставить JSON-версию (проверить эквивалентность).

### 2. Добавить `sustained_*` пресеты в `actions.json`
- `sustained_sexual_pulse` (validTargets vagina/anus), `sustained_vibration_pulse`, `sustained_electro_pulse` (validTargets из живой БД).
- Взять точные значения из живой БД (sqlite3).

### 3. Удалить `actionSpecialization.ts` `targets` map
- `ensureActionSpecialization()` больше не перезаписывает `validTargets`.
- Оставить только то, что не про validTargets: `verbal_pressure` label, `finger_insertion` legacy fallback, `effect_panic` duration, orphaned-context cleanup, `hair` point preset. Либо перенести эти миграции в `syncActionPresets.ts`.

### 4. Удалить `calibrationTargetOverrides` из UI
- `CalibrationPrototype.tsx` (~1662) — хардкод `feet` для 11 действий. Удалить; UI читает `validTargets` из `actionMeta` (API).
- Проверить `zonesForAction` в обоих файлах — fallback `allowed.size ? filter : playable` оставить (корректен для unrestricted действий).

### 5. Консолидировать `LEGACY_ACTION_TAGS` / `actionSemanticFallback`
- `conditioning.ts` `LEGACY_ACTION_TAGS` и `CalibrationPrototype.tsx` `actionSemanticFallback` — два дублирующих маппинга action→теги.
- Теги уже есть в `actions.json` для новых пресетов. Для классических — добавить `tags` в actions.json при переносе (шаг 1), затем удалить оба хардкод-маппинга.

### 6. `actionPointMatrix.ts` — мёртвый код
- Используется только в `actionPointMatrix.test.ts`. UI использует `action-point-button-matrix.generated.json` и `actionPointAssets`.
- Решение: удалить `actionPointMatrix.ts` + тест, либо оставить как есть (не критично). Спросить/решить по ходу.

### 7. Тесты
- `npx tsc --noEmit -p tsconfig.runtime.json`
- Полный vitest-прогон. Тесты, импортирующие `../infrastructure/seed`, должны продолжать работать (seed.ts всё ещё сидит сцены/персонажей, просто без inline actions).

### 8. Живая БД + коммит
- Применить `syncActionPresets()` к живой БД, верифицировать `validTargets` и наличие `sustained_*`.
- Коммит из parent-репо (`/home/cyberkitty/Projects/cyberjack/`).

## Риски

- **Схема векторов**: классические действия в seed.ts используют 0..1, новые в actions.json — 0..10+powerBase. `normalizeAuthoredActionVector` различает их по `powerBase`/значению>1. При переносе классических НЕ добавлять `powerBase` и оставить 0..1 — иначе сломается нормализация.
- **`finger_insertion`/`act_start_oral_giving`/`act_deepen_oral`** дублируются в seed.ts и actions.json с разными векторами. Нужно сверить и оставить одну версию (JSON).
- **`effect_refractory`** создаётся на лету в `resolveTickConsequences.ts` — оставить как есть (это runtime-пресет, не контент).
- **Тесты на seed**: многие тесты импортируют `../infrastructure/seed` и полагаются на inline actions. После удаления inline-массива нужно убедиться, что `syncActionPresets()` вызывается в тестовом setup, либо seed.ts продолжает сидить пресеты из actions.json.

## Порядок выполнения

1. Сначала `actions.json` (шаги 1-2) — добавить все пресеты.
2. Затем `syncActionPresets.ts` — убедиться, что он сидит ВСЁ из actions.json (уже делает).
3. `seed.ts` — удалить inline `actions[]`, оставить `availableActions` (id-список) + `prototypeExpansionActions`.
4. `actionSpecialization.ts` — удалить targets map.
5. UI — удалить overrides.
6. conditioning/fallback — консолидировать теги.
7. Тесты + БД + коммит.
