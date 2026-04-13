import fs from 'fs';
let code = fs.readFileSync('src/api/routes/metaRoutes.ts', 'utf8');

code = code.replace(
  "import { getConfig, postConfig, getCharacterProfile, getCharacterPrompt } from '../controllers/metaController';",
  "import { getConfig, postConfig, getCharacterProfile, getCharacterPrompt, getAllCharacters, deleteCharacter, generateCharacterEndpoint } from '../controllers/metaController';"
);

code = code.replace(
  "export default router;",
  `
router.get('/characters', getAllCharacters as any);
router.delete('/characters/:id', deleteCharacter as any);
router.post('/characters/generate', generateCharacterEndpoint as any);

export default router;
`
);

fs.writeFileSync('src/api/routes/metaRoutes.ts', code);
