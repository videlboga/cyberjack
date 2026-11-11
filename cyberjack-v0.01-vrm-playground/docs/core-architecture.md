# CyberJack Core — Архитектура и Документация движка симуляции взаимодействий

## 1. Архитектура

CyberJack — TypeScript-движок симуляции взаимодействий между персонажами (subject/player/NPC) через систему метрик, анатомических точек и сценарных триггеров.

### Структура файлов (src/)

```
src/
├── domain/              # Доменные модели и типы (ядро данных)
│   ├── types.ts         # Все интерфейсы: SubjectCoreState, Character, CompiledAction, TickInput/Output и др.
│   ├── schemas.ts       # Zod-схемы валидации анатомии, действий, предметов, трейтов
│   ├── anatomy.ts       # Анатомические точки человека (getBaseHumanAnatomy)
│   ├── characterProfile.ts  # Профиль персонажа: личность, происхождение, знания
│   ├── canon.ts         # Канон (набор персонажей/локаций)
│   ├── taxonomy.ts      # Теги действий (ACTION_TAGS) и анатомии (ANATOMY_TAGS)
│   └── resolver.ts      # Resolver функций: доступные/заблокированные функции анатомии
│
├── engine/              # Вычислительное ядро
│   ├── runTick.ts       # Главный тик: runTick() = computeResult() + applyLearning()
│   ├── computeResult.ts # Вычисление результата взаимодействия (TICK)
│   ├── applyLearning.ts # Обновление состояния персонажа после тика
│   ├── config.ts        # DEFAULT_CONFIG — все числовые константы и формулы
│   ├── baselineUtils.ts # Утилиты смещения базовых линий (dampTowardsBaseline, advanceBaseline)
│   ├── normalize.ts     # Нормализация значений action/core/point
│   ├── validate.ts      # Валидация EngineConfig
│   └── utils.ts         # clamp() и утилиты
│
├── orchestration/       # Оркестрация игрового тика
│   ├── runGameTick.ts   # Полный игровой тик: загрузка → компиляция → движок → сценарий → сохранение
│   ├── loadTickState.ts # Загрузка состояния персонажа из БД
│   ├── saveTickState.ts # Сохранение состояния персонажа в БД
│   ├── contextManager.ts # Управление активными контекстами (позы, одежда, оборудование)
│   ├── conditionWatcher.ts # Наблюдатель состояний (травма, паника, subspace)
│   ├── sceneOrchestrator.ts # Оркестрация сцены
│   ├── triggers.ts      # Система триггеров
│   ├── eventRouter.ts   # Маршрутизация событий
│   ├── actionScorer.ts  # Оценка действий для AI-агенов (Actor)
│   ├── canonGenerator.ts # Генерация канона
│   └── characterGenerator/ # Подсистема генерации персонажей (генератор + lore + нарратив)
│
├── compiler/            # Компиляция действий
│   ├── compileAction.ts # Компиляция действия в вектор CompiledAction
│   ├── compileContextVector.ts # Вектор контекста
│   ├── mergeVectors.ts  # Слияние векторов
│   └── noveltyService.ts # Расчёт новизны действия
│
├── api/                 # REST API (Express)
│   ├── server.ts        # Запуск сервера
│   ├── socket.ts        # WebSocket
│   └── controllers/ + routes/   # Контроллеры и роуты
│
├── scenario/            # Сценарный слой
│   ├── runScenarioStep.ts      # Шаг сценария
│   ├── resolveSceneTransition.ts # Переходы между сценами
│   ├── checkActionAccess.ts    # Проверка доступности действия
│   ├── applyResourceCosts.ts   # Применение ресурсных затрат
│   ├── buyAssetHandler.ts      # Покупка ассетов
│   └── evaluateAssetContract.ts # Оценка контрактов
│
├── diagnostics/         # Диагностика и интерпретация
│   ├── buildDiagnostics.ts     # Построение диагностики
│   ├── semanticActionInterpreter.ts # Семантический интерпретатор
│   └── traitInference.ts       # Инференс черт характера
│
├── prompts/             # Построение промптов для LLM
│   ├── openRouterPromptBuilder.ts  # Построитель промптов для OpenRouter
│   ├── buildPromptPayload.ts       # Построение Payload промпта
│   └── sillyTavernContext.ts       # Контекст для SillyTavern
│
├── services/            # Сервисы
│   ├── memoryLayer.ts       # Слой памяти
│   ├── embeddingService.ts  # Embedding-сервис
│   └── chatSummary.ts       # Сводка чата
│
├── infrastructure/      # Инфраструктура (БД)
│   ├── db.ts           # SQLite (лучше назвать БД)
│   ├── repositories.ts # Репозитории
│   └── seed.ts         # Сидирование
│
├── ui/                  # UI (React Three Fiber / WebUI)
├── utils/               # Утилиты
├── workers/             # Фоновые воркеры
├── adapters/            # Адаптеры (LLM, SillyTavern)
└── parser/              # Парсер вербального ввода
```

