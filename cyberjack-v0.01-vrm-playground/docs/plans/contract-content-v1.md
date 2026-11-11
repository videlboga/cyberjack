# Контент контрактов — v1 (30 штук)

> Целевая модель: `docs/plans/scenario-contract-system-rebuild.md`.
> **Ограничение реализации:** новых полей в ядро НЕ добавляем. Всё на существующих
> `subjects` (capacity/baseline_capacity/tension/sensitivity/openness/plasticity/attitude,
> `preferences.tags`), `character_relations` (attitude/openness/plasticity),
> `subjective_associations`, `world_facts`/`story_threads`. Добавляем **только трейты**:
> травматические `trauma_*` и временные аномальные `anomaly_*_echo`.
>
> `relations` в `return_profile` выражаются дельтами существующих полей
> (attitude/openness/plasticity), а не новыми fear/resistance/dependency.

## Схема контракта

```yaml
id: string
issuerId: fac_veil | fac_helix | fac_continuum
title: string
format: external_transfer | lab_protocol
duration: "48–72 ч" | "24 ч" | "5 суток" ...
description: string            # эвфемистичный, но прозрачный, фетишизированный
conditions: []                 # preference/custom/attitude/acquired_trait/flag
rewards: { credits, trust, items[] }
penalties: { credits, trust }
return_profile:
  memory: { theme, fragments[], tags[] }
  acute_state: { capacity, tension, sensitivity, attitude }   # дельты/целевые
  recovery: { baselineCapacityLimit, method, durationDays }
  traits:
    kept: []                  # физиологический фокус сохраняется
    traumatic: [{ id, trigger, response }]
    temporary: [{ id, impulse, decayCondition }]
  associations: { traumatic[], new[] }
  relations: { attitude, openness, plasticity }   # дельты
  world_effects: { facts[], threads[] }
```

---

# Veil Biotech — экстрим, срыв, Аномалия

## 1. contract_veil_somatosensory_feet_01
- **format**: external_transfer · **duration**: 48–72 ч
- **title**: Протокол непрерывной соматосенсорной нагрузки нижних конечностей
- **description**: Требуется актив с фокусом на ступнях и щекотке, высокой общей и локальной чувствительностью, высокой открытостью. В течение 48–72 часов будет поддерживаться непрерывная сенсорная нагрузка с фармакологическим усилением и ограничением сна. Ожидаются тяжёлое истощение, нестабильность чувствительности и стойкие ассоциативные последствия.
- **conditions**: `trait_point_feet ≥ 2`, `trait_knismolagnia ≥ 2`, `sensitivity ≥ 70`, `openness ≥ 65`
- **rewards**: 900 cr, trust +18, `drug_sensitizer` · **penalties**: −140 cr, trust −8
- **return_profile**:
  - memory: theme «непрерывная щекотка ступней под препаратами, с откликом Аномалии»; fragments [фиксация, накачка препаратами, непрерывная стимуляция, лишение сна, транс Аномалии, возвращение]; tags [tickling, feet, restraint, chemical, anomaly, exhaustion, trance]
  - acute_state: capacity→5, tension→85, sensitivity +10, attitude −15
  - recovery: baselineCapacityLimit 20–30%, капсула + drug_regenerative, 3–4 суток
  - traits: kept [trait_point_feet, trait_knismolagnia]; traumatic [trauma_foot_stimulation: страх/избегание/флэшбеки/перегрузка при стимуляции ступней]; temporary [anomaly_foot_echo: навязчивый поиск прикосновений к ступням вопреки травме, decay: восстановление/время/работа с памятью]
  - associations: traumatic [ступни+щекотка→негатив, фиксация→негатив, препараты→амбивалент]; new [Аномалия→притягательная/пугающая]
  - relations: attitude −10, openness +5, plasticity +5
  - world_effects: facts [Veil провёл непрерывный протокол на активе, зафиксирован аномальный отклик на щекотку ступней]; threads [повторный запрос Veil, изучение аномального эха]

## 2. contract_veil_resonance_pain_01
- **format**: external_transfer · **duration**: 36–48 ч
- **title**: Резонансный болевой контур
- **description**: Veil ищет актив, у которого боль уже осмыслена как значимый сигнал, но чувствительность не перешла в сенсорный срыв. Актив будет закреплён на столе и подвергнут серии нарастающих болевых воздействий — от тупых ударов до точечных проколов и электроразрядов — до выхода на устойчивый резонансный отклик. Ожидается глубокая перегрузка и перестройка болевого порога.
- **conditions**: `trait_masochist ≥ 2`, `preference.pain ≥ 18`, `sensitivity ≥ 68`, `capacity ≥ 45`, `attitude ≤ 72`
- **rewards**: 820 cr, trust +16, `drug_painkiller` · **penalties**: −120 cr, trust −6
- **return_profile**:
  - memory: theme «нарастающая боль до резонанса, тело как инструмент»; fragments [фиксация, разогрев, нарастание, резонанс, срыв, возвращение]; tags [pain, impact, piercing, electronic, restraint, overload]
  - acute_state: capacity→4, tension→90, sensitivity +8, attitude −12
  - recovery: baselineCapacityLimit 20%, капсула + drug_regenerative, 3 суток
  - traits: kept [trait_masochist]; traumatic [trauma_pain_resonance: флэшбеки и паника при резких болевых стимулах]; temporary [anomaly_pain_echo: тяга вернуться к болевому пику, decay: восстановление]
  - associations: traumatic [боль→амбивалент, стол/фиксация→негатив]; new [Аномалия→резонанс]
  - relations: attitude −8, openness +3, plasticity +6
  - world_effects: facts [Veil зафиксировал резонансный болевой профиль]; threads [серия болевых протоколов]

