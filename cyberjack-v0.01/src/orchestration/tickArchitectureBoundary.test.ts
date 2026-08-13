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
        expect(source).not.toMatch(/from ['"]\.\.\/scenario\/spatialContext['"]/);
        expect(source).not.toMatch(/\bmoveCharacterInLaboratory\s*\(/);
        expect(source).toMatch(/\bresolveLaboratoryMove\s*\(/);
    });
});
