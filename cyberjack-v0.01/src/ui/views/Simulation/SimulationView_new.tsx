import React, { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:3000';

const POINT_LABELS_RU: Record<string, string> = {
  general: 'Общее',
  head: 'Голова',
  eyes: 'Глаза',
  mouth: 'Рот',
  chest: 'Грудь',
  abdomen: 'Живот',
  pelvis: 'Таз',
  pelvis_front: 'Таз (перед)',
  left_hand: 'Левая рука',
  right_hand: 'Правая рука',
  left_arm: 'Левая рука (вся)',
  right_arm: 'Правая рука (вся)',
  left_leg: 'Левая нога',
  right_leg: 'Правая нога',
  left_thumb: 'Большой палец (левая)',
  right_thumb: 'Большой палец (правая)',
  left_index: 'Указательный (левая)',
  right_index: 'Указательный (правая)',
  vagina: 'Влагалище',
  anus: 'Анус',
  penis: 'Половой орган',
  breasts: 'Грудные железы',
  chest_nipple: 'Сосок',
  buttocks: 'Ягодицы',
  general_skin: 'Кожа'
};

const SimulationViewNew: React.FC = () => {
  const [characters, setCharacters] = useState<any[]>([]);
  const [actionsList, setActionsList] = useState<any[]>([]);
  const [focusedCharId, setFocusedCharId] = useState<string>('');
  const [subjectState, setSubjectState] = useState<any>(null);

  const [targetPointId, setTargetPointId] = useState<string>('systemic');
  const [intensity, setIntensity] = useState<number>(1.0);
  const [skipLLM, setSkipLLM] = useState<boolean>(false);

  const [chatLog, setChatLog] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      try {
        const cRes = await fetch(`${API_BASE}/api/characters`);
        const cBody = await cRes.json();
        if (cBody && cBody.success && Array.isArray(cBody.characters)) {
          setCharacters(cBody.characters);
          if (!focusedCharId && cBody.characters.length > 0) setFocusedCharId(cBody.characters[0].id);
        }
      } catch (e) {
        console.warn('failed loading characters', e);
      }

      try {
        const aRes = await fetch(`${API_BASE}/api/meta/actions`);
        if (aRes.ok) {
          const acts = await aRes.json();
          if (Array.isArray(acts)) setActionsList(acts);
        }
      } catch (e) {
        /* ignore */
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!focusedCharId) return;
    const fetchState = async () => {
      try {
        const search = new URLSearchParams({ subjectId: focusedCharId, sceneId: 'lab', pointId: 'systemic' });
        const res = await fetch(`${API_BASE}/api/state?${search.toString()}`);
        const body = await res.json();
        if (body && body.success) setSubjectState(body.subject);
      } catch (e) {
        console.warn('failed to fetch state', e);
      }
    };
    fetchState();
  }, [focusedCharId]);

  const fetchState = async () => {
    if (!focusedCharId) return;
    try {
      const search = new URLSearchParams({ subjectId: focusedCharId, sceneId: 'lab', pointId: 'systemic' });
      const res = await fetch(`${API_BASE}/api/state?${search.toString()}`);
      const body = await res.json();
      if (body && body.success) setSubjectState(body.subject);
    } catch (e) {
      console.warn(e);
    }
  };

  const sendAction = async (actionId?: string, text?: string) => {
    if (!focusedCharId) return;
    setLoading(true);
    try {
      const reqBody: any = {
        subjectId: focusedCharId,
        pointId: targetPointId,
        intensity,
        sceneId: 'lab',
        playerId: 'PL-1'
      } as any;
      if (actionId) reqBody.presetId = actionId;
      if (text) reqBody.textMessage = text;
      // pass skipLLM as a boolean only when user toggles it
      if (skipLLM) reqBody.skipLLM = true;

      const label = text ? `Speak: ${text}` : `Action: ${actionId || 'None'}`;
      setChatLog(prev => [...prev, { role: 'player', text: label }]);

      const res = await fetch(`${API_BASE}/api/tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
      });

      const body = await res.json();

      // Always log diagnostics to console to help debugging
      console.debug('tick response', body);

      if (body && body.success) {
        const actionApplied = !!body.actionApplied;
        const d = body.diagnostics || {};
        // Build message pieces: prefer textual reactionSummary but always show numeric effects
        const parts: string[] = [];
        if (d.reactionSummary) parts.push(d.reactionSummary);
        // numeric effects may be present even if reactionSummary is empty
        if (typeof d.physicalEffect !== 'undefined' || typeof d.emotionalEffect !== 'undefined') {
          const phys = (d.physicalEffect || 0).toFixed(2);
          const emo = (d.emotionalEffect || 0).toFixed(2);
          parts.push(`[Эффект: Физ=${phys}, Эмо=${emo}]`);
        }
        if (skipLLM) parts.push('(LLM пропущен)');

        const sysText = parts.length > 0 ? parts.join(' ') : (d.reactionSummary || 'нейтральная реакция');
        if (actionApplied) {
          setChatLog(prev => [...prev, { role: 'system', text: sysText }]);
        } else {
          setChatLog(prev => [...prev, { role: 'system', text: 'Команда принята. Ожидается выполнение.' }]);
        }
        // refresh subject state
        await fetchState();
      } else {
        setChatLog(prev => [...prev, { role: 'system', text: 'Error: ' + (body?.error || 'unknown') }]);
      }
    } catch (err) {
      console.error('sendAction failed', err);
      setChatLog(prev => [...prev, { role: 'system', text: 'Ошибка сети при отправке действия' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 12, padding: 12 }}>
      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3>Управление</h3>

        <div>
          <label style={{ display: 'block', marginBottom: 6 }}>Фокус (Персонаж)</label>
          <select value={focusedCharId} onChange={e => setFocusedCharId(e.target.value)} style={{ width: '100%', padding: 6 }}>
            <option value="">-- выберите --</option>
            {characters.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6 }}>Точка</label>
          <select value={targetPointId} onChange={e => setTargetPointId(e.target.value)} style={{ width: '100%', padding: 6 }}>
            {Object.entries(POINT_LABELS_RU).map(([k, v]) => (
              <option key={k} value={k}>{v} ({k})</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6 }}>Интенсивность: {intensity.toFixed(1)}x</label>
          <input type="range" min={0.1} max={5} step={0.1} value={intensity} onChange={e => setIntensity(Number(e.target.value))} style={{ width: '100%' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={skipLLM} onChange={e => setSkipLLM(e.target.checked)} />
            <span>Без LLM (быстрый расчёт)</span>
          </label>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6 }}>Действие</label>
          <select id="action-select" style={{ width: '100%', padding: 6 }}>
            <option value="">-- preset --</option>
            {actionsList.map(a => <option key={a.id} value={a.id}>{a.label || a.id}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => {
              const val = (document.getElementById('action-select') as HTMLSelectElement).value;
              sendAction(val);
            }} disabled={loading} style={{ flex: 1, padding: '8px', background: '#16a34a', color: '#fff', border: 'none' }}>Выполнить</button>
            <button onClick={() => sendAction('wait')} disabled={loading} style={{ padding: '8px', background: '#6b7280', color: '#fff', border: 'none' }}>Ожидать</button>
          </div>
        </div>

        <div style={{ marginTop: 6 }}>
          <h4>Лог (чат)</h4>
          <div style={{ height: 240, overflowY: 'auto', background: '#111', color: '#eee', padding: 8, borderRadius: 4 }}>
            {chatLog.map((l, i) => (
              <div key={i} style={{ marginBottom: 6, color: l.role === 'player' ? '#7dd3fc' : '#ddd' }}>
                <strong>{l.role === 'player' ? 'Вы:' : 'SYS:'}</strong> {l.text}
              </div>
            ))}
            {loading && <div style={{ color: '#fbbf24' }}>Обработка...</div>}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, background: '#0b1220', padding: 12, borderRadius: 6 }}>
        <h3>Фокус — состояние</h3>
        <pre style={{ color: '#ddd', whiteSpace: 'pre-wrap' }}>{JSON.stringify(subjectState || {}, null, 2)}</pre>
      </div>
    </div>
  );
};

export default SimulationViewNew;
