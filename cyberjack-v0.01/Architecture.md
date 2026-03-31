# **Architecture**

## **1\. Purpose**

This project is a simulation-driven narrative game built around one core principle:

**an interaction engine calculates how a subject changes under influence, while higher-level systems decide why that matters in the world.**

At the current stage, the project has only the core engine. Everything else should be built *around* it, not mixed into it.

The architecture must preserve this separation.

---

## **2\. Core design principle**

The system is split into four layers:

1. **Core Interaction Engine**  
   * Calculates one simulation tick for one subject.  
   * Knows only state, action vectors, formulas, and deltas.  
2. **Scenario / Meta Engine**  
   * Handles player progression, station management, resources, access, missions, factions, and scenes.  
   * Decides what is available, what costs resources, and what changes in the world.  
3. **Expression / Presentation Layer**  
   * UI, narrative rendering, SillyTavern integration, prompt building, visual and sound output.  
   * Never acts as source of truth.  
4. **Persistence Layer**  
   * Stores subjects, player state, scenes, event logs, presets, contexts, and world state.

**Important:**

* The core engine is the source of truth for subject change.  
* Scenario systems are the source of truth for world progression.  
* SillyTavern is only a dialogue / expression layer.

---

## **3\. Current project status**

Right now the repository contains the **core engine** only.

That core is already good enough to treat as a stable foundation.

Current core responsibilities:

* normalize input  
* validate input  
* compute one reaction tick  
* apply learning  
* return new state, delta, and debug metadata

Current core exports:

* `computeResult(action, core, point, config)`  
* `applyLearning(core, point, action, result, config)`  
* `runTick({ action, core, point, config })`  
* `buildInterpretation(result)`

The rest of the project should call into this engine, not reimplement its logic.

---

## **4\. Core engine contract**

### **4.1 `CompiledAction`**

Everything that reaches the engine must be reduced to an abstract action vector.

type CompiledAction \= {  
  actionKey: string;  
  label: string;  
  type: "physical" | "verbal" | "context" | "system";

  intensity: number;   // 0..1  
  valence: number;     // \-1..1  
  contact: number;     // 0..1  
  sharpness: number;   // 0..1  
  novelty: number;     // 0..1

  tags?: string\[\];  
  source?: {  
    rawText?: string;  
    presetId?: string;  
    parserVersion?: string;  
  };  
};

### **4.2 `SubjectCoreState`**

type SubjectCoreState \= {  
  sensitivity: number; // 0..100  
  capacity: number;    // 0..100  
  openness: number;    // 0..100  
  plasticity: number;  // 0..100  
  attitude: number;    // 0..100  
};

### **4.3 `SubjectPointState`**

type SubjectPointState \= {  
  pointId: string;  
  localSensitivity: number; // 0..100  
  localAttitude: number;    // 0..100  
  familiarity?: number;  
  exposureCount?: number;  
};

### **4.4 `TickInput`**

type TickInput \= {  
  subjectId: string;  
  pointId: string;  
  action: CompiledAction;  
  core: SubjectCoreState;  
  point: SubjectPointState;  
  config?: EngineConfig;  
  meta?: {  
    tickId?: string;  
    sourceType?: "ui\_action" | "verbal" | "context" | "system";  
    sourceId?: string;  
    sceneId?: string;  
    timestamp?: string;  
  };  
};

### **4.5 `TickResult`**

type TickResult \= {  
  effectiveSensitivity: number;  
  effectiveAttitude: number;  
  attitudeShift: number;  
  finalValence: number;

  experiencedIntensity: number;  
  pleasure: number;  
  discomfort: number;  
  overload: number;  
  engagement: number;  
  learningEffect: number;  
};

### **4.6 `TickOutput`**

type TickOutput \= {  
  result: TickResult;  
  nextCore: SubjectCoreState;  
  nextPoint: SubjectPointState;  
  delta: {  
    core: Partial\<Record\<keyof SubjectCoreState, number\>\>;  
    point: Partial\<Record\<keyof SubjectPointState, number\>\>;  
  };  
  tickMeta: TickMeta;  
};

