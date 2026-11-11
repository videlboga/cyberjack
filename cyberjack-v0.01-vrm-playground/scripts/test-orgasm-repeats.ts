import 'dotenv/config';

// Тест: довести персонажа до оргазма повторяющейся стимуляцией, собрать реплики,
// выявить повторы. Изолированно (skipImageGen, deferLLM=false).
// Использование: npx tsx scripts/test-orgasm-repeats.ts <subjectId> [<pointId>] [<presetId>]

const BASE = 'http://localhost:3001/api/tick';
const subjectId = process.argv[2] || 'S-AV-01';
const pointId = process.argv[3] || 'clitoris';
const presetId = process.argv[4] || 'vibrator_pulse';

async function tick(body: Record<string, unknown>) {
    const r = await fetch(BASE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            subjectId, playerId: 'PL-1', sceneId: 'scene_lab_calibrator',
            skipImageGen: true, deferLLM: false, llmMode: 'scene_chance',
            ...body,
        }),
    });
    return await r.json() as any;
}

function replyOf(d: any): string {
    return d?.reply?.speech || d?.actorReplies?.find((a: any) => a.actorId === subjectId)?.speech || '';
}

async function main() {
    // 1. Снять бельё, если надето
    const strip = await tick({ presetId: 'eq_clothe_underwear_remove', pointId: 'systemic' });
    if (!strip.success) {
        console.log('⚠️ не удалось снять бельё:', strip.error);
    } else {
        console.log('✅ бельё снято');
    }

    const replies: string[] = [];
    let orgasms = 0;
    let tension = 0;
    const MAX_TICKS = 60;

    for (let i = 0; i < MAX_TICKS; i++) {
        const d = await tick({ presetId, pointId });
        if (!d.success) {
            console.log(`[${i + 1}] ❌ ${d.error}`);
            break;
        }
        const reply = replyOf(d);
        const transitions = (d.bundle?.diagnostics?.observation?.transitions || []).map((t: any) => t.kind);
        tension = d.bundle?.stateAfter?.core?.tension ?? tension;
        const discharge = transitions.includes('discharge');
        if (discharge) orgasms++;

        const repeat = replies.includes(reply) && reply ? '  ⚠️ ПОВТОР' : '';
        replies.push(reply);
        console.log(`[${i + 1}] tension=${Math.round(tension)}${discharge ? ' 💥ОРГАЗМ' : ''}${repeat} | ${reply || '(молчание)'}`);

        if (orgasms >= 2) {
            console.log(`\n✅ достигнуто 2 оргазма за ${i + 1} тиков`);
            break;
        }
    }

    // Анализ повторов
    const nonEmpty = replies.filter(Boolean);
    const unique = new Set(nonEmpty);
    const dupes = nonEmpty.filter((r, idx) => nonEmpty.indexOf(r) !== idx);
    console.log(`\n=== ИТОГ ===`);
    console.log(`реплик всего: ${replies.length}, непустых: ${nonEmpty.length}, уникальных: ${unique.size}`);
    console.log(`повторов (дословных): ${dupes.length}`);
    if (dupes.length) {
        const counts: Record<string, number> = {};
        for (const r of dupes) counts[r] = (counts[r] || 0) + 1;
        console.log('повторяющиеся реплики:');
        for (const [r, c] of Object.entries(counts)) console.log(`  ×${c + 1}: «${r}»`);
    }
    console.log(`оргазмов: ${orgasms}`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
