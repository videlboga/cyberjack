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

    const [currentProfile, setCurrentProfile] = useState<any>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileStatus, setProfileStatus] = useState('');

    const [copyStatus, setCopyStatus] = useState('');

    useEffect(() => {
        fetch('http://localhost:3001/api/config')
            .then(res => res.json())
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
            if (res.ok) {
                setMsg('Сохранено');
            } else {
                setMsg('Ошибка сохранения');
            }
        } catch (err) {
            console.error(err);
            setMsg('Ошибка сохранения');
        } finally {
            setSaving(false);
            setTimeout(() => setMsg(''), 2500);
        }
    };

    const loadActiveProfile = async (subjectOverride?: string) => {
        const targetId = subjectOverride || generatorSubject;
        if (!targetId) return;
        setProfileLoading(true);
        setProfileStatus('');
        try {
            const res = await fetch(`http://localhost:3001/api/characters/profile?subjectId=${encodeURIComponent(targetId)}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Не удалось загрузить профиль');
            setCurrentProfile({ ...data.profile, subjectId: data.subjectId || targetId });
            const updated = data.profile?.updatedAt ? new Date(data.profile.updatedAt).toLocaleString() : new Date().toLocaleString();
            setProfileStatus(`Обновлено: ${updated}`);
        } catch (err: any) {
            console.error(err);
            setProfileStatus(err.message || 'Ошибка загрузки профиля');
        } finally {
            setProfileLoading(false);
        }
    };

    useEffect(() => {
        loadActiveProfile();
    }, []);

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
            if (data.profile) {
                setCurrentProfile({ ...data.profile, subjectId: data.subjectId || generatorSubject });
                setProfileStatus('Профиль обновлён после генерации');
            } else {
                loadActiveProfile(generatorSubject);
            }
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

    const getValue = (section: string, key: string) => config?.[section]?.[key] ?? '';

    const renderReadOnly = (label: string, text: string, minHeight = 90) => (
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, gap: 4 }}>
            <span style={{ fontWeight: 'bold', color: '#ccc' }}>{label}</span>
            <textarea
                readOnly
                value={text}
                style={{ width: '100%', minHeight, padding: 6, fontSize: 12, background: '#0d0d0d', color: '#fff', border: '1px solid #333', borderRadius: 4 }}
            />
        </label>
    );

    const renderCharacterField = (key: string, label: string, minHeight = 100) => (
        <label key={key} style={{ display: 'flex', flexDirection: 'column', fontSize: 12, gap: 4 }}>
            <span style={{ fontWeight: 'bold', color: '#ccc' }}>{label}</span>
            <textarea
                value={getValue('character', key)}
                onChange={e => handleChange('character', key, e.target.value)}
                style={{ width: '100%', minHeight, padding: 6, fontSize: 12, background: '#131313', color: '#fff', border: '1px solid #333', borderRadius: 4 }}
            />
        </label>
    );

    const renderAdvancedSection = (section: string, title: string) => (
        <details key={section} style={{ marginBottom: 14 }} open={section === 'somaticSense'}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#ddd', marginBottom: 6 }}>{title}</summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {Object.keys(config[section] || {}).map(key => (
                    <label key={key} style={{ display: 'flex', flexDirection: 'column', fontSize: 11, gap: 2 }}>
                        <span style={{ color: '#999' }}>{key}</span>
                        <textarea
                            value={config[section][key]}
                            onChange={e => handleChange(section, key, e.target.value)}
                            style={{ minHeight: 50, padding: 4, background: '#111', color: '#fff', border: '1px solid #333', borderRadius: 4 }}
                        />
                    </label>
                ))}
            </div>
        </details>
    );

    const activeProfileBlock = currentProfile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {currentProfile.identityText && renderReadOnly('Identity', currentProfile.identityText, 80)}
            {currentProfile.historyText && renderReadOnly('History', currentProfile.historyText, 110)}
            {renderReadOnly('Persona', currentProfile.personaText || '', 130)}
            {renderReadOnly('Лор', (currentProfile.loreNotes || []).join('\n\n'), 140)}
            {(() => {
                const stPrefix = config.adapters?.sillyTavernSystemPrefix || '';
                const systemText = `${stPrefix}${stPrefix ? '\n' : ''}${currentProfile.systemPrompt || ''}`;
                return (
                    <div>
                        {renderReadOnly('Системный промт', systemText, 160)}
                        <button onClick={() => copyToClipboard(systemText)} style={{ marginTop: 6, padding: '4px 8px', fontSize: 12 }}>
                            Скопировать системный промт
                        </button>
                    </div>
                );
            })()}
        </div>
    ) : (
        <p style={{ fontSize: 12, color: '#aaa' }}>Профиль ещё не загружен. Нажмите «Обновить активный профиль».</p>
    );

    return (
        <div className="config-editor" style={{ padding: 16, background: '#161616', border: '1px solid #333', borderRadius: 10, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section style={{ background: '#1e1e1e', borderRadius: 8, padding: 12, border: '1px solid #373737' }}>
                <h3 style={{ marginTop: 0 }}>Конфигуратор промптов</h3>
                <p style={{ fontSize: 12, color: '#aaa' }}>Выберите персонажа, обновите активный профиль и соберите новую карточку. Ниже — редактор fallback-конфига.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#ccc' }}>
                        Subject ID
                        <input
                            type="text"
                            value={generatorSubject}
                            onChange={e => setGeneratorSubject(e.target.value)}
                            style={{ marginTop: 4, padding: 6, background: '#111', color: '#fff', border: '1px solid #333', borderRadius: 4 }}
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#ccc' }}>
                        Seed (опционально)
                        <input
                            type="text"
                            value={generatorSeed}
                            onChange={e => setGeneratorSeed(e.target.value)}
                            style={{ marginTop: 4, padding: 6, background: '#111', color: '#fff', border: '1px solid #333', borderRadius: 4 }}
                        />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#ccc', marginTop: 4 }}>
                        <input type="checkbox" checked={generatorApply} onChange={e => setGeneratorApply(e.target.checked)} />
                        Обновлять SillyTavern
                    </label>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                    <button onClick={() => loadActiveProfile()} disabled={profileLoading} style={{ padding: '6px 12px' }}>
                        {profileLoading ? 'Загрузка...' : 'Обновить активный профиль'}
                    </button>
                    <button onClick={runGenerator} disabled={generatorLoading} style={{ padding: '6px 12px' }}>
                        {generatorLoading ? 'Генерация...' : 'Собрать новый профиль'}
                    </button>
                    {generatorError && <span style={{ color: 'salmon', fontSize: 12 }}>{generatorError}</span>}
                    {profileStatus && (
                        <span style={{ color: profileStatus.includes('Ошибка') ? 'salmon' : '#0f0', fontSize: 12 }}>{profileStatus}</span>
                    )}
                    {copyStatus && <span style={{ color: '#0f0', fontSize: 12 }}>{copyStatus}</span>}
                </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <section style={{ background: '#1e1e1e', padding: 12, borderRadius: 8, border: '1px solid #373737' }}>
                    <h4 style={{ marginTop: 0 }}>Активный промт · {currentProfile?.subjectId || generatorSubject}</h4>
                    {activeProfileBlock}
                </section>
                <section style={{ background: '#1e1e1e', padding: 12, borderRadius: 8, border: '1px solid #373737' }}>
                    <h4 style={{ marginTop: 0 }}>Последняя генерация</h4>
                    {generatorResult ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ fontSize: 12, color: '#aaa' }}>
                                Seed: <strong>{generatorResult.seed}</strong>
                                {generatorResult.stUpdate?.worldInfoName && (
                                    <> · World Info: <strong>{generatorResult.stUpdate.worldInfoName}</strong></>
                                )}
                            </div>
                            {generatorResult.grouped && (
                                <div style={{ fontSize: 12 }}>
                                    <strong>Теги:</strong>
                                    {Object.entries(generatorResult.grouped).map(([level, tags]) => (
                                        <div key={level} style={{ marginLeft: 6, color: '#ccc' }}>
                                            {level.toUpperCase()}: {(tags as any[]).map(tag => tag.title || tag.id).join(', ')}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {generatorResult.narrative && (
                                <div style={{ fontSize: 12, color: '#ccc' }}>
                                    <strong>Нарратив:</strong>
                                    {[...(generatorResult.narrative.identityParagraphs || []), ...(generatorResult.narrative.historyParagraphs || [])].map(
                                        (p: string, idx: number) => (
                                            <p key={idx} style={{ margin: '4px 0' }}>
                                                {p}
                                            </p>
                                        )
                                    )}
                                </div>
                            )}
                            {renderReadOnly('Persona', generatorResult.personaText || '', 110)}
                            {renderReadOnly('Лор', (generatorResult.loreNotes || []).join('\n\n'), 130)}
                            {renderReadOnly('Системный промт', generatorResult.systemPrompt || '', 150)}
                        </div>
                    ) : (
                        <p style={{ fontSize: 12, color: '#aaa' }}>Соберите профиль, чтобы увидеть свежие данные генератора.</p>
                    )}
                </section>
            </div>

            <section style={{ background: '#1e1e1e', padding: 12, borderRadius: 8, border: '1px solid #373737' }}>
                <h4 style={{ marginTop: 0 }}>Базовый шаблон (fallback)</h4>
                <p style={{ fontSize: 12, color: '#aaa' }}>
                    Эти поля используются как резервный источник, когда для персонажа нет сгенерированного профиля. Здесь же задаём формат ответа.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {renderCharacterField('identity', 'Identity')}
                    {renderCharacterField('history', 'History')}
                    {renderCharacterField('lore', 'Lore', 150)}
                    {renderCharacterField('formatInstructions', 'Format Instructions', 170)}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
                    <button onClick={saveConfig} disabled={saving} style={{ padding: '8px 16px' }}>
                        {saving ? 'Сохранение...' : 'Сохранить изменения'}
                    </button>
                    {msg && <span style={{ fontSize: 12, color: msg.includes('Ошибка') ? 'salmon' : '#0f0' }}>{msg}</span>}
                </div>
            </section>

            <section style={{ background: '#1e1e1e', padding: 12, borderRadius: 8, border: '1px solid #373737' }}>
                <h4 style={{ marginTop: 0 }}>Расширенные настройки</h4>
                <p style={{ fontSize: 12, color: '#aaa' }}>Ниже — детальные описания состояний, журнал воздействия и параметры интеграций.</p>
                {[
                    { key: 'somaticSense', title: 'Телесные описания и состояния' },
                    { key: 'perception', title: 'Журнал событий / восприятие' },
                    { key: 'adapters', title: 'Интеграции и адаптеры' }
                ].map(section => renderAdvancedSection(section.key, section.title))}
            </section>
        </div>
    );
}
