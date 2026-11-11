# Ядро CyberJack — Архитектура и Документация

**Дата:** 2026-06-02  
**Проект:** CyberJack — игровой движок симуляции взаимодействий  
**Код:** `~/Projects/cyberjack/cyberjack-v0.01/src/`  
**Ветка:** `restore-ui` | `github.com/videlboga/cyberjack`

---

## 1. Архитектура

### 1.1 Обзор

CyberJack — TypeScript-движок (~10 000 LOC), построенный по модульной многослойной архитектуре. Ядро содержит **движок вычислений** (engine), **слой компиляции действий** (compiler), **доменную модель** (domain), **оркестрацию** (orchestration), **промпт-инжиниринг** (prompts), **слой сценариев** (scenario), **адаптеры LLM** (adapters) и **инфраструктурный слой** (infrastructure).

### 1.2 Структура директорий

```
src/
├── adapters/          # Адаптеры к LLM (OpenRouter, SillyTavern)
│   ├── llmAdapter.ts
│   └── sillyTavernAdapter.ts
├── api/               # REST + WebSocket сервер (Express)
│   ├── controllers/   # playerController, sceneController, tickController и др.
│   ├── routes/        # metaRoutes, playerRoutes, sceneRoutes, stateRoutes, tickRoutes
│   ├── server.ts      # Точка входа HTTP-сервера
│   └── socket.ts      # WebSocket для real-time
├── compiler/          # Компиляция действия в вектор ActionVector
│   ├── compileAction.ts         # Оркестратор компиляции
│   ├── compileContextVector.ts  # Сбор контекстных модификаторов
│   ├── mergeVectors.ts          # Слияние базового вектора + контекстов
│   └── noveltyService.ts       # Вычисление новизны действия
├── diagnostics/       # Построение диагностических отчётов по тику
│   ├── buildDiagnostics.ts
│   ├── semanticActionInterpreter.ts
│   └── traitInference.ts
├── domain/            # DDD — типы, схемы, анатомия, таксономия
│   ├── anatomy.ts         # 30+ анатомических точек
│   ├── canon.ts           # Канонические локации и профессии
│   ├── characterProfile.ts # Профиль персонажа
│   ├── resolver.ts        # Разрешение функций (команд, контекстов)
│   ├── schemas.ts         # Zod-схемы валидации
│   ├── taxonomy.ts        # Теги действий и анатомии
│   └── types.ts           # Все TypeScript-типы (ядро типизации)
├── engine/            # Ядро физики взаимодействий
│   ├── applyLearning.ts     # Применение обучения (изменение характеристик)
│   ├── baselineUtils.ts     # Демпфирование к базовой линии + адаптация baseline
│   ├── computeResult.ts     # Вычисление результата тика (главная формула)
│   ├── config.ts            # DEFAULT_CONFIG (все коэффициенты формул)
│   ├── normalize.ts         # Нормализация входов (core, point, action)
│   ├── runTick.ts           # Точка входа движка: compute + applyLearning
│   ├── utils.ts             # clamp, ensureFiniteNumber
│   └── validate.ts          # Валидация конфига
├── infrastructure/    # База данных, репозитории, сидинг
│   ├── contractRepo.ts
│   ├── db.ts               # SQLite (better-sqlite3)
│   ├── eventQueries.ts     # Запросы к логам событий
│   ├── repositories.ts     # Все репозитории (subject, point, scene, preset, и т.д.)
│   └── seed.ts             # Инициализация БД из JSON-пресетов
├── narrative/         # Шаблоны событий
│   └── eventTemplates.ts
├── orchestration/     # Оркестрация тиков, NPC, состояний
│   ├── actionScorer.ts
│   ├── canonGenerator.ts
│   ├── characterGenerator/ # Генерация персонажей через LLM
│   ├── conditionWatcher.ts  # Слежение за порогами состояний (Trauma, Panic, Subspace)
│   ├── contextManager.ts    # Управление активными контекстами
│   ├── eventRouter.ts
│   ├── loadTickState.ts
│   ├── runGameTick.ts       # Главный оркестратор тика (вызывает engine)
│   ├── saveTickState.ts
│   ├── sceneOrchestrator.ts # Оркестрация NPC (проактивные/реактивные действия)
│   └── triggers.ts
├── parser/            # NLP-парсер текстовых команд
│   ├── verbalParser.ts
│   └── verbalSchemas.ts
├── prompts/           # Построение LLM-промптов
│   ├── buildMemoryInsights.ts
│   ├── buildPromptPayload.ts
│   ├── buildPromptPayloadWrapper.ts
│   ├── buildRecentEventsSummary.ts
│   ├── buildStateSummary.ts
│   ├── config.ts
│   ├── openRouterPromptBuilder.ts
│   ├── semanticTranslator.ts
│   └── sillyTavernContext.ts
├── scenario/          # Слой сценариев (переходы, ресурсы, контракты)
│   ├── applyResourceCosts.ts
│   ├── buyAssetHandler.ts
│   ├── checkActionAccess.ts
│   ├── evaluateAssetContract.ts
│   ├── resolveSceneTransition.ts
│   └── runScenarioStep.ts
├── services/          # Сервисы (память, эмбеддинги, суммаризация)
│   ├── chatSummary.ts
│   ├── embeddingService.ts
│   └── memoryLayer.ts
├── types/
│   └── react-three-fiber-jsx.d.ts
├── ui/                # Типы для UI-оверлея
│   ├── App.d.ts
│   └── clothingModelMap.ts
├── utils/             # Утилиты (логирование)
│   ├── fileLogs.ts
│   └── logExplainers.ts
└── workers/           # Фоновые задачи
    └── backgroundRelationUpdate.ts
```

