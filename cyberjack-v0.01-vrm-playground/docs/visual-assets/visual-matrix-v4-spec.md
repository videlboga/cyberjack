# CyberJack Visual Matrix v4

Статус: draft
Назначение: целевая архитектура аватаров калибровки, ручных продолжительных воздействий и автономных лабораторных устройств.

## 1. Причина переработки

Текущие ресурсы разделены на два набора с несовместимыми измерениями:

- `public/character-images/rendered/{character}` содержит полное покрытие `7 поз × 7 комплектов одежды × 8 состояний`, но только с `restraint=none`;
- `public/character-images/interactions-expanded/{character}` содержит 742 сцены на персонажа, но поза скрыта внутри variant, одежда укрупнена, эмоции связаны с фазами, а ограничения представлены абстрактными категориями `free/wrists/spread/machine`.

Из-за этого постоянная экипировка — повязка, кляп, ошейник, конкретные манжеты — не отображается надёжно. Часть дополнительных поз ошибочно считается взаимодействиями, а автономные устройства конкурируют с ручной калибровкой за один экран.

V4 разделяет эти задачи на три визуальные системы и один общий резолвер.

## 2. Цели

1. Полное и предсказуемое покрытие поз, одежды и эмоций в калибровке.
2. Отображение постоянной экипировки до, во время и после воздействий.
3. Отделение ручных воздействий от автономных устройств.
4. Сохранение и переиспользование существующих изображений.
5. Детерминированный fallback без пустых аватаров и случайных смен изображения.
6. Возможность добавлять персонажей и сцены без полного декартова произведения всех осей.

## 3. Нецели v4

- генерация всех математически возможных комбинаций предметов;
- процедурное совмещение несовместимых растровых изображений;
- включение сексуальных взаимодействий до появления соответствующих игровых механик;
- использование архивного `rendered/mira/rmbg_v1`;
- привязка изображения непосредственно к тексту ответа LLM.

## 4. Визуальные системы

### 4.1. Calibration Avatar Matrix

Постоянный вид персонажа на экране калибровки:

```text
character × pose × clothing × equipmentPreset × affect
```

Источник:

```text
src/infrastructure/data/visual/calibration-avatar-matrix.json
```

Путь:

```text
public/character-images/calibration-v4/{character}/{pose}/{clothing}__{equipmentPreset}__{affect}.png
```

### 4.2. Calibration Interaction Matrix

Временный кадр продолжающегося ручного воздействия:

```text
character × family × variant × clothing × equipmentPreset × affect × phase
```

Источник:

```text
src/infrastructure/data/visual/calibration-interaction-matrix.json
```

Путь:

```text
public/character-images/calibration-interactions-v4/{character}/{family}/{variant}/{clothing}__{equipmentPreset}__{affect}__{phase}.png
```

### 4.3. Device Visual Matrix

Кадр персонажа, зафиксированного в автономном устройстве:

```text
character × device × configuration × wardrobe × affect × phase
```

Источник:

```text
src/infrastructure/data/visual/device-visual-matrix.json
```

Путь:

```text
public/character-images/devices-v4/{character}/{device}/{configuration}/{wardrobe}__{affect}__{phase}.png
```

Положение и фиксация определяются конфигурацией устройства и не являются свободными осями.

## 5. Общие идентификаторы

### Персонажи

Первая версия включает:

| ID | Slug |
|---|---|
| `S-AV-01` | `mira` |
| `NPC-LAB-01` | `iona` |
| `NPC-CAND-01` | `nika` |

Внешность берётся из `character-image-matrix.json#characters.appearanceTags`. Character LoRA не используются.

### Affect

Единый набор состояний:

| ID | Значение |
|---|---|
| `neutral` | спокойное базовое состояние |
| `receptive` | положительное принятие |
| `guarded` | настороженность или сопротивление |
| `high_positive` | высокое положительное напряжение |
| `high_negative` | высокое отрицательное напряжение |
| `subspace` | изменённое погружённое состояние |
| `climax` | на грани или разрядка |
| `unconscious` | отсутствие реакции |

LLM не выбирает affect. Он вычисляется только из механического состояния и переходов персонажа.

## 6. Матрица калибровочных аватаров

### 6.1. Позы

| ID | Происхождение | Назначение |
|---|---|---|
| `standing` | rendered | обычная стойка |
| `sitting` | rendered | обычная посадка |
| `kneeling` | rendered | на коленях |
| `lying` | rendered | лёжа |
| `all_fours` | rendered | на четвереньках |
| `spread_eagle` | rendered | лёжа с разведёнными конечностями |
| `suspended` | rendered | подвес |
| `sitting_spread` | interactions-expanded/exposure | сидя с разведёнными ногами |
| `standing_exposed` | interactions-expanded/exposure | открытая стойка |
| `covering` | interactions-expanded/exposure | прикрывается руками |
| `feet_presented` | interactions-expanded/foot | предъявляет ступни |

