import fs from 'fs';
import path from 'path';

export type SensoryField = 'stimulus' | 'texture' | 'rhythm' | 'bodilyResponse' | 'aftereffect';
export type SensoryVariant = Record<SensoryField, string>;

interface MatrixCell {
    actionId: string;
    pointId: string;
    kind: 'point' | 'systemic';
    variants: SensoryVariant[];
}

interface DeviceMode {
    label: string;
    pointId: string;
    tags: string[];
    cells: SensoryVariant[];
}

interface SensoryMatrix {
    cells: MatrixCell[];
    devices: {
        lab_sex_machine: {
            modes: Record<string, DeviceMode>;
        };
    };
}

const matrixPath = path.resolve(process.cwd(), 'src/infrastructure/data/sensory/sensory-matrix.json');

let cached: SensoryMatrix | null = null;

export function loadSensoryMatrix(): SensoryMatrix {
    if (cached) return cached;
    cached = JSON.parse(fs.readFileSync(matrixPath, 'utf8')) as SensoryMatrix;
    return cached;
}

/** Выбор варианта по (action, point). Детерминированный по seed для воспроизводимости. */
export function resolveSensoryVariant(
    actionId: string,
    pointId: string,
    seed: number = 0,
): SensoryVariant | null {
    const matrix = loadSensoryMatrix();
    const cell = matrix.cells.find(c => c.actionId === actionId && c.pointId === pointId);
    if (!cell || !cell.variants.length) return null;
    const index = Math.abs(seed) % cell.variants.length;
    return cell.variants[index];
}

/** Выбор варианта для режима секс-машины. */
export function resolveDeviceVariant(
    deviceId: string,
    modeId: string,
    seed: number = 0,
): SensoryVariant | null {
    const matrix = loadSensoryMatrix();
    const device = (matrix.devices as any)[deviceId];
    const mode = device?.modes?.[modeId];
    if (!mode || !mode.cells.length) return null;
    const index = Math.abs(seed) % mode.cells.length;
    return mode.cells[index];
}
