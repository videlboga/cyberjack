# Omnicron — конструктор личности (пересобранная основа)

Ладно, давай без этих полумер и корпоративного вайба.

Здесь никто никуда не прилетал и не улетает. Станция — это не перевалочный пункт, а замкнутый мир, который пережил слишком много поколений, чтобы помнить своё происхождение. Люди здесь рождаются, живут и умирают, не имея внешнего контекста.

И ещё важное: **персонаж — это не “он”**, а **"ты"**. Это набор внутренних формулировок, привычек, реакций. Не биография, а слоёная инструкция по существованию.

Актив — это не должность. Это состояние. Ты — объект, через который что-то делают, наблюдают, проверяют, ломают, иногда берегут. Иногда ты сам на это согласился. Иногда нет. Иногда уже не помнишь.

---

# 1. Принцип сборки личности

Персонаж собирается из кусочков:

- **origin_place** — где ты вырос
- **origin_activity** — чем ты занимался с детства
- **origin_condition** — в каких условиях формировался
- **event** — маленькие, но формирующие эпизоды
- **trait** — поведенческие паттерны (всегда через "ты")

Все формулировки:
- короткие
- телесные или поведенческие
- без пафоса
- без внешнего нарратива

Плохо: “Он пережил тяжёлое детство”
Хорошо: “Ты привык не рассчитывать, что тебя кто-то защитит”

---

# 2. origin_place — где ты вырос

```json
[
  {
    "id": "origin_place_lower_ducts",
    "level": "origin",
    "type": "place",
    "text": "Ты вырос в нижних технических уровнях, где всегда шумно и пахнет горячим металлом",
    "keys": ["низ", "шум", "теснота", "трубы"],
    "weight": 8
  },
  {
    "id": "origin_place_clean_sector",
    "level": "origin",
    "type": "place",
    "text": "Ты вырос в чистом секторе, где всё работало чуть лучше, чем должно",
    "keys": ["чистота", "контроль", "контраст"],
    "weight": 5
  },
  {
    "id": "origin_place_corridor",
    "level": "origin",
    "type": "place",
    "text": "Ты вырос прямо в коридорах, где у людей нет чёткой границы между личным и общим",
    "keys": ["коридор", "люди", "общая жизнь"],
    "weight": 9
  },
  {
    "id": "origin_place_near_breach_zone",
    "level": "origin",
    "type": "place",
    "text": "Ты вырос рядом с зоной, где иногда происходят странные вещи, о которых не принято говорить",
    "keys": ["аномалия", "страх", "привычка"],
    "weight": 7
  }
]
```

---

# 3. origin_activity — чем ты занимался

```json
[
  {
    "id": "origin_activity_helped_maintenance",
    "level": "origin",
    "type": "activity",
    "text": "С детства ты помогал чинить вещи, даже если тебя об этом не просили",
    "keys": ["ремонт", "полезность"],
    "weight": 8
  },
  {
    "id": "origin_activity_ran_errands",
    "level": "origin",
    "type": "activity",
    "text": "Ты постоянно носил чужие вещи и сообщения, потому что тебе доверяли или просто использовали",
    "keys": ["поручения", "движение", "использование"],
    "weight": 8
  },
  {
    "id": "origin_activity_watched_people",
    "level": "origin",
    "type": "activity",
    "text": "Ты много наблюдал за людьми, потому что это было безопаснее, чем вмешиваться",
    "keys": ["наблюдение", "осторожность"],
    "weight": 7
  },
  {
    "id": "origin_activity_traded_small",
    "level": "origin",
    "type": "activity",
    "text": "Ты рано начал обменивать вещи, услуги и информацию",
    "keys": ["обмен", "выгода"],
    "weight": 7
  }
]
```

---

# 4. origin_condition — в каких условиях ты формировался

