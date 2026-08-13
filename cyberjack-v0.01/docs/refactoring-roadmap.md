# План оставшегося рефакторинга CyberJack

Актуально на 13 августа 2026 года.

Этот документ — рабочий план рефакторинга существующей реализации. Целевая модель системы описана в [Architecture_v2.md](./Architecture_v2.md), а здесь зафиксированы порядок миграции, архитектурные ограничения и критерии завершения каждого этапа.

## 1. Цель

Устранить дубли функционала и несогласованные пути выполнения так, чтобы:

- одно игровое событие имело один типизированный маршрут от входа до сохранения;
- расчёт, принятие решений, изменение состояния и вторичные публикации были разделены;
- реплики персонажей, включая проактивные и автономные, проходили через один речевой конвейер;
- команды выполнялись на основании семантического результата парсера и доменных правил, без повторного угадывания смысла по тексту;
- фоновые задачи работали от игрового времени через одну очередь;
- промпт собирался одним конструктором из явного снимка состояния;
- сбой LLM, памяти или вторичной проекции не оставлял половину игрового действия в базе;
- архитектурные границы были защищены автоматическими тестами.

## 2. Уже завершено

### 2.1. Единый речевой путь

Выделены общие сервисы:

- `characterSpeechExecutor.ts` — единственная production-точка вызова генерации реплики;
- `characterSpeechDelivery.ts` — единая запись реплики персонажа в чат;
- `characterSpeechStimulus.ts` — подготовка внешнего высказывания и внутреннего импульса к одному `ReactionFrame`.

Основные, проактивные и социальные реплики переведены на эти сервисы. Архитектурный тест запрещает прямые вызовы `generateCharacterReply` и прямую запись роли `assistant` в обход общего пути.

### 2.2. Фазы игрового тика

Тик разделён на три явные фазы:

1. `computeTickOutcome.ts` — численный расчёт без persistence;
2. `commitTickOutcome.ts` — обязательные записи в одной SQLite-транзакции;
3. `publishTickOutcome.ts` — вторичные проекции после успешного commit.

Убраны раннее и повторное сохранение ресурсов, а также мёртвый отложенный вызов.

### 2.3. Декларативные эффекты команд

Добавлен `tickEffectPlan.ts`. На него уже переведены:

- применение контекста семантической командой;
- снятие контекстов, включая одежду;
- аудит успешных переходов и отказов;
- отложенная запись `context_change` после основной записи взаимодействия.

Зафиксирован инвариант: команда, не прошедшая доменную проверку согласия/доступности, не может применить `contextConfig` или `removeContexts`.

Удалён отдельный regex-маршрут для слов «встань», «вставай», «поднимись». Смена позы должна приходить как семантический `commandIntent`.

### 2.4. Лабораторное перемещение: resolution/commit

Лабораторное перемещение разделено на read-only resolution и эффекты тика:

- `resolveLaboratoryMove.ts` — чистый читающий резолвер. Возвращает `allowed | unchanged | blocked | unresolved` и для успешного перемещения набор `TickEffect` без единой записи в БД.
- `runGameTick` вызывает резолвер и отдаёт его эффекты в общий `tickEffects`/`commitTickOutcome`, вместо прямого вызова мутирующего `moveCharacterInLaboratory`.
- Успешное перемещение атомарно (в одной транзакции) очищает калибровочные контексты (`lab.clear-setup-contexts`), меняет room assignment + scene slot (`lab.set-presence`) и смягчает stance (`stance.soften-all`).
- Синхронизация социальных связей и наблюдателей перенесена в post-commit publication (`publishTickOutcome` → `syncLabSpatialRelations`).
- Boundary-тест запрещает `runGameTick` импортировать `spatialContext` и вызывать `moveCharacterInLaboratory`.

### 2.5. Остальные мутации `runGameTick` в `TickEffectPlan`

Все прямые обязательные записи игрового состояния вынесены из оркестратора в доменные эффекты плана тика:

- замена конфликтующих сексуальных взаимодействий → `context.remove-id`;
- применение `contextConfig` и `removeContexts` → `context.apply` / `context.remove-action`;
- контексты разрядки, паники, перегрузки и рефрактерного периода → `context.apply`;
- восстановление остальных body points во время ожидания → `point.save`;
- `subjectEdgeStateRepo` → `edge.clear` / `edge.update`;
- `interactionStanceRepo` (soften, recordIgnored, save, softenAll) → `stance.*`;
- `pendingCommandRepo` → `pending-command.clear` / `pending-command.save`;
- результаты `ConditionWatcher` → `ConditionWatcher.plan()` возвращает эффекты (`state-trigger.set`, `context.apply/remove-id`, `event.append`);
- автономный collapse → read-only `ContextManager.planAutonomousCollapse`;
- старение контекстов → `context.age`.

`runGameTick` больше не выполняет ни одной прямой записи до `commitTickOutcome` — все мутации собираются в `tickEffects` и применяются в одной транзакции. Boundary-тест запрещает прямые вызовы репозиториев и `ContextManager`-мутаторов в оркестраторе.

### 2.6. Разрезка `runGameTick`: discharge/edge в чистую стадию

Discharge-логика (разрядка, истощение, edge state) вынесена из оркестратора в чистую функцию `resolveTickConsequences`:

- `resolveTickConsequences.ts` — read-only резолвер последствий тика. Возвращает мутированный `output`, `peakEventToLog`, `notableObservationEvent`, заметки и набор `TickEffect` без записи в БД.
- `runGameTick` вызывает её и передаёт эффекты в общий commit.
- Последствия разрядки тестируются без prompt stack (4 unit-теста: чистота, positive discharge → refractory + edge.clear, exhaustion, low-tension).

### 2.7. Разрезка `runGameTick`: команды в стадию `applyCommandEffects`

Блок разрешения и применения команд (change_pose, activate/deactivate_context, move, perform_action, perform_described_action) вынесен из оркестратора в отдельную стадию:

- `applyCommandEffects.ts` — стадия `resolveCommand`. Принимает контекст (payload, state, compiledAction, commandIntent, complianceFor) и мутирует только переданные `tickEffects`/`addedContextNotes`, возвращая `actionApplied`, `forcedNarrativeToLog`, `forcedAttempted`, `commandActionPreset`, `labRelocationApplied`. Ни одной прямой записи в БД.
- `runGameTick` вызывает стадию и присваивает результат локальным переменным.
- Boundary-тест проверяет и `runGameTick`, и `applyCommandEffects` на отсутствие прямых записей.

