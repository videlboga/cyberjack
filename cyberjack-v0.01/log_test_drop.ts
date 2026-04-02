import { runGameTick } from './src/orchestration/runGameTick';
import { runTick } from './src/engine/runTick';
import { compileAction } from './src/compiler/compileAction';
import { applyDynamicContexts } from './src/compiler/dynamicModifiers';

function testDrop() {
    let state = {
        core: {
            sensitivity: 45,
            capacity: 25,
            openness: 40,
            plasticity: 50,
            attitude: 50
        },
        point: {
            localSensitivity: 50,
            localAttitude: 50
        }
    };
    
    // Simulate tick with taser 5.0
    for (let i = 0; i < 10; i++) {
        let compiledAction = compileAction({
            presetId: "taser_shock",
            eventId: "lab",
            playerIntensity: 5.0,
            history: [],
            dynamicModifiers: {}
        });
        compiledAction = applyDynamicContexts(compiledAction, state.core, state.point);
        const engineOutput = runTick({
            action: compiledAction,
            core: state.core,
            point: state.point
        });
        state.core = engineOutput.nextCore;
        state.point = engineOutput.nextPoint;
        console.log(`Tick ${i}: Capacity = ${state.core.capacity.toFixed(2)}, Attitude = ${state.core.attitude.toFixed(2)}, Overload = ${engineOutput.result.overload.toFixed(2)}, Intensity = ${engineOutput.result.experiencedIntensity.toFixed(2)}, Final Action Intensity = ${compiledAction.intensity}`);
    }
}
testDrop();
