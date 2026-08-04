# CyberJack Core Engine Documentation

> Проект: CyberJack — игровой движок симуляции взаимодействий (TypeScript, ~10k LOC, SQLite, REST+WS API, LLM)
> Версия: v0.01

---

## 1. Архитектура

### Структура модулей

```
src/
├── engine/           # Ядро симуляции — математика, тики, конфиг
│   ├── computeResult.ts     # Вычисление результата действия (ядро)
│   ├── runTick.ts           # Полный игровой тик: computeResult + applyLearning
│   ├── applyLearning.ts     # Обновление состояния (изменение метрик после тика)
│   ├── config.ts            # DEFAULT_CONFIG — все формулы и параметры
│   ├── normalize.ts         # Нормализация входных данных (clamp, defaults)
│   ├── validate.ts          # Валидация конфига
│   ├── baselineUtils.ts     # Механика дрейфа baseline + демпфирование
│   └── utils.ts             # clamp()
├── domain/           # Типы и константы
│   ├── types.ts             # Все интерфейсы (SubjectCoreState, TickResult и т.д.)
│   ├── anatomy.ts           # Определение анатомических точек
│   ├── taxonomy.ts          # Таксономия действий
│   └── ...
├── compiler/         # Компиляция действий (preset → CompiledAction)
├── diagnostics/      # Построение диагностики и inference черт
├── prompts/          # Сборка LLM-промптов (PromptPayload)
├── orchestration/    # Оркестрация: runGameTick, contextManager, triggers
├── scenario/         # Сценарный слой: ресурсы, контракты, переходы
├── ui/               # React-интерфейс (Three.js/VRM)
├── api/              # REST API + WebSocket сервер (Express)
├── infrastructure/   # SQLite-репозитории, БД, seed-данные
├── narrative/        # Шаблоны событий
├── services/         # Embedding, memory layer, chat-summary
├── parser/           # Парсер вербальных команд (LLM-классификация)
├── adapters/         # SillyTavern, LLM-адаптеры
└── workers/          # Фоновые задачи (обновление отношений)
```

### Граф вызовов (основной путь)

```
GameEvent → runGameTick() →
  1. loadTickState()            — загрузка core/point/scene/resources из SQLite
  2. compileAction()             — preset + контексты → CompiledAction
  3. runTick() →                 — движок
     a. computeResult()          — математика ощущений
     b. applyLearning()          — обновление метрик + дрейф baseline
  4. saveTickState()             — запись нового состояния
  5. buildDiagnostics()          — semantic interpreter + trait inference
  6. buildPromptPayload()        — сборка промпта для LLM-нарратива
```

### Ключевые потоки данных

- **State** (SubjectCoreState + SubjectPointState) — сохраняется в SQLite, загружается/пишется каждый тик
- **Контексты** — временные модификаторы (позы, одежда, соц. условия), влияют на компиляцию действий
- **Ресурсы** — сценарная механика (очки действия, кредиты), расходуются действиями
- **Анатомия** — статическое дерево точек, каждая с базовой чувствительностью и отношением

---

## 2. Персонажи — 6 ключевых метрик (SubjectCoreState)

### Основные метрики

| Метрика | Тип | Диапазон | Дефолт | Описание |
|---|---|---|---|---|
| **sensitivity** | число | 0–100 | 50 | Чувствительность — реакция на физическое воздействие, усилитель интенсивности ощущений |
| **capacity** | число | 0–100 | 50 | Выносливость/Ресурс — способность выдерживать стресс, сопротивляемость перегрузке |
| **openness** | число | 0–100 | 40 | Открытость — восприимчивость к новому опыту, снятие психологических барьеров |
| **plasticity** | число | 0–100 | 50 | Пластичность — податливость к изменениям, формирование новых привязанностей/черт |
| **attitude** | число | 0–100 | 50 | Отношение/Лояльность — позитивное/негативное отношение к оператору |
| **tension** | число | 0–150 | 0 | Напряжение — накопленный физиологический/психологический накал (может превышать 100 для триггера разрядки) |

### Вспомогательные метрики (baseline)

Каждая из основных метрик (кроме tension) имеет **baseline** — «естественный уровень», к которому метрика стремится вернуться через демпфирование. Baseline сам медленно дрейфует под воздействием опыта (пластичность, открытость, новизна).

- `baselineSensitivity`, `baselineCapacity`, `baselineOpenness`, `baselinePlasticity`, `baselineAttitude`
- `baselineLocalSensitivity`, `baselineLocalAttitude` — для анатомических точек

### Результирующие метрики тика (TickResult)

