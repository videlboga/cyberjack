# Event Director: событийная песочница Омникрона

## 1. Назначение

Основной геймплей CyberJack — калибровка активов в лаборатории. Event Director не
создаёт линейную кампанию и не конкурирует с лабораторной симуляцией. Его задача:

- объяснять, почему сейчас появился контракт, кандидат или поставка;
- возвращать в игру последствия действий и слов игрока;
- связывать лабораторию с Омникроном короткими событиями;
- поддерживать несколько слабо связанных тем без квестового журнала;
- создавать ощущение продолжающейся жизни станции.

Базовый цикл:

```text
изменение мира
  → подходящая возможность
  → короткое предъявление игроку
  → решение или игнорирование
  → подтверждённое последствие
  → закрытие, эхо или развитие нити
```

Режиссёр выбирает структуру события. LLM конкретизирует речь и описание. База
данных остаётся единственным источником подтверждённых фактов.

## 2. Принципы

### 2.1. Лаборатория остаётся центром

Событие либо:

- возникает из лабораторного состояния;
- приносит в лабораторию возможность или проблему;
- требует короткого выхода во внешний сектор;
- возвращает последствия в лабораторию.

Путешествия, сообщения и встречи не должны занимать больше внимания, чем сама
работа с активами.

### 2.2. Никакого обязательного главного сюжета

Мир создаёт локальные последовательности. Некоторые из них могут постепенно
сложиться в крупную тайну, но система не гарантирует одинаковую кампанию.

### 2.3. Генерация не создаёт канон напрямую

LLM может предложить:

- формулировку сообщения;
- реплику персонажа;
- наблюдаемую деталь;
- несколько вариантов решения;
- кандидат нового факта.

Она не может самостоятельно:

- менять местоположение и роли персонажей;
- выдавать предметы и кредиты;
- создавать родство, прошлое или смерть персонажа;
- объявлять результат процедуры;
- закрывать обещание;
- менять контракт;
- утверждать природу Аномалии.

Такие изменения выполняются только доменным обработчиком выбранного события.

### 2.4. Большинство событий короткие

Рекомендуемое распределение:

- 60% — закрытые одноразовые события;
- 30% — события с одним будущим эхом;
- 10% — события, открывающие или развивающие нить.

Это защищает песочницу от накопления десятков незавершённых «квестов».

## 3. Что уже существует

Новый слой переиспользует:

| Существующая сущность | Назначение |
|---|---|
| `scenario_events` | Неизменяемая хроника фактически произошедших системных событий |
| `event_logs` | Механические действия и результаты движка |
| `memory_embeddings` | Пережитые персонажем эпизоды |
| `social_memories` | Обещания, планы, границы, предпочтения и личные факты |
| `chat_memory` | Буквальная история диалога |
| `asset_contracts` | Механическое состояние принятых и доступных контрактов |
| `character_relations` | Отношение, открытость и знакомство |
| `world_state` | Игровое время |

Event Director не заменяет эти таблицы. Он добавляет координацию между ними.

## 4. Новые сущности

### 4.1. `story_threads`

Нить — сохранённая тема, а не последовательность заранее написанных шагов.

```sql
CREATE TABLE story_threads (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    stage TEXT NOT NULL DEFAULT 'seed',
    subject_id TEXT,
    related_character_ids TEXT NOT NULL DEFAULT '[]',
    faction_id TEXT,
    location_id TEXT,
    facts TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    tension REAL NOT NULL DEFAULT 0.2,
    importance REAL NOT NULL DEFAULT 0.5,
    visibility TEXT NOT NULL DEFAULT 'known',
    source_type TEXT NOT NULL,
    source_id TEXT,
    last_event_minute INTEGER,
    cooldown_until INTEGER,
    created_minute INTEGER NOT NULL,
    updated_minute INTEGER NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}'
);
```

`type` первой версии:

- `personal_past`;
- `promise`;
- `laboratory_anomaly`;
- `supply_origin`;
- `corporate_interest`;
- `archive_inconsistency`;
- `relationship`;
- `station_rumor`.

`status`:

