import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyVerbalInputToFrame, buildReactionSystemPrompt, buildReactionTurnMessage, compileReactionFrame } from '../src/narrative/reactionFrame';
import { InteractionObservation, SubjectCoreState } from '../src/domain/types';
import { generateCharacterReply } from '../src/adapters/llmAdapter';
import { contextualizeBehavioralCore, selectReactionEpisodes, selectRecentDialogue, stripUnpromptedLoreFromEpisode } from '../src/prompts/buildPromptPayload';
import { buildPairedSpeechHistory, calculateActionSpeechChance } from '../src/api/controllers/tickController';

const core: SubjectCoreState = {
    sensitivity: 55, capacity: 72, openness: 58, plasticity: 72, attitude: 50, tension: 0
};

function observation(overrides: Partial<InteractionObservation['reaction']> = {}): InteractionObservation {
    return {
        action: { id: 'gentle_stroke', label: 'Мягко погладить', pointId: 'neck', pointLabel: 'Шея' },
        contact: 'full', behavioralState: 'responsive',
        reaction: { pleasure: 5, discomfort: 1, overload: 0, engagement: 4, mixed: false, ...overrides },
        learning: { effect: 1, familiarityDelta: .1, sensitivityDelta: 0, baselineSensitivityDelta: 0 },
        changes: { tension: 1, capacity: 0, attitude: .5, openness: .2, localAttitude: .4 },
        contexts: [], currentState: { title: 'В контакте', description: 'Реагирует осмысленно.' },
        transitions: [], uiText: 'Мира принимает контакт.', subjectiveText: 'Контакт приятен, но я не хочу показывать это прямо.', technicalText: ''
    };
}

const base = {
    speakerId: 'S-AV-01', speakerName: 'Мира', targetId: 'S-AV-01', targetName: 'Мира',
    initiatorId: 'PL-1', initiatorName: 'Калибратор', presentCharacters: ['Мира', 'Калибратор'],
    contexts: [], core, observation: observation(), profileText: 'Ты говоришь прямо. Ты скрываешь страх за вызовом.'
};

