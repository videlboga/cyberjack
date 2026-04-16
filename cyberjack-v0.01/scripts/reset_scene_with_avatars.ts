import { db } from '../src/infrastructure/db';
import { generateCharacterContext } from '../src/orchestration/characterGenerator/generator';
import { getBaseHumanAnatomy } from '../src/domain/anatomy';
import {
  subjectRepo,
  pointStateRepo,
  sceneRepo,
  sceneLayoutsRepo,
  sceneCharacterRepo,
  characterRepo,
  activeContextsRepo,
  presetRepo,
  resourceRepo
} from '../src/infrastructure/repositories';

const SCENE_ID = process.argv[2] || 'lab-avatars';

const avatarNames = [
  'Векс',
  'Сайлас',
  'Эли',
  'Никс',
  'Мара',
  'Кай',
  'Иден',
  'Рунис',
  'Рен'
];

// mapping from displayed name -> avatar file used by UI (kept in sync with GameApp.tsx)
const AVATAR_MAP: Record<string, string> = {
  'Векс': '/avatars/Vex.png',
  'Сайлас': '/avatars/Silas.png',
  'Эли': '/avatars/Eli.png',
  'Никс': '/avatars/Nyx.png',
  'Мара': '/avatars/Mara.png',
  'Кай': '/avatars/Kai.png',
  'Иден': '/avatars/Eden.png',
  'Рунис': '/avatars/Runis.png',
  'Рен': '/avatars/Ren.png'
};

const defaultLayout = {
  bounds: { width: 1000, height: 650 },
  nodes: [
    { id: 'slot_table', label: 'Операционный стол', x: 500, y: 340 },
    { id: 'slot_side', label: 'Секция фиксации', x: 320, y: 200 },
    { id: 'slot_console', label: 'Пульт', x: 760, y: 360 }
  ],
  edges: [
    { from: 'slot_console', to: 'slot_table' },
    { from: 'slot_side', to: 'slot_table' }
  ]
};

function applyAnatomy(subjectId: string, gender: 'male' | 'female' | 'androgynous' = 'female') {
  const anatomy = getBaseHumanAnatomy(gender);
  anatomy.forEach(point => {
    pointStateRepo.save(subjectId, point.id, {
      pointId: point.id,
      localSensitivity: point.sens,
      localAttitude: point.att,
      localOpenness: 50
    } as any);
  });
}

function applyContexts(subjectId: string, contextIds?: string[]) {
  if (!contextIds || !contextIds.length) return;
  contextIds.forEach(ctxId => {
    // Only add contexts that exist as action_presets to avoid FK failures
    const preset = presetRepo.getActionPreset(ctxId);
    if (!preset) {
      console.log(`  - Skipping missing context preset: ${ctxId}`);
      return;
    }
    const uid = `ctx-${subjectId}-${ctxId}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    activeContextsRepo.add(uid, subjectId, ctxId, -1, null, null);
  });
}

function clearScene() {
  // Remove only scene-specific tables to avoid destroying global metadata
  db.prepare('DELETE FROM scene_characters WHERE scene_id = ?').run(SCENE_ID);
}

const labActions = [
  'gentle_stroke','tickle','light_kiss','deep_kiss','feather_stroke','deep_massage','licking','firm_grip','light_bite','hard_bite',
  'pinch','scratching','slap','hard_slap','needle_prick','belt_strike','whip_strike','taser_shock','ice_cube','hot_wax',
  'vibrator_pulse','hair_pull','spit','breath_blow','verbal_pressure','stare','close_inspection','feint_strike','pose_kneeling','restraint_cuffs'
];

function seedScene() {
  sceneRepo.save({
    id: SCENE_ID,
    description: 'Лаборатория (аватары)',
    availableActions: labActions,
    slots: [
      { id: 'slot_table', name: 'Операционный стол', capacity: 2 },
      { id: 'slot_side', name: 'Секция фиксации', capacity: 1 },
      { id: 'slot_console', name: 'Пульт', capacity: 1 }
    ]
  } as any);

  sceneLayoutsRepo.save(SCENE_ID, defaultLayout as any);
}

async function main() {
  console.log(`Recreating scene '${SCENE_ID}' with ${avatarNames.length} characters`);
  seedScene();
  clearScene();

  // Create characters from avatar list
  avatarNames.forEach((name, idx) => {
    const subjectId = `S-AV-${String(idx + 1).padStart(2, '0')}`;
    const ctx = generateCharacterContext({ seed: `avatar-${name}-${Date.now()}` });
    const base = { sensitivity: 50, capacity: 55, openness: 35, plasticity: 40, attitude: 40 };
    const state: any = { ...base };
    if (ctx.baseModifiers) {
      for (const [k, v] of Object.entries(ctx.baseModifiers)) {
        if (k in state) state[k] = Math.max(0, Math.min(100, (state as any)[k] + (v as number)));
      }
    }
    if (ctx.preferences) state.preferences = JSON.stringify(ctx.preferences);

    subjectRepo.save(subjectId, name, state);
    applyAnatomy(subjectId, 'female');
    applyContexts(subjectId, ctx.initialContexts || []);

    // Ensure character row exists and set profile_json with avatar path to be explicit
    characterRepo.ensureSubject(subjectId, name);
    const avatarPath = AVATAR_MAP[name] || null;
    if (avatarPath) {
      db.prepare('UPDATE characters SET profile_json = ? WHERE id = ?').run(JSON.stringify({ avatar: avatarPath }), subjectId);
    }

    // Place into scene slots (round-robin)
    const slot = idx === 0 ? 'slot_table' : idx === 1 ? 'slot_side' : idx === 2 ? 'slot_console' : 'slot_table';
    sceneCharacterRepo.set(SCENE_ID, subjectId, { role: 'participant', canAct: true, presenceState: 'present', slotId: slot });
    console.log(`  - Seeded ${subjectId} / ${name} -> ${slot}`);
  });

  // Optionally ensure a player operator presence
  const PLAYER_ID = 'PL-1';
  characterRepo.ensureCharacter(PLAYER_ID, 'Оператор');
  sceneCharacterRepo.set(SCENE_ID, PLAYER_ID, { role: 'operator', canAct: true, presenceState: 'present', slotId: 'slot_console' });

  resourceRepo.save({
    id: PLAYER_ID,
    resources: {
      actionPoints: { characterId: PLAYER_ID, resourceKey: 'actionPoints', amount: 100, maxAmount: 100 },
      credits: { characterId: PLAYER_ID, resourceKey: 'credits', amount: 500 },
      timeBudget: { characterId: PLAYER_ID, resourceKey: 'timeBudget', amount: 12 }
    }
  });

  console.log('Scene recreation complete. Open the UI and select the scene to verify avatars.');
}

main().catch(err => {
  console.error('Failed to recreate scene:', err);
  process.exit(1);
});
