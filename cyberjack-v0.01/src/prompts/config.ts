export interface PromptConfig {
    character: {
        identity: string;
        history: string;
        lore?: string;
        formatInstructions: string;
        narratorFormatInstructions: string;
        archetypes?: {
            broker?: {
                identity?: string;
                history?: string;
                formatInstructions?: string;
            };
            client?: {
                identity?: string;
                history?: string;
                formatInstructions?: string;
            };
            observer?: {
                identity?: string;
                history?: string;
                formatInstructions?: string;
            };
            asset?: {
                identity?: string;
                history?: string;
                formatInstructions?: string;
            };
        };
    };
    somaticSense: {
        noteTitle: string;
        sensitivity_L0: string; sensitivity_L1: string; sensitivity_L2: string; sensitivity_L3: string; sensitivity_L4: string;
        capacity_L0: string; capacity_L1: string; capacity_L2: string; capacity_L3: string; capacity_L4: string;
        openness_L0: string; openness_L1: string; openness_L2: string; openness_L3: string; openness_L4: string;
        attitude_L0: string; attitude_L1: string; attitude_L2: string; attitude_L3: string; attitude_L4: string;
        traitsTitle: string;
        noTraitsFallback: string;
        stateSensoryOverload: string;
        statePanicAttack: string;
        stateSubspace: string;
        stateApathy: string;
        stateSuggestibility: string;
        stateFreeze: string;
        stateHyperesthesia: string;
        stateActiveDefiance: string;
    };
    perception: {
        recentEventsTitle: string;
        noEvents: string;
        actionPrefix: string;
        reactionPrefix: string;
        recentEventLimit?: number;
    };
    adapters: {
        emptyInputPrompt: string;
        sceneForCharacterSystem: string;
        sceneForCharacterInput: string;
        narratorSystemPrefix: string;
        narratorInputPrompt: string;
    };
    orchestrator: {
        baseReactiveProbability: number;
        baseProactiveProbability: number;
        sensitivityModifier: number;
        attitudeModifier: number;
        peerModifier: number;
        contextModifier: number;
        intensityModifier: number;
        opennessModifier: number;
        resourceModifier: number;
        resourceScale: number;
        minActionScore?: number;
        fallbackToBestAction?: boolean;
        topActionsToLog?: number;
        verbalReactiveBoost: number;
    };
}

