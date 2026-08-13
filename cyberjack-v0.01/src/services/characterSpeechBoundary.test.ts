import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve(process.cwd(), 'src');
const allowedCallers = new Set([
    path.join(sourceRoot, 'adapters', 'llmAdapter.ts'),
    path.join(sourceRoot, 'services', 'characterSpeechExecutor.ts'),
]);
const allowedAssistantPersistence = new Set([
    path.join(sourceRoot, 'infrastructure', 'repositories.ts'),
    path.join(sourceRoot, 'services', 'characterSpeechDelivery.ts'),
]);

function sourceFiles(directory: string): string[] {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(target);
        return /\.tsx?$/.test(entry.name) && !/\.test\.|\.spec\./.test(entry.name) ? [target] : [];
    });
}

describe('character speech architecture boundary', () => {
    it('allows production character completions only through the shared executor', () => {
        const bypasses = sourceFiles(sourceRoot).flatMap(file => {
            if (allowedCallers.has(file)) return [];
            const source = fs.readFileSync(file, 'utf8');
            return /\bgenerateCharacterReply\s*\(/.test(source)
                ? [path.relative(process.cwd(), file)]
                : [];
        });
        expect(bypasses, `Direct character LLM calls bypass the shared executor: ${bypasses.join(', ')}`).toEqual([]);
    });

    it('allows assistant chat persistence only through the shared delivery service', () => {
        const bypasses = sourceFiles(sourceRoot).flatMap(file => {
            if (allowedAssistantPersistence.has(file)) return [];
            const source = fs.readFileSync(file, 'utf8');
            return /chatMemoryRepo\.append\([\s\S]{0,160}?['"]assistant['"]/m.test(source)
                ? [path.relative(process.cwd(), file)]
                : [];
        });
        expect(bypasses, `Assistant chat writes bypass shared delivery: ${bypasses.join(', ')}`).toEqual([]);
    });
});