## 3. contract_veil_exposure_01
- **format**: lab_protocol · **duration**: 24 ч
- **title**: Открытая экспозиция
- **description**: Veil проверяет переходный профиль: интерес к демонстрации уже закрепился, но общая открытость ещё не растворила осторожность. Актив будет выставлен обнажённым в открытом зале наблюдения и подвергнут длительной демонстрации всех эрогенных зон перед группой наблюдателей, с фиксацией в раскрытых позах. Ожидается слом стыда и закрепление эксгибиционистского отклика.
- **conditions**: `trait_exhibitionist ≥ 1`, `preference.exposure ≥ 16`, `openness ≥ 64`, `attitude ≥ 55`
- **rewards**: 690 cr, trust +12 · **penalties**: −90 cr, trust −4
- **return_profile**:
  - memory: theme «обнажённая демонстрация перед наблюдателями, слом стыда»; fragments [раздевание, фиксация в раскрытой позе, демонстрация зон, взгляды, слом, возвращение]; tags [exposure, humiliation, vulnerable, sexual, restraint]
  - acute_state: capacity→20, tension→60, sensitivity +5, attitude −8
  - recovery: baselineCapacityLimit 50%, отдых, 1–2 суток
  - traits: kept [trait_exhibitionist]; traumatic [trauma_public_exposure: паника при публичной наготе]; temporary [anomaly_exposure_echo: навязчивое желание снова быть увиденной, decay: время]
  - associations: traumatic [нагота→амбивалент, взгляды→негатив]; new [демонстрация→возбуждение]
  - relations: attitude −5, openness +8, plasticity +4
  - world_effects: facts [Veil провёл публичную экспозицию]; threads [повторная демонстрация]

## 4. contract_veil_clinical_01
- **format**: external_transfer · **duration**: 48 ч
- **title**: Клинический допуск
- **description**: Veil открывает серию инвазивных измерений. Актив, для которого медицинская рамка уже стала приемлемой, будет подвергнут полному гинекологическому и ректальному обследованию с инструментами, забором проб и длительным удержанием в раскрытом состоянии. Важна не покорность, а сочетание доверия к процедуре, пластичности и рабочего резерва.
- **conditions**: `trait_clinical_fetish ≥ 1`, `preference.clinical ≥ 15`, `plasticity ≥ 62`, `attitude ≥ 60`, `capacity ≥ 52`
- **rewards**: 840 cr, trust +16 · **penalties**: −120 cr, trust −6
- **return_profile**:
  - memory: theme «инвазивное клиническое обследование, тело как образец»; fragments [осмотр, инструменты, раскрытие, забор проб, удержание, возвращение]; tags [clinical, medical, penetration, exposure, restraint]
  - acute_state: capacity→15, tension→70, sensitivity +6, attitude −10
  - recovery: baselineCapacityLimit 40%, капсула, 2 суток
  - traits: kept [trait_clinical_fetish]; traumatic [trauma_clinical_invasive: страх перед инструментами]; temporary [anomaly_clinical_echo: навязчивое желание повторного осмотра, decay: восстановление]
  - associations: traumatic [инструменты→негатив, осмотр→амбивалент]; new [медицинская рамка→подчинение]
  - relations: attitude −6, openness +4, plasticity +7
  - world_effects: facts [Veil провёл инвазивный клинический протокол]; threads [серия измерений]

## 5. contract_veil_deprivation_01
- **format**: external_transfer · **duration**: 72 ч
- **title**: Сенсорная депривация
- **description**: Veil изучает отклик Аномалии на полное лишение сенсорного входа. Актив будет помещён в изолирующий кокон с заглушёнными зрением, слухом и осязанием, при этом удерживаемый на грани оргазма без разрядки. Ожидается глубокая диссоциация и аномальный отклик на пустоту.
- **conditions**: `trait_sensory_deprivation ≥ 1`, `preference.deprivation ≥ 15`, `plasticity ≥ 60`, `openness ≥ 60`
- **rewards**: 780 cr, trust +15 · **penalties**: −110 cr, trust −5
- **return_profile**:
  - memory: theme «пустота кокона, удержание на грани оргазма»; fragments [изоляция, заглушение чувств, удержание, диссоциация, пустота, возвращение]; tags [deprivation, restraint, sexual, anomaly, trance]
  - acute_state: capacity→10, tension→80, sensitivity +12, attitude −10
  - recovery: baselineCapacityLimit 30%, капсула + drug_neurostabilizer, 3 суток
  - traits: kept [trait_sensory_deprivation]; traumatic [trauma_isolation: паника в замкнутом пространстве]; temporary [anomaly_void_echo: тяга к пустоте, decay: восстановление]
  - associations: traumatic [изоляция→негатив, пустота→амбивалент]; new [Аномалия→пустота]
  - relations: attitude −8, openness +2, plasticity +8
  - world_effects: facts [Veil зафиксировал аномальный отклик на депривацию]; threads [изучение пустоты]

## 6. contract_veil_anomaly_01
- **format**: external_transfer · **duration**: 24 ч
- **title**: Аномальный отклик
- **description**: Veil ищет актив, чей профиль уже резонирует с Аномалией. Актив будет подвергнут короткой, но предельной серии стимуляции всех зон одновременно — боль, вибрация, электростимуляция и щекотка — чтобы спровоцировать прямой аномальный отклик. Ожидается временная потеря связности сознания и стойкий аномальный след.
- **conditions**: `sensitivity ≥ 75`, `plasticity ≥ 70`, `openness ≥ 70`, `trait_masochist ≥ 1`
- **rewards**: 950 cr, trust +20, `drug_sensitizer` · **penalties**: −150 cr, trust −8
- **return_profile**:
  - memory: theme «предельная стимуляция всех зон, прямой отклик Аномалии»; fragments [подготовка, одновременная стимуляция, перегрузка, отклик, потеря связности, возвращение]; tags [pain, electronic, tickling, vibration, anomaly, overload, trance]
  - acute_state: capacity→3, tension→95, sensitivity +15, attitude −15
  - recovery: baselineCapacityLimit 15%, капсула + drug_neurostabilizer, 4 суток
  - traits: kept [trait_masochist]; traumatic [trauma_anomaly_overload: флэшбеки и диссоциация при перегрузке]; temporary [anomaly_resonance_echo: навязчивый поиск перегрузки, decay: восстановление/работа с памятью]
  - associations: traumatic [перегрузка→негатив, Аномалия→пугающая]; new [Аномалия→притягательная]
  - relations: attitude −12, openness +6, plasticity +10
  - world_effects: facts [Veil спровоцировал прямой аномальный отклик]; threads [изучение аномального следа]