Вычисляются в `computeResult()`:

| Метрика | Диапазон | Описание |
|---|---|---|
| **effectiveSensitivity** | 0–100 | Композитная чувствительность (core × 0.65 + local × 0.35) |
| **effectiveAttitude** | 0–100 | Композитное отношение (core × 0.4 + local × 0.6 — локальное важнее) |
| **attitudeShift** | -1..1 | Сдвиг валентности от отношения: (effectiveAttitude - 50) / 50 |
| **finalValence** | -1..1 | Итоговая валентность действия (базовая валентность + attitudeShift) |
| **experiencedIntensity** | 0–100 | Субъективно пережитая интенсивность |
| **pleasure** | 0–100 | Удовольствие (положительная валентность × интенсивность × открытость) |
| **discomfort** | 0–100 | Дискомфорт (отрицательная валентность × интенсивность × обратная выносливость) |
| **overload** | 0–100 | Перегрузка (интенсивность × резкость — выносливость) |
| **engagement** | 0–100 | Вовлечённость (композит: интенсивность + удовольствие — дискомфорт — перегрузка + открытость + attitudeShift) |
| **learningEffect** | 0–100 | Обучающий эффект (новизна × интенсивность × пластичность — перегрузка) |

---

## 3. Анатомия (30+ точек)

Анатомия определяется функцией `getBaseHumanAnatomy(gender, mod)`. Точки имеют:

- **sens** — базовая чувствительность (0–100)
- **att** — базовое отношение (0–100)
- **providesFunctions** — функции, которые точка предоставляет (look, hear, speak, kiss, touch, walk и т.д.)
- **parentId** — иерархическая привязка
- **tags** — дополнительные теги (например, `cybernetic` для имплантов)

### Дерево анатомических точек (female)

```
posture (0, 50) — Поза
mind_state (0, 50) — Психика/Разум
head (30, 70) — Голова/Волосы [look, hear]
├── face (60, 40) — Лицо
│   └── lips (85, 20) — Губы [speak, kiss, eat]
neck (80, 30) — Шея
shoulders (30, 80) — Плечи
chest (85, 30) — Грудь [female: 85, male: 60]
├── nipples (95, 10) — Соски
belly (50, 40) — Живот
back (40, 60) — Спина [stabilize_posture]
waist (65, 45) — Талия
arms (20, 90) — Руки [reach]
└── hands (70, 85) — Кисти [touch, manipulate]
inner_thighs (85, 10) — Внутренняя сторона бёдер
legs (25, 75) — Ноги [walk]
├── knees (20, 70) — Колени [kneel, stand, shift_posture]
feet (75, 50) — Ступни [stand]
buttocks (50, 15) — Ягодицы
├── anus (100, 5) — Анус
│   └── prostate (100, 5) — Простата [male]
groin (90, 10) — Пах [male]
├── penis (100, 5) — Член [male]
├── testicles (100, 5) — Яички [male]
vulva (95, 5) — Вульва [female]
├── vagina (100, 5) — Влагалище [female]
├── clitoris (100, 5) — Клитор [female]
```

### Состояние точки (SubjectPointState)

Каждая активная точка хранит:
- **localSensitivity** — локальная чувствительность (изменяется от опыта)
- **localAttitude** — локальное отношение (триггер/сопротивление или принятие)
- **familiarity** — привычность воздействия на зону
- **exposureCount** — счётчик воздействий (выдержка зоны)
- **baselineLocalSensitivity / baselineLocalAttitude** — естественный уровень

### Модификаторы анатомии (AnatomyMod)

- `none` — стандартная анатомия
- `amputee_left_arm` — удаление руки
- `amputee_right_leg` — удаление ноги
- `cyber_implant_arm` — кибернетическая рука (sens=10, att=95, tags: cybernetic)
- `cyber_implant_eyes` — кибернетические глаза

### Виртуальные слоты

Дополнительно вводятся 3 служебных «слота» для контекстов:
- `slot_room` (50, 50) — Окружение (комната)
- `slot_social` (50, 50) — Социальное
- `systemic` (50, 50) — Организм (системное)

---

## 4. Зависимости — как метрики влияют на результат взаимодействия

### 4.1 Формула experiencedIntensity

```
effectiveSensitivity = core.sensitivity × 0.65 + point.localSensitivity × 0.35
experiencedIntensity = action.intensity ×
    (0.3 + (effectiveSensitivity / 100)^1.2) ×
    (0.25 + action.contact × 1.15) ×
    100
```