- `open` — может развиваться;
- `dormant` — временно не участвует в выборе;
- `resolved` — получила развязку;
- `abandoned` — потеряла актуальность;
- `contradicted` — факты нити вошли в подтверждённое противоречие.

`visibility`:

- `hidden` — существует только для режиссёра;
- `hinted` — игрок видел косвенный след;
- `known` — тема явно сформулирована;
- `public` — известна нескольким участникам.

### 4.2. `event_opportunities`

Возможность — событие, которое может произойти, но ещё не стало фактом.

```sql
CREATE TABLE event_opportunities (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    channel TEXT NOT NULL,
    priority REAL NOT NULL DEFAULT 0.5,
    urgency REAL NOT NULL DEFAULT 0,
    subject_id TEXT,
    actor_ids TEXT NOT NULL DEFAULT '[]',
    thread_ids TEXT NOT NULL DEFAULT '[]',
    location_id TEXT,
    available_from INTEGER NOT NULL,
    expires_at INTEGER,
    payload TEXT NOT NULL DEFAULT '{}',
    generated_content TEXT,
    offered_minute INTEGER,
    resolved_minute INTEGER,
    resolution TEXT,
    source_event_id INTEGER,
    UNIQUE(template_id, source_event_id, subject_id)
);
```

`status`:

- `available`;
- `presented`;
- `accepted`;
- `declined`;
- `ignored`;
- `expired`;
- `resolved`;
- `cancelled`.

`channel`:

- `inbox` — сообщение или звонок;
- `arrival` — кто-то приходит в лабораторию;
- `conversation` — персонаж сам поднимает тему;
- `supply` — предложение в снабжении;
- `contract` — доступный заказ;
- `travel` — событие при выходе в сектор;
- `ambient` — короткое фоновое наблюдение;
- `inspection` — внешнее вмешательство.

### 4.3. `event_instances`

Необходима отдельная запись о разыгранной структуре, потому что
`scenario_events` хранит итоговую хронику, но не варианты и решение игрока.

```sql
CREATE TABLE event_instances (
    id TEXT PRIMARY KEY,
    opportunity_id TEXT,
    template_id TEXT NOT NULL,
    phase TEXT NOT NULL,
    world_minute INTEGER NOT NULL,
    participants TEXT NOT NULL DEFAULT '[]',
    presented_content TEXT NOT NULL DEFAULT '{}',
    selected_choice TEXT,
    outcome TEXT NOT NULL DEFAULT '{}',
    created_fact_ids TEXT NOT NULL DEFAULT '[]',
    created_thread_ids TEXT NOT NULL DEFAULT '[]',
    scenario_event_id INTEGER,
    metadata TEXT NOT NULL DEFAULT '{}'
);
```

`phase`:

- `presented`;
- `responded`;
- `resolved`;
- `echoed`.

### 4.4. `world_facts`

Хранилище только подтверждённого событийного канона, не телесной механики.

```sql
CREATE TABLE world_facts (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    scope_id TEXT,
    predicate TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1,
    visibility TEXT NOT NULL DEFAULT 'known',
    status TEXT NOT NULL DEFAULT 'active',
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    valid_from INTEGER NOT NULL,
    valid_until INTEGER,
    supersedes_fact_id TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    metadata TEXT NOT NULL DEFAULT '{}'
);
```

Примеры:

```text
character:NPC-CAND-01 worked_at clinic_aurora
item:batch-17 originated_from veil_closed_program
station:archive record_name_mismatch NPC-CAND-01
faction:helix interested_in S-AV-01
```

Факты не заменяют профиль персонажа. Стабильные биографические сведения после
подтверждения могут быть отражены в `profile_json`, но `world_facts` хранит
происхождение знания и противоречия.

## 5. Обещания и планы

`social_memories` уже хранит обещания и общие планы. Они не переносятся в
`story_threads`.

Event Director рассматривает активную запись:

```text
social_memory(kind=promise, status=active, importance>=0.7)
```

как источник события. При первом развитии обещания может быть создана
производная нить с `source_type = social_memory`. Состояние выполнения остаётся
в `social_memories`, а нить хранит только внешние обстоятельства вокруг него.

Пример:

