import { db } from '../src/infrastructure/db';
import { generateCharacterContext } from '../src/orchestration/characterGenerator/generator';
import { getBaseHumanAnatomy } from '../src/domain/anatomy';
import {
  subjectRepo,
  pointStateRepo,
  sceneRepo,
  sceneLayoutsRepo,
  sceneCharacterRepo,
  resourceRepo,
  characterRepo,
  characterItemsRepo,
  activeContextsRepo,
  presetRepo,
  sceneObjectsRepo
} from '../src/infrastructure/repositories';

const LAB_SCENE_ID = 'lab';
const PLAYER_RESOURCE_ID = 'PL-1';
const CALIBRATOR_ID = 'C-Gamma';
const ASSET_IDS = ['S-A1', 'S-A2'];

const labActions = [
  'gentle_stroke','tickle','light_kiss','deep_kiss','feather_stroke','deep_massage','licking','firm_grip','light_bite','hard_bite',
  'pinch','scratching','slap','hard_slap','needle_prick','belt_strike','whip_strike','taser_shock','ice_cube','hot_wax',
  'vibrator_pulse','hair_pull','spit','breath_blow','verbal_pressure','stare','close_inspection','feint_strike','pose_kneeling','restraint_cuffs'
];

const labLayout = {
  bounds: { width: 1000, height: 650 },
  nodes: [
    { id: 'slot_table', label: 'Операционный стол', x: 500, y: 340 },
    { id: 'slot_side', label: 'Секция фиксации', x: 320, y: 200 },
    { id: 'slot_console', label: 'Пульт калибратора', x: 760, y: 360 }
  ],
  edges: [
    { from: 'slot_console', to: 'slot_table' },
    { from: 'slot_side', to: 'slot_table' }
  ]
};

const baseCardState = (mods: Record<string, number> | undefined) => {
  const base = { sensitivity: 50, capacity: 55, openness: 30, plasticity: 40, attitude: 35 };
  const out: any = { ...base };
  if (mods) {
    for (const [key, value] of Object.entries(mods)) {
      if (key in out) {
        out[key] = Math.max(0, Math.min(100, out[key] + value));
      }
    }
  }
  return out;
};

function applyAnatomy(subjectId: string, gender: 'male' | 'female' | 'androgynous' = 'female') {
  const anatomy = getBaseHumanAnatomy(gender);
  anatomy.forEach(point => {
    pointStateRepo.save(subjectId, point.id, {
      localSensitivity: point.sens,
      localAttitude: point.att,
      localOpenness: 50
    });
  });
}

function applyContexts(subjectId: string, contextIds?: string[]) {
  if (!contextIds || !contextIds.length) return;
  contextIds.forEach(ctxId => {
    const preset = presetRepo.getActionPreset(ctxId);
    if (!preset) return;
    const uid = `ctx-${subjectId}-${ctxId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    activeContextsRepo.add(uid, subjectId, ctxId, -1, null, null);
  });
}

function seedAsset(assetId: string, slotId: string, seed: string) {
  const ctx = generateCharacterContext({ seed, archetype: 'asset' });
  const name = ctx.baseProfile?.name || `Актив ${assetId}`;
  const state = baseCardState(ctx.baseModifiers);
  subjectRepo.save(assetId, name, state);
  applyAnatomy(assetId, 'female');
  applyContexts(assetId, ctx.initialContexts);
  sceneCharacterRepo.set(LAB_SCENE_ID, assetId, {
    role: 'asset',
    canAct: true,
    presenceState: 'present',
    slotId
  });
}

function seedCalibrator() {
  const state = {
    sensitivity: 20,
    capacity: 80,
    openness: 15,
    plasticity: 25,
    attitude: 70
  };
  subjectRepo.save(CALIBRATOR_ID, 'Калибратор Гамма', state as any);
  applyAnatomy(CALIBRATOR_ID, 'male');
  characterRepo.ensureSubject(CALIBRATOR_ID, 'Калибратор Гамма');
  db.prepare('UPDATE characters SET kind = ?, player_id = ? WHERE id = ?').run('calibrator', PLAYER_RESOURCE_ID, CALIBRATOR_ID);
  sceneCharacterRepo.set(LAB_SCENE_ID, CALIBRATOR_ID, {
    role: 'calibrator',
    canAct: true,
    presenceState: 'present',
    slotId: 'slot_console'
  });
}

function seedPlayerResources() {
  characterRepo.ensureCharacter(PLAYER_RESOURCE_ID, 'Оператор PL-1');
  resourceRepo.save({
    id: PLAYER_RESOURCE_ID,
    resources: {
      actionPoints: { amount: 100, maxAmount: 100 },
      credits: { amount: 500 },
      timeBudget: { amount: 12 }
    }
  });

  const items = db.prepare('SELECT id FROM items').all() as { id: string }[];
  items.forEach(item => {
    characterItemsRepo.save({
      characterId: PLAYER_RESOURCE_ID,
      itemId: item.id,
      state: 'active'
    });
  });
}

function seedScene() {
  db.exec(`DELETE FROM scene_characters;
    DELETE FROM scenes;
    DELETE FROM scene_layouts;
    DELETE FROM scene_objects;`);

  sceneRepo.save({
    id: LAB_SCENE_ID,
    description: 'Операторская лаборатория корпорации',
    availableActions: labActions,
    slots: [
      { id: 'slot_table', name: 'Операционный стол', capacity: 2 },
      { id: 'slot_side', name: 'Секция фиксации', capacity: 1 },
      { id: 'slot_console', name: 'Пост калибратора', capacity: 1 }
    ]
  } as any);

  sceneLayoutsRepo.save(LAB_SCENE_ID, labLayout);

  sceneObjectsRepo.save({
    id: 'lab-eq-tens-unit',
    sceneId: LAB_SCENE_ID,
    nodeId: 'slot_table',
    itemId: 'eq_tens_unit',
    state: 'active',
    metadata: { label: 'Нейро-стимулятор ТЕНС', attachedSlot: 'slot_table' }
  });
}

function clearCharacters() {
  db.exec(`DELETE FROM active_contexts;
    DELETE FROM scene_characters;
    DELETE FROM character_items;
    DELETE FROM character_resources;
    DELETE FROM character_relations;
    DELETE FROM subjects;
    DELETE FROM subject_point_states;
    DELETE FROM characters;`);
}

function main() {
  console.log('Resetting lab scene with fresh characters...');
  clearCharacters();
  seedScene();

  ASSET_IDS.forEach((id, idx) => {
    const slotId = idx === 0 ? 'slot_table' : 'slot_side';
    seedAsset(id, slotId, `asset-${idx + 1}`);
  });

  seedCalibrator();
  seedPlayerResources();

  console.log('Lab reset complete. Two assets and one calibrator seeded.');
}

main();
