import { applyResourceCosts } from './src/scenario/applyResourceCosts.js';
const player = {
    id: 'PL-1',
    resources: { strain: 0, credits: 1000, actionPoints: 20, maxActionPoints: 100 }
};
console.log(applyResourceCosts(player, { actionPoints: 15 }));
