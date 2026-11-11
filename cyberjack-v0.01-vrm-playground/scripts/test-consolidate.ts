import { consolidateNextInterpretation } from '../src/services/interpretationRegeneration';

async function main() {
  for (let i = 0; i < 3; i++) {
    const ok = await consolidateNextInterpretation();
    console.log(`[${i}] consolidated:`, ok);
  }
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
