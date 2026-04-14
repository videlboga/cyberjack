import React from 'react';
import styled from 'styled-components';

interface ScenePanelProps {
    scene: any;
    inventory: any[];
}

const PanelContainer = styled.div`
    width: 350px;
    height: 100%;
    background: #0a0a0a;
    display: flex;
    flex-direction: column;
    color: #e0e0e0;
`;

const Section = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    border-bottom: 2px solid #222;
    overflow: hidden;

    &:last-child {
        border-bottom: none;
    }
`;

const SectionHeader = styled.div`
    background: #1a1a1a;
    padding: 0.75rem 1rem;
    font-weight: bold;
    color: #ffaa00;
    text-transform: uppercase;
    font-size: 0.9rem;
    letter-spacing: 1px;
    border-bottom: 1px solid #333;
`;

const ScrollableContent = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
`;

const Box = styled.div`
    background: #1a1a1a;
    border: 1px solid #333;
    padding: 0.75rem;
    margin-bottom: 1rem;
    border-radius: 4px;
`;

export const ScenePanel: React.FC<ScenePanelProps> = ({ scene, inventory }) => {
    return (
        <PanelContainer>
            <Section>
                <SectionHeader>Управление Сценой</SectionHeader>
                <ScrollableContent>
                    {!scene ? <div style={{color:'#666'}}>No Scene Data</div> : (
                        <Box>
                            <div><strong>Текущая локация:</strong> {scene.id}</div>
                            <h4 style={{margin: '1rem 0 0.5rem 0', color: '#888'}}>Персонажи на сцене:</h4>
                            {scene.characters?.map((c: any) => (
                                <div key={c.character.id} style={{padding: '0.2rem 0', display:'flex', justifyContent:'space-between'}}>
                                    <span>{c.character.name}</span>
                                    <span style={{color: '#ffaa00'}}>{c.slotId}</span>
                                </div>
                            ))}
                        </Box>
                    )}
                </ScrollableContent>
            </Section>

            <Section>
                <SectionHeader>Оборудование (Инвентарь)</SectionHeader>
                <ScrollableContent>
                    {!inventory ? <div style={{color:'#666'}}>No Inventory</div> : (
                        inventory.map((item: any) => (
                            <Box key={item.id}>
                                <div style={{fontWeight: 'bold', color: '#00ff00'}}>{item.name}</div>
                                <div style={{fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem'}}>{item.type}</div>
                                <div style={{fontSize: '0.85rem'}}>{item.description}</div>
                            </Box>
                        ))
                    )}
                </ScrollableContent>
            </Section>
        </PanelContainer>
    );
};
