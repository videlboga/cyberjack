# ТА-мотивация проактивных социальных ходов (по Берну)

> **Цель:** Заменить статистический выбор проактивного разговора на осмысленную ТА-мотивацию — персонаж начинает взаимодействие потому, что его ведёт сценарий жизни и потребность: знакомится, углубляет связь, перебирает транзакции до комплиментарных, играет в Игры. Убрать пустые/безумные проактивные реплики, которые модель генерирует «из воздуха».

**Архитектура:** Проактивный ход строится цепочкой `autonomousScene` (выбор пары) → `createSocialTurnPlan` (акт/тема/эго/игра) → `prepareCharacterSpeechStimuli` (стимул) → единый конструктор (`buildReactionSystemPrompt`+`buildReactionTurnMessage`). Проблема в том, что решение «зачем говорить» и «о чём» сейчас эвристическое и статистическое, без ТА-мотивации.

---

## Текущее состояние (диагноз)

1. **`autonomousInitiativeProbability`** (autonomousScene.ts) — чисто статистический расчёт (readiness/relation/preference/strokeBoost). Нет «почему».
2. **`chooseTopic`** — при `observed_event` возвращает `{topic:'observed_event'}` **без context** → в промпт попадает «Калибратор тебя потрогал» → модель хватается за системную болтовню.
3. **`createSocialTurnPlan`** — акт выбирается эвристикой (`introduce`/`check_in`/`offer_support`). ТА есть только в `decideGame` (для game-prone) и `deriveEgoAndStroke`.

---

## Принцип: мотив → тема → акт (единая ТА-логика)

Каждый проактивный ход должен пройти три шага:

### Шаг 1: Определить ТА-мотив («зачем я заговорил»)

Новая функция `deriveSocialMotivation(speaker, recipient, relation, social)` возвращает один из типов:

| Мотив | Когда | ТА-обоснование |
|---|---|---|
| `encounter` | familiarity < .12, первая встреча | Познакомиться, первая транзакция, проверка нового |
| `deepen` | familiarity .12–.6, есть связь | Углубить, перебирать транзакции до комплиментарных |
| `game` | game-prone + сработал сценарий | Войти в Игру по своему сценарию |
| `stroke_need` | низкий stroke balance, потребность | Искать признание/одобрение/внимание |

Выбор мотива опирается на уже существующие ТА-данные:
- `familiarity` (из отношения)
- `strokeBalance` / `strokeHunger` (экономика поглаживаний)
- `need` (из `social.stressNeeds[0]`)
- `lifePosition` (жизненная позиция)
- активная/возможная Игра (`decideGame`)

### Шаг 2: Тема = мотив + личный крючок + ситуация

Вместо пустого `observed_event`/бедного `shared_room` — тема с context, который объясняет модели **почему и о чём**:

```
Почему ты заговорила: [мотив-обоснование].
Твой личный крючок: [conversationHook / элемент личной истории].
Ситуация: [что реально вокруг / что ты заметила].
```

Примеры:
- **Суми (encounter, need=connection)**: «Ты замечаешь, что рядом кто-то новенький, и тебе важно, чтобы рядом был свой. Ты хочешь узнать его получше. Твой крючок: тебе легче говорить о телесном — о том, как здесь всё устроено.»
- **Иона (deepen, need=clarity)**: «Ты замечаешь, что этот человек кажется надёжным, и хочешь понять его получше. Ты осторожно делишься наблюдениями, проверяя, насколько можно доверять.»
- **Май (stroke_need)**: «Тебе важно, чтобы тебя замечали. Ты хочешь, чтобы этот человек увидел, какая ты полезная и внимательная.»
- **Мира (game: wooden_leg)**: «Тебе тяжело, и ты хочешь, чтобы кто-то понял, как тебе трудно. Ты осторожно жмёшься к этой теме, ища сочувствия.»

### Шаг 3: Акт согласуется с мотивом

| Мотив | Предпочтительный акт |
|---|---|
| `encounter` | `introduce` |
| `deepen` | `check_in`, `answer_question`, `offer_support` |
| `game` | акт Игры (из `decideGame`) |
| `stroke_need` | `check_in`, `offer_support` (ищет внимание) |

Игра остаётся приоритетной (как сейчас `game.act`), остальное — по мотиву.

---

## Реализация

### Новый файл `src/services/socialMotivation.ts`

Экспортирует:
- `type SocialMotivation = 'encounter' | 'deepen' | 'game' | 'stroke_need'`
- `deriveSocialMotivation(input): SocialMotivation` — выбор по ТА-данным
- `motivationContext(motivation, speaker, recipient, relation, social, observation): string` — текст обоснования для промпта
- `motivationPreferredAct(motivation, egoState, thread): SocialAct` — акт по мотиву

### Изменения в `createSocialTurnPlan` (socialTransactions.ts)

1. Вызвать `deriveSocialMotivation` после получения `relation`, `familiarity`, `deriveEgoAndStroke`.
2. Передать мотив в `chooseTopic` (новый параметр), чтобы тема строилась с мотивацией.
3. Выбор акта: `game.act` → иначе по мотиву.

### Изменения в `chooseTopic`

При `observed_event` и `shared_room`/`shared_cell` — формировать context из мотива + conversationHook + observation, вместо пустого/бедного. Складывать в `source_json.topicContext`.

### Изменения в `autonomousInitiativeProbability`

Добавить вход `socialMotivation` — персонаж с явным мотивом (голод, потребность, готовая Игра) инициирует чаще. Это свяжет выбор пары с мотивацией.

### Разрыв зацикливания

В `shouldContinueConversation`:
- Если та же тема уже была в последних N ходах пары → **сменить мотив/тему** или закрыть разговор.
- Трекать повтор тем в `conversation` state (`source_json.conversation`).

---

## Файлы для изменения

- `src/services/socialMotivation.ts` — новый
- `src/services/socialTransactions.ts` — `createSocialTurnPlan`, `chooseTopic`, `shouldContinueConversation`
- `src/orchestration/autonomousScene.ts` — `autonomousInitiativeProbability`, передача мотива
- Тест: `src/services/socialMotivation.test.ts`

---

## Верификация

- `npx tsc --noEmit` — чисто.
- `npx vitest run` — 620+ тестов зелёные (новые: socialMotivation).
- Проверить лог `social_initiative`: у каждой проактивной реплики есть `[Почему ты заговорила]` с мотивом, а не пустой `observed_event`.
- Убедиться, что циклы (Иона-Эли «динамический режим») разрываются после N повторов.

---

## Риски / открытые вопросы

1. **Объём промпта** — добавление мотивации + крючка увеличивает стимул. Нужно держать сжато (2-3 строки), не раздувая.
2. **Границы мотивов** — пороги familiarity для encounter/deepen можно настраивать.
3. **Игра vs мотив** — Игра (по Берну) бессознательна; мотив `game` не должен «называть» игру в промпте (только drive, как сейчас). В мотиве `game` показываем только естественное влечение.
4. **Не перегрузить** — мотив не должен превращать каждую реплику в объяснение себя; это ориентир для выбора темы/акта, а не текст для цитирования.
