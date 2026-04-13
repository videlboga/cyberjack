const fs = require('fs');
let code = fs.readFileSync('src/ui/views/Simulation/SimulationView.tsx', 'utf8');

// replace everything starting exactly from {subTab === 'main' to the end
const marker = "{subTab === 'main'";
const index = code.lastIndexOf(marker);
if (index !== -1) {
  const tail = `{subTab === 'main' && subjectState && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <h3>Базовые параметры</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                                {['sensitivity', 'capacity', 'openness', 'plasticity', 'attitude'].map(attr => (
                                    <div key={attr} style={{ background: '#333', padding: 10, borderRadius: 4 }}>
                                        <label style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ textTransform: 'capitalize', marginBottom: 5 }}>
                                                {attr}: {subjectState[attr] != null ? Number(subjectState[attr]).toFixed(1) : 0}
                                            </span>
                                            <input 
                                                type="range" 
                                                min="0" max="100" step="0.1" 
                                                value={subjectState[attr] || 0} 
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value);
                                                    setSubjectState((prev: any) => ({ ...prev, [attr]: val }));
                                                }}
                                            />
                                        </label>
                                    </div>
                                ))}
                            </div>
                            
                            <details style={{ marginTop: 20 }}>
                                <summary style={{ cursor: 'pointer', color: '#88a' }}>RAW JSON</summary>
                                <pre>{JSON.stringify(subjectState, null, 2)}</pre>
                            </details>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SimulationView;
`;
  code = code.substring(0, index) + tail;
  fs.writeFileSync('src/ui/views/Simulation/SimulationView.tsx', code);
  console.log('Fixed syntax error!');
}