### **4.7 `TickMeta`**

type TickMeta \= {  
  inputs: {  
    action: CompiledAction;  
    core: SubjectCoreState;  
    point: SubjectPointState;  
  };  
  derived: {  
    effectiveSensitivity: number;  
    effectiveAttitude: number;  
    attitudeShift: number;  
    attitudePower: number;  
  };  
  formulas: Record\<string, string\>;  
};

---

## **5\. What the core engine does not do**

The engine must **not**:

* decide whether an action is allowed  
* decide which scene is active  
* handle player resources  
* know about factions or missions  
* know about SillyTavern  
* know about UI layout  
* parse natural language directly  
* store anything in the database

Those responsibilities belong to higher layers.

---

## **6\. Main domain entities**

## **6.1 PlayerState**

The player is not an abstract tormentor. The player is a station employee with constraints.

type PlayerState \= {  
  id: string;  
  name: string;  
  role: string;

  resources: {  
    credits: number;  
    materials: number;  
    authority: number;  
    reputation: number;  
    influence: number;  
    timeBudget?: number;  
  };

  labState: LabState;

  socialState: {  
    factionRelations: Record\<string, number\>;  
    activeContacts: string\[\];  
    flags: string\[\];  
  };

  rosterState: {  
    controlledSubjectIds: string\[\];  
    assignedSubjectIds: string\[\];  
    availableSubjectSlots: number;  
  };

  progression: {  
    rank: number;  
    unlocks: string\[\];  
    flags: string\[\];  
  };

  currentSceneId?: string;  
};

## **6.2 LabState**

type LabState \= {  
  level: number;  
  modules: string\[\];  
  equipmentIds: string\[\];  
  upgrades: string\[\];  
  activeConditions: string\[\];

  capacity: {  
    subjectSlots: number;  
    contextSlots: number;  
    equipmentSlots: number;  
  };

  restrictions: string\[\];  
};

## **6.3 Subject**

type Subject \= {  
  id: string;  
  name: string;  
  status: "active" | "inactive" | "lost" | "transferred" | "isolated";  
  sceneId?: string;

  coreState: SubjectCoreState;

  characterProfile: {  
    stCharacterId?: string;  
    promptProfileId?: string;  
    temperament?: string;  
    speechStyle?: string;  
  };

  meta: {  
    tags: string\[\];  
    diagnostics: string\[\];  
    flags: string\[\];  
  };  
};

## **6.4 SubjectPointStateRecord**

type SubjectPointStateRecord \= {  
  subjectId: string;  
  pointId: string;  
  state: SubjectPointState;  
  updatedAt: string;  
};

## **6.5 SubjectActionMemory**

type SubjectActionMemory \= {  
  subjectId: string;  
  actionKey: string;  
  affinity: number;  
  familiarity: number;  
  exposureCount: number;  
  lastUsedAt?: string;  
};

## **6.6 SubjectComboMemory**

type SubjectComboMemory \= {  
  subjectId: string;  
  actionKey: string;  
  pointId: string;  
  affinity: number;  
  familiarity: number;  
  exposureCount: number;  
};

## **6.7 ActionPreset**

type ActionPreset \= {  
  id: string;  
  label: string;  
  type: "physical" | "verbal\_template" | "context" | "system";  
  baseVector: {  
    intensity: number;  
    valence: number;  
    contact: number;  
    sharpness: number;  
    novelty?: number;  
  };  
  tags: string\[\];  
  uiMeta?: {  
    category?: string;  
    visible?: boolean;  
    icon?: string;  
  };  
};

## **6.8 PointPreset**

type PointPreset \= {  
  id: string;  
  label: string;  
  defaults: {  
    localSensitivity: number;  
    localAttitude: number;  
  };  
  tags: string\[\];  
};

