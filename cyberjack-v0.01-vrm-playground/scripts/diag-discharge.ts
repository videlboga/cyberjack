import 'dotenv/config';

// Диагностика: почему discharge не наступает на высоком tension.
// Выводит pleasure, experiencedIntensity, capacity, outcome, peakReady на каждом тике.
const BASE = 'http://localhost:3001/api/tick';
const subjectId = process.argv[2] || 'S-AV-01';
const pointId = process.argv[3] || 'clitoris';
const presetId = process.argv[4] || 'vibrator_pulse';

async function tick(body: Record<string, unknown>) {
    const r = await fetch(BASE, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subjectId, playerId: 'PL-1', sceneId: 'scene_lab_calibrator', skipImageGen: true, deferLLM: false, llmMode: 'scene_chance', ...body }),
    });
    return await r.json() as any;
}

async function main() {
    await tick({ presetId: 'eq_clothe_underwear_remove', pointId: 'systemic' });
    let orgasms = 0;
    for (let i = 0; i < 40; i++) {
        const d = await tick({ presetId, pointId });
        if (!d.success) { console.log(`[${i + 1}] ❌ ${d.error}`); break; }
        const b = d.bundle || {};
        const out = b.output || {};
        const res = out.result || {};
        const core = b.stateAfter?.core || {};
        const transitions = (b.diagnostics?.observation?.transitions || []).map((t: any) => t.kind);
        const discharge = transitions.includes('discharge');
        if (discharge) orgasms++;
        console.log(
            `[${i + 1}] tension=${Math.round(core.tension)} pleasure=${res.pleasure} expInt=${res.experiencedIntensity} capacity=${Math.round(core.capacity)} overload=${res.overload} valence=${res.finalValence}${discharge ? ' 💥' : ''}`
        );
        if (orgasms >= 2) break;
    }
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
