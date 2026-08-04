import { PromptSectionsResult } from './promptComposer';
import { GeneratedCharacterContext, GeneratedProfileV2, GeneratedTag } from './types';

export const PROFILE_GENERATOR_REVISION = 10;

const unique = (items: Array<string | undefined>, limit = 6) =>
    Array.from(new Set(items.map(item => item?.trim()).filter((item): item is string => Boolean(item)))).slice(0, limit);

const hooks = (tags: GeneratedTag[], limit = 6) => unique(tags.flatMap(tag => tag.personaHooks || [tag.summary]), limit);

export function voiceStyleOnly(text: string): string {
    if (!/(упомина|цитир|лозунг|резонанс|пустот|бездн|аномали)/i.test(text)) return text;
    const traits: string[] = [];
    if (/фатал/i.test(text)) traits.push('фаталистично');
    if (/загад|нам[её]к|недосказ/i.test(text)) traits.push('с редкими недосказанными образами');
    if (/коротк|лаконич/i.test(text)) traits.push('коротко');
    const style = traits.length ? traits.join(', ') : 'в характерной для себя манере';
    return `Ты говоришь ${style}, но называешь конкретное текущее ощущение и не подменяешь его терминами или цитатами из лора.`;
}

function agreeGender(text: string, gender: 'male' | 'female' | 'other'): string {
    if (gender !== 'female') return text;
    const forms: Record<string, string> = {
        вырос: 'выросла', помогал: 'помогала', носил: 'носила', начал: 'начала', наблюдал: 'наблюдала',
        совершил: 'совершила', задал: 'задала', проводил: 'проводила', собирал: 'собирала', сам: 'сама',
        чинил: 'чинила', слушал: 'слушала', делил: 'делила', сортировал: 'сортировала', ходил: 'ходила',
        привык: 'привыкла', жил: 'жила', понял: 'поняла', стал: 'стала', был: 'была', сделал: 'сделала',
        увидел: 'увидела', вмешался: 'вмешалась', мог: 'могла', остался: 'осталась', родился: 'родилась',
        оказался: 'оказалась', подвергался: 'подвергалась', работал: 'работала', прятался: 'пряталась',
        стоял: 'стояла', плакал: 'плакала', знал: 'знала', стирал: 'стирала', выходил: 'выходила',
        наткнулся: 'наткнулась', усвоил: 'усвоила', прямолинеен: 'прямолинейна', грубоват: 'грубовата',
        напуган: 'напугана', упрям: 'упряма', осторожен: 'осторожна', управляемым: 'управляемой',
        беспомощным: 'беспомощной', сломленным: 'сломленной', выживал: 'выживала', запомнил: 'запомнила',
        искал: 'искала', научился: 'научилась', потерял: 'потеряла', выбрал: 'выбрала', говорил: 'говорила',
        думал: 'думала', принимал: 'принимала', терпел: 'терпела', смотрел: 'смотрела', должен: 'должна',
        готов: 'готова', собран: 'собрана', нашёл: 'нашла', делал: 'делала'
    };
    return Object.entries(forms).reduce(
        (result, [from, to]) => result.replace(
            new RegExp(`(^|[^А-Яа-яЁё])(${from})(?=$|[^А-Яа-яЁё])`, 'gi'),
            (_match, prefix: string, word: string) => `${prefix}${word[0] === word[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to}`
        ),
        text
    );
}

const CENTRAL_CONFLICTS: Record<string, { desire: string; fear: string; need: string }> = {
    psy_submissive: {
        desire: 'найти предсказуемые правила и сохранить безопасность',
        fear: 'что любое сопротивление вызовет наказание',
        need: 'ясные границы и подтверждение того, что договорённости действуют'
    },
    psy_defiant: {
        desire: 'сохранить субъектность и право влиять на происходящее',
        fear: 'оказаться полностью управляемым и беспомощным',
        need: 'реальный выбор, который нельзя свести к формальности'
    },
    psy_curious_masochist: {
        desire: 'понять собственную реакцию и исследовать её пределы',
        fear: 'что интерес к воздействию лишит контроля над собой',
        need: 'безопасный способ исследовать противоречивые ощущения'
    }
};

