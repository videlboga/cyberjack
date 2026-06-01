Animation Intent WebSocket Server

Quick dev helper that broadcasts a sample `AnimationIntent` payload every second to connected WebSocket clients.

How to run

1. From the repository root, install dependencies if you haven't already:

   npm install

2. Run the server (Node 18+ recommended):

   ANIMATION_INTENT_PORT=8081 node ./scripts/animation_intent_server.mjs

3. Check health:

   curl http://localhost:8081/health

4. Connect a WebSocket client to ws://localhost:8081 and observe JSON payloads.

Test client

There's a tiny test client below you can run with Node to connect and print messages.