### Связи модулей

```
GameEvent → orchestration/runGameTick.ts
    ↓
    ├── loadTickState() ← infrastructure/db + repositories
    ├── compileAction() ← compiler/compileAction.ts
    │                        └── contextManager
    ├── runTick() ← engine/runTick.ts
    │                ├── computeResult()
    │                └── applyLearning()
    ├── checkActionAccess() ← scenario/checkActionAccess
    ├── applyResourceCosts() ← scenario/applyResourceCosts
    ├── runScenarioStep() ← scenario/runScenarioStep
    ├── buildDiagnostics() ← diagnostics/buildDiagnostics
    ├── buildPromptPayload() ← prompts/buildPromptPayload
    └── saveTickState() → infrastructure/db
```

---

## 2. Персонажи — Метрики (Core State)

Каждый персонаж имеет **6 базовых метрик** (SubjectCoreState), диапазон [0–100] (по умолчанию ~50):

| Метрика | Англ. | Описание | Дефолт |
|---------|-------|----------|--------|
| **Чувствительность** | sensitivity | Реакция на физическое воздействие, интенсивность ощущений. Чем выше — тем сильнее ощущается любое действие. | 50 |
| **Выносливость** | capacity | Способность выдерживать стресс, сопротивляемость перегрузке. Высокая = может выдержать больше без срыва. | 50 |
| **Открытость** | openness | Восприимчивость к новому опыту, снятие психологических барьеров. Увеличивает удовольствие. | 40 |
| **Пластичность** | plasticity | Податливость разума к изменениям, формированию новых трейтов. Влияет на скорость смещения baseline. | 50 |
| **Отношение** | attitude | Отношение к оператору/партнёру (позитивное/негативное), покорность. 0 = враждебность, 100 = полное подчинение. | 50 |
| **Напряжение** | tension | Накопленный физиологический/психологический накал (0–150). >100 триггерит разрядку (discharge), которая обнуляет tension и резко меняет другие метрики. | 0 |

### Дополнительно
- **preferences** — JSON-строка предпочтений (точки, действия, контексты)
- **baseline*** — базовые линии, к которым метрики стремятся при отдыхе
- **flags** — массив строк-флагов

### Как метрики влияют на взаимодействие

1. **sensitivity × action.intensity → experiencedIntensity** — чем выше чувствительность, тем сильнее ощущается действие (по степенному закону: (sens/100)^1.2)
2. **attitude → valence shift** — позитивное отношение сдвигает валентность действия в положительную сторону (pleasure), негативное — в отрицательную (discomfort)
3. **openness → pleasure** — открытость увеличивает удовольствие от позитивных действий
4. **capacity → discomfort + overload** — выносливость смягчает дискомфорт и перегрузку

### Производные метрики (TickResult)

| Метрика | Описание | Формула (упрощённо) |
|---------|----------|---------------------|
| effectiveSensitivity | Общая чувствительность (глобальная + локальная) | global × 0.65 + local × 0.35 |
| effectiveAttitude | Общее отношение (глобальное + локальное) | global × 0.4 + local × 0.6 |
| experiencedIntensity | Ощущаемая интенсивность | intensity × чувствительность × контакт |
| finalValence | Итоговая валентность | valence + attitudeShift × 0.8 |
| pleasure | Удовольствие | max(0, valence) × интенсивность × (0.4 + openness/200) |
| discomfort | Дискомфорт | max(0, -valence) × интенсивность × (1.2 - capacity/200) |
| overload | Перегрузка | интенсивность × (sharpness + contact × 0.3) - capacity × 0.6 |
| engagement | Вовлечённость | Комбинация интенсивности, удовольствия, дискомфорта, перегрузки, открытости и отношения |
| learningEffect | Эффект обучения | novelty × интенсивность × (0.3 + plasticity/100) - overload × 0.5 |

