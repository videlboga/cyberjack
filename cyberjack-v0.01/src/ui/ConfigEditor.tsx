import React, { useState, useEffect } from 'react';

export function ConfigEditor() {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

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
        </div>
    );
}