## 7. contract_veil_pharma_01
- **format**: external_transfer · **duration**: 48 ч
- **title**: Фармакологический разгон
- **description**: Veil тестирует линейку стимуляторов чувствительности. Актив будет накачан препаратами, разгоняющими нервную реактивность до предела, и удерживаем в состоянии гиперчувствительности, пока препараты не выветрятся. Ожидается нестабильность чувствительности и химическая зависимость от пика.
- **conditions**: `sensitivity ≥ 70`, `plasticity ≥ 60`, `openness ≥ 60`, `preference.chemical ≥ 12`
- **rewards**: 800 cr, trust +15, `drug_sensitizer` · **penalties**: −120 cr, trust −6
- **return_profile**:
  - memory: theme «химический разгон чувствительности до предела»; fragments [введение препаратов, разгон, гиперчувствительность, пик, выветривание, возвращение]; tags [chemical, sensitivity, overload, trance]
  - acute_state: capacity→8, tension→75, sensitivity +18, attitude −10
  - recovery: baselineCapacityLimit 25%, капсула + drug_neurostabilizer, 3 суток
  - traits: kept []; traumatic [trauma_chemical_peak: страх перед препаратами]; temporary [anomaly_chemical_echo: тяга к химическому пику, decay: восстановление]
  - associations: traumatic [препараты→амбивалент, пик→негатив]; new [химический пик→зависимость]
  - relations: attitude −7, openness +3, plasticity +6
  - world_effects: facts [Veil протестировал линейку стимуляторов]; threads [повторный фармакологический протокол]

## 8. contract_veil_vibration_01
- **format**: external_transfer · **duration**: 48 ч
- **title**: Непрерывная вибронагрузка
- **description**: Veil изучает отклик на непрерывную вибрационную стимуляцию гениталий. Актив будет закреплён на вибростанке с постоянной стимуляцией клитора и вагины, с периодическим доведением до оргазма и немедленным продолжением без паузы. Ожидается истощение и перестройка оргазменного порога.
- **conditions**: `trait_point_clitoris ≥ 1`, `preference.sexual ≥ 15`, `sensitivity ≥ 65`, `capacity ≥ 50`
- **rewards**: 760 cr, trust +14 · **penalties**: −100 cr, trust −5
- **return_profile**:
  - memory: theme «непрерывная вибрация, оргазм без паузы»; fragments [фиксация, вибрация, оргазм, продолжение, истощение, возвращение]; tags [vibration, sexual, clitoris, penetration, overload, exhaustion]
  - acute_state: capacity→6, tension→80, sensitivity +10, attitude −8
  - recovery: baselineCapacityLimit 25%, капсула, 3 суток
  - traits: kept [trait_point_clitoris]; traumatic [trauma_vibration_overload: паника при вибрации]; temporary [anomaly_vibration_echo: навязчивое желание вибрации, decay: восстановление]
  - associations: traumatic [вибрация→амбивалент, оргазм→негатив]; new [вибростанок→зависимость]
  - relations: attitude −6, openness +4, plasticity +5
  - world_effects: facts [Veil зафиксировал перестройку оргазменного порога]; threads [серия вибропротоколов]

## 9. contract_veil_electro_01
- **format**: external_transfer · **duration**: 36 ч
- **title**: Электростимуляционный контур
- **description**: Veil калибрует электростимуляционный контур на эрогенных зонах. Актив будет подключён к электродам на клиторе, сосках и анусе, с нарастающей силой разрядов до порога срыва. Ожидается перестройка нервной проводимости и электрофетишистский след.
- **conditions**: `trait_electrophile ≥ 1`, `preference.electronic ≥ 16`, `sensitivity ≥ 68`, `capacity ≥ 48`
- **rewards**: 790 cr, trust +15 · **penalties**: −110 cr, trust −5
- **return_profile**:
  - memory: theme «электроразряды на эрогенных зонах до порога срыва»; fragments [подключение, разряды, нарастание, срыв, возвращение]; tags [electronic, pain, sexual, clitoris, anus, overload]
  - acute_state: capacity→7, tension→85, sensitivity +12, attitude −10
  - recovery: baselineCapacityLimit 25%, капсула, 3 суток
  - traits: kept [trait_electrophile]; traumatic [trauma_electro: страх перед разрядами]; temporary [anomaly_electro_echo: тяга к разрядам, decay: восстановление]
  - associations: traumatic [разряды→амбивалент, электроды→негатив]; new [электростимуляция→зависимость]
  - relations: attitude −7, openness +3, plasticity +6
  - world_effects: facts [Veil откалибровал электростимуляционный контур]; threads [серия электропротоколов]

## 10. contract_veil_breakdown_01
- **format**: external_transfer · **duration**: 72 ч
- **title**: Срыв и пересборка
- **description**: Veil ищет актив для полного срыва и последующей пересборки личности. Актив будет доведён до полного сенсорного и психологического срыва комбинированной стимуляцией, после чего пересобран под новый профиль. Ожидается глубокая травма и необратимая перестройка.
- **conditions**: `plasticity ≥ 75`, `openness ≥ 70`, `capacity ≥ 55`, `attitude ≥ 50`
- **rewards**: 1000 cr, trust +22, `drug_plasticity_catalyst` · **penalties**: −160 cr, trust −10
- **return_profile**:
  - memory: theme «полный срыв и пересборка личности»; fragments [подготовка, комбинированная стимуляция, срыв, пустота, пересборка, возвращение]; tags [overload, pain, sexual, anomaly, trance, breakdown]
  - acute_state: capacity→2, tension→95, sensitivity +10, attitude −20
  - recovery: baselineCapacityLimit 15%, капсула + drug_neurostabilizer + drug_plasticity_catalyst, 5 суток
  - traits: kept []; traumatic [trauma_breakdown: глубокая диссоциация и флэшбеки]; temporary [anomaly_rebuild_echo: навязчивый поиск нового «я», decay: работа с памятью]
  - associations: traumatic [срыв→негатив, пересборка→амбивалент]; new [Аномалия→пересборка]
  - relations: attitude −15, openness +8, plasticity +12
  - world_effects: facts [Veil провёл полный срыв и пересборку]; threads [изучение пересобранного профиля]

