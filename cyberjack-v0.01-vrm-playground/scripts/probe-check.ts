
import 'dotenv/config';
import '../src/infrastructure/db';
import { subjectRepo, pointStateRepo, characterRelationRepo } from '../src/infrastructure/repositories';
import { compileAction } from '../src/compiler/compileAction';
import { runTick } from '../src/engine/runTick';

const SUBJ = 'S-AV-01';
for (const [aid, pid] of [['act_kiss','lips'],['eq_gag_apply','lips'],['act_start_oral_giving','lips'],['act_slap','face']]) {
    const core = subjectRepo.get(SUBJ)!;
    const point = pointStateRepo.get(SUBJ, pid) || { pointId:pid, localSensitivity:50, localAttitude:50, localOpenness:50, familiarity:0, exposureCount:0, baselineLocalSensitivity:50, baselineLocalAttitude:50, baselineLocalOpenness:50 };
    const action = compileAction({ presetId: aid, eventId: 'scene_lab_calibrator', activeContexts: [], familiarity: point.familiarity ?? 0 });
    const output = runTick({ subjectId: SUBJ, pointId: pid, action, core, point });
    console.log(`${aid} × ${pid}:`);
    console.log(`  actionKey = ${output.tickMeta.inputs.action.actionKey}`);
    console.log(`  pointId   = ${output.tickMeta.inputs.point.pointId}`);
    console.log(`  exposureCount = ${output.tickMeta.inputs.point.exposureCount}`);
}
