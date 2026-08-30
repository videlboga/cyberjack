import { computeTransactionalStep } from '../src/services/transactionalStep';

// Реальные персонажи: Ника (ok_not_ok, safety/autonomy), Суми (ok_ok...)
// Прогон разных сценариев для визуальной проверки образов.
const cases: Array<[string, Parameters<typeof computeTransactionalStep>[0]]> = [
    ['Ника отвечает на свысока (перекрёстная)', {
        myEgo: 'adult', familiarity: 0.4, lifePosition: 'ok_not_ok', need: 'safety',
        stress: 40, incoming: { transaction: 'crossed', apparentEgoState: 'critical_parent' },
    }],
    ['Суми углубляет (вопрос)', {
        myEgo: 'adapted_child', familiarity: 0.4, lifePosition: 'ok_ok', need: 'approval',
        stress: 20, incoming: { transaction: 'complementary', speechAct: 'question' },
    }],
    ['Игра NIGYSOB активна', {
        myEgo: 'critical_parent', familiarity: 0.3, lifePosition: 'ok_not_ok', need: 'autonomy',
        stress: 30, gameActive: true, gameDrive: 'nigsyb',
    }],
    ['Высокий голод (стресс) взрослый', {
        myEgo: 'adult', familiarity: 0.2, lifePosition: 'ok_ok', need: 'connection',
        stress: 90, incoming: { transaction: 'complementary' },
    }],
];

for (const [label, input] of cases) {
    const step = computeTransactionalStep(input);
    console.log(`\n=== ${label} ===`);
    console.log(`реакция: ${step.reactionType}, эго: ${step.responseEgo}, раскрытие: ${step.disclosure}, дуга: ${step.arc}`);
    console.log(`ОБРАЗ: ${step.image}`);
}
