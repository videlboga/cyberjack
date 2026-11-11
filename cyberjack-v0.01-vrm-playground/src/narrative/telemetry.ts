import { InteractionObservation, SubjectCoreState, SubjectPointState } from '../domain/types';
import { interpretPointSensitivity, sensitivityBand } from '../domain/parameterInterpretation';

export type TelemetryTrend = 'up' | 'down' | 'stable';

export interface TelemetrySignal {
    id: 'pulse' | 'breathing' | 'muscleTone' | 'motorResponse' | 'contact' | 'localResponse';
    label: string;
    value: string;
    numeric?: number;
    unit?: string;
    trend: TelemetryTrend;
    confidence: 'high' | 'medium';
    evidence: string[];
}

export interface TelemetrySnapshot {
    summary: string;
    signals: TelemetrySignal[];
    behavioral: string[];
    measuredAt: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const trend = (delta: number, threshold = 0.25): TelemetryTrend => delta > threshold ? 'up' : delta < -threshold ? 'down' : 'stable';
const hasContext = (contexts: Array<{ id?: string; actionId?: string }> = [], id: string) => contexts.some(ctx => (ctx.id || ctx.actionId) === id);

export function deriveTelemetry(input: {
    core: SubjectCoreState;
    point?: Partial<SubjectPointState> | null;
    observation?: InteractionObservation | null;
    contexts?: Array<{ id?: string; actionId?: string }>;
}): TelemetrySnapshot {
    const { core, point, observation } = input;
    const contexts = input.contexts || observation?.contexts || [];
    const reaction = observation?.reaction || { pleasure: 0, discomfort: 0, overload: 0, engagement: 0, mixed: false };
    const changes = observation?.changes || { tension: 0, capacity: 0, attitude: 0, openness: 0, localAttitude: 0 };
    const discharged = observation?.transitions.some(item => item.kind === 'discharge') || hasContext(contexts, 'effect_refractory');
    const unresponsive = observation?.behavioralState === 'unresponsive' || hasContext(contexts, 'effect_apathy') || hasContext(contexts, 'effect_chronic_apathy');
    const panic = observation?.behavioralState === 'panic' || hasContext(contexts, 'effect_panic');
    const overload = observation?.behavioralState === 'overload' || hasContext(contexts, 'effect_sensory_overload');
    const subspace = observation?.behavioralState === 'subspace' || hasContext(contexts, 'effect_subspace');

    const pulse = Math.round(clamp(62 + core.tension * 0.52 + reaction.pleasure * 1.15 + reaction.discomfort * 0.9 + reaction.overload * 0.7 - (discharged ? 8 : 0), 48, 168));
    const breathingRate = Math.round(clamp(11 + core.tension * 0.12 + reaction.pleasure * 0.22 + reaction.discomfort * 0.3 + reaction.overload * 0.18, 7, 36));
    const pulseTrend = discharged ? 'down' : trend(changes.tension + reaction.engagement * 0.12);
    const breathingTrend = discharged ? 'down' : trend(changes.tension + reaction.discomfort * 0.18);
    const breathingValue = unresponsive ? 'поверхностное' : panic || overload ? 'рваное' : breathingRate >= 25 ? 'частое' : breathingRate >= 18 ? 'учащённое' : 'ровное';
    const toneScore = clamp(core.tension + reaction.discomfort * 2 + reaction.overload * 2 - (100 - core.capacity) * 0.25 - (discharged ? 30 : 0), 0, 120);
    const toneValue = unresponsive ? 'снижен' : toneScore >= 80 ? 'защитный' : toneScore >= 50 ? 'высокий' : toneScore <= 20 ? 'расслабленный' : 'собранный';
    const motorValue = unresponsive ? 'реакция почти отсутствует' : panic ? 'резкие защитные движения' : overload ? 'дрожь и запаздывание' : core.capacity < 20 ? 'слабая реакция' : subspace ? 'замедленная реакция' : 'движения стабильны';
    const contactValue = unresponsive ? 'утрачен' : panic ? 'отвергается' : observation?.behavioralState === 'defiance' ? 'конфликтный' : subspace ? 'замедленный' : core.capacity < 25 ? 'нестабильный' : 'устойчивый';
    const localSensitivity = Number(point?.localSensitivity ?? core.sensitivity);
    const localInterpretation = interpretPointSensitivity(
        point?.pointId || 'systemic',
        localSensitivity,
        point?.baselineLocalSensitivity
    );
    const localValue = sensitivityBand(localInterpretation);

    const stateTitle = observation?.currentState?.title || (unresponsive ? 'Осмысленный контакт потерян' : panic ? 'Защитная реакция' : subspace ? 'Внимание погружено в ощущения' : 'Контакт сохраняется');
    const summary = discharged
        ? `${stateTitle}. После пика физиологические показатели идут на спад.`
        : `${stateTitle}. ${core.capacity < 25 ? 'Функциональный ресурс истощён.' : core.tension >= 80 ? 'Физиологическое возбуждение близко к пределу.' : 'Критических признаков не зафиксировано.'}`;

    const behavioral = [
        changes.attitude > 0.15 ? 'контакт принимается охотнее' : changes.attitude < -0.15 ? 'принятие контакта снижается' : 'отношение к контакту без явного сдвига',
        changes.openness > 0.15 ? 'выражает реакцию свободнее' : changes.openness < -0.15 ? 'сильнее закрывается' : 'манера ответа остаётся прежней',
        reaction.mixed ? 'приятная и защитная реакции возникают одновременно' : reaction.pleasure > reaction.discomfort * 1.25 ? 'положительная телесная реакция преобладает' : reaction.discomfort > reaction.pleasure * 1.25 ? 'защитная телесная реакция преобладает' : 'валентность реакции неочевидна'
    ];

    return {
        summary,
        measuredAt: new Date().toISOString(),
        behavioral,
        signals: [
            { id: 'pulse', label: 'Пульс', value: String(pulse), numeric: pulse, unit: 'уд/мин', trend: pulseTrend, confidence: 'medium', evidence: ['физиологическое напряжение', 'последняя реакция'] },
            { id: 'breathing', label: 'Дыхание', value: `${breathingValue}, ${breathingRate}/мин`, numeric: breathingRate, unit: 'вдох/мин', trend: breathingTrend, confidence: 'medium', evidence: ['физиологическое напряжение', 'перегрузка'] },
            { id: 'muscleTone', label: 'Тонус', value: toneValue, trend: discharged ? 'down' : trend(changes.tension), confidence: 'medium', evidence: ['напряжение', 'остаточный ресурс'] },
            { id: 'motorResponse', label: 'Моторика', value: motorValue, trend: core.capacity < 25 || overload ? 'down' : 'stable', confidence: 'high', evidence: ['поведенческое состояние', 'остаточный ресурс'] },
            { id: 'contact', label: 'Контакт', value: contactValue, trend: trend(changes.openness + changes.attitude), confidence: 'high', evidence: ['осмысленная реакция', 'поведение'] },
            { id: 'localResponse', label: 'Отклик зоны', value: localValue, trend: trend(observation?.learning.sensitivityDelta || 0, 0.05), confidence: 'medium', evidence: ['локальная чувствительность', 'последнее воздействие'] }
        ]
    };
}

export function formatTelemetryForPrompt(snapshot: TelemetrySnapshot): string {
    const arrow = (value: TelemetryTrend) => value === 'up' ? 'растёт' : value === 'down' ? 'снижается' : 'стабильно';
    return [
        `Ты читаешь на доступном тебе экране: ${snapshot.summary}`,
        ...snapshot.signals.map(signal => `- ${signal.label}: ${signal.value}${signal.unit && !signal.value.includes(signal.unit) ? ` ${signal.unit}` : ''}; ${arrow(signal.trend)}.`),
        `Одновременно ты видишь внешнее поведение: ${snapshot.behavioral.join('; ')}.`
    ].join('\n');
}

export function formatVisibleConditionForPrompt(snapshot: TelemetrySnapshot): string {
    return `Ты можешь судить только по внешним признакам: ${snapshot.behavioral.join('; ')}. Точные внутренние показатели тебе недоступны.`;
}