### 1.3 Поток данных (Tick Lifecycle)

```
1. Клиент → API (POST /api/tick)
2. runGameTick() [orchestration/runGameTick.ts]
   ├── loadTickState() — загрузка core + point + relations + scene
   ├── checkActionAccess() — проверка доступности действия
   ├── applyResourceCosts() — списание ресурсов
   ├── compileAction() [compiler/]:
   │   ├── presetRepo → baseVector
   │   ├── compileContextVector() → contextModifiers
   │   ├── computeNovelty() → noveltyFactor
   │   └── mergeVectors() → compiledAction
   ├── runTick() [engine/]:
   │   ├── computeResult() — главная формула
   │   └── applyLearning() — изменение core/point
   ├── ContextManager — применение контекстов, процессинг tick
   ├── Триггеры напряжения: Discharge / Ruined при tension ≥100 / capacity≤0
   ├── ConditionWatcher — оценка состояний (Trauma, Panic, Subspace)
   ├── saveTickState() — сохранение в БД
   ├── buildDiagnostics() — читаемый отчёт
   ├── buildPromptPayload() — промпт для LLM
   └── executeTurnConversations() — генерация речи NPC через LLM
```

---

## 2. Персонажи и метрики

У персонажа есть **6 метрик ядра** (SubjectCoreState) и **2+2 метрики точки** (SubjectPointState).

### 2.1 Глобальные метрики (core)

| Метрика | Тип | Default | Range | Описание |
|---------|-----|---------|-------|----------|
| **sensitivity** | number | 50 | 0-100 | Чувствительность к физическому воздействию. Чем выше — тем сильнее ощущается каждое действие |
| **capacity** | number | 50 | 0-100 | Выносливость / ресурс. Способность выдерживать стресс, сопротивляемость перегрузке |
| **openness** | number | 40 | 0-100 | Открытость к новому опыту. Снятие психологических барьеров. Влияет на удовольствие и готовность к контакту |
| **plasticity** | number | 50 | 0-100 | Пластичность. Податливость разума к изменениям, формированию новых привязанностей/трейтов |
| **attitude** | number | 50 | 0-100 | Отношение / лояльность к оператору. 0 = ненависть, 50 = нейтрально, 100 = глубокая привязанность |
| **tension** | number | 0 | 0-150 | Напряжение. Накопленный физиологический/психологический накал. При ≥100 — каскадный срыв (Discharge) |

Каждая метрика имеет **baseline** — базовую линию, к которой значение постепенно возвращается (демпфирование).

### 2.2 Локальные метрики точки (point)

