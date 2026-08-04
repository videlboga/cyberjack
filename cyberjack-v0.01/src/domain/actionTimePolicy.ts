const PROCESS_STARTS = new Set([
  'act_start_vibrator',
  'act_start_electrostimulation',
  'act_start_penetration',
  'finger_insertion',
  'act_activate_plug',
]);

const PROCESS_CONTROLS = new Set([
  'act_adjust_vibration',
  'act_stop_vibrator',
  'act_adjust_electrostimulation',
  'act_stop_electrostimulation',
  'act_increase_friction',
  'act_decrease_friction',
  'act_end_sexual_contact',
  'act_deactivate_plug',
]);

export function actionTimePolicy(actionId: string) {
  if (PROCESS_STARTS.has(actionId)) {
    return { worldMinutes:0, stateDeltaScale:.35, kind:'process_start' as const };
  }
  if (PROCESS_CONTROLS.has(actionId)) {
    return { worldMinutes:0, stateDeltaScale:0, kind:'process_control' as const };
  }
  return { worldMinutes:1, stateDeltaScale:1, kind:'discrete' as const };
}
