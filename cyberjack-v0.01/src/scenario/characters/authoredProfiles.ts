import sumiProfile from '../eventLibrary/sumi_authored_profile.json';
import ionaProfile from '../eventLibrary/iona_authored_profile.json';
import miraProfile from '../eventLibrary/mira_authored_profile.json';
import eliProfile from '../eventLibrary/eli_authored_profile.json';
import nikaProfile from '../eventLibrary/nika_authored_profile.json';
import maiProfile from '../eventLibrary/mai_authored_profile.json';
import { GeneratedProfileV2, CharacterArchetype } from '../../orchestration/characterGenerator/types';

type AuthoredProfile = Record<string, any>;

const profiles: Record<string, AuthoredProfile> = {
  'NPC-CAND-SUMI': sumiProfile,
  'NPC-LAB-01': ionaProfile,
  'S-AV-01': miraProfile,
  'NPC-CAND-GEN-02': eliProfile,
  'NPC-CAND-01': nikaProfile,
  'NPC-CAND-GEN-04': maiProfile,
};

const compact = (values: unknown[] = [], limit = 6) =>
  Array.from(new Set(values.map(String).map(value => value.trim()).filter(Boolean))).slice(0, limit);

export function getAuthoredProfile(subjectId: string): AuthoredProfile | undefined {
  return profiles[subjectId];
}

export function compileAuthoredProfile(
  subjectId: string,
  currentRole: string | undefined,
  roleState?: Record<string, any>,
): GeneratedProfileV2 | undefined {
  const source = getAuthoredProfile(subjectId);
  if (!source) return undefined;
  const identity = source.identity;
  const psychology = source.psychology;
  const voice = source.voice;
  const biography = source.biography;
  const rawRole = currentRole || source.entryContext?.formalInitialRole || source.identity.currentRole || 'person';
  const role = rawRole === 'assistant' ? 'staff' : rawRole;
  const archetype: CharacterArchetype = role === 'asset' ? 'asset' : 'person';
  const roleAdaptation = source.roleAdaptations?.[role];
  const internalization = roleState?.internalization;
  const stagedUnderstanding = role === 'asset' && internalization
    ? roleAdaptation?.selfUnderstandingByStage?.[internalization]
    : undefined;
  const roleText = roleAdaptation
    ? `[Текущее положение]\nРоль: ${role}.\n${stagedUnderstanding || roleAdaptation.selfUnderstanding || roleAdaptation.onEntry?.knownFacts?.join(' ') || ''}`
    : `[Текущее положение]\nРоль: ${role}.`;
  const dynamicsText = `[Как применять профиль]\nЭто устойчивые склонности и биография, а не описание текущей эмоции. Текущее состояние, отношение, доверие, готовность, возбуждение и реакция на воздействие определяются данными ядра и отношениями в актуальном контексте. Не изображай страх, покорность, возбуждение, согласие или привязанность только потому, что они упомянуты в профиле.`;
  const personaText = [
    `[Личность]\n${identity.coreSummary}`,
    `[Биография]\n${biography.summary}`,
    `[Внешность]\n${source.appearance.description} ${source.appearance.presentation}`,
    `[Манера речи]\n${voice.description}\n${voice.rhythm}`,
    roleText,
    dynamicsText,
  ].join('\n\n');
  const firstPremise = source.story?.premises?.[0];

  return {
    version: 2,
    generatorRevision: Number.MAX_SAFE_INTEGER,
    subjectId,
    seed: `authored:${subjectId}`,
    authored: true,
    authoredProfile: source,
    identity: {
      name: identity.name,
      age: identity.age,
      gender: identity.gender,
      anatomy: 'human',
      archetype,
    },
    biography: {
      origin: compact([identity.origin, identity.socialBackground], 3),
      formerRole: identity.formerRole,
      statusCause: source.entryContext?.recruitmentCircumstances,
      formativeEvents: compact(
        biography.formativeEvents?.map((event: any) => `${event.fact} ${event.emotionalMeaning}`),
        5,
      ),
    },
    behavioralCore: {
      values: compact(psychology.values, 5),
      needs: compact(psychology.unacknowledgedDesires, 3),
      vulnerabilities: compact(psychology.vulnerabilities, 4),
      defenses: compact(psychology.defenses, 4),
      voice: compact([voice.description, voice.rhythm], 2),
      emotionalVoice: voice.emotionalModes || {},
      mannerisms: compact(source.behavior.mannerisms, 4),
      centralConflict: {
        desire: psychology.consciousDesires?.[0] || 'сохранить право определять собственную жизнь',
        fear: psychology.fears?.[0] || 'потерять контроль над происходящим',
      },
      attentionFocus: ['person', 'rules', 'change'],
      speechDisposition: 'expressive',
      conditionalReactions: [],
    },
    knowledgeRefs: [],
    mechanicalSeed: {
      coreModifiers: {},
      initialContexts: [],
      preferences: { actions: {}, points: {}, contexts: {}, tags: {} },
    },
    sourceTags: [],
    storySeed: firstPremise
      ? {
          unresolvedPast: firstPremise.premise,
          externalLink: firstPremise.relatedPeopleAndGroups?.join(', ') || '',
          concealedFact: firstPremise.hiddenTruth,
          pressure: firstPremise.pressure,
          activationTriggers: firstPremise.activationTriggers || [],
          possibleDirections: firstPremise.possibleDirections || [],
        }
      : undefined,
    personaText,
    personaWithoutTraits: personaText,
    traitBlock: compact([
      ...psychology.values,
      ...psychology.contradictions.map((item: any) => `${item.sideA}; но ${item.sideB}. ${item.manifestation}`),
    ], 7).join('\n'),
    identityText: `${identity.name}, ${identity.age} лет; ${identity.origin}.`,
    historyText: biography.summary,
    activationText: '',
    systemPrompt: personaText,
    updatedAt: new Date().toISOString(),
  };
}