## **6.9 ContextPreset**

Persistent environmental / equipment / pose effects.

type ContextPreset \= {  
  id: string;  
  label: string;  
  type: "pose" | "clothing" | "equipment" | "environment" | "social";  
  persistentVector: {  
    intensity: number;  
    valence: number;  
    contact: number;  
    sharpness: number;  
  };  
  stackingRules?: {  
    group?: string;  
    exclusive?: boolean;  
    maxStacks?: number;  
  };  
  tags?: string\[\];  
};

## **6.10 ActiveContext**

type ActiveContext \= {  
  subjectId: string;  
  contextId: string;  
  enabled: boolean;  
  intensityModifier?: number;  
  params?: Record\<string, unknown\>;  
  startedAt: string;  
  updatedAt: string;  
};

## **6.11 Mission**

type Mission \= {  
  id: string;  
  issuerType: "faction" | "station" | "npc" | "system";  
  issuerId?: string;  
  title: string;  
  description: string;  
  state: "available" | "active" | "completed" | "failed";  
  objectives: MissionObjective\[\];  
  rewards: MissionReward\[\];  
  penalties?: MissionPenalty\[\];  
  conditions?: {  
    requiredFlags?: string\[\];  
    minRelations?: Record\<string, number\>;  
    requiredResources?: Record\<string, number\>;  
  };  
  sceneHooks?: {  
    startSceneId?: string;  
    endSceneId?: string;  
  };  
};

## **6.12 FactionState**

type FactionState \= {  
  factionId: string;  
  relation: number;  
  trust: number;  
  accessLevel: number;  
  flags: string\[\];  
};

## **6.13 Scene**

type Scene \= {  
  id: string;  
  type: "vn\_node" | "interaction\_room" | "transition" | "event" | "hub";  
  title: string;  
  description?: string;

  activeSubjectIds: string\[\];  
  activeContextIds: string\[\];  
  availableActionIds: string\[\];

  entryConditions?: Condition\[\];  
  exitConditions?: Condition\[\];  
  transitions?: SceneTransition\[\];

  narrativeMeta?: {  
    stMode?: string;  
    textTemplateId?: string;  
    uiLayout?: string;  
  };  
};

## **6.14 WorldState**

type WorldState \= {  
  currentDay?: number;  
  stationFlags: string\[\];  
  activeGlobalEvents: string\[\];  
  economyState?: Record\<string, number\>;  
  politicalPressure?: number;  
};

## **6.15 EventLogEntry**

type EventLogEntry \= {  
  id: string;  
  tickId: string;  
  subjectId?: string;  
  sceneId?: string;  
  playerId?: string;  
  eventType: string;  
  sourceType: "ui\_action" | "verbal" | "context" | "system" | "scenario";  
  sourceId?: string;  
  inputJson: unknown;  
  resultJson?: unknown;  
  deltaJson?: unknown;  
  interpretation?: string;  
  createdAt: string;  
};

---

## **7\. Main modules**

## **7.1 `engine/`**

Owns the interaction core.

### **Responsibilities**

* input normalization  
* input validation  
* one-tick reaction calculation  
* one-tick learning update  
* debug metadata generation

### **Files**

* `engine/config.js`  
* `engine/normalize.js`  
* `engine/validate.js`  
* `engine/computeResult.js`  
* `engine/applyLearning.js`  
* `engine/runTick.js`  
* `engine/buildInterpretation.js`

---

## **7.2 `compiler/`**

Turns external inputs into `CompiledAction`.

### **Responsibilities**

* compile action presets  
* apply player-chosen intensity  
* compute novelty  
* inject memory modifiers  
* merge context and direct action vectors

### **Files**

* `compiler/compileAction.js`  
* `compiler/compileContextVector.js`  
* `compiler/mergeVectors.js`  
* `compiler/noveltyService.js`  
* `compiler/affinityService.js`

---

## **7.3 `parser/`**

Natural language adapters.

### **Responsibilities**

