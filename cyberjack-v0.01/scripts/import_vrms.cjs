const fs = require('fs');
const path = require('path');

// Adjust these source paths if your files are located elsewhere
const sources = [
  {
    src: '/home/cyberkitty/Документы/vrm/new/model/anna_nude.vrm',
    dest: 'anna_nude.vrm'
  },
  {
    src: '/home/cyberkitty/Документы/vrm/new/model/anna_vaiolet.vrm',
    dest: 'anna_vaiolet.vrm'
  }
];

const outDir = path.resolve(__dirname, '..', 'public', 'models');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

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
  console.error('One or more files were not copied. Please check the paths above.');
  process.exit(2);
} else {
  console.log('All VRM files were copied successfully to public/models/. You can now start the dev server and the models will be available at /models/<filename>.');
}
