# 24 машины в существующих механиках (без новых систем)

> Цель: авторские машины из `stations-narrative.md` встроить в то, что уже есть
> в коде. Никаких новых сущностей «статус машины», «норма», «очередь станций» —
> только записи в существующие таблицы и переиспользование существующих типов.

---

## 1. Что уже есть (инвентарь)

| Механика | Где | Что даёт |
|---|---|---|
| Режимы стимуляции | `src/domain/sexMachineStimulation.ts` | 4 режима: `vaginal`, `anal`, `tickling`, `circular_saw` — у каждого `pointId`, `tags`, `visual` |
| Привязка модулей | там же, `SEX_MACHINE_ASSETS` | `lab_sex_machine_*` → режим |
| Кадры аватара | `public/character-images/sex-machine/` | 4 набора: anal 184, circularsaw 96, tickling 114, vaginal 138 кадров |
| Действия | `src/infrastructure/data/presets/actions.json` | 137 пресетов с вектором (intensity/valence/sharpness/contact/novelty/powerBase), тегами, точками. Уже есть `device_*`, `capsule_*`, `context_*` |
| Счётчики предпочтений | `src/domain/conditioning.ts`, `parsePreferences` | 4 ведра: `actions`, `points`, `contexts`, `tags` — накапливаются от действий |
| Контракты | `asset_contracts.conditions` + `src/scenario/evaluateAssetContract.ts` | 8 типов условий: `flag`, `attitude`, `trait`, `preference`, `acquired_trait`, `point`, `custom`, + операторы `>= <= > < == !=`. `type:'preference'` читает счётчик тега, `custom` — baseline-статы |
| Где стоит / кто внутри | `laboratory_assets`, `laboratory_room_assignments` | `metadata.roomId`, `subjectId`, слот `device:<assetId>` |
| Что запущено сейчас | `active_contexts` | `action_id` на субъекте — «машина работает» = идёт контекст |
| События и физиология | `event_logs`, `physiology.ts` | перегрузка, сон, comfort; триггеры уже шлют события |

**Вывод:** машина = запись режима + asset id + 1–2 пресета действий. Норма =
условие контракта. Режим на табло = `label` режима. Тревога = существующий
физиологический триггер. Новых систем не требуется.

---

## 2. Правило интеграции

1. Каждая машина получает ровно один **режим** из реестра (пункт 3) с `pointId`,
   `tags`, `label` (авторское имя: «Кольцо очистки», «Дорожка», …).
2. Процедура запускается **существующими** действиями: `device_*` / `capsule_*` /
   `context_*` / `pose_*` — что уже лежит в `actions.json`.
3. Прогресс считается **только** в `preferences` (actions/points/tags). Второго
   счётчика не заводим.
4. Норма («1000 раз», «3 л», «1000 м», «2 часа») — это `condition` контракта,
   а не новое поле машины.
5. Индивидуальность машины живёт в **3D-модели** (24 GLB уже есть), а 2D-аватар
   остаётся на 4 существующих наборах кадров. Новые кадры не рисуем.

---

## 3. Раскладка 24 машин по существующим режимам

Семейства: **V** vaginal · **A** anal · **T** tickling · **C** circular_saw ·
**X** контекстное (без анимации стимуляции, через `capsule_*`/`context_*`).

