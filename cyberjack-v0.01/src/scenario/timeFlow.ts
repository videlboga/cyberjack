import { db } from '../infrastructure/db';
import { getWorldClock } from './worldService';
import { advanceSimulationTime } from './simulationTime';

const REAL_INTERVAL_MS = 5_000;
const GAME_MINUTES_PER_INTERVAL = 1;
let timer: ReturnType<typeof setInterval> | null = null;
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
  // This is the single wall-clock driver of game time. It advances the world
  // clock by a fixed number of game minutes per real interval; every game
  // process (memory, autonomous scenes, sustained effects) is driven by
  // worldMinute, not by wall-clock. advanceSimulationTime is non-blocking for
  // LLM-backed jobs, so a slow model never stalls the clock.
  timer = setInterval(async () => {
    nextTickAt = Date.now() + REAL_INTERVAL_MS;
    if (readPaused()) return;
    try {
      await advanceSimulationTime(GAME_MINUTES_PER_INTERVAL);
    } catch (error) {
      console.error('[TimeFlow] background tick failed:', error);
    }
  }, REAL_INTERVAL_MS);
  (timer as any).unref?.();
}

export function stopTimeFlow() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
