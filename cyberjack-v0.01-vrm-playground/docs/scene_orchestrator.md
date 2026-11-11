# Scene Orchestrator Design

## Goal
After each engine tick, determine which actors (subjects/NPCs) should speak or act (reactively or proactively) and how the narrator describes the scene. Actions are not limited to player stimuli—any character or scenario event can be the source.

## Inputs
- `TickBundle`: engine output with core/point states, last action (intensity, valence, command), and initiator info.
- Scene participants: `scene.characters` plus their relations (`characterRelationRepo`).
- Active contexts (from `activeContextsRepo`).
- Recent event log summary (novelty/streaks).
- `activeConfig.orchestrator`: base probabilities and modifiers.

## Probability Model
### Normalize helper
to map parameter 
```math
normalize(x) = (x - min) / (max - min)
```

### Reactive probability
```
P_reactive = baseReactive
           + k_intensity   * normalize(lastAction.intensity)
           + k_stress      * (1 - capacity_norm)
           + k_relation    * (1 - relation_to_initiator_norm)
           + k_context
```

### Proactive probability
```
P_proactive = baseProactive
            + k_relCalib * relation_to_calibrator_norm
            + k_relPeers * avg(relations_to_present_peers)
            + k_sensitivity * sensitivity_norm
            + k_context
```
All probabilities are clamped to [0,1]. Coefficients live in config and may be extended.

### Tone / valence selection
- Reactive tone: combine last action valence (from engine or classifier) and relation to initiator.
- Proactive tone: derived from relation to intended target (default calibrator) and overall attitude.
- Tone categories (e.g., `support`, `neutral`, `hostile`) convert to prompt instructions like “говори мягко”, “говори холодно и угрожающе”.

### Context modifiers
- Active restraints, humiliation, or overstimulation adjust `k_context` terms.
- Local sensitivity/overload raise reactive probability for those body points.

## Narrator
- Narrator gets separate `narratorPrompt` (state + recent logs + instructions).
- Probability often = 1, but can be reduced when nothing significant happens.

## Orchestrated turn structure
```
interface ActorDecision {
  actorId: string;
  kind: 'reactive' | 'proactive';
  reason?: string; // selected tone/trigger
}
interface OrchestratedTurn {
  narrator?: NarratorDecision;
  actorDecisions: ActorDecision[];
}
```

## LLM Calls
- Each `ActorDecision` -> individual `PromptPayload` + `sendToSillyTavern`.
- Narrator -> `sendNarratorDescription` with `NarratorPromptPayload`.
- Optionally include tone guidance in prompts.

## API / UI
- `/api/tick` should return `responses: [{ actorId, name, kind, speech, tone }]` and `narratorReaction`.
- Front-end displays narrator first, then each actor response (with actor name and whether it was reactive/proactive).
- Chat memory stores narrator output separately, actor speeches as assistant entries.

## Config additions
```
orchestrator: {
  baseReactiveProbability: number;
  baseProactiveProbability: number;
  sensitivityModifier: number;
  attitudeModifier: number;
  // possible extensions: intensity, context, silenceStreak modifiers
}
```

## Extensions
- Use classifier labels for player speech (`threat`, `comfort`, etc.) to inform NPC tone.
- Additional modifiers for long silence (increase proactivity) or repeated actions (fatigue).
- Guard rails for restraints (no proactive physical actions if movement blocked).

Implementation roadmap:
1. Expand `sceneOrchestrator` to compute probabilities per actor using above formulas.
2. Integrate orchestrator into `/api/tick` – sample decisions, call LLMs, aggregate replies.
3. Update front-end to show narrator + multiple actors.
4. Iterate on coefficients and context modifiers based on testing.