```text
Игрок: «Я проверю, кто изменил твоё досье».
social_memories: открытое обещание.
story_threads: «Несоответствие досье Ники».
event_opportunity: архивный ответ или встреча с бывшим сотрудником клиники.
```

## 6. Шаблон события

Шаблоны хранятся в TypeScript или JSON и проходят статическую валидацию.

```ts
type EventTemplate = {
    id: string;
    family: EventFamily;
    channels: EventChannel[];
    scope: 'subject' | 'laboratory' | 'station';

    requirements: Requirement[];
    blockers?: Requirement[];
    consumes?: Effect[];
    outcomes: Record<string, Effect[]>;

    cast: CastRule[];
    cooldownMinutes: number;
    expiryMinutes?: number;
    maxOccurrences?: number;
    repetitionKey?: string;

    pacing: {
        minImportance: number;
        baseWeight: number;
        interruptionCost: number;
        preferredWindows: EventWindow[];
    };

    generation: {
        mode: 'authored' | 'templated' | 'llm';
        promptId?: string;
        allowedFactPredicates?: string[];
        maxChoices: number;
    };
};
```

Пример:

```ts
{
    id: 'promise_archive_lead',
    family: 'personal',
    channels: ['inbox', 'conversation'],
    scope: 'subject',
    requirements: [
        { type:'active_social_memory', kind:'promise', owner:'other' },
        { type:'thread_tag', tag:'archive' },
        { type:'elapsed_since_source', minutes:360 }
    ],
    cast: [
        { role:'subject', from:'thread.subjectId' },
        { role:'sender', archetype:'archive_clerk', allowEphemeral:true }
    ],
    cooldownMinutes:1440,
    maxOccurrences:1,
    pacing:{
        minImportance:.6,
        baseWeight:.75,
        interruptionCost:.25,
        preferredWindows:['new_day', 'laboratory_idle']
    },
    generation:{
        mode:'llm',
        promptId:'event.archive_lead',
        allowedFactPredicates:['archive_record_exists', 'archive_record_mismatch'],
        maxChoices:3
    },
    outcomes:{
        inspect:[
            { type:'create_fact_candidate', predicate:'archive_record_mismatch' },
            { type:'advance_thread', stage:'lead_found', tensionDelta:.15 }
        ],
        defer:[
            { type:'reschedule', delayMinutes:720 }
        ],
        ignore:[
            { type:'relationship_memory', content:'Он не вернулся к обещанному поиску.' }
        ]
    }
}
```

## 7. Источники сигналов

Режиссёр не сканирует всю базу каждую минуту. Домен публикует компактные сигналы:

```ts
type DirectorSignal =
    | { type:'subject_threshold_crossed'; subjectId:string; metric:string; from:number; to:number }
    | { type:'state_transition'; subjectId:string; transition:string }
    | { type:'procedure_completed'; subjectId:string; summary:string }
    | { type:'social_memory_created'; memoryId:number; subjectId:string }
    | { type:'promise_resolved'; memoryId:number; outcome:string }
    | { type:'contract_changed'; contractId:string; state:string }
    | { type:'item_acquired'; itemId:string; source:string }
    | { type:'new_day'; worldMinute:number }
    | { type:'location_entered'; locationId:string }
    | { type:'laboratory_idle'; minutes:number };
```

Источники первой версии:

- `recordMemoryEvent`;
- `rememberSocialExchange`;
- переходы `InteractionObservation`;
- принятие/выполнение контракта;
- покупка и получение предмета;
- начало нового игрового дня;
- вход в раздел лаборатории после длительного отсутствия.

Сигналы дедуплицируются по `source_type + source_id + signal_type`.

## 8. Работа режиссёра

### 8.1. Построение кандидатов

На сигнал:

1. Выбираются совместимые шаблоны.
2. Проверяются фактические требования и блокировки.
3. Разрешается актёрский состав.
4. Проверяется квота активных событий.
5. Создаётся `event_opportunity`, но игроку она ещё не показывается.

### 8.2. Оценка

```text
score =
  baseWeight
  × relevance
  × novelty
  × pacingFit
  × castAvailability
  × threadNeed
  × sandboxVariety
  - repetitionPenalty
  - interruptionCost
  - activeLoadPenalty
```

