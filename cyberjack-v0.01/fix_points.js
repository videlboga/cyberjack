const fs = require('fs');

const actionsPath = 'src/infrastructure/data/presets/actions.json';
const anatomyPath = 'src/domain/anatomy.ts';
const anatomyViewPath = 'src/ui/AnatomyView.tsx';

let actions = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));

actions.forEach(act => {
    if (act.validTargets) {
        act.validTargets = act.validTargets.map(t => {
            if (t === 'global_pose' || t === 'slot_pose') return 'posture';
            if (t === 'general') {
                return (act.categories && act.categories.includes('verbal')) ? 'mind_state' : 'systemic';
            }
            return t;
        });
        act.validTargets = [...new Set(act.validTargets)];
    }
    
    if (act.occupiesPoints) {
        act.occupiesPoints = act.occupiesPoints.map(t => {
            if (t === 'global_pose' || t === 'slot_pose') return 'posture';
            if (t === 'general') {
                return (act.categories && act.categories.includes('verbal')) ? 'mind_state' : 'systemic';
            }
            return t;
        });
        act.occupiesPoints = [...new Set(act.occupiesPoints)];
    }
});

fs.writeFileSync(actionsPath, JSON.stringify(actions, null, 2));

let anatomy = fs.readFileSync(anatomyPath, 'utf8');

anatomy = anatomy.replace(/{ id: 'global_pose', label: 'Общая поза тела \(виртуальная\)', sens: 0, att: 50 },/, 
    "{ id: 'posture', label: 'Поза (Текущее положение тела)', sens: 0, att: 50 },");
anatomy = anatomy.replace(/{ id: 'mind_state', label: 'Состояние разума \(виртуальная\)', sens: 0, att: 50 },/, 
    "{ id: 'mind_state', label: 'Психика/Разум', sens: 0, att: 50 },");
anatomy = anatomy.replace(/{ id: 'slot_pose', label: 'Слот: Поза', sens: 50, att: 50 },/, "");
anatomy = anatomy.replace(/{ id: 'general', label: 'Общее воздействие', sens: 50, att: 50 }/, 
    "{ id: 'systemic', label: 'Организм (Системное)', sens: 50, att: 50 }");

fs.writeFileSync(anatomyPath, anatomy);

let view = fs.readFileSync(anatomyViewPath, 'utf8');
view = view.replace(/'general'/g, "'systemic'");
view = view.replace(/point === 'systemic'/g, "point === 'systemic'");

// In anatomyView update POINT_GROUPS if needed
view = view.replace(/system: \['mind_state', 'global_pose', 'slot_room', 'slot_social', 'systemic'\],/g, 
                    "system: ['mind_state', 'posture', 'systemic'],");

fs.writeFileSync(anatomyViewPath, view);

console.log("Done refactoring points.");
