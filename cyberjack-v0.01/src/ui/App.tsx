import React, { useState, useEffect } from 'react';

export default function App() {
    const [engineState, setEngineState] = useState<any>(null);
    const [diagnostics, setDiagnostics] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch('http://localhost:3001/api/state')
            .then(res => res.json())
            .then(data => setEngineState(data))
            .catch(console.error);
    }, []);

    const performAction = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:3001/api/tick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // Выдаем какое-нибудь позитивное и сильное действие
                    action: { intensity: 0.8, valence: 0.9, contact: 0.7, sharpness: 0.1, novelty: 0.6 }
                })
            });
            const data = await response.json();
            if (data.success) {
                setEngineState(data.result);
                // Если захотим - можно вытащить еще и семантику
            } else {
                alert(`Ошибка: ${data.error}`);
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            <h1 style={{ color: '#2ecc71' }}>Симулятор Движка CyberJack</h1>
            <p>React-интерфейс, подключенный к ядру Node.js/SQLite</p>
            
            <button 
                onClick={performAction} 
                disabled={loading}
                style={{ 
                    padding: '12px 24px', 
                    cursor: 'pointer', 
                    fontSize: '16px', 
                    background: '#3498db', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px',
                    marginBottom: '20px'
                }}
            >
                {loading ? 'Обработка симуляции...' : '▶ Запустить тик движка (Тестовое действие)'}
            </button>

            <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: 1, padding: '15px', background: '#2c3e50', color: '#ecf0f1', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0, color: '#e74c3c' }}>Ядро Субъекта (После тика)</h3>
                    {engineState?.nextCore ? (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            <li>⚡ Чувствительность: {engineState.nextCore.sensitivity.toFixed(2)}</li>
                            <li>🔋 Выносливость: {engineState.nextCore.capacity.toFixed(2)}</li>
                            <li>📖 Открытость: {engineState.nextCore.openness.toFixed(2)}</li>
                            <li>🧬 Пластичность: {engineState.nextCore.plasticity.toFixed(2)}</li>
                            <li>💖 Отношение: {engineState.nextCore.attitude.toFixed(2)}</li>
                        </ul>
                    ) : (
                        <p>Тик ещё не выполнялся.</p>
                    )}
                </div>

                <div style={{ flex: 1, padding: '15px', background: '#2c3e50', color: '#ecf0f1', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0, color: '#f1c40f' }}>Вычисленные Изменения (Дельта)</h3>
                    {engineState?.result ? (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            <li>Полученное удовольствие: {engineState.result.pleasure?.toFixed(4)}</li>
                            <li>Полученный дискомфорт: {engineState.result.discomfort?.toFixed(4)}</li>
                            <li>Показатель перегрузки: {engineState.result.overload?.toFixed(4)}</li>
                            <li>Уровень вовлеченности: {engineState.result.engagement?.toFixed(4)}</li>
                            <li>Эффект обучения (Память): {engineState.result.learningEffect?.toFixed(4)}</li>
                        </ul>
                    ) : (
                        <p>Нет вычисленных данных.</p>
                    )}
                </div>
            </div>

            <div style={{ marginTop: '20px', padding: '10px', background: '#ecf0f1', color: '#333', borderRadius: '4px' }}>
                <h4>Сырые данные (JSON Dump):</h4>
                <pre style={{ fontSize: '12px', overflowX: 'auto' }}>{JSON.stringify(engineState, null, 2)}</pre>
            </div>
        </div>
    );
}