---

## 3. Анатомические точки (Anatomy Points)

Система анатомии — набор точек тела, каждая со своей локальной чувствительностью (sens) и отношением (att). Всего **30+ точек**, генерируется `getBaseHumanAnatomy(gender, mod)`.

### Базовая анатомия (все гендеры)

| ID | Лейбл | Sens | Att | Parent | Functions | 
|----|-------|------|-----|--------|-----------|
| posture | Поза (Текущее положение тела) | 0 | 50 | — | — |
| mind_state | Психика/Разум | 0 | 50 | — | — |
| head | Голова/Волосы | 30 | 70 | — | look, hear |
| face | Лицо | 60 | 40 | head | — |
| lips | Губы | 85 | 20 | face | speak, kiss, eat |
| neck | Шея | 80 | 30 | — | — |
| shoulders | Плечи | 30 | 80 | — | — |
| chest | Грудь | 60–85 | 30 | — | — |
| nipples | Соски | 95 | 10 | chest | — |
| belly | Живот | 50 | 40 | — | — |
| back | Спина | 40 | 60 | — | stabilize_posture |
| waist | Талия | 65 | 45 | — | — |
| arms | Руки | 20 | 90 | — | reach |
| hands | Кисти | 70 | 85 | arms | touch, manipulate |
| inner_thighs | Внутр. сторона бедер | 85 | 10 | — | — |
| legs | Ноги | 25 | 75 | — | walk |
| knees | Колени | 20 | 70 | — | kneel, stand, shift_posture |
| feet | Ступни | 75 | 50 | — | stand |
| buttocks | Ягодицы | 50 | 15 | — | — |
| anus | Анус | 100 | 5 | buttocks | — |

### Если gender = male или androgynous

| ID | Лейбл | Sens | Att | Parent |
|----|-------|------|-----|--------|
| groin | Пах | 90 | 10 | — |
| penis | Член | 100 | 5 | groin |
| testicles | Яички | 100 | 5 | groin |
| prostate | Простата | 100 | 5 | anus |

### Если gender = female или androgynous

| ID | Лейбл | Sens | Att | Parent |
|----|-------|------|-----|--------|
| vulva | Вульва | 95 | 5 | — |
| vagina | Влагалище | 100 | 5 | vulva |
| clitoris | Клитор | 100 | 5 | vulva |

### Технические слоты

| ID | Лейбл | Sens | Att |
|----|-------|------|-----|
| slot_room | Слот: Окружение (Комната) | 50 | 50 |
| slot_social | Слот: Социальное | 50 | 50 |
| systemic | Организм (Системное) | 50 | 50 |

### Специальные модификации (AnatomyMod)
- `amputee_left_arm` — удаляет руку/кисть
- `cyber_implant_arm` — кибер-рука (sens=10, att=95, теги: cybernetic)
- `cyber_implant_eyes` — кибер-глаза

### Локальное состояние точки (SubjectPointState)

| Поле | Описание |
|------|----------|
| localSensitivity | Локальная чувствительность зоны [0–100] |
| localAttitude | Локальное отношение (триггер/сопротивление или принятие) [0–100] |
| familiarity | Привычность воздействия на зону [0–100] |
| exposureCount | Счётчик воздействий [0–∞) |

### Связь: глобальные метрики × локальные

- **effectiveSensitivity** = core.sensitivity × 0.65 + point.localSensitivity × 0.35
- **effectiveAttitude** = core.attitude × 0.4 + point.localAttitude × 0.6
- Между глобальным и локальным отношением есть «утечка» (leak): localToGlobalLeak = 0.1, globalToLocalLeak = 0.08 — состояния постепенно синхронизируются.

---

## 4. Зависимости — Как метрики влияют на результат

### Граф вычислений (Tick → Result → Learning)