---

# Helix Dynamics — стандартизация, обусловливание, предсказуемость

## 11. contract_helix_compliance_01
- **format**: lab_protocol · **duration**: 24 ч
- **title**: Повторяемый отклик
- **description**: Helix валидирует стандартный поведенческий профиль для линейки процедур. Актив должен демонстрировать предсказуемый отклик на стандартную серию команд и стимуляции, превращая внешнее требование в устойчивую реакцию. Ожидается закрепление обусловленной покорности.
- **conditions**: `trait_conditioned_submission ≥ 2`, `attitude ≥ 72`, `openness ≥ 70`, `plasticity ≥ 66`
- **rewards**: 820 cr, trust +15, `eq_handcuffs` · **penalties**: −100 cr, trust −5
- **return_profile**:
  - memory: theme «стандартная серия команд, тело отвечает само»; fragments [инструктаж, серия команд, отклик, закрепление, возвращение]; tags [command, submission, control, conditioning]
  - acute_state: capacity→25, tension→50, sensitivity +3, attitude +5
  - recovery: baselineCapacityLimit 60%, отдых, 1 сутки
  - traits: kept [trait_conditioned_submission]; traumatic []; temporary [anomaly_command_echo: навязчивое ожидание команд, decay: время]
  - associations: new [команда→подчинение, инструкция→безопасность]
  - relations: attitude +8, openness +5, plasticity +5
  - world_effects: facts [Helix валидировал стандартный профиль]; threads [серия стандартных процедур]

## 12. contract_helix_restraint_01
- **format**: external_transfer · **duration**: 36 ч
- **title**: Контур фиксации
- **description**: Инженеры Helix калибруют систему контроля позы. Актив будет закреплён в жёсткой фиксации — наручники, ошейник, ремни — и удерживаем в заданных позах длительное время, с периодической стимуляцией для проверки отклика. Ожидается закрепление фетиша фиксации.
- **conditions**: `trait_restraint_fetish ≥ 1`, `preference.restraint ≥ 17`, `capacity ≥ 58`, `openness ≥ 58`
- **rewards**: 730 cr, trust +13 · **penalties**: −90 cr, trust −4
- **return_profile**:
  - memory: theme «жёсткая фиксация, тело в ремнях»; fragments [надевание ремней, фиксация, удержание, стимуляция, возвращение]; tags [restraint, control, submission, exposure]
  - acute_state: capacity→18, tension→60, sensitivity +4, attitude +3
  - recovery: baselineCapacityLimit 50%, отдых, 2 суток
  - traits: kept [trait_restraint_fetish]; traumatic [trauma_restraint: паника при длительной фиксации]; temporary [anomaly_restraint_echo: тяга к фиксации, decay: время]
  - associations: new [фиксация→безопасность, ремни→возбуждение]
  - relations: attitude +6, openness +4, plasticity +4
  - world_effects: facts [Helix откалибровал контур фиксации]; threads [серия фиксаций]

## 13. contract_helix_interface_01
- **format**: external_transfer · **duration**: 24 ч
- **title**: Интерфейсный профиль
- **description**: Helix готовит тестовый пул для сенсорного интерфейса. Актив должен положительно реагировать на электронные средства стимуляции, демонстрируя высокую чувствительность и принятие оператора. Ожидается закрепление технофильного отклика.
- **conditions**: `trait_technophile ≥ 1`, `preference.electronic ≥ 16`, `sensitivity ≥ 65`, `attitude ≥ 65`
- **rewards**: 760 cr, trust +14 · **penalties**: −100 cr, trust −5
- **return_profile**:
  - memory: theme «электронный интерфейс, машина как оператор»; fragments [подключение, интерфейс, стимуляция, принятие, возвращение]; tags [electronic, machine, stimulation, submission]
  - acute_state: capacity→22, tension→55, sensitivity +5, attitude +4
  - recovery: baselineCapacityLimit 55%, отдых, 1–2 суток
  - traits: kept [trait_technophile]; traumatic []; temporary [anomaly_interface_echo: навязчивое желание интерфейса, decay: время]
  - associations: new [машина→оператор, интерфейс→возбуждение]
  - relations: attitude +7, openness +5, plasticity +5
  - world_effects: facts [Helix включил актив в тестовый пул]; threads [серия интерфейсных тестов]

## 14. contract_helix_conditioning_01
- **format**: external_transfer · **duration**: 48 ч
- **title**: Обусловленная покорность
- **description**: Helix проводит полный цикл обусловливания: актив будет приучен отвечать на команды немедленным подчинением через сочетание награды и наказания. Ожидается глубокая перестройка воли и закрепление покорности как рефлекса.
- **conditions**: `trait_conditioned_submission ≥ 1`, `plasticity ≥ 70`, `attitude ≥ 60`, `openness ≥ 60`
- **rewards**: 850 cr, trust +17, `eq_collar` · **penalties**: −120 cr, trust −6
- **return_profile**:
  - memory: theme «обусловливание, воля перестроена в рефлекс»; fragments [инструктаж, награда, наказание, закрепление, возвращение]; tags [command, submission, conditioning, control]
  - acute_state: capacity→15, tension→65, sensitivity +3, attitude +8
  - recovery: baselineCapacityLimit 45%, отдых, 2 суток
  - traits: kept [trait_conditioned_submission]; traumatic [trauma_conditioning: страх перед наказанием]; temporary [anomaly_submission_echo: навязчивое подчинение, decay: время]
  - associations: new [команда→рефлекс, наказание→страх, награда→зависимость]
  - relations: attitude +10, openness +6, plasticity +8
  - world_effects: facts [Helix провёл полный цикл обусловливания]; threads [серия обусловливаний]

