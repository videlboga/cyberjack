import React, { useState, useEffect } from 'react';

export function ConfigEditor() {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const [generatorSubject, setGeneratorSubject] = useState('S-01');
    const [generatorSeed, setGeneratorSeed] = useState('');
    const [generatorApply, setGeneratorApply] = useState(true);
    const [generatorLoading, setGeneratorLoading] = useState(false);
    const [generatorError, setGeneratorError] = useState('');
    const [generatorResult, setGeneratorResult] = useState<any>(null);
    const [copyStatus, setCopyStatus] = useState('');

    useEffect(() => {
        fetch('http://localhost:3001/api/config')
            .then(r => r.json())
            .then(data => {
                setConfig(data.config);
                setLoading(false);
            })
            .catch(console.error);
    }, []);

    const handleChange = (section: string, field: string, value: string) => {
        setConfig((prev: any) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    const saveConfig = async () => {
        setSaving(true);
        try {
            const res = await fetch('http://localhost:3001/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config })
            });
            if (res.ok) setMsg('Сохранено!');
            setTimeout(() => setMsg(''), 2000);
        } catch (e) {
            console.error(e);
            setMsg('Ошибка сохранения');
        }
        setSaving(false);
    };

    const runGenerator = async () => {
        setGeneratorLoading(true);
        setGeneratorError('');
        try {
            const res = await fetch('http://localhost:3001/api/characters/prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subjectId: generatorSubject,
                    seed: generatorSeed || undefined,
                    applyToSillyTavern: generatorApply
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Не удалось сгенерировать профиль');
            }
            setGeneratorResult(data);
        } catch (err: any) {
            console.error(err);
            setGeneratorError(err.message || 'Ошибка генерации');
        } finally {
            setGeneratorLoading(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopyStatus('Скопировано');
        } catch {
            setCopyStatus('Буфер недоступен');
        } finally {
            setTimeout(() => setCopyStatus(''), 2000);
        }
    };

    if (loading || !config) return <div>Загрузка конфига...</div>;

    const sections = ['character', 'somaticSense', 'perception', 'adapters'];

    return (
        <div style={{ padding: 10, background: '#1e1e1e', border: '1px solid #444', borderRadius: 8, height: '100%', overflowY: 'auto' }}>
            <h3>Конфигуратор промптов</h3>
            {sections.map(section => (
                <div key={section} style={{ marginBottom: 15 }}>
                    <h4 style={{ margin: '5px 0', textTransform: 'capitalize' }}>{section}</h4>
                    {Object.keys(config[section] || {}).map(key => (
                        <div key={key} style={{ marginBottom: 5 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold' }}>{key}</label>
                            {config[section][key].length > 50 ? (
                                <textarea 
                                    value={config[section][key]} 
                                    onChange={(e) => handleChange(section, key, e.target.value)}
                                    style={{ width: '100%', minHeight: 60, padding: 5, fontSize: 12 }}
                                />
                            ) : (
                                <input 
                                    type="text" 
                                    value={config[section][key]} 
                                    onChange={(e) => handleChange(section, key, e.target.value)}
                                    style={{ width: '100%', padding: 5, fontSize: 12 }}
                                />
                            )}
                        </div>
                    ))}
                </div>
            ))}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
                <button onClick={saveConfig} disabled={saving} style={{ padding: '8px 16px', cursor: 'pointer' }}>
                    {saving ? 'Сохранение...' : 'Сохранить и применить'}
                </button>
                {msg && <span style={{ fontSize: 12, color: msg.includes('Ошибка') ? 'red' : 'green' }}>{msg}</span>}
            </div>

            <div style={{ marginTop: 30, padding: 10, border: '1px solid #444', borderRadius: 8 }}>
                <h4 style={{ marginTop: 0 }}>Генератор персонажа / промта</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#ccc' }}>
                        Subject ID
                        <input
                            type="text"
                            value={generatorSubject}
                            onChange={e => setGeneratorSubject(e.target.value)}
                            style={{ marginTop: 4, padding: 5 }}
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#ccc' }}>
                        Seed (опционально)
                        <input
                            type="text"
                            value={generatorSeed}
                            onChange={e => setGeneratorSeed(e.target.value)}
                            style={{ marginTop: 4, padding: 5 }}
                        />
                    </label>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: 10 }}>
                    <input
                        type="checkbox"
                        checked={generatorApply}
                        onChange={e => setGeneratorApply(e.target.checked)}
                    />
                    Автоматически обновить карточку SillyTavern и world info
                </label>
                <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button onClick={runGenerator} disabled={generatorLoading} style={{ padding: '6px 12px' }}>
                        {generatorLoading ? 'Генерация...' : 'Собрать профиль'}
                    </button>
                    {generatorError && <span style={{ color: 'salmon', fontSize: 12 }}>{generatorError}</span>}
                    {copyStatus && <span style={{ color: '#0f0', fontSize: 12 }}>{copyStatus}</span>}
                </div>

                {generatorResult && (
                    <div style={{ marginTop: 15, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ fontSize: 12, color: '#aaa' }}>
                            Seed: <strong>{generatorResult.seed}</strong>
                            {generatorResult.stUpdate?.worldInfoName && (
                                <> · World Info: <strong>{generatorResult.stUpdate.worldInfoName}</strong></>
                            )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <strong>Выбранные теги:</strong>
                            {generatorResult.grouped && Object.entries(generatorResult.grouped).map(([level, tags]: [string, any[]]) => (
                                <div key={level} style={{ fontSize: 12 }}>
                                    <span style={{ textTransform: 'uppercase', color: '#999' }}>{level}:</span>{' '}
                                    {tags.map(tag => tag.title || tag.id).join(', ')}
                                </div>
                            ))}
                        </div>
                        {generatorResult.narrative && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <strong>Происхождение / история:</strong>
                                <div style={{ fontSize: 12, color: '#ccc' }}>
                                    {generatorResult.narrative.identityParagraphs?.map((p: string, idx: number) => (
                                        <p key={`id-${idx}`} style={{ margin: '4px 0' }}>{p}</p>
                                    ))}
                                    {generatorResult.narrative.historyParagraphs?.map((p: string, idx: number) => (
                                        <p key={`hist-${idx}`} style={{ margin: '4px 0' }}>{p}</p>
                                    ))}
                                    {generatorResult.narrative.activationParagraphs?.map((p: string, idx: number) => (
                                        <p key={`act-${idx}`} style={{ margin: '4px 0', fontStyle: 'italic' }}>{p}</p>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <strong>Профиль:</strong>
                            <textarea
                                readOnly
                                value={generatorResult.personaText}
                                style={{ width: '100%', minHeight: 120, marginTop: 5, background: '#111', color: '#fff', fontFamily: 'monospace' }}
                            />
                        </div>
                        <div>
                            <strong>Лор:</strong>
                            <textarea
                                readOnly
                                value={(generatorResult.loreNotes || []).join('\n\n')}
                                style={{ width: '100%', minHeight: 150, marginTop: 5, background: '#111', color: '#fff', fontFamily: 'monospace' }}
                            />
                        </div>
                        <div>
                            <strong>Системный промт:</strong>
                            <textarea
                                readOnly
                                value={generatorResult.systemPrompt}
                                style={{ width: '100%', minHeight: 160, marginTop: 5, background: '#090909', color: '#fff', fontFamily: 'monospace' }}
                            />
                            <button
                                onClick={() => copyToClipboard(generatorResult.systemPrompt)}
                                style={{ marginTop: 6, padding: '4px 8px', fontSize: 12 }}
                            >
                                Скопировать
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
