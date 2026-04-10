import { Scene, ResourceState, SubjectCoreState, AssetContract } from '../domain/types';
import { resolveSceneTransition } from './resolveSceneTransition';
import { evaluateAssetContract, evaluateAllContracts } from './evaluateAssetContract';

export interface ScenarioState {
    scene: Scene;
    resources: ResourceState;
    core: SubjectCoreState;
    contracts: AssetContract[];
}

export interface ScenarioStepResult {
    nextSceneId: string | null;
    updatedResources: ResourceState;
    updatedContracts: AssetContract[];
    updatedCore?: SubjectCoreState;
    success: boolean;
    error?: string;
}

export interface ScenarioStepContext {
    actionId: string;
}

export function runScenarioStep(
    state: ScenarioState,
    context: ScenarioStepContext
): ScenarioStepResult {
    const { scene, resources, core, contracts } = state;
    let nextResources = resources;
    
    const nextSceneId = resolveSceneTransition(scene, core, { actionId: context.actionId });
    
    let nextContracts = contracts;
    let nextCore = core;
    if (contracts && contracts.length > 0) {
        nextCore = evaluateAllContracts(contracts, core, {});
    }

    return {
        nextSceneId,
        updatedResources: nextResources,
        updatedContracts: nextContracts,
        updatedCore: nextCore,
        success: true
    };
}
