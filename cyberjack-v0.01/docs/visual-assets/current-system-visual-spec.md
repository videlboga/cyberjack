# CyberJack: спецификация визуального покрытия текущей системы

Статус: целевая спецификация core v1
Принцип: механика определяет необходимое визуальное покрытие; наличие сгенерированного изображения само по себе не является основанием добавлять механику или позу.

## 1. Область спецификации

Core v1 включает:

1. Существующие позы, одежду и состояния калибровки.
2. Существующую переносную экипировку.
3. Реализованные ручные продолжительные воздействия.
4. Секс-машину и сенсорную капсулу, уже покрытые изображениями, как отдельные лабораторные устройства.

Core v1 не включает:

- новые демонстрационные позы, добавленные на основе `interactions-expanded`;
- `exposure` и `foot` как отдельные семейства;
- `oral`, `penetration`, `lesbian`;
- электрическое кресло, колодки и прочие устройства без игровой механики;
- полное декартово произведение всех предметов экипировки;
- обязательную перегенерацию уже пригодных device-изображений ради полного набора эмоций и одежды.

## 2. Источники изображений

### Калибровка

```text
public/character-images/rendered/{character}/{pose}__{clothing}__none__{affect}.png
```

Фактическое покрытие:

```text
3 персонажа × 7 поз × 7 комплектов × 8 affect = 1176 PNG
```

### Продолжительные взаимодействия и устройства

```text
public/character-images/interactions-expanded/{character}/{family}/{variant}/{wardrobe}__{restraint}__{affect}__{phase}.png
```

Фактическое покрытие — 742 PNG на персонажа, 2226 всего. Core использует только явно перечисленные ниже семейства и варианты.

### Архив

```text
public/character-images/rendered/mira/rmbg_v1
```

Не используется ни как runtime-источник, ни как основание для новой матрицы.

## 3. Персонажи

| ID | Slug |
|---|---|
| `S-AV-01` | `mira` |
| `NPC-LAB-01` | `iona` |
| `NPC-CAND-01` | `nika` |

Все обязательные наборы создаются сразу для всех трёх персонажей. Покрытие только одного персонажа не считается завершённым этапом.

## 4. Калибровочные позы

Core использует только уже существующие игровые позы:

| Action/context | Visual pose |
|---|---|
| нет активной позы, `pose_standing` | `standing` |
| `pose_sitting` | `sitting` |
| `pose_kneeling` | `kneeling` |
| `pose_lying_down` | `lying` |
| `pose_all_fours` | `all_fours` |
| `pose_spread_eagle` | `spread_eagle` |
| `act_suspend_wrists` | `suspended` |

Не входят в core:

- `standing_exposed`;
- `sitting_spread`;
- `covering`;
- `feet_presented`.

Добавленные прототипные действия `act_hold_exposure`, `act_end_exposure`, `act_present_feet`, `act_end_feet_presentation` должны быть удалены из основного интерфейса и доступных действий либо помечены feature flag до отдельного решения по механике демонстрации.

## 5. Affect калибровки

Для каждой core-позы сохраняется полный существующий набор:

- `neutral`;
- `receptive`;
- `guarded`;
- `high_positive`;
- `high_negative`;
- `subspace`;
- `climax`;
- `unconscious`.

Affect вычисляется механикой. Текст LLM и тип последнего действия не выбирают изображение напрямую.

## 6. Одежда калибровки

### Визуальные outfit presets

Core сохраняет существующие семь визуальных комплектов:

- `nude`;
- `underwear`;
- `dress`;
- `dress_stockings`;
- `jumpsuit`;
- `lab_gown`;
- `calibration_set`.

### Нормализация игровых контекстов

Игровые предметы одежды нормализуются в один outfit preset до выбора изображения:

| Активные контексты | Outfit preset |
|---|---|
| `eq_clothe_jumpsuit` | `jumpsuit` |
| `eq_clothe_calibration_set` | `calibration_set` |
| `eq_clothe_lab_gown` | `lab_gown` |
| `eq_clothe_dress` + `eq_clothe_stockings` | `dress_stockings` |
| `eq_clothe_dress` | `dress` |
| бюстгальтер и/или трусики | `underwear` |
| нет перечисленного | `nude` |

Core v1 не создаёт отдельные изображения `bra_only`, `panties_only` и `stockings_only`. UI должен явно показывать фактические активные предметы, но визуальный аватар использует ближайший outfit preset.

Чтобы не создавать недостижимые или противоречивые комбинации, действия переодевания должны соблюдать правила:

- цельный комплект вытесняет другой цельный комплект;
- платье может сочетаться с чулками;
- бельё под платьем или рубашкой не требует отдельного визуального preset;
- чулки без платья отображаются ближайшим допустимым preset и помечаются как визуально непредставленные;
- снятие части белья не должно ошибочно делать персонажа полностью обнажённым в доменном состоянии.

## 7. Постоянная экипировка калибровки

### Реально существующие механики