| Метрика | Тип | Default | Range | Описание |
|---------|-----|---------|-------|----------|
| **localSensitivity** | number | 50 | 0-100 | Локальная чувствительность зоны тела |
| **localAttitude** | number | 50 | 0-100 | Локальное отношение зоны (принятие/отторжение) |
| **familiarity** | number | 0 | 0-100 | Привычность воздействия на зону |
| **exposureCount** | number | 0 | - | Счётчик воздействий на зону |

### 2.3 Параметры действия (CompiledAction)

| Метрика | Тип | Range | Описание |
|---------|-----|-------|----------|
| **intensity** | number | 0-5 | Сила воздействия |
| **valence** | number | -1..1 | Валентность (позитивность). -1 = неприятно, +1 = приятно |
| **contact** | number | 0-1 | Уровень физического контакта. 0 = бесконтактное, 1 = полный контакт |
| **sharpness** | number | 0-1 | Резкость. Влияет на overload |
| **novelty** | number | 0-1 | Новизна. Влияет на learningEffect |

---

## 3. Анатомические точки

Функция `getBaseHumanAnatomy(gender, mod)` возвращает массив точек. Всего **30+ точек** (зависит от пола и модификаций).

### 3.1 Общие точки (все пола)

| ID | Label | sens (0-100) | att (0-100) | Родитель | Функции |
|----|-------|:---:|:---:|:--------:|:--------:|
| `posture` | Поза (положение тела) | 0 | 50 | — | — |
| `mind_state` | Психика/Разум | 0 | 50 | — | — |
| `head` | Голова/Волосы | 30 | 70 | — | look, hear |
| `face` | Лицо | 60 | 40 | head | — |
| `lips` | Губы | 85 | 20 | face | speak, kiss, eat |
| `neck` | Шея | 80 | 30 | — | — |
| `shoulders` | Плечи | 30 | 80 | — | — |
| `chest` | Грудь | 60/85* | 30 | — | — |
| `nipples` | Соски | 95 | 10 | chest | — |
| `belly` | Живот | 50 | 40 | — | — |
| `back` | Спина | 40 | 60 | — | stabilize_posture |
| `waist` | Талия | 65 | 45 | — | — |
| `arms` | Руки | 20 | 90 | — | reach |
| `hands` | Кисти | 70 | 85 | arms | touch, manipulate |
| `inner_thighs` | Внутр. сторона бёдер | 85 | 10 | — | — |
| `legs` | Ноги | 25 | 75 | — | walk |
| `knees` | Колени | 20 | 70 | — | kneel, stand, shift_posture |
| `feet` | Ступни | 75 | 50 | — | stand |
| `buttocks` | Ягодицы | 50 | 15 | — | — |
| `anus` | Анус | 100 | 5 | buttocks | — |

\* chest.sens = 85 для female, 60 для male

### 3.2 Male / Androgynous

| ID | Label | sens | att | Родитель |
|----|-------|:---:|:---:|:--------:|
| `groin` | Пах | 90 | 10 | — |
| `penis` | Член | 100 | 5 | groin |
| `testicles` | Яички | 100 | 5 | groin |
| `prostate` | Простата | 100 | 5 | anus |

### 3.3 Female / Androgynous

| ID | Label | sens | att | Родитель |
|----|-------|:---:|:---:|:--------:|
| `vulva` | Вульва | 95 | 5 | — |
| `vagina` | Влагалище | 100 | 5 | vulva |
| `clitoris` | Клитор | 100 | 5 | vulva |

### 3.4 Модификации анатомии

Поддерживаются моды: `none`, `amputee_left_arm`, `amputee_right_leg`, `cyber_implant_arm`, `cyber_implant_eyes`. Моды фильтруют точки или меняют их параметры (например, кибернетическая рука: sens=10, att=95).

### 3.5 Системные слоты

| ID | Label | sens | att |
|----|-------|:---:|:---:|
| `slot_room` | Окружение (Комната) | 50 | 50 |
| `slot_social` | Социальное | 50 | 50 |
| `systemic` | Организм (Системное) | 50 | 50 |

### 3.6 Анатомические регионы (для таксономии)

```
head:    ['face', 'lips', 'neck']
torso:   ['chest', 'back', 'belly']
limbs:   ['left_arm', 'right_arm', 'legs', 'feet']
intimate: ['groin', 'inner_thighs']
```