* classify verbal input  
* return canonical key \+ action vector  
* keep engine independent from raw text

### **Files**

* `parser/verbalParser.js`  
* `parser/verbalSchemas.js`

---

## **7.4 `diagnostics/`**

Makes the system readable.

### **Responsibilities**

* semantic interpretation of action/result combinations  
* stable trait inference over time  
* UI labels  
* prompt-safe summaries

### **Example outputs**

* `"pain"`  
* `"tight contact"`  
* `"masochistic tendencies"`  
* `"avoidant response"`  
* `"positive response to praise"`

### **Files**

* `diagnostics/semanticActionInterpreter.js`  
* `diagnostics/traitInference.js`  
* `diagnostics/buildDiagnostics.js`

---

## **7.5 `scenario/`**

Owns world progression.

### **Responsibilities**

* scene state  
* allowed actions  
* mission progression  
* player resource costs  
* faction consequences  
* subject acquisition / loss  
* lab upgrades and restrictions  
* world events

### **Files**

* `scenario/runScenarioStep.js`  
* `scenario/resolveSceneTransition.js`  
* `scenario/checkActionAccess.js`  
* `scenario/applyMissionProgress.js`  
* `scenario/applyResourceCosts.js`  
* `scenario/buildAvailableActions.js`

**Important:** scenario logic never duplicates interaction formulas.

---

## **7.6 `orchestration/`**

The runtime layer.

### **Responsibilities**

* receive a game event  
* load required state  
* compile action/context  
* call the interaction engine  
* call the scenario engine  
* write event logs  
* build output for UI and ST

### **Main function**

async function runGameTick(event: GameEvent): Promise\<TickBundle\>

### **Files**

* `orchestration/eventRouter.js`  
* `orchestration/runGameTick.js`  
* `orchestration/loadTickState.js`  
* `orchestration/saveTickState.js`

---

## **7.7 `prompts/`**

Builds controlled context for character expression.

### **Responsibilities**

* summarize current subject state  
* summarize recent changes  
* include diagnostics  
* include current scene framing  
* prepare compact prompt payload for ST

### **Files**

* `prompts/buildPromptPayload.js`  
* `prompts/buildStateSummary.js`  
* `prompts/buildRecentEventsSummary.js`

---

## **7.8 `adapters/`**

External system integrations.

### **SillyTavern adapter responsibilities**

* submit prompt payload  
* receive character reply  
* keep ST strictly in the expression layer

### **Files**

* `adapters/sillyTavernAdapter.js`

ST must **not** become source of truth for state or scenario logic.

---

## **7.9 `ui/`**

Presentation only.

### **Views**

* player management UI  
* interaction UI  
* debug simulator UI  
* VN scene renderer  
* inspection UI for subjects

---

## **8\. Event model**

Everything in the game should enter the system as a `GameEvent`.

type GameEvent \= {  
  id: string;  
  type: "ui\_action" | "verbal\_input" | "context\_change" | "system\_tick" | "scenario\_trigger";  
  playerId?: string;  
  subjectId?: string;  
  sceneId?: string;  
  timestamp: string;  
  payload: Record\<string, unknown\>;  
};

Examples:

### **Physical UI action**

{  
  "type": "ui\_action",  
  "subjectId": "subj\_1",  
  "payload": {  
    "actionPresetId": "soft\_contact",  
    "pointId": "arm",  
    "intensity": 0.7  
  }  
}

### **Verbal input**

{  
  "type": "verbal\_input",  
  "subjectId": "subj\_1",  
  "payload": {  
    "text": "Успокойся и смотри на меня"  
  }  
}

### **Context change**

{  
  "type": "context\_change",  
  "subjectId": "subj\_1",  
  "payload": {  
    "contextId": "cold\_room",  
    "enabled": true  
  }  
}

---

## **9\. Tick orchestration flow**

## **9.1 Physical action flow**

