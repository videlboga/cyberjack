import React, { useState } from 'react';
import styled from 'styled-components';

interface CenterPanelProps {
    subject: any;
    relations: any[];
    characters: any[];
}

const PanelContainer = styled.div`
    flex: 1;
    background: #111;
    display: flex;
    flex-direction: column;
    color: #e0e0e0;
    border-right: 1px solid #333;
    overflow-y: auto;
`;

const Header = styled.div`
    padding: 1rem;
    border-bottom: 1px solid #333;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const Title = styled.h2`
    color: #00ffff;
    margin: 0;
    text-transform: uppercase;
    font-size: 1.3rem;
`;

const SubTabs = styled.div`
    display: flex;
    background: #0a0a0a;
`;

const TabButton = styled.button<{ active: boolean }>`
    flex: 1;
    padding: 0.8rem;
    border: none;
    border-bottom: 2px solid ${props => props.active ? '#00ffff' : 'transparent'};
    background: ${props => props.active ? '#151515' : 'transparent'};
    color: ${props => props.active ? '#xffffff' : '#888'};
    cursor: pointer;
    font-weight: bold;
    text-transform: uppercase;
    font-size: 0.8rem;

    &:hover { color: #fff; }
`;

const ContentArea = styled.div`
    padding: 1.5rem;
    flex: 1;
    overflow-y: auto;
`;

const GridLine = styled.div`
    display: grid;
    grid-template-columns: 100px 1fr 100px;
    gap: 1rem;
    align-items: center;
    margin-bottom: 0.5rem;
    border-bottom: 1px dashed #333;
    padding-bottom: 0.5rem;
`;

const Label = styled.span`
    color: #888;
    font-weight: bold;
`;

const ValueBox = styled.div`
    background: #222;
    padding: 0.4rem;
    text-align: right;
    color: #0f0;
    border-radius: 4px;
`;

const ProgressTrack = styled.div`
    height: 10px;
    background: #333;
    border-radius: 5px;
    overflow: hidden;
    position: relative;
`;

const ProgressBar = styled.div<{ val: number, color?: string }>`
    position: absolute;
    left: 0; top: 0; height: 100%;
    width: ${props => Math.max(0, Math.min(100, props.val))}%;
    background: ${props => props.color || '#00ffff'};
`;

export const CenterPanel: React.FC<CenterPanelProps> = ({ subject, relations }) => {
    const [subTab, setSubTab] = useState('basic');

    if (!subject) return <div style={{padding:'20px'}}>No Subject Data</div>;

    const renderBasic = () => (
        <div>
            <h3 style={{color: '#fff'}}>Основные параметры ({subject.name})</h3>
            {['sensitivity', 'capacity', 'openness', 'plasticity', 'attitude'].map(stat => (
                <GridLine key={stat}>
                    <Label>{stat}</Label>
                    <ProgressTrack>
                        <ProgressBar val={subject[stat]} color={stat === 'capacity' ? '#ffaa00' : '#00ffff'} />
                    </ProgressTrack>
                    <ValueBox>{subject[stat]?.toFixed(2)}</ValueBox>
                </GridLine>
            ))}
        </div>
    );

    const renderAnatomy = () => (
        <div>
            <h3 style={{color: '#fff'}}>Анатомия и Точки</h3>
            {Object.values(subject.anatomy || {}).map((pt: any) => (
                <div key={pt.pointId} style={{marginBottom: '1rem', background: '#1a1a1a', padding: '1rem', borderRadius: '4px'}}>
                    <h4 style={{margin: '0 0 0.5rem 0', color: '#ff00ff'}}>{pt.pointId}</h4>
                    <GridLine>
                        <Label>Sens / Att</Label>
                        <div>
                            <div style={{display:'flex', gap:'5px', marginBottom:'4px'}}>
                                <ProgressTrack style={{flex:1}}><ProgressBar val={pt.localSensitivity} color="#00ff00"/></ProgressTrack>
                                <ProgressTrack style={{flex:1}}><ProgressBar val={pt.localAttitude} color="#ff00ff"/></ProgressTrack>
                            </div>
                        </div>
                        <ValueBox>{pt.localSensitivity.toFixed(0)}/{pt.localAttitude.toFixed(0)}</ValueBox>
                    </GridLine>
                    <div style={{fontSize:'0.8rem', color:'#666'}}>
                        Familiarity: {pt.familiarity.toFixed(2)} | Exposures: {pt.exposureCount}
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <PanelContainer>
            <Header>
                <Title>ИНСПЕКТОР: {subject.name}</Title>
                <div style={{color:'#666', fontSize:'0.9rem'}}>{subject.id}</div>
            </Header>
            <SubTabs>
                <TabButton active={subTab === 'basic'} onClick={() => setSubTab('basic')}>Основа</TabButton>
                <TabButton active={subTab === 'anatomy'} onClick={() => setSubTab('anatomy')}>Анатомия</TabButton>
                <TabButton active={subTab === 'relations'} onClick={() => setSubTab('relations')}>Отношения</TabButton>
                <TabButton active={subTab === 'contexts'} onClick={() => setSubTab('contexts')}>Контексты</TabButton>
                <TabButton active={subTab === 'inventory'} onClick={() => setSubTab('inventory')}>Инвентарь</TabButton>
            </SubTabs>
            <ContentArea>
                {subTab === 'basic' && renderBasic()}
                {subTab === 'anatomy' && renderAnatomy()}
                {subTab === 'relations' && <div>Relations UI (WIP)</div>}
                {subTab === 'contexts' && <div>Contexts UI (WIP)</div>}
                {subTab === 'inventory' && <div>Inventory UI (WIP)</div>}
            </ContentArea>
        </PanelContainer>
    );
};
