import React, { useEffect, useState } from 'react';

const API_BASE = '';

const pretty = (obj: any) => {
    try { return JSON.stringify(obj, null, 2); } catch (e) { return String(obj); }
}

const LogsView: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [intervalMs, setIntervalMs] = useState<number>(2000);

    const fetchLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/diagnostics`);
            const body = await res.json();
            if (body && body.success) {
                setData(body);
            } else {
                setError(body?.error || 'no-data');
            }
        } catch (e: any) {
            setError(e?.message || String(e));
        } finally { setLoading(false); }
    };

    useEffect(() => {
        fetchLogs();
        if (intervalMs > 0) {
            const t = setInterval(fetchLogs, intervalMs);
            return () => clearInterval(t);
        }
    }, [intervalMs]);

    return (
        <div style={{ color: '#eee', fontFamily: 'monospace', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingBottom: 10 }}>
                <button onClick={fetchLogs} style={{ padding: '6px 10px' }}>Refresh</button>
                <label style={{ fontSize: '0.9rem' }}>Poll ms:</label>
                <input value={String(intervalMs)} onChange={e => setIntervalMs(Number(e.target.value || 0))} style={{ width: 100 }} />
                <div style={{ marginLeft: 'auto', opacity: 0.8 }}>{loading ? 'Loading...' : (error ? `Error: ${error}` : 'OK')}</div>
            </div>

            <div style={{ display: 'flex', gap: 12, height: '100%' }}>
                <div style={{ flex: 1, overflow: 'auto', border: '1px solid #333', padding: 10, background: '#0f0f0f' }}>
                    <h4 style={{ marginTop: 0, color: '#8ef' }}>Prompt payload</h4>
                    <pre style={{ whiteSpace: 'pre-wrap', color: '#cfc' }}>{pretty(data?.prompt)}</pre>
                </div>

                <div style={{ flex: 1, overflow: 'auto', border: '1px solid #333', padding: 10, background: '#0f0f0f' }}>
                    <h4 style={{ marginTop: 0, color: '#8ef' }}>Engine result / diagnostics</h4>
                    <pre style={{ whiteSpace: 'pre-wrap', color: '#cfc' }}>{pretty(data?.result)}</pre>
                </div>

                <div style={{ flex: 1, overflow: 'auto', border: '1px solid #333', padding: 10, background: '#0f0f0f' }}>
                    <h4 style={{ marginTop: 0, color: '#8ef' }}>Orchestrator (extracted)</h4>
                    <pre style={{ whiteSpace: 'pre-wrap', color: '#cfc' }}>{pretty(data?.result?.diagnostics?.orchestrator || data?.result?.diagnostics)}</pre>
                </div>
            </div>
        </div>
    );
};

export default LogsView;