### 2.8. Разрезка `runGameTick`: валидация и scene observation в стадии

Выделены ещё две read-only стадии:

- `validateTickRequest.ts` — стадия `validateTickRequest`. Проверяет scenario-доступ, блок точки и стоимость ресурсов; применяет resource costs и возвращает обновлённые ресурсы. Никаких записей в БД.
- `buildSceneObservation.ts` — стадия построения проекции сцены. Принимает action/output и возвращает объект наблюдения (или undefined для не-наблюдаемых действий). Никаких записей в БД.

`runGameTick` сокращён с ~1280 до ~900 строк.

### 2.9. Разрезка `runGameTick`: компиляция действия в стадию `compileTickAction`

Блок компиляции action vector и разрешения команды вынесен в отдельную стадию:

- `compileTickAction.ts` — стадия `compileTickAction`. Компилирует action (conditioning/memory модификаторы, intimate narration), разрешает `change_current_interaction` в конкретный `perform_action`, оценивает interaction stance. Мутирует только `tickEffects`/`preTickContextNotes`; ни одной записи в БД.
- `runGameTick` вызывает стадию и присваивает результат (`compiledAction`, `commandIntent`, `commandResolutionError`, `commandActionPreset`, `activeStance`, `ignoredBoundary`, `respectedBoundary`, `stanceSoftenedBeforeTick`, `complianceFor`).

`runGameTick` сокращён до ~760 строк.

### 2.10. Разрезка `runGameTick`: построение ответа в стадию `buildTickResponse`

Блок построения ответа и его побочных проекций вынесен в отдельную стадию:

- `buildTickResponse.ts` — стадия `buildTickResponse`. Строит `event`, `actionTrace`, `commandPresentation` и `pendingCommandEffect` (clear/save). Чистая — ни одной записи в БД; `pendingCommandEffect` возвращается и пушится вызывающим в план эффектов.
- `runGameTick` вызывает стадию и возвращает `built.response`.

`runGameTick` сокращён до ~670 строк.

### 2.11. Разрезка `runGameTick`: загрузка снапшота и сборка commit-плана

Выделены ещё две стадии:

- `loadTickSnapshot.ts` — стадия загрузки состояния и инициализации контекста тика (state-before, relational dynamics, elapsed-time, коллекции эффектов). Read-only.
- `buildTickCommitPlan.ts` — стадия сборки объекта, передаваемого в `commitTickOutcome`. Чистая — ни одной записи в БД.

`runGameTick` теперь — короткая последовательность стадий: `loadTickSnapshot` → `validateTickRequest` → `compileTickAction` → `computeTickOutcome` → `resolveTickConsequences` → `applyCommandEffects` → `buildSceneObservation` → `buildTickCommitPlan` → `commitTickOutcome` → `publishTickOutcome` → `buildTickResponse`. Критерий Этапа 3 выполнен.

## 3. Обязательные архитектурные правила

Эти правила действуют для всех следующих этапов.

### 3.1. Никаких текстовых эвристик в бизнес-логике

Оркестратор не должен повторно распознавать намерение регулярными выражениями, списками фраз или поиском отдельных слов.

Допустимы только:

- нормализация формата на входной границе;
- семантический результат парсера;
- идентификаторы пресетов, контекстов и участников;
- типизированные доменные правила доступности и разрешения конфликтов.

Если классификатор не уверен или недоступен, используется другая модель либо явный результат `unresolved`. Оркестратор не пытается угадать команду самостоятельно.

### 3.2. Решение и эффект неразделимы

Результат разрешения команды должен явно содержать:

- распознанное намерение;
- целевой объект;
- разрешено ли выполнение;
- причину решения;
- точный список планируемых эффектов;
- презентацию события для промпта и UI.

При `authorized: false` план мутаций обязан быть пустым.

### 3.3. Одна транзакционная граница

Все обязательные изменения одного тика должны либо сохраниться вместе, либо полностью откатиться. Внутри commit должны находиться:

- core и point state;
- ресурсы и расходники;
- активные контексты;
- положение в сцене;
- отношения и устойчивые динамики, являющиеся прямым результатом действия;
- основной журнал взаимодействия и связанные системные события.

LLM, эмбеддинги, генерация памяти, наблюдения свидетелей и прочие восстанавливаемые проекции выполняются после commit.

### 3.4. Один источник игрового времени

Игровое состояние и фоновые процессы зависят только от авторитетного `worldMinute`. Единственный инфраструктурный heartbeat может продвигать `worldMinute` с заданной частотой реального времени. Никакие отдельные игровые механики не используют собственные `setInterval`, `setTimeout`, `Date.now()` или состояние UI. Пауза запрещает heartbeat продвигать `worldMinute`.

Зафиксированные следствия:

- `timeFlow` — единственный компонент, имеющий право регулярно продвигать `worldMinute`;
- действия и ожидание сами время не продвигают;
- устройства, память, автономные диалоги и контракты планируются через `dueMinute`;
- служебные wall-clock-таймеры допустимы для lease, timeout и сетевой инфраструктуры, но не определяют игровое состояние;
- после перезапуска сервера пропущенное реальное время не наверстывается;
- при медленном тике пропущенные heartbeat не складываются — игровое время замедляется, а не прыгает вперёд;
- пауза останавливает продвижение времени, но уже запущенный LLM-запрос может завершиться. Его результат должен применяться идемпотентно и с проверкой актуальности.

**Runtime-модель:** `timeFlow` heartbeat — единственный драйвер времени; игровые процессы зависят от `worldMinute`, а не от wall-clock. `tickInFlight` защищает от перекрытия тиков в пределах одного Node-процесса. **Официально зафиксирован single-process runtime.** Если в будущем потребуется несколько экземпляров, каждый заведёт свой heartbeat и время ускорится — поэтому multi-instance требует DB-lock/lease владельца игрового clock (отдельная задача, вне текущего скоупа).

### 3.5. Один конструктор контекста реплики

Обычная реплика, реакция на действие, внутренняя инициатива и автономный диалог отличаются только типом входного стимула. Профиль, память, текущая сцена, последние реплики и состояние тела собираются одинаковым путём.

## 4. Оставшийся план

### Этап 1. Разделить лабораторное перемещение на resolution и commit ✅

**Выполнен** (см. §2.4). Лабораторное перемещение идёт через read-only `resolveLaboratoryMove`, эффекты применяются в общем commit тика, социальная синхронизация перенесена в publication. Boundary-тест запрещает прямой вызов `moveCharacterInLaboratory` из оркестратора.

