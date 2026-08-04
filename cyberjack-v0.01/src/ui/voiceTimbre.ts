export type VoiceTimbre = "neutral" | "dark" | "soft" | "bright" | "thin";

export const voiceTimbreLabels: Record<VoiceTimbre, string> = {
  neutral: "Без обработки",
  dark: "Тёмный",
  soft: "Мягкий",
  bright: "Яркий",
  thin: "Тонкий",
};

const profiles: Record<VoiceTimbre, {
  rate: number;
  low: number;
  presence: number;
  high: number;
}> = {
  neutral: { rate: 1, low: 0, presence: 0, high: 0 },
  dark: { rate: .965, low: 3.5, presence: -1.5, high: -4 },
  soft: { rate: .985, low: 1.5, presence: -2.5, high: -2 },
  bright: { rate: 1.025, low: -2, presence: 2.5, high: 3.5 },
  thin: { rate: 1.045, low: -4.5, presence: 1.5, high: 2 },
};

type TimbreGraph = {
  low: BiquadFilterNode;
  presence: BiquadFilterNode;
  high: BiquadFilterNode;
};

let context: AudioContext | undefined;
const graphs = new WeakMap<HTMLAudioElement, TimbreGraph>();

const graphFor = (audio: HTMLAudioElement) => {
  const existing = graphs.get(audio);
  if (existing) return existing;
  context ||= new AudioContext();
  const source = context.createMediaElementSource(audio);
  const low = context.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 260;
  const presence = context.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 2200;
  presence.Q.value = .8;
  const high = context.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = 5200;
  source.connect(low).connect(presence).connect(high).connect(context.destination);
  const graph = { low, presence, high };
  graphs.set(audio, graph);
  return graph;
};

export function applyVoiceTimbre(audio: HTMLAudioElement, timbre: VoiceTimbre, rateJitter = 0) {
  const profile = profiles[timbre];
  const graph = graphFor(audio);
  graph.low.gain.value = profile.low;
  graph.presence.gain.value = profile.presence;
  graph.high.gain.value = profile.high;
  audio.preservesPitch = false;
  audio.playbackRate = Math.max(.92, Math.min(1.08, profile.rate + rateJitter));
  void context?.resume();
}

export function characterVoiceTimbre(character: string): VoiceTimbre {
  const choices: VoiceTimbre[] = ["soft", "dark", "bright", "thin", "neutral"];
  const hash = [...character].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 7);
  return choices[hash % choices.length];
}
