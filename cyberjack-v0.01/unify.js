import fs from 'fs';
import path from 'path';

const PRESETS_DIR = 'src/infrastructure/data/presets';
const OUTPUT_ACTIONS = 'src/infrastructure/data/presets/actions.json';
const OUTPUT_ITEMS = 'src/infrastructure/data/presets/items.json';

// Simple regex to strip JS comments from JSON before parsing
function stripComments(jsonc) {
    return jsonc
        .replace(/\/\*[\s\S]*?\*\//g, '') 
        .replace(/\/\/.*/g, '');
}

function processFiles(pattern, outputFile) {
    const files = fs.readdirSync(PRESETS_DIR).filter(f => f.startsWith(pattern) && f.endsWith('.json') && f !== path.basename(outputFile));
    
    let combined = [];
    
    for (const file of files) {
        console.log(`Reading ${file}...`);
        const p = path.join(PRESETS_DIR, file);
        const raw = fs.readFileSync(p, 'utf8');
        try {
            const clean = stripComments(raw);
            const parsed = JSON.parse(clean);
            if (Array.isArray(parsed)) {
                combined = combined.concat(parsed);
            } else {
                console.warn(`${file} is not an array, skipping.`);
            }
        } catch (e) {
            console.error(`Error parsing ${file}: ${e.message}`);
        }
    }
    
    fs.writeFileSync(OUTPUT_ACTIONS.replace('actions.json', outputFile), JSON.stringify(combined, null, 2));
    console.log(`Merged ${files.length} files into ${outputFile} (total items: ${combined.length})`);
    
    // Delete chunks
    for(const file of files) {
        fs.unlinkSync(path.join(PRESETS_DIR, file));
    }
}

processFiles('actions_', 'actions.json');
processFiles('items_', 'items.json');