| Игровой context | Visual equipment preset |
|---|---|
| `eq_blindfold_apply` | `blindfold` |
| `eq_gag_apply` | `gag` |
| `act_apply_collar` | `collar` |
| `act_apply_handcuffs` | `wrist_cuffs` |
| `act_apply_ankle_cuffs` | `ankle_cuffs` |
| `act_apply_restraint_belt` | `restraint_belt` |
| `act_suspend_wrists` | поза `suspended`; отдельный equipment preset не требуется в первой поставке |

`table_straps` и `restraint_frame` не входят в генерацию до появления явных действий фиксации персонажа на столе и раме.

### Совместимость

| Equipment preset | Позы |
|---|---|
| `blindfold`, `gag`, `collar` | все 7 core-поз |
| `wrist_cuffs` | standing, sitting, kneeling, lying, all_fours, spread_eagle |
| `ankle_cuffs` | standing, sitting, kneeling, lying, all_fours, spread_eagle |
| `restraint_belt` | standing, sitting, kneeling, lying |

Недопустимое сочетание блокируется механикой. Resolver не должен молча выбирать физически невозможное изображение.

### Первая генерационная очередь

При сохранении семи outfits и восьми affect:

| Preset | На персонажа | Для трёх персонажей |
|---|---:|---:|
| `blindfold` | 392 | 1176 |
| `gag` | 392 | 1176 |
| `collar` | 392 | 1176 |
| `wrist_cuffs` | 336 | 1008 |
| `ankle_cuffs` | 336 | 1008 |
| `restraint_belt` | 224 | 672 |
| Всего | 2072 | 6216 |

Целевой путь:

```text
public/character-images/calibration-core/{character}/{pose}/{clothing}__{equipmentPreset}__{affect}.png
```

Пример:

```text
public/character-images/calibration-core/nika/sitting/underwear__blindfold__guarded.png
```

### Составные сочетания

Не входят в первую генерационную очередь. Пока используется детерминированный приоритет:

```text
restraint_belt
→ wrist_cuffs
→ ankle_cuffs
→ blindfold
→ gag
→ collar
→ none
```

При этом descriptor сохраняет `unrepresentedEquipment`, чтобы UI и review-инструмент показывали потерянные визуальные признаки.

После одиночного покрытия и анализа реального использования допускаются только три первых составных preset:

- `wrist_cuffs_blindfold`;
- `blindfold_gag`;
- `wrist_ankle_cuffs`.

## 8. Ручные продолжительные воздействия

Core использует только уже работающие варианты:

| Context | Family/variant |
|---|---|
| `act_start_vibrator` | `vibration/handheld` |
| `act_activate_plug` | `vibration/internal` |
| `act_start_electrostimulation`, внешняя зона | `electrostimulation/clamps` |
| `act_start_electrostimulation`, groin | `electrostimulation/genital` |

### Использование существующих файлов

Существующее усечённое покрытие `interactions-expanded` считается допустимым для core v1:

| Phase | Доступные affect |
|---|---|
| `sustain` | `guarded`, `receptive` |
| `intense` | `high_positive`, `high_negative`, `subspace` |
| `peak` | `climax`, `high_negative` |

Если вычисленный affect отсутствует для текущей phase, resolver выбирает ближайший допустимый:

```text
neutral → receptive
guarded → guarded
high_positive → high_positive или receptive
high_negative → high_negative или guarded
subspace → subspace или high_positive
climax → climax или high_positive
unconscious → calibration avatar unconscious
```

Перегенерация полного эмоционального диапазона откладывается. Сначала подключается всё уже существующее покрытие.

### Одежда interaction-сцен

Используются только поддерживаемые текущей матрицей категории:

- `nude`;
- `underwear`;
- `stockings`;
- `open_top`;
- `device_outfit` — только где variant его допускает.

Точная калибровочная одежда переводится в ближайшую поддерживаемую категорию. Resolver обязан проверить compatibility variant до построения URL.

## 9. Секс-машина

### Экран

Секс-машина реализуется как отдельное лабораторное устройство и отдельный экран. Она не открывает калибровку.

### Существующее визуальное покрытие

Используются без перегенерации:

```text
public/character-images/interactions-expanded/{character}/sex_machine/
```

Конфигурации:

- `stirrups`;
- `restrained`;
- `suspended`;
- `milking`;
- `hmd`;
- `mind_control`.

Одежда ограничена фактической совместимостью каждой configuration, преимущественно:

- `nude`;
- `underwear` для `restrained`;
- `device_outfit` для машинных конфигураций.

Неподдерживаемый outfit нельзя выбрать в UI устройства. Система не пытается сгенерировать отсутствующий путь.

### Механический цикл

```text
поместить → выбрать configuration → запустить → усилить/ослабить → пауза/продолжить → остановить → освободить
```

Поза определяется configuration. Обычные pose actions заблокированы.

## 10. Сенсорная капсула

### Экран

Капсула использует тот же каркас экрана устройства, но собственные протоколы и конфигурации.

