# CyberJack Checklist

## Phase 0. Freeze the core
- [x] Stabilize current simulation core.
- [x] Move engine into dedicated files (`src/engine/`):
  - [x] `config.ts`
  - [x] `normalize.ts`
  - [x] `validate.ts`
  - [x] `computeResult.ts`
  - [x] `applyLearning.ts`
  - [x] `runTick.ts`
  - [x] `buildInterpretation.ts`
- [x] Separate simulator UI from engine code.
- [x] Add deterministic test cases for `runTick(...)` (Vitest).

## Phase 1. Define contracts and types
- [x] Create `src/domain/types.ts` for:
  - [x] CompiledAction
  - [x] SubjectCoreState
  - [x] SubjectPointState
  - [x] TickInput
  - [x] TickOutput
  - [x] GameEvent
  - [x] PromptPayload
  - [x] PlayerState
  - [x] Scene
  - [x] Mission
  - [x] ContextPreset

## Phase 2. Persistence layer (SQLite)
- [x] Implement SQLite storage for:
  - [x] subjects
  - [x] subject_point_states
  - [x] event_logs
  - [x] players
  - [x] scenes
  - [x] action_presets
  - [x] point_presets
  - [x] context_presets
  - [x] active_contexts

## Phase 3. Action compilation
- [x] Build `src/compiler/compileAction.ts`
- [x] Build `src/compiler/compileContextVector.ts`
- [x] Build `src/compiler/mergeVectors.ts`
- [x] Build `src/compiler/noveltyService.ts`

## Phase 4. Orchestration
- [x] Implement `src/orchestration/eventRouter.ts`
- [x] Implement `src/orchestration/loadTickState.ts`
- [x] Implement `src/orchestration/saveTickState.ts`
- [x] Implement `src/orchestration/runGameTick.ts`

## Phase 5. Diagnostics
- [x] Implement `src/diagnostics/semanticActionInterpreter.ts`
- [x] Implement `src/diagnostics/traitInference.ts`
- [x] Implement `src/diagnostics/buildDiagnostics.ts`

## Phase 6. Scenario engine
- [x] Implement `src/scenario/checkActionAccess.ts`
- [x] Implement `src/scenario/applyResourceCosts.ts`
- [x] Implement `src/scenario/applyMissionProgress.ts`
- [x] Implement `src/scenario/resolveSceneTransition.ts`
- [x] Implement `src/scenario/runScenarioStep.ts`
- [x] Implement `src/scenario/buildAvailableActions.ts`

## Phase 7. Prompt building and ST integration
- [x] Implement `src/prompts/buildStateSummary.ts`
- [x] Implement `src/prompts/buildRecentEventsSummary.ts`
- [x] Implement `src/prompts/buildPromptPayload.ts`
- [x] Implement `src/adapters/sillyTavernAdapter.ts`

## Phase 8. Verbal input pipeline
- [x] Implement `src/parser/verbalParser.ts`
- [x] Implement `src/parser/verbalSchemas.ts`

## Phase 9. Presentation layers
- [x] Debug simulator UI (React + Express Bridge)
- [ ] Subject interaction UI
- [ ] Player/station management UI
- [ ] VN/scene renderer