## 15. contract_helix_pose_01
- **format**: lab_protocol · **duration**: 24 ч
- **title**: Стандартизация позы
- **description**: Helix стандартизирует набор рабочих поз для активов. Актив будет обучен принимать и удерживать заданные позы — на коленях, раскрытая, согнутая — по команде, с фиксацией и проверкой точности. Ожидается закрепление позной дисциплины.
- **conditions**: `trait_conditioned_submission ≥ 1`, `attitude ≥ 65`, `openness ≥ 60`, `plasticity ≥ 60`
- **rewards**: 700 cr, trust +12 · **penalties**: −80 cr, trust −4
- **return_profile**:
  - memory: theme «обучение позам, тело принимает форму по команде»; fragments [инструктаж, позы, фиксация, проверка, возвращение]; tags [pose, submission, control, exposure]
  - acute_state: capacity→28, tension→45, sensitivity +2, attitude +5
  - recovery: baselineCapacityLimit 65%, отдых, 1 сутки
  - traits: kept [trait_conditioned_submission]; traumatic []; temporary [anomaly_pose_echo: навязчивое принятие поз, decay: время]
  - associations: new [поза→подчинение, команда→форма]
  - relations: attitude +6, openness +4, plasticity +4
  - world_effects: facts [Helix стандартизировал набор поз]; threads [серия позных тренировок]

## 16. contract_helix_voice_01
- **format**: external_transfer · **duration**: 36 ч
- **title**: Голосовое подчинение
- **description**: Helix калибрует голосовой контур управления. Актив будет приучен реагировать на голосовые команды оператора немедленным действием, с наказанием за задержку. Ожидается закрепление голосового рефлекса подчинения.
- **conditions**: `trait_conditioned_submission ≥ 1`, `attitude ≥ 70`, `plasticity ≥ 65`, `openness ≥ 60`
- **rewards**: 740 cr, trust +14 · **penalties**: −100 cr, trust −5
- **return_profile**:
  - memory: theme «голос оператора, тело подчиняется само»; fragments [инструктаж, голосовые команды, наказание, закрепление, возвращение]; tags [command, voice, submission, conditioning]
  - acute_state: capacity→20, tension→60, sensitivity +3, attitude +7
  - recovery: baselineCapacityLimit 50%, отдых, 2 суток
  - traits: kept [trait_conditioned_submission]; traumatic [trauma_voice: страх перед голосом оператора]; temporary [anomaly_voice_echo: навязчивое ожидание голоса, decay: время]
  - associations: new [голос→подчинение, команда→рефлекс]
  - relations: attitude +9, openness +5, plasticity +6
  - world_effects: facts [Helix откалибровал голосовой контур]; threads [серия голосовых тренировок]

## 17. contract_helix_predictable_01
- **format**: lab_protocol · **duration**: 24 ч
- **title**: Предсказуемая реакция
- **description**: Helix валидирует предсказуемость реакции на стандартную стимуляцию. Актив должен демонстрировать одинаковый отклик на одинаковые стимулы, без отклонений. Ожидается закрепление стабильного поведенческого профиля.
- **conditions**: `trait_conditioned_submission ≥ 1`, `attitude ≥ 68`, `openness ≥ 65`, `plasticity ≥ 60`
- **rewards**: 680 cr, trust +12 · **penalties**: −80 cr, trust −4
- **return_profile**:
  - memory: theme «одинаковый отклик на одинаковые стимулы»; fragments [инструктаж, серия стимулов, отклик, проверка, возвращение]; tags [command, submission, conditioning, stimulation]
  - acute_state: capacity→30, tension→40, sensitivity +2, attitude +4
  - recovery: baselineCapacityLimit 70%, отдых, 1 сутки
  - traits: kept [trait_conditioned_submission]; traumatic []; temporary [anomaly_predictable_echo: навязчивое повторение отклика, decay: время]
  - associations: new [стимул→отклик, предсказуемость→безопасность]
  - relations: attitude +5, openness +4, plasticity +4
  - world_effects: facts [Helix валидировал предсказуемость]; threads [серия валидаций]

## 18. contract_helix_endurance_01
- **format**: external_transfer · **duration**: 48 ч
- **title**: Серийная выносливость
- **description**: Helix тестирует выносливость актива в серийных процедурах. Актив будет подвергнут длинной серии стандартных стимуляций без перерыва, с проверкой сохранения отклика. Ожидается истощение и закрепление рабочего резерва.
- **conditions**: `capacity ≥ 60`, `attitude ≥ 60`, `openness ≥ 60`, `plasticity ≥ 55`
- **rewards**: 720 cr, trust +13 · **penalties**: −90 cr, trust −4
- **return_profile**:
  - memory: theme «длинная серия процедур без перерыва»; fragments [инструктаж, серия, усталость, сохранение отклика, возвращение]; tags [stimulation, endurance, exhaustion, submission]
  - acute_state: capacity→10, tension→70, sensitivity +3, attitude +3
  - recovery: baselineCapacityLimit 35%, капсула, 2–3 суток
  - traits: kept []; traumatic [trauma_endurance: страх перед длинными сериями]; temporary [anomaly_endurance_echo: навязчивое желание продолжать, decay: восстановление]
  - associations: new [серия→работа, усталость→норма]
  - relations: attitude +4, openness +3, plasticity +4
  - world_effects: facts [Helix протестировал серийную выносливость]; threads [серия тестов выносливости]

