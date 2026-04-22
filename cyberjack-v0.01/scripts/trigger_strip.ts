import { runGameTick } from '../src/orchestration/runGameTick';

(async () => {
  try {
    const res = await runGameTick({
      subjectId: 'S-ASSET-1',
      pointId: 'systemic',
      playerId: 'PL-1',
      sceneId: 'scene_lab_calibrator',
      presetId: 'verbal_pressure',
      dynamicModifiers: {
        commandIntent: {
          type: 'perform_action',
          actionId: 'eq_strip_jumpsuit',
          targetId: 'initiator',
          pointId: 'systemic'
        }
      }
    });
    console.log(JSON.stringify({ ok: true, tickId: res.tickId, diagnostics: res.diagnostics }, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: (err as any).message || err }, null, 2));
    process.exit(1);
  }
})();