function buildStorySeed(
    context: GeneratedCharacterContext,
    biography: GeneratedProfileV2['biography'],
    conflict: { desire:string; fear:string; need:string },
): GeneratedProfileV2['storySeed'] {
    const ids = new Set(context.tags.map(tag => tag.id));
    const externalLink = ids.has('faction_lattice') ? 'Lattice и связанные с ней кураторы'
        : ids.has('faction_continuum') ? 'Continuum Archive и его разрозненные хранилища'
            : ids.has('faction_helix') ? 'Helix Dynamics и корпоративная сеть'
                : ids.has('faction_veil') ? 'Veil Biotech и закрытые клинические каналы'
                    : 'неустановленный контакт из прежнего сектора';
    const unresolvedPast = biography.formativeEvents[0]
        || biography.statusCause
        || `В прошлом осталось решение, связанное с прежней ролью: ${biography.formerRole || 'станционная работа'}.`;
    const concealedFact = ids.has('event_saw_wrong_thing') ? 'Увиденное было частью намеренно скрытой операции.'
        : ids.has('event_found_something') ? 'Находка связана с данными, которые кто-то продолжает искать.'
            : ids.has('event_left_waiting') ? 'Исчезновение было не случайностью, а чьим-то решением.'
                : ids.has('event_punished_unfair') ? 'Настоящий виновник или заказчик наказания всё ещё доступен.'
                    : ids.has('event_helped_and_regretted') ? 'Человек, которому была оказана помощь, сохранил опасную связь с прошлым.'
                        : 'Официальная версия прошлого скрывает чью-то заинтересованность.';
    return {
        unresolvedPast,
        externalLink,
        concealedFact,
        pressure:`Страх — ${conflict.fear} — делает возвращение прошлого особенно опасным.`,
        activationTriggers:['recruitment','trust_60','relevant_sector','related_faction','biography_chat'],
        possibleDirections:[
            'разобраться с прошлым и получить новый контакт',
            'скрыть следы и разорвать прежнюю связь',
            'использовать связь в интересах лаборатории',
        ],
    };
}

