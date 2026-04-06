import fs from 'fs';

let code = fs.readFileSync('seed_expanded.ts', 'utf-8');

const pointsMatch = code.match(/const points: any\[\] = \[[\s\S]*?\];/);
if (pointsMatch) {
    code = code.replace(pointsMatch[0], '');
    code = code.replace(/const insertPointStmt = /, pointsMatch[0] + '\n\nconst insertPointStmt = ');
    fs.writeFileSync('seed_expanded.ts', code, 'utf-8');
}