`exposure/*` и `foot/*_presented` после миграции перестают считаться interaction-семействами.

Для каждой включённой позы требуется полный набор из восьми affect. Усечённое эмоциональное покрытие для калибровочных поз запрещено.

### 6.2. Одежда

Используются точные игровые комплекты:

- `nude`;
- `underwear`;
- `dress`;
- `dress_stockings`;
- `jumpsuit`;
- `lab_gown`;
- `calibration_set`.

Матрица и runtime не используют категории `open_top`, `stockings` и `device_outfit` для калибровочного аватара. Они допустимы только как совместимые категории миграции старых ресурсов.

### 6.3. Equipment preset

Equipment preset — видимая комбинация экипировки, а не отдельный предмет инвентаря.

| ID | Игровые контексты |
|---|---|
| `none` | нет видимой экипировки |
| `blindfold` | повязка |
| `gag` | кляп |
| `blindfold_gag` | повязка и кляп |
| `collar` | ошейник |
| `wrist_cuffs` | наручники |
| `wrist_cuffs_blindfold` | наручники и повязка |
| `ankle_cuffs` | ножные манжеты |
| `wrist_ankle_cuffs` | руки и ноги зафиксированы манжетами |
| `restraint_belt` | фиксирующий пояс |
| `table_straps` | ремни диагностического стола |
| `restraint_frame` | стационарная рама |
| `suspension` | подвес за запястья |

Новые сочетания добавляются только как явно названные пресеты. Независимые булевы оси `blindfold × gag × collar × cuffs` не допускаются.

### 6.4. Совместимость поз и оборудования

| Equipment preset | Допустимые позы |
|---|---|
| `none` | все |
| `blindfold`, `gag`, `blindfold_gag`, `collar` | все |
| `wrist_cuffs`, `wrist_cuffs_blindfold` | standing, sitting, kneeling, lying, all_fours, sitting_spread, standing_exposed, covering, feet_presented |
| `ankle_cuffs` | standing, sitting, kneeling, lying, spread_eagle, sitting_spread, standing_exposed |
| `wrist_ankle_cuffs` | kneeling, lying, spread_eagle, sitting_spread |
| `restraint_belt` | standing, sitting, kneeling, standing_exposed |
| `table_straps` | lying, spread_eagle |
| `restraint_frame` | standing, spread_eagle, standing_exposed |
| `suspension` | suspended |

Все совместимые пары по умолчанию поддерживают семь комплектов одежды и восемь affect. Исключение должно быть записано в JSON с причиной.

### 6.5. Разрешение нескольких предметов

Игровые контексты нормализуются в один preset декларативной таблицей.

Приоритет телесной фиксации:

```text
suspension
→ restraint_frame
→ table_straps
→ wrist_ankle_cuffs
→ restraint_belt
→ wrist_cuffs
→ ankle_cuffs
→ none
```

Повязка и кляп сначала пытаются образовать точный составной preset. Если такого preset нет, выбирается главный телесный preset, а потерянный визуальный признак фиксируется в descriptor как `unrepresentedEquipment`.

## 7. Ручные продолжительные воздействия

На экране калибровки остаются:

| Family | Variants |
|---|---|
| `vibration` | `handheld`, `internal` |
| `electrostimulation` | `clamps`, `genital` |
| `foot` | будущая ручная продолжительная щекотка без колодок |
| `manual_intimate` | будущие ручные взаимодействия после включения механик |

Не остаются:

- `vibration/machine`;
- `sex_machine/*`;
- `electrostimulation/chair`;
- `foot/stocks_tickle`;
- `capsule/*`.

Они относятся к устройствам.

### Фазы

- `sustain` — стабильное воздействие;
- `intense` — повышенная интенсивность;
- `peak` — на грани или разрядка;
- `recovery` — interaction-кадр не используется, показывается calibration avatar.

### Эмоциональное покрытие

| Фаза | Обязательные affect |
|---|---|
| `sustain` | neutral, receptive, guarded, high_positive, high_negative |
| `intense` | receptive, guarded, high_positive, high_negative, subspace |
| `peak` | high_positive, high_negative, subspace, climax |

Фаза и affect вычисляются независимо, после чего проверяются по таблице совместимости. Это заменяет текущую жёсткую связь «одна фаза — один небольшой набор эмоций».

### Экипировка во время воздействия

Минимально обязательные interaction presets:

