const http = require('http');
const { execSync } = require('child_process');

function request(path, payload) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: 3000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(payload))
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
                else reject(new Error(`Status: ${res.statusCode} ${data}`));
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify(payload));
        req.end();
    });
}

async function run() {
    try {
        const subjectId = 'S-01';
        
        console.log(`Testing with subject ${subjectId}...`);

        for (let i = 1; i <= 3; i++) {
            console.log(`\n--- Calling /api/tick (Attempt ${i}) ---`);
            const payload = {
                subjectId,
                presetId: 'slap', // Assuming this preset exists
                pointId: 'buttocks'     // Assuming this point exists
            };
            const actionRes = await request('/api/tick', payload);
            console.log('Action reply:', actionRes.aiResponse?.reply);
        }

        console.log('\n--- Checking History (last 8) ---');
        console.log(execSync(`sqlite3 cyberjack.sqlite "SELECT role, content FROM chat_memory WHERE subject_id='${subjectId}' ORDER BY id DESC LIMIT 8" | tac`).toString());

    } catch (err) {
        console.error('Error:', err.message);
    }
}

run();
