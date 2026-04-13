const fs = require('fs');
let s = fs.readFileSync('src/ui/views/Simulation/SimulationView.tsx', 'utf-8');
const search = `        <div style={{ flex: 1, padding: 16, display: 'flex', gap: 20, overflow: 'hidden' }}>
            {/* Left Column: Actions and Logs */}
            <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: 10, borderRight: '1px solid #444', paddingRight: 10 }}>
                <h2>Управление</h2>

                <div style={{ marginBottom: 10 }}>
                    <label style={{ marginRight: 8, display: 'block', marginBottom: 5 }}>Фокус (Персонаж):</label>
                    <select value={focusedCharId} onChange={e => setFocusedCharId(e.target.value)} style={{ padding: 4, width: '100%' }}>
                        <option value="">-- выберите --</option>
                        {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div style={{ marginBottom: 10 }}>
                    <label style={{ marginRight: 8, display: 'block', marginBottom: 5 }}>Интенсивность: {intensity.toFixed(1)}x</label>
                    <input type="range" min="0.1" max="5" step="0.1" value={intensity} onChange={e => setIntensity(Number(e.target.value))} style={{ width: '100%' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <h4>Отправить действие:</h4>`;
const replace = `        <div style={{ flex: 1, padding: 16, display: 'flex', gap: 20, overflow: 'hidden' }}>
            {/* Left Column: Actions and Logs */}
            <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: 10, borderRight: '1px solid #444', paddingRight: 10 }}>
                <h2>Управление</h2>

                <div style={{ marginBottom: 10 }}>
                    <label style={{ marginRight: 8, display: 'block', marginBottom: 5 }}>Фокус (Персонаж):</label>
                    <select value={focusedCharId} onChange={e => setFocusedCharId(e.target.value)} style={{ padding: 4, width: '100%' }}>
                        <option value="">-- выберите --</option>
                        {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div style={{ marginBottom: 10 }}>
                    <label style={{ marginRight: 8, display: 'block', marginBottom: 5 }}>Интенсивность: {intensity.toFixed(1)}x</label>
                    <input type="range" min="0.1" max="5" step="0.1" value={intensity} onChange={e => setIntensity(Number(e.target.value))} style={{ width: '100%' }} />
                </div>

                <div style={{ marginBottom: 10 }}>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <input type="checkbox" checked={skipLLM} onChange={e => setSkipLLM(e.target.checked)} style={{ marginRight: 8 }} />
                        Без LLM (быстрый расчет)
                    </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <h4>Отправить действие:</h4>
                    <select id="point-select" value={targetPointId} onChange={e => setTargetPointId(e.target.value)} style={{ padding: 6 }}>
                        {Object.entries(POINT_LABELS_RU).map(([k, v]) => <option key={k} value={k}>{v} ({k})</option>)}
                    </select>`;

s = s.replace(search, replace);

// fix state
s = s.replace(`    const [actionsList, setActionsList] = useState<any[]>([]);
    const [intensity, setIntensity] = useState<number>(1.0);`,
`    const [actionsList, setActionsList] = useState<any[]>([]);
    const [targetPointId, setTargetPointId] = useState<string>('general');
    const [intensity, setIntensity] = useState<number>(1.0);
    const [skipLLM, setSkipLLM] = useState<boolean>(false);`)
fs.writeFileSync('src/ui/views/Simulation/SimulationView.tsx', s);