- `none`;
- `blindfold`;
- `wrist_cuffs`;
- `wrist_cuffs_blindfold`;
- `table_straps` или `restraint_frame`, если конкретный variant это допускает.

Кляп, ошейник и редкие сочетания подключаются по фактической частоте использования после первой поставки.

## 8. Автономные устройства

### 8.1. Отдельный экран

Для занятого устройства открывается отдельный экран протокола, а не калибровка. На нём:

- аватар устройства;
- адаптированный монитор;
- управление протоколом;
- уменьшенный набор действий;
- чат с персонажем;
- журнал событий устройства.

Свободная смена позы заблокирована. Поза и фиксация определяются configuration.

### 8.2. Устройства и конфигурации

| Device | Configuration |
|---|---|
| `sex_machine` | `stirrups`, `restrained`, `suspended`, `milking`, `hmd`, `mind_control` |
| `sensory_capsule` | `hmd`, `machine`, `electric`, `glory` |
| `electric_chair` | `chair` |
| `vibration_machine` | `machine` |
| `tickle_stocks` | `stocks_tickle` |

`glory` и другие optional-конфигурации остаются выключенными до появления механики.

### 8.3. Состояние устройства

```ts
type DeviceSession = {
  id: string;
  deviceId: string;
  subjectId: string;
  configuration: string;
  wardrobe: string;
  protocolId: string | null;
  status: 'loaded' | 'running' | 'paused' | 'stopping' | 'complete';
  intensity: number;
  targetPointIds: string[];
  phase: 'sustain' | 'intense' | 'peak' | 'recovery';
  startedAtTick: number | null;
  updatedAtTick: number;
};
```

Сессия хранится в доменном/серверном состоянии, а не в React-компоненте. Она продолжает обрабатываться игровыми тиками после ухода с экрана.

### 8.4. Действия устройства

Минимальный цикл:

```text
load → configure → start → adjust/pause/resume → stop → release
```

Разрешены:

- выбрать доступную configuration;
- выбрать протокол;
- запустить и остановить;
- повысить или снизить интенсивность;
- изменить целевую зону, если это поддержано устройством;
- поставить на паузу и продолжить;
- написать персонажу;
- дать команду ассистенту;
- освободить персонажа после безопасной остановки.

Запрещены обычная смена позы, свободное переодевание и действия, несовместимые с фиксацией устройства.

### 8.5. Монитор устройства

Сохраняет текущий визуальный язык монитора калибровки, но добавляет:

- устройство и configuration;
- протокол и статус;
- текущую интенсивность;
- длительность сессии;
- целевые зоны;
- автоматические ограничения;
- прогноз до перегрузки или разрядки;
- кнопку аварийной остановки.

Текущие показатели, baseline, физиологические сигналы и динамика ресурса остаются доступными.

## 9. Общий visual descriptor

UI получает готовое описание и не собирает путь самостоятельно:

```ts
type CharacterVisualDescriptorV4 = {
  characterId: string;
  characterSlug: string;
  mode: 'calibration' | 'calibration_interaction' | 'device';
  pose?: string;
  clothing: string;
  equipmentPreset?: string;
  affect: string;
  interaction?: { family: string; variant: string; phase: string };
  device?: { deviceId: string; configuration: string; phase: string };
  representedEquipment: string[];
  unrepresentedEquipment: string[];
};
```

Descriptor формируется доменным сервисом из состояния персонажа, contexts и DeviceSession. Калибровка, монитор, карточки помещений и чат используют один результат.

## 10. Приоритет резолвера

```text
1. critical affect override
2. active device visual
3. exact calibration interaction
4. nearest calibration interaction
5. exact calibration avatar with equipment
6. same pose/clothing/affect with reduced equipment preset
7. base rendered avatar
8. neutral base avatar
9. canonical portrait
```

Critical override применяется для `unconscious`, паники и системной перегрузки, но не должен без необходимости скрывать физически значимое устройство.

Fallback выбирается по runtime-манифесту существующих файлов до установки `img.src`. `onError` используется только для повреждённых ресурсов.

## 11. Миграция существующих ресурсов

### Rendered

Существующие 392 файла на персонажа регистрируются как:

```text
pose × clothing × none × affect
```

Физически переносить их на первом этапе необязательно. Runtime-манифест может ссылаться на старый путь.

### Interactions-expanded