```
Action (intensity, valence, contact, sharpness, novelty)
    │
    ▼
 effectiveSensitivity = f(core.sensitivity, point.localSensitivity)
 effectiveAttitude = f(core.attitude, point.localAttitude)
 attitudeShift = (effectiveAttitude - 50) / 50   (нормализация)
 attitudePower = sign(shift) × |shift|^1.3
    │
    ▼
 experiencedIntensity = intensity × (0.3 + (sens/100)^1.2) × (0.25 + contact×1.15) × 100
 finalValence = valence + attitudePower × 0.8
    │
    ├── pleasure = max(0, finalValence) × expIntensity × (0.4 + openness/200)
    ├── discomfort = max(0, -finalValence) × expIntensity × (1.2 - capacity/200)
    ├── overload = expIntensity × (sharpness + contact×0.3) - capacity×0.6
    ├── engagement = expIntensity×0.25 + pleasure×0.45 - discomfort×0.28 - overload×0.6 + openness×0.22 + attitudeShift×10
    └── learning = novelty × expIntensity × (0.3 + plasticity/100) - overload×0.5
    │
    ▼
 applyLearning() → новые значения sensitivity, capacity, openness, plasticity, attitude, tension
                    + дрейф к baseline через dampTowardsBaseline()
                    + смещение baseline через advanceBaseline()
```

### Ключевые зависимости

1. **Sensitivity & Contact → Intensity** — Чувствительность и контактность умножают интенсивность. Вербальные действия (contact ≈ 0) ощущаются слабее физических.

2. **Attitude → Valence Shift** — Позитивное отношение (attitude > 50) смещает валентность в положительную сторону, негативное — в отрицательную. Эффект нелинейный (степень 1.3).

3. **Openness → Pleasure** — Высокая открытость значительно усиливает удовольствие.

4. **Capacity → Overload** — Высокая выносливость поглощает перегрузку. Каждый тик: overload = интенсивность × (sharpness + contact×0.3) − capacity × 0.6.

5. **Overload → Learning & Attitude** — Перегрузка уменьшает learningEffect и ухудшает отношение (attitudeFromOverload = 0.08).

6. **Tension Discharge** — При tension ≥ 100 происходит каскадный срыв:
   - **Позитивный** (pleasure ≥ discomfort): openness +20, attitude +25, capacity −40, sensitivity −20 (рефрактерность), plasticity +30
   - **Негативный** (discomfort > pleasure): attitude −20, openness −15, capacity = 0, plasticity +30
   - В обоих случаях tension сбрасывается до 10.

7. **Edging** — При tension > 85 без разрядки: capacity сжигается быстрее (+0.3/tick), растут openness (+0.5), plasticity (+1.0), sensitivity (+1.5/tick).

8. **Baseline дрейф** — Все 5 метрик непрерывно дрейфуют к своим baseline-значениям (damping: base=0.15, distanceScale=0.01, max=0.6). Baseline-ы медленно смещаются вслед за текущими значениями (adaptBase=0.01), причём скорость зависит от plasticity, openness и novelty.

### Структура действия (CompiledAction)

| Поле | Диапазон | Описание |
|------|----------|----------|
| intensity | 0–5 | Базовая сила действия |
| valence | -1–1 | Валентность (приятность): -1 = отвращение, +1 = блаженство |
| contact | 0–1 | Степень физического контакта |
| sharpness | 0–1 | Резкость (острота): 0 = мягко, 1 = пронзительно |
| novelty | 0–1 | Новизна: насколько действие неожиданно/непривычно |
| type | — | 'physical' \| 'verbal' \| 'context' \| 'system' |
| tags | — | Массив тегов (comfort, command, pain, intimate, etc.) |

---

## 5. Примеры сценариев

### Сценарий 1: Мягкая ласка (нейтральное состояние)

**Персонаж**: sensitivity=50, capacity=50, openness=40, plasticity=50, attitude=50
**Точка**: плечи (shoulders, localSensitivity=30, localAttitude=80)
**Действие**: "Мягкий контакт" — intensity=0.35, valence=0.45, contact=0.75, sharpness=0.15, novelty=0.25