---

## 4. Зависимости — как метрики влияют на результат взаимодействия

### 4.1 Главная формула (computeResult.ts)

Вход:
- **action**: intensity, valence, contact, sharpness, novelty
- **core**: sensitivity, capacity, openness, plasticity, attitude
- **point**: localSensitivity, localAttitude
- **config**: EngineConfig (DEFAULT_CONFIG)

#### Шаг 1: Эффективная чувствительность
```
effectiveSensitivity = clamp(
    core.sensitivity * 0.65 + point.localSensitivity * 0.35,
    0, 100
)
```

#### Шаг 2: Эффективное отношение
```
effectiveAttitude = clamp(
    core.attitude * 0.4 + point.localAttitude * 0.6,
    0, 100
)
attitudeShift = (effectiveAttitude - 50) / 50
attitudePower = sign(attitudeShift) * |attitudeShift|^1.3
```

#### Шаг 3: Испытанная интенсивность
```
experiencedIntensity = action.intensity ×
    (0.3 + (effectiveSensitivity/100)^1.2) ×
    (0.25 + action.contact × 1.15) ×
    100
```
Чем выше sensitivity — тем сильнее ощущается каждое действие.

#### Шаг 4: Финальная валентность
```
finalValence = clamp(action.valence + attitudePower × 0.8, -1, 1)
```
Высокий attitude делает негативные действия менее неприятными (сдвиг к позитиву).

#### Шаг 5: Удовольствие и дискомфорт
```
pleasure = max(0, finalValence) × experiencedIntensity × (0.4 + core.openness/200)
discomfort = max(0, -finalValence) × experiencedIntensity × (1.2 - core.capacity/200)
```
- **openness** усиливает удовольствие (открытость = восприимчивость)
- **capacity** снижает дискомфорт (выносливость)

#### Шаг 6: Перегрузка (overload)
```
overload = clamp(
    experiencedIntensity × (action.sharpness + action.contact × 0.3) - core.capacity × 0.6,
    0, 100
)
```
- Высокая **capacity** защищает от перегрузки
- **sharpness** и **contact** увеличивают риск overload

#### Шаг 7: Вовлечённость (engagement)
```
engagement = experiencedIntensity × 0.25 +
    pleasure × 0.45 -
    discomfort × 0.28 -
    overload × 0.6 +
    core.openness × 0.22 +
    attitudeShift × 10
```
- Позитивные компоненты: pleasure, openness, позитивный attitude
- Негативные: discomfort, overload

#### Шаг 8: Эффект обучения (learningEffect)
```
learningEffect = action.novelty × experiencedIntensity × (0.3 + core.plasticity/100) - overload × 0.5
```
- **plasticity** усиливает обучение
- **overload** его подавляет

### 4.2 Apply Learning (applyLearning.ts)

После вычисления результата, характеристики персонажа меняются:

| Характеристика | Факторы изменения |
|---------------|-------------------|
| **tension** | +pleasure + discomfort + overload×0.5; -openness/10 при отдыхе |
| **sensitivity** | → стремится к target=5; регенерирует при low intensity |
| **capacity** | -overload×0.25; восстанавливается при overload<10 |
| **openness** | +(pleasure - discomfort)×0.12 |
| **plasticity** | +(learningEffect - 20)×0.15 - overload×0.1 |
| **attitude** | +(pleasure - discomfort)×0.08 - overload×0.08 |

#### Baseline-система (baselineUtils.ts)

Каждая метрика имеет **baseline**, к которому она плавно возвращается (демпфирование). При длительном воздействии baseline сам постепенно сдвигается в сторону текущего значения (адаптация). Скорость адаптации зависит от plasticity, openness и novelty.

#### Каскадный срыв (Discharge)

Когда **tension ≥ 100**:
- **Позитивный**: оргазм — openness +20, attitude +25, sensitivity -20 (рефрактерность), capacity -40
- **Негативный**: панический шок — attitude -20, openness -15, capacity = 0 (полное истощение)
- **Общее**: plasticity +30, tension = 10

Если **capacity ≤ 0** при tension > 85, но discharge не произошёл — "испорченный" срыв: attitude -10, tension = 20.

