# Unity Integration & Architecture Coverage

## 1. Current Coverage (What is already seamlessly working)

- **Entity & Anatomy Identification:** Through the `BodyPartUIAnchor` in Unity, the C# engine now understands the structure of "Character" (`subjectId`) and "Body Part/Node" (`partId`).
- **State Reading & Data Binding:** Unity, via the CEF browser overlay, dynamically pulls local statistics (Sensitivity, Attitude), player resources, and event logs from the TS-backend correctly mapped to specific character nodes.
- **Action Triggers:** Radially triggered commands initiated through the Unity Raycaster (`window.CyberjackUI.showRadialMenu`) properly serialize into the `/api/tick` endpoint allowing backend systems to process complex engine logic.

## 2. Gaps and Forgotten Elements (What we need to cover)

**A. The Player as a Target (Targeting the Player)**
NPCs are driven by an AI Orchestrator that dictates proactive actions (`ActorDecision` -> `mechanicalAction`). NPCs could attack or interact with the player (`PL-1`). 
- **Problem:** In Unity, the player currently possesses no recognizable "body" for the Raycaster or the interaction logic. If an NPC acts upon the Player, the backend logs it, but Unity visually ignores it.

**B. One-Way Communication (Unity -> JS works, but JS -> Unity does not)**
We execute commands in Unity, bringing up the browser menu to tell the backend to process a tick.
- **Problem:** Unity is blind to the outcome of the tick. When an NPC executes an action (reactively or proactively), Unity needs to play animations, audio, or camera effects. Unity needs a bridge to receive state changes back from the JS framework.

**C. Movement Sync (Scenes & Slots)**
The engine physically separates areas by `slotId` (`SceneLayout`). Many physical actions are blocked if the player and the subject are in different slots.
- **Problem:** Using standard controller movement (WASD) in Unity doesn't update the `slotId` on the backend. The backend might think the player is elsewhere and block actions incorrectly.

**D. Visualizing Contexts & Restraints**
The engine uses profound rules restricting actions if arms are tied, or if they are wearing certain clothing (`ContextConfig`).
- **Problem:** If a character is handcuffed on the backend, Unity does not update its 3D model. The UI simply greys out the action, but it creates a visual disconnect.

## 3. Implementation Plan for Unity

**Step 1: `PlayerBodyManager`**
- Create `BodyPartUIAnchor` colliders on the player object (First person camera or body bounds) where `subjectId = "PL-1"`.
- Update `InteractionManager.cs` to prevent opening the action radial menu if clicking `PL-1`, but still relay hover info. This completes targeting hooks for the player.

**Step 2: Return Bridge `JSBridge` (React -> Unity)**
- Utilize `VoltstroStudios.UnityWebBrowser` JS to C# interop.
- Formulate a JSON payload payload on React's end upon successful `/api/tick` resolution.
- Construct `EventRouter.cs` in Unity to parse the `sourceId`, `targetId`, and `actionId` to map them directly to `Animator.SetTrigger(actionId)` or Screen Shake methods.

**Step 3: Zone Triggers (Slots Sync)**
- Deploy `BoxCollider` components with `IsTrigger` true around key Scene slots in Unity.
- Create a `SectorTrigger.cs` to notify the JS interop when the player enters the zone, allowing `GameApp.ts` to sync the current `slotId` and unblock relevant physical actions.