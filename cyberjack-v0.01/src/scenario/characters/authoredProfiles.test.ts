import { describe, expect, it } from 'vitest';
import { compileAuthoredProfile } from './authoredProfiles';

describe('authored character profiles', () => {
  it('compiles Sumi with a compact authored profile and applies the current role', () => {
    const profile = compileAuthoredProfile('NPC-CAND-SUMI', 'asset');
    expect(profile?.authored).toBe(true);
    expect(profile?.sourceTags).toEqual([]);
    expect(profile?.identity.archetype).toBe('asset');
    expect(profile?.behavioralCore.voice.join(' ')).toContain('корпоративным акцентом');
    expect(profile?.personaText).toContain('[Сценарий жизни]');
    expect(profile?.personaText).toContain('Сначала порадуй, потом проси');
    expect(profile?.personaText).toContain('определяются данными ядра');
  });

  it('keeps candidate self-understanding before recruitment', () => {
    const profile = compileAuthoredProfile('NPC-CAND-SUMI', 'candidate');
    expect(profile?.identity.archetype).toBe('person');
    expect(profile?.biography.origin.join(' ')).toContain('Внутреннее кольцо');
  });

  it('compiles Iona as laboratory staff and keeps authored state subordinate to the core', () => {
    const profile = compileAuthoredProfile('NPC-LAB-01', 'assistant');
    expect(profile?.authored).toBe(true);
    expect(profile?.identity.name).toBe('Иона');
    expect(profile?.identity.archetype).toBe('person');
    expect(profile?.personaText).toContain('[Сценарий жизни]');
    expect(profile?.personaText).toContain('определяются данными ядра');
    expect(profile?.mechanicalSeed.coreModifiers.capacity).toBe(18);
  });

  it('compiles Mira with an asset-aware authored profile', () => {
    const profile = compileAuthoredProfile('S-AV-01', 'asset');
    expect(profile?.authored).toBe(true);
    expect(profile?.identity.name).toBe('Мира');
    expect(profile?.identity.archetype).toBe('asset');
    expect(profile?.personaText).toContain('[Сценарий жизни]');
    expect(profile?.biography.formativeEvents.join(' ')).toContain('документы');
  });

  it('compiles Eli from the authored profile and follows her actual laboratory role', () => {
    const profile = compileAuthoredProfile('NPC-CAND-GEN-02', 'asset');
    expect(profile?.authored).toBe(true);
    expect(profile?.identity.name).toBe('Эли');
    expect(profile?.identity.archetype).toBe('asset');
    expect(profile?.personaText).toContain('[Сценарий жизни]');
    expect(profile?.personaText).toContain('определяются данными ядра');
  });

  it('replaces Nika procedural fragments with her authored asset profile', () => {
    const profile = compileAuthoredProfile('NPC-CAND-01', 'asset');
    expect(profile?.authored).toBe(true);
    expect(profile?.identity.name).toBe('Ника');
    expect(profile?.identity.archetype).toBe('asset');
    expect(profile?.personaText).toContain('[Сценарий жизни]');
    expect(profile?.biography.formativeEvents.join(' ')).toContain('Veil Biotech');
  });

  it('compiles Mai as a candidate without hard-coding masochism into her authored identity', () => {
    const profile = compileAuthoredProfile('NPC-CAND-GEN-04', 'candidate');
    expect(profile?.authored).toBe(true);
    expect(profile?.identity.name).toBe('Май');
    expect(profile?.identity.archetype).toBe('person');
    expect(profile?.personaText).toContain('[Сценарий жизни]');
    expect(profile?.personaText).not.toContain('любопытство к боли');
    expect(profile?.mechanicalSeed.coreModifiers.openness).toBe(10);
  });

  it('compiles Kate as an external candidate from the intimate-reactions lab', () => {
    const profile = compileAuthoredProfile('NPC-CAND-KATE', 'candidate');
    expect(profile?.authored).toBe(true);
    expect(profile?.identity.name).toBe('Кейт');
    expect(profile?.identity.age).toBe(27);
    expect(profile?.identity.archetype).toBe('person');
    expect(profile?.biography.origin.join(' ')).toContain('межлабораторный контракт');
    expect(profile?.biography.formativeEvents.join(' ')).toContain('постоянная подопытная');
    expect(profile?.personaText).toContain('[Сценарий жизни]');
    expect(profile?.personaText).toContain('Соблазняй');
    expect(profile?.mechanicalSeed.coreModifiers.openness).toBe(40);
  });
});
