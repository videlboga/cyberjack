import 'dotenv/config';

// Проверка: буст принятия + контекст situational_acceptance + пол sensitivity.
const BASE = 'http://localhost:3001/api/tick';
const subjectId = process.argv[2] || 'S-AV-01';
const pointId = process.argv[3] || 'clitoris';
const presetId = process.argv[4] || 'vibrator_pulse';

async function tick(body: Record<string, unknown>) {
    const r = await fetch(BASE, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subjectId, playerId: 'PL-1', sceneId: 'scene_lab_calibrator', skipImageGen: true, deferLLM: false, llmMode: 'scene_chance', skipLLM: true, ...body }),
    });
    return await r.json() as any;
}

async function main() {
    await tick({ presetId: 'eq_clothe_underwear_remove', pointId: 'systemic' });
    for (let i = 0; i < 30; i++) {
        const d = await tick({ presetId, pointId });
        if (!d.success) { console.log(`[${i + 1}] ❌ ${d.error}`); break; }
        const b = d.bundle || {};
        const out = b.output || {};
        const res = out.result || {};
        const core = b.stateAfter?.core || {};
        const contexts = (d.state?.contexts || []).map((c: any) => c.actionId);
        const hasSA = contexts.includes('effect_situational_acceptance');
        const transitions = (b.diagnostics?.observation?.transitions || []).map((t: any) => t.kind);
        const discharge = transitions.includes('discharge');
        console.log(
            `[${i + 1}] tension=${Math.round(core.tension)} sens=${core.sensitivity?.toFixed?.(1) ?? core.sensitivity} pleasure=${res.pleasure} valence=${res.finalValence} baseVal=${res.baseFinalValence} effAtt=${res.effectiveAttitude?.toFixed?.(1)}${hasSA ? ' 🟢SA' : ''}${discharge ? ' 💥' : ''}`
        );
        if (discharge) break;
    }
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
