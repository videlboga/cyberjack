const fs = require('fs');
let code = fs.readFileSync('src/ui/App.tsx', 'utf8');

code = code.replace(/handleAction\(\{/g, 'addToQueue({');
code = code.replace("onClick={() => handleAction()} disabled={!selectedAction}>\n                      Применить\n                    </button>", 
`onClick={() => addToQueue()} disabled={!selectedAction}>\n                      + В очередь\n                    </button>`);

// Now insert Action Queue before action-costs
const insertQueue = `
                  <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
                    <span style={{ color: '#aaa' }}>Длительность (0 = мгновенно):</span>
                    <input type="number" min="0" value={actionDuration} onChange={(e) => setActionDuration(parseInt(e.target.value) || 0)} style={{ width: '60px' }} />
                  </div>
                </div>

                {actionQueue.length > 0 && (
                <div className="action-queue" style={{ marginTop: '12px', background: '#1c1c1c', padding: '8px', borderRadius: '4px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#888' }}>В очереди ({actionQueue.length}):</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {actionQueue.map(q => (
                      <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#2c2c2c', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                        <span>
                            {q.textMessage ? \`🗣 \${q.textMessage}\` : \`⚡ [\${q.targetName}] \${q.label} (Сила: \${q.intensity.toFixed(1)})\`}
                            {q.duration ? \` • \${q.duration} т.\` : ''}
                        </span>
                        <button style={{ padding: '0 4px', fontSize: '12px' }} onClick={() => removeFromQueue(q.id)}>X</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={executeQueue} disabled={loading} style={{ marginTop: '8px', width: '100%', background: '#2e7d32', color: 'white' }}>
                    ▶ Выполнить всё
                  </button>
                </div>
                )}
`;

code = code.replace("</button>\n                  </div>\n                </div>\n                <div className=\"action-costs\">",
`</button>\n                  </div>\n                  ${insertQueue}\n                <div className=\"action-costs\">`);

fs.writeFileSync('src/ui/App.tsx', code);
