import React, { useState } from 'react';
import SimulationView from './views/Simulation/SimulationView';
import DiagnosticsView from './views/Diagnostics/DiagnosticsView';
import DatabaseView from './views/Database/DatabaseView';

export const DevApp: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'simulation' | 'diagnostics' | 'database'>('simulation');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', fontFamily: 'monospace', backgroundColor: '#111', color: '#eee' }}>
            <div style={{ display: 'flex', padding: '10px', backgroundColor: '#222', borderBottom: '1px solid #444', gap: '10px' }}>
                <button 
                    onClick={() => setActiveTab('simulation')} 
                    style={{ background: activeTab === 'simulation' ? '#444' : '#222', color: '#fff', border: '1px solid #555', padding: '5px 10px', cursor: 'pointer' }}
                >
                    Смуляция & Персонаж
                </button>
                <button 
                    onClick={() => setActiveTab('diagnostics')} 
                    style={{ background: activeTab === 'diagnostics' ? '#444' : '#222', color: '#fff', border: '1px solid #555', padding: '5px 10px', cursor: 'pointer' }}
                >
                    Диагностика Engine
                </button>
                <button 
                    onClick={() => setActiveTab('database')} 
                    style={{ background: activeTab === 'database' ? '#444' : '#222', color: '#fff', border: '1px solid #555', padding: '5px 10px', cursor: 'pointer' }}
                >
                    База Персонажей
                </button>
                <div style={{ flex: 1 }} />
                <div style={{ alignSelf: 'center', opacity: 0.7, fontSize: '0.8em' }}>Game Master's Toolkit v1.0</div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', padding: '10px', display: 'flex' }}>
                {activeTab === 'simulation' && <SimulationView />}
                {activeTab === 'diagnostics' && <DiagnosticsView />}
                {activeTab === 'database' && <DatabaseView />}
            </div>
        </div>
    );
};