**Ключевые зависимости:**
- Высокая чувствительность → экспоненциально больше интенсивность (степень 1.2)
- Физический контакт (contact) линейно усиливает интенсивность
- Без контакта (чисто вербальное) — база 0.25

### 4.2 Формула finalValence (приятность/неприятность)

```
effectiveAttitude = core.attitude × 0.4 + point.localAttitude × 0.6
attitudeShift = (effectiveAttitude - 50) / 50
attitudePower = sign(attitudeShift) × |attitudeShift|^1.3
finalValence = action.valence + attitudePower × 0.8
```

**Ключевые зависимости:**
- **Отношение (attitude)** важнее на локальном уровне (0.6 vs 0.4)
- При attitude > 50 действие кажется приятнее; при < 50 — неприятнее
- Степень 1.3 — нелинейность: малые отклонения сглажены, большие — усилены
- Максимальный сдвиг валентности: ±0.8

### 4.3 Формула Pleasure (удовольствие)

```
pleasure = max(0, finalValence) × experiencedIntensity × (0.4 + openness / 200)
```

**Зависимость:** открытость (openness) усиливает удовольствие. При openness=0 → база 0.4; при openness=100 → 0.4 + 0.5 = 0.9

### 4.4 Формула Discomfort (дискомфорт)

```
discomfort = max(0, -finalValence) × experiencedIntensity × (1.2 - capacity / 200)
```

**Зависимость:** capacity (выносливость) **уменьшает** дискомфорт. Capacity=0 → множитель 1.2; capacity=100 → 0.7

### 4.5 Формула Overload (перегрузка)

```
overload = experiencedIntensity × (sharpness + contact × 0.3) - capacity × 0.6
```

**Зависимость:** capacity гасит перегрузку (×0.6). Резкость (sharpness) и контакт усиливают.

### 4.6 Формула Engagement (вовлечённость)

```
engagement = intensity × 0.25 + pleasure × 0.45 - discomfort × 0.28 - overload × 0.6 + openness × 0.22 + attitudeShift × 10
```

**Зависимости:**
- Удовольствие — главный позитивный вклад (×0.45)
- Перегрузка — сильный негативный фактор (×0.6)
- Сдвиг отношения даёт до ±10 ед. вовлечённости
- Открытость даёт до +22 ед.

### 4.7 Формула Learning Effect (обучающий эффект)

```
learningEffect = novelty × experiencedIntensity × (0.3 + plasticity / 100) - overload × 0.5
```

**Зависимости:**
- Пластичность — ключевой фактор обучения
- Перегрузка препятствует обучению
- Новизна действия усиливает эффект

---

## 5. Механика ApplyLearning (изменение метрик после тика)

После вычисления результата, `applyLearning()` обновляет все метрики персонажа:

### 5.1 Sensitivity (чувствительность) — обратная связь

- **Растёт:** когда интенсивность ниже цели (target=5) — десенситизация сменяется регенерацией
- **Падает:** когда интенсивность выше цели — стресс притупляет чувствительность
- **На грани (tension > 85):** чувствительность растёт на +1.5 (прилив возбуждения)

### 5.2 Capacity (выносливость)

- **Падает:** от перегрузки (overload × 0.25). При edging (tension > 85) — дополнительно (tension - 85) × 0.3
- **Восстанавливается:** когда overload < 10 — реген +1.0 за тик
- Чем выше tension, тем быстрее изменения (×1.0 до ×1.5)

### 5.3 Openness (открытость)

- **Растёт:** от чистого удовольствия (pleasure - discomfort) × 0.12 + при edging +0.5
- При высокой tension все изменения ускоряются

### 5.4 Plasticity (пластичность)

- **Растёт:** когда learningEffect выше цели (target=20): (learningEffect - 20) × 0.15
- **Падает:** от перегрузки: overload × 0.1
- **Растёт:** при edging +1.0 (готовность к изменениям на пике)

### 5.5 Attitude (отношение)

- **Растёт:** при netto удовольствии (pleasure - discomfort) × 0.08
- **Падает:** от перегрузки: overload × 0.08
- Влияет на эффективное отношение в следующем тике

### 5.6 Tension (напряжение)

```
tensionGrowth = (pleasure + discomfort + overload × 0.5) × (sensitivity / 50) × 0.3
tensionDrop = (experiencedIntensity < 5) ? max(1, openness / 10) : 0
```

- Растёт от комбинированного ощущения (× чувствительность)
- Падает только в покое (intensity < 5) — отдых должен осознаваться
- Может превышать 100 (до 150) для механики разрядки (Discharge)

### 5.7 Локальные изменения (SubjectPointState)

