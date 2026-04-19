const fs = require('fs');

// Patch verbalParser.ts
let parserContent = fs.readFileSync('src/parser/verbalParser.ts', 'utf-8');
parserContent = parserContent.replace(/приказом переместиться/g, 'требованием или просьбой переместиться');
parserContent = parserContent.replace(/приказ "подойди ко мне"/g, 'запрос "подойди ко мне"');
parserContent = parserContent.replace(/прямым приказом применить/g, 'требованием/просьбой применить');
parserContent = parserContent.replace(/приказом выполнить/g, 'запросом или указанием выполнить');
fs.writeFileSync('src/parser/verbalParser.ts', parserContent);

// Patch runGameTick.ts
let tickContent = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf-8');
tickContent = tickContent.replace(
    /Получен ПРЯМОЙ ПРИКАЗ на выполнение действия — .* Примени это действие физически\. Если отказываешься, то отыграй сопротивление\./,
    'Поступило указание на выполнение действия — "${actionPreset.label}" (цель: ${commandIntent.targetId || \'не указана\'}, точка: ${commandIntent.pointId || \'любая\'}). Реши, как отреагировать (выполнить или отказаться), опираясь на текущий уровень подчинения и отношение к субъекту.'
);

// Fix move refuse narrative
tickContent = tickContent.replace(
    /Актив мысленно ОТКАЗЫВАЕТСЯ выполнить приказ на перемещение/,
    'Актив мысленно отклоняет указание на перемещение'
);

fs.writeFileSync('src/orchestration/runGameTick.ts', tickContent);
