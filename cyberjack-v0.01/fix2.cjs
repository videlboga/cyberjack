const fs = require('fs');
let code = fs.readFileSync('src/api/controllers/stateController.ts', 'utf8');

const targetStr = "res.json({ \n            success: true, \n            subject: uiState.subject,\n            availablePoints: uiState.availablePoints,";
const targetStr2 = "res.json({ \n            success: true, \n            subject: uiState.subject,\n            availablePoints: uiState.availablePoints,";

let regex = /res\.json\(\{\s*success: true,\s*subject: uiState\.subject,\s*availablePoints: uiState\.availablePoints,/;
let splitCode = code.split(regex);

if (splitCode.length > 1) {
    const newCode = splitCode.join(`res.json({ 
            success: true, 
            subject: (() => {
                const anatomyDict: any = {};
                const subjectPoints = pointStateRepo.getAllForSubject(subjectId) || [];
                for (const pt of subjectPoints) {
                    anatomyDict[pt.pointId] = pt; // get mapped pointId
                }
                const s = uiState.subject;
                if (s) { s.anatomy = anatomyDict; s.contexts = activeContextsRepo.getAllForSubject(subjectId) || []; }
                return s;
            })(),
            availablePoints: uiState.availablePoints,`);
            
    const finalCode = newCode.replace("characterRelationRepo, sceneCharacterRepo }", "characterRelationRepo, sceneCharacterRepo, activeContextsRepo, pointStateRepo }");
    fs.writeFileSync('src/api/controllers/stateController.ts', finalCode);
    console.log("Success");
} else {
    console.log("Failed to split regex: ", splitCode.length);
}
