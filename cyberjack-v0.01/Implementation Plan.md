Implementation Plan

Goal

Build the project in layers around the existing interaction core, without mixing simulation, scenario logic, UI, and character expression.

This document is intentionally short and execution-oriented.

\---

Phase 0\. Freeze the core

Objective

Stabilize the existing simulation core as the only source of truth for subject change.

Deliverables

Move the current engine into dedicated files:

src/engine/config.js

src/engine/normalize.js

src/engine/validate.js

src/engine/computeResult.js

src/engine/applyLearning.js

src/engine/runTick.js

src/engine/buildInterpretation.js

Keep the simulator UI separate from engine code.

Add a few deterministic test cases for runTick(...).

Exit criteria

Engine can run without React/UI.

Engine has stable input/output contracts.

Same input always gives same output.

\---

Phase 1\. Define contracts and types

Objective

Make all future modules depend on explicit contracts instead of ad-hoc objects.

Deliverables

Create src/domain/types.js (or TS equivalents) for:

CompiledAction

SubjectCoreState

SubjectPointState

TickInput

TickOutput

GameEvent

PromptPayload

PlayerState

Scene

Mission

ContextPreset

Exit criteria

All engine-facing modules can import the same contracts.

No hidden shape assumptions in orchestration code.

\---

Phase 2\. Persistence layer

Objective

Store state properly before building real orchestration.

Deliverables

Implement storage for:

subjects

subject\_point\_states

event\_logs

players

scenes

action\_presets

point\_presets

context\_presets

active\_contexts

Notes

Start with the minimum required persistence. Fancy analytics and full memory tables can wait until the basic loop works.

Exit criteria

Can load a subject and its point state from storage.

Can save tick output and append an event log entry.

Can load player and current scene.

\---

Phase 3\. Action compilation

Objective

Translate external inputs into engine-ready action vectors.

Deliverables

Build:

src/compiler/compileAction.js

src/compiler/compileContextVector.js

src/compiler/mergeVectors.js

src/compiler/noveltyService.js

Responsibilities

Load action presets

Apply user-selected intensity

Compute novelty from history / familiarity

Build persistent context vectors

Merge direct action \+ context into one CompiledAction

Exit criteria

UI action input becomes a valid CompiledAction

Contexts can be applied every tick

No direct UI object goes into runTick(...)

\---

Phase 4\. Orchestration

Objective

Build the actual runtime path for one game event.

Deliverables

Implement:

src/orchestration/eventRouter.js

src/orchestration/loadTickState.js

src/orchestration/saveTickState.js

src/orchestration/runGameTick.js

Runtime flow

1\. Receive a GameEvent

2\. Load subject, point, player, scene, active contexts

3\. Validate access through scenario layer

4\. Compile action/context

5\. Run engine tick

6\. Save new state and event log

7\. Return a complete TickBundle

Exit criteria

One incoming event can update the world correctly end-to-end.

Tick orchestration works without SillyTavern.

\---

Phase 5\. Diagnostics

Objective

Make the system readable for UI and prompts.

Deliverables

Implement:

src/diagnostics/semanticActionInterpreter.js

src/diagnostics/traitInference.js

src/diagnostics/buildDiagnostics.js

Responsibilities

Convert action/result patterns into readable labels

Infer stable tendencies over time

Produce two output styles:

UI-facing labels

prompt-safe summaries

Exit criteria

UI can show concise labels instead of raw numbers only.

Prompt builder can use meaningful summaries.

\---

Phase 6\. Scenario engine

Objective

Add the actual game layer around the subject simulation.

Deliverables

Implement:

src/scenario/checkActionAccess.js

src/scenario/applyResourceCosts.js

src/scenario/applyMissionProgress.js

src/scenario/resolveSceneTransition.js

src/scenario/runScenarioStep.js

src/scenario/buildAvailableActions.js

Responsibilities

Manage player resources

Restrict or allow actions

Track missions and rewards

Track ownership / assignment of subjects

Resolve scene progression

Update faction consequences

Exit criteria

The player cannot perform actions without permission/resources.

Interaction results can affect missions, scenes, and station state.

\---

Phase 7\. Prompt building and ST integration

Objective

Use SillyTavern as expression layer only.

Deliverables

Implement:

src/prompts/buildStateSummary.js

src/prompts/buildRecentEventsSummary.js

src/prompts/buildPromptPayload.js

src/adapters/sillyTavernAdapter.js

Rules

ST receives compact summaries only.

ST never stores authoritative state.

ST never decides scenario progression.

ST never replaces the engine.

Exit criteria

Character replies reflect engine state.

Game still works if ST is turned off.

\---

Phase 8\. Verbal input pipeline

Objective

Support chat-driven interaction without bypassing the engine.

Deliverables

Implement:

src/parser/verbalParser.js

src/parser/verbalSchemas.js

Flow

1\. Player sends text

2\. Parser classifies it into a canonical action vector

3\. Action goes through the same runGameTick(...) pipeline as physical input

Exit criteria

Verbal and physical inputs share the same downstream simulation path.

No raw user text goes directly into subject state logic.

\---

Phase 9\. Presentation layers

Objective

Build usable interfaces after simulation and orchestration are stable.

Deliverables

Subject interaction UI

Player/station management UI

VN/scene renderer

Debug simulator UI

Rule

UI must consume prepared models from orchestration, not recalculate gameplay logic.

Exit criteria

The same backend tick can feed multiple UIs.

Debug UI and player UI show different detail levels on top of the same truth.

\---

Priority order summary

1\. Freeze engine

2\. Define contracts

3\. Add persistence

4\. Add action compilation

5\. Add orchestration

6\. Add diagnostics

7\. Add scenario layer

8\. Add prompt/ST integration

9\. Add verbal parser

10\. Build real UI

\---

Non-goals for early phases

Do not try to solve these too early:

multi-subject autonomous dialogue

full group scene simulation

advanced domain memory

complex visual rendering

large-scale content generation

final balancing

These should come only after the single-subject event loop is stable.

\---

Definition of “working vertical slice”

A valid early milestone is:

one player

one subject

one active scene

a few action presets

point-local state

event logs

basic diagnostics

scenario access rules

ST-generated character reply

If that loop works cleanly, everything else can be layered on top.

\---

Final implementation rule

Any new module that duplicates engine formulas, stores truth in UI, or relies on SillyTavern as game logic should be treated as a design error and rewritten.