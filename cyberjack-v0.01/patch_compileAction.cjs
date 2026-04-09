const fs = require('fs');
const file = 'src/compiler/compileAction.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "// Apply the player's slider",
    `if (input.dynamicModifiers && input.dynamicModifiers.contextConfig) {
        baseWithDynamic.contextConfig = { ...(baseWithDynamic.contextConfig || {}), ...input.dynamicModifiers.contextConfig };
    }

    // Apply the player's slider`
);

fs.writeFileSync(file, code);