```json
[
  {
    "id": "origin_condition_no_privacy",
    "level": "origin",
    "type": "condition",
    "text": "У тебя никогда не было нормального личного пространства",
    "keys": ["теснота", "границы"],
    "weight": 9
  },
  {
    "id": "origin_condition_constant_noise",
    "level": "origin",
    "type": "condition",
    "text": "Ты привык к постоянному фоновому шуму и плохо переносишь тишину",
    "keys": ["шум", "среда"],
    "weight": 7
  },
  {
    "id": "origin_condition_unstable_adults",
    "level": "origin",
    "type": "condition",
    "text": "Взрослые вокруг тебя были ненадёжны или временные",
    "keys": ["нестабильность", "детство"],
    "weight": 8
  },
  {
    "id": "origin_condition_overcontrolled",
    "level": "origin",
    "type": "condition",
    "text": "Твою жизнь слишком жёстко контролировали, и ты привык жить по правилам или ломать их",
    "keys": ["контроль", "дисциплина"],
    "weight": 6
  }
]
```

---

# 5. events — маленькие личные истории

Не эпос. Короткие удары по психике.

```json
[
  {
    "id": "event_left_waiting",
    "level": "event",
    "text": "Однажды тебе сказали подождать, и за тобой не вернулись",
    "weight": 8
  },
  {
    "id": "event_saw_wrong_thing",
    "level": "event",
    "text": "Ты увидел что-то, что не должен был видеть, и сделал вид, что этого не было",
    "weight": 9
  },
  {
    "id": "event_helped_and_regretted",
    "level": "event",
    "text": "Ты помог кому-то, и это обернулось проблемой для тебя",
    "weight": 7
  },
  {
    "id": "event_didnt_help",
    "level": "event",
    "text": "Ты не вмешался, когда мог, и это осталось с тобой",
    "weight": 9
  },
  {
    "id": "event_was_used",
    "level": "event",
    "text": "Тебя использовали, и ты понял это слишком поздно",
    "weight": 8
  },
  {
    "id": "event_someone_was_kind",
    "level": "event",
    "text": "Кто-то сделал для тебя что-то хорошее без причины, и ты до сих пор не понимаешь зачем",
    "weight": 6
  }
]
```

---

# 6. traits — поведенческие куски личности

Главное правило: это не описание, а инструкция.

```json
[
  {
    "id": "trait_scan_exits",
    "level": "trait",
    "text": "Ты всегда отмечаешь, где выход",
    "weight": 9
  },
  {
    "id": "trait_speak_less",
    "level": "trait",
    "text": "Ты говоришь меньше, чем знаешь",
    "weight": 9
  },
  {
    "id": "trait_expect_cost",
    "level": "trait",
    "text": "Ты ожидаешь, что за всё придётся платить",
    "weight": 8
  },
  {
    "id": "trait_fix_things",
    "level": "trait",
    "text": "Ты пытаешься чинить всё, что можно починить",
    "weight": 8
  },
  {
    "id": "trait_avoid_attention",
    "level": "trait",
    "text": "Ты стараешься не привлекать к себе лишнего внимания",
    "weight": 8
  },
  {
    "id": "trait_joke_when_bad",
    "level": "trait",
    "text": "Ты шутишь, когда становится хуже",
    "weight": 7
  },
  {
    "id": "trait_need_control",
    "level": "trait",
    "text": "Ты пытаешься держать ситуацию под контролем, даже когда это невозможно",
    "weight": 7
  },
  {
    "id": "trait_dont_trust_promises",
    "level": "trait",
    "text": "Ты не веришь расплывчатым обещаниям",
    "weight": 8
  },
  {
    "id": "trait_watch_people",
    "level": "trait",
    "text": "Ты сначала смотришь, потом действуешь",
    "weight": 7
  },
  {
    "id": "trait_remember_small",
    "level": "trait",
    "text": "Ты запоминаешь мелкие детали, которые другие игнорируют",
    "weight": 7
  }
]
```

---

