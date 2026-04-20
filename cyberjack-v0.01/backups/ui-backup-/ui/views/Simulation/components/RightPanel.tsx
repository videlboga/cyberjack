import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { ScenePanel } from './ScenePanel';

const Container = styled.div`
    width: 420px;
    height: 100%;
    background: #0a0a0a;
    display: flex;
    flex-direction: column;
    border-left: 1px solid #333;
    color: #e0e0e0;
`;

const Tabs = styled.div`
    display: flex;
    background: #111;
`;

const Tab = styled.button<{ active: boolean }>`
    flex: 1;
    padding: 0.8rem 0.2rem;
    background: ${props => props.active ? '#1e1e1e' : 'transparent'};
    color: ${props => props.active ? '#ffaa00' : '#888'};
    border: none;
    border-bottom: 2px solid ${props => props.active ? '#ffaa00' : 'transparent'};
    cursor: pointer;
    font-weight: bold;
    text-transform: uppercase;
    font-size: 0.75rem;

    &:hover { color: #fff; }
`;

const ContentPanel = styled.div`
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
`;

const Box = styled.div`
    background: #1a1a1a;
    border: 1px solid #333;
    padding: 0.75rem;
    margin: 0.5rem 1rem;
    border-radius: 4px;
`;

const PreText = styled.pre`
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: inherit;
    font-size: 0.85rem;
    color: ${props => props.color || '#ccc'};
`;

const SectionHeader = styled.h4`
    color: ${props => props.color || '#00ffff'};
    margin: 0 0 0.5rem 0;
    border-bottom: 1px dashed #333;
    padding-bottom: 0.25rem;
`;

interface RightPanelProps {
    scene: any;
    inventory: any[];
    lastTick: any;
}

