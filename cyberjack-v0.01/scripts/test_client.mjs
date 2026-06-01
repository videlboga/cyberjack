#!/usr/bin/env node
import WebSocket from 'ws';

const url = process.argv[2] || 'ws://localhost:8081';

const ws = new WebSocket(url);
ws.on('open', () => {
  console.log('[client] connected to', url);
});
ws.on('message', (data) => {
  try {
    const d = JSON.parse(data.toString());
    console.log('[client] received:', JSON.stringify(d, null, 2));
  } catch (e) {
    console.log('[client] raw message:', data.toString());
  }
});
ws.on('close', () => console.log('[client] closed'));
ws.on('error', (err) => console.error('[client] error', err.message));