# 7. актив — отдельный слой

Это не роль, а состояние, которое накладывается поверх.

```json
[
  {
    "id": "active_voluntary",
    "level": "state",
    "text": "Ты сам согласился стать активом, хотя не до конца понимал, на что идёшь",
    "weight": 5
  },
  {
    "id": "active_forced",
    "level": "state",
    "text": "Тебя сделали активом без твоего согласия",
    "weight": 9
  },
  {
    "id": "active_conditioned",
    "level": "state",
    "text": "Ты не помнишь момента, когда стал активом, но знаешь, что это произошло не случайно",
    "weight": 7
  },
  {
    "id": "active_useful",
    "level": "state",
    "text": "Ты понимаешь, что тебя держат, потому что ты полезен",
    "weight": 8
  }
]
```

---

# 8. что важно

- Не делай длинных описаний
- Не делай сложных лорных зависимостей
- Делай **кусочки, которые можно склеить как шрамы**
- Чем проще формулировка — тем сильнее работает

И да, если всё сделать правильно, у тебя получится не "персонаж", а ощущение, что ты собрал чью-то внутреннюю речь из обломков.

Что, собственно, и нужно.


---

# 9. МАССОВЫЕ ДОБАВКИ (расширение библиотеки)

Ниже — просто много материала. Без лишней поэзии. Бери и склеивай.

## origin_place (ещё)

```json
[
{"id":"origin_place_sleep_halls","level":"origin","type":"place","text":"Ты вырос в общем спальном секторе, где никогда не бывает полностью темно","weight":8},
{"id":"origin_place_near_reactors","level":"origin","type":"place","text":"Ты вырос рядом с реакторами, где воздух всегда немного тёплый","weight":7},
{"id":"origin_place_storage","level":"origin","type":"place","text":"Ты вырос среди складов, где вещи важнее людей","weight":7},
{"id":"origin_place_med_block","level":"origin","type":"place","text":"Ты вырос рядом с медблоком, где люди часто исчезают за дверями","weight":6},
{"id":"origin_place_food_lines","level":"origin","type":"place","text":"Ты вырос там, где постоянно стоят очереди за едой","weight":8},
{"id":"origin_place_abandoned_ring","level":"origin","type":"place","text":"Ты вырос на частично заброшенном уровне, где не всё работает","weight":7}
]
```

## origin_activity (ещё)

```json
[
{"id":"origin_activity_sorted_waste","level":"origin","type":"activity","text":"Ты сортировал отходы и быстро научился находить полезное","weight":8},
{"id":"origin_activity_listened","level":"origin","type":"activity","text":"Ты слушал разговоры взрослых и делал выводы","weight":7},
{"id":"origin_activity_guarded","level":"origin","type":"activity","text":"Тебя ставили следить за чем-то, что ты не до конца понимал","weight":6},
{"id":"origin_activity_followed_someone","level":"origin","type":"activity","text":"Ты ходил за кем-то, потому что один оставаться было хуже","weight":7},
{"id":"origin_activity_fixed_illegally","level":"origin","type":"activity","text":"Ты чинил вещи, которые не должен был трогать","weight":6},
{"id":"origin_activity_shared_food","level":"origin","type":"activity","text":"Ты делил еду с другими, даже когда её не хватало","weight":5}
]
```

## origin_condition (ещё)

```json
[
{"id":"origin_condition_hunger","level":"origin","type":"condition","text":"Ты часто недоедал и научился игнорировать это","weight":8},
{"id":"origin_condition_crowded","level":"origin","type":"condition","text":"Ты жил среди слишком большого количества людей","weight":9},
{"id":"origin_condition_watched","level":"origin","type":"condition","text":"Ты привык, что за тобой наблюдают","weight":7},
{"id":"origin_condition_replaceable","level":"origin","type":"condition","text":"Ты рано понял, что тебя легко заменить","weight":9},
{"id":"origin_condition_small_privileges","level":"origin","type":"condition","text":"У тебя были мелкие привилегии, за которые приходилось платить","weight":6}
]
```