## 19. contract_helix_threshold_01
- **format**: external_transfer · **duration**: 36 ч
- **title**: Нормализация порога
- **description**: Helix нормализует порог реакции актива. Актив будет подвергнут нарастающей стимуляции до определения стабильного порога, после чего порог будет зафиксирован повторными сериями. Ожидается стабилизация чувствительности.
- **conditions**: `sensitivity ≥ 60`, `plasticity ≥ 60`, `attitude ≥ 60`, `capacity ≥ 55`
- **rewards**: 710 cr, trust +13 · **penalties**: −90 cr, trust −4
- **return_profile**:
  - memory: theme «определение и фиксация порога реакции»; fragments [инструктаж, нарастание, порог, фиксация, возвращение]; tags [stimulation, threshold, conditioning, submission]
  - acute_state: capacity→16, tension→60, sensitivity +4, attitude +4
  - recovery: baselineCapacityLimit 45%, отдых, 2 суток
  - traits: kept []; traumatic [trauma_threshold: страх перед нарастанием]; temporary [anomaly_threshold_echo: навязчивое ожидание порога, decay: время]
  - associations: new [порог→норма, нарастание→ожидание]
  - relations: attitude +5, openness +4, plasticity +5
  - world_effects: facts [Helix нормализовал порог реакции]; threads [серия нормализаций]

## 20. contract_helix_loyalty_01
- **format**: external_transfer · **duration**: 48 ч
- **title**: Лояльность
- **description**: Helix формирует лояльность актива к оператору. Актив будет подвергнут сочетанию награды и наказания, привязывающему его к оператору как источнику безопасности. Ожидается закрепление зависимости от оператора.
- **conditions**: `attitude ≥ 70`, `plasticity ≥ 65`, `openness ≥ 60`, `trait_conditioned_submission ≥ 1`
- **rewards**: 830 cr, trust +16, `eq_collar` · **penalties**: −110 cr, trust −6
- **return_profile**:
  - memory: theme «оператор как источник безопасности, зависимость»; fragments [инструктаж, награда, наказание, привязка, возвращение]; tags [command, submission, conditioning, dependency]
  - acute_state: capacity→18, tension→60, sensitivity +3, attitude +10
  - recovery: baselineCapacityLimit 50%, отдых, 2 суток
  - traits: kept [trait_conditioned_submission]; traumatic [trauma_loyalty: страх потери оператора]; temporary [anomaly_loyalty_echo: навязчивая привязанность, decay: время]
  - associations: new [оператор→безопасность, награда→зависимость]
  - relations: attitude +12, openness +6, plasticity +7
  - world_effects: facts [Helix сформировал лояльность актива]; threads [серия привязок]

---

# Continuum Archive — наблюдение, пластичность, данные

## 21. contract_continuum_drift_01
- **format**: external_transfer · **duration**: 5 суток
- **title**: Карта медленного дрейфа
- **description**: Continuum собирает долгую последовательность наблюдений. Актив с подвижной базой будет помещён под длительное наблюдение с мягкой, но постоянной стимуляцией, чтобы зафиксировать медленный дрейф параметров. Ожидается пластический сдвиг без срыва.
- **conditions**: `plasticity ≥ 76`, `openness ≥ 72`, `capacity ≥ 50`, `attitude ≥ 52`
- **rewards**: 680 cr, trust +15 · **penalties**: −80 cr, trust −4
- **return_profile**:
  - memory: theme «долгое наблюдение, медленный дрейф»; fragments [помещение, наблюдение, мягкая стимуляция, дрейф, возвращение]; tags [observation, stimulation, plasticity, drift]
  - acute_state: capacity→30, tension→40, sensitivity +2, attitude +2
  - recovery: baselineCapacityLimit 70%, отдых, 1 сутки
  - traits: kept []; traumatic []; temporary [anomaly_drift_echo: навязчивое самонаблюдение, decay: время]
  - associations: new [наблюдение→норма, дрейф→интерес]
  - relations: attitude +3, openness +5, plasticity +6
  - world_effects: facts [Continuum зафиксировал медленный дрейф]; threads [долгое наблюдение]

## 22. contract_continuum_crossindex_01
- **format**: external_transfer · **duration**: 48 ч
- **title**: Перекрёстный индекс
- **description**: Continuum сверяет биометрические записи с субъективной оценкой процедуры. Актив с двумя независимыми ассоциативными контурами (медицинский и электронный) будет подвергнут комбинированной стимуляции для разделения общего сдвига от случайной реакции.
- **conditions**: `preference.clinical ≥ 13`, `preference.electronic ≥ 13`, `plasticity ≥ 68`, `sensitivity ≥ 58`
- **rewards**: 740 cr, trust +16 · **penalties**: −100 cr, trust −5
- **return_profile**:
  - memory: theme «комбинированная стимуляция, разделение сдвигов»; fragments [подготовка, медицинская стимуляция, электронная стимуляция, сверка, возвращение]; tags [clinical, electronic, stimulation, observation]
  - acute_state: capacity→20, tension→55, sensitivity +4, attitude +2
  - recovery: baselineCapacityLimit 55%, отдых, 2 суток
  - traits: kept [trait_clinical_fetish, trait_electrophile]; traumatic []; temporary [anomaly_crossindex_echo: навязчивое сравнение ощущений, decay: время]
  - associations: new [медицинский контур→данные, электронный контур→данные]
  - relations: attitude +3, openness +5, plasticity +5
  - world_effects: facts [Continuum свёл перекрёстный индекс]; threads [серия сверок]