**Вычисление**:
- effectiveSensitivity = 50×0.65 + 30×0.35 = 43
- attitudeShift = (50−50)/50 = 0
- experiencedIntensity = 0.35 × (0.3 + (43/100)^1.2) × (0.25 + 0.75×1.15) × 100 = 0.35 × 0.66 × 1.1125 × 100 ≈ 25.7
- finalValence = 0.45 + 0 = 0.45 (положительно)
- pleasure = 0.45 × 25.7 × (0.4 + 40/200) = 0.45 × 25.7 × 0.6 ≈ 6.9
- discomfort ≈ 0
- overload = 25.7 × (0.15 + 0.75×0.3) − 50×0.6 = 25.7 × 0.375 − 30 = −20.4 → 0
- engagement = 25.7×0.25 + 6.9×0.45 − 0 + 0 + 40×0.22 + 0 = 6.4 + 3.1 + 8.8 ≈ 18.3

**Итог**: Лёгкое приятное ощущение (~7 pleasure), без перегрузки. Вовлечённость умеренная (18/100). Изменение метрик минимальное, лёгкий рост openness и attitude.

---

### Сценарий 2: Резкое неприятное (высокая чувствительность)

**Персонаж**: sensitivity=80, capacity=30, openness=20, plasticity=50, attitude=20
**Точка**: живот (belly, localSensitivity=50, localAttitude=40)
**Действие**: "Резкое неприятное" — intensity=0.75, valence=-0.65, contact=0.35, sharpness=0.85, novelty=0.45

**Вычисление**:
- effectiveSensitivity = 80×0.65 + 50×0.35 = 69.5
- effectiveAttitude = 20×0.4 + 40×0.6 = 32
- attitudeShift = (32−50)/50 = −0.36
- attitudePower = −|−0.36|^1.3 ≈ −0.28
- experiencedIntensity = 0.75 × (0.3 + (69.5/100)^1.2) × (0.25 + 0.35×1.15) × 100 = 0.75 × 0.89 × 0.6525 × 100 ≈ 43.6
- finalValence = −0.65 + (−0.28×0.8) = −0.874 (сильно отрицательно)
- pleasure ≈ 0
- discomfort = 0.874 × 43.6 × (1.2 − 30/200) = 0.874 × 43.6 × 1.05 ≈ 40.0
- overload = 43.6 × (0.85 + 0.35×0.3) − 30×0.6 = 43.6 × 0.955 − 18 = 41.6 − 18 = 23.6

**Итог**: Сильный дискомфорт (40), высокая перегрузка (24). При низком attitude эффект усиливается. Вовлечённость будет снижена перегрузкой. Attitude упадёт ещё на ~2.5 пункта. Если tension вырастет до 100, произойдёт негативная разрядка.

---

### Сценарий 3: Вербальное подчинение (высокое отношение + пластичность)

**Персонаж**: sensitivity=50, capacity=60, openness=65, plasticity=70, attitude=80
**Точка**: психика (mind_state, localSensitivity=0, localAttitude=50)
**Действие**: "Команда/приказ" (verbal) — intensity=0.4, valence=0.0, contact=0.05, sharpness=0.3, novelty=0.3

**Вычисление**:
- effectiveSensitivity = 50×0.65 + 0×0.35 = 32.5
- effectiveAttitude = 80×0.4 + 50×0.6 = 62
- attitudeShift = (62−50)/50 = 0.24
- attitudePower = 0.24^1.3 ≈ 0.17
- experiencedIntensity = 0.4 × (0.3 + (32.5/100)^1.2) × (0.25 + 0.05×1.15) × 100 = 0.4 × 0.58 × 0.3075 × 100 ≈ 7.1 (очень низкая из-за contact=0.05)
- finalValence = 0.0 + 0.17×0.8 = 0.136 (слегка положительно, т.к. персонаж лоялен)
- pleasure = 0.136 × 7.1 × (0.4 + 65/200) = 0.136 × 7.1 × 0.725 ≈ 0.7
- overload ≈ 0 (минимальная интенсивность)

**Итог**: Вербальное действие почти не ощущается физически (7/100), но благодаря высокому attitude сдвигает валентность в положительную сторону. Производные изменения: небольшой рост openness (+0.08) и attitude (+0.05) — эффект закрепления лояльности.

---

### Сценарий 4: Грань срыва (Edging → Discharge)

**Персонаж**: sensitivity=70, capacity=15, openness=50, plasticity=40, attitude=40
**Точка**: гениталии (penis, localSensitivity=100, localAttitude=5)
**Действие**: "Интимная стимуляция" — intensity=0.8, valence=0.5, contact=0.9, sharpness=0.2, novelty=0.4

