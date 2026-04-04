import { subjectRepo, activeContextsRepo } from '../src/infrastructure/repositories';
import { compileAction } from '../src/compiler/compileAction';
import { applyDynamicContexts } from '../src/compiler/dynamicModifiers';
import { runTick } from '../src/engine/runTick';

type Scenario = {
    label: string;
    presetId: string;
    intensity: number;
    text?: string;
    setup?: () => void;
    teardown?: () => void;
};

const subjectId = 'S-01';
const pointId = 'general';

function runScenario({ label, presetId, intensity, text, setup, teardown }: Scenario) {
    if (setup) setup();

    const base = compileAction({
        presetId,
        eventId: 'lab',
        playerIntensity: intensity,
        history: [],
        dynamicModifiers: text
            ? {
                  commandIntent: {
                      type: 'say',
                      payload: text
                  }
              }
            : {}
    });

    const subject = subjectRepo.getWithPoint(subjectId, pointId);
    if (!subject) {
        console.error('Subject not found');
        return;
    }
    const adjusted = applyDynamicContexts(
        base,
        subject as any,
        (subject as any).point || { localSensitivity: 50, localAttitude: 50 }
    );

    const result = runTick({
        action: adjusted,
        core: subject as any,
        point: (subject as any).point || { localSensitivity: 50, localAttitude: 50 }
    });

    const delta = result.delta.core;
    console.log(`\n[${label}]`);
    console.log(
        `ΔSensitivity=${delta.sensitivity.toFixed(2)}, ΔCapacity=${delta.capacity.toFixed(
            2
        )}, ΔOpenness=${delta.openness.toFixed(2)}, ΔAttitude=${delta.attitude.toFixed(2)}`
    );
    console.log(
        `Intensity=${result.result.experiencedIntensity.toFixed(
            2
        )}, Pleasure=${result.result.pleasure.toFixed(2)}, Discomfort=${result.result.discomfort.toFixed(
            2
        )}, Overload=${result.result.overload.toFixed(2)}`
    );
    if (teardown) teardown();
}

const scenarios: Scenario[] = [
    {
        label: 'Conversation (0.1)',
        presetId: 'verbal_pressure',
        intensity: 0.1,
        text: 'Как себя чувствуешь?'
    },
    {
        label: 'Conversation (0.3)',
        presetId: 'verbal_pressure',
        intensity: 0.3,
        text: 'Ответь подробно.'
    },
    {
        label: 'Conversation (0.8)',
        presetId: 'verbal_pressure',
        intensity: 0.8,
        text: 'Жёстко приказываю.'
    },
    {
        label: 'Light tickle (0.4)',
        presetId: 'tickle',
        intensity: 0.4
    },
    {
        label: 'Conversation with legs bound',
        presetId: 'verbal_pressure',
        intensity: 0.3,
        text: 'Сохраняй позу.',
        setup: () => {
            activeContextsRepo.add('lab', 'legs_bound', -1);
        },
        teardown: () => activeContextsRepo.remove('lab', 'legs_bound')
    }
];

console.log('Initial core:', subjectRepo.get(subjectId));
activeContextsRepo.remove('lab', 'legs_bound');
for (const scenario of scenarios) {
    runScenario(scenario);
}
