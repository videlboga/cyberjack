import React from "react";
import { createPortal } from "react-dom";
import type { PortraitEmotion } from "../domain/portraitEmotion";
import { resolveActionButtonImage } from "../domain/actionButtonVisual";
import "./concepts/VisualEffectsCinematic.css";
import "./concepts/VisualEffectsMontage.css";
import "./concepts/VisualEffectsVibration.css";
import "./concepts/VisualEffectsExtended.css";
import "./concepts/VisualEffectsPeaks.css";
import "./concepts/VisualEffectsSustained.css";
import "./GameVisualEffects.css";

export type GameEffectFamily =
  | "electric"
  | "vibration"
  | "impact"
  | "cold"
  | "heat"
  | "soft"
  | "sharp"
  | "restraint"
  | "pulse";
export type GameEffectResult = "accepted" | "mixed" | "rejected" | "overload";
export type GamePeakKind =
  "discharge" | "overload" | "exhaustion" | "breakdown";
export const gameEffectDurationMs = (family: GameEffectFamily) =>
  ({
    soft: 2350,
    impact: 1750,
    vibration: 2500,
    pulse: 2450,
    electric: 1800,
    cold: 2600,
    heat: 2650,
    sharp: 1850,
    restraint: 2700,
  })[family];

const topCropActions = new Set([
  "nipples/hard_bite",
  "back/light_bite",
  "waist/hard_bite",
  "inner_thighs/light_kiss",
  "feet/light_kiss",
  "feet/light_bite",
  "buttocks/feather_stroke",
  "vulva/pinch",
  "clitoris/licking",
  "clitoris/light_bite",
]);
const bottomCropActions = new Set([
  "back/hard_slap",
  "feet/needle_prick",
]);
const effectPortal = (effect: React.ReactNode) =>
  typeof document === "undefined"
    ? effect
    : createPortal(effect, document.body);

