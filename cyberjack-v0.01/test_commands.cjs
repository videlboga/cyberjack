const fetch = require('node-fetch');

async function test(msg) {
  console.log(`\n--> Testing '${msg}'`);
  const res = await fetch('http://localhost:3000/api/action/tick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subjectId: 'S-02', textMessage: msg, skipLLM: true })
  });
  const json = await res.json();
  if (!json.success) {
      console.log("Error:", json.error);
      return;
  }
  console.log("Intent:", json.classifierLog?.intent || "none");
  console.log("Target Context:", json.classifierLog?.targetContext);
  console.log("CommandIntent:", json.bundle?.metadata?.commandIntent);
  console.log("Active Contexts:", json.state.activeContexts.map(c => c.actionId));
  console.log("State Name:", json.state.name);
}

async function run() {
    await test('На колени!');
    await test('Надень наручники!');
    await test('Сними наручники с рук');
    await test('Встань с колен');
}

run().catch(console.error);