- **localSensitivity:** обратная связь как у core.sensitivity, но слабее (target=3, regen=0.5)
- **localAttitude:** растёт от удовольствия, падает от резкой перегрузки
- **familiarity:** растёт от learningEffect × 0.01
- **exposureCount:** +1 за каждый тик воздействия
- **Leakage:** локальное отношение влияет на глобальное (×0.1) и наоборот (×0.08) — мягкое взаимопроникновение

### 5.8 Baseline-дрейф (baselineUtils)

Каждая метрика имеет:
1. **Демпфирование:** `current = current + (baseline - current) × strength` — метрика стремится к baseline
2. **Сдвиг baseline:** baseline движется к текущему значению со скоростью, зависящей от:
   - plasticity (пластичность — готовность меняться)
   - openness (открытость — восприимчивость)
   - novelty (новизна опыта)
   - learning effect (для точек — дополнительный фактор)

**Итог:** персонаж имеет «естественный характер» (baseline), но через интенсивный опыт может его изменить. Чем выше пластичность и открытость, тем быстрее меняется baseline.

---

## 6. Примеры сценариев

### Сценарий 1: Мягкое прикосновение (soft_contact)

**Параметры действия:** intensity=0.35, valence=0.45, contact=0.75, sharpness=0.15, novelty=0.25
**Персонаж:** sensitivity=50, capacity=50, openness=40, plasticity=50, attitude=50
**Точка (рука):** localSensitivity=70, localAttitude=85

→ effectiveSensitivity = 50×0.65 + 70×0.35 = 32.5 + 24.5 = **57**
→ effectiveAttitude = 50×0.4 + 85×0.6 = 20 + 51 = **71**
→ attitudeShift = (71-50)/50 = 0.42 → 0.42^1.3 = **0.32**
→ experiencedIntensity = 0.35 × (0.3 + 0.57^1.2) × (0.25 + 0.75×1.15) × 100
  ≈ 0.35 × (0.3 + 0.51) × (0.25 + 0.86) × 100 = 0.35 × 0.81 × 1.11 × 100 ≈ **31**
→ finalValence = 0.45 + 0.32×0.8 = 0.45 + 0.26 = **0.71** (приятно)
→ pleasure = 0.71 × 31 × (0.4 + 40/200) = 0.71 × 31 × 0.6 ≈ **13**
→ discomfort = 0 (valence положительная)
→ overload = 31 × (0.15 + 0.75×0.3) - 50×0.6 = 31 × 0.375 - 30 ≈ **-18** → 0 (нет перегрузки)
→ engagement = 31×0.25 + 13×0.45 - 0 - 0 + 40×0.22 + 0.32×10 ≈ 7.75 + 5.85 + 8.8 + 3.2 ≈ **26**

**Результат:** умеренная интенсивность, чистое удовольствие, сильное вовлечение за счёт открытости и позитивного отношения. Нет перегрузки.

### Сценарий 2: Резкое неприятное (sharp_aversive)

**Параметры:** intensity=0.75, valence=-0.65, contact=0.35, sharpness=0.85, novelty=0.45
**Персонаж (уставший):** sensitivity=70, capacity=20, openness=60, plasticity=50, attitude=30

→ effectiveSensitivity = 70×0.65 + 75×0.35 = **72** (sensitive point)
→ effectiveAttitude = 30×0.4 + 25×0.6 = **33**
→ attitudeShift = ((33-50)/50)^1.3 = (-0.34)^1.3 = **-0.28**
→ experiencedIntensity ≈ 0.75 × (0.3 + 0.72^1.2) × (0.25 + 0.35×1.15) × 100 ≈ **56**
→ finalValence = -0.65 + (-0.28)×0.8 = -0.65 - 0.22 = **-0.87** (сильно неприятно)
→ discomfort = 0.87 × 56 × (1.2 - 20/200) = 0.87 × 56 × 1.1 ≈ **54**
→ overload = 56 × (0.85 + 0.35×0.3) - 20×0.6 = 56 × 0.955 - 12 ≈ **41**
→ engagement = 56×0.25 - 54×0.28 - 41×0.6 + 60×0.22 + (-0.28)×10 ≈ 14 - 15 - 25 + 13 - 3 ≈ **-16**

**Результат:** сильная интенсивность, мощный дискомфорт, перегрузка выше выносливости. Вовлечённость отрицательная — персонаж отстраняется, пытается избежать. Пластичность и attitude понизятся.

### Сценарий 3: Социальное давление (social_pressure)

