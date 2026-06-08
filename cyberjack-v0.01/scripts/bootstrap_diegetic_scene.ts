import { db } from '../src/infrastructure/db';
import {
  characterRelationRepo,
  characterRepo,
  pointStateRepo,
  resourceRepo,
  sceneCharacterRepo,
  sceneRepo,
  sceneLayoutsRepo,
  subjectRepo
} from '../src/infrastructure/repositories';
import { getBaseHumanAnatomy } from '../src/domain/anatomy';

const SCENE_ID = 'scene_lab_calibrator';
const PLAYER_ID = 'PL-1';
const METAHUMAN_ID = 'S-AV-01';

const sceneActions = [
  'gentle_stroke',
  'tickle',
  'light_kiss',
  'deep_kiss',
  'feather_stroke',
  'deep_massage',
  'licking',
  'firm_grip',
  'light_bite',
  'hard_bite',
  'pinch',
  'scratching',
  'slap',
  'hard_slap',
  'needle_prick',
  'belt_strike',
  'whip_strike',
  'taser_shock',
  'ice_cube',
  'hot_wax',
  'vibrator_pulse',
  'hair_pull',
  'spit',
  'breath_blow',
  'verbal_pressure',
  'stare',
  'close_inspection',
  'feint_strike',
  'pose_kneeling',
  'restraint_cuffs'
];

const sceneLayout = {
  bounds: { width: 1000, height: 650 },
  nodes: [{ id: 'slot_table', label: 'Operating table', x: 500, y: 340 }],
  edges: []
};

function ensureAnatomy(subjectId: string, gender: 'male' | 'female' | 'androgynous') {
  const anatomy = getBaseHumanAnatomy(gender);
  for (const point of anatomy) {
    pointStateRepo.save(subjectId, point.id, {
      localSensitivity: point.sens,
      localAttitude: point.att,
      localOpenness: 50
    });
  }
}

function ensurePlayer() {
  subjectRepo.save(PLAYER_ID, 'Player', {
    sensitivity: 50,
    capacity: 50,
    openness: 50,
    plasticity: 50,
    attitude: 50
  });
  characterRepo.ensureCharacter(PLAYER_ID, 'Player');
  resourceRepo.save({
    id: PLAYER_ID,
    resources: {
      actionPoints: { amount: 100, maxAmount: 100 },
      credits: { amount: 500, maxAmount: 500 },
      timeBudget: { amount: 12, maxAmount: 12 }
    }
  });
}

function ensureMetahuman() {
  subjectRepo.save(METAHUMAN_ID, 'Serah', {
    sensitivity: 60,
    capacity: 50,
    openness: 100,
    plasticity: 100,
    attitude: 100
  });
  ensureAnatomy(METAHUMAN_ID, 'female');
  characterRepo.ensureSubject(METAHUMAN_ID, 'Serah');
  db.prepare('UPDATE characters SET profile_json = ? WHERE id = ?').run(
    JSON.stringify({
      avatar: '/avatars/Eli.png',
      role: 'metahuman'
    }),
    METAHUMAN_ID
  );
}

function ensureScene() {
  sceneRepo.save({
    id: SCENE_ID,
    description: 'Calibrator lab: player and one metahuman in a single slot for diegetic UI.',
    availableActions: sceneActions,
    slots: [{ id: 'slot_table', name: 'Operating table', capacity: 2 }]
  });

  sceneLayoutsRepo.save(SCENE_ID, sceneLayout as any);
}

function ensurePlacement() {
  db.prepare('DELETE FROM scene_characters WHERE scene_id = ?').run(SCENE_ID);

  sceneCharacterRepo.set(SCENE_ID, PLAYER_ID, {
    role: 'operator',
    canAct: true,
    presenceState: 'present',
    slotId: 'slot_table'
  });

  sceneCharacterRepo.set(SCENE_ID, METAHUMAN_ID, {
    role: 'asset',
    canAct: true,
    presenceState: 'present',
    slotId: 'slot_table'
  });

  characterRelationRepo.ensure(PLAYER_ID, METAHUMAN_ID, {
    knows: true,
    present: true,
    canInteract: true,
    attitude: 50,
    openness: 50,
    plasticity: 50
  });

  characterRelationRepo.ensure(METAHUMAN_ID, PLAYER_ID, {
    knows: true,
    present: true,
    canInteract: true,
    attitude: 50,
    openness: 50,
    plasticity: 50
  });
}

function main() {
  console.log('Bootstrapping diegetic scene...');
  ensureScene();
  ensurePlayer();
  ensureMetahuman();
  ensurePlacement();
  console.log(`Diegetic scene ready: ${SCENE_ID} with ${PLAYER_ID} + ${METAHUMAN_ID}`);
}

main();
