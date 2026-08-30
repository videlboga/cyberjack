import 'dotenv/config';
import '../src/infrastructure/db';
import { createSocialTurnPlan } from '../src/services/socialTransactions';

// Мира (adapted_child) -> Калибратор, co_presence, shared_cell
const mira = createSocialTurnPlan('S-AV-01', 'PL-1', 100, 'co_presence', undefined, {
    topic: 'shared_cell', context: 'общая камера', coPresent: true,
});
console.log('Мира (adapted_child):', mira ? `act=${mira.act} ego=${mira.egoState} need=${mira.need}` : 'null');

// Калибратор (critical_parent) -> Мира
const kal = createSocialTurnPlan('PL-1', 'S-AV-01', 100, 'co_presence', undefined, {
    topic: 'shared_cell', context: 'общая камера', coPresent: true,
});
console.log('Калибратор (critical_parent):', kal ? `act=${kal.act} ego=${kal.egoState} need=${kal.need}` : 'null');

// Суми (free_child) -> Мира
const sumi = createSocialTurnPlan('NPC-CAND-SUMI', 'S-AV-01', 100, 'co_presence', undefined, {
    topic: 'shared_cell', context: 'общая камера', coPresent: true,
});
console.log('Суми (free_child):', sumi ? `act=${sumi.act} ego=${sumi.egoState} need=${sumi.need}` : 'null');