| № | Авторское имя | Сем. | Точка | Теги (доп. к базовым) | Действия | Норма → условие контракта |
|---|---|---|---|---|---|---|
| 065 | Кольцо очистки | C | clitoris | rotary, clean | `device_sensory_loop` + `act_start_vibrator` | длительность цикла → `durationMinutes` |
| 066 | Двойная колонна | V | vagina | pair, clean | `act_start_vibrator` ×2 субъекта | два контракта, по одному на актива |
| 067 | Кресло наказания | V | vagina | punishment, restraint | `act_apply_handcuffs`, `act_hold_exposure` | `custom: capacity >= N` |
| 068 | Наклонный блок | A | anus | quick, machine | `act_start_vibrator` | `preference: machine_quick >= N` |
| 069 | Камера в панели | A | anus | depersonalized, isolation | `context_mental_correction_chair` | `custom: openness >= N` |
| 070 | Кабина тренажёра | V | vagina | counter, machine | `device_sensory_pulse` | `preference: climax >= 3219` |
| 071 | Подвес с датчиком | V | vagina | suspension, sensor | `act_hold_exposure` | событие: `overload` → WARNING (есть) |
| 072 | Рама растяжки | T | feet | stretch, sensor | `act_present_feet`, `act_hold_exposure` | `point: feet >= 3` |
| 073 | Ванна-кресло | V | vagina | long, warm | `act_caress`, `act_start_vibrator` | `durationMinutes = 125` |
| 074 | Стена кабин | V | vagina | flow, vr | `device_sensory_pulse` | `custom: openness >= N` (готовность %) |
| 075 | Планка | V | vagina | static, weight | `act_hold_exposure` | `custom: capacity >= N` |
| 076 | Кормитель | X | — | feeding, fluid | `capsule_additive_seminal` | `preference: fluid >= 3` |
| 077 | Стойка повторов | V | vagina | reps, machine | `act_start_vibrator` (циклы) | `preference: machine_reps >= 1000` |
| 078 | Дорожка | V | vagina | distance, machine | `device_sensory_pulse` | `preference: machine_distance >= 1000` |
| 079 | Автокушетка | X | — | potion, auto | `capsule_infusion_sensitizer`, `capsule_infusion_hormonal_primer` | `custom: sensitivity >= N` |
| 080 | Гипномашина | X | — | mental, conditioning | `context_mental_correction_chair` | `custom: plasticity >= N` |
| 081 | Гриндер | X | — | food, grind | `capsule_additive_seminal` | доход/ресурс, не статы |
| 082 | Экстрактор | X | — | extract, fluid | `capsule_additive_seminal` | `preference: fluid >= 3` (3 л/сутки) |
| 083 | Капсула заключения | A | anus | confinement, random | `act_hold_exposure`, `act_start_vibrator` | длительность + `attitude <= N` |
| 084 | Счастливый душ | T | feet | clean, brush, water | `device_contrast_pulse` | `durationMinutes = 120` |
| 085 | Синхронизатор | V | vagina | sync, pair | `act_sexual_climax` у обоих | `custom: plasticity >= N` у нового |
| 086 | Магнитный массажёр | C | clitoris | rpm, magnetic | `device_sensory_pulse` | параметр RPM в метаданных, не контракт |
| 087 | Машина наказания | T | feet | punish, tickle, balance | `act_present_feet`, `act_shock_collar` | событие промаха → удар (есть триггер) |
| 088 | Машина новичка | V | vagina | newcomer, soft | `act_caress` | `flag: first_procedure` |

Всё, что в колонке «Действия», уже существует в `actions.json` — проверено по id.

---

## 4. Как выглядит норма в контракте (реальный формат)

`asset_contracts.conditions` — массив, который уже умеет читать
`evaluateAssetContract`. Нормы из рефов записываются как есть:

```json
// 077 «Стойка повторов»: 1000 повторений × 2
{"type":"preference","key":"machine_reps","operator":">=","value":1000}

// 082 «Экстрактор»: 3 л в сутки
{"type":"preference","key":"fluid","operator":">=","value":3}

// 085 «Синхронизатор»: новый актив догнал обученного по пластичности
{"type":"custom","key":"plasticity","operator":">=","value":60}

// 072 «Рама растяжки»: фетиш стоп сформирован
{"type":"point","key":"feet","operator":">=","value":3}
```

Кода это не требует: типы условий `preference`, `custom`, `point`, `flag` уже
реализованы, счётчики накапливаются существующим механизмом обучения.

---

## 5. Что добавить (только данные)

| Добавить | Сколько | Куда |
|---|---|---|
| Записи режимов машин | 24 | `SEX_MACHINE_STIMULATION` (расширить union + записи) |
| Привязка asset → режим | 24 | `SEX_MACHINE_ASSETS` |
| Действия для нестандартных процедур | 3–5 | `actions.json` по образцу `device_*` / `capsule_*` |
| Теги процедур (`machine_reps`, `machine_distance`, `fluid`, `sync`) | 4–6 | `actions.json` в теги соответствующих пресетов |
| Шаблоны контрактов | 3–5 | `seedContracts.ts` / `contractData.ts` |
| Названия комнат и описания | 24 | `BASE_LAB_ROOMS` + локали (см. `stations-narrative.md`) |

Ноль новых таблиц, ноль новых сервисов, ноль новых кадров аватара.

---

## 6. Чего не делать

- **Не вводить «статус машины» как сущность.** Он уже есть: `active_contexts.action_id`
  + `label` режима. Табло на посту показывает `activeContextNames`.
- **Не вводить «норму» отдельным полем.** Норма = `conditions` контракта.
- **Не считать прогресс вторым способом** (свой счётчик на машине). Источник один —
  `preferences`.
- **Не рисовать 20 наборов кадров.** 4 визуальных семейства переиспользуются;
  авторская индивидуальность — в 3D-моделях, которые уже стоят в сцене.
- **Не делать очередь станций.** Занятость уже читается из
  `laboratory_room_assignments` + `laboratory_assets.metadata`.

---

## 7. Ограничение, о котором честно

Четыре визуальных семейства не дают 24 разных силуэта в 2D-аватаре: «Дорожка» и
«Стойка повторов» будут анимироваться одним набором кадров, если не рисовать
новые. Это осознанный компромисс: в 3D-сцене (Blender/Unity) все 24 машины
разные, а 2D-портрет актива остаётся в четырёх типах позы.