describe('reaction frame compiler', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });
    it('allows a pleasant reaction to be acknowledged without forcing concealment', () => {
        const frame = compileReactionFrame({ ...base, repetition: 1 });
        expect(frame.dramaticPosition.preferredSpeechAct).toBe('acknowledge');
        expect(frame.dramaticPosition.primaryIntent).toContain('озвучить замеченное ощущение');
    });

    it('does not force a first action into the repeated-control position', () => {
        const frame = compileReactionFrame({ ...base, repetition: 1 });
        expect(frame.dramaticPosition.primaryIntent).not.toContain('повторяющимся взаимодействием');
        expect(frame.dramaticPosition.allowedSpeechActs).toContain('admit');
    });

    it('keeps equipment vulnerabilities dormant without a matching scene fact', () => {
        const behavioral = {
            values: ['сохранять достоинство'],
            vulnerabilities: ['Если на тебя надевают ошейник, ты резко сопротивляешься.', 'Ты боишься потерять самостоятельность.'],
            defenses: ['наблюдаешь'], voice: []
        };
        expect(contextualizeBehavioralCore(behavioral, ['Мягкое поглаживание']).vulnerabilities)
            .toEqual(['Ты боишься потерять самостоятельность.']);
        expect(contextualizeBehavioralCore(behavioral, ['Надето: Шоковый ошейник']).vulnerabilities)
            .toContain('Если на тебя надевают ошейник, ты резко сопротивляешься.');
    });

    it('keeps actual conversation while dropping physical history markers', () => {
        const dialogue = selectRecentDialogue([
            { role: 'assistant', content: 'Что именно ты проверяешь?' },
            { role: 'user', content: '[Воздействие] Мягкое поглаживание; зона: Спина.' },
            { role: 'user', content: 'Хочу понять твою реакцию.' }
        ], 'Ника', 'Калибратор');
        expect(dialogue).toEqual([
            'Ника: «Что именно ты проверяешь?»',
            'Калибратор: «Хочу понять твою реакцию.»'
        ]);
    });

    it('makes approaching the peak an explicit focus of the reply', () => {
        const frame = compileReactionFrame({ ...base, core: { ...core, tension: 92 } });
        expect(frame.event.mandatoryPhysiologicalFocus).toBe(true);
        expect(frame.event.physiologicalState).toContain('почти достигло пика');
        expect(frame.dramaticPosition.primaryIntent).toContain('приближение пика');
        expect(buildReactionTurnMessage(frame)).toContain('обязательный фокус реплики');
        expect(frame.expressionMode).toMatchObject({ arousal: 'edge', affect: 'positive', control: 'fragmented', maxWords: 7, requiresDisruption: true });
        expect(buildReactionTurnMessage(frame)).toContain('[Манера текущей реплики]');
    });

    it('gives the same high tension a different delivery for negative affect', () => {
        const negative = observation({ pleasure: 1, discomfort: 8 });
        const frame = compileReactionFrame({ ...base, core: { ...core, tension: 92 }, observation: negative });

        expect(frame.expressionMode.affect).toBe('negative');
        expect(frame.expressionMode.instructions.join(' ')).toContain('выкриком');
        expect(frame.expressionMode.instructions.join(' ')).not.toContain('Положительная окраска');
    });

    it('preserves mixed affect in the high-tension delivery', () => {
        const mixed = observation({ pleasure: 8, discomfort: 6, mixed: true });
        const frame = compileReactionFrame({ ...base, core: { ...core, tension: 92 }, observation: mixed });

        expect(frame.expressionMode.affect).toBe('mixed');
        expect(frame.expressionMode.instructions.join(' ')).toContain('противоречие');
    });

    it('regenerates a calm complete sentence at the edge', async () => {
        const frame = compileReactionFrame({ ...base, core: { ...core, tension: 92 } });
        const response = (speech: string) => ({
            ok: true,
            json: async () => ({ choices: [{ message: { content: JSON.stringify({ addressedTo: 'PL-1', speechAct: 'admit', speech }) } }] })
        });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(response('Мне действительно очень нравится это воздействие.'))
            .mockResolvedValueOnce(response('А-а… не сбивайся…'));
        vi.stubGlobal('fetch', fetchMock);

        const result = await generateCharacterReply({
            subjectId: 'S-AV-01',
            currentStateSummary: { interpretation: '', attitude: 50, localAttitude: 50, engagement: 0, overload: 0 },
            recentEvents: [], systemPrompt: buildReactionSystemPrompt(frame), reactionFrame: frame
        }, buildReactionTurnMessage(frame));

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.reply).toMatchObject({ speech: 'А-а… не сбивайся…' });
    });

    it('requires a spoken reaction when discharge happens', async () => {
        const dischargeObservation = observation();
        dischargeObservation.transitions = [{ kind: 'discharge', title: 'Разрядка', text: 'Происходит разрядка.', severity: 'major' }];
        const frame = compileReactionFrame({ ...base, core: { ...core, tension: 10 }, observation: dischargeObservation });
        expect(frame.event.requiresSpeech).toBe(true);
        expect(frame.dramaticPosition.allowedSpeechActs).not.toContain('silence');

        const response = (speech: string) => ({
            ok: true,
            json: async () => ({ choices: [{ message: { content: JSON.stringify({ addressedTo: 'PL-1', speechAct: 'admit', speech }) } }] })
        });
        const fetchMock = vi.fn().mockResolvedValueOnce(response('Ты можешь быть нежнее?')).mockResolvedValueOnce(response('Я… кончила. Не могу отдышаться.'));
        vi.stubGlobal('fetch', fetchMock);
        const result = await generateCharacterReply({
            subjectId: 'S-AV-01',
            currentStateSummary: { interpretation: '', attitude: 50, localAttitude: 50, engagement: 0, overload: 0 },
            recentEvents: [], systemPrompt: buildReactionSystemPrompt(frame), reactionFrame: frame
        }, buildReactionTurnMessage(frame));

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.reply).toMatchObject({ speech: 'Я… кончила. Не могу отдышаться.' });
    });

    it('allows silence when discharge coincides with loss of consciousness', async () => {
        const unconscious = observation();
        unconscious.behavioralState = 'unresponsive';
        unconscious.transitions = [
            { kind: 'discharge', title: 'Разрядка', text: 'Происходит разрядка.', severity: 'major' },
            { kind: 'state', title: 'Потеря контакта', text: 'Контакт потерян.', severity: 'danger' }
        ];
        const frame = compileReactionFrame({ ...base, core: { ...core, capacity: 0, tension: 10 }, observation: unconscious });

        expect(frame.event.requiresSpeech).toBe(false);
        expect(frame.expressionMode.control).toBe('minimal');
        expect(frame.dramaticPosition.allowedSpeechActs).toContain('silence');
        expect(buildReactionSystemPrompt(frame)).toContain('допустимы короткая непроизвольная вокализация или пустая speech');

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ choices: [{ message: { content: JSON.stringify({
                addressedTo: 'PL-1', speechAct: 'silence', speech: ''
            }) } }] })
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await generateCharacterReply({
            subjectId: 'S-AV-01',
            currentStateSummary: { interpretation: '', attitude: 50, localAttitude: 50, engagement: 0, overload: 0 },
            recentEvents: [], systemPrompt: buildReactionSystemPrompt(frame), reactionFrame: frame
        }, buildReactionTurnMessage(frame));

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(result.error).toBeUndefined();
        expect(result.reply).toMatchObject({ speech: '', speechAct: 'silence', addressedTo: 'PL-1' });
    });

    it('falls back to silence instead of exposing a validation error while unconscious', async () => {
        const unconscious = observation();
        unconscious.behavioralState = 'unresponsive';
        unconscious.transitions = [
            { kind: 'discharge', title: 'Разрядка', text: 'Происходит разрядка.', severity: 'major' },
            { kind: 'state', title: 'Потеря контакта', text: 'Контакт потерян.', severity: 'danger' }
        ];
        const frame = compileReactionFrame({ ...base, core: { ...core, capacity: 0, tension: 10 }, observation: unconscious });
        const rejectedRaw = JSON.stringify({
            addressedTo: 'PL-1', speechAct: 'acknowledge', speech: 'Я совершенно спокойно объясняю своё состояние.'
        });
        const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ choices: [{ message: { content: rejectedRaw } }] })
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await generateCharacterReply({
            subjectId: 'S-AV-01',
            currentStateSummary: { interpretation: '', attitude: 50, localAttitude: 50, engagement: 0, overload: 0 },
            recentEvents: [], systemPrompt: buildReactionSystemPrompt(frame), reactionFrame: frame
        }, buildReactionTurnMessage(frame));

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.error).toBeUndefined();
        expect(result.reply).toMatchObject({ speech: '', speechAct: 'silence', addressedTo: 'PL-1' });
        const diagnostics = warningSpy.mock.calls.flat().join('\n');
        expect(diagnostics).toContain('[Rejected Character Reply] attempt=1/2');
        expect(diagnostics).toContain('[Rejected Character Reply] attempt=2/2');
        expect(diagnostics).toContain(`raw=${JSON.stringify(rejectedRaw)}`);
    });

    it('preserves the engine discharge marker while rebuilding the observation', () => {
        const marked = observation();
        marked.transitions = [{ kind: 'discharge', title: 'Разрядка', text: 'Происходит разрядка.', severity: 'major' }];
        const frame = compileReactionFrame({ ...base, observation: marked });
        expect(frame.event.physiologicalEvent).toBe('discharge');
    });

    it('does not turn bodily pleasure into a request when acceptance declines', () => {
        const conflicted = observation();
        conflicted.changes = { ...conflicted.changes, attitude: -1.2, openness: -0.8, localAttitude: 0.5 };
        const frame = compileReactionFrame({ ...base, observation: conflicted, repetition: 1 });

        expect(frame.dramaticPosition.primaryIntent).toContain('не дать адресату принять');
        expect(frame.dramaticPosition.allowedSpeechActs).not.toContain('request');
        expect(buildReactionTurnMessage(frame)).toContain('персонаж сильнее закрылся');
    });

    it('keeps exact sensitivity and baseline learning out of subjective prompt', () => {
        const changed = observation();
        changed.learning = {
            ...changed.learning,
            effect: 1.5,
            sensitivityDelta: -0.1316,
            baselineSensitivityDelta: 0.0365
        };
        const frame = compileReactionFrame({ ...base, observation: changed });
        const message = buildReactionTurnMessage(frame);

        expect(message).not.toContain('0.13');
        expect(message).not.toContain('0.04');
        expect(message).not.toContain('baseline');
        expect(message).not.toContain('воздействие оставляет обучающий след');
        expect(frame.event.validationFacts).toMatchObject({ sensitivityTrend: 'down' });
        expect(buildReactionSystemPrompt(frame)).toContain('Не называй внутренние параметры симулятора');
    });

    it('rejects a sensitivity claim opposite to hidden engine facts', async () => {
        const changed = observation();
        changed.learning = { ...changed.learning, sensitivityDelta: -0.13, baselineSensitivityDelta: 0.04 };
        const frame = compileReactionFrame({ ...base, observation: changed });
        const response = (speech: string) => ({
            ok: true,
            json: async () => ({ choices: [{ message: { content: JSON.stringify({ addressedTo: 'PL-1', speechAct: 'acknowledge', speech }) } }] })
        });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(response('Чувствительность повышается.'))
            .mockResolvedValueOnce(response('Прикосновение ощущается мягко.'));
        vi.stubGlobal('fetch', fetchMock);

        const result = await generateCharacterReply({
            subjectId: 'S-AV-01',
            currentStateSummary: { interpretation: '', attitude: 50, localAttitude: 50, engagement: 0, overload: 0 },
            recentEvents: [], systemPrompt: buildReactionSystemPrompt(frame), reactionFrame: frame
        }, buildReactionTurnMessage(frame));

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.reply).toMatchObject({ speech: 'Прикосновение ощущается мягко.' });
    });

    it('regenerates a request to repeat when overall acceptance declines', async () => {
        const conflicted = observation();
        conflicted.changes = { ...conflicted.changes, attitude: -1.2, openness: -0.8 };
        const frame = compileReactionFrame({ ...base, observation: conflicted, repetition: 1 });
        const response = (speech: string) => ({
            ok: true,
            json: async () => ({ choices: [{ message: { content: JSON.stringify({ addressedTo: 'PL-1', speechAct: 'admit', speech }) } }] })
        });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(response('Да… продолжай.'))
            .mockResolvedValueOnce(response('Телу приятно. Но я всё равно закрываюсь.'));
        vi.stubGlobal('fetch', fetchMock);

        const result = await generateCharacterReply({
            subjectId: 'S-AV-01',
            currentStateSummary: { interpretation: '', attitude: 50, localAttitude: 50, engagement: 0, overload: 0 },
            recentEvents: [], systemPrompt: buildReactionSystemPrompt(frame), reactionFrame: frame
        }, buildReactionTurnMessage(frame));

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.reply).toMatchObject({ speech: 'Телу приятно. Но я всё равно закрываюсь.' });
    });

    it('regenerates a reply that substitutes massage for the current stroke', async () => {
        const frame = compileReactionFrame({ ...base, repetition: 1, speakerGender: 'female' });
        const response = (speech: string) => ({
            ok: true,
            json: async () => ({ choices: [{ message: { content: JSON.stringify({ addressedTo: 'PL-1', speechAct: 'acknowledge', speech }) } }] })
        });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(response('Неплохо массируешь.'))
            .mockResolvedValueOnce(response('Ладонь движется ровнее.'));
        vi.stubGlobal('fetch', fetchMock);
        const result = await generateCharacterReply({
            subjectId: 'S-AV-01', currentStateSummary: { interpretation: '', attitude: 50, localAttitude: 50, engagement: 0, overload: 0 },
            recentEvents: [], systemPrompt: buildReactionSystemPrompt(frame), reactionFrame: frame
        }, buildReactionTurnMessage(frame));
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.reply).toMatchObject({ speech: 'Ладонь движется ровнее.' });
    });

    it('regenerates an observer reply based on an unobserved bodily sign', async () => {
        const frame = compileReactionFrame({ ...base, actionLabel: 'Обычная беседа', speakerGender: 'female' });
        const response = (speech: string) => ({
            ok: true,
            json: async () => ({ choices: [{ message: { content: JSON.stringify({ addressedTo: 'PL-1', speechAct: 'answer', speech }) } }] })
        });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(response('Её дыхание ровное, продолжай текущий протокол.'))
            .mockResolvedValueOnce(response('Она отвечает связно и сохраняет контакт.'));
        vi.stubGlobal('fetch', fetchMock);
        const result = await generateCharacterReply({
            subjectId: 'S-AV-01', currentStateSummary: { interpretation: '', attitude: 50, localAttitude: 50, engagement: 0, overload: 0 },
            recentEvents: [], systemPrompt: buildReactionSystemPrompt(frame), reactionFrame: frame
        }, buildReactionTurnMessage(frame));
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.reply).toMatchObject({ speech: 'Она отвечает связно и сохраняет контакт.' });
    });

    it('does not treat a second occurrence as a forced control struggle', () => {
        const frame = compileReactionFrame({
            ...base,
            repetition: 2,
            recentDialogue: ['Мира: «Ты делаешь это специально?»'],
            recentSpeechAct: 'probe'
        });
        expect(frame.dramaticPosition.preferredSpeechAct).toBe('acknowledge');
    });

    it('does not cycle between the same two speech acts over a longer exchange', () => {
        const frame = compileReactionFrame({
            ...base,
            repetition: 3,
            recentSpeechActs: ['probe', 'challenge']
        });
        expect(frame.dramaticPosition.preferredSpeechAct).toBe('acknowledge');
    });

    it('does not expose subjective experience to an observer', () => {
        const frame = compileReactionFrame({ ...base, speakerId: 'S-01', speakerName: 'Наблюдатель' });
        expect(frame.event.directlyExperienced).toBe(false);
        expect(frame.event.experience).toBe('Мира принимает контакт.');
        expect(frame.event.experience).not.toContain('я не хочу');
    });

    it('includes the calibrator input in the current reaction turn', () => {
        const frame = compileReactionFrame({ ...base, repetition: 1 });
        const message = buildReactionTurnMessage(frame, 'Скажи, что ты сейчас чувствуешь.');
        expect(message).toContain('[Реплика адресата]');
        expect(message).toContain('Скажи, что ты сейчас чувствуешь.');
    });

    it('gives a direct question an answer-oriented position', () => {
        const frame = applyVerbalInputToFrame(
            compileReactionFrame({ ...base, repetition: 3 }),
            'Тебе неприятно?'
        );
        expect(frame.event.playerSpeech).toBe('Тебе неприятно?');
        expect(frame.event.experience).toContain('физического воздействия');
        expect(frame.dramaticPosition.preferredSpeechAct).toBe('answer');
        expect(frame.dramaticPosition.primaryIntent).toContain('ответить');
    });

    it('keeps lore names out of the voice instruction for an ordinary reaction', () => {
        const frame = compileReactionFrame({
            ...base,
            behavioralCore: {
                values: [], vulnerabilities: [], defenses: [],
                voice: ['Ты говоришь загадками и часто упоминаешь Резонанс или Пустоту.']
            }
        });
        const prompt = buildReactionSystemPrompt(frame);
        expect(prompt).not.toContain('Резонанс');
        expect(prompt).not.toContain('Пустоту');
        expect(prompt).toContain('не подменяешь его терминами или цитатами из лора');
        expect(prompt).toContain('если адресат не поднял эту тему');
    });

    it('normalizes model-owned metadata instead of discarding valid speech', async () => {
        const frame = compileReactionFrame({ ...base, repetition: 1 });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ choices: [{ message: { content: JSON.stringify({
                addressedTo: 'неверный-id', speechAct: 'неизвестный-ход', speech: 'Я всё ещё тебя слышу.'
            }) } }] })
        }));

        const result = await generateCharacterReply({
            subjectId: 'S-AV-01',
            currentStateSummary: { interpretation: '', attitude: 50, localAttitude: 50, engagement: 0, overload: 0 },
            recentEvents: [],
            systemPrompt: 'test',
            reactionFrame: frame
        }, 'test');

        expect(result.error).toBeUndefined();
        expect(result.reply).toMatchObject({
            addressedTo: 'PL-1',
            speechAct: frame.dramaticPosition.preferredSpeechAct,
            speech: 'Я всё ещё тебя слышу.'
        });
    });

    it('regenerates a verbatim echo of the current player input', async () => {
        const frame = applyVerbalInputToFrame(compileReactionFrame({ ...base, repetition: 1 }), 'Тебе неприятно?');
        const response = (content: object) => ({
            ok: true,
            json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] })
        });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(response({ addressedTo: 'PL-1', speechAct: 'answer', speech: 'Тебе неприятно?' }))
            .mockResolvedValueOnce(response({ addressedTo: 'ошибка', speechAct: 'answer', speech: 'Нет. Скорее непривычно.' }));
        vi.stubGlobal('fetch', fetchMock);

        const result = await generateCharacterReply({
            subjectId: 'S-AV-01',
            currentStateSummary: { interpretation: '', attitude: 50, localAttitude: 50, engagement: 0, overload: 0 },
            recentEvents: [], systemPrompt: 'test', reactionFrame: frame
        }, buildReactionTurnMessage(frame));

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.error).toBeUndefined();
        expect(result.reply).toMatchObject({ speech: 'Нет. Скорее непривычно.', addressedTo: 'PL-1' });
    });

    it('regenerates a counter-question mislabeled as a direct answer', async () => {
        const frame = applyVerbalInputToFrame(compileReactionFrame({ ...base, repetition: 1 }), 'Лёд убрать?');
        const response = (content: object) => ({
            ok: true,
            json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] })
        });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(response({ addressedTo: 'PL-1', speechAct: 'answer', speech: 'А зачем тебе это знать?' }))
            .mockResolvedValueOnce(response({ addressedTo: 'PL-1', speechAct: 'answer', speech: 'Да, убери.' }));
        vi.stubGlobal('fetch', fetchMock);

        const result = await generateCharacterReply({
            subjectId: 'S-AV-01',
            currentStateSummary: { interpretation: '', attitude: 50, localAttitude: 50, engagement: 0, overload: 0 },
            recentEvents: [], systemPrompt: 'test', reactionFrame: frame
        }, buildReactionTurnMessage(frame));

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.reply).toMatchObject({ speech: 'Да, убери.', speechAct: 'answer' });
    });

    it('preserves a deliberate refusal to answer', async () => {
        const frame = applyVerbalInputToFrame(compileReactionFrame({ ...base, repetition: 1 }), 'Почему ты молчишь?');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ choices: [{ message: { content: JSON.stringify({
                addressedTo: 'PL-1', speechAct: 'answer', speech: 'Не скажу.'
            }) } }] })
        }));

        const result = await generateCharacterReply({
            subjectId: 'S-AV-01',
            currentStateSummary: { interpretation: '', attitude: 50, localAttitude: 50, engagement: 0, overload: 0 },
            recentEvents: [], systemPrompt: 'test', reactionFrame: frame
        }, buildReactionTurnMessage(frame));

        expect(result.reply).toMatchObject({ speech: 'Не скажу.', speechAct: 'set_boundary' });
    });

    it('carries the latest physical episode into a verbal turn', () => {
        const records = [
            { text: 'Недавний разговор', type: 'episode_v2', metadata: { actionId: 'verbal_pressure', playerSpeech: 'Как ты?' } },
            { text: 'Лёд на шее был неприятен', type: 'episode_v2', metadata: { actionId: 'ice_cube', pointId: 'neck' } },
            { text: 'Более старый разговор', type: 'episode_v2', metadata: { actionId: 'verbal_pressure', playerSpeech: 'Холодно?' } }
        ];

        const selected = selectReactionEpisodes(records, 'verbal_pressure', 'systemic');
        expect(selected[0].text).toBe('Лёд на шее был неприятен');
        expect(selected.map(entry => entry.text)).toContain('Недавний разговор');
    });

    it('drops orphaned character lines but preserves deliberate unanswered input', () => {
        const history = buildPairedSpeechHistory([
            { role: 'assistant', content: 'Старая реплика без причины.' },
            { role: 'user', content: '[Воздействие] Мягко погладить; зона: шея.' },
            { role: 'assistant', content: 'Неожиданно мягко.' },
            { role: 'assistant', content: 'Ещё одна сиротская реплика.' },
            { role: 'user', content: 'Почему ты молчишь?' },
            { role: 'user', content: '[Воздействие] Коснуться льдом; зона: шея.' },
            { role: 'assistant', content: 'Убери лёд.' }
        ]);

        expect(history.map(entry => entry.content)).toEqual([
            '[Воздействие] Мягко погладить; зона: шея.',
            'Неожиданно мягко.',
            'Почему ты молчишь?',
            '[Воздействие] Коснуться льдом; зона: шея.',
            'Убери лёд.'
        ]);
    });

    it('keeps an unprompted lore quote out of continuity without losing the physical event', () => {
        const history = buildPairedSpeechHistory([
            { role: 'user', content: '[Воздействие] Мягко погладить; зона: шея.' },
            { role: 'assistant', content: 'Резонанс проходит сквозь меня.' }
        ]);
        expect(history).toEqual([{ role: 'user', content: '[Воздействие] Мягко погладить; зона: шея.' }]);

        const episode = stripUnpromptedLoreFromEpisode({
            text: 'Действие: поглаживание. Переживание: контакт приятен. Мой ответ: «Пустота отвечает мне.»',
            type: 'episode_v2',
            metadata: { playerSpeech: '', characterSpeech: 'Пустота отвечает мне.', speechAct: 'conceal' }
        });
        expect(episode.text).toBe('Действие: поглаживание. Переживание: контакт приятен');
        expect(episode.metadata.characterSpeech).toBe('');
    });

    it('keeps lore dialogue when the player explicitly raises it', () => {
        const history = buildPairedSpeechHistory([
            { role: 'user', content: 'Что ты называешь Пустотой?' },
            { role: 'assistant', content: 'Пустота — то, что осталось за Периметром.' }
        ]);
        expect(history).toHaveLength(2);
    });

    it('raises action speech chance with intensity and tension', () => {
        expect(calculateActionSpeechChance({ intensity: .2, tensionBefore: 10, tensionAfter: 15 })).toBe(.4);
        expect(calculateActionSpeechChance({ intensity: .7, tensionBefore: 55, tensionAfter: 60 })).toBeCloseTo(.65);
        expect(calculateActionSpeechChance({ intensity: 1, tensionBefore: 80, tensionAfter: 85 })).toBeCloseTo(.9);
    });

    it('always generates speech at a peak discharge', () => {
        expect(calculateActionSpeechChance({
            intensity: .1, tensionBefore: 99, tensionAfter: 10,
            transitions: [{ kind: 'discharge' }]
        })).toBe(1);
        expect(calculateActionSpeechChance({
            intensity: .1, tensionBefore: 99, tensionAfter: 10,
            transitions: [{ kind: 'breakdown' }]
        })).toBe(1);
    });
});