### 4.3 Контекстные модификаторы (compileContextVector.ts + mergeVectors.ts)

Активные контексты (позы, одежда, оборудование, окружение) модифицируют действие через:
- Аддитивные сдвиги: `intensity`, `valence`, `contact`, `sharpness`, `novelty`
- Мультипликаторы: `intensity_mult`, `valence_mult`, `contact_mult`, `sharpness_mult`, `novelty_mult`
- TraitRules: триггеры по тегам действия/анатомии — переопределение valance, intensity и т.д.

### 4.4 Состояния (ConditionWatcher)

Движок отслеживает пороговые состояния:
- **Trauma** / Panic — при high overload + low attitude
- **Subspace** — при high pleasure + low tension + high openness
- **Apathy** — при хроническом low engagement
- **Freeze** — тоническое оцепенение при extreme overload
- **Hyperesthesia** — повышенная чувствительность после повторной стимуляции

---

## 5. Примеры сценариев

### Сценарий 1: Ласковое прикосновение (caress → lips)

**Персонаж:** neut — sensitivity=50, capacity=50, openness=40, plasticity=50, attitude=50  
**Точка:** lips — localSensitivity=85, localAttitude=20  
**Действие:** act_caress — intensity=2, valence=5 (норм.=0.2/0.5), contact=3 (0.3), sharpness=-2 (0)

Расчёт:
1. effectiveSensitivity = 50×0.65 + 85×0.35 = 32.5 + 29.75 = 62.25
2. effectiveAttitude = 50×0.4 + 20×0.6 = 20 + 12 = 32
3. attitudeShift = (32 - 50)/50 = -0.36, attitudePower = -0.36^1.3 ≈ -0.29
4. finalValence = 0.5 + (-0.29)×0.8 = 0.5 - 0.23 = 0.27 (слабо позитивно)
5. experiencedIntensity = 0.2×(0.3+(62.25/100)^1.2)×(0.25+0.3×1.15)×100 ≈ 0.2×0.655×0.595×100 ≈ 7.8
6. pleasure = 0.27 × 7.8 × (0.4 + 40/200) = 0.27 × 7.8 × 0.6 ≈ 1.26
7. discomfort = max(0, -0.27)×... ≈ 0 (нет негатива)
8. overload = 7.8×(0+0.3×0.3) - 50×0.6 = 7.8×0.09 - 30 = 0.7 - 30 = 0 (нет перегрузки)
9. engagement = 7.8×0.25 + 1.26×0.45 - 0 + 40×0.22 + (-0.29)×10 ≈ 1.95 + 0.57 + 8.8 - 2.9 ≈ 8.42

**Результат:** слабое удовольствие, отсутствие дискомфорта и перегрузки. Низкая вовлечённость — действие слишком слабое для нейтрального персонажа. Эффект обучения минимален.

### Сценарий 2: Пощёчина (slap → face)

**Персонаж:** тот же нейтральный (sensitivity=50, capacity=50, attitude=50)  
**Точка:** face — localSensitivity=60, localAttitude=40  
**Действие:** act_slap — intensity=5 (норм.=1.0), valence=-3 (-0.3), sharpness=8 (0.8), contact=4 (0.4)

Расчёт:
1. effectiveSensitivity = 50×0.65 + 60×0.35 = 32.5 + 21 = 53.5
2. effectiveAttitude = 50×0.4 + 40×0.6 = 20 + 24 = 44
3. attitudeShift = -0.12, attitudePower ≈ -0.07
4. finalValence = -0.3 + (-0.07)×0.8 = -0.3 - 0.06 = -0.36
5. experiencedIntensity = 1.0×(0.3+(53.5/100)^1.2)×(0.25+0.4×1.15)×100 ≈ 1.0×0.54×0.71×100 ≈ 38.3
6. pleasure = 0
7. discomfort = 0.36 × 38.3 × (1.2 - 50/200) = 0.36 × 38.3 × 0.95 ≈ 13.1
8. overload = 38.3×(0.8+0.4×0.3) - 50×0.6 = 38.3×0.92 - 30 = 35.2 - 30 = 5.2
9. engagement = 38.3×0.25 - 13.1×0.28 - 5.2×0.6 + 40×0.22 + (-0.07)×10 ≈ 9.6 - 3.7 - 3.1 + 8.8 - 0.7 ≈ 10.9