export function compileGeneratedProfile(
    subjectId: string,
    context: GeneratedCharacterContext,
    sections: PromptSectionsResult
): GeneratedProfileV2 {
    if (!context.baseProfile) throw new Error('Generated context has no identity');

    const psyche = context.grouped.psychological[0];
    const conflict = CENTRAL_CONFLICTS[psyche?.id || ''] || {
        desire: 'сохранить влияние на собственную жизнь',
        fear: 'потерять контроль над происходящим',
        need: 'понятные намерения и последовательные правила'
    };
    const role = context.grouped.persona.find(tag => tag.id.startsWith('role_'));
    const cause = context.archetype === 'person' ? undefined : context.grouped.event.find(tag => tag.category === `${context.archetype}_cause`);
    const formative = context.grouped.event.filter(tag => tag !== cause);
    const gender = context.baseProfile.gender;
    const profileHooks = (tags: GeneratedTag[], limit = 6) => hooks(tags, limit).map(text => agreeGender(text, gender));
    const origin = [
        ...profileHooks(context.grouped.origin, 3),
        ...profileHooks(context.grouped.persona.filter(tag => tag.id.startsWith('origin_') || tag.id.startsWith('mem_')), 2)
    ];
    const traitHooks = profileHooks(context.grouped.trait, 4);
    const responseHooks = profileHooks(context.grouped.response, 2);
    const biasHooks = profileHooks(context.grouped.bias, 2);
    const bodyHooks = profileHooks(context.grouped.body, 2);
    const psycheHooks = profileHooks(context.grouped.psychological, 2);
    const roleHooks = role ? profileHooks([role], 3) : [];
    // A hook must have one psychological job. Reusing the same sentence as a
    // value, vulnerability and defense makes a single selected tag dominate
    // every reply and flattens otherwise different characters.
    const values = unique([...traitHooks, ...biasHooks], 4);
    const vulnerabilities = unique(psycheHooks.filter(hook => !values.includes(hook)), 3);
    const defenses = unique(responseHooks.filter(hook =>
        !values.includes(hook) && !vulnerabilities.includes(hook)
    ), 3);

    const biography: GeneratedProfileV2['biography'] = {
        origin: unique(origin, 5),
        formerRole: roleHooks[0],
        statusCause: agreeGender(cause?.narrative?.history?.[0] || cause?.summary || '', gender) || undefined,
        formativeEvents: profileHooks(formative, 3)
    };
    const behavioralCore: GeneratedProfileV2['behavioralCore'] = {
        values,
        needs: [conflict.need],
        vulnerabilities,
        defenses,
        // Former profession is biography and knowledge, not a verbal costume
        // that must colour every line of dialogue.
        voice: [],
        mannerisms: bodyHooks,
        centralConflict: { desire: agreeGender(conflict.desire, gender), fear: agreeGender(conflict.fear, gender) },
        conditionalReactions: context.tags.flatMap(tag => tag.reactionTriggers || []),
        attentionFocus: unique([
            traitHooks.some(text => /наблюд|замеч|свер/i.test(text)) ? 'change' : undefined,
            traitHooks.some(text => /эмоц|подстраив/i.test(text)) ? 'person' : undefined,
            traitHooks.some(text => /практич|прям/i.test(text)) ? 'technique' : undefined,
            psyche?.id === 'psy_curious_masochist' ? 'body' : undefined,
            psyche?.id === 'psy_defiant' ? 'risk' : undefined,
            role?.id === 'role_clerk' || role?.id === 'role_researcher' ? 'rules' : undefined
        ], 3) as GeneratedProfileV2['behavioralCore']['attentionFocus'],
        speechDisposition: responseHooks.some(text => /молч|замолка/i.test(text))
            ? 'quiet'
            : responseHooks.some(text => /сме|говор|отвеч/i.test(text)) ? 'expressive' : 'normal'
    };
    const identityText = context.archetype === 'person'
        ? `${context.baseProfile.name}, ${context.baseProfile.age}.`
        : `${context.baseProfile.name}, ${context.baseProfile.age}; роль: ${context.archetype}.`;
    const historyText = unique([
        ...biography.origin.slice(0, 3),
        biography.formerRole,
        biography.statusCause,
        ...biography.formativeEvents.slice(0, 1)
    ], 6).join('\n');
    const traitBlock = unique([
        `Стремление: ${behavioralCore.centralConflict.desire}.`,
        `Страх: ${behavioralCore.centralConflict.fear}.`,
        ...behavioralCore.values.slice(0, 2),
        ...behavioralCore.defenses.slice(0, 2),
        ...behavioralCore.voice.slice(0, 1),
        ...behavioralCore.mannerisms.slice(0, 1)
    ], 8).join('\n');
    const personaText = `[Личность]\n${identityText}\n\n[Биография]\n${historyText}\n\n[Поведенческое ядро]\n${traitBlock}`;
    const instructionBlock = sections.systemPrompt.match(/\[Инструкции\]:[\s\S]*$/)?.[0];

    return {
        version: 2,
        generatorRevision: PROFILE_GENERATOR_REVISION,
        subjectId,
        seed: context.seed,
        identity: {
            name: context.baseProfile.name,
            age: Number(context.baseProfile.age),
            gender: context.baseProfile.gender,
            anatomy: context.baseProfile.anatomy,
            archetype: context.archetype
        },
        biography,
        behavioralCore,
        knowledgeRefs: context.loreRefs,
        mechanicalSeed: {
            coreModifiers: context.baseModifiers || {},
            initialContexts: Array.from(new Set(context.initialContexts || [])),
            preferences: {
                actions: context.preferences?.actions || {},
                points: context.preferences?.points || {},
                contexts: context.preferences?.contexts || {},
                tags: context.preferences?.tags || {}
            }
        },
        sourceTags: context.tags.map(tag => tag.id),
        storySeed: buildStorySeed(context, biography, conflict),
        personaText,
        personaWithoutTraits: `[Личность]\n${identityText}\n\n[Биография]\n${historyText}`,
        traitBlock,
        loreNotes: context.loreNotes,
        loreRefs: context.loreRefs,
        systemPrompt: [personaText, instructionBlock].filter(Boolean).join('\n\n'),
        identityText,
        historyText,
        activationText: sections.activationText,
        updatedAt: new Date().toISOString()
    };
}
