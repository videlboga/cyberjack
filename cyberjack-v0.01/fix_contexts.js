const fs = require('fs');
let file = fs.readFileSync('src/ui/AnatomyView.tsx', 'utf-8');
file = file.replace(
  "return activeContexts.filter(c => c.pointId === point || (point === 'general' && (!c.pointId || c.pointId === 'general')));",
  "return activeContexts.filter(c => { if (point === 'general' && c.type === 'condition' && c.actionId === 'effect_local_numbness') return false; return c.pointId === point || (point === 'general' && !c.pointId); });"
);
fs.writeFileSync('src/ui/AnatomyView.tsx', file);
