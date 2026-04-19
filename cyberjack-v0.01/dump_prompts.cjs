const fs = require('fs');

const lines = fs.readFileSync('logs/prompt_payloads.jsonl', 'utf8')
  .trim()
  .split('\n')
  .filter(Boolean)
  .map(l => JSON.parse(l));

lines.forEach((l, i) => {
  if (l.kind === 'reactive' || l.kind === 'proactive') {
    console.log(`\n================= EVENT ${i + 1} (Actor: ${l.actorId}) =================`);
    console.log(`--- PROMPT MESSAGES ---`);
    if (l.sentMessages) {
        l.sentMessages.forEach(m => {
            console.log(`[Role: ${m.role}]:\n${m.content}`);
        });
    } else {
        console.log("No sentMessages");
    }
    console.log(`--- LLM RESPONSE ---`);
    console.log(l.response ? l.response.speech : "NONE");
  }
});
