import { OVERLOAD_NOTICEABLE } from './overloadScale';

export const portraitEmotions = [
  "afterglow", "angry", "aroused", "blush", "bored", "climax", "crying",
  "curious", "defiant", "disgust", "distressed", "excited", "exhausted",
  "fear", "guarded", "high_negative", "high_positive", "mixed",
  "mixed_overload", "neutral", "pain", "pleasure", "receptive", "sad",
  "shy", "sleepy", "smile", "smug", "submissive", "subspace", "surprise",
  "unconscious",
] as const;

export type PortraitEmotion = typeof portraitEmotions[number];

type PortraitReaction = {
  pleasure?: number;
  discomfort?: number;
  overload?: number;
  engagement?: number;
  appraisal?: number;
  mixed?: boolean;
};

export type PortraitEmotionInput = {
  speech?: string | null;
  behavioralState?: string | null;
  reaction?: PortraitReaction | null;
  transitions?: Array<{ kind?: string; title?: string }> | null;
  state?: {
    tension?: number;
    capacity?: number;
    attitude?: number;
    openness?: number;
    plasticity?: number;
    contexts?: Array<{ actionId?: string }>;
  } | null;
};

/** Resolves authored portrait emotion strictly from simulation output. */
export function resolvePortraitEmotion(input: PortraitEmotionInput): PortraitEmotion {
  const state = input.state || {};
  const reaction = input.reaction || {};
  const behavioral = String(input.behavioralState || "");
  const contexts = new Set((state.contexts || []).map(context => context.actionId));
  const transitions = input.transitions || [];
  const hasTransition = (pattern: RegExp) => transitions.some(transition =>
    pattern.test(`${transition.kind || ""} ${transition.title || ""}`)
  );
  const pleasure = Math.max(0, Number(reaction.pleasure || 0));
  const discomfort = Math.max(0, Number(reaction.discomfort || 0));
  const overload = Math.max(0, Number(reaction.overload || 0));
  const engagement = Math.max(0, Number(reaction.engagement || 0));
  const appraisal = Number(reaction.appraisal || 0);
  const tension = Math.max(0, Number(state.tension || 0));
  const capacity = Number(state.capacity ?? 100);
  const attitude = Number(state.attitude ?? 50);
  const openness = Number(state.openness ?? 50);
  const plasticity = Number(state.plasticity ?? 50);
  const transitionText = transitions
    .map(transition => `${transition.kind || ""} ${transition.title || ""}`)
    .join(" ");
  const restrained = [...contexts].some(id =>
    /cuff|restraint|suspend|collar|machine|penetration|insertion/.test(id)
  );

  if (behavioral === "unresponsive" || capacity <= 0) return "unconscious";
  if (hasTransition(/discharge|climax|разряд/i)) return "climax";
  if (/afterglow|recovery|refractory|послевкус|восстанов/i.test(transitionText)
      || contexts.has("effect_refractory")) return "afterglow";
  if (/breakdown|cry|tears|срыв|слез/i.test(transitionText)) return "crying";
  if (behavioral === "subspace" || contexts.has("effect_subspace")) return "subspace";
  if (behavioral === "overload" || overload >= OVERLOAD_NOTICEABLE) {
    return pleasure >= 3 && discomfort >= 3 ? "mixed_overload" : "high_negative";
  }
  if (behavioral === "panic") return "fear";
  if (/surprise|startle|shock|внезап|испуг/i.test(transitionText) && discomfort < 8) return "surprise";
  if (behavioral === "defiance") return appraisal <= -.55 ? "angry" : "defiant";
  if (behavioral === "freeze") return "distressed";
  const speech = String(input.speech || "").toLocaleLowerCase("ru-RU");
  // Spoken reactions are authoritative for social turns. These high-signal
  // phrases correct cases where a reassuringly worded threat is mechanically
  // classified as positive before the character answers it.
  if (/пожалуйста.{0,20}не|не надо|мне страш|я боюсь|что (?:вы|ты) со мной сдела|останов(?:ись|итесь)/.test(speech)) return "fear";
  if (/не име(?:ете|ешь) права|я отказываюсь|я не буду/.test(speech)) return "defiant";
  if (/я не хочу|перестан(?:ь|ьте)|не могу/.test(speech)) return "distressed";
  if (capacity <= 15) return "exhausted";
  if (capacity <= 30 && tension < 45) return "sleepy";
  if (reaction.mixed || (pleasure >= 3 && discomfort >= 3)) return overload >= 5 ? "mixed_overload" : "mixed";
  if (discomfort >= 8 && discomfort > pleasure * 1.15) return "pain";
  if (discomfort >= 3 && discomfort > pleasure) return "distressed";
  if (appraisal <= -.7 && discomfort < 3) return "disgust";
  if (appraisal <= -.3 && engagement <= 1 && tension < 40) return "sad";
  if (tension >= 85) return appraisal < 0 || attitude < 45 ? "high_negative" : "high_positive";
  if (pleasure >= 9) return "pleasure";
  if (pleasure >= 3 && tension >= 55) return "aroused";
  if (input.reaction && engagement <= 1 && pleasure + discomfort + overload < 1) return "bored";
  if (attitude <= 35 || appraisal < -.25) return "guarded";
  if (engagement >= 7 && appraisal >= .2) return "excited";
  if (engagement >= 4 && pleasure + discomfort < 3 && Math.abs(appraisal) < .3) return "curious";
  if (restrained && plasticity >= 70 && openness >= 55 && appraisal >= 0) return "submissive";
  if (appraisal >= .55 && attitude >= 75 && tension < 35) return "smug";
  if (appraisal >= .2 && openness < 35 && tension >= 45) return "shy";
  if (appraisal >= .2 && openness < 55 && tension >= 30) return "blush";
  if (appraisal >= .3 && pleasure < 3 && tension < 45) return "smile";
  if (attitude >= 65 && openness >= 50) return "receptive";
  return "neutral";
}