**Результат:** заметный дискомфорт (13.1), лёгкая перегрузка (5.2). Вовлечённость выше, чем при ласке (10.9 vs 8.4) из-за интенсивности. Отношение снизится на ~1 пункт.

### Сценарий 3: Жёсткий допрос к сломленному персонажу

**Персонаж:** сломленный — sensitivity=80, capacity=20, openness=70, plasticity=80, attitude=25  
**Действие:** act_interrogate — intensity=7 (1.4), valence=-4 (-0.4), sharpness=8 (0.8), contact=0  
**Точка:** mind_state — localSensitivity=0, localAttitude=50

Расчёт:
1. effectiveSensitivity = 80×0.65 + 0×0.35 = 52
2. effectiveAttitude = 25×0.4 + 50×0.6 = 10 + 30 = 40
3. attitudeShift = -0.2, attitudePower ≈ -0.14
4. finalValence = -0.4 + (-0.14)×0.8 = -0.4 - 0.11 = -0.51
5. experiencedIntensity = 1.4×(0.3+(52/100)^1.2)×(0.25+0×1.15)×100 ≈ 1.4×0.52×0.25×100 ≈ 18.2
6. discomfort = 0.51 × 18.2 × (1.2 - 20/200) = 0.51 × 18.2 × 1.1 ≈ 10.2
7. overload = 18.2×(0.8+0) - 20×0.6 = 14.6 - 12 = 2.6
8. engagement = 18.2×0.25 - 10.2×0.28 - 2.6×0.6 + 70×0.22 + (-0.14)×10 ≈ 4.6 - 2.9 - 1.6 + 15.4 - 1.4 ≈ 14.1

**Результат:** умеренный дискомфорт. Высокая вовлечённость (14.1) из-за открытости 70. Overload низкий благодаря бесконтактности вербального действия. Отношение упадёт ещё на ~1 пункт. Пластичность 80 усилит эффект обучения (изменение baseline).

### Сценарий 4: Похвала после серии наказаний

**Персонаж:** тот же сломленный (attitude=25, openness=70, plasticity=80)  
**Действие:** act_praise — intensity=4 (0.8), valence=7 (0.7), sharpness=0, contact=0  
**Точка:** mind_state

1. effectiveSensitivity = 52 (без изменений)
2. effectiveAttitude = 40
3. attitudeShift = -0.2, attitudePower ≈ -0.14
4. finalValence = 0.7 + (-0.14)×0.8 = 0.7 - 0.11 = 0.59
5. experiencedIntensity = 0.8×0.52×0.25×100 = 10.4
6. pleasure = 0.59 × 10.4 × (0.4 + 70/200) = 0.59 × 10.4 × 0.75 ≈ 4.6
7. discomfort = 0
8. overload = 10.4×0 - 20×0.6 = -12 → 0
9. engagement = 10.4×0.25 + 4.6×0.45 + 0 + 70×0.22 + (-0.14)×10 ≈ 2.6 + 2.1 + 15.4 - 1.4 ≈ 18.7

**Результат:** удовольствие (4.6), высокая вовлечённость (18.7). Отношение вырастет на ~0.4 пункта. Открытость вырастет на ~0.55 пункта. Для сломленного персонажа praise — эффективный инструмент восстановления отношения.

### Сценарий 5: Каскадный срыв (Discharge)

**Персонаж:** на грани — sensitivity=70, capacity=30, openness=60, plasticity=70, attitude=60, tension=95  
**Действие:** интенсивная стимуляция гениталий — intensity=4 (0.8), valence=7 (0.7), sharpness=2 (0.2), contact=8 (0.8)  
**Точка:** clitoris/penis — localSensitivity=100, localAttitude=5

