# Cyberjack API

This document lists the main API endpoints exposed by the engine/service.

Notes:
- Many endpoints expect JSON bodies.
- `pointId` is optional in several endpoints and when provided scopes context operations to a subject's specific point (slot). When omitted, operations may be global across subject points.

## Endpoints

### GET /api/contexts
Returns available action presets and active context IDs for a subject.

Request query parameters:
- subjectId (required)

Response (200):
{
  allPresets: Array<ActionPreset>,
  activeIds: Array<number>
}

### POST /api/contexts/toggle
Toggle a context (action preset) on or off for a subject. Accepts optional `pointId` to scope activation/removal to a single point.

Body:
{
  subjectId: number,
  contextId: number, // action preset id
  isActive: boolean,
  pointId?: number | null
}

Behavior:
- If `isActive` is true: apply the context to the subject. If `pointId` provided, it applies to that point.
- If `isActive` is false: remove the context. If `pointId` provided, removal is scoped to that point; otherwise removal is global (backwards compatible).

Response (200): { success: true }

### POST /api/tick
Trigger a game tick. Body and behavior depend on the tick controller. Typically used by the game loop.

Request body (example):
{
  subjectId: number,
  tickArgs?: object,
}

Response (200): { result: ... }

### Other routes
There are several other controllers implemented under `src/api/controllers/`:
- tickController (tick-related endpoints, /api/tick, /api/wait etc.)
- sceneController (scene management endpoints)
- playerController (player actions)
- metaController (meta endpoints)
- stateController (state queries and triggers)

For the UI, the most important behavior to note is that context toggles may be scoped to a `pointId` (slot) and that prompt assembly is handled by `prompts/*` using `event_logs` rather than by direct mutation inside controllers or the engine.

If you need a machine-readable OpenAPI spec, I can generate one from the controllers next.