### Существующее визуальное покрытие

Используются без перегенерации:

```text
public/character-images/interactions-expanded/{character}/capsule/
```

Конфигурации:

- `hmd`;
- `machine`;
- `electric`;
- `glory` — optional, скрыта до появления механики.

Допустимые outfits:

- `nude`;
- `device_outfit`;
- `underwear` только для configurations, где файл существует.

### Механический цикл

```text
поместить → выбрать протокол → запустить → настроить интенсивность → пауза/продолжить → остановить → освободить
```

Сессия продолжает обрабатываться фоновыми игровыми тиками после закрытия экрана.

## 11. Общий экран устройств

Один reusable screen обслуживает `sex_machine` и `capsule`.

Обязательные области:

1. Изображение текущей configuration.
2. Монитор состояния персонажа.
3. Статус устройства, protocol, phase, intensity и elapsed time.
4. Ограниченный набор device actions.
5. Чат с персонажем.
6. Журнал автоматически применённых импульсов.
7. Аварийная остановка.

Монитор использует текущий дизайн калибровки, но добавляет параметры устройства. Свободная смена позы и полный набор ручных действий скрыты.

## 12. Device session

```ts
type DeviceSession = {
  id: string;
  deviceId: 'sex_machine' | 'capsule';
  subjectId: string;
  configuration: string;
  wardrobe: string;
  status: 'loaded' | 'running' | 'paused' | 'stopped';
  intensity: number;
  phase: 'sustain' | 'intense' | 'peak';
  protocolId: string | null;
  targetPointIds: string[];
  startedAtTick: number | null;
  updatedAtTick: number;
};
```

DeviceSession хранится сервером. UI не является источником истины.

## 13. Приоритет resolver

```text
1. critical/unconscious calibration state
2. active device session exact existing asset
3. active manual interaction exact existing asset
4. nearest compatible manual interaction asset
5. calibration-core exact equipment asset
6. calibration-core primary equipment asset
7. rendered base pose/clothing/affect
8. rendered base neutral
9. canonical portrait
```

Все пути проверяются по runtime asset index до назначения `img.src`.

## 14. Что удалить из текущего core-плана

Из обязательной генерации и runtime core исключаются:

- 672 изображения дополнительных поз P0;
- полные interaction-матрицы P7/P8;
- device-перегенерация P9/P10;
- `standing_exposed`, `sitting_spread`, `covering`, `feet_presented`;
- `table_straps`, `restraint_frame` до появления действий;
- будущие sexual/paired families.

Предыдущий `visual-generation-v4-checklist` сохраняется как long-term inventory, но не используется как очередь генерации core.

## 15. Этапы реализации

### Core A — привести runtime к фактическому покрытию

- убрать экспериментальные exposure/feet actions из core UI;
- оставить семь существующих поз;
- нормализовать outfit presets;
- использовать текущие четыре manual interaction variants с nearest-affect fallback;
- запретить построение несовместимых URL.

### Core B — повязка

- сгенерировать 1176 `blindfold` кадров;
- подключить через существующий equipment context;
- проверить сохранение после выхода из калибровки и возврата.

### Core C — остальная одиночная экипировка

- gag;
- wrist cuffs;
- ankle cuffs;
- restraint belt;
- collar.

### Core D — устройства

- серверная DeviceSession;
- общий экран устройства;
- подключить существующий `sex_machine`;
- подключить существующий `capsule`;
- фоновые тики и чат;
- не перегенерировать изображения на этом этапе.

### Core E — составная экипировка по статистике

- собрать частоту одновременных contexts;
- выбрать только действительно нужные составные presets;
- начать с `wrist_cuffs_blindfold`, `blindfold_gag`, `wrist_ankle_cuffs`.

## 16. Автоматические проверки

- все семь core-поз имеют 7 outfits и 8 affect в `rendered`;
- equipment checklist содержит только совместимые core-позы;
- архивный `rmbg_v1` не индексируется;
- каждый manual interaction rule ссылается на существующий family/variant;
- каждый device configuration имеет хотя бы один существующий asset для каждого персонажа;
- UI не предлагает outfit/configuration без существующего asset;
- отсутствие точной эмоции приводит к nearest-affect, а не к пустому изображению;
- остановка interaction возвращает актуальный оснащённый calibration avatar;
- остановка DeviceSession предшествует освобождению персонажа.

## 17. Критерии готовности core v1

1. Все существующие позы, outfits и affect продолжают работать без регрессии.
2. Повязка и пять остальных одиночных equipment presets отображаются во всех разрешённых core-комбинациях.
3. Вибратор, плаг и TENS используют существующие изображения с детерминированным эмоциональным fallback.
4. Секс-машина и капсула доступны на отдельном экране и используют уже сгенерированные изображения.
5. Персонаж в устройстве не может свободно менять позу.
6. DeviceSession работает в фоне, монитор и чат доступны.
7. Генерационная очередь core не содержит механик и поз, которых нет в системе.