export const RightPanel: React.FC<RightPanelProps> = ({ scene, inventory, lastTick }) => {
    const [tab, setTab] = useState<'scene' | 'prompt' | 'logs'>('prompt');

    const renderLogs = () => {
        if (!lastTick) return <div style={{padding:'1rem', color:'#666'}}>Ждем совершения действия...</div>;
        
        const b = lastTick.bundle;
        const d = lastTick.diagnostics || b?.diagnostics;
        const tickRes = lastTick.tickResult || b?.output?.result;
        const delta = b?.output?.delta;

        return (
            <ContentPanel>
                {d && (
                    <Box>
                        <SectionHeader color="#ff00ff">Narrator Reaction (LLM)</SectionHeader>
                        <PreText color="#fff">{d.reactionSummary || '(нет реакции или отключено)'}</PreText>
                        
                        <SectionHeader color="#00ff00" style={{marginTop:'1rem'}}>Лог Действия (Движок)</SectionHeader>
                        <PreText color="#fff">{d.actionSummary}</PreText>
                        
                        {(d.physicalEffect !== undefined || d.emotionalEffect !== undefined) && (
                            <div style={{marginTop:'0.5rem', fontSize:'0.85rem'}}>
                                {d.physicalEffect !== undefined && <div style={{color:'#00ff00'}}>Физический урон: {d.physicalEffect.toFixed(2)}</div>}
                                {d.emotionalEffect !== undefined && <div style={{color:'#ff00ff'}}>Эмоциональный шок: {d.emotionalEffect.toFixed(2)}</div>}
                            </div>
                        )}
                    </Box>
                )}

                {tickRes && (
                    <Box>
                         <SectionHeader color="#00ffff">Результат Тика (Математика)</SectionHeader>
                         <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem', fontSize:'0.85rem', color:'#ccc'}}>
                             <div>Effective Att: <span style={{color:'#fff'}}>{tickRes.effectiveAttitude?.toFixed(2)}</span></div>
                             <div>Attitude Shift: <span style={{color:'#fff'}}>{tickRes.attitudeShift?.toFixed(2)}</span></div>
                             <div>Final Valence: <span style={{color: tickRes.finalValence > 0 ? '#0f0' : '#f00'}}>{tickRes.finalValence?.toFixed(2)}</span></div>
                             <div>Intensity (Exp): <span style={{color:'#fff'}}>{tickRes.experiencedIntensity?.toFixed(2)}</span></div>
                             <div>Pleasure / Discom: <span style={{color:'#0f0'}}>{tickRes.pleasure?.toFixed(2)}</span> / <span style={{color:'#f00'}}>{tickRes.discomfort?.toFixed(2)}</span></div>
                             <div>Overload: <span style={{color:'#ff0'}}>{tickRes.overload?.toFixed(2)}</span></div>
                         </div>
                    </Box>
                )}

                {delta && Object.keys(delta).length > 0 && (
                    <Box>
                        <SectionHeader color="#ffaa00">Изменения параметров (Дельта)</SectionHeader>
                        <div style={{display:'flex', gap:'1rem', fontSize:'0.85rem'}}>
                            {delta.core && (
                                <div style={{flex:1}}>
                                    <div style={{color:'#888', marginBottom:'4px'}}>Core Changes:</div>
                                    {Object.entries(delta.core).map(([k, v]:any) => (
                                        <div key={k}>{k}: <span style={{color: v > 0 ? '#0f0' : '#f00'}}>{v > 0 ? '+' : ''}{v.toFixed(2)}</span></div>
                                    ))}
                                </div>
                            )}
                            {delta.point && (
                                <div style={{flex:1}}>
                                    <div style={{color:'#888', marginBottom:'4px'}}>Point Changes:</div>
                                    {Object.entries(delta.point).filter(([k,v]:any) => k !== 'pointId').map(([k, v]:any) => (
                                        <div key={k}>{k}: <span style={{color: v > 0 ? '#0f0' : '#f00'}}>{v > 0 ? '+' : ''}{v.toFixed(2)}</span></div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Box>
                )}
            </ContentPanel>
        );
    };

    const renderPrompt = () => {
        if (!lastTick) return <div style={{padding:'1rem', color:'#666'}}>Ждем совершения действия...</div>;
        
        const p = lastTick.bundle?.prompt;
        const msg = lastTick.promptMessages || [];

        return (
            <ContentPanel>
                {msg && msg.length > 0 && (
                    <Box>
                        <SectionHeader color="#ff00ff">Сообщения в Модель</SectionHeader>
                        {msg.map((m:any, i:number) => (
                            <div key={i} style={{marginBottom:'1rem', borderBottom:'1px solid #333', paddingBottom:'0.5rem'}}>
                                <div style={{color:'#888', textTransform:'uppercase', fontSize:'0.75rem'}}>{m.role}</div>
                                <PreText color={m.role === 'system' ? '#00ffff' : '#fff'} style={{fontSize: '0.75rem'}}>
                                    {typeof m.content === 'string' ? m.content : JSON.stringify(m.content, null, 2)}
                                </PreText>
                            </div>
                        ))}
                    </Box>
                )}
                {p && (!msg || msg.length === 0) && (
                    <Box>
                        <SectionHeader color="#00ffff">Сырой Промпт Логики</SectionHeader>
                        <PreText color="#888">{JSON.stringify(p, null, 2)}</PreText>
                    </Box>
                )}
            </ContentPanel>
        );
    };

    return (
        <Container>
            <Tabs>
                <Tab active={tab === 'scene'} onClick={() => setTab('scene')}>Сцена & Шмот</Tab>
                <Tab active={tab === 'prompt'} onClick={() => setTab('prompt')}>LLM Промпты</Tab>
                <Tab active={tab === 'logs'} onClick={() => setTab('logs')}>Логи Движка</Tab>
            </Tabs>
            {tab === 'scene' && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <ScenePanel scene={scene} inventory={inventory} />
                </div>
            )}
            {tab === 'prompt' && renderPrompt()}
            {tab === 'logs' && renderLogs()}
        </Container>
    );
};
