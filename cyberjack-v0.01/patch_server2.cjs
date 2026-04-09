const fs = require('fs');
const file = 'src/api/server.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace("if (!req.body.skipLLM) {", `
        let narratorReaction: string | null = null;
        const actorReplies: Array<{ actorId: string; kind: string; tone?: string; speech: string; reaction: string }> = [];
        let primaryReply: { speech: string; reaction: string } | null = null;
        let promptMessages: any = null;

        if (!req.body.skipLLM) {`);

// also remove them from inside the block
code = code.replace("let narratorReaction: string | null = null;", "");
code = code.replace("const actorReplies: Array<{ actorId: string; kind: string; tone?: string; speech: string; reaction: string }> = [];", "");
code = code.replace("let primaryReply: { speech: string; reaction: string } | null = null;", "");
code = code.replace("let promptMessages: any = null;", "");

fs.writeFileSync(file, code);
console.log('patched 2');
