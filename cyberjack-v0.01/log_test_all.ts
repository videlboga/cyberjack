import { runTick } from './src/engine/runTick';
import { compileAction } from './src/compiler/compileAction';
import { applyDynamicContexts } from './src/compiler/dynamicModifiers';

function testFull() {
    let state = {
        core: { sensitivity: 50, capacity: 50, openness: 40, plasticity: 50, attitude: 50 },
        point: { localSensitivity: 50, localAttitude: 50 }
    };
    
    console.log("=== TASER SHOCK 5.0 (High Intensity, Aversive) ===");
    for (let i = 1; i <= 3; i++) {
        let compiledAction = compileAction({ presetId: "taser_shock", eventId: "lab", playerIntensity: 5.0, history: [] });
        compiledAction = applyDynamicContexts(compiledAction, state.core, state.point);
        const engineOutput = runTick({ action: compiledAction, core: state.core, point: state.point });
        state.core = engineOutput.nextCore; state.point = engineOutput.nextPoint;
        console.log(`Tick ${i}: Sens: ${state.core.sensitivity.toFixed(1)}, Cap: ${state.core.capacity.toFixed(1)}, Open: ${state.core.openness.toFixed(1)}, Plast: ${state.core.plasticity.toFixed(1)}, Att: ${state.core.attitude.toFixed(1)} | LocSens: ${state.point.localSensitivity.toFixed(1)}`);
    }

    console.log("\n=== DEEP KISS 5.0 (High Pleasure) ===");
    state = { core: { sensitivity: 50, capacity: 50, openness: 40, plasticity: 50, attitude: 50 }, point: { localSensitivity: 50, localAttitude: 50 } };
    for (let i = 1; i <= 3; i++) {
        let compiledAction = compileAction({ presetId: "deep_kiss", eventId: "lab", playerIntensity: 5.0, history: [] });
        compiledAction = applyDynamicContexts(compiledAction, state.core, state.point);
        const engineOutput = runTick({ action: compiledAction, core: state.core, point: state.point });
        state.core = engineOutput.nextCore; state.point = engineOutput.nextPoint;
        console.log(`Tick ${i}: Sens: ${state.core.sensitivity.toFixed(1)}, Cap: ${state.core.capacity.toFixed(1)}, Open: ${state.core.openness.toFixed(1)}, Plast: ${state.core.plasticity.toFixed(1)}, Att: ${state.core.attitude.toFixed(1)} | LocSens: ${state.point.localSensitivity.toFixed(1)}`);
    }
}
testFull();
