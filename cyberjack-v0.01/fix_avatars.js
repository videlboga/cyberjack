const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/ui/GameApp.css');

let css = fs.readFileSync(file, 'utf8');

// Update .node-avatars
css = css.replace(/\.node-avatars \{([\s\S]*?)\}/, `.node-avatars {\n  position: absolute;\n  left: calc(50% + 75px);\n  top: 50%;\n  transform: translateY(-50%);\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  z-index: 10;\n}`);

// Update .avatar-bubble
css = css.replace(/\.avatar-bubble \{([\s\S]*?)\}/, `.avatar-bubble {\n  position: absolute;\n  left: calc(100% + 12px);\n  top: 50%;\n  transform: translateY(-50%);\n  width: max-content;\n  max-width: 240px;\n  background: rgba(248, 250, 252, 0.95);\n  color: #0f172a;\n  font-size: 11px;\n  line-height: 1.4;\n  padding: 6px 10px;\n  border-radius: 12px;\n  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);\n  z-index: 20;\n  text-align: left;\n}`);

fs.writeFileSync(file, css);
console.log("CSS fixed");
