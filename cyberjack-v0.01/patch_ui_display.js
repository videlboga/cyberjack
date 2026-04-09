const fs = require('fs');
let code = fs.readFileSync('src/ui/App.tsx', 'utf8');

const target = `{entry.presenceState}
          </span>
        </div>`;

const repl = `{entry.presenceState}
          </span>
          {entry.slotId && (
            <span className="scene-character-role">
              [Зона: {entry.slotId}]
            </span>
          )}
        </div>`;

code = code.replace(target, repl);
fs.writeFileSync('src/ui/App.tsx', code);
