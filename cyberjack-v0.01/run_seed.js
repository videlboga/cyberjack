import { spawn } from 'child_process';
import path from 'path';

const seedPath = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/src/infrastructure/seed.ts';

// We use tsx because it's a zero-config way to run TS in ESM projects
const child = spawn('npx', ['tsx', seedPath], {
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code);
});
