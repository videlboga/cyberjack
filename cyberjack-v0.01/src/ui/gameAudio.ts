import type { PortraitEmotion } from "../domain/portraitEmotion";
import { applyVoiceTimbre, characterVoiceTimbre } from "./voiceTimbre";

type ActionAudioEntry = {
  oneShot?: string;
  variants?: string[];
  loop?: string;
  replacesLoop?: string;
  stopsLoop?: string;
  silent?: boolean;
};

type ReactionAudioEntry = {
  character: string;
  state: string;
  oneShot: string;
  variants?: string[];
};

type ActionManifest = {
  version?: number;
  basePath: string;
  actions: Record<string, ActionAudioEntry>;
};

type ReactionManifest = {
  version?: number;
  basePath: string;
  reactions: Record<string, ReactionAudioEntry>;
};

const reactionState = (emotion: PortraitEmotion): string | null => {
  if (emotion === "curious") return "curious";
  if (["angry", "defiant", "disgust"].includes(emotion)) return "defiant";
  if (emotion === "guarded") return "guarded";
  if (["fear", "surprise"].includes(emotion)) return "fear";
  if (["pain", "crying", "distressed", "high_negative"].includes(emotion)) return "pain";
  if (["mixed", "mixed_overload"].includes(emotion)) return "overload";
  if (emotion === "subspace") return "subspace";
  if (emotion === "climax") return "climax";
  if (["afterglow", "smile"].includes(emotion)) return "afterglow";
  if (["exhausted", "sleepy"].includes(emotion)) return "exhausted";
  if (["aroused", "pleasure", "high_positive", "receptive", "blush", "shy", "submissive", "excited"].includes(emotion)) return "pleasure";
  return null;
};

const calmReactionState = (state: string): string => {
  if (["fear"].includes(state)) return "calm_startle";
  if (["defiant", "pain", "overload"].includes(state)) return "calm_discomfort";
  if (["pleasure", "subspace", "afterglow"].includes(state)) return "calm_pleasure";
  return "calm_attentive";
};

class GameAudio {
  private actionManifest?: ActionManifest;
  private reactionManifest?: ReactionManifest;
  private loading?: Promise<void>;
  private action?: HTMLAudioElement;
  private reaction?: HTMLAudioElement;
  private loop?: HTMLAudioElement;
  private loopPath?: string;
  private lastReactionPath = "";

  private async load() {
    if (this.actionManifest && this.reactionManifest) return;
    if (!this.loading) {
      this.loading = Promise.all([
        fetch("/audio/action-audio-manifest.json").then(response => response.json()),
        fetch("/audio/reaction-audio-manifest.json").then(response => response.json()),
      ]).then(([actions, reactions]) => {
        this.actionManifest = actions;
        this.reactionManifest = reactions;
      }).catch(error => {
        console.warn("Audio manifests unavailable", error);
      }).then(() => undefined);
    }
    await this.loading;
  }

  private path(base: string, relative: string, version?: number) {
    return `${base}/${relative}${version ? `?v=${version}` : ""}`;
  }

  private playElement(path: string, volume: number, loop = false, playbackRate = 1) {
    const audio = new Audio(path);
    audio.preload = "auto";
    audio.volume = volume;
    audio.loop = loop;
    audio.preservesPitch = false;
    audio.playbackRate = playbackRate;
    void audio.play().catch(() => undefined);
    return audio;
  }

  private stopLoop(immediate = false) {
    if (!this.loop) return;
    const fading = this.loop;
    this.loop = undefined;
    this.loopPath = undefined;
    if (immediate) {
      fading.pause();
      fading.currentTime = 0;
      return;
    }
    const fade = window.setInterval(() => {
      fading.volume = Math.max(0, fading.volume - .06);
      if (fading.volume <= 0) {
        window.clearInterval(fade);
        fading.pause();
        fading.currentTime = 0;
      }
    }, 35);
  }

  async playAction(actionId: string) {
    await this.load();
    const manifest = this.actionManifest;
    const entry = manifest?.actions[actionId];
    if (!manifest || !entry || entry.silent) return;

    const requestedLoopPath = entry.loop
      ? this.path(manifest.basePath, entry.loop, manifest.version)
      : undefined;
    if (entry.stopsLoop || (entry.replacesLoop && requestedLoopPath !== this.loopPath)) this.stopLoop();
    if (entry.oneShot) {
      this.action?.pause();
      this.action = this.playElement(this.path(manifest.basePath, entry.oneShot, manifest.version), .7);
    }
    if (entry.loop) {
      const nextPath = requestedLoopPath!;
      if (nextPath !== this.loopPath) {
        this.stopLoop();
        this.loopPath = nextPath;
        this.loop = this.playElement(nextPath, .34, true);
      }
    }
  }

  async playExclusiveAction(actionId: string) {
    this.action?.pause();
    this.action = undefined;
    this.stopLoop(true);
    await this.playAction(actionId);
  }

  async playReaction(character: string, emotion: PortraitEmotion, intensity: number) {
    await this.load();
    const manifest = this.reactionManifest;
    const exactEntry = manifest?.reactions[`generic_${emotion}`];
    const emotionalState = reactionState(emotion);
    if ((!exactEntry && !emotionalState) || (intensity < .16 && Math.random() > .55)) return;
    const calm = intensity < .7 && emotionalState !== "climax";
    const state = emotionalState
      ? (calm ? calmReactionState(emotionalState) : emotionalState)
      : emotion;
    const entry = exactEntry
      || manifest?.reactions[`generic_${state}`];
    if (!manifest || !entry) return;

    const candidates = [entry.oneShot, ...(entry.variants || [])];
    const fresh = candidates.filter(candidate => candidate !== this.lastReactionPath);
    const relative = (fresh.length ? fresh : candidates)[Math.floor(Math.random() * (fresh.length || candidates.length))];
    if (!relative) return;
    this.lastReactionPath = relative;

    window.setTimeout(() => {
      this.reaction?.pause();
      if (this.action && !this.action.paused) this.action.volume = .38;
      this.reaction = this.playElement(
        this.path(manifest.basePath, relative, manifest.version),
        calm ? Math.min(.64, .46 + intensity * .18) : Math.min(.88, .62 + intensity * .2),
      );
      applyVoiceTimbre(this.reaction, characterVoiceTimbre(character), (Math.random() - .5) * .012);
      this.reaction.addEventListener("ended", () => {
        if (this.action && !this.action.paused) this.action.volume = .7;
      }, { once: true });
    }, 70 + Math.round(Math.random() * 50));
  }

  stop() {
    this.action?.pause();
    this.reaction?.pause();
    this.stopLoop();
  }
}

export const gameAudio = new GameAudio();
