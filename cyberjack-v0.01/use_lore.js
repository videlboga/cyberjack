const fs = require('fs');
const filepath = 'src/prompts/buildPromptPayload.ts';
let code = fs.readFileSync(filepath, 'utf-8');

code = code.replace(/const characterProfile = \`\$\{cfg\.identity\}\\n\$\{cfg\.history\}\\n\[Инструкции\]: \$\{cfg\.formatInstructions\}\`;/, 
`const loreText = (cfg as any).lore ? "\\n[Общие знания игрового мира / Лор]:\\n" + (cfg as any).lore + "\\n" : "";
    const characterProfile = \`\${cfg.identity}\\n\${cfg.history}\${loreText}\\n[Инструкции]: \${cfg.formatInstructions}\`;`);

fs.writeFileSync(filepath, code);
