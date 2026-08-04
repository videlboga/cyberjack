import { db } from '../infrastructure/db';
import { getWorldClock } from './worldService';
import { advanceSimulationTime } from './simulationTime';

const REAL_INTERVAL_MS = 5_000;
const GAME_MINUTES_PER_INTERVAL = 1;
let timer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;
let nextTickAt = Date.now() + REAL_INTERVAL_MS;

db.exec(`
  CREATE TABLE IF NOT EXISTS world_runtime_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);
db.prepare(`
  INSERT OR IGNORE INTO world_runtime_settings (key, value)
  VALUES ('time_paused', '0')
`).run();

const readPaused = () => {
  const row = db.prepare(`SELECT value FROM world_runtime_settings WHERE key = 'time_paused'`).get() as { value?: string } | undefined;
  return row?.value === '1';
};

export function getTimeFlowState() {
  return {
    paused: readPaused(),
    running: !readPaused(),
    realIntervalMs: REAL_INTERVAL_MS,
    gameMinutesPerInterval: GAME_MINUTES_PER_INTERVAL,
    serverNow:Date.now(),
    nextTickAt,
    clock: getWorldClock(),
  };
}

export function setTimeFlowPaused(paused: boolean) {
  db.prepare(`
    INSERT INTO world_runtime_settings (key, value) VALUES ('time_paused', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(paused ? '1' : '0');
  return getTimeFlowState();
}

export function startTimeFlow() {
  if (timer) return;
  nextTickAt = Date.now() + REAL_INTERVAL_MS;
  timer = setInterval(async () => {
    nextTickAt = Date.now() + REAL_INTERVAL_MS;
    // Never stack full simulation passes when one tick exceeds the interval.
    if (readPaused() || tickInFlight) return;
    tickInFlight = true;
    try {
      await advanceSimulationTime(GAME_MINUTES_PER_INTERVAL);
    } catch (error) {
      console.error('[TimeFlow] background tick failed:', error);
    } finally {
      tickInFlight = false;
    }
  }, REAL_INTERVAL_MS);
  (timer as any).unref?.();
}

export function stopTimeFlow() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  tickInFlight = false;
}