1. effectiveSensitivity = 70×0.65 + 100×0.35 = 45.5 + 35 = 80.5
2. effectiveAttitude = 60×0.4 + 5×0.6 = 24 + 3 = 27
3. attitudeShift = -0.46, attitudePower = -0.46^1.3 ≈ -0.39
4. finalValence = 0.7 + (-0.39)×0.8 = 0.7 - 0.31 = 0.39
5. experiencedIntensity = 0.8×(0.3+(80.5/100)^1.2)×(0.25+0.8×1.15)×100 ≈ 0.8×0.89×1.17×100 ≈ 83.3
6. pleasure = 0.39 × 83.3 × (0.4 + 60/200) = 0.39 × 83.3 × 0.7 ≈ 22.7
7. discomfort = 0 (нет негативной валентности)
8. overload = 83.3×(0.2+0.8×0.3) - 30×0.6 = 83.3×0.44 - 18 = 36.7 - 18 = 18.7
9. engagement = 83.3×0.25 + 22.7×0.45 - 18.7×0.6 + 60×0.22 + (-0.39)×10 ≈ 20.8 + 10.2 - 11.2 + 13.2 - 3.9 ≈ 29.1

**Tension change:** +22.7 + 0 + 18.7×0.5 = +32 → tension = 95 + 32 = 127 → **≥100: Discharge!**

**Позитивный срыв (pleasure > discomfort):**
- openness +20 → 80
- attitude +25 → 85
- sensitivity -20 → 50 (рефрактерность)
- capacity -40 → -10 → clamp to 0
- plasticity +30 → 100
- tension = 10

**Результат:** мощный оргазм. Персонаж становится крайне открытым (80) и лояльным (85), но полностью истощён (capacity=0) и временно снижена чувствительность. Пластичность 100 делает его extremely податливым к дальнейшим изменениям.

---

## Приложения

### A. Стандартные пресеты действий (из actions.json)

| ID | Label | Type | intensity | valence | sharpness | contact | novelty |
|----|-------|:----:|:---------:|:-------:|:---------:|:-------:|:-------:|
| act_slap | Пощёчина | physical | 5 (1.0) | -3 (-0.3) | 8 (0.8) | 4 (0.4) | 2 (0.2) |
| act_kiss | Поцелуй | physical | 4 (0.8) | 8 (0.8) | 0 (0) | 5 (0.5) | 1 (0.1) |
| act_punch | Удар кулаком | physical | 8 (1.6) | -6 (-0.6) | 3 (0.3) | 7 (0.7) | 3 (0.3) |
| act_caress | Поглаживание | physical | 2 (0.4) | 5 (0.5) | -2 (0) | 3 (0.3) | -1 (0) |
| act_interrogate | Жёсткий допрос | verbal | 7 (1.4) | -4 (-0.4) | 8 (0.8) | 0 (0) | 4 (0.4) |
| act_praise | Похвала | verbal | 4 (0.8) | 7 (0.7) | 0 (0) | 0 (0) | 1 (0.1) |
| act_examine | Строгий осмотр | clinical | 3 (0.6) | -1 (-0.1) | 2 (0.2) | 5 (0.5) | 4 (0.4) |
| wait | Ожидание | system | 0 | 0 | 0 | 0 | 0 |

*Значения нормализуются config.action.ranges: intensity [0, 5], valence [-1, 1], sharpness [0, 1], contact [0, 1], novelty [0, 1]*

### B. Системные состояния (Condition Effects)

| ID | Label | Эффект |
|----|-------|--------|
| effect_apathy | Апатия | intensity×0.5, sharpness×0.5 |
| effect_subspace | Сабспейс | valence+0.2, sharpness×0.6 |
| effect_panic | Паническая атака | valence-0.3, sharpness×1.4 |
| effect_sensory_overload | Сенсорная перегрузка | intensity×1.2 |
| effect_freeze | Тоническое оцепенение | contact×0.8 |
| effect_suggestibility | Смещение контроля | valence+0.15, sharpness×0.8 |
| effect_active_defiance | Активное отторжение | intensity×0.8, valence-0.1 |
| effect_hyperesthesia | Гиперестезия | intensity×1.3, sharpness×1.1 |

### C. Теги действий (Taxonomy)

**Вербальные:** comfort, command, degradation, mockery  
**Физические мягкие:** caress, stimulation, intimate, clinical  
**Физические жёсткие:** pain, blunt, piercing, shock, torture  
**Среда:** restraint, temperature