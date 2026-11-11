import fs from 'fs';
import path from 'path';

const LOG_DIR = path.resolve(process.cwd(), 'logs');

function ensureDir() {
    try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (e) { }
}

export function appendJsonLog(filename: string, obj: any) {
    try {
        ensureDir();
        const p = path.join(LOG_DIR, filename);
        // Safe stringify to avoid circular reference errors
        const seen = new WeakSet();
        const safe = JSON.stringify({ ts: new Date().toISOString(), ...obj }, function (k, v) {
            if (v && typeof v === 'object') {
                if (seen.has(v)) return '[Circular]';
                seen.add(v);
            }
            return v;
        });
        const line = (safe || JSON.stringify({ ts: new Date().toISOString(), error: 'serialize_failed' })) + '\n';
        fs.appendFileSync(p, line, 'utf-8');
    } catch (e) {
        // swallow logging errors
        try { console.error('fileLogs append error', e); } catch { }
    }
}

export function readJsonLog(filename: string, maxLines = 200) {
    try {
        const p = path.join(LOG_DIR, filename);
        if (!fs.existsSync(p)) return [];
        const raw = fs.readFileSync(p, 'utf-8');
        const lines = raw.split(/\r?\n/).filter(Boolean);
        const slice = lines.slice(-maxLines);
        return slice.map(l => { try { return JSON.parse(l); } catch { return { raw: l }; } });
    } catch (e) {
        return [{ error: String(e) }];
    }
}
