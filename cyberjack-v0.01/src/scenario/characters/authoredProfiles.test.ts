import { describe, expect, it } from 'vitest';
import { compileAuthoredProfile } from './authoredProfiles';

describe('authored character profiles', () => {
  it('compiles Sumi without procedural fragments and applies the current role', () => {
    const profile = compileAuthoredProfile('NPC-CAND-SUMI', 'asset');
    expect(profile?.authored).toBe(true);
    expect(profile?.sourceTags).toEqual([]);
    expect(profile?.identity.archetype).toBe('asset');
    expect(profile?.behavioralCore.voice.join(' ')).toContain('корпоративным акцентом');
    expect((profile?.authoredProfile as any).appearance.description).toContain('розовые кудрявые волосы');
    expect((profile?.authoredProfile as any).appearance.presentation).toContain('Кулон в форме сердечка');
    expect(profile?.personaText).toContain('Её официально зарегистрировали как актив');
  });

  it('keeps candidate self-understanding before recruitment', () => {
    const profile = compileAuthoredProfile('NPC-CAND-SUMI', 'candidate');
    expect(profile?.identity.archetype).toBe('person');
    expect(profile?.personaText).toContain('претенденткой на должность ассистента');
  });

  it('compiles Iona as laboratory staff and keeps authored state subordinate to the core', () => {
    const profile = compileAuthoredProfile('NPC-LAB-01', 'assistant');
    expect(profile?.authored).toBe(true);
    expect(profile?.identity.name).toBe('Иона');
    expect(profile?.identity.archetype).toBe('person');
    expect(profile?.personaText).toContain('штатной сотрудницей лаборатории');
    expect(profile?.personaText).toContain('определяются данными ядра');
  });

  it('compiles Mira with an asset-aware authored adaptation', () => {
    const profile = compileAuthoredProfile('S-AV-01', 'asset', { internalization: 'resisting' });
    expect(profile?.authored).toBe(true);
    expect(profile?.identity.name).toBe('Мира');
    expect(profile?.identity.archetype).toBe('asset');
    expect(profile?.personaText).toContain('Перестаёт путать внешнее подчинение с согласием');
    expect(profile?.storySeed?.unresolvedPast).toContain('документы');
  });

  it('compiles Eli from the authored profile and follows her actual laboratory role', () => {
    const profile = compileAuthoredProfile('NPC-CAND-GEN-02', 'asset', { internalization: 'negotiating' });
    expect(profile?.authored).toBe(true);
    expect(profile?.identity.name).toBe('Эли');
    expect(profile?.identity.archetype).toBe('asset');
    expect(profile?.personaText).toContain('формальный обмен');
    expect(profile?.personaText).toContain('золотистые серьги-кольца');
    expect(profile?.personaText).toContain('определяются данными ядра');
  });

  it('replaces Nika procedural fragments with her authored asset profile', () => {
    const profile = compileAuthoredProfile('NPC-CAND-01', 'asset', { internalization: 'negotiating' });
    expect(profile?.authored).toBe(true);
    expect(profile?.identity.name).toBe('Ника');
    expect(profile?.identity.archetype).toBe('asset');
    expect(profile?.personaText).toContain('понятной цены каждого требования');
    expect(profile?.personaText).toContain('чёрными волосами до плеч');
    expect(profile?.personaText).not.toContain('была частью научной машины');
  });

  it('compiles Mai as a candidate without hard-coding masochism into her authored identity', () => {
    const profile = compileAuthoredProfile('NPC-CAND-GEN-04', 'candidate');
    expect(profile?.authored).toBe(true);
    expect(profile?.identity.name).toBe('Май');
    expect(profile?.identity.archetype).toBe('person');
    expect(profile?.personaText).toContain('кандидат лаборатории');
    expect(profile?.personaText).not.toContain('любопытство к боли');
    expect((profile?.authoredProfile as any).appearance.description).toContain('бронзовой кожей');
  });
});
