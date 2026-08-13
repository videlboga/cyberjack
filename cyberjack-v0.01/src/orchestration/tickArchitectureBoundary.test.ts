import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve(process.cwd(), 'src');
const runGameTickPath = path.join(sourceRoot, 'orchestration', 'runGameTick.ts');

describe('tick architecture boundary', () => {
    it('keeps engine execution behind the pure computation phase', () => {
        const source = fs.readFileSync(runGameTickPath, 'utf8');
        expect(source).not.toMatch(/from ['"]\.\.\/engine\/runTick['"]/);
        expect(source).toMatch(/\bcomputeTickOutcome\s*\(/);
    });

    it('keeps primary tick persistence behind the single commit phase', () => {
        const source = fs.readFileSync(runGameTickPath, 'utf8');
        expect(source).not.toMatch(/from ['"]\.\/saveTickState['"]/);
        expect(source).not.toMatch(/\bresourceRepo\.save\s*\(/);
        expect(source).toMatch(/\bcommitTickOutcome\s*\(/);
    });

    it('publishes projections only through the post-commit phase', () => {
        const source = fs.readFileSync(runGameTickPath, 'utf8');
        expect(source).not.toMatch(/\bemitSubjectMetricChanges\s*\(/);
        expect(source).not.toMatch(/\brecordSceneObservation\s*\(/);
        expect(source.indexOf('commitTickOutcome({')).toBeLessThan(source.indexOf('publishTickOutcome({'));
    });

    it('does not reinterpret command words with local regular expressions', () => {
        const source = fs.readFileSync(runGameTickPath, 'utf8');
        expect(source).not.toContain('wantsNeutralPose');
        expect(source).not.toMatch(/встань\|вставай\|поднимись/);
    });

    it('resolves laboratory moves through the read-only resolver, not the direct mutator', () => {
        const source = fs.readFileSync(runGameTickPath, 'utf8');
        const commandPath = path.join(sourceRoot, 'orchestration', 'applyCommandEffects.ts');
        const commandSource = fs.readFileSync(commandPath, 'utf8');
        expect(source).not.toMatch(/from ['"]\.\.\/scenario\/spatialContext['"]/);
        expect(source).not.toMatch(/\bmoveCharacterInLaboratory\s*\(/);
        expect(commandSource).not.toMatch(/\bmoveCharacterInLaboratory\s*\(/);
        expect(commandSource).toMatch(/\bresolveLaboratoryMove\s*\(/);
    });

    it('does not perform direct mandatory state writes before the commit phase', () => {
        const source = fs.readFileSync(runGameTickPath, 'utf8');
        const commandPath = path.join(sourceRoot, 'orchestration', 'applyCommandEffects.ts');
        const commandSource = fs.readFileSync(commandPath, 'utf8');
        // Direct repo mutations must be gone; all mandatory writes flow through
        // the TickEffect plan executed inside commitTickOutcome.
        for (const src of [source, commandSource]) {
            expect(src).not.toMatch(/\bactiveContextsRepo\.(remove|add|removeByActionId)\s*\(/);
            expect(src).not.toMatch(/\bpointStateRepo\.save\s*\(/);
            expect(src).not.toMatch(/\bsubjectEdgeStateRepo\.(clear|update)\s*\(/);
            expect(src).not.toMatch(/\binteractionStanceRepo\.(save|soften|recordIgnored|softenAll)\s*\(/);
            expect(src).not.toMatch(/\bpendingCommandRepo\.(save|clear)\s*\(/);
            expect(src).not.toMatch(/\bContextManager\.(applyContext|processTick|applyAutonomousCollapse)\s*\(/);
            expect(src).not.toMatch(/\bstateTriggersRepo\.(increment|reset|set)\s*\(/);
            expect(src).not.toMatch(/\bsceneCharacterRepo\.set\s*\(/);
            expect(src).not.toMatch(/\beventLogRepo\.append\s*\(/);
        }
    });
});
