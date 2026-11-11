// Extract a controller layer's blend-tree poses (the 9 static directions of Denma-style layers).
// Reads the controller from the viewer bundle, plays each child clip in the studio, dumps the raw
// bone locals + the tree positions. Then the viewer can blend them live by two parameters.
// Usage: node extract_layer_poses.cjs <studioUrl> <controllerId> <layerIndex> <outJson>
const fs = require('fs');
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const BONES = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot'];

(async () => {
  const [studioUrl, ctlId, layerIdx, outPath] = process.argv.slice(2);
  const browser = await puppeteer.launch({
    executablePath: process.env.BROWSER_BIN || '/usr/bin/chromium', headless: true, pipe: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
    defaultViewport: { width: 900, height: 700 }
  });
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto(`${studioUrl}?vrm=${encodeURIComponent('models/x20/outfits/Rin_outfit_03.vrm')}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__studio && window.__studio.ready === true, { timeout: 240000 });
    await page.waitForFunction(() => window.__studio.library && window.__studio.library.selectClip, { timeout: 120000 });
    const res = await page.evaluate(async (ctlId, layerIdx, BONES) => {
      const raw = await fetch(`./koikatsu-links/controllers/${ctlId}.json.gz`);
      const data = await new Response(raw.body.pipeThrough(new DecompressionStream('gzip'))).json();
      const layer = data.layers[parseInt(layerIdx, 10)];
      const state = layer.states[layer.defaultState || 0];
      const tree = (state.trees && state.trees[0]) || [];
      const root2d = tree[0];
      const children = tree.slice(1).map((t, i) => ({
        clip: t.clip, position: root2d.positions[i] || { x: 0.5, y: 0.5 }, mirror: !!t.mirror
      }));
      window.__forceLayerClip = true;
      const vrm = window.__studio.vrm;
      const out = [];
      for (const c of children) {
        if (!c.clip) continue;
        const rec = (window.__studio.library.clips || []).find(x => x.id === c.clip);
        if (rec) rec.runtimePlayable = true;
        try { await window.__studio.library.selectClip(c.clip); } catch (e) { out.push({ ...c, error: e.message }); continue; }
        window.__studio.sampleBody(0);
        vrm.scene.updateMatrixWorld(true);
        const q = {}, extra = {};
        for (const b of BONES) {
          const n = vrm.humanoid.getRawBoneNode(b) || vrm.humanoid.getNormalizedBoneNode(b);
          if (n) q[b] = [n.quaternion.x, n.quaternion.y, n.quaternion.z, n.quaternion.w].map(v => +v.toFixed(6));
        }
        // extra (non-humanoid) Koikatsu bones the layer actually drives: butt/waist chains
        vrm.scene.traverse(n => {
          if (!n.isBone && !n.isObject3D) return;
          const nm = n.name || '';
          if (/^(cf_j_siri|cf_d_siri|k_f_siriL|k_f_siriR|cf_s_siri|cf_kk_waist|cf_j_waist)/.test(nm)) {
            extra[nm] = [n.quaternion.x, n.quaternion.y, n.quaternion.z, n.quaternion.w].map(v => +v.toFixed(6));
          }
        });
        out.push({ ...c, quats: q, extra });
      }
      return { layer: layer.name, index: layer.index, blendMode: layer.blendMode, maskEntries: (layer.mask || []).length, maskActive: (layer.mask || []).filter(m => (m.m_Weight || 0) > 0).length, params: [root2d.parameter, root2d.parameterY], children: out };
    }, ctlId, layerIdx, BONES);
    fs.writeFileSync(outPath, JSON.stringify(res, null, 1));
    console.log('layer', res.layer, '| children', res.children.filter(c => c.quats).length, '| mask active', res.maskActive, '->', outPath);
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) });