Диапазоны множителей: `0..1.5`.

`relevance` учитывает близость к недавним действиям и словам.

`novelty` снижается при повторении семей, каналов и участников.

`threadNeed` повышается, если важная нить давно не развивалась.

`sandboxVariety` поддерживает чередование:

- персонажного;
- лабораторного;
- рыночного;
- контрактного;
- станционного.

### 8.3. Бюджет внимания

Одновременно:

- не более 1 срочного события;
- не более 2 явно предложенных возможностей;
- не более 4 открытых важных нитей;
- не более 2 событий одного персонажа подряд;
- не более 1 внешнего прерывания за 30 игровых минут;
- после кульминационного лабораторного события — окно тишины минимум 10 минут.

Игнорирование — допустимое решение. Не каждое событие должно повторно требовать
ответа.

## 9. Окна предъявления

События показываются не непосредственно в момент каждого сигнала.

Подходящие окна:

- завершение активной процедуры;
- возвращение на обзор лаборатории;
- начало нового дня;
- открытие входящих сообщений;
- вход в снабжение;
- выбор поездки;
- 15–30 минут лабораторного простоя.

Неподходящие окна:

- активный LLM-ответ;
- незавершённое действие;
- пик, разрядка, перегрузка или срыв;
- открытая настройка устройства;
- серия быстрых ручных действий игрока.

## 10. LLM-контракт

LLM получает:

```json
{
  "template": "promise_archive_lead",
  "channel": "inbox",
  "participants": [],
  "knownFacts": [],
  "threadSummary": "",
  "recentRelevantEvents": [],
  "tone": "",
  "allowedRevelations": [],
  "forbiddenClaims": [],
  "choiceIntents": ["inspect", "defer", "ignore"]
}
```

Возвращает:

```json
{
  "title": "",
  "body": "",
  "speakerId": "",
  "choices": [
    { "intent": "inspect", "label": "" },
    { "intent": "defer", "label": "" },
    { "intent": "ignore", "label": "" }
  ],
  "factCandidates": [
    {
      "predicate": "archive_record_mismatch",
      "value": "",
      "evidence": ""
    }
  ]
}
```

Проверяется только структура и полномочия:

- `intent` должен существовать в шаблоне;
- `speakerId` должен входить в разрешённый состав;
- predicate должен входить в `allowedFactPredicates`;
- фактическое последствие не берётся из текста модели.

Содержательная естественность речи не валидируется.

## 11. Эпизодические персонажи

Три уровня:

### Полный

Имеет `characters`, профиль, отношения, память и при необходимости `subjects`.
Это постоянные жители лаборатории и важные внешние лица.

### Повторяющийся внешний

Имеет `characters`, профиль и отношения, но не имеет телесной симуляции.
Примеры: Брокер, Связной, корпоративный представитель, архивист.

### Эпизодический

Сначала хранится как:

```ts
{
    ephemeralId:'ephemeral:archive_clerk:7',
    archetype:'archive_clerk',
    name:'Седьмой регистратор',
    traits:['усталый', 'осторожный'],
    voice:['короткие формальные фразы'],
    factionId:'continuum',
    portraitSeed:'...'
}
```

Если он участвует в трёх событиях, получает высокую важность либо становится
объектом обещания/отношения, происходит promotion:

- создаётся постоянный `characters.id`;
- переносятся события и факты;
- создаётся минимальный профиль;
- дальнейшие встречи используют тот же идентификатор.

Так первая бета может иметь 8–10 полноценных персонажей, не ограничивая число
лиц в событиях.

## 12. Контракты как продукт событий

Механический `asset_contracts` создаётся только после события-предложения.

Генератор контракта:

1. Выбирает существующего доступного актива.
2. Находит 1 сильную или необычную черту.
3. Выбирает фракцию, которой она тематически интересна.
4. Строит достижимую цель относительно текущего состояния.
5. Добавляет не более одного ограничителя.
6. Связывает контракт с событием и, опционально, нитью.

Пример:

```text
Сигнал: чувствительность ступней Ники заметно выросла.
Helix интересуется воспроизводимостью локального переноса чувствительности.
Контракт: добиться заданного уровня при сохранении ёмкости выше порога.
Хвост: после передачи приходит отчёт с чужим идентификатором.
```