## 23. contract_continuum_recovery_01
- **format**: lab_protocol · **duration**: 3 суток
- **title**: Устойчивое восстановление
- **description**: Continuum наблюдает за возвращением актива к рабочему состоянию после нагрузки. Актив будет подвергнут умеренной нагрузке, после чего за ним будет вестись наблюдение в процессе восстановления. Ожидается фиксация темпа восстановления.
- **conditions**: `capacity ≥ 68`, `sensitivity ≥ 50`, `attitude ≥ 62`, `openness ≥ 60`
- **rewards**: 650 cr, trust +13 · **penalties**: −70 cr, trust −3
- **return_profile**:
  - memory: theme «нагрузка и наблюдение за восстановлением»; fragments [нагрузка, наблюдение, восстановление, фиксация, возвращение]; tags [observation, recovery, stimulation]
  - acute_state: capacity→35, tension→35, sensitivity +1, attitude +2
  - recovery: baselineCapacityLimit 80%, отдых, 1 сутки
  - traits: kept []; traumatic []; temporary []
  - associations: new [восстановление→норма, наблюдение→безопасность]
  - relations: attitude +3, openness +4, plasticity +3
  - world_effects: facts [Continuum зафиксировал темп восстановления]; threads [серия наблюдений за восстановлением]

## 24. contract_continuum_observation_01
- **format**: external_transfer · **duration**: 7 суток
- **title**: Долгое наблюдение
- **description**: Continuum собирает долговременные данные об активе. Актив будет помещён под длительное наблюдение с минимальной стимуляцией, чтобы зафиксировать естественный дрейф параметров и ассоциаций. Ожидается накопление данных без вмешательства.
- **conditions**: `plasticity ≥ 70`, `openness ≥ 70`, `capacity ≥ 50`, `attitude ≥ 50`
- **rewards**: 700 cr, trust +16 · **penalties**: −80 cr, trust −4
- **return_profile**:
  - memory: theme «долгое наблюдение, естественный дрейф»; fragments [помещение, наблюдение, минимальная стимуляция, дрейф, возвращение]; tags [observation, drift, plasticity]
  - acute_state: capacity→40, tension→30, sensitivity +1, attitude +1
  - recovery: baselineCapacityLimit 85%, отдых, 1 сутки
  - traits: kept []; traumatic []; temporary []
  - associations: new [наблюдение→норма]
  - relations: attitude +2, openness +4, plasticity +5
  - world_effects: facts [Continuum накопил долговременные данные]; threads [долгое наблюдение]

## 25. contract_continuum_mapping_01
- **format**: external_transfer · **duration**: 48 ч
- **title**: Ассоциативное картирование
- **description**: Continuum картирует ассоциативные связи актива. Актив будет подвергнут серии стимулов, каждый из которых привязан к определённому контексту, чтобы зафиксировать формирование и затухание ассоциаций. Ожидается полная карта ассоциативного поля.
- **conditions**: `plasticity ≥ 72`, `openness ≥ 68`, `sensitivity ≥ 55`, `attitude ≥ 50`
- **rewards**: 730 cr, trust +15 · **penalties**: −90 cr, trust −4
- **return_profile**:
  - memory: theme «картирование ассоциаций, стимулы и контексты»; fragments [подготовка, серия стимулов, контексты, фиксация, возвращение]; tags [observation, stimulation, association, plasticity]
  - acute_state: capacity→25, tension→50, sensitivity +3, attitude +2
  - recovery: baselineCapacityLimit 60%, отдых, 2 суток
  - traits: kept []; traumatic []; temporary [anomaly_mapping_echo: навязчивое связывание стимулов, decay: время]
  - associations: new [стимул→контекст, ассоциация→данные]
  - relations: attitude +3, openness +5, plasticity +6
  - world_effects: facts [Continuum построил карту ассоциаций]; threads [серия картирований]

## 26. contract_continuum_plasticity_01
- **format**: external_transfer · **duration**: 48 ч
- **title**: Пластический сдвиг
- **description**: Continuum изучает пластический сдвиг актива. Актив будет подвергнут серии новых стимулов, чтобы зафиксировать скорость и глубину пластической перестройки. Ожидается измерение пластичности как параметра.
- **conditions**: `plasticity ≥ 75`, `openness ≥ 70`, `capacity ≥ 50`, `attitude ≥ 50`
- **rewards**: 750 cr, trust +16 · **penalties**: −90 cr, trust −4
- **return_profile**:
  - memory: theme «пластическая перестройка, новые стимулы»; fragments [подготовка, новые стимулы, перестройка, фиксация, возвращение]; tags [plasticity, stimulation, observation, drift]
  - acute_state: capacity→22, tension→50, sensitivity +3, attitude +2
  - recovery: baselineCapacityLimit 55%, отдых, 2 суток
  - traits: kept []; traumatic []; temporary [anomaly_plasticity_echo: навязчивый поиск нового, decay: время]
  - associations: new [новый стимул→интерес, перестройка→данные]
  - relations: attitude +3, openness +6, plasticity +7
  - world_effects: facts [Continuum измерил пластический сдвиг]; threads [серия измерений пластичности]

## 27. contract_continuum_archive_01
- **format**: external_transfer · **duration**: 24 ч
- **title**: Архивная фиксация
- **description**: Continuum фиксирует текущее состояние актива в архив. Актив будет подвергнут стандартной серии измерений и стимуляции для создания полного снимка параметров и ассоциаций. Ожидается архивная запись без последствий.
- **conditions**: `openness ≥ 60`, `plasticity ≥ 60`, `attitude ≥ 55`, `capacity ≥ 50`
- **rewards**: 620 cr, trust +12 · **penalties**: −70 cr, trust −3
- **return_profile**:
  - memory: theme «архивная фиксация, снимок состояния»; fragments [подготовка, измерения, стимуляция, фиксация, возвращение]; tags [observation, measurement, stimulation]
  - acute_state: capacity→40, tension→30, sensitivity +1, attitude +1
  - recovery: baselineCapacityLimit 85%, отдых, 1 сутки
  - traits: kept []; traumatic []; temporary []
  - associations: new [измерение→норма]
  - relations: attitude +2, openness +3, plasticity +3
  - world_effects: facts [Continuum создал архивную запись]; threads [серия фиксаций]

