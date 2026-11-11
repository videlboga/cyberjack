import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

let wss: WebSocketServer;

export function initWebSocket(server: Server) {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        console.log('[WebSocket] Client connected');
        
        ws.on('message', (message) => {
            console.log(`[WebSocket] Received: ${message}`);
            // Здесь будем обрабатывать сообщения от Unity (например, клики игрока)
        });

        ws.on('close', () => {
            console.log('[WebSocket] Client disconnected');
        });
    });
    
    console.log('[WebSocket] Server initialized');
}

export function broadcastEvent(type: string, payload: any) {
    if (!wss) return;
    const data = JSON.stringify({ type, payload });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}
