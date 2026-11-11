# Спецификация подключения и расширения interaction-матрицы

Статус: draft v1
Актуальный набор: `public/character-images/interactions-expanded`

## 1. Назначение

`interactions-expanded` — матрица кадров продолжающихся взаимодействий. Она должна показываться только пока активно соответствующее действие или сцена. Это не матрица обычных поз и не источник постоянных предметов экипировки: надетая повязка, кляп или наручники сами по себе не выбирают interaction-кадр.

Три визуальных слоя остаются раздельными:

1. base-avatar — обычная поза, одежда и состояние персонажа;
2. equipment/context — постоянные видимые предметы и ограничения;
3. interactions-expanded — активное продолжающееся действие, имеющее наивысший приоритет среди неаварийных кадров.

Старый `rendered/mira/rmbg_v1` не используется и не является основой этого спека.

## 2. Фактическое состояние набора

Матрица описана в `src/infrastructure/data/visual/interaction-visual-matrix-expanded.json` и содержит:

- 3 персонажа: `mira`, `iona`, `nika`;
- 9 семейств взаимодействий;
- 742 комбинации на персонажа;
- 2226 PNG всего, все ожидаемые файлы присутствуют.

| Семейство | Варианты | Файлов на персонажа |
|---|---|---:|
| `vibration` | `handheld`, `internal`, `machine` | 98 |
| `sex_machine` | `stirrups`, `restrained`, `suspended`, `milking`, `hmd`, `mind_control` | 98 |
| `electrostimulation` | `chair`, `clamps`, `genital`, `tentacles` | 105 |
| `exposure` | `standing`, `sitting_spread`, `spread_eagle`, `covering` | 70 |
| `foot` | `bare_presented`, `pantyhose_presented`, `stocks_tickle` | 29 |
| `oral` | `kneeling`, `deep`, `assisted` | 100 |
| `penetration` | `doggy`, `missionary`, `standing` | 108 |
| `capsule` | `hmd`, `machine`, `electric`, `glory` | 50 |
| `lesbian` | `fingering_kiss`, `facesitting` | 84 |

Ключ файла:

```text
public/character-images/interactions-expanded/{character}/{family}/{variant}/{wardrobe}__{restraint}__{affect}__{phase}.png
```

Оси:

- `wardrobe`: `nude`, `underwear`, `stockings`, `open_top`, `device_outfit`;
- `restraint`: `free`, `wrists`, `spread`, `machine`;
- `affect`: `guarded`, `receptive`, `high_positive`, `high_negative`, `subspace`, `climax`;
- `phase`: `sustain`, `intense`, `peak`.

## 3. Как матрица используется сейчас

Текущая цепочка находится в `src/domain/characterVisuals.ts` и `src/ui/CalibrationPrototype.tsx`:

```text
активные contexts
  → activeVisualInteractionFromContexts()
  → family + variant + phase
  → expandedInteractionAssetPath()
  → wardrobe + restraint + affect
  → interactions-expanded/...png
```

Сейчас `activeVisualInteractionFromContexts()` распознаёт только:

| Контекст | Выбранный кадр |
|---|---|
| `act_start_vibrator` | `vibration/handheld` |
| `act_activate_plug` | `vibration/internal` |
| `act_start_electrostimulation` | `electrostimulation/clamps` либо `electrostimulation/genital` |

`act_adjust_vibration` и `act_adjust_electrostimulation` повышают фазу/интенсивность, но самостоятельно взаимодействие не запускают.

Следствия:

- `sex_machine`, `exposure`, `foot`, `oral`, `penetration`, `capsule`, `lesbian` и большинство сгенерированных вариантов пока никогда не выбираются;
- `vibration/machine`, `sex_machine/*`, `electrostimulation/chair` и `tentacles` также не имеют runtime-мэппинга;
- повязка меняет вычисляемый тип restraint только после того, как interaction уже активировано, но сама interaction не создаёт;
- тип `machine` текущий резолвер практически не выставляет;
- существование точного expanded-файла заранее не проверяется: при ошибке загрузки UI переходит на старую sparse interaction-матрицу, затем на base-avatar.

## 4. Требуемая архитектура подключения

### 4.1. Реестр действий

Нужно заменить жёсткую цепочку условий декларативным реестром:

```ts
type InteractionVisualRule = {
  startActionIds: string[];
  modifierActionIds?: string[];
  stopActionIds?: string[];
  family: InteractionFamily;
  variant: string | ((context: RuntimeContext) => string);
  targetCharacter: 'subject' | 'assistant' | ((context: RuntimeContext) => string);
  phase: (context: RuntimeContext) => VisualPhase;
};
```

Каждый сгенерированный вариант обязан иметь хотя бы одно игровое правило либо быть явно помечен `future`/`optional` в матрице. Сборочный скрипт должен завершаться ошибкой, если обязательный вариант не достижим из механик.

### 4.2. Выбор персонажа

Правило должно явно указывать цель изображения:

- действие над активом — аватар актива;
- команда ассистенту — аватар ассистента;
- взаимодействие двух персонажей — отдельный interaction-кадр для основного участника, а ID второго участника сохраняется в visual descriptor.

