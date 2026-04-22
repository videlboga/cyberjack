const fs = require('fs');
const path = require('path');

const sources = [
  {
    src: '/home/cyberkitty/Документы/vrm/new/pose/handup.vpd',
    dest: 'handup.vpd'
  }
];

const outDir = path.resolve(__dirname, '..', 'public', 'poses');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let anyFailed = false;
for (const item of sources) {
  const srcPath = item.src;
  const destPath = path.join(outDir, item.dest);
  try {
    if (!fs.existsSync(srcPath)) {
      console.error(`Source file not found: ${srcPath}`);
      anyFailed = true;
      continue;
    }
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${srcPath} -> ${destPath}`);
  } catch (err) {
    console.error(`Failed to copy ${srcPath} -> ${destPath}:`, err);
    anyFailed = true;
  }
}

if (anyFailed) {
  console.error('One or more pose files failed to copy.');
  process.exit(2);
} else {
  console.log('All poses copied to public/poses.');
}
