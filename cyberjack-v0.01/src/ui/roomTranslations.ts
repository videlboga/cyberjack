// Утилиты для локализации названий комнат и устройств по ID

export const roomNameMap: Record<string, string> = {
  'room_calibration': 'calibrationRoom',
  'room_cell_a': 'livingCellA',
  'room_cell_b': 'livingCellB',
  'room_cell_c': 'livingCellC',
  'room_cell_special': 'specialCell',
  'room_control': 'observationPost',
  'room_staff_living': 'staffLivingRoom'
};

export const deviceNameMap: Record<string, string> = {
  'lab_diagnostic_table': 'diagnosticTable',
  'lab_recovery_capsule': 'recoveryCapsule',
  'lab_sex_machine': 'sexMachine',
  'lab_mental_correction_chair': 'mentalCorrectionChair'
};

export function getRoomName(roomId: string, t: (key: string) => string): string {
  const key = roomNameMap[roomId];
  return key ? t(`game.ui.${key}`) : roomId;
}

export function getDeviceName(deviceId: string, t: (key: string) => string): string {
  const key = deviceNameMap[deviceId];
  return key ? t(`game.ui.${key}`) : deviceId;
}

export function getRoomDescription(roomId: string, t: (key: string) => string): string {
  return t(`game.ui.roomDescriptions.${roomId}`);
}