Нельзя всегда использовать текущий `SUBJECT`: это сломает действия, адресованные ассистенту.

### 4.3. Wardrobe

Одежда вычисляется из нормализованного состояния гардероба персонажа, а не из случайного порядка contexts.

Нужна единая таблица:

| Одежда персонажа | Interaction wardrobe |
|---|---|
| `nude` | `nude` |
| `underwear`, `calibration_set` | `underwear` |
| `dress_stockings` | `stockings` |
| `dress`, `lab_gown` в открытой сцене | `open_top` |
| `jumpsuit` или одежда, определённая устройством | `device_outfit` |

Если вариант не поддерживает текущую одежду, применяется его объявленная политика преобразования. Она хранится в JSON-матрице, а не в `expandedInteractionAssetPath()`.

### 4.4. Restraint

Interaction restraint — укрупнённая композиционная категория:

- `free` — без телесной фиксации;
- `wrists` — руки зафиксированы;
- `spread` — разведённая фиксация;
- `machine` — положение задаёт устройство.

Постоянные контексты вроде blindfold не являются отдельной осью текущей interaction-матрицы и потому не гарантируются изображением. Для них нужен один из двух последующих подходов:

1. UI-оверлей для небольших предметов (`blindfold`, `gag`);
2. отдельная составная ось/варианты только для сцен, где предмет существенно меняет изображение.

Полный декартов продукт всех предметов запрещён: расширяются только подтверждённые игровые комбинации.

### 4.5. Affect и phase

`phase` определяется ходом продолжающегося действия:

- `sustain` — действие запущено и стабильно;
- `intense` — усиление либо высокий уровень воздействия;
- `peak` — состояние на грани или разрядка.

`affect` определяется знаком реакции и состоянием персонажа:

- `guarded`/`receptive` для `sustain`;
- `high_positive`/`high_negative`/`subspace` для `intense`;
- `climax`/`high_negative` для `peak`.

Пороговые значения должны быть вынесены в одну доменную функцию и покрыты тестами. В UI они не дублируются.

## 5. Приоритет и fallback

Единый резолвер для всех экранов:

1. критическое состояние (`panic`, `unresponsive` и системные аварийные эффекты);
2. точный `interactions-expanded`;
3. ближайший допустимый expanded-вариант по правилам матрицы;
4. sparse interaction-кадр того же `family + variant + phase`;
5. equipment/context avatar;
6. base-avatar;
7. канонический портрет.

Runtime должен импортировать манифест существующих ключей и выбирать fallback до установки `img.src`. `onError` остаётся только защитой от повреждённого файла.

При завершении действия interaction descriptor очищается, после чего снова показывается equipment/base слой с актуальной одеждой, позой, эмоцией и постоянными контекстами.

## 6. План подключения существующих семейств

### Этап 1 — довести уже подключённые

- `vibration/handheld`;
- `vibration/internal`;
- `electrostimulation/clamps`;
- `electrostimulation/genital`.

Добавить тесты выбора wardrobe, restraint, affect и phase для всех трёх персонажей.

### Этап 2 — устройства

- `vibration/machine`;
- всё семейство `sex_machine`;
- `electrostimulation/chair`;
- `capsule/hmd`, `capsule/machine`, `capsule/electric`.

Для каждого варианта сначала создать механику start/adjust/stop и продолжительный context, затем включать визуальное правило.

### Этап 3 — действия и позы

- `exposure`;
- `foot`;
- `oral`;
- `penetration`;
- `lesbian`.

Команды должны поддерживать исполнителя, цель и второго участника. Одноразовые действия без продолжительности используют эффект, но не удерживают interaction-аватар.

### Этап 4 — optional

- `electrostimulation/tentacles`;
- `capsule/glory`;
- прочие варианты, помеченные `optional`.

Они подключаются только после появления соответствующих механик.

## 7. Расширение матрицы

Новая комбинация добавляется только когда выполняются все условия:

1. существует игровая механика и продолжительный context;
2. определены family, variant, допустимые wardrobe/restraint и фазы;
3. вариант визуально отличается от уже существующего;
4. определены start, modifier и stop;
5. создано правило выбора участника;
6. генератор чек-листа рассчитал точный набор файлов;
7. есть fallback на время неполной генерации.

Для нового персонажа используются те же 742 ключа, если его внешность и роль не требуют исключений. Источник внешности — `character-image-matrix.json`; character LoRA не используются. Генерация сохраняет композицию внутри комбинации, меняя между фазами только выражение, мышечное напряжение, интенсивность устройства и физиологические признаки.

## 8. Проверка и критерии готовности

- все обязательные варианты имеют достижимое runtime-правило;
- все runtime-правила ссылаются на существующие family/variant;
- манифест содержит все 742 ожидаемых ключа на персонажа;
- выбор одного действия даёт одинаковые family/variant на всех экранах;
- wardrobe и restraint соответствуют состоянию конкретного участника;
- `sustain → intense → peak → stop` меняет кадры без сброса персонажа;
- действие ассистента отображает ассистента, а не текущий актив;
- после stop возвращается актуальный equipment/base avatar;
- отсутствующий или отклонённый кадр проходит детерминированный fallback;
- визуальные проблемы можно записать через встроенный review-инструмент по точному asset key.
