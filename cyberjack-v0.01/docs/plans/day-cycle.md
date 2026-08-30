# Режим дня: фазы, физиология, случайные события

> **Цель:** Ввести в симуляцию суточный цикл — фазы дня, физиологические потребности (сон/еда/туалет/усталость), пассивный расход/восстановление параметров и случайные события (бессонница, компульсии на себя и других). Персонаж живёт по времени, а не «активен всегда».

---

## 1. Фазы дня — `src/domain/dayCycle.ts` (новый модуль)

### 1.1. Фазы
```ts
export type DayPhase = 'night' | 'morning' | 'day' | 'evening';
export function getDayPhase(worldMinute: number): DayPhase {
    const m = ((worldMinute % 1440) + 1440) % 1440;
    if (m < 6 * 60) return 'night';      // 0:00–5:59
    if (m < 12 * 60) return 'morning';   // 6:00–11:59
    if (m < 18 * 60) return 'day';       // 12:00–17:59
    return 'evening';                    // 18:00–23:59
}
```

### 1.2. Состояние персонажа
```ts
export type CharacterDayState = 'sleeping' | 'awake' | 'active';
export function getCharacterDayState(characterId, worldMinute, physiology): CharacterDayState
```
- **night** → `sleeping` по умолчанию, но:
  - трейт/параметр «бессонница» → `awake`
  - `sleep_debt` низкий + `capacity` высокий → шанс бодрствования
- **morning/day/evening** → `awake`/`active` (по capacity/усталости)

### 1.3. Контекст для промпта
```ts
export function getDayContext(characterId, worldMinute, physiology): string
```
Возвращает строку для `activeContextNames` (см. §5).

---

## 2. Физиология — таблица `subject_physiology`

### 2.1. Схема
```sql
CREATE TABLE subject_physiology (
    subject_id TEXT PRIMARY KEY,
    hunger REAL DEFAULT 0,        -- 0..100, растёт со временем
    bladder REAL DEFAULT 0,       -- 0..100, растёт со временем
    sleep_debt REAL DEFAULT 0,    -- 0..100, растёт при бодрствовании
    last_meal_minute INTEGER,
    last_toilet_minute INTEGER,
    last_sleep_minute INTEGER,
    FOREIGN KEY(subject_id) REFERENCES subjects(id)
);
```

### 2.2. Репозиторий `physiologyRepo` (в `repositories.ts`)
- `get(subjectId)`, `save(subjectId, state)`, `ensure(subjectId)` (создаёт при старте).

### 2.3. Рост потребностей (в `applyPassiveLaboratoryEffects`)
- `hunger += rate * hours` (например 2/час)
- `bladder += rate * hours` (например 3/час)
- `sleep_debt += rate * hours` при бодрствовании; `-= rate * hours` во сне

---

## 3. События — `autonomousScene.ts`

### 3.1. Спящий не инициирует, но будится
В `runAutonomousSceneMinute` фильтр `present`:
```ts
.filter(entry => entry.presenceState === 'present' && entry.canAct && entry.character.subjectId)
```
Добавить: если `getCharacterDayState(...) === 'sleeping'` → **не кандидат** (не инициирует соц. ходы, не действует). Но:
- **Разбудить** — другой персонаж/событие может разбудить спящего (внешний стимул → персонаж просыпается и действует).

### 3.2. Self-действия (мастурбация и т.п.)
Сейчас `chooseAction` исключает `targetId === actorId`. Ввести **self-target путь**:
- Новый пресет `act_self_stimulate` (мастурбация) в `actions.json`.
- В `chooseAction` добавить отдельный проход: если трейт (вагинальная стимуляция, `trait_*`) + потребность → self-действие.
- `scoreAvailableActions` требует `relation` — для self нужен **отдельный скоринг** (без relation, по трейтам/потребностям).

### 3.3. Случайные события (вес от трейтов/параметров)
- **Бессонница** — трейт/параметр → ночью `awake`, инициирует.
- **Компульсия на других** — уже есть `deriveCompulsionSignals` (уровень 3 → `score + pressure*18`).
- **Компульсия на себя** — через self-target путь.
- **Описаться в фиксации** — если `bladder` высокий + персонаж зафиксирован (`active_contexts` с restraint-действиями) → событие «описалась».

---

## 4. Параметры — `applyPassiveLaboratoryEffects` (`worldService.ts`)

### 4.1. Пассивный расход днём
- `capacity` медленно падает при бодрствовании (например `-0.5/час`).
- `tension` растёт при голоде/усталости.

### 4.2. Ускоренное восстановление во сне
- Во сне `capacity` быстро растёт (например `+8/час` вместо `+3/час`).
- `sleep_debt` падает.

---

## 5. Промпт — `buildPromptPayloadWrapper.ts`

Рядом с `formatWorldTimeContext` (строка ~7822, `activeContextNames.unshift(...)`):
- **НЕ подаём «ты спишь»** — промпт строится только когда персонаж действует, значит он уже не спит.
- Если персонаж **был разбужен** внешним событием из сна → модификация «тебя разбудили».
- Иначе — контекст физиологии:
  - «Ты голодна» / «Ты сыта»
  - «Тебе нужно в туалет» / «Ты сходила»
  - «Ты устала» / «Ты отдохнула»

---

## 6. Знание персонажа о потребности

- Персонаж **знает**, что голоден/хочет в туалет → в промпт (см. §5).
- **Модификация состояния** → события: персонаж идёт есть/в туалет (меняет доступность, уходит из комнаты).

---

## 7. Порядок реализации

1. `dayCycle.ts` — фазы + состояние + контекст.
2. `subject_physiology` — таблица + `physiologyRepo`.
3. `applyPassiveLaboratoryEffects` — рост потребностей + расход/восстановление по фазе.
4. `autonomousScene.ts` — спящий не инициирует/будится; self-действия; случайные события.
5. `actions.json` — self-пресет `act_self_stimulate`.
6. `buildPromptPayloadWrapper.ts` — контекст физиологии + «разбудили».
7. Тесты: `dayCycle.test.ts`, `physiology.test.ts`, `autonomousScene` self/сон.

---

## 8. Открытые вопросы (нужно решение)

1. **Self-действия** — как скорить без `relation`? (отдельный путь в `chooseAction`).
2. **Фиксация** — как точно определить «зафиксирован» (по `active_contexts` restraint-действиям)?
3. **Частота случайных событий** — каждую фазу или реже?
4. **Еда/туалет** — только контекст или и события (уход из комнаты)?