Контракт не обязан прикрепляться к активу до принятия, но хранит
`suggestedSubjectIds` и причину генерации в metadata.

## 13. Снабжение как продукт событий

Предложение получает:

- канал происхождения;
- поставщика;
- доступность во времени;
- состояние предмета;
- известные и скрытые особенности;
- возможную связь с нитью.

Типы:

- стандартное распределение Lattice;
- партия Брокера;
- частное предложение;
- обмен на услугу;
- найденное или возвращённое оборудование;
- фракционная награда.

Покупка создаёт факт происхождения и `scenario_event`. Скрытая особенность
раскрывается только через подходящее событие или использование.

## 14. Перемещение

Карта станции не симулирует прогулку. Она задаёт:

- доступные каналы событий;
- доступный состав;
- атмосферу;
- стоимость времени;
- вероятность дорожного события.

Поездка состоит максимум из:

1. выбора сектора;
2. короткого переходного текста;
3. опционального события;
4. целевого экрана или встречи.

Повторные безопасные маршруты можно пропускать. Значимое дорожное событие
должно быть редким и связано с нитью, персонажем либо текущим состоянием станции.

## 15. UI первой версии

### Входящие

Небольшая лента:

- сообщения;
- предложения контрактов;
- поставки;
- просьбы персонажей;
- результаты предыдущих решений.

Карточка показывает источник, время, текст и 0–3 действия.

### Фоновые следы

Не требуют ответа:

- строка в хронике;
- изменение описания предмета;
- новая заметка в досье;
- реплика персонажа при следующем разговоре;
- маркер на карте.

### Нити

Игрок не видит технический список `story_threads`. В досье и интерфейсе
показываются естественные формулировки:

- «Вы обещали проверить её старое досье»;
- «Происхождение партии не установлено»;
- «Helix дважды запрашивала данные Миры».

## 16. Первый вертикальный прототип

### Сценарий A: обещание

1. Игрок обещает персонажу что-либо проверить.
2. `social_memories` создаёт promise.
3. Сигнал создаёт нить и отложенную возможность.
4. Через 6–24 игровых часа приходит связанное сообщение.
5. Игрок выполняет, откладывает или игнорирует.
6. Обещание закрывается только подтверждённым действием.
7. Отношение меняется существующим `socialMemory`-механизмом.

### Сценарий B: контракт из состояния

1. Параметр или локальная зона пересекает заметный порог.
2. Режиссёр выбирает тематическую фракцию.
3. Создаётся предложение с достижимыми условиями.
4. Принятие создаёт `asset_contracts`.
5. Выполнение создаёт отчёт или эхо.

### Сценарий C: снабжение с происхождением

1. В каталоге появляется ограниченная партия.
2. Предмет связан с поставщиком и одной скрытой особенностью.
3. Покупка создаёт факт происхождения.
4. После нескольких применений или подходящего разговора раскрывается хвост.

## 17. Этапы реализации

### Этап 1

- таблицы `story_threads`, `event_opportunities`, `event_instances`, `world_facts`;
- репозитории;
- доменные сигналы;
- authored-шаблоны без LLM;
- UI входящих;
- сценарий обещания.

### Этап 2

- контракты из состояния;
- событийное снабжение;
- scoring и бюджет внимания;
- простые эхо-события;
- повторяющиеся внешние персонажи.

### Этап 3

- LLM-конкретизация сообщений;
- эпизодические NPC и promotion;
- карта станции и travel-канал;
- противоречивые архивные факты;
- развитие нитей несколькими шаблонами.

## 18. Критерии качества

Система работает, если:

- игрок обычно понимает, почему событие появилось сейчас;
- событие ссылается на реальное действие, состояние или разговор;
- игнорирование не ломает кампанию;
- лабораторный процесс не прерывается в критический момент;
- персонаж может вернуться к обещанию спустя игровое время;
- один набор шаблонов даёт разные последовательности;
- LLM не может самовольно изменить механику или канон;
- после 10 игровых дней открытых нитей остаётся мало и они различимы;
- повторная кампания создаёт другой порядок событий без потери логики.