## events (ещё)

```json
[
{"id":"event_locked_inside","level":"event","text":"Тебя однажды заперли, и никто не спешил открывать","weight":8},
{"id":"event_given_choice_fake","level":"event","text":"Тебе дали выбор, который на самом деле не был выбором","weight":9},
{"id":"event_someone_disappeared","level":"event","text":"Кто-то исчез, и все сделали вид, что так и должно быть","weight":9},
{"id":"event_praised_once","level":"event","text":"Тебя один раз искренне похвалили, и ты это запомнил","weight":6},
{"id":"event_punished_unfair","level":"event","text":"Тебя наказали за то, что ты не делал","weight":8},
{"id":"event_found_something","level":"event","text":"Ты нашёл что-то, что лучше было не находить","weight":8}
]
```

## traits (ещё)

```json
[
{"id":"trait_keep_distance","level":"trait","text":"Ты держишь дистанцию, даже когда это не нужно","weight":8},
{"id":"trait_test_people","level":"trait","text":"Ты проверяешь людей, прежде чем доверять им","weight":8},
{"id":"trait_take_more","level":"trait","text":"Ты берёшь чуть больше, чем тебе дают","weight":7},
{"id":"trait_leave_early","level":"trait","text":"Ты уходишь раньше, чем становится плохо","weight":7},
{"id":"trait_stay_too_long","level":"trait","text":"Ты остаёшься дольше, чем следовало бы","weight":6},
{"id":"trait_copy_behavior","level":"trait","text":"Ты копируешь поведение других, чтобы вписаться","weight":7},
{"id":"trait_hide_important","level":"trait","text":"Ты скрываешь важное, даже когда не обязан","weight":8},
{"id":"trait_collect_info","level":"trait","text":"Ты собираешь информацию на всякий случай","weight":8}
]
```

## responses (много)

```json
[
{"id":"response_laugh","level":"response","text":"Ты смеёшься, когда ситуация выходит из-под контроля","weight":6},
{"id":"response_silence","level":"response","text":"Ты замолкаешь, когда становится опасно","weight":8},
{"id":"response_agree_fast","level":"response","text":"Ты быстро соглашаешься, чтобы избежать конфликта","weight":7},
{"id":"response_push_back","level":"response","text":"Ты начинаешь сопротивляться, даже если это бессмысленно","weight":6},
{"id":"response_observe","level":"response","text":"Ты сначала смотришь, как реагируют другие","weight":7}
]
```

## bias (много)

```json
[
{"id":"bias_people_use","level":"bias","text":"Ты считаешь, что люди в первую очередь используют друг друга","weight":9},
{"id":"bias_system_wins","level":"bias","text":"Ты уверен, что система всегда сильнее отдельного человека","weight":8},
{"id":"bias_good_is_short","level":"bias","text":"Ты считаешь, что хорошее длится недолго","weight":8},
{"id":"bias_no_one_comes","level":"bias","text":"Ты не ждёшь, что кто-то придёт и поможет","weight":9}
]
```

## body (много)

```json
[
{"id":"body_quick_hands","level":"body","text":"Ты двигаешь руками быстрее, чем думаешь","weight":7},
{"id":"body_avoid_eye","level":"body","text":"Ты не любишь долго смотреть в глаза","weight":8},
{"id":"body_check_pockets","level":"body","text":"Ты регулярно проверяешь, всё ли на месте","weight":7},
{"id":"body_small_steps","level":"body","text":"Ты двигаешься осторожно, не делая лишних шагов","weight":7}
]
```

---

Хватит, чтобы генератор уже начал выдавать что-то живое, а не пластиковые биографии.

Если этого окажется мало (а этого окажется мало), просто скажешь — накину ещё пару сотен, пока система не начнёт дышать сама.