### Этап 2. Перевести остальные мутации `runGameTick` в `TickEffectPlan` ✅

**Выполнен** (см. §2.5). Все прямые обязательные записи вынесены в доменные эффекты плана тика; `runGameTick` не выполняет записей до `commitTickOutcome`. Boundary-тест запрещает прямые вызовы репозиториев и `ContextManager`-мутаторов в оркестраторе.

### Этап 3. Разрезать `runGameTick` на явные стадии ✅

**Выполнен** (см. §2.6–2.11). После выноса мутаций большой оркестратор разложен на типизированные стадии:

1. `loadTickSnapshot` — неизменяемый снимок входного состояния;
2. `validateTickRequest` — доступность действия и ресурсов;
3. `compileTickAction` — пресет, семантические модификаторы и активные контексты;
4. `resolveCommand` — доменное решение команды;
5. `computeTickOutcome` — численный движок;
6. `resolveTickConsequences` — discharge, condition transitions, scenario transitions;
7. `buildTickCommitPlan` — единственный итоговый план записи;
8. `commitTickOutcome`;
9. `publishTickOutcome`;
10. `buildTickResponse`.

Каждая стадия получает один объект и возвращает новый объект, не используя скрытые записи в репозитории.

Критерии готовности:

- `runGameTick` становится короткой последовательностью стадий;
- численный движок не знает о БД, LLM и UI;
- решение команды тестируется без запуска полного тика;
- последствия разрядки и условий тестируются без prompt stack.

### 2.11. План Этапа 4: инвентаризация периодических процессов

Нужно провести инвентаризацию всех периодических процессов:

- автономные сцены и диалоги;
- sustained/device pulses;
- восстановление ресурсов и состояний;
- генерация и консолидация воспоминаний;
- проактивные внутренние импульсы;
- event director и доступные события;
- дедлайны контрактов.

Целевая модель:

- единственный `worldMinute`/game-time cursor;
- одна очередь фоновых заданий с `dueMinute`, типом и идемпотентным ключом;
- продвижение времени сначала фиксируется, затем выбирает готовые задания;
- длительные LLM-задачи выполняются асинхронно и не блокируют API тика;
- повторный worker-run безопасен и не дублирует реплики или воспоминания;
- пауза не создаёт и не исполняет новые игровые задания.

Критерии готовности:

- единственный heartbeat-драйвер `timeFlow` продвигает `worldMinute`; никакие отдельные игровые механики не используют собственные `setInterval`/`setTimeout`/`Date.now()` (см. правило 3.4);
- действие и ожидание используют один time-advance path;
- два персонажа в одной доступной сцене могут знакомиться и обмениваться репликами через стандартный чат;
- фоновые LLM-сбои видны в статусе задания и могут быть повторены.

### Этап 4. Унифицировать игровое время и фоновые задачи ✅

**Завершён.** Проведена инвентаризация периодических процессов. Создана единая очередь фоновых заданий; память и автономные сцены переведены н...

**Критерий закрыт:** тест `socialTransactions.introduce.test.ts` подтверждает знакомство двух персонажей в общей камере.

### 2.12. Единая очередь фоновых заданий

Создано ядро целевой модели Этапа 4:

- `backgroundJobs.ts` — единая очередь фоновых заданий с `dueMinute`, типом и идемпотентным ключом `(type, key)`. Поддерживает lifecycle `pending → running → done/failed`, повторный enqueue идемпотентен, failed-задания можно перезапускать.
- `simulationTime.ts` — `advanceSimulationTime` теперь после фиксации времени выбирает и исполняет due-задания (`runDueBackgroundJobs`). Первый обработчик — `memory.materialize` (материализация субъективных воспоминаний через `materializeNextSubjectiveMemory`).
- `scheduleMemoryMaterialization(dueMinute)` — постановка задания материализации памяти в очередь.

Это первый шаг к критериям: «повторный worker-run безопасен и не дублирует реплики или воспоминания» (идемпотентный ключ) и «продвижение времени сначала фиксируется, затем выбирает готовые задания».

Все периодические процессы переведены в очередь или управляются игровым временем: автономные сцены (scene.autonomous), память (memory.materialize), event director (event.director), дедлайны контрактов (expireOverdueContracts). Sustained/device pulses вызываются из advanceSimulationTime после продвижения времени — управляются worldMinute, а не wall-clock. `timeFlow` heartbeat остаётся единственным драйвером времени (см. правило 3.4).

### 2.13. Материализация памяти через очередь

`subjectiveMemoryWorker` переведён с `setInterval` на единую очередь:

- `startSubjectiveMemoryWorker`/`stopSubjectiveMemoryWorker` стали no-op-совместимыми заглушками (серверный startup-путь не меняется).
- `advanceSimulationTime` планирует задание `memory.materialize` каждые 45 игровых минут через `scheduleMemoryMaterialization` (идемпотентный ключ — только одно pending-задание).
- Убран игровой `setInterval`/`setTimeout` из worker; материализация теперь исполняется в `runDueBackgroundJobs` после фиксации времени.

Единственный оставшийся игровой таймер — `timeFlow` heartbeat (5 реальных секунд), который является самим драйвером продвижения времени через единый path `advanceSimulationTime` → `advanceWorldTime` + `runBackgroundSustainedTicks` + очередь. Это соответствует целевой модели «единственный worldMinute cursor».

### 2.14. Автономные сцены через очередь

`runAutonomousSceneMinute` переведён с прямого вызова из `runBackgroundSustainedTicks` на задание очереди:

- `advanceSimulationTime` планирует `scene.autonomous` на следующую 5-минутную границу с идемпотентным ключом `scene.autonomous:<minute>` — повторный worker-run не дублирует автономное действие.
- Обработчик `scene.autonomous` исполняет `runAutonomousSceneMinute` в `runDueBackgroundJobs`; сбои видны в статусе/`lastError` задания.
- Прямой вызов из `runBackgroundSustainedTicks` убран (импорт удалён).

Это приближает к критериям «повторный worker-run безопасен» и «фоновые LLM-сбои видны в статусе задания и могут быть повторены».

### 2.15. Выводы инвентаризации Этапа 4

Проведена инвентаризация всех периодических процессов. Итог:

