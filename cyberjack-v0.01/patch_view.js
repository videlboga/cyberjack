const fs = require('fs');
let view = fs.readFileSync('src/ui/AnatomyView.tsx', 'utf8');
view = view.replace(
    /\{ id: 'system', label: 'Системы и Контекст', points: \['systemic', 'mind_state', 'global_pose', 'slot_room', 'slot_social'\] \}/,
    "{ id: 'system', label: 'Общее состояние', points: ['systemic', 'mind_state', 'posture'] }"
);
view = view.replace(
    /\{ id: 'system', label: 'Системы и Контекст', points: \['general', 'mind_state', 'global_pose', 'slot_pose', 'slot_room', 'slot_social'\] \}/,
    "{ id: 'system', label: 'Общее состояние', points: ['systemic', 'mind_state', 'posture'] }"
);
view = view.replace(/global_pose/g, 'posture'); // just in case
view = view.replace(/slot_pose/g, 'posture'); 
view = view.replace(/general/g, 'systemic'); 
fs.writeFileSync('src/ui/AnatomyView.tsx', view);