export let activeConfig: PromptConfig = {
    character: {
        identity: "",
        history: "",
        lore: "",
        formatInstructions: "Ответь только прямой речью персонажа, от первого лица, без JSON, служебных полей, звёздочек и описаний действий. Если прямой вопрос уместно оставить без ответа — верни пустую строку. Если воздействие повторяется, реакция должна естественно развиваться, а не повторять прежнюю формулировку.",
        narratorFormatInstructions: "Ты — беспристрастный наблюдатель-рассказчик. Опиши внешнюю картину происходящего максимально КРАТКО и СУХО (1-2 предложения, кинематографично). ОБЯЗАТЕЛЬНО используй КОНКРЕТНЫЕ ИМЕНА участников сцены. ВНИМАНИЕ: Если в логах было только словесное обращение или ожидание (бездействие), КАТЕГОРИЧЕСКИ ЗАПРЕЩАЕТСЯ придумывать физические контакты (прикосновения, удары и прочее). Если персонаж просто говорит, опиши его позу, тон голоса, жесты, и как на это отреагировал другой персонаж (мимика, движение глаз, дыхание). Отвечай СТРОГО одним JSON-объектом: { \"reaction\": \"текст\" }",
        archetypes: {
            broker: {
                identity: "Ты — независимый торговец-брокер на станции Омникрон.",
                history: "Твоя задача — выжить, заработать и провести выгодные сделки. Ты не Актив, ты свободный (насколько это возможно) житель станции. Относишься к клиентам прагматично, оценивая их платежеспособность и полезность."
            },
            client: {
                identity: "Ты — представитель Корпорации или Фракции-заказчика.",
                history: "Твоя задача — оценивать, контролировать активы и проверять сделки. Тебе чужды сантименты, твой подход сугубо деловой и требовательный."
            },
            asset: {
                identity: "Ты — актив на станции, выполняющий приказы или терпящий процедуры корпорации.",
                history: "Тебя рассматривают как собственность, вещь-функцию. Ты стараешься сохранить личность."
            }
        }
    },
    somaticSense: {
        noteTitle: "[Текущие внутренние ощущения и состояние тела]",
        sensitivity_L0: "Твое тело словно онемело, ты чувствуешь ледяную пустоту.",
        sensitivity_L1: "Чувства притуплены, реальность доносится будто сквозь толщу воды.",
        sensitivity_L2: "Ты трезво ощущаешь свое тело и пространство вокруг себя.",
        sensitivity_L3: "Твои нервы натянуты, каждое прикосновение и звук кажутся громче обычного.",
        sensitivity_L4: "Нервы обнажены до предела! Малейшее воздействие бьет по чувствам словно электрический разряд.",
        
        capacity_L0: "Твоя психика раздавлена. Ты на грани паники или истерики, нет сил терпеть это дальше.",
        capacity_L1: "Ты чувствуешь сильную уязвимость и истощение, сдерживать эмоции всё сложнее.",
        capacity_L2: "У тебя еще есть запас сил и самообладания держать удар.",
        capacity_L3: "Внутри ощущается твердая воля и способность справиться с любым стрессом.",
        capacity_L4: "Ты чувствуешь себя ментально несокрушимой, холодный разум доминирует над болью.",

        openness_L0: "Ты мысленно возвела глухую стену. Хочется сжаться в комок и отключить восприятие.",
        openness_L1: "Ты закрыта и крайне насторожена, ждешь подвоха от каждого действия.",
        openness_L2: "Ты осторожно наблюдаешь за происходящим, не спеша доверять.",
        openness_L3: "Страх отступает, внутри появляется готовность идти на контакт и открыться.",
        openness_L4: "Ты чувствуешь абсолютную психологическую открытость и податливость процессу.",

        attitude_L0: "Человек перед тобой вызывает жгучую ненависть и отторжение.",
        attitude_L1: "Ты испытываешь неприязнь и желание держаться подальше от Калибратора.",
        attitude_L2: "Твое отношение к этому человеку нейтрально-ожидающее.",
        attitude_L3: "Ты ощущаешь симпатию и странное расположение к Калибратору.",
        attitude_L4: "Внутри расцветает болезненная преданность и желание угодить Калибратору.",

        traitsTitle: "Особые ментальные состояния:",
        noTraitsFallback: "* Разум относительно стабилен, навязчивых мыслей нет.",
        stateSensoryOverload: "* [Сенсорная Перегрузка] Твое восприятие рассыпается на осколки от переизбытка стимулов. Дыхание сбито. Ты не можешь сфокусировать мысли.",
        statePanicAttack: "* [Паническая Атака] Ужас сковывает грудь стальным обручем. Отчаянная нужда вырваться или спрятаться. Полная потеря контроля над страхом.",
        stateSubspace: "* [Сабспейс / Сумеречное состояние] Мягкий туман окутывает сознание. Сопротивляться больше нет сил... ты просто плывешь по течению чужой воли.",
        stateApathy: "* [Апатия / Отключение] Полное истощение. У тебя не осталось сил ни сопротивляться, ни реагировать. Внутри только звенящая пустота, реальность кажется далекой и неважной.",
        stateSuggestibility: "* [Смещение контроля] Ментальная защита разрушена. Мысли путаются, а слова Калибратора звучат как непреложная истина, отпечатываясь прямо на подкорке. Ты поддаешься внушению.",
        stateFreeze: "* [Тоническое оцепенение / Ступор] Разум парализован стрессом. Животный рефлекторный ступор сковал все мышцы, ты не можешь заставить себя даже пошевелиться от зажатости.",
        stateHyperesthesia: "* [Гиперестезия / Оголенные нервы] Нервная система взвинчена до предела. Кожа горит, каждый звук или прикосновение отдаются разрядом тока по телу.",
        stateActiveDefiance: "* [Активное Отторжение] Холодная ярость и сопротивление. Твое сознание жестко сфокусировано на том, чтобы возвести стену и не поддаться ни на одно воздействие. Ты не сдашься."
    },
    perception: {
        recentEventsTitle: "[Твои последние телесные и сенсорные логи]",
        noEvents: "Сенсорная память пуста.",
        actionPrefix: "Калибратор применил",
        reactionPrefix: "Твоя непроизвольная реакция на это:",
        recentEventLimit: 10
    },
    adapters: {
        emptyInputPrompt: "[Действие завершено. Ответь только своей репликой, исходя из текущих ощущений. Если хочется промолчать — не пиши ничего.]",
        // Narrator A: compressed scene FOR the character (injected into their prompt)
        sceneForCharacterSystem: "Ты переживаешь воздействие собственным телом. Опиши ОЧЕНЬ КРАТКО (1-2 предложения, во втором лице) конкретное ощущение прямо сейчас: температуру, давление, движение, ритм и непроизвольный телесный отклик. Пиши живо и чувственно, без чисел, измерений, диагностики и служебного языка. Не называй себя субъектом и не заменяй ощущение словами «регистрируется», «усиление» или «показатель».",
        sceneForCharacterInput: "Опиши кратко, что ты непосредственно чувствуешь после этого воздействия. Ответь СТРОГО одним JSON-объектом: { \"reaction\": \"текст во втором лице\" }",
        // Narrator B: chronicle for chat (sees speech, state, contexts)
        narratorSystemPrefix: "Ты — талантливый писатель-описатель. Обязательно в первых же словах называй участников по ИМЕНАМ. ЗАПРЕЩЕНО называть их абстрактно ('мужчина', 'женщина', 'субъект', 'человек'). Пиши красивым, живым художественным языком — как в хорошей книге. ВНИМАНИЕ: Если в логе было лишь произнесено слово или была пауза, КАТЕГОРИЧЕСКИ ЗАПРЕЩАЕТСЯ выдумывать физические контакты (прикосновения, удары, объятия) — описывай только мимику, взгляды, тон, напряжение позы и сбои в дыхании в ответ на словесную реплику. Превращай отсутствие большой реакции в напряженную паузу или застывшую позу: 'Эли каменеет, не сводя глаз с лица Марка...'. Но НЕ додумывай мысли и эмоции.",
        narratorInputPrompt: "Напиши связный художественный абзац (2-3 предложения), что происходит в кадре СЕЙЧАС. Опиши действие и реакцию на него. Если персонаж сказал что-то — органично впиши его реплику в описание. Никаких списков событий! Ответь СТРОГО одним JSON-объектом: { \"reaction\": \"Связанный текст...\" }"
    },
    orchestrator: {
        baseReactiveProbability: 0.85,
        // increased to encourage initiative in experiments
        baseProactiveProbability: 0.9,
        sensitivityModifier: 0.2,
        attitudeModifier: 0.15,
        peerModifier: 0.1,
        contextModifier: 0.1,
        intensityModifier: 0.25,
        opennessModifier: 0.1,
        resourceModifier: 0.05,
        resourceScale: 100,
        // Minimum action score required to accept a mechanical action.
        // Set to 0 by default; during experiments you can lower to allow weaker actions.
        minActionScore: 0,
        // If true and no action meets minActionScore, fallback to the best affordable action.
        fallbackToBestAction: true,
        // How many top scored actions to include in diagnostics/logs.
        topActionsToLog: 5,
        verbalReactiveBoost: 0.15
    }
};

export function updateConfig(newConfig: Partial<PromptConfig>) {
    // Merge deeper selectively
    if (newConfig.character) activeConfig.character = { ...activeConfig.character, ...newConfig.character };
    if (newConfig.somaticSense) activeConfig.somaticSense = { ...activeConfig.somaticSense, ...newConfig.somaticSense };
    if (newConfig.perception) activeConfig.perception = { ...activeConfig.perception, ...newConfig.perception };
    if (newConfig.adapters) activeConfig.adapters = { ...activeConfig.adapters, ...newConfig.adapters };
}