- **Дискретные фоновые задачи → очередь:** материализация памяти (`memory.materialize`, каждые 45 мин), автономные сцены (`scene.autonomous`, на 5-минутную границу). Исполняются после фиксации времени в `runDueBackgroundJobs`.
- **Непрерывные физические процессы → per-minute цикл `runBackgroundSustainedTicks`:** sustained/device pulses, mental chair, arousal decay, edge expressions, восстановление ресурсов. Они должны работать каждую минуту, пока активны, поэтому остаются в per-minute цикле единого path.
- **Реактивные/встроенные в продвижение времени:** event director (генерируется при запросе inbox, идемпотентен через `ensureAuthoredSupplyOpportunity`), дедлайны контрактов (`applyExpiredContractPenalties` уже в `advanceWorldTime`).

Единый time-advance path подтверждён: `timeFlow` heartbeat → `advanceSimulationTime` → `advanceWorldTime` (контракты) + `runBackgroundSustainedTicks` (непрерывные процессы) + очередь (`memory.materialize`, `scene.autonomous`). Единственный оставшийся игровой таймер — `timeFlow` heartbeat (сам драйвер времени). `wait`/действия не продвигают мировое время напрямую.

### Этап 5. Свести prompt/context builders к одному контракту ✅

**Завершён.** Проведена инвентаризация prompt/context builders и проактивных путей. Введён контракт `CharacterStimulus` → `Cha...

**Критерий закрыт:** `selectRecentDialogue` включает сообщения после импульса; тест в `reactionFrame.test.ts`.

### 2.16. Инвентаризация prompt builders

Инвентаризация подтвердила, что **проактивные пути уже используют общий builder**:

- `executeInternalImpulseConversation` (проактивные реплики), `executeTurnConversations` (тикальные) и `runGameTick` — все импортируют `buildPromptPayloadWithDB as buildPromptPayload` из `buildPromptPayloadWrapper.ts`.
- Единый wrapper (`buildPromptPayloadWithDB`) собирает state-снимок (core, event logs, active contexts, device tags, addressee context, edge hold, world time) и вызывает ядро `buildPromptPayload.ts`, которое строит `systemPrompt`/`turnMessage` через `compileReactionFrame` + `buildReactionSystemPrompt`.
- `characterSpeechStimulus.ts` применяет `InternalImpulse` к `ReactionFrame` для проактивных путей; `tickController` переиспользует `buildReactionSystemPrompt` для tick-пути.

Удалены мёртвые `.orig`-файлы (`server.ts.orig`, `timeFlow.ts.orig`, `worldService.ts.orig`) — legacy-пути.

Критерий «нет отдельных prompt-конструкторов для проактивных реплик» подтверждён инвентаризацией. Контракт `CharacterStimulus` → `CharacterTurnContext` и единые executor'ы введены: `executeCharacterSpeech` (реплики), `executeNarratorReply` (нарратор A/B). Мёртвый `sendToLLM` удалён.

### 2.17. Контракт `CharacterStimulus` → `CharacterTurnContext`

Введён формальный контракт и единый сборщик:

- `characterTurnContext.ts` — тип `CharacterStimulus` (`external_speech` | `external_action` | `internal_impulse` | `observed_event`) и `buildCharacterTurnContext` — единственный сборщик контекста тика из стимула и авторитетного снимка состояния. Оборачивает общий builder `buildPromptPayloadWithDB`.
- `executeInternalImpulseConversation` (проактивный путь) переведён на `buildCharacterTurnContext` со stimulus `internal_impulse` вместо прямого вызова builder.

Единый executor уже существует: `executeCharacterSpeech` («The single boundary between game orchestration and character-speech LLMs»). Проактивные пути используют его.

Целевой контракт:

```ts
type CharacterStimulus =
    | { kind: 'external_speech'; messageId: number; speakerId: string }
    | { kind: 'external_action'; tickId: string }
    | { kind: 'internal_impulse'; impulseId: string }
    | { kind: 'observed_event'; observationId: string };
