import * as fs from 'fs';

const p = './src/ui/GameApp.tsx';
let txt = fs.readFileSync(p, 'utf-8');

txt = txt.replace(
  '<DiegeticUI',
  '<DiegeticUI\n        subjectState={subjectState}\n        setSelectedPoint={setSelectedPoint}'
);

fs.writeFileSync(p, txt);
