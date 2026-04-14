import React, { useState } from 'react';
import styled from 'styled-components';

interface LeftPanelProps {
    actionsList?: any[];
    availableActions?: any[];
    availablePoints?: any[];
    targetPointId?: string;
    onActionSubmit?: (actionId: string, pointId: string, intensity: number, useLlm: boolean) => void;
    onWaitSubmit?: () => void;
    lastTick?: any;
    sendAction?: (actionId?: string, text?: string) => void;
    chatLog?: { role: string; text: string }[];
}

const PanelContainer = styled.div`
  width: 320px;
  height: 100%;
  background: #1a1a1a;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  color: #fff;
  font-size: 0.9rem;
`;

const Section = styled.div`
  padding: 1rem;
  border-bottom: 1px solid #333;
`;

const Title = styled.h3`
  color: #00ff00;
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const FormRow = styled.div`
  margin-bottom: 1rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.3rem;
  color: #aaa;
`;

const Select = styled.select`
  width: 100%;
  padding: 0.4rem;
  background: #2a2a2a;
  color: #fff;
  border: 1px solid #444;
`;

const Input = styled.input`
  width: 100%;
  background: #2a2a2a;
  color: #fff;
  border: 1px solid #444;
`;

const Button = styled.button`
  width: 100%;
  padding: 0.6rem;
  border: 1px solid #00ff00;
  background: #2a2a2a;
  color: #00ff00;
  cursor: pointer;
  font-weight: bold;
  margin-bottom: 0.5rem;
  &:hover { background: #3a3a3a; }
`;

const BottomRow = styled.div`
  display: flex;
  gap: 8px;
`;

const SmallButton = styled(Button)`
  width: 120px;
`;

const LeftPanel2: React.FC<LeftPanelProps> = ({ availableActions = [], availablePoints = [], sendAction, chatLog = [], lastTick, onActionSubmit, onWaitSubmit, targetPointId }) => {
  const [actionId, setActionId] = useState(availableActions[0]?.id || '');
  const [pointId, setPointId] = useState(targetPointId || availablePoints[0]?.id || 'general');
  const [intensity, setIntensity] = useState<number>(50);
  const [useLlm, setUseLlm] = useState<boolean>(true);
  const [chatInput, setChatInput] = useState('');

  return (
    <PanelContainer>
      <Section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Title>Общий Чат / Журнал</Title>
        <div style={{ flex: 1, overflowY: 'auto', fontSize: '0.85rem' }}>
          {chatLog.map((log, i) => (
            <div key={i} style={{ marginBottom: 6, color: log.role === 'player' ? '#88f' : (log.role === 'system' ? '#ccc' : '#aaa') }}>
              <strong>{log.role === 'player' ? 'Вы:' : (log.role === 'system' ? 'SYS:' : log.role + ':')}</strong> {log.text}
            </div>
          ))}

          {!chatLog.length && !lastTick && (
            <div style={{ color: '#666', fontStyle: 'italic' }}>Журнал пуст... отправьте действие</div>
          )}

          {lastTick && (
            <div>
              {lastTick.diagnostics?.actionSummary && (
                <div style={{ color: '#ffaa00', marginBottom: '10px', fontStyle: 'italic' }}>* {lastTick.diagnostics.actionSummary}</div>
              )}
              {lastTick.reply?.speech && (
                <div style={{ color: '#00ffff', marginBottom: '10px' }}><b>Реакция:</b> "{lastTick.reply.speech}"</div>
              )}
              {lastTick.narratorReaction?.speech && (
                <div style={{ color: '#ff00ff', marginBottom: '10px' }}><b>Рассказчик:</b> {lastTick.narratorReaction.speech}</div>
              )}
            </div>
          )}
        </div>

        <form onSubmit={e => { e.preventDefault(); if (chatInput.trim()) { sendAction && sendAction(undefined, chatInput.trim()); setChatInput(''); } }} style={{ marginTop: 8 }}>
          <BottomRow>
            <Input placeholder="Сообщение в общий чат..." value={chatInput} onChange={e => setChatInput(e.target.value)} />
            <SmallButton type="submit">Отправить</SmallButton>
          </BottomRow>
        </form>
      </Section>

      <Section>
        <Title>Панель действия</Title>
        <FormRow>
          <Label>Действие (Пресет):</Label>
          <Select value={actionId} onChange={e => setActionId(e.target.value)}>
            {availableActions.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </Select>
        </FormRow>

        <FormRow>
          <Label>Точка воздействия:</Label>
          <Select value={pointId} onChange={e => setPointId(e.target.value)}>
            {availablePoints.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </FormRow>

        <FormRow>
          <Label>Интенсивность: {intensity}</Label>
          <Input type="range" min={0} max={100} value={String(intensity)} onChange={e => setIntensity(Number(e.target.value))} />
        </FormRow>

        <FormRow style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={useLlm} onChange={e => setUseLlm(e.target.checked)} />
          <Label style={{ margin: 0 }}>Использовать LLM</Label>
        </FormRow>

        <Button onClick={() => onActionSubmit && onActionSubmit(actionId, pointId, intensity, useLlm)}>ОТПРАВИТЬ ДЕЙСТВИЕ</Button>
        <Button onClick={() => onWaitSubmit && onWaitSubmit()} style={{ borderColor: '#ffaa00', color: '#ffaa00' }}>ЖДАТЬ 1 ТИК</Button>
      </Section>
    </PanelContainer>
  );
};

export default LeftPanel2;