export function GameActionEffect(props: {
  effectKey: string;
  family: GameEffectFamily;
  result: GameEffectResult;
  intensity: number;
  sharpness: number;
  actionKey: string;
  actionImage: string;
  actionLabel: string;
  targetLabel: string;
  characterSlug?: string;
  emotion?: PortraitEmotion;
  showPortrait?: boolean;
}) {
  const cropClass = /(?:^|\/)act_(?:start_oral_giving|deepen_oral)$/.test(props.actionKey)
    ? "fx-action-cut--full-height"
    : topCropActions.has(props.actionKey)
    ? "fx-action-cut--top-crop"
    : bottomCropActions.has(props.actionKey)
      ? "fx-action-cut--bottom-crop"
      : props.actionKey === "feet/pinch"
        ? "fx-action-cut--feet-pinch"
        : "";
  const resultLabel = {
    accepted: "Принято",
    mixed: "Смешанно",
    rejected: "Отвергнуто",
    overload: "Перегрузка",
  }[props.result];
  const resultValue =
    props.result === "accepted"
      ? "ПОЛОЖИТЕЛЬНЫЙ ОТКЛИК"
      : props.result === "mixed"
        ? "СМЕШАННЫЙ ОТКЛИК"
        : props.result === "rejected"
          ? "НЕГАТИВНЫЙ ОТКЛИК"
          : "ПРЕДЕЛ НАГРУЗКИ";
  return effectPortal(
    <div
      className={`game-effect-overlay fx-cinematic fx-${props.family} fx-result-${props.result} fx-power-${props.intensity < 0.45 ? "low" : props.intensity < 0.75 ? "medium" : "high"}`}
      key={props.effectKey}
      style={
        {
          "--fx-power": props.intensity,
          "--fx-sharp": props.sharpness,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <div className={`fx-action-cut ${cropClass}`}>
        <img src={props.actionImage} alt="" />
      </div>
      <div className="fx-context">
        <small>{props.targetLabel.toUpperCase()}</small>
        <b>{props.actionLabel.toUpperCase()}</b>
      </div>
      {props.showPortrait && props.characterSlug && props.emotion && (
        <div className="fx-face-cut">
          <img
            src={`/character-images/portraits/${props.characterSlug}/${props.emotion}.png`}
            alt=""
          />
          {props.family === "vibration" && (
            <img
              className="fx-face-echo"
              src={`/character-images/portraits/${props.characterSlug}/${props.emotion}.png`}
              alt=""
            />
          )}
        </div>
      )}
      <div className="fx-resolution">
        <small>{resultLabel}</small>
        <b>{resultValue}</b>
      </div>
    </div>,
  );
}

export function GamePortraitReactionEffect(props: {
  effectKey: string;
  characterSlug: string;
  emotion: PortraitEmotion;
}) {
  return effectPortal(
    <div
      className="game-effect-overlay fx-cinematic fx-soft fx-portrait-reaction-only"
      key={props.effectKey}
      aria-hidden="true"
    >
      <div className="fx-face-cut">
        <img
          src={`/character-images/portraits/${props.characterSlug}/${props.emotion}.png`}
          alt=""
        />
      </div>
    </div>,
  );
}

const peakPortraits: Record<
  GamePeakKind,
  [PortraitEmotion, PortraitEmotion, PortraitEmotion]
> = {
  discharge: ["aroused", "climax", "afterglow"],
  overload: ["pain", "mixed_overload", "high_negative"],
  exhaustion: ["aroused", "exhausted", "afterglow"],
  breakdown: ["defiant", "distressed", "crying"],
};
const peakAction: Record<GamePeakKind, string> = {
  discharge: "/character-images/actions-by-point/feet/licking_s3.png",
  overload: "/character-images/actions-by-point/feet/taser_shock.png",
  exhaustion: "/character-images/actions-by-point/feet/deep_massage.png",
  breakdown: "/character-images/actions-by-point/feet/slap.png",
};
const peakCopy: Record<GamePeakKind, [string, string, string]> = {
  discharge: ["LIMIT RELEASE", "FINISH", "Разряд проходит через всё тело"],
  overload: ["CORE OVERLOAD", "OVERDRIVE", "Ощущения вышли за предел контроля"],
  exhaustion: ["SYSTEM DOWN", "EXHAUSTED", "Тело больше не держит напряжение"],
  breakdown: ["GUARD BREAK", "BREAKDOWN", "Сопротивление сменяется срывом"],
};
export function GamePeakEffect({
  kind,
  effectKey,
  characterSlug,
  actionImage,
}: {
  kind: GamePeakKind;
  effectKey: string;
  characterSlug: string;
  actionImage?: string;
}) {
  return effectPortal(
    <div
      className={`game-effect-overlay fx-peak-montage fx-peak-${kind}`}
      key={effectKey}
      aria-hidden="true"
    >
      <div className="fx-peak-action">
        <img src={actionImage || peakAction[kind]} alt="" />
      </div>
      {peakPortraits[kind].map((emotion, index) => (
        <div
          className={`fx-peak-face fx-peak-face--${["primary", "secondary", "tertiary"][index]}`}
          key={emotion}
        >
          <img
            src={`/character-images/portraits/${characterSlug}/${emotion}.png`}
            alt=""
          />
        </div>
      ))}
      <div className="fx-peak-copy">
        <small>{peakCopy[kind][0]}</small>
        <b>{peakCopy[kind][1]}</b>
        <span>{peakCopy[kind][2]}</span>
      </div>
    </div>,
  );
}

const sustainedKind = (actionId: string) =>
  /(electro|tens)/.test(actionId)
    ? "electric"
    : /vibrat|plug/.test(actionId)
      ? "vibration"
      : /oral/.test(actionId)
        ? "oral"
      : /pulse/.test(actionId)
        ? "pulse"
        : "friction";
const sustainedImage: Record<string, string> = {
  friction:
    "/character-images/actions-by-point/vagina/act_start_penetration.png",
  vibration: "/character-images/actions/equipment/act_start_vibrator.png",
  pulse: "/character-images/actions/equipment/vibrator_pulse.png",
  electric:
    "/character-images/actions/equipment/act_start_electrostimulation.png",
};
export function GameSustainedEffect({
  actionId,
  label,
  minutes = 0,
  contained = false,
  compact = false,
  characterSlug,
  deepened = false,
}: {
  actionId: string;
  label: string;
  minutes?: number;
  contained?: boolean;
  compact?: boolean;
  characterSlug?: string;
  deepened?: boolean;
}) {
  const kind = sustainedKind(actionId);
  const image = kind === "oral"
    ? resolveActionButtonImage(
        deepened ? "act_deepen_oral" : "act_start_oral_giving",
        "intimate",
        "lips",
        characterSlug,
      )
    : sustainedImage[kind];
  const effect = (
    <div
      className={`game-effect-overlay fx-sustained fx-sustained--${kind} fx-sustained--steady${contained ? " fx-contained" : ""}${compact ? " fx-sustained--compact" : ""}`}
      aria-hidden="true"
    >
      <div className="fx-process-window">
        <img
          className="fx-process-window__base"
          src={image}
          alt=""
        />
        <div className="fx-process-window__motion">
          <img src={image} alt="" />
        </div>
        <div className="fx-process-window__motion fx-process-window__motion--echo">
          <img src={image} alt="" />
        </div>
        {kind === "electric" && (
          <svg
            className="fx-process-electric-branches"
            viewBox="0 0 420 180"
            preserveAspectRatio="none"
          >
            <g className="fx-electric-branch fx-electric-branch--a">
              <path d="M6 94 L34 83 L59 91 L86 72 L112 78 L143 65" />
              <path d="M34 83 L51 57 L77 45 L93 20" />
              <path d="M59 91 L76 116 L105 126 L126 151" />
              <path d="M86 72 L104 48 L130 37" />
            </g>
            <g className="fx-electric-branch fx-electric-branch--b">
              <path d="M135 66 L165 82 L193 73 L220 94 L247 81 L279 96" />
              <path d="M165 82 L178 54 L204 34 L216 8" />
              <path d="M193 73 L207 113 L232 127 L246 160" />
              <path d="M220 94 L237 61 L262 48" />
            </g>
            <g className="fx-electric-branch fx-electric-branch--c">
              <path d="M271 96 L299 77 L326 88 L350 64 L381 72 L414 53" />
              <path d="M299 77 L313 43 L341 27" />
              <path d="M326 88 L343 119 L371 128 L396 158" />
              <path d="M350 64 L365 91 L395 99" />
            </g>
          </svg>
        )}
      </div>
      <div className="active-process-visual">
        <i />
        <span>
          <small>ПРОЦЕСС ИДЁТ</small>
          <strong>{label}</strong>
        </span>
        <em>{minutes} мин</em>
      </div>
    </div>
  );
  return contained ? effect : effectPortal(effect);
}
