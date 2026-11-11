import { InteractionObservation, SubjectCoreState } from '../domain/types';

export type BoundaryStrategy = 'command' | 'firm_request' | 'plea' | 'bargain' | 'formal_objection' | 'warning' | 'appeasement' | 'concealed' | 'silent_withdrawal';

export interface BoundaryExpressionFrame {
    need: 'slow_down' | 'stop';
    strategy: BoundaryStrategy;
    directness: 'direct' | 'indirect' | 'unable';
    force: 'controlled' | 'urgent' | 'desperate' | 'fading';
    coherence: 'clear' | 'broken' | 'fragmented' | 'nonverbal';
    disclosure: 'concealed' | 'partial' | 'open';
    escalation: 'first' | 'repeated' | 'ignored' | 'collapsed';
    instruction: string;
}

export function buildBoundaryExpression(observation: InteractionObservation, core: SubjectCoreState): BoundaryExpressionFrame | null {
    const boundary = observation.reactionSnapshot?.boundary;
    if (!boundary || boundary.request === 'none') return null;
    const snapshot = observation.reactionSnapshot!;
    const fear = Number(snapshot.dynamics.fear || 0);
    const agency = Number(snapshot.appraisal.agency ?? 30);
    const resistance = Number(snapshot.behavior.resistance || 0);
    const trust = Number(snapshot.appraisal.trust ?? 50);
    const dissociation = Number(snapshot.dynamics.dissociation || 0);
    const learnedCompliance = Number(snapshot.dynamics.learnedCompliance || 0);
    const control = Number(snapshot.affect.control ?? core.capacity ?? 50);
    const state = observation.behavioralState;
    const ignored = boundary.ignored;
    const repeated = boundary.intensity >= .7 || resistance >= 65;

    let escalation: BoundaryExpressionFrame['escalation'] = ignored ? 'ignored' : repeated ? 'repeated' : 'first';
    let strategy: BoundaryStrategy;
    if (state === 'unresponsive' || control <= 5) {
        strategy = 'silent_withdrawal';
        escalation = 'collapsed';
    } else if (dissociation >= 70 || snapshot.behavior.desiredResponse === 'silent_compliance') {
        strategy = 'concealed';
        escalation = ignored ? 'collapsed' : escalation;
    } else if (fear >= 70 && agency < 40 && resistance < 65) {
        strategy = learnedCompliance >= 60 ? 'appeasement' : 'plea';
    } else if (fear >= 70 && resistance >= 65) {
        strategy = ignored ? 'warning' : 'command';
    } else if (learnedCompliance >= 60 && agency < 50) {
        strategy = 'bargain';
    } else if (agency >= 60 && resistance >= 50) {
        strategy = ignored ? 'warning' : 'command';
    } else if (trust >= 65) {
        strategy = 'firm_request';
    } else {
        strategy = agency < 35 ? 'plea' : 'firm_request';
    }

    const directness: BoundaryExpressionFrame['directness'] = strategy === 'silent_withdrawal' ? 'unable'
        : strategy === 'concealed' || strategy === 'appeasement' || strategy === 'bargain' ? 'indirect'
        : 'direct';
    const force: BoundaryExpressionFrame['force'] = strategy === 'silent_withdrawal' || strategy === 'concealed' ? 'fading'
        : fear >= 75 && control < 45 ? 'desperate'
        : ignored || boundary.intensity >= .7 ? 'urgent'
        : 'controlled';
    const coherence: BoundaryExpressionFrame['coherence'] = directness === 'unable' ? 'nonverbal'
        : control <= 15 ? 'fragmented'
        : control <= 35 || state === 'panic' || state === 'freeze' ? 'broken'
        : 'clear';
    const disclosure: BoundaryExpressionFrame['disclosure'] = strategy === 'plea' && (trust >= 55 || fear >= 85) ? 'open'
        : ['concealed', 'appeasement', 'bargain'].includes(strategy) ? 'concealed'
        : fear >= 45 ? 'partial'
        : 'concealed';
    const needText = boundary.request === 'stop' ? 'немедленно прекратить контакт' : 'ослабить или замедлить воздействие';
    // Strategy names remain engine-facing. The model receives continuous
    // speech constraints rather than a menu of named reply templates.
    const strategyText: Record<BoundaryStrategy, string> = {
        command: 'Ты веришь, что ещё можешь повлиять на происходящее, поэтому говоришь прямо и не смягчаешь необходимое действие.',
        firm_request: 'Ты обращаешься к собеседнику прямо, но пытаешься добиться реакции без давления или угрозы.',
        plea: 'Ты почти не веришь, что тебя услышат. Голос теряет твёрдость; ты допускаешь уязвимость и пытаешься вызвать сочувствие.',
        bargain: 'Ты не решаешься опереться только на собственное право отказать и связываешь прекращение с уступкой со своей стороны.',
        formal_objection: 'Ты прячешь уязвимость за точной безличной формулировкой и подчёркиваешь обязательность границы.',
        warning: 'Тебя уже не услышали, поэтому ты обозначаешь конкретное последствие дальнейшего игнорирования.',
        appeasement: 'Ты стараешься снизить чужую агрессию, показываешь готовность не спорить и ищешь способ добиться прекращения без нового конфликта.',
        concealed: 'Страх почти не даёт произнести прямой отказ: смысл прорывается косвенно и слабее, чем внутренняя необходимость остановиться.',
        silent_withdrawal: 'Связная речь почти недоступна; граница проявляется только в коротком звуке, обрыве или молчании.',
    };
    const coherenceText = coherence === 'clear' ? 'Фраза может быть ясной и законченной.' : coherence === 'broken' ? 'Фраза короткая и сбивается.' : coherence === 'fragmented' ? 'Получаются только обрывки по несколько слов.' : 'Не заставляй себя произносить связную фразу.';
    const disclosureText = disclosure === 'open' ? 'Ты можешь прямо назвать свой страх.' : disclosure === 'partial' ? 'Страх слышен, даже если ты не называешь его прямо.' : 'Ты стараешься не раскрывать страх словами.';
    return {
        need: boundary.request,
        strategy,
        directness,
        force,
        coherence,
        disclosure,
        escalation,
        instruction: `Ты действительно хочешь ${needText}. ${strategyText[strategy]} ${coherenceText} ${disclosureText} Слабая или косвенная форма не отменяет саму границу.`,
    };
}
