import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { LeftPanel } from './components/LeftPanel';
import { CenterPanel } from './components/CenterPanel';
import { RightPanel } from './components/RightPanel';

const SimulationContainer = styled.div`
    display: flex;
    height: 100%;
    width: 100%;
    background: #000;
    overflow: hidden;
`;

export default function SimulationView() {
    const [stateData, setStateData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [lastTick, setLastTick] = useState<any>(null);

    const loadState = async () => {
        try {
            const res = await fetch('/api/state?subjectId=S-01&playerId=PL-1');
            const data = await res.json();
            if (data.success) {
                setStateData(data);
            }
        } catch (e) {
            console.error('Failed to load state', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadState();
        const interval = setInterval(loadState, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (actionId: string, pointId: string, intensity: number, useLlm: boolean) => {
        try {
            const res = await fetch('/api/tick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subjectId: stateData.subject.id,
                    playerId: stateData.player?.id || 'PL-1',
                    presetId: actionId,
                    pointId: pointId,
                    intensity: intensity,
                    skipLLM: !useLlm // Wait, processTick uses skipLLM
                })
            });
            const result = await res.json();
            if (result.success) {
                setLastTick(result);
            }
            loadState();
        } catch(e) {
            console.error('Action failed', e);
        }
    };

    const handleWait = async () => {
         try {
            const res = await fetch('/api/wait', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subjectId: stateData.subject.id,
                    playerId: stateData.player?.id || 'PL-1',
                    ticks: 1,
                    callLLM: false // Assume wait skip LLM by default, or change if needed
                })
            });
            const result = await res.json();
            if (result.success) {
                setLastTick(result);
            }
            loadState();
        } catch(e) {
            console.error('Wait failed', e);
        }
    };

    if (loading || !stateData) return <div style={{color: 'white', padding: '20px'}}>Loading...</div>;

    return (
        <SimulationContainer>
            <LeftPanel 
                availableActions={stateData.availableActions || []}
                availablePoints={stateData.availablePoints || []}
                onActionSubmit={handleAction}
                onWaitSubmit={handleWait}
                lastTick={lastTick}
            />
            <CenterPanel 
                subject={stateData.subject}
                relations={stateData.relations}
                characters={stateData.characters}
            />
            <RightPanel 
                scene={stateData.scene}
                inventory={stateData.player?.inventory}
                lastTick={lastTick}
            />
        </SimulationContainer>
    );
}
