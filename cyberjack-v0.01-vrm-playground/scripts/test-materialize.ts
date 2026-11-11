import { materializeSubjectiveMemoryForSubject } from '../src/workers/subjectiveMemoryWorker';

async function main() {
  const ok = await materializeSubjectiveMemoryForSubject('S-AV-01');
  console.log('materialized:', ok);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
