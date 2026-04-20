const fs = require('fs');

let content = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf-8');

// Replace standard compliance with equation based on Attitude + Plasticity
let searchObj1 = `const currentCompliance = 100;
                const moveCompliance = 30;`;

let replaceObj1 = `const currentCompliance = (state.relation?.attitude || state.core.attitude || 0) + ((state.core.plasticity || 0) * 0.5);
                const moveCompliance = 30;`;

content = content.replace(searchObj1, replaceObj1);

let searchObj2 = `const requiredCompliance = (actionPreset.priority || 1) * 20;
                const currentCompliance = 100;`;

let replaceObj2 = `const requiredCompliance = (actionPreset.priority || 1) * 20;
                const currentCompliance = (state.relation?.attitude || state.core.attitude || 0) + ((state.core.plasticity || 0) * 0.5);`;

content = content.replace(searchObj2, replaceObj2);

let searchObj3 = `const requiredCompliance = (actionPreset.contextConfig.priority || 1) * 20;
                const currentCompliance = 100;`;

let replaceObj3 = `const requiredCompliance = (actionPreset.contextConfig.priority || 1) * 20;
                const currentCompliance = (state.relation?.attitude || state.core.attitude || 0) + ((state.core.plasticity || 0) * 0.5);`;

content = content.replace(searchObj3, replaceObj3);


// Inject logic for reason narrative based on variables
let searchObj4 = `if (currentCompliance >= requiredCompliance) {
                    const forcedNarrative = \`Выполнено действие: \${actionPreset.label} (цель: \${targetName})\`;`;

let replaceObj4 = `if (currentCompliance >= requiredCompliance) {
                    let reason = state.relation?.attitude > 70 ? "из симпатии и покорности" : "вынужденно подчиняясь сломленной воле";
                    if (state.core.attitude < 30) reason = "скрипя зубами, но будучи не в силах сопротивляться";
                    const forcedNarrative = \`[Система]: Актив выполняет указание "\${actionPreset.label}" (цель: \${targetName}), \${reason}.\`;`;

content = content.replace(searchObj4, replaceObj4);

fs.writeFileSync('src/orchestration/runGameTick.ts', content);
