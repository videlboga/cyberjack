import React, { useState, useEffect } from 'react';

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

const SimulationView: React.FC = () => {
    const [subTab, setSubTab] = useState<'main'|'anatomy'|'relations'|'contexts'|'inventory'>('anatomy');
    const [characters, setCharacters] = useState<any[]>([]);
    const [focusedCharId, setFocusedCharId] = useState<string>('');
    const [subjectState, setSubjectState] = useState<any>(null);
    const [actionsList, setActionsList] = useState<any[]>([]);
    const [targetPointId, setTargetPointId] = useState<string>('general');
    const [intensity, setIntensity] = useState<number>(1.0);
    const [skipLLM, setSkipLLM] = useState<boolean>(false);
    const [chatLog, setChatLog] = useState<{role: string, text: string}[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const charsRes = await fetch(`${API_BASE}/api/characters`);
                const charsBody = await charsRes.json();
                if (charsBody.success) {
                    const chars = charsBody.characters || [];
                    setCharacters(chars);
                    if (chars.length > 0 && !focusedCharId) {
                        setFocusedCharId(chars[0].id);
                    }
                }
            } catch (err) {
                console.error('failed to load data', err);
            }
        };
        fetchInitialData();
    }, []);

    const fetchState = async () => {
        if (!focusedCharId) return;
        try {
            const search = new URLSearchParams({ subjectId: focusedCharId, sceneId: 'lab', pointId: 'general' });
            const res = await fetch(`${API_BASE}/api/state?${search.toString()}`);
            const body = await res.json();
            if (body.success) {
                setSubjectState(body.subject);
                if (body.availableActions) {
                    setActionsList(body.availableActions);
                }
            }
        } catch (err) {
            console.error('failed to fetch state', err);
        }
    };

    useEffect(() => {
        fetchState();
    }, [focusedCharId]);

    const setAnatomyPointValue = (pointId: string, attr: string, val: number) => {
        setSubjectState((prev: any) => {
            const next = { ...prev };
            next.anatomy = { ...next.anatomy };
            next.anatomy[pointId] = { ...next.anatomy[pointId], [attr]: val };
            return next;
        });
    };

    const savePoint = async (pointId: string, data: any) => {
        if (!focusedCharId) return;
        const payload: any = { subjectId: focusedCharId, pointId };
        ['localSensitivity', 'localAttitude', 'localOpenness', 'familiarity', 'exposureCount', 'baselineLocalSensitivity', 'baselineLocalAttitude', 'baselineLocalOpenness'].forEach(k => {
            if (data[k] !== undefined) payload[k] = Number(data[k]);
        });

        try {
            const res = await fetch(`${API_BASE}/api/subject/point`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const body = await res.json();
            if (body.success) {
                alert('Сохранено!');
            } else {
                alert('Ошибка: ' + (body.error || 'неизвестно'));
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети при сохранении');
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
                playerId: 'PL-1',
                skipLLM
            };
            if (actionId) reqBody.presetId = actionId;
            if (text) reqBody.textMessage = text;

            let label = `Action: ${actionId || 'None'}`;
            if (text) label = `Speak: ${text}`;

            setChatLog(prev => [...prev, { role: 'player', text: label }]);
            
            const res = await fetch(`${API_BASE}/api/tick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqBody)
            });
            const body = await res.json();
            console.debug('tick response', body);
            
            if (body && body.success) {
                const d = body.diagnostics || {};
                const parts: string[] = [];
                
                if (body.reply) {
                    if (typeof body.reply === 'string') {
                        parts.push(body.reply);
                    } else {
                        if (body.reply.reaction) parts.push(`*(${body.reply.reaction})*`);
                        if (body.reply.speech && body.reply.speech.trim() !== '') parts.push(`"${body.reply.speech}"`);
                    }
                } else if (d.reactionSummary) {
                    parts.push(d.reactionSummary);
                }

                if (typeof d.physicalEffect !== 'undefined' || typeof d.emotionalEffect !== 'undefined') {
                    const phys = (d.physicalEffect || 0).toFixed(2);
                    const emo = (d.emotionalEffect || 0).toFixed(2);
                    parts.push(`[Эффект: Физ=${phys}, Эмо=${emo}]`);
                }
                
                if (skipLLM) parts.push('(LLM пропущен)');

                const sysText = parts.length > 0 ? parts.join(' ') : (d.reactionSummary || 'нейтральная реакция');
                setChatLog(prev => [...prev, { role: 'system', text: sysText }]);
                fetchState();
            } else {
                setChatLog(prev => [...prev, { role: 'system', text: 'Error: ' + (body?.error || 'unknown') }]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ flex: 1, padding: 16, display: 'flex', gap: 20, overflow: 'hidden' }}>
            <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: 10, borderRight: '1px solid #444', paddingRight: 10 }}>
                <h2>Управление</h2>
                
                <div style={{ marginBottom: 10 }}>
                    <label style={{ marginRight: 8, display: 'block', marginBottom: 5 }}>Фокус (Персонаж):</label>
                    <select value={focusedCharId} onChange={e => setFocusedCharId(e.target.value)} style={{ padding: 4, width: '100%' }}>
                        <option value="">-- выберите --</option>
                        {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div style={{ marginBottom: 10 }}>
                    <label style={{ marginRight: 8, display: 'block', marginBottom: 5 }}>Интенсивность: {intensity.toFixed(1)}x</label>
                    <input type="range" min="0.1" max="5" step="0.1" value={intensity} onChange={e => setIntensity(Number(e.target.value))} style={{ width: '100%' }} />
                </div>

                <div style={{ marginBottom: 10 }}>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <input type="checkbox" checked={skipLLM} onChange={e => setSkipLLM(e.target.checked)} style={{ marginRight: 8 }} />
                        Без LLM (быстрый расчет)
                    </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <h4>Отправить действие:</h4>
                    <select id="point-select" value={targetPointId} onChange={e => setTargetPointId(e.target.value)} style={{ padding: 6 }}>
                        {Object.entries(POINT_LABELS_RU).map(([k, v]) => <option key={k} value={k}>{v} ({k})</option>)}
                    </select>
                    <select id="action-select" style={{ padding: 6 }}>
                        {actionsList.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                    <button 
                        onClick={() => {
                            const val = (document.getElementById('action-select') as HTMLSelectElement).value;
                            sendAction(val);
                        }} 
                        disabled={loading}
                        style={{ padding: 8, background: '#4a4', color: '#fff', border: 'none', cursor: 'pointer' }}
                    >
                        Выполнить
                    </button>
                    <button onClick={() => sendAction('wait')} disabled={loading} style={{ padding: 8, background: '#666', color: '#fff', border: 'none', cursor: 'pointer' }}>Ожидать</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', background: '#222', border: '1px solid #444', padding: 8, marginTop: 10 }}>
                    <h4>Лог (Чат)</h4>
                    {chatLog.map((log, i) => (
                        <div key={i} style={{ marginBottom: 4, color: log.role === 'player' ? '#88f' : '#ccc' }}>
                            <strong>{log.role === 'player' ? 'Вы:' : 'SYS:'}</strong> {log.text}
                        </div>
                    ))}
                    {loading && <div style={{ color: '#ff0' }}>Обработка...</div>}
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <button onClick={() => setSubTab('main')} style={{ fontWeight: subTab === 'main' ? 'bold' : 'normal' }}>База</button>
                    <button onClick={() => setSubTab('anatomy')} style={{ fontWeight: subTab === 'anatomy' ? 'bold' : 'normal' }}>Анатомия</button>
                    <button onClick={() => setSubTab('contexts')} style={{ fontWeight: subTab === 'contexts' ? 'bold' : 'normal' }}>Контексты</button>
                    <button onClick={() => setSubTab('relations')} style={{ fontWeight: subTab === 'relations' ? 'bold' : 'normal' }}>Отношения</button>
                    <button onClick={() => setSubTab('inventory')} style={{ fontWeight: subTab === 'inventory' ? 'bold' : 'normal' }}>Инвентарь</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', background: '#222', padding: 10, border: '1px solid #444' }}>
                    {subTab === 'anatomy' && subjectState?.anatomy && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {Object.entries(subjectState.anatomy).map(([point, data]: [string, any]) => (
                                <div key={point} style={{ background: '#333', padding: 10, borderRadius: 4 }}>
                                    <h4>{POINT_LABELS_RU[point] || point} <span style={{fontSize: 12, color: '#aaa'}}>({point})</span></h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 8 }}>
                                        <label>Чувств-ть<br/><input type="number" step="0.1" value={data.localSensitivity ?? 0} onChange={e => setAnatomyPointValue(point, 'localSensitivity', parseFloat(e.target.value) || 0)} style={{ width: '80%' }} /></label>
                                        <label>Отношение<br/><input type="number" step="0.1" value={data.localAttitude ?? 0} onChange={e => setAnatomyPointValue(point, 'localAttitude', parseFloat(e.target.value) || 0)} style={{ width: '80%' }} /></label>
                                        <label>Открытость<br/><input type="number" step="0.1" value={data.localOpenness ?? 0} onChange={e => setAnatomyPointValue(point, 'localOpenness', parseFloat(e.target.value) || 0)} style={{ width: '80%' }} /></label>
                                        <label>Знакомство<br/><input type="number" step="0.1" value={data.familiarity ?? 0} onChange={e => setAnatomyPointValue(point, 'familiarity', parseFloat(e.target.value) || 0)} style={{ width: '80%' }} /></label>
                                    </div>
                                    <button onClick={() => savePoint(point, data)} style={{ marginTop: 10, padding: '4px 8px', background: '#4CAF50', border: 'none', color: '#fff', cursor: 'pointer' }}>Сохранить</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {subTab === 'contexts' && subjectState?.contexts && (
                        <div>
                            {subjectState.contexts.map((ctx: any, i: number) => (
                                <div key={i} style={{ background: '#333', padding: 8, margin: '4px 0' }}>
                                    <strong>{ctx.actionId || ctx.type}</strong> (Точка: {ctx.pointId || '—'})
                                    <div style={{fontSize: 12, color: '#ccc'}}>Осталось: {(ctx.duration || 0) - (ctx.ticksActive || 0)} ходов</div>
                                </div>
                            ))}
                            {subjectState.contexts.length === 0 && <div>Нет активных контекстов</div>}
                        </div>
                    )}

                    {subTab === 'relations' && subjectState?.relations && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {subjectState.relations.map((rel: any, i: number) => (
                                <div key={i} style={{ background: '#333', padding: 10, borderRadius: 4 }}>
                                    <h4>Связь с {rel.toId}</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                                        <div>Отношение: {rel.attitude?.toFixed(2)}</div>
                                        <div>Доверие: {rel.trust?.toFixed(2)}</div>
                                        <div>Известно: {rel.knows ? 'Да' : 'Нет'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {subTab === 'inventory' && subjectState && (
                        <div>
                             <h4>Инвентарь</h4>
                             <pre>{JSON.stringify(subjectState.inventory || [], null, 2)}</pre>
                        </div>
                    )}

                    {subTab === 'main' && subjectState && (
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
