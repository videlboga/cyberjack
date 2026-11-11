#!/usr/bin/env node
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';

const PORT = process.env.ANIMATION_INTENT_PORT ? Number(process.env.ANIMATION_INTENT_PORT) : 8081;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', pid: process.pid }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

function sampleIntent(tick = 0) {
  // Simple deterministic sample intent that varies over time.
  const openness = 0.5 + 0.5 * Math.sin(tick / 10);
  const tension = 0.5 + 0.5 * Math.cos(tick / 13);
  const intensity = Math.abs(Math.sin(tick / 7));
  const valence = Math.sin(tick / 11);
  const intent = {
    type: 'sync_animator',
    payload: {
      poseId: 'standing',
      idle: {
        openness: Number(openness.toFixed(3)),
        tension: Number(tension.toFixed(3))
      },
      reaction: {
        targetPoint: 'chest',
        valence: Number(valence.toFixed(3)),
        intensity: Number(intensity.toFixed(3)),
        direction: intensity > 0.5 ? 'away' : 'towards',
        duration: 0.8
      },
      attention: {
        target: 'actor_face',
        eyeContact: Number(Math.max(0, Math.cos(tick / 19)).toFixed(3))
      }
    }
  };
  return intent;
}

let tick = 0;

wss.on('connection', (ws, req) => {
  const addr = req.socket.remoteAddress + ':' + req.socket.remotePort;
  console.log('[ws] client connected', addr);

  ws.send(JSON.stringify({ type: 'welcome', now: Date.now() }));

  const interval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return clearInterval(interval);
    const payload = sampleIntent(tick++);
    ws.send(JSON.stringify(payload));
  }, 1000);

  ws.on('close', () => {
    console.log('[ws] client disconnected', addr);
    clearInterval(interval);
  });
});

server.listen(PORT, () => {
  console.log(`AnimationIntent server listening on ws://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
