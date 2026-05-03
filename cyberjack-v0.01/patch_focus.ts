import * as fs from 'fs';
const p = './src/ui/GameApp.tsx';
let txt = fs.readFileSync(p, 'utf-8');

const autoFocusCode = `
  useEffect(() => {
    if (!focusedCharId && sceneCharacters.length > 0) {
      const npc = sceneCharacters.find(c => c.character.id !== PLAYER_CHARACTER_ID);
      if (npc) {
         console.log('AUTO-FOCUSING ON NPC', npc.character.id);
         setFocusedCharId(npc.character.id);
      }
    }
  }, [sceneCharacters, focusedCharId]);
`;

txt = txt.replace('const [relationsList, setRelationsList] = useState<any[]>([]);', 'const [relationsList, setRelationsList] = useState<any[]>([]);\n' + autoFocusCode);

fs.writeFileSync(p, txt);