1. UI sends event  
2. `eventRouter` normalizes it  
3. `scenario/checkActionAccess` validates access and costs  
4. `compiler/compileAction` builds `CompiledAction`  
5. `compiler/compileContextVector` builds background vector  
6. `compiler/mergeVectors` produces final action for this tick  
7. `engine/runTick` computes interaction result  
8. `diagnostics/buildDiagnostics` derives labels and tendencies  
9. `scenario/runScenarioStep` applies world-level consequences  
10. `prompts/buildPromptPayload` creates ST payload if needed  
11. `adapters/sillyTavernAdapter` gets character reply  
12. `orchestration/saveTickState` persists everything  
13. UI receives a `TickBundle`

---

## **9.2 Verbal flow**

1. Chat input arrives  
2. `parser/verbalParser` returns canonical verbal action vector  
3. Remaining flow is identical to physical actions

This is critical:

physical and verbal inputs differ only in input parsing, not in the core engine.

---

## **9.3 System / background tick flow**

1. Scheduler or system event triggers a tick  
2. `compiler/compileContextVector` creates persistent effects  
3. `engine/runTick` applies passive drift  
4. `scenario/runScenarioStep` updates world state if needed  
5. Optional prompt/UI updates follow

---

## **10\. Diagnostics and labels**

There are two distinct kinds of interpretation.

## **10.1 Semantic action interpretation**

Human-readable labels for the current action/result combination.

Examples:

* pain  
* tight contact  
* sharp aversive input  
* supportive verbal pressure  
* discomfort with engagement

This layer is useful for:

* UI summaries  
* event logs  
* prompt summaries  
* designer tooling

## **10.2 Stable trait inference**

Higher-level labels inferred from repeated patterns.

Examples:

* masochistic tendencies  
* avoidant tendencies  
* positive response to praise  
* growing tolerance to harsh pressure  
* emotional withdrawal

These labels are not core-state values. They are interpretations of patterns across time.

They should be produced by `diagnostics/traitInference.js`, not by the engine itself.

---

## **11\. Scenario layer**

The scenario layer owns the game outside the micro-simulation.

It answers questions like:

* which subjects are available to the player?  
* what actions are allowed in the current scene?  
* what resources are required?  
* what missions are active?  
* what factions respond to outcomes?  
* what scene comes next?

### **Important separation**

* **Interaction Engine** answers: what does this do to the subject?  
* **Scenario Engine** answers: what does this do to the player, station, and world?

---

## **12\. SillyTavern role**

SillyTavern is allowed to do exactly one kind of work:

expressive rendering of character output

It may be used for:

* character replies  
* dynamic scene flavor  
* group dialogue flavor  
* emotional expression

It must not be used for:

* true simulation state  
* mission logic  
* resource accounting  
* scene transition logic  
* subject state truth

### **Prompt payload contract**

type PromptPayload \= {  
  subjectId: string;  
  sceneId?: string;  
  currentStateSummary: {  
    interpretation: string;  
    attitude: number;  
    localAttitude: number;  
    engagement: number;  
    overload: number;  
  };  
  recentEvents: Array\<{  
    type: string;  
    interpretation: string;  
  }\>;  
  diagnostics?: string\[\];  
  sceneContext?: string;  
};

ST should receive compact, curated state summaries, never raw full engine state.

---

## **13\. Persistence layer**

Minimum required tables / collections:

### **subjects**

* id  
* name  
* status  
* scene\_id  
* core\_state\_json  
* character\_profile\_json  
* meta\_json  
* created\_at  
* updated\_at

### **subject\_point\_states**

* subject\_id  
* point\_id  
* local\_sensitivity  
* local\_attitude  
* familiarity  
* exposure\_count  
* flags\_json  
* updated\_at

### **subject\_action\_memory**

* subject\_id  
* action\_key  
* affinity  
* familiarity  
* exposure\_count  
* last\_used\_at

### **subject\_combo\_memory**

* subject\_id  
* action\_key  
* point\_id  
* affinity  
* familiarity  
* exposure\_count  
* last\_used\_at