**Параметры:** intensity=0.45, valence=-0.15, contact=0.85, sharpness=0.4, novelty=0.35
**Персонаж (покорный):** sensitivity=30, capacity=70, openness=30, plasticity=60, attitude=80

→ effectiveAttitude = 80×0.4 + 70×0.6 = 32 + 42 = **74**
→ attitudeShift = (74-50)/50 = 0.48 → 0.48^1.3 ≈ **0.36**
→ finalValence = -0.15 + 0.36×0.8 = -0.15 + 0.29 = **0.14** (слегка приятно)
→ experiencedIntensity ≈ 0.45 × (0.3 + 0.30^1.2) × (0.25 + 0.85×1.15) × 100 ≈ **30**
→ pleasure = 0.14 × 30 × (0.4 + 30/200) ≈ 0.14 × 30 × 0.55 ≈ **2.3**
→ overload ≈ 30 × (0.4 + 0.85×0.3) - 70×0.6 ≈ 30×0.655 - 42 ≈ **-22** → 0
→ engagement = 30×0.25 + 2.3×0.45 - 0 - 0 + 30×0.22 + 0.36×10 ≈ 7.5 + 1.0 + 6.6 + 3.6 ≈ **19**

**Результат:** низкая интенсивность (attenuated sensitivity), высокая capacity поглощает потенциальную перегрузку. Позитивное отношение превращает нейтрально-негативное действие в слабо-приятное. Умеренная вовлечённость.

### Сценарий 4: Edging scenario (на грани)

**Персонаж:** sensitivity=85, capacity=40, openness=70, plasticity=65, attitude=60, tension=88
**Действие:** sustained stimulation (intensity=0.6, valence=0.5, contact=0.6, sharpness=0.3, novelty=0.2)

→ tension > 85 → активируются edging-эффекты:
  - capacity дополнительно падает: (88-85)×0.3 × deltaTime
  - sensitivity растёт +1.5 за тик
  - openness растёт +0.5 за тик
  - plasticity растёт +1.0 за тик

→ высокое engagement (tension как усилитель)
→ риск перегрузки (capacity падает)
→ после разрядки (drop tension) — резкое изменение метрик

### Сценарий 5: Покой / ожидание (wait)

**Параметры:** actionKey=wait, intensity≈0, deltaTime=20.0 (ускоренное время)

→ experiencedIntensity < 5 → tensionDrop = max(1, openness/10) × 20
→ tension падает на 20+ ед.
→ sensitivity восстанавливается (regen)
→ capacity восстанавливается (recoveryRate × deltaTime)
→ никаких изменений в attitude/plasticity от действий

**Результат:** отдых быстро снижает напряжение и восстанавливает ресурсы.

---

## 7. Формулы в числах (config.ts)

```typescript
// Веса композитов
effectiveSensitivity:  global=0.65, local=0.35
effectiveAttitude:    global=0.4,  local=0.6

// Интенсивность
baseOffset:           0.3
sensitivityPow:       1.2
contactBase:          0.25
contactScale:         1.15

// Отношение
shiftMultiplier:      0.8
shiftPow:             1.3

// Удовольствие
opennessBase:         0.4
opennessDivisor:      200

// Дискомфорт
capacityBase:         1.2
capacityDivisor:      200

// Перегрузка
contactFactor:        0.3
capacityFactor:       0.6

// Вовлечённость
intensityFactor:      0.25
pleasureFactor:       0.45
discomfortFactor:     0.28
overloadFactor:       0.6
opennessFactor:       0.22
attitudeFactor:       10

// Обучение
plasticityBase:       0.3
plasticityDivisor:    100
overloadPenalty:      0.5
```

---

## 8. Типы действий (CompiledAction)

| Параметр | Диапазон | Описание |
|---|---|---|
| intensity | 0–5 | Сила воздействия |
| valence | -1..1 | Валентность (приятность/неприятность) |
| contact | 0–1 | Степень физического контакта |
| sharpness | 0–1 | Резкость (внезапность, жёсткость) |
| novelty | 0–1 | Новизна (неожиданность, уникальность) |

Действия могут иметь множители (`intensity_mult`, `valence_mult` и т.д.) и привязку к контекстам (требуют позу, предмет, сценарный объект).

---

## 9. Связанные документы

- `docs/SPEC.md` — полная спецификация проекта
- `docs/CyberJack-UE5-integration-plan.md` — план интеграции с Unreal Engine 5
- `src/engine/config.ts` — актуальные значения всех формул
- `src/domain/types.ts` — все интерфейсы и типы
- `src/domain/anatomy.ts` — анатомические точки
