import React, { useState, useEffect } from 'react';

const DatabaseView: React.FC = () => {
    const [characters, setCharacters] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const loadCharacters = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/characters');
            if (res.ok) {
                const data = await res.json();
                setCharacters(data.characters || []);
            }
        } catch (e) {
            console.error('Failed to load characters:', e);
        }
        setLoading(false);
    };

    const runGenerator = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/characters/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            if (res.ok) {
                alert('Сгенерирован и сохранён!');
                loadCharacters();
            } else {
                alert('Ошибка генерации');
            }
        } catch (e) {
            console.error(e);
            alert('Ошибка сети');
        } finally {
            setLoading(false);
        }
    };

    const deleteChar = async (id: string) => {
        if (!window.confirm('Delete ' + id + '?')) return;
        try {
            const res = await fetch(`/api/characters/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                loadCharacters();
            }
        } catch (e) {
            console.error(e);
        }
    }

    useEffect(() => {
        loadCharacters();
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <h2>База Персонажей (SQLite CRUD)</h2>
                <button onClick={loadCharacters} style={{ padding: '8px 16px', cursor: 'pointer', background: '#444', color: '#fff', border: 'none' }}>
                    Обновить
                </button>
            </div>

            <div style={{ display: 'flex', flex: 1, gap: '10px', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflow: 'auto', border: '1px solid #444', padding: '10px', background: '#222' }}>
                    <h3>Список Персонажей {loading && '(Загрузка...)'}</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '10px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #555' }}>
                                <th style={{ padding: '8px' }}>ID</th>
                                <th>Имя</th>
                                <th>Пол</th>
                                <th>Анатомия</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {characters.map(ch => (
                                <tr key={ch.id} style={{ borderBottom: '1px outset #333' }}>
                                    <td style={{ padding: '8px' }}>{ch.id}</td>
                                    <td>{ch.name}</td>
                                    <td>{ch.profile?.generatedProfile?.identity?.gender || ch.profile?.base?.gender || '—'}</td>
                                    <td>{ch.profile?.generatedProfile?.identity?.anatomy || ch.profile?.base?.anatomy || '—'}</td>
                                    <td>
                                        <button onClick={() => deleteChar(ch.id)} style={{ padding: '4px', cursor: 'pointer', background: '#a44', color: '#fff', border: '1px solid #722' }}>
                                            Удалить
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ width: '350px', border: '1px solid #444', padding: '10px', background: '#1c1f24', display: 'flex', flexDirection: 'column' }}>
                    <h3>Генератор профиля</h3>
                    <p style={{ fontSize: '13px', color: '#aaa' }}>Создаёт связный профиль из слотов происхождения, роли, психики и поведения и сохраняет его в SQLite.</p>
                    <button onClick={runGenerator} disabled={loading} style={{ padding: '12px', marginTop: '20px', cursor: 'pointer', background: '#2a6a4a', color: '#fff', border: '1px solid #28543f', fontWeight: 'bold' }}>
                        {loading ? 'Генерация...' : '+ Сгенерировать Нового'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DatabaseView;
