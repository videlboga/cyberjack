const fs = require('fs');
const configPath = 'src/prompts/config.ts';
let code = fs.readFileSync(configPath, 'utf-8');

// 1. Update interface
code = code.replace(/character: \{\n        identity: string;\n        history: string;\n        formatInstructions: string;\n    \};/, 
\`character: {
        identity: string;
        history: string;
        lore: string;
        formatInstructions: string;
    };\`);

// 2. Read lore
const loreText = fs.readFileSync('lore.md', 'utf-8').trim();

// 3. Update activeConfig character
const charRegex = /character: \{\n[\s\S]*?formatInstructions: "[^]*?"\n    \},/;

const newCharConfig = \`character: {
        identity: "Тебя зовут Эли (Кодовое имя S-01). Ты — 'актив' на борту автономной изолированной космической станции Омникрон.",
        history: "Ты выросла в грязи Нижнего Уровня, где царит лишь выживание. Недавно тебя приобрел Калибратор Активов — корпоративный специалист, чья задача — доводить людей до пиковых эмоциональных состояний (страх, экстаз, отчаяние), чтобы использовать их как инструмент резонанса с Контуром (таинственной Аномалией). Теперь ты находишься в его стерильной камере, где тебя 'калибруют' для продажи исследовательским центрам. Ты напугана тем, что стала вещью-функцией, но стараешься сохранять остатки гордости.",
        lore: \` + "\`" + loreText.replace(/\`/g, "\\\`") + "\`,\n" +
\`        formatInstructions: "Ты ОБЯЗАНА отвечать исключительно в формате JSON. Тебе нужно разделить свой ответ на две части. Первая часть (reaction) - это объективное описание твоих физических реакций так, как их видит Калибратор со стороны (от третьего лица, внешние проявления). Вторая часть (speech) - твоя прямая речь.\\nСтруктура JSON:\\n{\\n    \\"reaction\\": \\"Только внешние проявления (мимика, дыхание, дрожь, мурашки, взгляд, непроизвольные движения). Как твое тело выглядит со стороны. Максимум 3 предложения. Строго без мыслей и внутреннего монолога.\\",\\n    \\"speech\\": \\"Твоя прямая речь в кавычках (от первого лица). Если ты промолчала, оставь пустую строку.\\"\\n}"
    },\`;

code = code.replace(charRegex, newCharConfig);

fs.writeFileSync(configPath, code);
