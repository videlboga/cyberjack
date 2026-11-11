import { db } from '../src/infrastructure/db';

async function testV() {
   // Make sure player has enough credits
   db.prepare("UPDATE character_resources SET amount = 1000 WHERE character_id = 'PL-1' AND resource_key = 'credits'").run();

   console.log("=== STEP 1: Asking Catalog ===");
   const r1 = await fetch('http://localhost:3000/api/tick', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
         subjectId: 'B-001',
         playerId: 'PL-1',
         sceneId: 'lab',
         pointId: 'systemic',
         presetId: 'verbal_pressure', // Just talk
         textMessage: 'Ворон, покажи прайс. Что есть на продажу?'
      })
   });
   const data1 = await r1.json();
   console.log("LLM 1:", data1);

   console.log("\n=== STEP 2: Buying RAW-001 ===");
   const r2 = await fetch('http://localhost:3000/api/tick', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
         subjectId: 'B-001',
         playerId: 'PL-1',
         sceneId: 'lab',
         pointId: 'systemic',
         presetId: 'buy_raw_asset',
         payload: { assetId: 'RAW-001' },
         textMessage: 'Я беру Fresh Spacer. Перевожу бабки.'
      })
   });
   const data2 = await r2.json();
   console.log("LLM 2:", data2);

   console.log("\n=== STEP 3: Check Results ===");
   const raws = db.prepare('SELECT id, name FROM subjects WHERE id = ?').get('RAW-001') as any;
   console.log("RAW-001 in Subjects:", raws);
   const scene = db.prepare('SELECT * FROM scene_characters WHERE scene_id = ? AND character_id = ?').get('lab', 'RAW-001');
   console.log("RAW-001 in Scene:", scene);
   const pRes = db.prepare('SELECT amount FROM character_resources WHERE character_id = ? AND resource_key = ?').get('PL-1', 'credits') as any;
   console.log("Player Credits:", pRes.amount);
   const bRes = db.prepare('SELECT metadata FROM character_resources WHERE character_id = ? AND resource_key = ?').get('B-001', 'store_catalog') as any;
   console.log("Broker Catalog:", JSON.parse(bRes.metadata).assets);
}

testV().catch(console.error);
