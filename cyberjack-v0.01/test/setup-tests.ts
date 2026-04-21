import { vi } from 'vitest';

// Note: Global LLM adapter mocks removed — tests will call real `llmAdapter` now.
// Make sure environment API keys (OPENROUTER_API_KEY or LLM_API_KEY) are set if you
// want tests to reach a live LLM. Otherwise network calls may fail or be slow.

// Prevent tests from actually exiting the process when code calls process.exit
// Some tests may assert exit behavior; we noop it to keep the runner alive.
try {
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    // eslint-disable-next-line no-console
    console.log('[test setup] process.exit called', code);
    // no-op
  }) as any);
} catch (e) {
  // ignore if spy not available
}

// Optionally expose a helper on global for test seeds (tests can call global.testSeed(...))
// Minimal helper: insert a simple action preset if needed by tests that forget to seed.
import { presetRepo } from '../src/infrastructure/repositories';
import { db } from '../src/infrastructure/db';
import { resourceRepo } from '../src/infrastructure/repositories';

export function ensureMinimalPresets() {
  try {
    presetRepo.saveActionPreset('default_stub_action', 'Default Stub', { intensity: 0.1, valence: 0 });
  } catch (e) {
    // ignore DB errors during setup; tests will seed more specifically
  }
}

// Run minimal seeding once
ensureMinimalPresets();

// Disable foreign_keys globally during tests to avoid constraint errors when tests
// perform DELETEs in different orders. Individual tests can enable FK checks if needed.
try {
  db.prepare('PRAGMA foreign_keys = OFF').run();
} catch (e) {
  // ignore
}

// Ensure minimal character resources for scenario tests exist so loadTickState can find them
try {
  resourceRepo.save({ id: 'player1', resources: { energy: 100 } } as any);
  resourceRepo.save({ id: 'player_combo', resources: { energy: 100 } } as any);
} catch (e) {
  // ignore any DB/schema errors during setup; tests may re-seed more specifically
}
