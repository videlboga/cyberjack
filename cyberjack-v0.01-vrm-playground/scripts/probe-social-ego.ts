import 'dotenv/config';
import '../src/infrastructure/db';
import { createSocialTurnPlan } from '../src/services/socialTransactions';

// Мира (adapted_child) -> Калибратор
const plan = createSocialTurnPlan('S-AV-01', 'PL-1', 100000, 'co_presence');
if (plan) {
    console.log('Мира -> Калибратор:');
    console.log('  egoState:', plan.egoState);
    console.log('  hiddenPosition:', plan.hiddenPosition);
    console.log('  need:', plan.need);
    console.log('  act:', plan.act);
    console.log('  topic:', plan.topic);
} else {
    console.log('нет плана (нет отношения?)');
}
