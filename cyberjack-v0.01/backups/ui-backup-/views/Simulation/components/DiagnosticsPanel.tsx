import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';

interface LogEntry {
    id: string;
    timestamp: number;
    type: 'system' | 'narrative' | 'math' | 'error';
    message: string;
    data?: any;
}

interface MathDiagnostic {
    id: string;
    formula: string;
    variables: Record<string, number>;
    result: number;
    description: string;
}

interface DiagnosticsPanelProps {
    logs: LogEntry[];
    mathDiagnostics: MathDiagnostic[];
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
    color: #ff00ff;
    text-transform: uppercase;
    font-size: 0.9rem;
    letter-spacing: 1px;
    border-bottom: 1px solid #333;
`;

const ScrollableContent = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    font-family: 'Courier New', Courier, monospace;
`;

const LogItem = styled.div<{ logType: string }>`
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
    line-height: 1.4;
    word-break: break-word;
    color: ${props => 
        props.logType === 'error' ? '#ff3333' :
        props.logType === 'system' ? '#888888' :
        props.logType === 'math' ? '#00ffff' :
        '#cccccc'};

    &::before {
        content: '${props => 
            props.logType === 'error' ? '[ERR]' :
            props.logType === 'system' ? '[SYS]' :
            props.logType === 'math' ? '[MTH]' :
            '[LOG]'} ';
        font-weight: bold;
    }
`;

const MathItem = styled.div`
    background: #1a1a1a;
    border: 1px solid #333;
    padding: 0.75rem;
    margin-bottom: 1rem;
    border-radius: 4px;
`;

const MathDesc = styled.div`
    color: #00ffff;
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
    font-weight: bold;
`;

const MathFormula = styled.div`
    background: #000;
    padding: 0.5rem;
    border-radius: 2px;
    font-family: monospace;
    font-size: 0.9rem;
    color: #fff;
    margin-bottom: 0.5rem;
`;

const MathVars = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.25rem;
    font-size: 0.8rem;
    color: #aaa;
`;

const MathVar = styled.div`
    display: flex;
    justify-content: space-between;
`;

const MathResult = styled.div`
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px dashed #333;
    display: flex;
    justify-content: space-between;
    font-weight: bold;
    color: #00ff00;
`;

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ logs, mathDiagnostics }) => {
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <PanelContainer>
            <Section>
                <SectionHeader>Math Diagnostics</SectionHeader>
                <ScrollableContent>
                    {mathDiagnostics.length > 0 ? (
                        mathDiagnostics.map(diag => (
                            <MathItem key={diag.id}>
                                <MathDesc>{diag.description}</MathDesc>
                                <MathFormula>{diag.formula}</MathFormula>
                                <MathVars>
                                    {Object.entries(diag.variables).map(([key, val]) => (
                                        <MathVar key={key}>
                                            <span>{key}:</span>
                                            <span style={{ color: '#fff' }}>{val.toFixed(2)}</span>
                                        </MathVar>
                                    ))}
                                </MathVars>
                                <MathResult>
                                    <span>Result:</span>
                                    <span>{diag.result.toFixed(2)}</span>
                                </MathResult>
                            </MathItem>
                        ))
                    ) : (
                        <div style={{ color: '#666', fontStyle: 'italic', fontSize: '0.85rem' }}>
                            Waiting for calculations...
                        </div>
                    )}
                </ScrollableContent>
            </Section>

            <Section>
                <SectionHeader>System Logs</SectionHeader>
                <ScrollableContent>
                    {logs.map(log => (
                        <LogItem key={log.id} logType={log.type}>
                            {new Date(log.timestamp).toLocaleTimeString()} - {log.message}
                        </LogItem>
                    ))}
                    <div ref={logsEndRef} />
                </ScrollableContent>
            </Section>
        </PanelContainer>
    );
};