## 28. contract_continuum_comparative_01
- **format**: external_transfer · **duration**: 48 ч
- **title**: Сравнительный дрейф
- **description**: Continuum сравнивает дрейф актива с архивными записями. Актив будет подвергнут той же серии стимулов, что и в прошлой фиксации, чтобы измерить разницу. Ожидается сравнительный анализ дрейфа.
- **conditions**: `plasticity ≥ 70`, `openness ≥ 65`, `capacity ≥ 50`, `attitude ≥ 50`
- **rewards**: 690 cr, trust +14 · **penalties**: −80 cr, trust −4
- **return_profile**:
  - memory: theme «сравнение с прошлым, измерение дрейфа»; fragments [подготовка, повторная серия, сравнение, фиксация, возвращение]; tags [observation, drift, stimulation, comparison]
  - acute_state: capacity→28, tension→45, sensitivity +2, attitude +2
  - recovery: baselineCapacityLimit 65%, отдых, 1–2 суток
  - traits: kept []; traumatic []; temporary [anomaly_comparative_echo: навязчивое сравнение с прошлым, decay: время]
  - associations: new [прошлое→сравнение, дрейф→данные]
  - relations: attitude +3, openness +4, plasticity +5
  - world_effects: facts [Continuum измерил сравнительный дрейф]; threads [серия сравнений]

## 29. contract_continuum_biography_01
- **format**: external_transfer · **duration**: 72 ч
- **title**: Сенсорная биография
- **description**: Continuum собирает полную сенсорную биографию актива. Актив будет подвергнут последовательной стимуляции всех зон в хронологическом порядке, чтобы зафиксировать историю сенсорного опыта. Ожидается полная сенсорная карта.
- **conditions**: `openness ≥ 70`, `plasticity ≥ 65`, `sensitivity ≥ 60`, `attitude ≥ 55`
- **rewards**: 770 cr, trust +16 · **penalties**: −100 cr, trust −5
- **return_profile**:
  - memory: theme «полная сенсорная биография, все зоны по порядку»; fragments [подготовка, последовательная стимуляция, фиксация, возвращение]; tags [observation, stimulation, mapping, biography]
  - acute_state: capacity→18, tension→55, sensitivity +4, attitude +2
  - recovery: baselineCapacityLimit 50%, отдых, 2 суток
  - traits: kept []; traumatic []; temporary [anomaly_biography_echo: навязчивое переживание прошлого, decay: время]
  - associations: new [зона→история, стимуляция→данные]
  - relations: attitude +3, openness +5, plasticity +5
  - world_effects: facts [Continuum собрал сенсорную биографию]; threads [серия биографий]

## 30. contract_continuum_anomaly_trace_01
- **format**: external_transfer · **duration**: 48 ч
- **title**: Аномальный след
- **description**: Continuum изучает аномальный след в профиле актива. Актив с уже зафиксированным аномальным откликом будет подвергнут мягкой стимуляции для наблюдения за проявлением следа. Ожидается картирование аномального влияния.
- **conditions**: `plasticity ≥ 70`, `openness ≥ 70`, `sensitivity ≥ 65`, `attitude ≥ 50`
- **rewards**: 800 cr, trust +17 · **penalties**: −110 cr, trust −5
- **return_profile**:
  - memory: theme «наблюдение за аномальным следом»; fragments [подготовка, мягкая стимуляция, проявление следа, фиксация, возвращение]; tags [anomaly, observation, stimulation, trace]
  - acute_state: capacity→20, tension→60, sensitivity +6, attitude +2
  - recovery: baselineCapacityLimit 50%, капсула, 2 суток
  - traits: kept []; traumatic []; temporary [anomaly_trace_echo: навязчивое проявление следа, decay: восстановление]
  - associations: new [Аномалия→след, стимуляция→проявление]
  - relations: attitude +2, openness +6, plasticity +6
  - world_effects: facts [Continuum закартировал аномальный след]; threads [изучение аномального следа]

---

## Сводка трейтов (новые, добавляются в `traits.json`)

**Травматические (`trauma_*`)** — страх/избегание/флэшбеки/перегрузка на конкретный стимул:
`trauma_foot_stimulation`, `trauma_pain_resonance`, `trauma_public_exposure`, `trauma_clinical_invasive`,
`trauma_isolation`, `trauma_anomaly_overload`, `trauma_chemical_peak`, `trauma_vibration_overload`,
`trauma_electro`, `trauma_breakdown`, `trauma_restraint`, `trauma_conditioning`, `trauma_voice`,
`trauma_endurance`, `trauma_threshold`, `trauma_loyalty`.

**Временные аномальные (`anomaly_*_echo`)** — навязчивый импульс, противоречащий травме, с условием ослабления:
`anomaly_foot_echo`, `anomaly_pain_echo`, `anomaly_exposure_echo`, `anomaly_clinical_echo`,
`anomaly_void_echo`, `anomaly_resonance_echo`, `anomaly_chemical_echo`, `anomaly_vibration_echo`,
`anomaly_electro_echo`, `anomaly_rebuild_echo`, `anomaly_command_echo`, `anomaly_restraint_echo`,
`anomaly_interface_echo`, `anomaly_submission_echo`, `anomaly_pose_echo`, `anomaly_voice_echo`,
`anomaly_predictable_echo`, `anomaly_endurance_echo`, `anomaly_threshold_echo`, `anomaly_loyalty_echo`,
`anomaly_drift_echo`, `anomaly_crossindex_echo`, `anomaly_mapping_echo`, `anomaly_plasticity_echo`,
`anomaly_comparative_echo`, `anomaly_biography_echo`, `anomaly_trace_echo`.

**Сохраняемые (`kept`)** — физиологический фокус не стирается: `trait_point_*`, `trait_knismolagnia`,
`trait_masochist`, `trait_restraint_fetish`, `trait_exhibitionist`, `trait_clinical_fetish`,
`trait_electrophile`, `trait_technophile`, `trait_conditioned_submission`, `trait_sensory_deprivation`.