| Старое семейство/variant | Новое назначение |
|---|---|
| `exposure/standing` | calibration pose `standing_exposed` |
| `exposure/sitting_spread` | calibration pose `sitting_spread` |
| `exposure/spread_eagle` | временный источник для `spread_eagle` |
| `exposure/covering` | calibration pose `covering` |
| `foot/bare_presented` | calibration pose `feet_presented` |
| `foot/pantyhose_presented` | calibration pose `feet_presented` + dress_stockings mapping |
| `vibration/handheld`, `internal` | calibration interaction |
| `electrostimulation/clamps`, `genital` | calibration interaction |
| `vibration/machine` | device visual |
| `sex_machine/*` | device visual |
| `electrostimulation/chair` | device visual |
| `foot/stocks_tickle` | device visual |
| `capsule/*` | device visual |
| `oral`, `penetration`, `lesbian` | future paired-interaction system |

Мигрированный файл получает alias в манифесте. Копирование или переименование выполняется только после визуального аудита.

## 12. Генерация

Общие правила:

1. Illustrious и утверждённый checkpoint.
2. Внешность только из appearance tags.
3. Seed фиксируется по устойчивой композиции, а не по affect.
4. Для одной комбинации поза, камера, одежда, оборудование и тело блокируются между эмоциями.
5. Одежда не исчезает и не открывается, если это не задано variant.
6. Полный рост и отсутствие вертикальной обрезки обязательны для calibration avatar.
7. Предмет экипировки должен быть виден и физически связан с телом.
8. Negative prompt перечисляет несовместимую одежду, лишнюю экипировку и неверные эмоции.
9. Сначала утверждается `neutral`, затем остальные семь affect как вариации.

## 13. Этапы поставки

### V4.1 — новая схема без перегенерации

- добавить три JSON-манифеста;
- построить runtime-индекс существующих файлов;
- реализовать единый descriptor и resolver;
- классифицировать существующие изображения по новым системам;
- не менять игровой вид, кроме устранения случайных fallback.

### V4.2 — полные калибровочные позы

- мигрировать `sitting_spread`, `standing_exposed`, `covering`, `feet_presented`;
- дополнить каждую позу до 7 одежд и 8 affect;
- подключить их как позы, а не interaction contexts.

### V4.3 — постоянная экипировка

Порядок:

1. `blindfold`;
2. `gag` и `blindfold_gag`;
3. `wrist_cuffs` и `wrist_cuffs_blindfold`;
4. `ankle_cuffs`, `wrist_ankle_cuffs`, `restraint_belt`;
5. `table_straps`, `restraint_frame`, `suspension`;
6. `collar`.

Каждый этап подключается после завершения полного набора для всех трёх персонажей, а не только одного.

### V4.4 — ручные interaction-варианты

- расширить точную одежду;
- отделить affect от phase;
- сначала добавить `blindfold` и `wrist_cuffs_blindfold`;
- подключать только варианты с существующей механикой start/adjust/stop.

### V4.5 — экран устройств

- DeviceSession и фоновые тики;
- экран устройства и адаптированный монитор;
- sex machine, capsule, electric chair, vibration machine, tickle stocks;
- миграция соответствующих generated assets;
- блокировка свободной смены позы.

### V4.6 — парные взаимодействия

- исполнитель, основная цель и второй участник;
- `oral`, `penetration`, `lesbian`;
- отдельные правила остановки, согласия и визуального выбора участников.

## 14. Автоматические проверки

Сборщик каждого манифеста проверяет:

- уникальность asset key;
- известные character/pose/clothing/equipment/affect;
- совместимость комбинации;
- наличие файла;
- читаемый PNG и ожидаемое разрешение;
- дубликаты SHA-256;
- полноту всех обязательных affect;
- достижимость interaction/device variant из игровой механики;
- отсутствие ссылок на архивный `rmbg_v1`.

## 15. Визуальная приёмка

- персонаж узнаваем и совпадает между affect;
- поза соответствует ключу;
- одежда точная и не заменена укрупнённой категорией;
- повязка действительно закрывает глаза;
- кляп, манжеты, ремни и устройства читаются без двусмысленности;
- экипировка не исчезает при смене эмоции;
- эмоции различимы, особенно `neutral/guarded/high_negative` и `high_positive/subspace/climax`;
- изображение не обрезается рамкой UI;
- отклонённый файл отмечается существующим review-инструментом по точному asset key.

## 16. Критерии готовности

V4 считается внедрённой, когда:

1. Калибровочные позы имеют полный набор эмоций.
2. Повязка и основные фиксаторы сохраняются при смене позы, одежды, эмоции и экрана.
3. Ручное воздействие временно перекрывает calibration avatar и возвращает правильный оснащённый кадр после остановки.
4. Автономное устройство продолжает протокол в фоне и запрещает свободную смену позы.
5. Все экраны используют единый descriptor/resolver.
6. Ни один отсутствующий ресурс не приводит к пустому аватару.
7. Существующие полезные rendered и interactions-expanded ресурсы доступны через migration aliases.
