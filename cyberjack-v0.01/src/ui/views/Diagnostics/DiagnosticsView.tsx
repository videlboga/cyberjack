import React, { useState, useEffect } from 'react';

const DiagnosticsView: React.FC = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
            <h2>Диагностика Движка (Game Master)</h2>
            <div style={{ display: 'flex', flex: 1, gap: '10px' }}>
                <div style={{ flex: 1, border: '1px solid #444', padding: '10px', background: '#1c1f24', position: 'relative', overflow: 'auto' }}>
                    <h3 style={{ margin: '0 0 10px', color: '#aab' }}>Последний Промпт LLM</h3>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '11px', color: '#9d9d9d' }}>
                        {'Ожидает отправки действия...'}
                    </pre>
                </div>
                <div style={{ width: '450px', border: '1px solid #444', padding: '10px', background: '#222', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 10px', color: '#bba' }}>События Твика (Math Logs)</h3>
                        <p style={{ fontSize: '12px', color: '#888' }}>{'Здесь будет вывод engineMath logs.'}</p>
                    </div>
                    <div style={{ flex: 1, borderTop: '1px solid #444', paddingTop: '10px' }}>
                        <h3 style={{ margin: '0 0 10px', color: '#bab' }}>Оркестратор и Входные данные</h3>
                        <p style={{ fontSize: '12px', color: '#888' }}>{'Здесь будет вывод buildPromptPayload.'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DiagnosticsView;
