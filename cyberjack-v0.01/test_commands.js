async function test(msg) {
  console.log(`\n--> Testing '${msg}'`);
  const res = await fetch('http://localhost:3000/api/tick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subjectId: 'S-02', textMessage: msg, skipLLM: true })
  });
  const text = await res.text();
  try {
      const json = JSON.parse(text);
      if (!json.success) {
          console.log("Error:", json.error);
          return;
      }
      console.log("Intent (Raw JSON):", json.classifierLog);
      console.log("CommandIntent:", json.bundle?.metadata?.commandIntent);
      console.log("Active Contexts:", json.state?.activeContexts?.map(c => c.actionId));
  } catch(e) {
      console.log("Not JSON:", text.substring(0, 100));
  }
}

async function run() {
    await test('На колени!');
    await test('Надень наручники!');
    await test('Сними наручники с рук');
    await test('Встань с колен');
}

run().catch(console.error);