### **action\_presets**

* id  
* label  
* type  
* base\_vector\_json  
* tags\_json  
* ui\_meta\_json

### **point\_presets**

* id  
* label  
* defaults\_json  
* tags\_json

### **context\_presets**

* id  
* label  
* type  
* persistent\_vector\_json  
* stacking\_rules\_json  
* tags\_json

### **active\_contexts**

* id  
* subject\_id  
* context\_id  
* enabled  
* intensity\_modifier  
* params\_json  
* started\_at  
* updated\_at

### **players**

* id  
* name  
* role  
* resources\_json  
* lab\_state\_json  
* social\_state\_json  
* roster\_state\_json  
* progression\_json  
* current\_scene\_id  
* updated\_at

### **factions**

* id  
* name  
* meta\_json

### **player\_faction\_states**

* player\_id  
* faction\_id  
* relation  
* trust  
* access\_level  
* flags\_json

### **missions**

* id  
* issuer\_type  
* issuer\_id  
* title  
* description  
* state  
* objectives\_json  
* rewards\_json  
* penalties\_json  
* conditions\_json  
* scene\_hooks\_json

### **scenes**

* id  
* type  
* title  
* description  
* state\_json  
* narrative\_meta\_json  
* updated\_at

### **event\_logs**

* id  
* tick\_id  
* event\_type  
* subject\_id  
* player\_id  
* scene\_id  
* source\_type  
* source\_id  
* input\_json  
* result\_json  
* delta\_json  
* interpretation  
* created\_at

### **world\_state**

* id  
* state\_json  
* updated\_at

---

## **14\. Folder structure recommendation**

/src  
  /engine  
    config.js  
    normalize.js  
    validate.js  
    computeResult.js  
    applyLearning.js  
    runTick.js  
    buildInterpretation.js

  /compiler  
    compileAction.js  
    compileContextVector.js  
    mergeVectors.js  
    noveltyService.js  
    affinityService.js

  /parser  
    verbalParser.js  
    verbalSchemas.js

  /diagnostics  
    semanticActionInterpreter.js  
    traitInference.js  
    buildDiagnostics.js

  /scenario  
    runScenarioStep.js  
    resolveSceneTransition.js  
    checkActionAccess.js  
    applyMissionProgress.js  
    applyResourceCosts.js  
    buildAvailableActions.js

  /orchestration  
    eventRouter.js  
    loadTickState.js  
    saveTickState.js  
    runGameTick.js

  /prompts  
    buildPromptPayload.js  
    buildStateSummary.js  
    buildRecentEventsSummary.js

  /adapters  
    sillyTavernAdapter.js

  /domain  
    types.js  
    defaults.js

  /ui  
    simulator  
    player  
    debug  
    vn

---

## **15\. Immediate implementation priorities**

Since the repository currently contains only the core engine, the next steps should be:

### **Step 1**

Extract the engine into a clean module boundary:

* `engine/config.js`  
* `engine/runTick.js`  
* `engine/buildInterpretation.js`

### **Step 2**

Define the core contracts in code:

* `CompiledAction`  
* `TickInput`  
* `TickOutput`  
* `GameEvent`  
* `PromptPayload`

### **Step 3**

Implement:

* `compiler/compileAction.js`  
* `orchestration/runGameTick.js`  
* `prompts/buildPromptPayload.js`

### **Step 4**

Add persistence for:

* subjects  
* subject\_point\_states  
* event\_logs  
* players  
* scenes

### **Step 5**

Add verbal parsing and ST integration only after the previous layers exist.

---

## **16\. Final rule**

If a future module starts to duplicate interaction formulas, store subject truth inside ST, or bury scenario logic inside UI code, that module is architecturally wrong.

The intended order is:

**event \-\> compile \-\> runTick \-\> diagnostics \-\> scenario consequences \-\> prompt/UI output**

Everything should preserve that order.