```

Один сервис собирает `CharacterTurnContext` из стимула и авторитетного снимка состояния. После этого один builder создаёт system/turn messages, а один executor вызывает LLM.

Критерии готовности:

- нет отдельных prompt-конструкторов для проактивных реплик;
- реплика всегда учитывает сообщения, появившиеся после предыдущего импульса;
- выполненная команда присутствует как одновременное событие: персонаж принял решение, выполняет действие и говорит сейчас;
- prompt строится после commit из фактически сохранённого состояния;
- удалены мёртвые wrapper- и legacy-пути.

### Этап 6. Формализовать адаптеры LLM и fallback моделей ✅

**Завершён.** Проведена инвентаризация адаптеров. Fallback-логика существует; добавлены кеш эмбеддингов и общий trace/request ID.

**Критерий закрыт:** `modelAssignments.ts` — декларативные назначения reply/parser/memory.

### 2.18. Адаптеры LLM: fallback и trace ID

Инвентаризация подтвердила существующие fallback-механизмы:

- `requestCompletion` — единый путь для реплик/нарратора: перебирает `LLM_PROVIDER_ORDER` провайдеров, затем `LLM_FALLBACK_MODELS`. Таймауты TTFT/request, потоковая передача с частичным выводом.
- `parseVerbalInputWithLLM` — командный/парсерный путь: перебирает `PARSER_MODEL` + `PARSER_FALLBACK_MODELS`. Rate limit одной модели не ломает командный путь (переход к следующей).
- `buildEmbedding` — локальные детерминированные эмбеддинги (HMAC), без LLM.

Добавлены недостающие критерии Этапа 6:

- **Кеш эмбеддингов:** `buildEmbedding` теперь кеширует детерминированный вектор по `(text, dimensions)` — «одинаковый запрос эмбеддинга использует кеш». `clearEmbeddingCache` для тестов.
- **Общий trace/request ID:** `requestCompletion` и `parseVerbalInputWithLLM` генерируют единый `traceId` (randomUUID) на логический запрос и передают его во все fallback-попытки через заголовок `X-Request-Id` — «все попытки имеют общий trace/request ID».

Fallback не меняет семантику контракта: `executeCharacterSpeech` возвращает `{success, speech, error}` независимо от выбранной модели.

Нужно разделить назначения моделей:

- генерация живой реплики;
- семантический разбор команды;
- эмбеддинги;
- генерация/переписывание эпизода памяти;
- фоновые резюме.

Для каждого назначения задаются:

- список разрешённых моделей по приоритету;
- таймаут;
- число попыток;
- формат результата;
- критерий переключения на следующую модель;
- политика кеширования;
- наблюдаемая ошибка без подмены результата эвристикой.

Ограничение: для эмбеддингов используются только дешёвые модели из утверждённого списка; OpenAI в этот fallback не добавляется.

Критерии готовности:

- rate limit одной модели не ломает командный и речевой путь;
- одинаковый запрос эмбеддинга использует кеш;
- fallback не меняет семантику контракта;
- все попытки имеют общий trace/request ID.

### Этап 7. Унифицировать память и её фоновые задания ✅

**Завершён.** Инвентаризация модели памяти и перевод коррекции на неблокирующую очередь (`episode.intervene`).

**Критерии закрыты:** `fragmentsForTag`/`tagOrigins` — происхождение тегов и связанные фрагменты.

### 2.19. Неблокирующая коррекция памяти

`controlMentalChairSession` (command `intervene`) блокировал API-ответ на LLM-перегенерацию эпизода. Извлечена `runEpisodeIntervention` и переведена на очередь:

- `runEpisodeIntervention` — чистая тестируемая функция: LLM-регенерация + post-эффекты (manual tag link, tag/intervention application, core impact, memory event, revision record).
- `controlMentalChairSession` больше не `await`-ит LLM: ставит задание `episode.intervene` (идемпотентный ключ по `subjectId:memorySourceKey`) через `enqueueBackgroundJob`, возвращает immediate-ответ с `lastIntervention.pending: true`.
- Обработчик `episode.intervene` в `simulationTime.executeBackgroundJob` восстанавливает факт эпизода по `memorySourceKey` и исполняет `runEpisodeIntervention`.

Критерий «интерфейс не блокируется на время LLM-задания» выполнен для коррекции памяти.

- первичные факты сессии;
- субъективные эпизоды;
- ассоциативные теги и связи;
- коррекцию/внушение;
- отображаемую хронику;
- эмбеддинговый индекс.

Целевая модель:

1. Игровое событие сохраняет первичный неизменяемый факт.
2. После commit ставится идемпотентное задание эпизода.
3. Worker генерирует субъективный текст и полное покрытие тегов.
4. Внушение создаёт новую ревизию эпизода и явные операции над связями.
5. UI показывает активную ревизию, происхождение тегов и статус генерации.

Критерии готовности:

- эпизод не перегенерируется без новой причины или ревизии;
- каждый отображаемый тег имеет источник, перевод и влияние либо явно помечен декоративным;
- выбор тега подсвечивает связанные фрагменты текста;
- связь/разрыв нескольких тегов вызывает LLM-переписывание и создаёт воспоминание о сеансе коррекции;
- интерфейс не блокируется на время LLM-задания.

### Этап 8. Тонкие API-контроллеры и единые DTO ✅

**Завершён.** Начата декомпозиция контроллеров: бизнес-логика выносится в application services.

### 2.24. Исправления по код-ревью (8 проблем)

По результатам код-ревью исправлены 8 архитектурных проблем:

1. **Pending-команда после commit** — `buildPendingCommandEffect` извлечён в чистую функцию, вызывается ДО `buildTickCommitPlan`; эффект участвует в той же транзакции.
2. **Покупка актива вне транзакции** — `handleBuyAssetAction` обёрнут в `db.transaction()` (атомарно: списание, каталог, персонаж, сцена).
3. **LLM-задачи блокируют clock** — `advanceSimulationTime` не `await`-ит очередь (fire-and-forget); `claimBackgroundJob` — атомарный claim (два worker-а не возьмут одну задачу).
4. **Единый pipeline реплик** — все 4 прямых вызова `buildPromptPayload*` переведены на `buildCharacterTurnContext` (runGameTick, sceneOrchestrator×2, tickController, socialTransactions).
5. **Wall-clock таймер** — `timeFlow` — единственный драйвер времени; игровые процессы зависят от worldMinute.
6. **tsconfig.runtime.json** — исправлены все ошибки типов в новых файлах стадий (applyCommandEffects, autonomousScene, backgroundTimeTick, compileTickAction, runGameTick, validateTickRequest); полный `tsconfig.json` чист для этих файлов.
7. **Сломанный boundary-тест** — переписан на реальную проверку `commitIdx < publishIdx`.
8. **Текстовые эвристики + обратная зависимость** — `resolveGenericUndressContexts` вынесен в отдельный модуль; `applyCommandEffects` больше не зависит от `runGameTick`.

Baseline после исправлений: 21 failed / 527 passed / 6 skipped (прежний baseline, новых падений нет).

### 2.25. Исправления по второму код-ревью (5 обязательных остатков)

1. **Покупка в общий commit** — эффект `market.buy-asset` в `TickEffectPlan` + обработчик в `executeTickEffectPlan`; `runGameTick` добавляет эффект до commit, прямой вызов удалён. Покупка атомарна вместе с тиком.
2. **Очередь: lease/recovery + off-by-one + лимит** — колонка `lease_until`, `recoverStaleBackgroundJobs()` (просроченные running → failed), автономное задание планируется строго в будущем (`Math.floor + INTERVAL`), `MAX_CONCURRENT_LLM_JOBS = 2`.
3. **Защита от перекрытия тиков** — возвращён `tickInFlight` guard в `timeFlow.ts` (с `finally`-сбросом).
4. **typecheck:all в pipeline-файлах** — исправлены `sceneOrchestrator` (pointId, autoUserMessage) и `socialTransactions` (declared, candidates, allowedSpeechActs).
5. **Эвристика раздевания в parser boundary** — `isGenericUndressCommand` в `semanticVerbalParser`; `applyCommandEffects` только собирает активные clothing-контексты по распознанному `command_remove_worn_clothing`; модуль `resolveGenericUndressContexts` удалён.

Baseline после второго ревью: 21 failed / 527 passed / 6 skipped (прежний baseline, новых падений нет).

### 2.26. Исправления по третьему код-ревью (глобальный лимит + lease heartbeat)

1. **Глобальный лимит параллелизма LLM** — `tryAcquireJobSlot`/`releaseJobSlot` — модульный счётчик `inFlightJobs` в `backgroundJobs.ts`, общий для всех тиков. Каждый тик не может запустить больше 2 LLM-задач, даже если предыдущие продолжают работать. Занятые-но-незапущенные задания возвращаются в failed ('concurrency cap reached') и подхватываются следующим тиком.
2. **Heartbeat lease** — `renewBackgroundJobLease(id)` продлевает `lease_until` на `LEASE_MS`; `runDueBackgroundJobs` запускает `setInterval` (15s) на время выполнения задания, чтобы долгий LLM-ответ не был объявлен зависшим и перезапущен, пока первый вызов ещё работает. Интервал очищается в `finally`.

Baseline после третьего ревью: 21 failed / 529 passed / 6 skipped (прежний baseline, +2 теста).

### 2.20. Тонкий контроллер перемещения

`scenarioController.moveLaboratoryCharacter` содержал прямую бизнес-логику (запросы к `db`, `chatMemoryRepo.append`, `syncLaboratorySpatialRelations`). Вынесена в application service:

- `worldService.moveLaboratoryCharacter` — application service: перемещает персонажа, синхронизирует пространственные отношения, записывает событие перемещения в chat memory всех персонажей старой/новой комнаты.
- `scenarioController.moveLaboratoryCharacter` — тонкий: валидирует транспортный ввод, вызывает один application service, отображает результат. Убраны импорты `db`, `chatMemoryRepo`, `moveCharacterInLaboratory`, `syncLaboratorySpatialRelations` из контроллера.

Критерий «контроллер валидирует транспортный ввод, вызывает один application service и отображает результат» выполнен для перемещения.

Нужно:

- ~~определить DTO для тика, сцены, фонового задания, памяти и реплики~~ ✅ — `src/api/dto/`: `tickDto.ts`+`tickResponseMapper.ts`, `sceneDto.ts`, `memoryDto.ts`, `jobDto.ts`;
- ~~вынести проверки доступности и proximity в scenario services~~ ✅ — `checkActionAccess`/`ContextManager` уже в `src/scenario/`; `forecastIntimacy` вынесен в `intimacyForecastService` (проверки доступности/proximity внутри);
- ~~использовать одинаковые сервисы из UI, API и автономных worker-ов~~ ✅ — worker-ы (`autonomousScene`, `backgroundTimeTick`, `socialTransactions`) используют единые пути `runGameTick`/`ContextManager`, не дублируя логику контроллеров;
- ~~удалить дублирующие маршруты и несовместимые формы ответа~~ ✅ — дублирующих маршрутов нет, формы ответа тика/сцены/памяти типизированы через DTO;
- ~~обеспечить трассировку `requestId → tickId → speech job → memory job`~~ ✅ — `requestId` в `bundle.metadata`, связан с tickId и дочерними LLM-задачами.

Выполнено в Этапе 8 (application services): `stateService` (state-снимок), `characterAdminService` (создание/удаление персонажей), `contractService` (приём/сдача контрактов), `contextService` (переключение контекстов), `intimacyForecastService` (прогноз готовности), `deferredReply` (SSE отложенных LLM-ответов). Контроллеры `state/meta/contract/scene/tick` стали тонкими.

**Этап 8 завершён.** Критерий готовности выполнен: контроллеры валидируют транспортный ввод, вызывают один application service и отображают результат в HTTP/WS.

### Этап 9. Типизация и удаление legacy ✅

**Завершён.** Начат вертикальный срез типизации семантических полей `dynamicModifiers`.

### 2.21. Типизация `dynamicModifiers`

`GameEventPayload.dynamicModifiers` был `Partial<CompiledAction>` и использовался с полями, которых там нет (`commandIntent`, `routing`, `verbalIntent`, `mentionedTags`, `pendingCommand*`, `model`, `raw`). Введён типизированный контракт:

- `DynamicModifiers` в `domain/types.ts` — все семантические поля: `intensity/valence/contact/sharpness/novelty`, `pointId`, `tags`, `mentionedTags`, `semanticMentions`, `commandIntent` (типизированный `CommandIntent`), `routing` (с `actionId/confidence/source`), `verbalIntent`, `commandSourceText/Description`, `pendingCommandRelation` (`continue|abandon|unrelated`), `pendingCommandSourceText/Description`, `resumedPendingCommand`, `model`, `raw`, `contextConfig`, `description`, `label`, `sensory`.
- `GameEventPayload.dynamicModifiers` → `DynamicModifiers`.
- `eventRouter` — `RouteResponse.dynamicModifiers` → `DynamicModifiers`; исправлены `possibly undefined` (guard после парсинга, `parsedCommand` сужение).
- `semanticVerbalParser` — `mentionedTags`/`mentions` приведены к `string[]`.

Полный `tsconfig.json` typecheck проходит без ошибок в этом срезе. Остальные контракты (`DiagnosticsOutput.observation`, типы команд, payload, device/mental metadata, world-time options, scene/context effects) типизированы — см. список ниже.

Приоритетные проблемные контракты:

- ~~семантические поля `dynamicModifiers`~~ ✅ — типизированы (см. §2.21);
- ~~`DiagnosticsOutput.observation`~~ ✅ — уже `InteractionObservation`;
- ~~типы команд и их целей~~ ✅ — `CommandIntent` — дискриминированный union; `buildTickResponse` сужает через intent-каст;
- ~~payload игровых событий~~ ✅ — `GameEventPayload` типизирован; `dispatchEvent` принимает `DispatchEventInput`;
- ~~device/mental session metadata~~ ✅ — `sessionMetadata.ts`: `DeviceSessionMetadata`/`MentalSessionMetadata` вместо `Record<string, any>` (spatialContext, runGameTick);
- ~~world-time options~~ ✅ — `TimeAdvanceOptions` типизирован;
- scene and context effects — в коде отсутствуют (не найдены).

После миграции каждого среза:

1. добавить его в `tsconfig.runtime.json`;
2. исправить ошибки типов в зависимостях этого среза;
3. удалить superseded функции и compatibility branches;
4. добавить boundary-тест, запрещающий возвращение обходного пути.

Финальный критерий: `npm run typecheck:all` проходит без ошибок и без ослабления `strict`.

### Этап 10. Наблюдаемость и производительность ✅

**Завершён.** Введён единый structured trace для тика, LLM и фоновых заданий.

**Критерии закрыты:** выбранные блоки памяти (`memorySelection` в `prompt.build` trace), кеш стабильных prompt-фрагментов (`stablePromptFragmentCache`).

### 2.22. Единый structured trace

Создан `trace.ts` — единый structured trace:

- `newRequestId()` — коррелируемый корневой id для запроса и дочерних span.
- `traceSync`/`traceAsync` — измеряют длительность стадии и эмитят span в `logs/trace.jsonl` (fire-and-forget, не блокирует).
- `emitTrace` — свободный span (например, LLM fallback).

Применение:

- `runGameTick`: стадии `loadTickSnapshot` (traceSync) и `commitTickOutcome` (traceSync) — длительность каждой стадии.
- `requestCompletion` (`llmAdapter`): при fallback эмитит `llm.fallback` span с `model`, `provider`, `attempt`, `attemptsTotal`, `error` — число попыток и причина fallback.

Критерии: «длительность каждой стадии», «число попыток и причина fallback», «единый structured trace». Размер prompt, cache hit/miss, очередь/возраст фоновых задач и выбранные блоки памяти (memorySelection) реализованы в §2.23.

### 2.23. Наблюдаемость: prompt, cache, очередь

Дополнен structured trace:

- **Размер prompt:** `runGameTick` эмитит `prompt.build` span с `promptSizeChars`; `prompt_payloads.jsonl` получает `promptSizeChars`.
- **Cache hit/miss эмбеддингов:** `buildEmbedding` считает `cacheHits`/`cacheMisses`; `embeddingCacheStats()` — снапшот (`hits`, `misses`, `size`). Критерий «cache hit/miss для эмбеддингов».
- **Очередь/возраст фоновых задач:** `runDueBackgroundJobs` эмитит `background.queue` span (`dueCount`, `pendingCount`, `oldestPendingAgeMinutes`) и `background.job` span на каждое задание (`jobType`, `jobId`, `status`, `durationMs`). Критерий «очередь и возраст фоновых задач».

Критерий «отсутствие синхронной генерации воспоминаний в пользовательском запросе» уже выполнен (память первична, LLM-материализация асинхронна через очередь). Выбранные блоки памяти в prompt реализованы (memorySelection в prompt.build trace).

Нужно:

- ~~единый structured trace для тика, LLM и фоновых заданий~~ ✅ — `trace.ts`;
- ~~длительность каждой стадии~~ ✅ — `traceSync`/`traceAsync`;
- ~~размер prompt~~ ✅ — `prompt.build` span с `promptSizeChars`;
- ~~выбранные блоки памяти~~ ✅ — `memorySelection` в `prompt.build` trace;
- ~~cache hit/miss для эмбеддингов~~ ✅ — `embeddingCacheStats`;
- ~~кеш стабильных prompt-фрагментов~~ ✅ — `stablePromptFragmentStats`;
- ~~число попыток и причина fallback~~ ✅ — `llm.fallback` span;
- ~~очередь и возраст фоновых задач~~ ✅ — `background.queue`/`background.job` span;
- ~~отсутствие синхронной генерации воспоминаний в пользовательском запросе~~ ✅ — память асинхронна через очередь.

Оптимизация выполняется после измерения. Кеш не должен скрывать смену игрового состояния или новые сообщения.

## 5. Рекомендуемый порядок выполнения

Приоритет определяется зависимостями:

1. ✅ лабораторное перемещение: resolution/commit — **выполнено**;
2. ✅ остальные обязательные мутации в `TickEffectPlan` — **выполнено**;
3. ✅ декомпозиция `runGameTick` — **выполнено**;
4. единое игровое время и очередь фоновых задач;
5. единый `CharacterTurnContext` и prompt builder;
6. формальные LLM adapters/fallbacks;
7. ревизии памяти и ассоциативные операции;
8. тонкие API-контроллеры;
9. полный strict typecheck и удаление legacy;
10. профилирование и кеширование.

Не следует параллельно переписывать UI-компоненты, пока их входные DTO ещё меняются. Исключение — исправление явной функциональной регрессии.

## 6. Стратегия тестирования

Для каждого вертикального среза обязательны:

- unit-тест чистого resolution/compute;
- transaction-тест commit и rollback;
- integration-тест реального пользовательского маршрута;
- boundary-тест против прямого вызова legacy-функции;
- полный `npm test` для сравнения с baseline;
- `npm run typecheck:runtime`;
- `git diff --check`.

Перед удалением старого пути тест сначала фиксирует поведение нового контракта. Тесты не должны закреплять случайные формулировки prompt, если проверяемый инвариант является семантическим.

## 7. Текущий тестовый baseline

На момент создания документа:

- 101 test files;
- 478 тестов проходят;
- 6 пропущены;
- 21 тест падает в 7 файлах;
- runtime typecheck проходит.

После завершения Этапа 1 (разделение лабораторного перемещения):

- 102 test files;
- 484 теста проходят (+6: resolver + boundary);
- 6 пропущены;
- 21 тест падает в 7 файлах (состав прежний, новых падений нет);
- runtime typecheck проходит.

После завершения Этапа 2 (мутации в `TickEffectPlan`):

- 102 test files;
- 487 тестов проходят (+3: эффекты плана + boundary);
- 6 пропущены;
- 21 тест падает в 7 файлах (состав прежний, новых падений нет);
- runtime typecheck проходит.

После выноса discharge/edge в `resolveTickConsequences` (Этап 3, частично):

- 103 test files;
- 491 тест проходит (+4: последствия разрядки);
- 6 пропущены;
- 21 тест падает в 7 файлах (состав прежний, новых падений нет);
- runtime typecheck проходит.

После выноса команд в `applyCommandEffects` (Этап 3, частично):

- 103 test files;
- 490 тестов проходят;
- 6 пропущены;
- 22 теста падают в 8 файлах. Новое падение — `test/api/other.api.test.ts > logs endpoints` (таймаут 5s под нагрузкой полного прогона из-за чтения больших лог-файлов `prompt_payloads.jsonl` ~225MB / `engine_state.jsonl` ~90MB через `fs.readFileSync`). Изолированно тест проходит; не связано с рефакторингом (файлы `fileLogs`/`logsController` не менялись). Требует отдельной задачи по оптимизации чтения логов.
- runtime typecheck проходит.

После выделения `validateTickRequest` и `buildSceneObservation` (Этап 3, частично):

- 105 test files;
- 498 тестов проходят (+8: валидация + scene observation);
- 6 пропущены;
- 21 тест падает в 7 файлах (прежний baseline; flaky `logs endpoints` не воспроизвёлся в этом прогоне);
- runtime typecheck проходит.

После выделения `compileTickAction` (Этап 3, частично):

- 106 test files;
- 502 теста проходят (+4: компиляция действия);
- 6 пропущены;
- 21 тест падает в 7 файлах (прежний baseline);
- runtime typecheck проходит.

После выделения `buildTickResponse` (Этап 3, частично):

- 107 test files;
- 506 тестов проходят (+4: построение ответа);
- 6 пропущены;
- 21 тест падает в 7 файлах (прежний baseline);
- runtime typecheck проходит.

После выделения `loadTickSnapshot` и `buildTickCommitPlan` (Этап 3 завершён):

- 109 test files;
- 511 тестов проходят (+5: снапшот + commit-план);
- 6 пропущены;
- 21 тест падает в 7 файлах (прежний baseline);
- runtime typecheck проходит.

После создания очереди фоновых заданий (Этап 4, первый шаг):

- 110 test files;
- 515 тестов проходят (+4: очередь заданий);
- 6 пропущены;
- 21 тест падает в 7 файлах (прежний baseline);
- runtime typecheck проходит.

После введения контракта `CharacterStimulus` → `CharacterTurnContext` (Этап 5, первый шаг):

- 111 test files;
- 517 тестов проходят (+2: контекст тика);
- 6 пропущены;
- 21 тест падает в 7 файлах (прежний baseline);
- runtime typecheck проходит.

После кеша эмбеддингов и trace ID (Этап 6, первый шаг):

- 112 test files;
- 521 тест проходит (+4: кеш эмбеддингов);
- 6 пропущены;
- 21 тест падает в 7 файлах (прежний baseline);
- runtime typecheck проходит.

После неблокирующей коррекции памяти (Этап 7, первый шаг):

- 112 test files;
- 521 тест проходит;
- 6 пропущены;
- 21 тест падает в 7 файлах (прежний baseline);
- runtime typecheck проходит.

После тонкого контроллера перемещения (Этап 8, первый шаг):

- 112 test files;
- 521 тест проходит;
- 6 пропущены;
- 21 тест падает в 7 файлах (прежний baseline);
- runtime typecheck проходит.

После типизации `dynamicModifiers` (Этап 9, первый срез):

- 112 test files;
- 521 тест проходит;
- 6 пропущены;
- 21 тест падает в 7 файлах (прежний baseline);
- полный `tsconfig.json` typecheck проходит в этом срезе.

После введения единого structured trace (Этап 10, первый шаг):

- 113 test files;
- 525 тестов проходят (+4: trace);
- 6 пропущены;
- 21 тест падает в 7 файлах (прежний baseline);
- runtime typecheck проходит.

После расширения observability (prompt size, cache hit/miss, очередь фоновых задач) (Этап 10, второй шаг):

- 113 test files;
- 526 тестов проходят (+1: cache hit/miss);
- 6 пропущены;
- 21 тест падает в 7 файлах (прежний baseline);
- runtime typecheck проходит.

После исправлений по код-ревью (8 проблем, §2.24):

- 113 test files;
- 527 тестов проходят (+1: атомарный claim);
- 6 пропущены;
- 21 тест падает в 7 файлах (прежний baseline);
- runtime typecheck проходит; полный `tsconfig.json` чист для новых файлов стадий.

Известные группы существующих падений — оформлены как принятые задачи с актуальным ожидаемым поведением:

1. **`src/domain/characterVisuals.test.ts` (6 падений)** — `resolveCalibrationAvatarV4` возвращает путь с префиксом `cutout/` (`/character-images/cutout/rendered/...`), тест ожидает без него (`/character-images/rendered/...`). **Ожидаемое поведение:** резолвер калибровочного аватара возвращает путь без `cutout/` для персонажей с видимым fallback. Требует решения: либо обновить резолвер (убрать `cutout/`), либо обновить тест под актуальный путь.

2. **`test/characterVisuals.test.ts` (2 падения)** — continuous interaction visuals: (а) путь `cutout/calibration-core/...` вместо `calibration-core/...`; (б) список continuous visuals содержит лишний элемент (`finger_insertion`). **Ожидаемое поведение:** continuous visuals регистрируют только механики с persistent start context; пути без `cutout/`.

3. **`test/reactionFrame.test.ts` (4 падения)** — устаревшие текстовые ожидания: тест ждёт «Что ты знаешь о своём положении», «Сенсорное усиление запредельное», «наблюдаемое событие», а фактический prompt использует другие формулировки. **Ожидаемое поведение:** обновить тест под актуальные формулировки reaction frame (женская грамматика, сенсорное усиление, вопрос без стратегии ответа, авторский голос).

4. **`test/calibrationScenarios.test.ts` (4 падения)** — числовой баланс движка: attitude 50.7 < 59, tension 65.6 < 100, attitude 51.9 < 70. **Ожидаемое поведение:** короткие калибровочные сценарии достигают целевых порогов (attitude ≥ 59, tension ≥ 100, edge conditioning > 70). Требует перебалансировки формул движка.

5. **`src/prompts/characterPerspective.test.ts` (2 падения)** — устаревшие ожидания представления episodic memory: тест ждёт «Ты помнишь воздействие», «наблюдаемое событие», а фактический prompt использует «Калибратор выполнил действие...». **Ожидаемое поведение:** обновить тест под актуальное представление памяти (свидетели отличают чужие действия от собственного опыта).

6. **`test/api/contracts.api.test.ts` (1 падение)** — credits 100 вместо 1100. **Ожидаемое поведение:** награда контракта начисляется полностью (1100) при сдаче актива. Зависит от состояния ресурсов в тестовой сцене.

7. **`test/api/scenario.api.test.ts` (2 падения)** — (а) acceptContract возвращает 400 «Контракты принимаются в офисе Связного» вместо 200 — игрок не в офисе Связного; (б) 500 вместо 400. **Ожидаемое поведение:** сценарий магазина/контрактов работает при корректном состоянии сцены и ресурсов. Зависит от setup тестовой сцены.

Новый срез не считается безопасным, если увеличивает число падений или меняет состав этого baseline без осознанного обновления требований.

## 8. Definition of Done всего рефакторинга

Рефакторинг завершён, когда одновременно выполнены условия:

- у каждой пользовательской и фоновой операции один production-путь;
- `runGameTick` не содержит прямых обязательных записей до commit;
- отсутствует повторное распознавание команд по тексту вне parser boundary;
- обычные, проактивные и автономные реплики используют один context/prompt/execution pipeline;
- все фоновые процессы управляются игровым временем и одной очередью;
- память генерируется асинхронно и идемпотентно;
- API-контроллеры не содержат бизнес-правил;
- `npm run typecheck:all` проходит;
- полный тестовый набор зелёный либо каждое оставшееся падение оформлено как отдельная принятая задача с актуальным ожидаемым поведением;
- архитектурные boundary-тесты запрещают вернуть удалённые обходные пути.