**Ситуация**: Предыдущие тики уже накопили tension = 90 (edging range: >85).

**Вычисление (после нескольких тиков, накоплено)**:
- effectiveSensitivity = 70×0.65 + 100×0.35 = 80.5
- effectiveAttitude = 40×0.4 + 5×0.6 = 19
- attitudeShift = (19−50)/50 = −0.62
- attitudePower ≈ −0.52
- experiencedIntensity = 0.8 × (0.3 + (80.5/100)^1.2) × (0.25 + 0.9×1.15) × 100 ≈ 0.8 × 1.03 × 1.285 × 100 ≈ 105.9
- finalValence = 0.5 + (−0.52×0.8) = 0.084
- pleasure = 0.084 × 105.9 × (0.4 + 50/200) = 0.084 × 105.9 × 0.65 ≈ 5.8
- overload = 105.9 × (0.2 + 0.9×0.3) − 15×0.6 = 105.9 × 0.47 − 9 = 49.8 − 9 = 40.8

**Тик с edging**: tension растёт на (5.8 + 0 + 40.8×0.5)×(70/50)×0.3 ≈ 15 за тик. Capacity падает дополнительно на (90−85)×0.3 = 1.5/тик.

**Разрядка** (tension ≥ 100): pleasure=5.8 < discomfort=0, но pleasure > discomfort... смотрим: pleasure(5.8) > 0, discomfort ≈ 0 (valence положительная). Позитивная разрядка:
- Openness +20 → 70
- Attitude +25 → 65
- Capacity −40 → 0
- Sensitivity −20 → 50
- Plasticity +30 → 70
- Tension → 10

**Итог**: Мощный каскадный срыв. Персонаж становится более открытым и покорным, но полностью истощён.

---

### Сценарий 5: Отдых/восстановление

**Персонаж** (после сценария 4): sensitivity=50, capacity=0, openness=70, plasticity=70, attitude=65, tension=10
**Действие**: "Ожидание" (wait) — deltaTime = 20 (один тик отдыха = 20 единиц времени)

**Вычисление**:
- experiencedIntensity = 0 (wait — специальное действие)
- Ключевой эффект — **восстановление** в applyLearning:
  - tensionDrop = max(1, 70/10) × 20 = 7 × 20 = 140 (tension → 0)
  - capacityRecovery = 1.0 × 20 = 20 пунктов восстановления
  - sensitivityRegen = 0.4 × 20 = 8 пунктов (т.к. overload < 8)
  - baseline дрейф возвращает все метрики к их baseline-ам

**Итог**: За 20 единиц отдыха персонаж частично восстанавливается: capacity ≈ 20, tension ≈ 0, sensitivity регенерирует на 8. Baseline-ы продолжают медленно адаптироваться к новым значениям.

---

## Приложение: EngineConfig (DEFAULT_CONFIG)

Полный набор констант в `engine/config.ts`. Основные настройки:

```typescript
core:  { defaults: { sensitivity:50, capacity:50, openness:40, plasticity:50, attitude:50 }, min:0, max:100 }
point: { defaults: { localSensitivity:50, localAttitude:50, familiarity:0, exposureCount:0 }, min:0, max:100 }
action: { ranges: { intensity:[0,5,0.01], valence:[-1,1,0.01], contact:[0,1,0.01], sharpness:[0,1,0.01], novelty:[0,1,0.01] } }
```

Ключевые константы формул:
- effectiveSensitivity: { globalWeight:0.65, localWeight:0.35 }
- effectiveAttitude: { globalWeight:0.4, localWeight:0.6 }
- pleasure: { opennessBase:0.4, opennessDivisor:200 }
- discomfort: { capacityBase:1.2, capacityDivisor:200 }
- overload: { contactFactor:0.3, capacityFactor:0.6 }
- learning: { plasticityBase:0.3, plasticityDivisor:100, overloadPenalty:0.5 }
- applyLearning: { sensitivityFromIntensity:0.06, capacityDropMultiplier:0.25, localToGlobalLeak:0.1, globalToLocalLeak:0.08 }
- baseline: { core: { dampingBase:0.15, adaptBase:0.01 }, point: { dampingBase:0.2, adaptBase:0.008 } }