const fs = require('fs');
let css = fs.readFileSync('src/ui/AnatomyView.css', 'utf8');

const regex = /\.point-contexts \{\s*display: flex;\s*flex-wrap: wrap;\s*gap: 8px;\s*max-height: 200px;\s*overflow-y: auto;\s*align-items: flex-start;\s*\}\s*/g;
css = css.replace(regex, '');

css += `\n.point-contexts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 120px;
  overflow-y: auto;
  align-items: flex-start;
}\n`;

fs.writeFileSync('src/ui/AnatomyView.css', css);
