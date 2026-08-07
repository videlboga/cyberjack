import React, { useEffect, useRef, useState, memo } from "react";
import { flushSync } from "react-dom";
import {
  activeVisualInteractionFromContexts,
  buildCalibrationVisualDescriptorV4,
  expandedInteractionAssetPath,
  resolveCalibrationAvatarV4,
  resolveFirstAvailableVisual,
  resolveIntimacyInteractionVisual,
} from "../domain/characterVisuals";
import {
  deriveEdgeProfile,
  deriveReactionCharacter,
} from "../domain/edgeState";
import {
  formatRelativeValue,
  interpretCoreMetric,
  interpretPointAttitude,
  interpretPointSensitivity,
  InterpretableCoreMetric,
} from "../domain/parameterInterpretation";
import {
  PortraitEmotion,
  resolvePortraitEmotion,
} from "../domain/portraitEmotion";
import {
  CalibrationBiometrics,
  CalibrationTrendInstrument,
} from "./CalibrationBiometrics";
import { EnduranceLiquid } from "./EnduranceLiquid";
import { BalancePendulum, BalanceLabels } from "./BalancePendulum";
import {
  acquiredTraitValue,
  conditioningTags,
  contextConditioningTags,
  parsePreferences,
} from "../domain/conditioning";
import {
  canonicalCharacterPortrait,
  CharacterPortrait,
} from "./CharacterPortrait";
import {
  appendCharacterChatLines,
  CharacterChatFeed,
  CharacterChatLine,
  collapseRepeatedChatActions,
} from "./CharacterChat";
import { scoreGoalCandidate } from "./goalRecommendation";
import { gameAudio } from "./gameAudio";
import {
  GameActionEffect,
  GamePeakEffect,
  GameSustainedEffect,
  gameEffectDurationMs,
} from "./GameVisualEffects";
import { resolveActionButtonImage } from "../domain/actionButtonVisual";
import "./VisualReview.css";
import "./CalibrationPrototype.css";
import "./ProtocolControls.css";
import "./CompactCalibration.css";
import "./DiagnosticCase.css";
import "./ExpandedPrototype.css";
import "./StateTransitions.css";
import "./WorkbenchLayout.css";
import "./WorkbenchShellFix.css";
import "./ZoneSelector.css";
import "./CharacterSpeech.css";
import "./NoScrollWorkbench.css";
import { streamDeferredReply } from "./deferredReplyStream";
const SCENE = "scene_lab_calibrator",
  ZONE = "neck",
  ENABLE_ADAPTIVE_PROTOCOL = false;
type Phase = "diagnosis" | "preparation";
type PassiveMode = "gentle" | "contrast";
type ProtocolMode = "exact" | "adaptive";
export type ActionGroup =
  "contact" | "intimate" | "pose" | "equipment" | "clothing";
type Point = {
  localSensitivity: number;
  localAttitude: number;
  localOpenness?: number;
  familiarity?: number;
  exposureCount?: number;
  baselineLocalSensitivity?: number;
  baselineLocalAttitude?: number;
  baselineLocalOpenness?: number;
};
type ActiveContext = {
  actionId: string;
  ticksActive?: number;
  pointId?: string;
  label?: string;
  type?: string;
  occupiesPoints?: string[];
  blocksPoints?: string[];
};
type State = {
  sensitivity: number;
  localSensitivity: number;
  capacity: number;
  openness: number;
  attitude: number;
  tension: number;
  plasticity: number;
  baselineSensitivity?: number;
  baselineCapacity?: number;
  baselineOpenness?: number;
  baselineAttitude?: number;
  baselinePlasticity?: number;
  baseline_sensitivity?: number;
  baseline_capacity?: number;
  baseline_openness?: number;
  baseline_attitude?: number;
  baseline_plasticity?: number;
  anatomy?: Record<string, Point>;
  contexts?: ActiveContext[];
  preferences?: string;
};
type Zone = {
  id: string;
  label: string;
  local_sensitivity: number;
  baseline_local_sensitivity?: number;
  local_attitude: number;
  baseline_local_attitude?: number;
  local_openness?: number;
  familiarity?: number;
};
type ActionMeta = {
  id: string;
  validTargets?: string[] | null;
  requiresItem?: string | null;
  tags?: string[];
  intensity?: number;
  sharpness?: number;
};
export type ActionDef = {
  id: string;
  label: string;
  hint: string;
  group: ActionGroup;
  pointId?: string;
  requiresContext?: string;
  hideWhenContext?: string;
  contextual?: boolean;
};
const hiddenCalibrationActionIds = new Set([
  "act_connect_tens",
  "act_start_electrostimulation",
  "act_adjust_electrostimulation",
  "act_stop_electrostimulation",
  "act_disconnect_tens",
]);
type OperationMode = "impact" | "setup";
export const semanticTagLabels: Record<string, string> = {
  pain: "боль",
  tickling: "щекотка",
  clinical: "медицина",
  medical: "медицина",
  electronic: "электричество",
  restraint: "фиксация",
  control: "контроль",
  command: "команда",
  submission: "подчинение",
  exposure: "демонстрация",
  humiliation: "унижение",
  vulnerable: "уязвимость",
  sexual: "эротика",
  oral: "оральное",
  penetration: "проникновение",
  feet: "ступни",
  deprivation: "депривация",
  machine: "машина",
};
export const actionSemanticFallback: Record<string, string[]> = {
  feather_stroke: ["tickling"],
  tickle: ["tickling"],
  hot_wax: ["pain"],
  firm_grip: ["pain"],
  light_bite: ["pain"],
  hard_bite: ["pain"],
  pinch: ["pain"],
  scratching: ["pain"],
  slap: ["pain", "humiliation"],
  hard_slap: ["pain", "humiliation"],
  needle_prick: ["pain", "medical"],
  whip_strike: ["pain"],
  taser_shock: ["pain", "electronic"],
  hair_pull: ["pain", "control"],
  light_kiss: ["sexual"],
  deep_kiss: ["sexual", "oral"],
  licking: ["sexual", "oral"],
  finger_insertion: ["sexual", "penetration"],
  act_start_penetration: ["sexual", "penetration"],
};
const actionSection = (action: ActionDef) => {
  const tags = actionSemanticFallback[action.id] || [];
  if (action.group === "clothing") return "Одежда";
  if (action.group === "equipment") return "Оснащение и фиксация";
  if (action.group === "pose") return "Положение тела";
  if (tags.includes("clinical")) return "Клиническое воздействие";
  if (tags.includes("pain")) return "Болевое воздействие";
  if (action.group === "intimate") return "Близость";
  return "Мягкий и сенсорный контакт";
};
export const actionIntensity = (action: ActionDef, tags: string[]) => {
  const allTags = new Set([
    ...tags,
    ...(actionSemanticFallback[action.id] || []),
  ]);
  return /hard|whip|belt|taser|shock|needle/.test(action.id)
    ? 3
    : /deep|firm|pinch|slap|bite|scratch|ice|wax/.test(action.id) ||
        allTags.has("pain")
      ? 2
      : 1;
};
const actionImagePath = (action: ActionDef, pointId?: string | null) =>
  resolveActionButtonImage(action.id, action.group, pointId);
export const peakActionImagePath = (observation?: {
  action?: { id?: string; pointId?: string };
} | null) => {
  const actionId = observation?.action?.id;
  if (!actionId) return undefined;
  const action = calibrationActions.find((candidate) => candidate.id === actionId);
  return resolveActionButtonImage(
    actionId,
    action?.group || "contact",
    observation?.action?.pointId,
  );
};
type Step = {
  key: string;
  actionId: string;
  label: string;
  repeat: number;
  pointId?: string;
  pointLabel?: string;
};
type ProtocolStepProgress = {
  status: "pending" | "running" | "completed" | "error";
  completedRepeats: number;
  pleasure: number;
  discomfort: number;
  tension: number;
  capacity: number;
  attitude: number;
  localAttitude: number;
  sensitivity: number;
  openness: number;
  plasticity: number;
  localOpenness: number;
  familiarity: number;
  baselineLocalSensitivity: number;
  overload: number;
  engagement: number;
  appraisal: number;
};
type TrackedMetric =
  | "pleasure"
  | "discomfort"
  | "overload"
  | "engagement"
  | "appraisal"
  | "tension"
  | "capacity"
  | "attitude"
  | "localAttitude"
  | "sensitivity"
  | "localSensitivity"
  | "baselineLocalSensitivity"
  | "openness"
  | "localOpenness"
  | "plasticity"
  | "familiarity";
type CalibrationVisualEffect = {
  key: string;
  family:
    | "electric"
    | "vibration"
    | "impact"
    | "cold"
    | "heat"
    | "soft"
    | "sharp"
    | "restraint"
    | "pulse";
  result: "accepted" | "mixed" | "rejected" | "overload";
  intensity: number;
  sharpness: number;
  enterMs: number;
  holdMs: number;
  exitMs: number;
  rayRotation: number;
  rayOriginX: number;
  rayOriginY: number;
  showRays: boolean;
  showPortrait: boolean;
  target: string;
  emotion?: PortraitEmotion;
  actionKey: string;
  actionImage: string;
  actionLabel: string;
};
const trackedMetricOptions: Array<{ id: TrackedMetric; label: string }> = [
  { id: "attitude", label: "Принятие" },
  { id: "localAttitude", label: "Принятие зоны" },
  { id: "sensitivity", label: "Общая чувствительность" },
  { id: "localSensitivity", label: "Чувствительность зоны" },
  { id: "baselineLocalSensitivity", label: "База чувствительности зоны" },
  { id: "openness", label: "Открытость" },
  { id: "localOpenness", label: "Открытость зоны" },
  { id: "plasticity", label: "Пластичность" },
  { id: "familiarity", label: "Знакомство зоны" },
  { id: "capacity", label: "Ресурс" },
  { id: "tension", label: "Напряжение" },
  { id: "pleasure", label: "Удовольствие" },
  { id: "discomfort", label: "Дискомфорт" },
  { id: "overload", label: "Перегрузка" },
  { id: "engagement", label: "Вовлечённость" },
  { id: "appraisal", label: "Психологическая оценка" },
];
const trackedMetricLabel = (id: TrackedMetric) =>
  trackedMetricOptions.find((option) => option.id === id)?.label || id;
const visualEffectFamily = (
  actionId: string,
): CalibrationVisualEffect["family"] => {
  if (/(shock|taser|electro|tens)/.test(actionId)) return "electric";
  if (/(vibrat|sensory_loop|sensory_pulse)/.test(actionId)) return "vibration";
  if (/(slap|strike|punch|belt|whip)/.test(actionId)) return "impact";
  if (/(ice|cold)/.test(actionId)) return "cold";
  if (/(wax|hot)/.test(actionId)) return "heat";
  if (/(kiss|stroke|massage|lick|breath)/.test(actionId)) return "soft";
  if (/(bite|needle|pinch|scratch)/.test(actionId)) return "sharp";
  if (/(cuff|restraint|suspend|collar|blindfold|gag)/.test(actionId))
    return "restraint";
  return "pulse";
};
type Entry = {
  step: number;
  action: string;
  text: string;
  metrics: string;
  kind?: "normal" | "system" | "warning" | "milestone" | "danger";
};
type Obs = {
  eventLogId?: number;
  behavioralState: string;
  contact?: string;
  action?: { id?: string; label: string; pointId?: string };
  currentState?: { title: string; description: string };
  uiText: string;
  technicalText: string;
  reaction?: {
    pleasure: number;
    discomfort: number;
    overload: number;
    engagement: number;
    mixed?: boolean;
    appraisal?: number;
  };
  changes?: {
    tension?: number;
    capacity?: number;
    attitude?: number;
    openness?: number;
    plasticity?: number;
    localAttitude?: number;
    sensitivity?: number;
    localOpenness?: number;
  };
  learning?: {
    effect: number;
    sensitivityDelta?: number;
    baselineSensitivityDelta?: number;
    attitudeDelta?: number;
    opennessDelta?: number;
    familiarityDelta?: number;
  };
  contexts?: { id: string }[];
  transitions?: {
    kind?: string;
    title: string;
    text: string;
    severity: string;
  }[];
};
type ChatLine = CharacterChatLine;
type Telemetry = {
  summary: string;
  signals: Array<{
    id: string;
    label: string;
    value: string;
    numeric?: number;
    unit?: string;
    trend: "up" | "down" | "stable";
    confidence: string;
    evidence: string[];
  }>;
  behavioral: string[];
  measuredAt: string;
};
type StateSnapshot = {
  at: number;
  sensitivity: number;
  attitude: number;
  openness: number;
  plasticity: number;
  capacity: number;
  tension: number;
  action?: string;
  actions?: string[];
};
type ContractCondition = {
  type: string;
  key?: string;
  operator?: string;
  value: any;
};
type ContractInfo = {
  id: string;
  title: string;
  description: string;
  issuerId: string;
  state: string;
  conditions: ContractCondition[];
  rewards?: Record<string, any>;
};
export const calibrationActions: ActionDef[] = [
  {
    id: "feather_stroke",
    label: "Провести пером",
    hint: "Поверхностный непредсказуемый контакт",
    group: "contact",
  },
  {
    id: "gentle_stroke",
    label: "Мягко погладить",
    hint: "Ровный продолжительный контакт",
    group: "contact",
  },
  {
    id: "tickle",
    label: "Пощекотать",
    hint: "Лёгкий изменчивый контакт",
    group: "contact",
  },
  {
    id: "light_kiss",
    label: "Коротко поцеловать",
    hint: "Мягкий локальный контакт",
    group: "intimate",
  },
  {
    id: "deep_kiss",
    label: "Поцеловать глубоко",
    hint: "Интенсивный продолжительный контакт",
    group: "intimate",
  },
  {
    id: "licking",
    label: "Провести языком",
    hint: "Влажный чувствительный контакт",
    group: "intimate",
  },
  {
    id: "deep_massage",
    label: "Массаж",
    hint: "Глубокое давление и принятие",
    group: "contact",
  },
  {
    id: "ice_cube",
    label: "Коснуться льдом",
    hint: "Контраст и вовлечённость",
    group: "contact",
  },
  {
    id: "hot_wax",
    label: "Капнуть воском",
    hint: "Короткий горячий контраст",
    group: "contact",
  },
  {
    id: "light_bite",
    label: "Прикусить",
    hint: "Игровой острый контакт без намерения причинить боль",
    group: "contact",
  },
  {
    id: "hard_bite",
    label: "Укусить до боли",
    hint: "Намеренно болезненный острый контакт",
    group: "contact",
  },
  {
    id: "pinch",
    label: "Ущипнуть",
    hint: "Короткое локальное давление",
    group: "contact",
  },
  {
    id: "scratching",
    label: "Провести ногтями",
    hint: "Протяжённый острый контакт",
    group: "contact",
  },
  {
    id: "slap",
    label: "Шлёпнуть",
    hint: "Короткий ударный контакт",
    group: "contact",
  },
  {
    id: "hard_slap",
    label: "Ударить ладонью",
    hint: "Сильное намеренно болезненное ударное воздействие",
    group: "contact",
  },
  {
    id: "firm_grip",
    label: "Сильно сжать",
    hint: "Болезненное локальное давление",
    group: "contact",
  },
  {
    id: "needle_prick",
    label: "Сделать укол иглой",
    hint: "Клиническая острая боль",
    group: "contact",
  },
  {
    id: "whip_strike",
    label: "Ударить хлыстом",
    hint: "Крайне интенсивная поверхностная боль",
    group: "contact",
  },
  {
    id: "taser_shock",
    label: "Дать разряд электрошокером",
    hint: "Короткое интенсивное электрическое воздействие",
    group: "contact",
  },
  {
    id: "hair_pull",
    label: "Потянуть за волосы",
    hint: "Натяжение и потеря контроля",
    group: "contact",
  },
  {
    id: "breath_blow",
    label: "Обдуть дыханием",
    hint: "Очень лёгкий температурный и тактильный контакт",
    group: "contact",
  },
  {
    id: "finger_insertion",
    label: "Начать пальцами",
    hint: "Продолжительный внутренний контакт",
    group: "intimate",
  },
  {
    id: "act_start_penetration",
    label: "Начать проникновение",
    hint: "Продолжительный проникающий контакт",
    group: "intimate",
  },
  {
    id: "act_increase_friction",
    label: "Ускорить",
    hint: "Перейти к быстрому темпу",
    group: "intimate",
    contextual: true,
  },
  {
    id: "act_decrease_friction",
    label: "Замедлить",
    hint: "Вернуться к ровному темпу",
    group: "intimate",
    contextual: true,
  },
  {
    id: "act_sexual_climax",
    label: "Резко усилить",
    hint: "Короткий интенсивный импульс без гарантированного оргазма",
    group: "intimate",
    contextual: true,
  },
  {
    id: "act_end_sexual_contact",
    label: "Завершить",
    hint: "Прекратить контакт",
    group: "intimate",
    contextual: true,
  },
  {
    id: "wait",
    label: "Дать паузу",
    hint: "Восстановление к baseline",
    group: "contact",
  },
  {
    id: "pose_standing",
    label: "Поставить прямо",
    hint: "Нейтральная стойка",
    group: "pose",
    pointId: "systemic",
  },
  {
    id: "pose_sitting",
    label: "Посадить",
    hint: "Устойчивое спокойное положение",
    group: "pose",
    pointId: "systemic",
  },
  {
    id: "pose_kneeling",
    label: "Поставить на колени",
    hint: "Подчинённое устойчивое положение",
    group: "pose",
    pointId: "systemic",
  },
  {
    id: "pose_lying_down",
    label: "Уложить",
    hint: "Доступное уязвимое положение",
    group: "pose",
    pointId: "systemic",
  },
  {
    id: "pose_all_fours",
    label: "Поставить на четвереньки",
    hint: "Нагрузка на руки и колени",
    group: "pose",
    pointId: "systemic",
  },
  {
    id: "pose_spread_eagle",
    label: "Широко раскрыть",
    hint: "Лёжа с разведёнными руками и ногами",
    group: "pose",
    pointId: "systemic",
  },
  {
    id: "act_hold_exposure",
    label: "Показать тело",
    hint: "Указать активу принять и удерживать демонстрационную позу",
    group: "pose",
    pointId: "systemic",
    hideWhenContext: "act_hold_exposure",
  },
  {
    id: "act_end_exposure",
    label: "Прекратить показ",
    hint: "Разрешить активу выйти из демонстрационной позы",
    group: "pose",
    pointId: "systemic",
    requiresContext: "act_hold_exposure",
  },
  {
    id: "act_present_feet",
    label: "Предъявить ступни",
    hint: "Удерживать ступни открытыми для осмотра",
    group: "pose",
    pointId: "feet",
    hideWhenContext: "act_present_feet",
  },
  {
    id: "act_end_feet_presentation",
    label: "Завершить осмотр ступней",
    hint: "Вернуться из демонстрационной позы",
    group: "pose",
    pointId: "feet",
    requiresContext: "act_present_feet",
  },
  {
    id: "act_suspend_wrists",
    label: "Подвесить за запястья",
    hint: "Зафиксировать руки над головой и перенести вес на подвес",
    group: "pose",
    pointId: "systemic",
    hideWhenContext: "act_suspend_wrists",
  },
  {
    id: "act_release_wrists",
    label: "Снять с подвеса",
    hint: "Освободить запястья и вернуть опору",
    group: "pose",
    pointId: "systemic",
    requiresContext: "act_suspend_wrists",
  },
  {
    id: "act_apply_handcuffs",
    label: "Надеть наручники",
    hint: "Фиксация запястий",
    group: "equipment",
    pointId: "hands",
    hideWhenContext: "act_apply_handcuffs",
  },
  {
    id: "act_remove_handcuffs",
    label: "Снять наручники",
    hint: "Освободить запястья",
    group: "equipment",
    pointId: "hands",
    requiresContext: "act_apply_handcuffs",
  },
  {
    id: "act_apply_ankle_cuffs",
    label: "Надеть ножные манжеты",
    hint: "Ограничить движение ног",
    group: "equipment",
    pointId: "legs",
    hideWhenContext: "act_apply_ankle_cuffs",
  },
  {
    id: "act_remove_ankle_cuffs",
    label: "Снять ножные манжеты",
    hint: "Освободить лодыжки",
    group: "equipment",
    pointId: "legs",
    requiresContext: "act_apply_ankle_cuffs",
  },
  {
    id: "act_apply_restraint_belt",
    label: "Зафиксировать руки на поясе",
    hint: "Удерживать запястья у талии",
    group: "equipment",
    pointId: "hands",
    hideWhenContext: "act_apply_restraint_belt",
  },
  {
    id: "act_remove_restraint_belt",
    label: "Освободить руки от пояса",
    hint: "Снять поясную фиксацию",
    group: "equipment",
    pointId: "hands",
    requiresContext: "act_apply_restraint_belt",
  },
  {
    id: "act_apply_collar",
    label: "Надеть ошейник",
    hint: "Контроль и доступ к разряду",
    group: "equipment",
    pointId: "neck",
    hideWhenContext: "act_apply_collar",
  },
  {
    id: "act_remove_collar",
    label: "Снять ошейник",
    hint: "Убрать контроль с шеи",
    group: "equipment",
    pointId: "neck",
    requiresContext: "act_apply_collar",
    contextual: true,
  },
  {
    id: "act_shock_collar",
    label: "Разряд через ошейник",
    hint: "Резкое болезненное воздействие",
    group: "equipment",
    pointId: "neck",
    requiresContext: "act_apply_collar",
    contextual: true,
  },
  {
    id: "act_connect_tens",
    label: "Закрепить электроды TENS",
    hint: "Выберите соски или пах как рабочую зону",
    group: "equipment",
    hideWhenContext: "act_connect_tens",
  },
  {
    id: "act_start_electrostimulation",
    label: "Включить электростимуляцию",
    hint: "Устойчивая серия импульсов",
    group: "equipment",
    requiresContext: "act_connect_tens",
    hideWhenContext: "act_start_electrostimulation",
  },
  {
    id: "act_adjust_electrostimulation",
    label: "Усилить электростимуляцию",
    hint: "Повысить частоту и амплитуду",
    group: "equipment",
    requiresContext: "act_start_electrostimulation",
    hideWhenContext: "act_adjust_electrostimulation",
  },
  {
    id: "act_stop_electrostimulation",
    label: "Остановить электростимуляцию",
    hint: "Отключить ток, сохранив электроды",
    group: "equipment",
    requiresContext: "act_start_electrostimulation",
  },
  {
    id: "act_disconnect_tens",
    label: "Снять электроды TENS",
    hint: "Полностью убрать электрический контур",
    group: "equipment",
    requiresContext: "act_connect_tens",
  },
  {
    id: "eq_blindfold_apply",
    label: "Надеть повязку",
    hint: "Убрать зрительный контроль",
    group: "equipment",
    pointId: "head",
    hideWhenContext: "eq_blindfold_apply",
  },
  {
    id: "eq_blindfold_remove",
    label: "Снять повязку",
    hint: "Вернуть зрение",
    group: "equipment",
    pointId: "head",
    requiresContext: "eq_blindfold_apply",
  },
  {
    id: "eq_gag_apply",
    label: "Вставить кляп",
    hint: "Исключить членораздельную речь",
    group: "equipment",
    pointId: "lips",
    hideWhenContext: "eq_gag_apply",
  },
  {
    id: "eq_gag_remove",
    label: "Вынуть кляп",
    hint: "Вернуть возможность говорить",
    group: "equipment",
    pointId: "lips",
    requiresContext: "eq_gag_apply",
  },
  {
    id: "act_insert_plug",
    label: "Ввести сенсорный плаг",
    hint: "Установить внутреннее устройство",
    group: "equipment",
    pointId: "vagina",
    hideWhenContext: "act_insert_plug",
  },
  {
    id: "act_activate_plug",
    label: "Включить плаг",
    hint: "Подать ритмический внутренний импульс",
    group: "equipment",
    pointId: "vagina",
    requiresContext: "act_insert_plug",
    hideWhenContext: "act_activate_plug",
    contextual: true,
  },
  {
    id: "act_deactivate_plug",
    label: "Выключить плаг",
    hint: "Остановить внутреннюю вибрацию",
    group: "equipment",
    pointId: "vagina",
    requiresContext: "act_activate_plug",
    contextual: true,
  },
  {
    id: "act_start_vibrator",
    label: "Закрепить вибратор",
    hint: "Запустить устойчивую вибрацию",
    group: "equipment",
    pointId: "clitoris",
    hideWhenContext: "act_start_vibrator",
  },
  {
    id: "act_adjust_vibration",
    label: "Усилить вибрацию",
    hint: "Перевести устройство в интенсивный режим",
    group: "equipment",
    pointId: "clitoris",
    requiresContext: "act_start_vibrator",
    hideWhenContext: "act_adjust_vibration",
    contextual: true,
  },
  {
    id: "act_stop_vibrator",
    label: "Убрать вибратор",
    hint: "Остановить продолжительное воздействие",
    group: "equipment",
    pointId: "clitoris",
    requiresContext: "act_start_vibrator",
    contextual: true,
  },
  {
    id: "act_remove_plug",
    label: "Извлечь плаг",
    hint: "Снять внутреннее устройство",
    group: "equipment",
    pointId: "vagina",
    requiresContext: "act_insert_plug",
    contextual: true,
  },
  {
    id: "vibrator_pulse",
    label: "Дать импульс",
    hint: "Короткий направленный импульс вибратором",
    group: "equipment",
    pointId: "clitoris",
    contextual: true,
  },
  {
    id: "eq_clothe_jumpsuit",
    label: "Надеть комбинезон",
    hint: "Изолировать большую часть тела",
    group: "clothing",
    pointId: "systemic",
    hideWhenContext: "eq_clothe_jumpsuit",
  },
  {
    id: "eq_clothe_jumpsuit_remove",
    label: "Снять комбинезон",
    hint: "Вернуть доступ к телу",
    group: "clothing",
    pointId: "systemic",
    requiresContext: "eq_clothe_jumpsuit",
  },
  {
    id: "eq_clothe_underwear",
    label: "Надеть бельё",
    hint: "Надеть комплект белья",
    group: "clothing",
    pointId: "systemic",
    hideWhenContext: "eq_clothe_underwear",
  },
  {
    id: "eq_clothe_underwear_remove",
    label: "Снять бельё",
    hint: "Снять комплект белья полностью",
    group: "clothing",
    pointId: "systemic",
    requiresContext: "eq_clothe_underwear",
  },
  {
    id: "eq_clothe_lab_gown",
    label: "Надеть лабораторную рубашку",
    hint: "Свободная одежда для диагностики",
    group: "clothing",
    pointId: "systemic",
    hideWhenContext: "eq_clothe_lab_gown",
  },
  {
    id: "eq_clothe_lab_gown_remove",
    label: "Снять лабораторную рубашку",
    hint: "Открыть тело для работы",
    group: "clothing",
    pointId: "systemic",
    requiresContext: "eq_clothe_lab_gown",
  },
  {
    id: "eq_clothe_calibration_set",
    label: "Надеть калибровочный комплект",
    hint: "Одежда с доступом к датчикам",
    group: "clothing",
    pointId: "systemic",
    hideWhenContext: "eq_clothe_calibration_set",
  },
  {
    id: "eq_clothe_calibration_set_remove",
    label: "Снять калибровочный комплект",
    hint: "Снять топ и шорты",
    group: "clothing",
    pointId: "systemic",
    requiresContext: "eq_clothe_calibration_set",
  },
  {
    id: "eq_clothe_dress",
    label: "Надеть платье",
    hint: "Надеть платье поверх белья или на тело",
    group: "clothing",
    pointId: "systemic",
    hideWhenContext: "eq_clothe_dress",
  },
  {
    id: "eq_clothe_dress_remove",
    label: "Снять платье",
    hint: "Снять верхний слой одежды",
    group: "clothing",
    pointId: "systemic",
    requiresContext: "eq_clothe_dress",
  },
  {
    id: "eq_clothe_stockings",
    label: "Надеть чулки",
    hint: "Добавить чулки к текущему комплекту",
    group: "clothing",
    pointId: "systemic",
    hideWhenContext: "eq_clothe_stockings",
  },
  {
    id: "eq_clothe_stockings_remove",
    label: "Снять чулки",
    hint: "Снять чулки, не меняя остальную одежду",
    group: "clothing",
    pointId: "systemic",
    requiresContext: "eq_clothe_stockings",
  },
];
const actions = calibrationActions;
const pauseAction = actions.find((action) => action.id === "wait")!;
const point = (s: State | null) => s?.anatomy?.[ZONE] || null;
const metricLine = (r: any) =>
  `P ${Number(r?.pleasure || 0).toFixed(1)} · D ${Number(r?.discomfort || 0).toFixed(1)} · O ${Number(r?.overload || 0).toFixed(1)}`;
function calibrationForecast(
  action: ActionDef,
  recent: Obs[],
  metrics: TrackedMetric[],
) {
  const precedent = recent.find((item) => item.action?.id === action.id);
  const approximate = (value: number | undefined) =>
    `~${Number(value || 0).toFixed(1)}`;
  const directional = (value: number | undefined) =>
    typeof value !== "number"
      ? "?"
      : Math.abs(value) < 0.05
        ? "≈"
        : value > 0
          ? "↑"
          : "↓";
  return metrics.map((metric) => {
    const label = trackedMetricLabel(metric).toLowerCase();
    if (action.id === "wait")
      return `${label} ${metric === "capacity" ? "↑" : ["tension", "sensitivity"].includes(metric) ? "↓" : "→ к базе"}`;
    if (!["contact", "intimate"].includes(action.group)) return `${label} —`;
    if (!precedent)
      return `${label} ${metric === "capacity" ? "↓" : metric === "tension" ? "вероятно ↑" : "?"}`;
    const value =
      metric === "pleasure"
        ? precedent.reaction?.pleasure
        : metric === "discomfort"
          ? precedent.reaction?.discomfort
          : metric === "overload"
            ? precedent.reaction?.overload
            : metric === "engagement"
              ? precedent.reaction?.engagement
              : metric === "appraisal"
                ? precedent.reaction?.appraisal
                : metric === "localSensitivity"
                  ? precedent.learning?.sensitivityDelta
                  : metric === "baselineLocalSensitivity"
                    ? precedent.learning?.baselineSensitivityDelta
                    : metric === "familiarity"
                      ? precedent.learning?.familiarityDelta
                      : precedent.changes?.[
                          metric as keyof NonNullable<Obs["changes"]>
                        ];
    return `${label} ${["pleasure", "discomfort", "overload", "engagement", "appraisal", "capacity"].includes(metric) ? approximate(value) : directional(value)}`;
  });
}
const forecastValue = (text?: string) => {
  if (text?.includes("вероятно")) return text.match(/[↑↓]$/)?.[0] || "";
  return text?.match(/(→\s+к\s+базе|~[-+]?\d+(?:\.\d+)?|[↑↓≈—?])$/)?.[1] || "";
};
const forecastIsUncertain = (text?: string) =>
  Boolean(text?.includes("вероятно"));
const forecastIsActive = (text?: string) =>
  Boolean(
    text &&
    !/[—?]$/.test(text) &&
    !text.endsWith("≈") &&
    !/~0(?:\.0+)?$/.test(text),
  );
const forecastTone = (metric: TrackedMetric, text?: string) => {
  const value = forecastValue(text);
  const riskMetric = ["discomfort", "overload", "tension"].includes(metric);
  const approximate = value.match(/^~([-+]?\d+(?:\.\d+)?)$/);
  if (metric === "sensitivity") return "forecast-shift";
  if (approximate) {
    const numeric = Number(approximate[1]);
    if (riskMetric) return numeric > 0 ? "forecast-risk" : "forecast-recovery";
    return numeric >= 0 ? "forecast-rise" : "forecast-fall";
  }
  if (riskMetric && (value.includes("↑") || /^~(?!0(?:\.0+)?$)/.test(value)))
    return "forecast-risk";
  if (value.includes("↑")) return "forecast-rise";
  if (value.includes("↓"))
    return riskMetric ? "forecast-recovery" : "forecast-fall";
  return "forecast-shift";
};
const observationMetricValue = (observation: Obs, metric: TrackedMetric) =>
  ["pleasure", "discomfort", "overload", "engagement", "appraisal"].includes(
    metric,
  )
    ? Number(
        observation.reaction?.[metric as keyof NonNullable<Obs["reaction"]>] ||
          0,
      ).toFixed(1)
    : metric === "localSensitivity"
      ? signed(observation.learning?.sensitivityDelta)
      : metric === "baselineLocalSensitivity"
        ? signed(observation.learning?.baselineSensitivityDelta)
        : metric === "familiarity"
          ? signed(observation.learning?.familiarityDelta)
          : signed(
              observation.changes?.[
                metric as keyof NonNullable<Obs["changes"]>
              ],
            );
const protocolMetricValue = (
  progress: ProtocolStepProgress,
  metric: TrackedMetric,
) =>
  ["pleasure", "discomfort", "overload", "engagement", "appraisal"].includes(
    metric,
  )
    ? Number(progress[metric]).toFixed(1)
    : signed(progress[metric]);
function observation(id: string, r: any, before: State | null, after: State) {
  const p = Number(r?.pleasure || 0),
    d = Number(r?.discomfort || 0),
    o = Number(r?.overload || 0),
    a = point(before),
    b = point(after);
  if (o > 12)
    return "Защитное напряжение сохраняется после воздействия: безопасный предел близко.";
  if (id === "feather_stroke")
    return d > p
      ? "Защита возникает раньше физического дискомфорта: непредсказуемость важнее силы."
      : "Поверхностный контакт принят, но быстро теряет информационную ценность при повторении.";
  if (id === "gentle_stroke")
    return p > d * 1.5
      ? "Ровный контакт телесно приятен. Знакомый повтор может не перекрыть дрейф принятия к базе."
      : "Продолжительность контакта пока вызывает настороженность.";
  if (id === "deep_massage")
    return a && b && b.localSensitivity < a.localSensitivity
      ? "Давление улучшает принятие ценой локальной чувствительности."
      : "Глубокое давление усиливает реакцию без немедленной десенситизации.";
  if (id === "ice_cube")
    return d > p
      ? "Контраст усиливает отклик, но быстро расходует безопасный запас tension."
      : "Контраст возвращает вовлечённость и остаётся положительным.";
  return after.tension < (before?.tension || 0)
    ? "Пауза снижает tension и восстанавливает capacity, но текущее состояние дрейфует к baseline."
    : "Для восстановления требуется больше времени.";
}
const conditionLabels: Record<string, string> = {
  attitude: "Принятие",
  sensitivity: "Чувствительность",
  capacity: "Ресурс",
  openness: "Открытость",
  plasticity: "Пластичность",
  pain: "Отношение к боли",
  restraint: "Отношение к фиксации",
  exposure: "Отношение к демонстрации",
  clinical: "Отношение к медицине",
  electronic: "Отношение к электронике",
  trait_masochist: "Мазохизм",
  trait_restraint_fetish: "Фетиш фиксации",
  trait_conditioned_submission: "Обусловленная покорность",
  trait_exhibitionist: "Эксгибиционизм",
  trait_clinical_fetish: "Медицинский фетиш",
  trait_technophile: "Технофилия",
};
const relativeCoreMetricKeys = new Set<InterpretableCoreMetric>([
  "sensitivity",
  "capacity",
  "openness",
  "plasticity",
]);
const displayConditionValue = (key: string | undefined, value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value))
    return String(value ?? "—");
  return key && relativeCoreMetricKeys.has(key as InterpretableCoreMetric)
    ? `${interpretCoreMetric(key as InterpretableCoreMetric, value).humanPercent}%`
    : value.toFixed(0);
};
const conditionCurrentValue = (
  condition: ContractCondition,
  state: State | null,
) => {
  if (!state) return undefined;
  if (condition.type === "attitude") return state.attitude;
  if (condition.type === "custom" && condition.key)
    return (state as any)[condition.key];
  if (condition.type === "preference" && condition.key)
    return parsePreferences(state.preferences).tags[condition.key] || 0;
  if (condition.type === "acquired_trait" && condition.key)
    return acquiredTraitValue(state.preferences, condition.key);
  return undefined;
};
const conditionValue = (condition: ContractCondition, state: State | null) => {
  if (!state) return undefined;
  const key = condition.type === "attitude" ? "attitude" : condition.key;
  if (condition.type === "preference" || condition.type === "acquired_trait")
    return conditionCurrentValue(condition, state);
  const baselineKeys: Record<
    string,
    "Sensitivity" | "Openness" | "Plasticity" | "Attitude"
  > = {
    sensitivity: "Sensitivity",
    openness: "Openness",
    plasticity: "Plasticity",
    attitude: "Attitude",
  };
  const baselineKey = key ? baselineKeys[key] : undefined;
  return baselineKey
    ? (stateBaseline(state, baselineKey) ??
        conditionCurrentValue(condition, state))
    : conditionCurrentValue(condition, state);
};
const conditionMet = (actual: any, operator = "==", target: any) =>
  operator === ">"
    ? actual > target
    : operator === "<"
      ? actual < target
      : operator === ">="
        ? actual >= target
        : operator === "<="
          ? actual <= target
          : operator === "!="
            ? actual != target
            : actual == target;
const conditionMovement = (
  condition: ContractCondition,
  before: State | null,
  after: State | null,
) => {
  const a = conditionValue(condition, before),
    b = conditionValue(condition, after);
  if (typeof a !== "number" || typeof b !== "number") return null;
  const raw = b - a,
    closer = (condition.operator || "==").startsWith("<") ? -raw : raw;
  return { delta: raw, closer };
};
const signed = (value: number | undefined, digits = 2) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value > 0 ? "+" : ""}${value.toFixed(digits)}`
    : "—";
const baselineDelta = (
  value: number | undefined,
  baseline: number | undefined,
) =>
  typeof value === "number" && typeof baseline === "number"
    ? value - baseline
    : undefined;
const stateBaseline = (
  state: State | null,
  key: "Sensitivity" | "Capacity" | "Openness" | "Attitude" | "Plasticity",
) => {
  if (!state) return undefined;
  const camel = `baseline${key}` as keyof State;
  const snake = `baseline_${key.toLowerCase()}` as keyof State;
  const value = state[camel] ?? state[snake];
  return typeof value === "number" ? value : undefined;
};
const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
function Sparkline({
  values,
  baseline,
  tone = "mint",
}: {
  values: number[];
  baseline?: number;
  tone?: "mint" | "blue" | "amber" | "violet";
}) {
  const validValues = values.filter((value) => Number.isFinite(value));
  const points = validValues.length ? validValues : [0];
  const line = points
    .map((value, index) => {
      const x = points.length === 1 ? 100 : (index / (points.length - 1)) * 100;
      return `${x},${100 - clampPercent(value)}`;
    })
    .join(" ");
  return (
    <svg
      className={`state-sparkline ${tone}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {[25, 50, 75].map((level) => (
        <line
          className="grid"
          x1="0"
          x2="100"
          y1={level}
          y2={level}
          key={level}
        />
      ))}
      {typeof baseline === "number" && (
        <line
          className="baseline"
          x1="0"
          x2="100"
          y1={100 - clampPercent(baseline)}
          y2={100 - clampPercent(baseline)}
        />
      )}
      <polyline className="history" points={line} />
      <circle
        className="latest"
        cx="100"
        cy={100 - clampPercent(points[points.length - 1])}
        r="2.7"
      />
    </svg>
  );
}
const stateFromContexts = (s: State | null) => {
  const ids = new Set((s?.contexts || []).map((c) => c.actionId));
  if (ids.has("effect_apathy") || ids.has("effect_chronic_apathy"))
    return {
      title: "Отключена",
      description:
        "Почти не отвечает на внешние стимулы; осмысленный контакт потерян.",
    };
  if (ids.has("effect_panic"))
    return {
      title: "Паника",
      description: "Стремится прекратить воздействие и восстановить дистанцию.",
    };
  if (ids.has("effect_active_defiance"))
    return {
      title: "Активное сопротивление",
      description:
        "Осмысленно отвергает воздействие и пытается сорвать контакт.",
    };
  if (ids.has("effect_freeze"))
    return {
      title: "Оцепенение",
      description: "Замирает и не может свободно выразить реакцию движением.",
    };
  if (ids.has("effect_sensory_overload"))
    return {
      title: "Сенсорная перегрузка",
      description: "С трудом разделяет ощущения и отвечает с задержкой.",
    };
  if (ids.has("effect_subspace"))
    return {
      title: "Сабспейс",
      description: "Внимание погружено в ощущения; реакции замедлены.",
    };
  return {
    title: "В контакте",
    description: "Осмысленно реагирует на окружение и воздействие.",
  };
};
const visualCharacterSlugs: Record<string, string> = {
  "S-AV-01": "mira",
  "NPC-LAB-01": "iona",
  "NPC-CAND-01": "nika",
  "NPC-CAND-SUMI": "sumi",
  "NPC-CAND-GEN-02": "eli",
  "NPC-CAND-GEN-04": "mai",
};
const bodypartImageAliases: Record<string, string> = {
  head: "face",
  chest: "breasts",
  belly: "stomach",
  knees: "legs",
};
const bodypartVisualPath = (subjectId: string, zoneId?: string) => {
  const character = visualCharacterSlugs[subjectId] || "mira";
  const bodypart = bodypartImageAliases[zoneId || ""] || zoneId || "face";
  return `/character-images/bodyparts/${character}/${bodypart}.png`;
};
const characterVisualPath = (
  subjectId: string,
  state: State | null,
  behavioralState?: string,
  climax = false,
) => {
  const descriptor = buildCalibrationVisualDescriptorV4(
    subjectId,
    state,
    behavioralState,
    climax,
  );
  return (
    resolveCalibrationAvatarV4(descriptor) ||
    `/character-images/cutout/rendered/${descriptor.characterSlug}/standing__${descriptor.clothing}__none__neutral.png`
    || `/character-images/rendered/${descriptor.characterSlug}/standing__${descriptor.clothing}__none__neutral.png`
  );
};
const preparationTargetVisual = (
  subjectId: string,
  state: State | null,
  action?: ActionDef,
) => {
  if (!action) return null;
  const precisePoint =
    action.pointId &&
    !["systemic", "all", "body", "full_body"].includes(action.pointId);
  if (precisePoint)
    return {
      path: bodypartVisualPath(subjectId, action.pointId),
      fullBody: false,
    };

  const poseIds = new Set([
    "pose_standing",
    "pose_sitting",
    "pose_kneeling",
    "pose_lying_down",
    "pose_all_fours",
    "pose_spread_eagle",
    "act_hold_exposure",
    "act_end_exposure",
  ]);
  const clothingIds = new Set([
    "eq_clothe_dress",
    "eq_clothe_stockings",
    "eq_clothe_underwear",
    "eq_clothe_panties",
    "eq_clothe_jumpsuit",
    "eq_clothe_lab_gown",
    "eq_clothe_calibration_set",
  ]);
  let contexts = [...(state?.contexts || [])];

  if (action.group === "pose") {
    contexts = contexts.filter((context) => !poseIds.has(context.actionId));
  }
  if (action.group === "clothing" && !action.id.endsWith("_remove")) {
    contexts = contexts.filter((context) => !clothingIds.has(context.actionId));
  }
  if (action.id.endsWith("_remove") && action.requiresContext) {
    contexts = contexts.filter(
      (context) => context.actionId !== action.requiresContext,
    );
  } else {
    contexts.push({ actionId: action.id });
  }

  const previewState = state
    ? { ...state, contexts }
    : { tension: 0, attitude: 50, openness: 50, contexts };
  const descriptor = buildCalibrationVisualDescriptorV4(
    subjectId,
    previewState,
  );
  descriptor.affect = "neutral";
  const path =
    resolveCalibrationAvatarV4(descriptor) ||
    `/character-images/cutout/rendered/${descriptor.characterSlug}/${descriptor.pose}__${descriptor.clothing}__none__neutral.png`
    || `/character-images/rendered/${descriptor.characterSlug}/${descriptor.pose}__${descriptor.clothing}__none__neutral.png`;
  return { path, fullBody: true };
};
const zoneGroups = [
  {
    id: "head",
    label: "Голова",
    points: ["head", "hair", "face", "lips", "neck"],
  },
  {
    id: "torso",
    label: "Корпус",
    points: ["shoulders", "chest", "nipples", "belly", "back", "waist"],
  },
  {
    id: "limbs",
    label: "Конечности",
    points: ["arms", "hands", "inner_thighs", "legs", "knees", "feet"],
  },
  {
    id: "intimate",
    label: "Интимные зоны",
    points: [
      "buttocks",
      "anus",
      "penis",
      "testicles",
      "prostate",
      "vulva",
      "vagina",
      "clitoris",
    ],
  },
];
const targetAliases: Record<string, string[]> = Object.fromEntries(
  zoneGroups.map((g) => [g.id, g.points]),
);
export function CalibrationZoneMap({
  subjectId,
  zones,
  selectedZoneId,
  blockedPoints = new Set<string>(),
  onSelect,
  onClose,
}: {
  subjectId: string;
  zones: Zone[];
  selectedZoneId?: string;
  blockedPoints?: Set<string>;
  onSelect: (zoneId: string) => void;
  onClose: () => void;
}) {
  return (
    <section className="zone-map-panel shared-calibration-zone-map">
      <header>
        <div>
          <small>ЦЕЛЬ ВОЗДЕЙСТВИЯ</small>
          <h2>Карта тела</h2>
          <p>Выберите область по её текущему отклику.</p>
        </div>
        <button onClick={onClose}>← К операциям</button>
      </header>
      <div className="zone-map-body">
        {zoneGroups.map((group) => {
          const groupZones = zones.filter((zone) =>
            group.points.includes(zone.id),
          );
          return groupZones.length ? (
            <section className={`zone-map-group ${group.id}`} key={group.id}>
              <h3>{group.label}</h3>
              <div>
                {groupZones.map((zone) => {
                  const blocked = blockedPoints.has(zone.id);
                  const selected = zone.id === selectedZoneId;
                  const sensitivity = interpretPointSensitivity(
                    zone.id,
                    zone.local_sensitivity,
                    zone.baseline_local_sensitivity,
                  );
                  const attitude = interpretPointAttitude(
                    zone.local_attitude,
                    zone.baseline_local_attitude,
                  );
                  return (
                    <button
                      className={`zone-image-card ${selected ? "selected" : ""}`}
                      key={zone.id}
                      disabled={blocked}
                      style={
                        {
                          "--zone-image": `url("${bodypartVisualPath(subjectId, zone.id)}")`,
                        } as React.CSSProperties
                      }
                      onClick={() => onSelect(zone.id)}
                    >
                      <span className="zone-image-card__caption">
                        <strong>{zone.label}</strong>
                        <small>
                          {blocked
                            ? "Закрыта контекстом"
                            : selected
                              ? "Текущая цель"
                              : "Доступна"}
                        </small>
                      </span>
                      <span
                        className="zone-map-values"
                        title={`Чувствительность: ${formatRelativeValue(sensitivity)}. Принятие: ${formatRelativeValue(attitude)}.`}
                      >
                        <i>
                          Ч {sensitivity.humanPercent}% · И{" "}
                          {Math.round(sensitivity.value)}
                        </i>
                        <i>
                          П {attitude.humanPercent}% · И{" "}
                          {Math.round(attitude.value)}
                        </i>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null;
        })}
      </div>
      <footer>
        <span>
          <i>Ч</i> чувствительность, % нормы
        </span>
        <span>
          <i>П</i> принятие, % нормы
        </span>
        <span>
          <i>И</i> абсолютный индекс
        </span>
      </footer>
    </section>
  );
}
const calibrationTargetOverrides: Record<string, string[]> = {
  light_kiss: ["feet"],
  licking: ["feet"],
  light_bite: ["feet"],
  hard_bite: ["feet"],
  pinch: ["feet"],
  scratching: ["feet"],
  firm_grip: ["feet"],
  needle_prick: ["feet"],
  hot_wax: ["feet"],
  whip_strike: ["feet"],
  taser_shock: ["feet"],
};
export function CalibrationPrototype({
  subjectId = "S-AV-01",
  subjectName = "Мира",
  nearbyCharacters = [],
  uiTheme = "industrial",
  onThemeChange,
  worldMinute = 0,
  timeLabel,
  timePaused = false,
  onToggleTime,
  onFocusCharacter,
  onExit,
}: {
  subjectId?: string;
  subjectName?: string;
  nearbyCharacters?: Array<{
    id: string;
    name: string;
    role: string;
    title?: string;
    state?: Record<string, any>;
    contexts?: Array<{ id: string }>;
  }>;
  uiTheme?: "industrial" | "graphite" | "paper" | "mist" | "manga" | "manga2";
  onThemeChange?: (theme: "industrial" | "graphite" | "paper" | "mist" | "manga" | "manga2") => void;
  worldMinute?: number;
  timeLabel?: React.ReactNode;
  timePaused?: boolean;
  onToggleTime?: () => void;
  onFocusCharacter?: (characterId: string) => void;
  onExit?: () => void;
} = {}) {
  const SUBJECT = subjectId;
  const [phase, setPhase] = useState<Phase>("preparation"),
    [operationMode, setOperationMode] = useState<OperationMode>("impact"),
    [lastConditioningChanges, setLastConditioningChanges] = useState<
      Array<{ tag: string; delta: number; source?: string }>
    >([]),
    [selectedActionId, setSelectedActionId] = useState(""),
    [selectedZoneId, setSelectedZoneId] = useState(ZONE),
    [zoneOpen, setZoneOpen] = useState(false),
    [zones, setZones] = useState<Zone[]>([]),
    [actionMeta, setActionMeta] = useState<ActionMeta[]>([]),
    [ownedItemIds, setOwnedItemIds] = useState<Set<string>>(new Set()),
    [playerInput, setPlayerInput] = useState(""),
    [speechTargetId, setSpeechTargetId] = useState(SUBJECT),
    [activeSubjectId, setActiveSubjectId] = useState(SUBJECT),
    swapSubjects = (nextId: string) => {
      if ((document as any).startViewTransition) {
        (document as any).startViewTransition(() => {
          flushSync(() => setActiveSubjectId(nextId));
        });
      } else {
        setActiveSubjectId(nextId);
      }
    },
    vtUpdate = (fn: () => void) => {
      if ((document as any).startViewTransition) {
        (document as any).startViewTransition(() => {
          flushSync(fn);
        });
      } else {
        fn();
      }
    },
    [speechTargetMenuOpen, setSpeechTargetMenuOpen] = useState(false),
    [chatLines, setChatLines] = useState<ChatLine[]>([]),
    [generatingSpeech, setGeneratingSpeech] = useState(false),
    [llmError, setLlmError] = useState<string | null>(null),
    [protocolOpen, setProtocolOpen] = useState(false),
    [goalSettingsOpen, setGoalSettingsOpen] = useState(false),
    [goalPickerOpen, setGoalPickerOpen] = useState(false),
    [freeTrackedMetrics, setFreeTrackedMetrics] = useState<TrackedMetric[]>(
      () => {
        try {
          const saved = JSON.parse(
            localStorage.getItem(
              `cyberjack.calibrationMetrics.v2.${SUBJECT}`,
            ) || "[]",
          );
          return Array.isArray(saved) && saved.length
            ? saved.slice(0, 6)
            : ["attitude", "localAttitude", "localSensitivity", "capacity"];
        } catch {
          return ["attitude", "localAttitude", "localSensitivity", "capacity"];
        }
      },
    ),
    [historyOpen, setHistoryOpen] = useState(false),
    [menuOpen, setMenuOpen] = useState(false),
    [visualReviewOpen, setVisualReviewOpen] = useState(false),
    [visualReviewDecision, setVisualReviewDecision] = useState<
      "keep" | "rework" | "reject"
    >("rework"),
    [visualReviewIssues, setVisualReviewIssues] = useState<string[]>([]),
    [visualReviewNote, setVisualReviewNote] = useState(""),
    [visualReviewSaving, setVisualReviewSaving] = useState(false),
    [visualReviewSaved, setVisualReviewSaved] = useState(false),
    [displayedVisualPath, setDisplayedVisualPath] = useState<string | null>(
      null,
    ),
    [visualEffect, setVisualEffect] = useState<CalibrationVisualEffect | null>(
      null,
    ),
    [diagnosticsOpen, setDiagnosticsOpen] = useState(false),
    [subject, setSubject] = useState<State | null>(null),
    [relationAttitude, setRelationAttitude] = useState<number | null>(null),
    [stateHistory, setStateHistory] = useState<StateSnapshot[]>(() => {
      try {
        const saved = JSON.parse(
          localStorage.getItem(`cyberjack.stateHistory.${SUBJECT}`) || "[]",
        );
        return Array.isArray(saved) ? saved.slice(-40) : [];
      } catch {
        return [];
      }
    }),
    [telemetry, setTelemetry] = useState<Telemetry | null>(null),
    [lastStateBefore, setLastStateBefore] = useState<State | null>(null),
    [contracts, setContracts] = useState<ContractInfo[]>([]),
    [trackedContractId, setTrackedContractId] = useState<string | null>(() =>
      localStorage.getItem("cyberjack.trackedContract"),
    ),
    [currentObservation, setCurrentObservation] = useState<Obs | null>(null),
    [activePeakObservation, setActivePeakObservation] = useState<Obs | null>(null),
    [monitorPulse, setMonitorPulse] = useState(0),
    [lastPerformedActionId, setLastPerformedActionId] = useState(""),
    [recentObservations, setRecentObservations] = useState<Obs[]>([]),
    [recommendationObservations, setRecommendationObservations] = useState<
      Obs[]
    >([]),
    [protocolMode, setProtocolMode] = useState<ProtocolMode>("exact"),
    [probes, setProbes] = useState<string[]>([]),
    [findings, setFindings] = useState<string[]>([]),
    [entries, setEntries] = useState<Entry[]>([]),
    [protocol, setProtocol] = useState<Step[]>([]),
    [protocolProgress, setProtocolProgress] = useState<
      Record<string, ProtocolStepProgress>
    >({}),
    [busy, setBusy] = useState(false),
    [running, setRunning] = useState(false),
    [error, setError] = useState<string | null>(null),
    [passive, setPassive] = useState<PassiveMode | null>(null),
    [selectedProcessIndex, setSelectedProcessIndex] = useState(0),
    [processFeedback, setProcessFeedback] = useState<{
      key: string;
      processStart: string;
      command: "slower" | "faster" | "stop" | "tick";
    } | null>(null);
  const stepRef = useRef(0),
    stopRef = useRef(false),
    subjectRef = useRef<State | null>(null),
    observationRef = useRef<Obs | null>(null),
    lastSeenObservationIdRef = useRef<number | null>(null),
    lastWorldSyncMinuteRef = useRef(Math.floor(worldMinute)),
    historyActionRef = useRef<string | undefined>(undefined),
    chatEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => {
      setBusy(false);
      setRunning(false);
    }, 16_000);
    return () => window.clearTimeout(timer);
  }, [busy]);
  const captureChatAvatar = <T extends Omit<ChatLine, "id"> | ChatLine>(
    line: T,
  ): T => {
    if (
      line.avatarPath ||
      line.action ||
      line.role === "calibrator" ||
      line.role === "system"
    )
      return line;
    const speaker = line.speaker.toLowerCase();
    const actorId = line.actorId;
    if (
      speaker === "calibrator" ||
      speaker === "калибратор" ||
      speaker === "system" ||
      speaker === "система"
    )
      return line;
    const explicitSlug = actorId ? visualCharacterSlugs[actorId] : undefined;
    if (explicitSlug && line.portraitEmotion) {
      return {
        ...line,
        avatarPath: `/character-images/portraits/${explicitSlug}/${line.portraitEmotion}.png`,
      };
    }
    if (actorId === SUBJECT || speaker === "mira" || speaker === subjectName.toLowerCase()) {
      const observation = observationRef.current;
      const state = subjectRef.current;
      const emotion = resolvePortraitEmotion({
        behavioralState: observation?.behavioralState,
        reaction: observation?.reaction,
        transitions: observation?.transitions,
        state,
      });
      const slug = visualCharacterSlugs[SUBJECT];
      return slug
        ? {
            ...line,
            avatarPath: `/character-images/portraits/${slug}/${emotion}.png`,
          }
        : line;
    }
    const character = nearbyCharacters.find(
      (entry) =>
        entry.id === actorId ||
        entry.name.toLowerCase() === speaker ||
        entry.id.toLowerCase() === speaker,
    );
    const slug = character ? visualCharacterSlugs[character.id] : undefined;
    const nearbyState = character?.state || {};
    const nearbyEmotion = resolvePortraitEmotion({
      behavioralState: nearbyState.behavioralState,
      reaction: nearbyState.reaction || nearbyState.lastReaction,
      transitions: nearbyState.transitions,
      state: {
        ...nearbyState,
        contexts: (character?.contexts || []).map((context: any) => ({
          actionId: context.actionId || context.id,
        })),
      },
    });
    return slug
      ? {
          ...line,
          avatarPath: `/character-images/portraits/${slug}/${line.portraitEmotion || nearbyEmotion}.png`,
        }
      : line;
  };
  useEffect(() => setSpeechTargetId(SUBJECT), [SUBJECT]);
  const load = async () => {
    const q = await fetch(
        `/api/state?subjectId=${SUBJECT}&sceneId=${SCENE}&pointId=${selectedZoneId || ZONE}`,
        { signal: AbortSignal.timeout(15_000) },
      ),
      d = await q.json();
    if (!d.success) throw new Error(d.error);
    // Apply state updates inside View Transition for smooth visual crossfade
    const applyState = () => {
    subjectRef.current = d.subject;
    setSubject(d.subject);
    setRelationAttitude(
      d.relations?.find(
        (relation: any) =>
          relation.toId === "PL-1" || relation.to_id === "PL-1",
      )?.attitude ?? null,
    );
    setTelemetry(d.telemetry || null);
    const loadedObservations = (d.recentObservations || []) as Obs[];
    const newestObservationId = loadedObservations.reduce(
      (latest, observation) => Math.max(latest, Number(observation.eventLogId || 0)),
      0,
    );
    if (lastSeenObservationIdRef.current !== null) {
      const unseenPeak = loadedObservations.find(
        (observation) =>
          Number(observation.eventLogId || 0) > lastSeenObservationIdRef.current! &&
          observation.transitions?.some((transition) =>
            ["discharge", "overload", "breakdown"].includes(transition.kind || ""),
          ),
      );
      if (unseenPeak) setActivePeakObservation(unseenPeak);
    }
    if (newestObservationId > 0) {
      lastSeenObservationIdRef.current = Math.max(
        lastSeenObservationIdRef.current || 0,
        newestObservationId,
      );
    }
    setRecentObservations(loadedObservations);
    setRecommendationObservations(
      d.recommendationObservations || d.recentObservations || [],
    );
    if (d.recentObservations?.[0]) {
      observationRef.current = d.recentObservations[0];
      setCurrentObservation(d.recentObservations[0]);
    }
    setZones(d.availablePoints || []);
    setActionMeta(d.availableActions || []);
    setOwnedItemIds(
      new Set((d.player?.inventory || []).map((item: any) => item.id)),
    );
    };
    // Execute state updates inside View Transition with flushSync
    if ((document as any).startViewTransition) {
      (document as any).startViewTransition(() => {
        flushSync(applyState);
      });
    } else {
      applyState();
    }
    return d.subject as State;
  };
  const append = (e: Omit<Entry, "step">) => {
    stepRef.current++;
    setEntries((x) => [...x, { ...e, step: stepRef.current }].slice(-16));
  };
  const pushChat = (...lines: Array<Omit<ChatLine, "id">>) =>
    setChatLines((current) =>
      appendCharacterChatLines(current, lines.map(captureChatAvatar), 100),
    );
  const loadContracts = async () => {
    const q = await fetch("/api/contracts?playerId=PL-1"),
      d = await q.json();
    if (!d.success) throw new Error(d.error);
    setContracts([...(d.accepted || []), ...(d.available || [])]);
    return d;
  };
  const loadChat = async () => {
    // Dialogue is owned by the character being addressed. A calibration scene
    // may include the subject and assistants, so restoring only SUBJECT drops
    // every exchange that was addressed to an assistant.
    const participants = Array.from(
      new Set([SUBJECT, ...nearbyCharacters.map((character) => character.id)]),
    );
    const histories = await Promise.all(
      participants.map(async (participantId) => {
        const q = await fetch(
            `/api/characters/${participantId}/chat?limit=100`,
          ),
          d = await q.json();
        if (!d.success) return [];
        return (d.messages || []).map((message: any) => ({
          ...message,
          participantId,
        }));
      }),
    );
    const participantNames = new Map(
      nearbyCharacters.map((character) => [character.id, character.name]),
    );
    const restored = histories
      .flat()
      .sort((left: any, right: any) => Number(left.id) - Number(right.id))
      .map((message: any) => {
        const action = String(message.content || "").match(
          /^\[Действие\]\s*(.*)$/s,
        );
        const isSystem = message.contextLabel === "Система" || String(message.content || "").startsWith("→");
        const systemAction = isSystem && !action;
        const slug = visualCharacterSlugs[message.participantId];
        return {
          id: String(message.id),
          actorId:
            message.role === "assistant" ? message.participantId : undefined,
          speaker: action || isSystem
            ? "system"
            : message.role === "assistant"
              ? message.participantId === SUBJECT
                ? "mira"
                : participantNames.get(message.participantId) ||
                  message.participantId
              : "calibrator",
          role: action || isSystem
            ? "system"
            : message.role === "assistant"
              ? message.participantId === SUBJECT
                ? "character"
                : "observer"
              : "calibrator",
          text: action ? action[1] : message.content,
          context: message.contextLabel,
          action: Boolean(action) || systemAction,
          avatarPath:
            message.role === "assistant" && message.portraitEmotion && slug
              ? `/character-images/portraits/${slug}/${message.portraitEmotion}.png`
              : undefined,
        };
      });
    setChatLines(
      collapseRepeatedChatActions(restored.map(captureChatAvatar)).slice(-100),
    );
    return restored;
  };
  const trackContract = (id: string | null) => {
    setTrackedContractId(id);
    if (id) localStorage.setItem("cyberjack.trackedContract", id);
    else localStorage.removeItem("cyberjack.trackedContract");
  };
  const acceptContract = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const q = await fetch(`/api/contracts/${id}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: "PL-1" }),
        }),
        d = await q.json();
      if (!d.success) throw new Error(d.error);
      trackContract(id);
      await loadContracts();
      append({
        action: "Контракт принят",
        text: d.contract.title,
        metrics: "Актив не закреплён за заказом.",
        kind: "system",
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const deliverContract = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const q = await fetch(`/api/contracts/${id}/deliver`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subjectId: SUBJECT }),
        }),
        d = await q.json();
      if (!d.success) {
        if (d.metRequirements === false)
          throw new Error(
            `Актив не соответствует: ${(d.unmet || []).join("; ")}`,
          );
        throw new Error(d.error);
      }
      append({
        action: "Актив передан заказчику",
        text: d.contract.title,
        metrics: "Контракт выполнен.",
        kind: "milestone",
      });
      trackContract(null);
      await loadContracts();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const toggleContext = async (active: boolean) => {
    const q = await fetch("/api/contexts/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: SUBJECT,
          contextId: "device_sensory_loop",
          isActive: active,
          pointId: ZONE,
        }),
      }),
      d = await q.json();
    if (!d.success) throw new Error(d.error);
  };
  const reset = async () => {
    setBusy(true);
    stopRef.current = true;
    try {
      await toggleContext(false).catch(() => {});
      await fetch("/api/subject/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: SUBJECT,
          sensitivity: 55,
          capacity: 72,
          openness: 58,
          plasticity: 72,
          attitude: 50,
          tension: 0,
          baselineSensitivity: 55,
          baselineCapacity: 72,
          baselineOpenness: 58,
          baselinePlasticity: 72,
          baselineAttitude: 50,
        }),
      });
      await fetch("/api/subject/point", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: SUBJECT,
          pointId: ZONE,
          localSensitivity: 54,
          localAttitude: 46,
          localOpenness: 48,
          familiarity: 0,
          exposureCount: 0,
          baselineLocalSensitivity: 54,
          baselineLocalAttitude: 46,
          baselineLocalOpenness: 48,
        }),
      });
      stepRef.current = 0;
      setPhase("preparation");
      setLastStateBefore(null);
      setProbes([]);
      setFindings([]);
      setProtocol([]);
      setPassive(null);
      setPlayerInput("");
      setLlmError(null);
      setEntries([
        {
          step: 0,
          action: "Новая калибровочная сессия",
          text: "Актив готов к свободной работе.",
          metrics: "Ориентир можно выбрать или отключить.",
          kind: "system",
        },
      ]);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      stopRef.current = false;
    }
  };
  useEffect(() => {
    vtUpdate(() => {
      Promise.all([load(), loadContracts(), loadChat()]).catch((e) =>
        setError(e.message),
      );
    });
  }, []);
  useEffect(() => {
    const minute = Math.floor(worldMinute);
    if (minute === lastWorldSyncMinuteRef.current) return;
    lastWorldSyncMinuteRef.current = minute;
    vtUpdate(() => load().catch((error) => setError(error.message)));
  }, [worldMinute, SUBJECT]);
  useEffect(() => {
    if (!activePeakObservation) return;
    const timer = window.setTimeout(() => setActivePeakObservation(null), 3200);
    return () => window.clearTimeout(timer);
  }, [activePeakObservation?.eventLogId]);
  useEffect(() => {
    if (!subject) return;
    const activeInfluences = (subject.contexts || [])
      .filter((context) =>
        [
          "pose",
          "interaction",
          "sexual_interaction",
          "interaction_level",
        ].includes(context.type || ""),
      )
      .map((context) => context.label || context.actionId);
    const actions = Array.from(
      new Set(
        [
          ...(historyActionRef.current?.split(" · ") || []),
          ...activeInfluences,
        ].filter((value): value is string => Boolean(value)),
      ),
    );
    const snapshot: StateSnapshot = {
      at: worldMinute,
      sensitivity: subject.sensitivity,
      attitude: subject.attitude,
      openness: subject.openness,
      plasticity: subject.plasticity,
      capacity: subject.capacity,
      tension: subject.tension,
      action: historyActionRef.current,
      actions,
    };
    setStateHistory((current) => {
      const last = current[current.length - 1];
      if (
        last &&
        [
          "sensitivity",
          "attitude",
          "openness",
          "plasticity",
          "capacity",
          "tension",
        ].every(
          (key) =>
            Math.abs(
              ((last[key as keyof StateSnapshot] as number) -
                snapshot[key as keyof StateSnapshot]) as number,
            ) < 0.001,
        )
      ) {
        historyActionRef.current = undefined;
        return current;
      }
      const next = [...current, snapshot].slice(-40);
      localStorage.setItem(
        `cyberjack.stateHistory.${SUBJECT}`,
        JSON.stringify(next),
      );
      historyActionRef.current = undefined;
      return next;
    });
  }, [
    subject?.sensitivity,
    subject?.attitude,
    subject?.openness,
    subject?.plasticity,
    subject?.capacity,
    subject?.tension,
    SUBJECT,
    worldMinute,
  ]);
  useEffect(() => {
    localStorage.setItem(
      `cyberjack.calibrationMetrics.v2.${SUBJECT}`,
      JSON.stringify(freeTrackedMetrics),
    );
  }, [freeTrackedMetrics, SUBJECT]);
  useEffect(() => () => gameAudio.stop(), []);
  useEffect(() => {
    if (!visualEffect) return;
    const timer = window.setTimeout(
      () => setVisualEffect(null),
      Math.max(
        visualEffect.enterMs + visualEffect.holdMs + visualEffect.exitMs,
        gameEffectDurationMs(visualEffect.family),
      ) + 80,
    );
    return () => window.clearTimeout(timer);
  }, [visualEffect?.key]);
  useEffect(() => {
    if (!processFeedback) return;
    const timer = window.setTimeout(() => setProcessFeedback(null), 900);
    return () => window.clearTimeout(timer);
  }, [processFeedback?.key]);
  useEffect(() => {
    if (
      phase === "diagnosis" &&
      probes.length === 0 &&
      subject?.tension === 0
    ) {
      observationRef.current = null;
      setCurrentObservation(null);
      setLlmError(null);
      const resettable = (subject.contexts || []).filter(
        (c) =>
          c.actionId.startsWith("effect_") ||
          c.actionId.startsWith("pose_") ||
          [
            "act_apply_handcuffs",
            "act_apply_ankle_cuffs",
            "act_apply_restraint_belt",
            "act_apply_collar",
            "eq_blindfold_apply",
            "eq_gag_apply",
            "act_insert_plug",
            "act_activate_plug",
            "act_start_vibrator",
            "act_adjust_vibration",
            "act_connect_tens",
            "act_start_electrostimulation",
            "act_adjust_electrostimulation",
            "device_sensory_loop",
          ].includes(c.actionId),
      );
      if (resettable.length)
        Promise.all(
          resettable.map((c) =>
            fetch("/api/contexts/toggle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subjectId: SUBJECT,
                contextId: c.actionId,
                isActive: false,
              }),
            }),
          ),
        )
          .then(() => load())
          .catch(() => {});
    }
  }, [phase, probes.length, subject?.tension]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chatLines, generatingSpeech]);
  const request = async (item: Step, callLLM = false) => {
    const wait = item.actionId === "wait",
      q = await fetch(wait ? "/api/wait" : "/api/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify(
          wait
            ? {
                subjectId: SUBJECT,
                eventId: SCENE,
                ticks: 1,
                deltaTime: 10,
                callLLM: false,
                interactionContext: "Диагностический стол",
              }
            : {
                subjectId: SUBJECT,
                playerId: "PL-1",
                sceneId: SCENE,
                pointId: item.pointId || ZONE,
                presetId: item.actionId,
                skipLLM: !callLLM,
                deferLLM: callLLM,
                llmMode: callLLM
                  ? "scene_chance"
                  : undefined,
                skipImageGen: true,
                interactionContext: "Диагностический стол",
              },
        ),
      }),
      d = await q.json();
    if (!d.success) throw new Error(d.error || "Ошибка тика");
    return d;
  };
  const recordObservation = (
    label: string,
    shared: Obs | undefined,
    fallbackText: string,
    fallbackMetrics: string,
  ) => {
    if (shared) {
      observationRef.current = shared;
      setCurrentObservation(shared);
      setMonitorPulse((pulse) => pulse + 1);
      setLastPerformedActionId(shared.action?.id || "");
    }
    append({
      action: label,
      text: shared?.uiText || fallbackText,
      metrics: shared?.technicalText || fallbackMetrics,
    });
    for (const transition of shared?.transitions || [])
      append({
        action: transition.title,
        text: transition.text,
        metrics: "Состояние актива изменилось",
        kind: transition.severity === "danger" ? "danger" : "milestone",
      });
  };
  const passiveTick = async () => {
    if (!passive) return;
    const id =
        passive === "gentle" ? "device_sensory_pulse" : "device_contrast_pulse",
      label =
        passive === "gentle"
          ? "Фоновый ритмический импульс"
          : "Фоновый контрастный импульс",
      item = { key: crypto.randomUUID(), actionId: id, label, repeat: 1 },
      before = subjectRef.current,
      d = await request(item),
      after = await load(),
      shared = (d.diagnostics || d.bundle?.diagnostics)?.observation;
    recordObservation(
      label,
      shared,
      observation(
        passive === "gentle" ? "gentle_stroke" : "ice_cube",
        d.tickResult,
        before,
        after,
      ),
      metricLine(d.tickResult),
    );
    return after;
  };
  const perform = async (item: Step, diagnostic = false, callLLM = false) => {
    // Physical feedback belongs to the click, not to the eventual server/LLM
    // response. Start it from authored action data immediately and enrich it
    // with the resolved reaction once the mechanical tick returns.
    let immediateVisualKey: string | null = null;
    if (item.actionId !== "wait") {
      const visualAction = calibrationActions.find(
        (action) => action.id === item.actionId,
      );
      const actionVector = actionMeta.find((meta) => meta.id === item.actionId);
      const rawIntensity = Number(actionVector?.intensity ?? 0.35);
      const rawSharpness = Number(actionVector?.sharpness ?? 0.3);
      const intensity = Math.max(
        0.08,
        Math.min(1, Math.abs(rawIntensity) > 1 ? rawIntensity / 10 : rawIntensity),
      );
      const sharpness = Math.max(
        0,
        Math.min(1, Math.abs(rawSharpness) > 1 ? rawSharpness / 10 : rawSharpness),
      );
      const pointId = item.pointId || selectedZone?.id || "systemic";
      immediateVisualKey = crypto.randomUUID();
      void gameAudio.playAction(item.actionId);
      setVisualEffect({
        key: immediateVisualKey,
        family: visualEffectFamily(item.actionId),
        result: "accepted",
        intensity,
        sharpness,
        enterMs: Math.round(330 - sharpness * 70),
        holdMs: Math.round(540 + intensity * 180),
        exitMs: Math.round(680 - sharpness * 90),
        rayRotation: -7 + Math.random() * 14,
        rayOriginX: 30 + Math.random() * 15,
        rayOriginY: 30 + Math.random() * 13,
        showRays:
          visualEffectFamily(item.actionId) !== "soft" ||
          intensity + sharpness > 0.72,
        showPortrait: false,
        target: item.pointLabel || selectedZone?.label || "системно",
        emotion: resolvePortraitEmotion({ state: subjectRef.current }),
        actionKey: `${pointId}/${item.actionId}`,
        actionImage: visualAction
          ? actionImagePath(visualAction, pointId)
          : `/character-images/actions/contact/${item.actionId}.png`,
        actionLabel: visualAction?.label || item.label,
      });
    }
    try {
      const before = subjectRef.current;
      setLastStateBefore(before ? { ...before } : null);
      const d = await request(item, callLLM);
      const tickTransitions = (
        (d.diagnostics || d.bundle?.diagnostics)?.observation?.transitions || []
      )
        .map((transition: any) => transition.title)
        .filter(Boolean);
      historyActionRef.current =
        item.actionId === "wait"
          ? Array.isArray(d.sustainedEffects) && d.sustainedEffects.length
            ? [
                ...d.sustainedEffects.map((effect: any) => effect.label),
                ...tickTransitions,
              ].join(" · ")
            : ["Ожидание", ...tickTransitions].join(" · ")
          : [item.label, ...tickTransitions].join(" · ");
      if (item.actionId !== "wait") {
        pushChat({
          speaker: "system",
          text: `${item.label} · ${item.pointLabel || selectedZone?.label || "системно"}`,
          context: "Действие",
          action: true,
        });
      } else if (
        Array.isArray(d.sustainedEffects) &&
        d.sustainedEffects.length
      ) {
        pushChat(
          ...d.sustainedEffects.map((effect: any) => ({
            speaker: "system",
            text: `${effect.label} · ${effect.pointId}`,
            context: "Продолжается",
            action: true,
            repeat: effect.pulses,
          })),
        );
      }
      let after = await load(),
        shared = (d.diagnostics || d.bundle?.diagnostics)?.observation as
          Obs | undefined,
        insight =
          shared?.uiText ||
          observation(item.actionId, d.tickResult, before, after);
      if (item.actionId === "wait") {
        setLastConditioningChanges([]);
      } else {
        const beforeTags = parsePreferences(before?.preferences).tags;
        const afterTags = parsePreferences(after?.preferences).tags;
        const directTags = new Set([
          ...(actionMeta.find((meta) => meta.id === item.actionId)?.tags || []),
          ...(actionSemanticFallback[item.actionId] || []),
        ]);
        setLastConditioningChanges(
          Array.from(
            new Set([...Object.keys(beforeTags), ...Object.keys(afterTags)]),
          )
            .map((tag) => {
              const sourceContext = !directTags.has(tag)
                ? (after?.contexts || []).find((context) =>
                    (
                      actionMeta.find((meta) => meta.id === context.actionId)
                        ?.tags || []
                    ).includes(tag),
                  )
                : undefined;
              return {
                tag,
                delta: (afterTags[tag] || 0) - (beforeTags[tag] || 0),
                source: sourceContext?.label || sourceContext?.actionId,
              };
            })
            .filter((entry) => Math.abs(entry.delta) >= 0.001)
            .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
            .slice(0, 4),
        );
      }
      recordObservation(item.label, shared, insight, metricLine(d.tickResult));
      let turnEmotion: PortraitEmotion | undefined;
      const sustainedVisual =
        item.actionId === "wait" && Array.isArray(d.sustainedEffects)
          ? d.sustainedEffects.find(
              (effect: any) =>
                effect.sourceActionId ===
                activeProcesses[safeProcessIndex]?.start,
            ) || d.sustainedEffects[0]
          : undefined;
      const visualActionId =
        item.actionId !== "wait"
          ? item.actionId
          : sustainedVisual?.sourceActionId;
      if (visualActionId) {
        const reaction = shared?.reaction || d.tickResult || {};
        const actionVector = actionMeta.find(
          (meta) => meta.id === visualActionId,
        );
        const rawActionIntensity = Number(actionVector?.intensity ?? 0.35);
        const rawActionSharpness = Number(actionVector?.sharpness ?? 0.3);
        const actionIntensity = Math.max(
          0,
          Math.min(
            1,
            Math.abs(rawActionIntensity) > 1
              ? rawActionIntensity / 10
              : rawActionIntensity,
          ),
        );
        const actionSharpness = Math.max(
          0,
          Math.min(
            1,
            Math.abs(rawActionSharpness) > 1
              ? rawActionSharpness / 10
              : rawActionSharpness,
          ),
        );
        const reactionMagnitude = Math.min(
          1,
          (Number(reaction.pleasure || 0) +
            Number(reaction.discomfort || 0) +
            Number(reaction.overload || 0)) /
            20,
        );
        const effectIntensity = Math.max(
          0.08,
          Math.min(1, actionIntensity * 0.72 + reactionMagnitude * 0.28),
        );
        const reactionAudioIntensity = Math.max(
          reactionMagnitude,
          Math.min(1, actionIntensity * 0.55 + actionSharpness * 0.15),
        );
        const enterMs = Math.round(
          330 - actionSharpness * 70 + (Math.random() - 0.5) * 16,
        );
        const holdMs = Math.round(
          540 + effectIntensity * 180 + (Math.random() - 0.5) * 34,
        );
        const exitMs = Math.round(
          680 - actionSharpness * 90 + (Math.random() - 0.5) * 18,
        );
        const showPortrait =
          effectIntensity >= 0.42 || Math.random() < effectIntensity * 0.72;
        const overload = Number(reaction.overload || 0);
        const appraisal = Number(
          reaction.appraisal ?? d.tickResult?.finalValence ?? 0,
        );
        const mixed =
          Boolean(reaction.mixed) ||
          (Number(reaction.pleasure || 0) > 0.5 &&
            Number(reaction.discomfort || 0) > 0.5);
        turnEmotion = (shared?.reactionSnapshot?.affect?.emotion as PortraitEmotion) || resolvePortraitEmotion({
          behavioralState: shared?.behavioralState,
          reaction,
          transitions: shared?.transitions,
          state: after,
        });
        const visualPointId =
          sustainedVisual?.pointId || item.pointId || selectedZone?.id;
        const visualAction = calibrationActions.find(
          (action) => action.id === visualActionId,
        );
        if (!immediateVisualKey) void gameAudio.playAction(visualActionId);
        const audioCharacter = visualCharacterSlugs[SUBJECT];
        if (audioCharacter) {
          void gameAudio.playReaction(
            audioCharacter,
            turnEmotion,
            reactionAudioIntensity,
          );
        }
        const resolvedVisualEffect: CalibrationVisualEffect = {
          key: crypto.randomUUID(),
          family: visualEffectFamily(visualActionId),
          result:
            overload > 8
              ? "overload"
              : mixed
                ? "mixed"
                : appraisal < 0
                  ? "rejected"
                  : "accepted",
          intensity: effectIntensity,
          sharpness: actionSharpness,
          enterMs,
          holdMs,
          exitMs,
          rayRotation: -7 + Math.random() * 14,
          rayOriginX: 30 + Math.random() * 15,
          rayOriginY: 30 + Math.random() * 13,
          showRays:
            visualEffectFamily(visualActionId) !== "soft" ||
            effectIntensity + actionSharpness > 0.72,
          showPortrait,
          target: sustainedVisual?.pointId
            ? zones.find((zone) => zone.id === sustainedVisual.pointId)
                ?.label || sustainedVisual.pointId
            : item.pointLabel || selectedZone?.label || "системно",
          emotion: turnEmotion,
          actionKey: `${visualPointId || "systemic"}/${visualActionId}`,
          actionImage: visualAction
            ? actionImagePath(visualAction, visualPointId)
            : `/character-images/actions/contact/${visualActionId}.png`,
          actionLabel: visualAction?.label || item.label,
        };
        if (immediateVisualKey) {
          const visualKey = immediateVisualKey;
          setVisualEffect((current) =>
            current?.key === visualKey
              ? {
                  ...current,
                  result: resolvedVisualEffect.result,
                  emotion: resolvedVisualEffect.emotion,
                  showPortrait: resolvedVisualEffect.showPortrait,
                  intensity: Math.max(current.intensity, effectIntensity),
                }
              : current,
          );
        } else {
          setVisualEffect(resolvedVisualEffect);
        }
      }
      if (callLLM) {
        // The deferred reply starts only after the immediate physical feedback
        // is already visible, so the chat never leads the action animation.
        setGeneratingSpeech(true);
        void (async () => {
          try {
            let replyPayload = d;
            if (d.replyPending && d.replyJobId) {
              const streamingId = `stream:${d.replyJobId}`;
              let streamFinished = false;
              const job = await streamDeferredReply(d.replyJobId, (text) => {
                if (streamFinished) return;
                setChatLines((previous) => {
                  if (streamFinished) return previous;
                  const existing = previous.some((line) => line.id === streamingId);
                  if (existing)
                    return previous.map((line) =>
                      line.id === streamingId ? { ...line, text } : line,
                    );
                  return [...previous, captureChatAvatar({
                    id: streamingId,
                    actorId: SUBJECT,
                    speaker: subjectName,
                    text,
                  } as ChatLine)];
                });
              });
              streamFinished = true;
              setChatLines((previous) => previous.filter((line) => line.id !== streamingId));
              if (job.done) {
                replyPayload = {
                  ...d,
                  replyPending: false,
                  reply: job.metrics?.reply || null,
                  actorReplies: job.metrics?.actorReplies || [],
                  llmError: job.error || null,
                };
              }
            }
            const replies = (replyPayload.actorReplies || []).filter(
              (reply: any) => reply.speech,
            );
            const speech = replyPayload.reply?.speech || "";
            const replyEmotion = replyPayload.reply?.portraitEmotion || turnEmotion;
            const avatarPath =
              replyEmotion && visualCharacterSlugs[SUBJECT]
                ? `/character-images/portraits/${visualCharacterSlugs[SUBJECT]}/${replyEmotion}.png`
                : undefined;
            setLlmError(replyPayload.llmError || null);
            if (replies.length)
              pushChat(
                ...replies.map((reply: any) => ({
                  actorId: reply.actorId,
                  speaker:
                    reply.actorId === SUBJECT
                      ? "mira"
                      : reply.actorName || reply.actorId,
                  text: reply.speech,
                  context: "Диагностический стол",
                  portraitEmotion: reply.portraitEmotion || replyEmotion,
                  avatarPath:
                    reply.actorId === SUBJECT
                      ? avatarPath
                      : reply.portraitEmotion && visualCharacterSlugs[reply.actorId]
                        ? `/character-images/portraits/${visualCharacterSlugs[reply.actorId]}/${reply.portraitEmotion}.png`
                        : undefined,
                })),
              );
            // Visual effect for proactive NPC physical actions
            for (const reply of replies) {
              if (reply.kind === "proactive" && reply.mechanicalAction) {
                const actionId = reply.mechanicalAction.actionId;
                const targetId = reply.mechanicalAction.targetId;
                const pointId = reply.mechanicalAction.pointId;
                if (actionId && targetId) {
                  void gameAudio.playAction(actionId);
                  setVisualEffect({
                    key: crypto.randomUUID(),
                    family: visualEffectFamily(actionId),
                    result: "accepted",
                    intensity: 0.5,
                    sharpness: 0.3,
                    enterMs: 280,
                    holdMs: 600,
                    exitMs: 600,
                    rayRotation: -5 + Math.random() * 10,
                    rayOriginX: 32 + Math.random() * 12,
                    rayOriginY: 32 + Math.random() * 12,
                    showRays: visualEffectFamily(actionId) !== "soft",
                    showPortrait: false,
                    target: pointId || "системно",
                    emotion: reply.portraitEmotion || "neutral",
                    actionKey: `${pointId}/${actionId}`,
                    actionImage: `/character-images/actions/contact/${actionId}.png`,
                  });
                }
              }
            }
            if (!replies.length && speech)
              pushChat({
                actorId: SUBJECT,
                speaker: subjectName,
                text: speech,
                context: "Диагностический стол",
                avatarPath,
              });
            else if (!replies.length && replyPayload.llmError)
              pushChat({ speaker: "system", text: "Ответ модели недоступен." });
            else if (!replyPayload.llmSkipped)
              pushChat({ speaker: "system", text: `${subjectName} молчит.` });
          } finally {
            setGeneratingSpeech(false);
          }
        })();
      }
      if (diagnostic && item.actionId !== "wait") {
        setProbes((x) => {
          const n = x.includes(item.actionId) ? x : [...x, item.actionId];
          if (n.length >= 3) setPhase("preparation");
          return n;
        });
        setFindings((x) =>
          x.includes(insight) ? x : [...x, insight].slice(-4),
        );
      }
      if (passive) after = (await passiveTick()) || after;
      return { after, result: d.tickResult, observation: shared };
    } finally {
      // Deferred speech is delivered independently; the physical action no
      // longer keeps the workbench busy while the model is generating.
    }
  };
  const anatomyZones = () =>
    zones.filter((z) =>
      zoneGroups.some((group) => group.points.includes(z.id)),
    );
  const zonesForAction = (a: ActionDef) => {
    if (a.pointId) return zones.filter((z) => z.id === a.pointId);
    const targets = Array.from(
      new Set([
        ...(actionMeta.find((meta) => meta.id === a.id)?.validTargets || []),
        ...(calibrationTargetOverrides[a.id] || []),
      ]),
    );
    const allowed = new Set(
      targets.flatMap((target) => targetAliases[target] || [target]),
    );
    const playable = anatomyZones();
    return allowed.size ? playable.filter((z) => allowed.has(z.id)) : playable;
  };
  const playableZones = (group: Extract<ActionGroup, "contact" | "intimate">) =>
    anatomyZones().filter((zone) =>
      actions.some(
        (action) =>
          action.group === group &&
          !action.contextual &&
          action.id !== "wait" &&
          (!action.requiresContext ||
            activeContextIds.has(action.requiresContext)) &&
          (!action.hideWhenContext ||
            !activeContextIds.has(action.hideWhenContext)) &&
          zonesForAction(action).some((candidate) => candidate.id === zone.id),
      ),
    );
  const resolvedZone = (a: ActionDef) => {
    const compatible = zonesForAction(a),
      chosen = zones.find((z) => z.id === (effectiveZoneId || selectedZoneId)),
      selected =
        chosen && compatible.some((z) => z.id === chosen.id)
          ? chosen
          : compatible[0];
    return (
      selected || ({ id: a.pointId || ZONE, label: a.pointId || "Шея" } as Zone)
    );
  };
  const manualAt = async (a: ActionDef, pointId?: string) => {
    if (busy) return;
    const target = pointId
      ? zones.find((zone) => zone.id === pointId) ||
        ({ id: pointId, label: pointId } as Zone)
      : resolvedZone(a);
    setBusy(true);
    setError(null);
    setLlmError(null);
    try {
      await perform(
        {
          key: crypto.randomUUID(),
          actionId: a.id,
          label: a.label,
          repeat: 1,
          pointId: target.id,
          pointLabel: target.label,
        },
        phase === "diagnosis" && a.group === "contact",
        a.id !== "wait",
      );
    } catch (e: any) {
      setError(e.message);
      pushChat({
        speaker: "system",
        text: e.message,
        context: "Система",
      });
    } finally {
      setBusy(false);
    }
  };
  const manual = async (a: ActionDef) => manualAt(a);
  const speechCharacters = [
    {
      id: SUBJECT,
      name: subjectName,
      state: subject || undefined,
      contexts: subject?.contexts || [],
    },
    ...nearbyCharacters.filter((character) => character.id !== SUBJECT),
  ];
  const speechPortraitFor = (character: (typeof speechCharacters)[number]) => {
    const slug = visualCharacterSlugs[character.id];
    if (!slug) return null;
    const state = character.state || {};
    const emotion = resolvePortraitEmotion({
      behavioralState: state.behavioralState,
      reaction: state.reaction || state.lastReaction,
      transitions: state.transitions,
      state: {
        ...state,
        contexts: (character.contexts || []).map((context: any) => ({
          actionId: context.actionId || context.id,
        })),
      },
    });
    return {
      src: `/character-images/portraits/${slug}/${emotion}.png`,
      fallback: `/character-images/portraits/${slug}/neutral.png`,
    };
  };
  const sendSpeech = async () => {
    const text = playerInput.trim();
    if (!text || busy) return;
    const target = nearbyCharacters.find(
        (character) => character.id === speechTargetId,
      ),
      targetName = target?.name || subjectName;
    setBusy(true);
    setGeneratingSpeech(true);
    setError(null);
    setLlmError(null);
    setPlayerInput("");
    pushChat({ speaker: "calibrator", text, context: `К ${targetName}` });
    try {
      setLastStateBefore(subjectRef.current ? { ...subjectRef.current } : null);
      const q = await fetch("/api/tick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(60_000),
          body: JSON.stringify({
            // A direct conversation belongs to the addressed character. Using
            // the calibrated subject here made an assistant answer from the
            // subject's physiological reaction frame.
            subjectId: speechTargetId,
            addressedCharacterId: speechTargetId,
            playerId: "PL-1",
            sceneId: SCENE,
            pointId: "systemic",
            presetId: "verbal_pressure",
            textMessage: text,
            intensity: 1,
            skipLLM: false,
            llmMode: nearbyCharacters.length ? "scene_dialogue" : "speech_only",
            skipImageGen: true,
            interactionContext: "Диагностический стол",
          }),
        }),
        d = await q.json();
      if (!d.success) throw new Error(d.error || "Ошибка реплики");
      const shared = (d.diagnostics || d.bundle?.diagnostics)?.observation as
        Obs | undefined;
      if (shared && speechTargetId === SUBJECT) {
        observationRef.current = shared;
        setCurrentObservation(shared);
        setMonitorPulse((pulse) => pulse + 1);
        setLastPerformedActionId(shared.action?.id || "");
      }
      await Promise.all([load(), loadChat()]);
      append({
        action: `Калибратор → ${targetName}`,
        text,
        metrics: "Реплика",
        kind: "system",
      });
      const replies = (d.actorReplies || []).filter(
          (reply: any) => reply.speech,
        ),
        speech = d.reply?.speech || "";
      setLlmError(d.llmError || null);
      // Successful replies are already persisted by the server and were just
      // restored by load(). Pushing actorReplies again duplicated the same
      // message in the in-memory feed.
      if (!replies.length && !speech && d.llmError)
        pushChat({ speaker: "system", text: "Ответ модели недоступен." });
      else if (!replies.length && !speech)
        pushChat({ speaker: "system", text: `${targetName} не отвечает.` });
      if (speech)
        append({
          action: targetName,
          text: speech,
          metrics: "Ответ",
          kind: "normal",
        });
      else if (d.llmError)
        append({
          action: "Связь с моделью",
          text: "Ответ не получен.",
          metrics: d.llmError,
          kind: "warning",
        });
      else
        append({
          action: targetName,
          text: "Не отвечает.",
          metrics: "Молчание",
          kind: "normal",
        });
      for (const transition of shared?.transitions || [])
        append({
          action: transition.title,
          text: transition.text,
          metrics: "Состояние актива изменилось",
          kind: transition.severity === "danger" ? "danger" : "milestone",
        });
    } catch (e: any) {
      setError(e.message);
      pushChat({ speaker: "system", text: "Реплика не доставлена." });
    } finally {
      setBusy(false);
      setGeneratingSpeech(false);
    }
  };
  const add = (a: ActionDef) => {
    if (phase !== "preparation") return;
    const target = resolvedZone(a);
    setProtocolProgress({});
    setProtocol((x) =>
      [
        ...x,
        {
          key: crypto.randomUUID(),
          actionId: a.id,
          label: a.label,
          repeat: 1,
          pointId: target.id,
          pointLabel: target.label,
        },
      ].slice(0, 8),
    );
  };
  const move = (i: number, d: number) =>
    setProtocol((x) => {
      const n = [...x],
        j = i + d;
      if (j < 0 || j >= n.length) return x;
      setProtocolProgress({});
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const repeat = (key: string) =>
    setProtocol((x) => {
      setProtocolProgress({});
      return x.map((s) =>
        s.key === key ? { ...s, repeat: (s.repeat % 3) + 1 } : s,
      );
    });
  const run = async () => {
    if (!protocol.length || busy) return;
    const emptyProgress = (
      status: ProtocolStepProgress["status"] = "pending",
    ): ProtocolStepProgress => ({
      status,
      completedRepeats: 0,
      pleasure: 0,
      discomfort: 0,
      overload: 0,
      engagement: 0,
      appraisal: 0,
      tension: 0,
      capacity: 0,
      attitude: 0,
      localAttitude: 0,
      sensitivity: 0,
      localSensitivity: 0,
      baselineLocalSensitivity: 0,
      openness: 0,
      localOpenness: 0,
      plasticity: 0,
      familiarity: 0,
    });
    setProtocolProgress(
      Object.fromEntries(protocol.map((step) => [step.key, emptyProgress()])),
    );
    setGoalSettingsOpen(false);
    setProtocolOpen(true);
    setBusy(true);
    setRunning(true);
    stopRef.current = false;
    try {
      for (const item of protocol) {
        if (stopRef.current) break;
        setProtocolProgress((current) => ({
          ...current,
          [item.key]: {
            ...(current[item.key] || emptyProgress()),
            status: "running",
          },
        }));
        for (let i = 0; i < item.repeat; i++) {
          if (stopRef.current) break;
          if (protocolMode === "adaptive" && item.actionId !== "wait") {
            let recoveryPasses = 0;
            while (recoveryPasses < 3) {
              const state = subjectRef.current,
                obs = observationRef.current,
                refractory = obs?.contexts?.some(
                  (c) => c.id === "effect_refractory",
                ),
                needsRecovery =
                  (state?.capacity || 0) < 30 ||
                  obs?.behavioralState === "unresponsive" ||
                  refractory;
              if (!needsRecovery) break;
              append({
                action: "Решение протокола",
                text: refractory
                  ? "Реактивность снижена после оргазма — вставлена пауза."
                  : obs?.behavioralState === "unresponsive"
                    ? "Осмысленный контакт потерян — воздействие отложено до восстановления реакции."
                    : "Ресурс ниже рабочего диапазона — вставлена восстановительная пауза.",
                metrics: "Адаптивное правило",
                kind: "system",
              });
              await perform({
                key: "auto-wait",
                actionId: "wait",
                label: "Автоматическая пауза",
                repeat: 1,
              });
              recoveryPasses++;
            }
          }
          const outcome = await perform(item, false, item.actionId !== "wait");
          const obs = outcome.observation;
          setProtocolProgress((current) => {
            const previous = current[item.key] || emptyProgress("running");
            return {
              ...current,
              [item.key]: {
                ...previous,
                status: i === item.repeat - 1 ? "completed" : "running",
                completedRepeats: previous.completedRepeats + 1,
                pleasure: previous.pleasure + (obs?.reaction?.pleasure || 0),
                discomfort:
                  previous.discomfort + (obs?.reaction?.discomfort || 0),
                overload: previous.overload + (obs?.reaction?.overload || 0),
                engagement:
                  previous.engagement + (obs?.reaction?.engagement || 0),
                appraisal: previous.appraisal + (obs?.reaction?.appraisal || 0),
                tension: previous.tension + (obs?.changes?.tension || 0),
                capacity: previous.capacity + (obs?.changes?.capacity || 0),
                attitude: previous.attitude + (obs?.changes?.attitude || 0),
                localAttitude:
                  previous.localAttitude + (obs?.changes?.localAttitude || 0),
                sensitivity:
                  previous.sensitivity + (obs?.changes?.sensitivity || 0),
                localSensitivity:
                  previous.localSensitivity +
                  (obs?.learning?.sensitivityDelta || 0),
                baselineLocalSensitivity:
                  previous.baselineLocalSensitivity +
                  (obs?.learning?.baselineSensitivityDelta || 0),
                openness: previous.openness + (obs?.changes?.openness || 0),
                localOpenness:
                  previous.localOpenness + (obs?.changes?.localOpenness || 0),
                plasticity:
                  previous.plasticity + (obs?.changes?.plasticity || 0),
                familiarity:
                  previous.familiarity + (obs?.learning?.familiarityDelta || 0),
              },
            };
          });
          if (protocolMode === "adaptive" && item.actionId !== "wait") {
            if (obs && ["panic", "defiance"].includes(obs.behavioralState)) {
              append({
                action: "Смена ветки",
                text: "Актив отвергает текущий характер контакта. Остальные повторы этого шага пропущены.",
                metrics: "Адаптивное правило",
                kind: "warning",
              });
              break;
            }
            if (i < item.repeat - 1 && (obs?.learning?.effect || 0) < 1.5) {
              append({
                action: "Смена шага",
                text: "Повтор почти перестал обучать. Протокол переходит к следующему действию.",
                metrics: `learning ${(obs?.learning?.effect || 0).toFixed(2)}`,
                kind: "system",
              });
              break;
            }
          }
          await new Promise((r) =>
            setTimeout(r, obs?.transitions?.length ? 900 : 300),
          );
        }
        setProtocolProgress((current) =>
          current[item.key]?.status === "running"
            ? {
                ...current,
                [item.key]: { ...current[item.key], status: "completed" },
              }
            : current,
        );
      }
    } catch (e: any) {
      setError(e.message);
      setProtocolProgress((current) => {
        const runningEntry = Object.entries(current).find(
          ([, progress]) => progress.status === "running",
        );
        return runningEntry
          ? {
              ...current,
              [runningEntry[0]]: { ...runningEntry[1], status: "error" },
            }
          : current;
      });
    } finally {
      setBusy(false);
      setRunning(false);
    }
  };
  const setDevice = async (mode: PassiveMode | null) => {
    if (busy) return;
    setBusy(true);
    try {
      if (passive) await toggleContext(false);
      if (mode) await toggleContext(true);
      setPassive(mode);
      append({
        action: mode ? "Настройка фонового контура" : "Отключение контура",
        text:
          mode === "gentle"
            ? "Установлен мягкий ритм: небольшой устойчивый прогресс с ростом familiarity."
            : mode === "contrast"
              ? "Установлен контрастный режим: обучение быстрее, но физическая нагрузка и дискомфорт выше."
              : "Пассивные воздействия прекращены.",
        metrics: "Контекст оборудования изменён.",
        kind: "system",
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const saveTemplate = () => {
    localStorage.setItem(
      "cyberjack.calibrationProtocol",
      JSON.stringify(protocol),
    );
    append({
      action: "Шаблон сохранён",
      text: "Последовательность сохранена в терминале и доступна для следующей попытки.",
      metrics: `${protocol.length} шагов`,
      kind: "system",
    });
  };
  const loadTemplate = () => {
    try {
      const v = JSON.parse(
        localStorage.getItem("cyberjack.calibrationProtocol") || "[]",
      );
      if (Array.isArray(v))
        setProtocol(
          v
            .filter((s: any) => !hiddenCalibrationActionIds.has(s.actionId))
            .map((s: any) => ({ ...s, key: crypto.randomUUID() }))
            .slice(0, 8),
        );
    } catch {
      setError("Сохранённый шаблон повреждён");
    }
  };
  const activeContextIds = new Set(
      (subject?.contexts || []).map((c) => c.actionId),
    ),
    submissionModifier =
      (activeContextIds.has("effect_suggestibility") ? 15 : 0) +
      (activeContextIds.has("effect_subspace") ? 10 : 0),
    submission = clampPercent(
      (relationAttitude ?? subject?.attitude ?? 0) +
        (subject?.plasticity ?? 0) * 0.5 +
        submissionModifier,
    ),
    submissionLabel =
      submission >= 65 && (relationAttitude ?? subject?.attitude ?? 0) < 45
        ? "Смирение"
        : submission >= 75
          ? "Высокое"
          : submission >= 50
            ? "Умеренное"
            : "Низкое",
    modeGroups: ActionGroup[] =
      operationMode === "impact"
        ? ["contact", "intimate"]
        : ["pose", "equipment", "clothing"],
    compatibleZones =
      operationMode === "impact"
        ? Array.from(
            new Map(
              [...playableZones("contact"), ...playableZones("intimate")].map(
                (zone) => [zone.id, zone],
              ),
            ).values(),
          )
        : [],
    effectiveZoneId = compatibleZones.some((zone) => zone.id === selectedZoneId)
      ? selectedZoneId
      : compatibleZones[0]?.id,
    displayZoneId = effectiveZoneId || selectedZoneId,
    visibleActions = actions.filter(
      (a) =>
        !hiddenCalibrationActionIds.has(a.id) &&
        a.id !== "wait" &&
        modeGroups.includes(a.group) &&
        !a.contextual &&
        (!actionMeta.find((meta) => meta.id === a.id)?.requiresItem ||
          ownedItemIds.has(
            actionMeta.find((meta) => meta.id === a.id)?.requiresItem || "",
          )) &&
        (!a.requiresContext || activeContextIds.has(a.requiresContext)) &&
        (!a.hideWhenContext || !activeContextIds.has(a.hideWhenContext)) &&
        (!["contact", "intimate"].includes(a.group) ||
          zonesForAction(a).some((z) => z.id === effectiveZoneId)),
    ),
    selectedAction = visibleActions.find((a) => a.id === selectedActionId),
    effectiveSelectedAction = selectedAction,
    resultForecastMetrics = [
      "pleasure",
      "discomfort",
      "overload",
      "attitude",
      "tension",
      "capacity",
      "openness",
      "sensitivity",
    ] as TrackedMetric[],
    resultForecastTexts = effectiveSelectedAction
      ? calibrationForecast(
          effectiveSelectedAction,
          recentObservations,
          resultForecastMetrics,
        )
      : [],
    resultForecastByMetric = new Map(
      resultForecastMetrics.map((metric, index) => [
        metric,
        resultForecastTexts[index],
      ]),
    ),
    forecastedResultMetrics = new Set(
      resultForecastMetrics.filter((metric) =>
        forecastIsActive(resultForecastByMetric.get(metric)),
      ),
    ),
    preparationTarget =
      operationMode === "setup"
        ? preparationTargetVisual(SUBJECT, subject, selectedAction)
        : null,
    selectedZone =
      operationMode === "impact"
        ? compatibleZones.find((z) => z.id === effectiveZoneId)
        : selectedAction
          ? resolvedZone(selectedAction)
          : undefined,
    blockedPoints = new Set(
      (subject?.contexts || []).flatMap((c) => c.blocksPoints || []),
    ),
    visibleContexts = Array.from(
      new Map((subject?.contexts || []).map((c) => [c.actionId, c])).values(),
    ),
    wornContexts = visibleContexts.filter(
      (c) =>
        c.type === "clothing" ||
        c.type === "equipment" ||
        c.type === "restraint",
    ),
    poseContext = visibleContexts.find(
      (context) =>
        context.type === "pose" ||
        context.actionId.startsWith("pose_") ||
        context.actionId === "act_suspend_wrists",
    ),
    otherContexts = visibleContexts.filter(
      (c) =>
        c !== poseContext &&
        c.type !== "clothing" &&
        c.type !== "equipment" &&
        c.type !== "restraint",
    ),
    sessionContexts = visibleContexts.filter(
      (context) => context !== poseContext,
    ),
    selectedDirectTags = effectiveSelectedAction
      ? conditioningTags(
          effectiveSelectedAction.id,
          actionMeta.find((meta) => meta.id === effectiveSelectedAction.id)
            ?.tags || [],
        )
      : [],
    contextLearning = contextConditioningTags(
      visibleContexts.map((context) => ({
        id: context.actionId,
        type: context.type,
        tags: conditioningTags(
          context.actionId,
          actionMeta.find((meta) => meta.id === context.actionId)?.tags || [],
        ),
      })),
      selectedDirectTags,
    ),
    contextLearningBySource = contextLearning.reduce((grouped, entry) => {
      const existing = grouped.get(entry.sourceId) || [];
      existing.push(entry);
      grouped.set(entry.sourceId, existing);
      return grouped;
    }, new Map<string, typeof contextLearning>()),
    trackedContract = contracts.find((c) => c.id === trackedContractId) || null,
    trackedMetrics = trackedContract
      ? Array.from(
          new Set(
            (trackedContract.conditions || [])
              .map((condition) =>
                condition.type === "attitude" ? "attitude" : condition.key,
              )
              .filter((key): key is TrackedMetric =>
                trackedMetricOptions.some((option) => option.id === key),
              ),
          ),
        ).slice(0, 6)
      : freeTrackedMetrics,
    goalRows = (trackedContract?.conditions || []).map((condition) => {
      const value = conditionValue(condition, subject),
        movement = conditionMovement(condition, lastStateBefore, subject);
      return {
        condition,
        value,
        currentValue: conditionCurrentValue(condition, subject),
        movement,
        met:
          value !== undefined &&
          conditionMet(value, condition.operator, condition.value),
      };
    }),
    coreGoalRows = goalRows.filter(
      ({ condition }) =>
        condition.type !== "preference" && condition.type !== "acquired_trait",
    ),
    specialGoalRows = goalRows.filter(
      ({ condition }) =>
        condition.type === "preference" || condition.type === "acquired_trait",
    ),
    readyCount = goalRows.filter((x) => x.met).length,
    currentState =
      currentObservation?.currentState || stateFromContexts(subject),
    peakObservation = activePeakObservation || currentObservation,
    peakTransition = peakObservation?.transitions?.find(
      (transition) =>
        transition.kind === "discharge" ||
        transition.kind === "overload" ||
        transition.kind === "breakdown",
    ),
    peakEventKind = !peakTransition
      ? null
      : peakTransition.kind === "discharge"
        ? "discharge"
        : peakTransition.kind === "overload"
          ? "overload"
          : /истощ/i.test(peakTransition.title)
            ? "exhaustion"
            : "breakdown",
    peakEventPresentation = peakEventKind
      ? (
          {
            discharge: {
              eyebrow: "ФИЗИОЛОГИЧЕСКИЙ ПИК",
              title: "ОРГАЗМ",
              footer: "ПЕРЕХОД · РЕФРАКТЕРНЫЙ ПЕРИОД",
            },
            overload: {
              eyebrow: "КОНФЛИКТ АКТИВАЦИИ",
              title: "ПЕРЕГРУЗКА",
              footer: "ПИК УДЕРЖАН · СТАБИЛИЗАЦИЯ НЕОБХОДИМА",
            },
            breakdown: {
              eyebrow: "САМОКОНТРОЛЬ НАРУШЕН",
              title: "НЕРВНЫЙ СРЫВ",
              footer: "АВАРИЙНЫЙ ПЕРЕХОД · КОНТАКТ НЕ ГАРАНТИРОВАН",
            },
            exhaustion: {
              eyebrow: "РЕСУРС ИСЧЕРПАН",
              title: "ИСТОЩЕНИЕ",
              footer: "ПИК НЕ ДОСТИГНУТ · ТРЕБУЕТСЯ ВОССТАНОВЛЕНИЕ",
            },
          } as const
        )[peakEventKind]
      : null,
    peakFinisherPresentation = peakEventKind
      ? (
          {
            discharge: { eyebrow: "LIMIT RELEASE", title: "FINISH" },
            overload: { eyebrow: "CORE OVERLOAD", title: "OVERDRIVE" },
            breakdown: { eyebrow: "GUARD BREAK", title: "BREAKDOWN" },
            exhaustion: { eyebrow: "SYSTEM DOWN", title: "EXHAUSTED" },
          } as const
        )[peakEventKind]
      : null,
    isDischarge = peakEventKind === "discharge",
    isPeakEvent = Boolean(peakEventKind),
    activePoint = displayZoneId ? subject?.anatomy?.[displayZoneId] : undefined,
    activePointSensitivity =
      activePoint && displayZoneId
        ? interpretPointSensitivity(
            displayZoneId,
            activePoint.localSensitivity,
            activePoint.baselineLocalSensitivity,
          )
        : undefined,
    activePointAttitude = activePoint
      ? interpretPointAttitude(
          activePoint.localAttitude,
          activePoint.baselineLocalAttitude,
        )
      : undefined,
    coreInterpretations = {
      sensitivity: interpretCoreMetric(
        "sensitivity",
        subject?.sensitivity || 0,
        stateBaseline(subject, "Sensitivity"),
      ),
      capacity: interpretCoreMetric(
        "capacity",
        subject?.capacity || 0,
        stateBaseline(subject, "Capacity"),
      ),
      openness: interpretCoreMetric(
        "openness",
        subject?.openness || 0,
        stateBaseline(subject, "Openness"),
      ),
      plasticity: interpretCoreMetric(
        "plasticity",
        subject?.plasticity || 0,
        stateBaseline(subject, "Plasticity"),
      ),
    },
    activation = clampPercent(subject?.tension || 0),
    edgeProfile = deriveEdgeProfile(
      {
        tension: subject?.tension || 0,
        capacity: subject?.capacity || 0,
      } as any,
      recentObservations,
    ),
    activationLabel =
      activation < 20
        ? "Спокойная"
        : activation < 45
          ? "Повышенная"
          : activation < 70
            ? "Высокая"
            : activation < 85
              ? "Предельная"
              : edgeProfile.label,
    activationNature = (
      {
        positive: "положительная",
        negative: "защитная",
        mixed: "смешанная",
        neutral: "нейтральная",
      } as const
    )[deriveReactionCharacter(recentObservations)],
    activationBalance = Math.round(edgeProfile.activationBalance),
    expectedPeakOutcome = (
      {
        stable: "состояние стабильно",
        positive_discharge: "оргазм",
        overload: "смешанная перегрузка",
        breakdown: "нервный срыв",
      } as const
    )[edgeProfile.expectedOutcome],
    pulseSignal = telemetry?.signals.find((signal) => signal.id === "pulse"),
    breathingSignal = telemetry?.signals.find(
      (signal) => signal.id === "breathing",
    ),
    pulseBpm = Math.max(
      35,
      Math.min(180, Number(pulseSignal?.numeric || pulseSignal?.value || 60)),
    ),
    breathingRate = Math.max(
      6,
      Math.min(40, Number(breathingSignal?.numeric || 12)),
    ),
    pulsePeriod = 60 / pulseBpm,
    breathingPeriod = 60 / breathingRate,
    currentOverload = Math.max(
      0,
      Number(currentObservation?.reaction?.overload || 0),
    ),
    sensoryOverloadActive =
      currentObservation?.behavioralState === "overload" ||
      (subject?.contexts || []).some(
        (context) => context.actionId === "effect_sensory_overload",
      ),
    overloadLabel = sensoryOverloadActive
      ? "перегруз"
      : currentOverload >= 80
        ? "перегруз"
        : currentOverload >= 55
          ? "предел"
          : currentOverload >= 40
            ? "напряжение"
            : "спокойствие",
    enduranceLabel =
      (subject?.capacity || 0) < 20
        ? "Истощение"
        : (subject?.capacity || 0) < 40
          ? "Утомление"
          : (subject?.capacity || 0) < 70
            ? "Рабочий запас"
            : "Высокий запас",
    baseVisualPath = characterVisualPath(
      SUBJECT,
      subject,
      currentObservation?.behavioralState,
      currentObservation?.transitions?.some(
        (transition) => transition.kind === "discharge",
      ) || false,
    ),
    portraitFallbackPath = canonicalCharacterPortrait(
      SUBJECT,
      subjectName,
      (subject?.contexts || []).map((context) => ({ id: context.actionId })),
    ),
    activeVisualInteraction = activeVisualInteractionFromContexts(
      subject?.contexts || [],
      subject?.tension || 0,
    ),
    criticalVisualState =
      currentObservation?.behavioralState === "unresponsive" ||
      currentObservation?.behavioralState === "panic" ||
      (subject?.contexts || []).some((context) =>
        [
          "effect_apathy",
          "effect_chronic_apathy",
          "effect_panic",
          "effect_sensory_overload",
        ].includes(context.actionId),
      ),
    persistentPoseVisual =
      activeVisualInteraction?.family === "foot" ||
      activeVisualInteraction?.family === "exposure",
    interactionVisualPath = activeVisualInteraction
      ? `/character-images/interactions/${visualCharacterSlugs[SUBJECT] || SUBJECT}/${activeVisualInteraction.family}/${activeVisualInteraction.variant}__${activeVisualInteraction.phase}.png`
      : null,
    intimacyVisualPath =
      activeVisualInteraction && (!criticalVisualState || persistentPoseVisual)
        ? resolveIntimacyInteractionVisual({
            characterSlug: visualCharacterSlugs[SUBJECT] || SUBJECT,
            interaction: activeVisualInteraction,
            contexts: subject?.contexts || [],
            tension: subject?.tension || 0,
            attitude: subject?.attitude || 0,
            openness: subject?.openness || 0,
            behavioralState: currentObservation?.behavioralState,
            discharged:
              currentObservation?.transitions?.some(
                (transition) => transition.kind === "discharge",
              ) || false,
          })
        : null,
    expandedVisualPath =
      activeVisualInteraction && (!criticalVisualState || persistentPoseVisual)
        ? expandedInteractionAssetPath({
            characterSlug: visualCharacterSlugs[SUBJECT] || SUBJECT,
            interaction: activeVisualInteraction,
            contexts: subject?.contexts || [],
            tension: subject?.tension || 0,
            attitude: subject?.attitude || 0,
            openness: subject?.openness || 0,
            behavioralState: currentObservation?.behavioralState,
            discharged:
              currentObservation?.transitions?.some(
                (transition) => transition.kind === "discharge",
              ) || false,
          })
        : null,
    visualCandidates =
      activeVisualInteraction?.family === "foot"
        ? [
            baseVisualPath,
            expandedVisualPath,
            interactionVisualPath,
            portraitFallbackPath,
          ]
        : [
            intimacyVisualPath,
            !criticalVisualState || persistentPoseVisual
              ? expandedVisualPath
              : null,
            !criticalVisualState || persistentPoseVisual
              ? interactionVisualPath
              : null,
            baseVisualPath,
            portraitFallbackPath,
          ],
    visualPath =
      resolveFirstAvailableVisual(visualCandidates) || baseVisualPath,
    // Compute visual path for the nearby (secondary) character, if any.
    nearbyCharacter = nearbyCharacters.find((c) => c.id !== SUBJECT),
    nearbyVisualPath = nearbyCharacter
      ? characterVisualPath(
          nearbyCharacter.id,
          (nearbyCharacter.state as any) || null,
          undefined,
          false,
        )
      : null,
    // The active subject is who's shown large; the other is dimmed.
    // Both paths stay FIXED — swap only toggles CSS opacity, never changes src.
    activeVisualPath = visualPath,
    secondaryVisualPath = nearbyCharacter
      ? characterVisualPath(
          nearbyCharacter.id,
          (nearbyCharacter.state as any) || null,
          undefined,
          false,
        )
      : null,
    secondaryName = nearbyCharacter?.name,
    activeIsSecondary = activeSubjectId !== SUBJECT && !!nearbyCharacter,
    reviewAssetPath = displayedVisualPath || visualPath,
    significantEvent =
      [...entries]
        .reverse()
        .find(
          (e) =>
            e.kind === "milestone" ||
            e.kind === "danger" ||
            e.kind === "warning",
        ) || entries[entries.length - 1];
  const processDefinitions = [
      {
        start: "finger_insertion",
        slower: "act_decrease_friction",
        faster: "act_increase_friction",
        stop: "act_end_sexual_contact",
      },
      {
        start: "act_start_penetration",
        slower: "act_decrease_friction",
        faster: "act_increase_friction",
        stop: "act_end_sexual_contact",
      },
      {
        start: "act_start_vibrator",
        slower: undefined,
        faster: "act_adjust_vibration",
        stop: "act_stop_vibrator",
      },
      {
        start: "act_activate_plug",
        slower: undefined,
        faster: undefined,
        stop: "act_deactivate_plug",
      },
      {
        start: "act_start_electrostimulation",
        slower: undefined,
        faster: "act_adjust_electrostimulation",
        stop: "act_stop_electrostimulation",
      },
    ],
    activeProcesses = processDefinitions
      .map((definition) => {
        const context = visibleContexts.find(
          (entry) => entry.actionId === definition.start,
        );
        const action = actions.find((entry) => entry.id === definition.start);
        return context && action ? { ...definition, context, action } : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .slice(0, 3),
    safeProcessIndex = activeProcesses.length
      ? Math.min(selectedProcessIndex, activeProcesses.length - 1)
      : 0,
    learnedPreferences = parsePreferences(subject?.preferences),
    recommendableActions = actions.filter(
      (action) =>
        !hiddenCalibrationActionIds.has(action.id) &&
        action.id !== "wait" &&
        ["contact", "intimate"].includes(action.group) &&
        !action.contextual &&
        (!actionMeta.find((meta) => meta.id === action.id)?.requiresItem ||
          ownedItemIds.has(
            actionMeta.find((meta) => meta.id === action.id)?.requiresItem ||
              "",
          )) &&
        (!action.requiresContext ||
          activeContextIds.has(action.requiresContext)) &&
        (!action.hideWhenContext ||
          !activeContextIds.has(action.hideWhenContext)),
    ),
    recommendationCandidates = recommendableActions.flatMap((action) =>
      zonesForAction(action).map((point) => {
        const pointState = subject?.anatomy?.[point.id],
          tags = conditioningTags(
            action.id,
            actionMeta.find((meta) => meta.id === action.id)?.tags || [],
          ),
          strongestTag = tags
            .map((tag) => ({ tag, value: learnedPreferences.tags[tag] || 0 }))
            .sort((left, right) => right.value - left.value)[0],
          actionPreference = learnedPreferences.actions[action.id] || 0,
          pointPreference = learnedPreferences.points[point.id] || 0,
          tagPreference = tags.reduce(
            (sum, tag) => sum + (learnedPreferences.tags[tag] || 0),
            0,
          ),
          preferenceScore =
            actionPreference * 3 + pointPreference * 2 + tagPreference,
          acceptance = pointState?.localAttitude ?? point.local_attitude ?? 0,
          sensitivity =
            pointState?.localSensitivity ?? point.local_sensitivity ?? 0,
          openness = pointState?.localOpenness ?? point.local_openness ?? 0;
        return {
          action,
          point,
          tags,
          preferenceScore,
          actionPreference,
          pointPreference,
          strongestTag,
          acceptance,
          sensitivity,
          openness,
        };
      }),
    ),
    intimateRecommendationCandidates = [...recommendationCandidates]
      .filter((candidate) => candidate.action.group === "intimate")
      .sort(
        (left, right) =>
          right.acceptance +
          right.openness * 0.35 +
          right.preferenceScore * 4 -
          (left.acceptance + left.openness * 0.35 + left.preferenceScore * 4),
      ),
    intimateLocalAcceptance = intimateRecommendationCandidates.length
      ? intimateRecommendationCandidates.reduce(
          (sum, candidate) => sum + candidate.acceptance,
          0,
        ) / intimateRecommendationCandidates.length
      : 0,
    intimateArousal = clampPercent(Number(subject?.tension || 0)),
    intimateTrust = clampPercent(
      Number(subject?.attitude || 0) * 0.55 +
        Number(subject?.openness || 0) * 0.45,
    ),
    intimateReadiness = clampPercent(
      Number(subject?.attitude || 0) * 0.38 +
        Number(subject?.openness || 0) * 0.24 +
        intimateLocalAcceptance * 0.28 +
        intimateArousal * 0.1 * (0.25 + intimateTrust / 135),
    ),
    intimateRecommendationText =
      intimateReadiness < 25
        ? "Готовность низкая: начните с наиболее принимаемого контакта и следите за реакцией."
        : intimateReadiness < 55
          ? "Контакт возможен, но лучше наращивать интенсивность постепенно."
          : intimateReadiness < 80
            ? "Состояние располагает к интимному контакту; предпочтительные варианты выделены ниже."
            : "Высокая готовность: персонаж расположен к активному продолжению.",
    hasKnownPositivePreferences = recommendationCandidates.some(
      (candidate) => candidate.preferenceScore > 0,
    ),
    preferencePool = [...recommendationCandidates].sort((left, right) =>
      hasKnownPositivePreferences
        ? right.preferenceScore - left.preferenceScore ||
          right.acceptance - left.acceptance
        : right.acceptance - left.acceptance ||
          right.sensitivity - left.sensitivity,
    ),
    categorizedPreferenceRecommendations = [
      {
        category: "action",
        candidates: [...recommendationCandidates]
          .filter((candidate) => candidate.actionPreference > 0)
          .sort(
            (left, right) =>
              right.actionPreference - left.actionPreference ||
              right.acceptance - left.acceptance,
          ),
      },
      {
        category: "point",
        candidates: [...recommendationCandidates]
          .filter((candidate) => candidate.pointPreference > 0)
          .sort(
            (left, right) =>
              right.pointPreference - left.pointPreference ||
              right.acceptance - left.acceptance,
          ),
      },
      {
        category: "tag",
        candidates: [...recommendationCandidates]
          .filter((candidate) => (candidate.strongestTag?.value || 0) > 0)
          .sort(
            (left, right) =>
              (right.strongestTag?.value || 0) -
                (left.strongestTag?.value || 0) ||
              right.acceptance - left.acceptance,
          ),
      },
    ].reduce<
      Array<{
        category: string;
        candidate: (typeof recommendationCandidates)[number];
      }>
    >((selected, entry) => {
      const candidate = entry.candidates.find(
        (candidate) =>
          !selected.some(
            (selectedEntry) =>
              selectedEntry.candidate.action.id === candidate.action.id,
          ),
      );
      if (candidate) selected.push({ category: entry.category, candidate });
      return selected;
    }, []),
    preferenceRecommendations = preferencePool.reduce<
      typeof categorizedPreferenceRecommendations
    >(
      (selected, candidate) => {
        if (
          selected.length < 3 &&
          !selected.some(
            (entry) => entry.candidate.action.id === candidate.action.id,
          )
        ) {
          selected.push({ category: "acceptance", candidate });
        }
        return selected;
      },
      categorizedPreferenceRecommendations.slice(0, 3),
    ),
    targetGoalRow = goalRows.find((row) => !row.met) || goalRows[0],
    goalKey =
      targetGoalRow?.condition.key ||
      (targetGoalRow?.condition.type === "attitude" ? "attitude" : undefined),
    goalTraitTags: Record<string, string[]> = {
      trait_masochist: ["pain", "impact"],
      trait_restraint_fetish: ["restraint"],
      trait_conditioned_submission: ["control", "command", "submission"],
      trait_exhibitionist: ["exposure", "humiliation"],
      trait_clinical_fetish: ["clinical", "medical"],
      trait_technophile: ["electronic", "machine"],
    },
    goalTags = goalKey ? goalTraitTags[goalKey] || [goalKey] : [],
    scoringGoal = targetGoalRow
      ? {
          ...targetGoalRow.condition,
          key:
            targetGoalRow.condition.type === "acquired_trait"
              ? goalTags[0] || goalKey
              : goalKey,
        }
      : null,
    scoredGoalPool = scoringGoal
      ? recommendationCandidates
          .map((candidate) => ({
            candidate,
            score: scoreGoalCandidate(scoringGoal, targetGoalRow?.value, {
              tags: candidate.tags,
              preferenceScore: candidate.preferenceScore,
              intensity: actionIntensity(candidate.action, candidate.tags),
              observations: recentObservations.filter(
                (entry) =>
                  entry.action?.id === candidate.action.id &&
                  entry.action?.pointId === candidate.point.id,
              ),
            }),
          }))
          .filter((entry) => Number.isFinite(entry.score))
          .sort((left, right) => right.score - left.score)
      : [],
    goalRecommendation =
      scoredGoalPool
        .map((entry) => entry.candidate)
        .find(
          (candidate) =>
            !preferenceRecommendations.some(
              (entry) =>
                entry.candidate.action.id === candidate.action.id &&
                entry.candidate.point.id === candidate.point.id,
            ),
        ) || scoredGoalPool[0]?.candidate,
    preferenceQuickActions = preferenceRecommendations.map(
      ({ candidate, category }) => ({
        action: candidate.action,
        observation: recentObservations.find(
          (entry) =>
            entry.action?.id === candidate.action.id &&
            entry.action?.pointId === candidate.point.id,
        ),
        repeat: false,
        pointId: candidate.point.id,
        pointLabel: candidate.point.label,
        reason:
          category === "action"
            ? "Знакомое действие · раньше отзывалась хорошо"
            : category === "point"
              ? `Любимая зона · ${candidate.point.label.toLowerCase()}`
              : category === "tag"
                ? `Тип воздействия · ${semanticTagLabels[candidate.strongestTag?.tag || ""] || candidate.strongestTag?.tag}`
                : "Принятие зоны · принимает лучше других",
      }),
    ),
    goalQuickAction = goalRecommendation
      ? {
          action: goalRecommendation.action,
          observation: recentObservations.find(
            (entry) =>
              entry.action?.id === goalRecommendation.action.id &&
              entry.action?.pointId === goalRecommendation.point.id,
          ),
          repeat: false,
          pointId: goalRecommendation.point.id,
          pointLabel: goalRecommendation.point.label,
          reason: trackedContract
            ? `К цели · ${conditionLabels[goalKey || ""] || goalKey || trackedContract.title}`
            : `Целевой прогноз · ${goalRecommendation.point.label}`,
        }
      : null,
    fallbackQuickAction = {
      action: pauseAction,
      observation: undefined,
      repeat: false,
      pointId: "systemic",
      pointLabel: "Всё тело",
      reason: "Восстановить ресурс",
    },
    quickActions = [
      preferenceQuickActions[0] || fallbackQuickAction,
      preferenceQuickActions[1] || fallbackQuickAction,
      preferenceQuickActions[2] || fallbackQuickAction,
      goalQuickAction || fallbackQuickAction,
    ],
    quickActionIds = new Set(quickActions.map((quick) => quick.action.id)),
    availableIntimateRecommendations = recommendationCandidates.filter(
      (candidate) =>
        !quickActionIds.has(candidate.action.id) &&
        !activeContextIds.has(candidate.action.id),
    ),
    observedIntimateChange = (
      candidate: (typeof recommendationCandidates)[number],
      metric: "readiness" | "arousal" | "trust",
    ) => {
      const observations = recommendationObservations
        .filter(
          (entry) =>
            entry.action?.id === candidate.action.id &&
            entry.action?.pointId === candidate.point.id,
        )
        .slice(0, 6);
      if (!observations.length) return null;
      const values = observations.map((observation) => {
        if (metric === "arousal") {
          return (
            Number(observation.changes?.tension || 0) +
            Number(observation.reaction?.pleasure || 0) * 0.35 -
            Number(observation.reaction?.discomfort || 0) * 0.6 -
            Number(observation.reaction?.overload || 0) * 0.5
          );
        }
        if (metric === "trust") {
          return (
            Number(observation.changes?.attitude || 0) * 2 +
            Number(observation.changes?.openness || 0) +
            Number(observation.changes?.localOpenness || 0) -
            Number(observation.reaction?.discomfort || 0) * 0.25
          );
        }
        return (
          Number(observation.changes?.attitude || 0) +
          Number(observation.changes?.localAttitude || 0) * 1.5 +
          Number(observation.changes?.openness || 0) +
          Number(observation.changes?.localOpenness || 0) -
          Number(observation.reaction?.discomfort || 0) * 0.2
        );
      });
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    },
    intimacyRecommendationGoals = [
      {
        key: "readiness",
        label: "Повысить готовность",
        hotkey: "A",
        score: (candidate: (typeof recommendationCandidates)[number]) => {
          const observed = observedIntimateChange(candidate, "readiness");
          return observed !== null
            ? observed * 100 + candidate.preferenceScore * 2
            : candidate.acceptance * 0.55 +
                candidate.openness * 0.35 +
                candidate.preferenceScore * 5 -
                actionIntensity(candidate.action, candidate.tags) * 8;
        },
      },
      {
        key: "arousal",
        label: "Повысить возбуждение",
        hotkey: "S",
        score: (candidate: (typeof recommendationCandidates)[number]) => {
          const observed = observedIntimateChange(candidate, "arousal");
          return observed !== null
            ? observed * 100 + candidate.preferenceScore * 2
            : candidate.sensitivity * 0.42 +
                candidate.acceptance * 0.18 +
                candidate.preferenceScore * 5 +
                actionIntensity(candidate.action, candidate.tags) * 3;
        },
      },
      {
        key: "trust",
        label: "Повысить доверие",
        hotkey: "D",
        score: (candidate: (typeof recommendationCandidates)[number]) => {
          const observed = observedIntimateChange(candidate, "trust");
          return observed !== null
            ? observed * 100 + candidate.preferenceScore * 2
            : candidate.acceptance * 0.58 +
                candidate.openness * 0.48 +
                candidate.preferenceScore * 6 -
                actionIntensity(candidate.action, candidate.tags) * 12;
        },
      },
    ],
    intimateRecommendations = intimacyRecommendationGoals.reduce<
      Array<{
        candidate: (typeof recommendationCandidates)[number];
        key: string;
        label: string;
        hotkey: string;
      }>
    >((selected, goal) => {
      const candidate = [...availableIntimateRecommendations]
        .filter(
          (entry) =>
            !selected.some(
              (chosen) =>
                chosen.candidate.action.id === entry.action.id ||
                `${chosen.candidate.action.id}:${chosen.candidate.point.id}` ===
                  `${entry.action.id}:${entry.point.id}`,
            ),
        )
        .sort((left, right) => goal.score(right) - goal.score(left))[0];
      if (candidate)
        selected.push({
          candidate,
          key: goal.key,
          label: goal.label,
          hotkey: goal.hotkey,
        });
      return selected;
    }, []);

  const boostContextForProcess = (process: (typeof activeProcesses)[number]) =>
    (
      ({
        act_start_vibrator: "act_adjust_vibration",
        act_start_electrostimulation: "act_adjust_electrostimulation",
      }) as Record<string, string | undefined>
    )[process.start];
  const isProcessBoosted = (process: (typeof activeProcesses)[number]) =>
    process.start === "finger_insertion" ||
    process.start === "act_start_penetration"
      ? activeContextIds.has("act_increase_friction")
      : Boolean(
          boostContextForProcess(process) &&
          activeContextIds.has(boostContextForProcess(process)!),
        );
  const processIntensity = (process: (typeof activeProcesses)[number]) =>
    isProcessBoosted(process)
      ? 3
      : process.start === "act_activate_plug"
        ? 1
        : 2;
  const signalProcessControl = (
    process: (typeof activeProcesses)[number],
    command: "slower" | "faster" | "stop" | "tick",
  ) =>
    setProcessFeedback({
      key: crypto.randomUUID(),
      processStart: process.start,
      command,
    });
  const canSlowProcess = (process: (typeof activeProcesses)[number]) =>
    Boolean(
      process.slower ||
      (boostContextForProcess(process) &&
        activeContextIds.has(boostContextForProcess(process)!)),
    );
  const processCommand = async (
    command: "slower" | "faster" | "stop",
    processIndex = safeProcessIndex,
  ) => {
    const process = activeProcesses[processIndex];
    if (!process || busy) return;
    const actionId = process[command];
    const action = actionId
      ? actions.find((entry) => entry.id === actionId)
      : undefined;
    // Context point ids may be equipment occupancy slots
    // (for example active_vibration_handheld), not anatomical targets.
    // Let manualAt resolve a valid target for the command instead of sending
    // that internal slot to the tick API.
    if (action) {
      signalProcessControl(process, command);
      await manualAt(action);
      return;
    }
    const boostContext =
      command === "slower" ? boostContextForProcess(process) : undefined;
    if (!boostContext || !activeContextIds.has(boostContext)) return;
    signalProcessControl(process, command);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/contexts/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: SUBJECT,
          contextId: boostContext,
          isActive: false,
        }),
      });
      const result = await response.json();
      if (!result.success)
        throw new Error(result.error || "Не удалось снизить интенсивность");
      await load();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };
  const runQuickAction = (index: number) => {
    const quick = quickActions[index];
    if (!quick || busy) return;
    if (quick.pointId && quick.pointId !== "systemic") {
      setOperationMode("impact");
      setSelectedZoneId(quick.pointId);
      setSelectedActionId(quick.action.id);
      setZoneOpen(false);
    }
    manualAt(quick.action, quick.pointId);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, select, [contenteditable='true']") ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const key =
        event.code ||
        (
          {
            " ": "Space",
            w: "KeyW",
            s: "KeyS",
            a: "KeyA",
            d: "KeyD",
            e: "KeyE",
            q: "KeyQ",
            "1": "Digit1",
            "2": "Digit2",
            "3": "Digit3",
            "4": "Digit4",
          } as Record<string, string>
        )[event.key.toLowerCase()] ||
        event.key;
      if (/^Digit[1-4]$/.test(key)) {
        event.preventDefault();
        runQuickAction(Number(key.slice(-1)) - 1);
      } else if (
        !activeProcesses.length &&
        ["KeyA", "KeyS", "KeyD"].includes(key)
      ) {
        event.preventDefault();
        const recommendationIndex = { KeyA: 0, KeyS: 1, KeyD: 2 }[key] ?? -1;
        const recommendation = intimateRecommendations[recommendationIndex];
        if (recommendation)
          manualAt(
            recommendation.candidate.action,
            recommendation.candidate.point.id,
          );
      } else if (key === "KeyW" || key === "KeyS") {
        event.preventDefault();
        if (activeProcesses.length) {
          setSelectedProcessIndex((current) =>
            key === "KeyW"
              ? (current - 1 + activeProcesses.length) % activeProcesses.length
              : (current + 1) % activeProcesses.length,
          );
        }
      } else if (key === "KeyA") {
        event.preventDefault();
        processCommand("slower");
      } else if (key === "KeyD") {
        event.preventDefault();
        processCommand("faster");
      } else if (key === "KeyE") {
        event.preventDefault();
        processCommand("stop");
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [busy, activeProcesses, safeProcessIndex, quickActions]);

  const speakerLabel = (speaker: string) =>
    speaker === "mira"
      ? subjectName.toUpperCase()
      : speaker === "calibrator"
        ? "КАЛИБРАТОР"
        : speaker === "system"
          ? "СИСТЕМА"
          : speaker.toUpperCase();
  const openVisualReview = async () => {
    setVisualReviewSaved(false);
    setVisualReviewOpen(true);
    try {
      const response = await fetch(
        `/api/visual-reviews?assetPath=${encodeURIComponent(reviewAssetPath)}`,
      );
      const data = await response.json();
      const review = data.reviews?.find(
        (entry: any) => entry.characterId === SUBJECT,
      );
      if (review) {
        setVisualReviewDecision(review.decision);
        setVisualReviewIssues(review.issues || []);
        setVisualReviewNote(review.note || "");
      } else {
        setVisualReviewDecision("rework");
        setVisualReviewIssues([]);
        setVisualReviewNote("");
      }
    } catch {
      setVisualReviewDecision("rework");
      setVisualReviewIssues([]);
      setVisualReviewNote("");
    }
  };
  const saveVisualReview = async () => {
    setVisualReviewSaving(true);
    setVisualReviewSaved(false);
    try {
      const response = await fetch("/api/visual-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetPath: reviewAssetPath,
          characterId: SUBJECT,
          decision: visualReviewDecision,
          issues: visualReviewIssues,
          note: visualReviewNote,
          metadata: {
            subjectName,
            baseVisualPath,
            interactionVisualPath,
            expandedVisualPath,
            tension: subject?.tension,
            attitude: subject?.attitude,
            behavioralState: currentObservation?.behavioralState,
            contexts: (subject?.contexts || []).map((context) => ({
              actionId: context.actionId,
              pointId: context.pointId,
            })),
          },
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      setVisualReviewSaved(true);
    } catch (reviewError: any) {
      setError(reviewError.message || "Не удалось сохранить оценку аватара");
    } finally {
      setVisualReviewSaving(false);
    }
  };
  return (
    <main className="calibration-workbench">
      <header className="workbench-header">
        {onExit && (
          <button className="workbench-back" onClick={onExit}>
            ← Лаборатория
          </button>
        )}
        <div>
          <p className="eyebrow">
            СЕССИЯ ВЗАИМОДЕЙСТВИЯ · {subjectName.toUpperCase()}
          </p>
          <h1>
            {subjectName} · {currentState.title}
          </h1>
        </div>
        <div className="header-progress">
          <strong>
            {trackedContract
              ? `Соответствие ${readyCount}/${goalRows.length}`
              : "Без ориентира"}
          </strong>
        </div>
        <nav>
          {onToggleTime && (
            <button
              className={`calibration-time-control ${timePaused ? "paused" : "running"}`}
              onClick={onToggleTime}
            >
              <i>{timePaused ? "▶" : "Ⅱ"}</i>
              <span>
                <small>ВРЕМЯ · {timePaused ? "ПАУЗА" : "ИДЁТ"}</small>
                <strong>
                  {timeLabel || `МИНУТА ${Math.floor(worldMinute)}`}
                </strong>
              </span>
            </button>
          )}
          <button onClick={() => setHistoryOpen(true)}>История</button>
          <button onClick={() => setDiagnosticsOpen(true)}>Диагностика</button>
          <button onClick={() => setMenuOpen(true)}>Меню</button>
        </nav>
      </header>
      <section className="objective-strip">
        <small>ОРИЕНТИР</small>
        <select
          aria-label="Контракт-ориентир"
          value={trackedContractId || ""}
          onChange={(event) => trackContract(event.target.value || null)}
        >
          <option value="">Свободная калибровка</option>
          {contracts.map((contract) => (
            <option value={contract.id} key={`objective-${contract.id}`}>
              {contract.title}
            </option>
          ))}
        </select>
        {trackedContract ? (
          <div className="objective-conditions">
            {goalRows.slice(0, 4).map((row, index) => {
              const movement = row.movement?.closer || 0;
              return (
                <span
                  className={row.met ? "met" : movement < 0 ? "away" : ""}
                  key={`objective-condition-${index}`}
                >
                  {conditionLabels[row.condition.key || row.condition.type] ||
                    row.condition.key ||
                    row.condition.type}
                  <b>
                    {row.met
                      ? "✓"
                      : movement > 0
                        ? "↑"
                        : movement < 0
                          ? "↓"
                          : "·"}
                  </b>
                </span>
              );
            })}
          </div>
        ) : (
          <p>Работа без заданных критериев</p>
        )}
        <strong>
          {trackedContract ? `${readyCount}/${goalRows.length}` : "—"}
        </strong>
      </section>
      <div className="workbench-columns">
        <aside className="state-column">
          <div
            className={`current-state state-${currentObservation?.behavioralState || "responsive"}`}
          >
            <small>СЕЙЧАС</small>
            <strong>{currentState.title}</strong>
            <p>{telemetry?.summary || currentState.description}</p>
          </div>
          <div className="telemetry-readout">
            {telemetry?.signals
              .filter((signal) =>
                ["pulse", "breathing", "contact"].includes(signal.id),
              )
              .map((signal) => (
                <div key={signal.id}>
                  <span>{signal.label}</span>
                  <strong>
                    {signal.value}
                    {signal.unit && !signal.value.includes(signal.unit)
                      ? ` ${signal.unit}`
                      : ""}
                  </strong>
                  <i className={`trend-${signal.trend}`}>
                    {signal.trend === "up"
                      ? "↑"
                      : signal.trend === "down"
                        ? "↓"
                        : "→"}
                  </i>
                </div>
              )) || <p className="muted">Монитор ожидает данные.</p>}
          </div>
          {telemetry?.behavioral?.length ? (
            <div className="behavioral-readout">
              <small>НАБЛЮДАЕМОЕ ПОВЕДЕНИЕ</small>
              {telemetry.behavioral.slice(0, 1).map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          ) : null}
          <h3>Ориентир</h3>
          <div className="contract-target">
            <select
              aria-label="Контракт-ориентир"
              value={trackedContractId || ""}
              onChange={(e) => trackContract(e.target.value || null)}
            >
              <option value="">Без ориентира</option>
              {contracts
                .filter((c) => c.state === "accepted")
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    Принят · {c.title}
                  </option>
                ))}
              {contracts
                .filter((c) => c.state === "available")
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    Доступен · {c.title}
                  </option>
                ))}
            </select>
            {trackedContract ? (
              <>
                <p title={trackedContract.description}>
                  {trackedContract.description}
                </p>
                <div className="goal-list">
                  {goalRows.map((row, i) => {
                    const movement = row.movement,
                      moveText =
                        movement && Math.abs(movement.delta) >= 0.05
                          ? `${movement.delta > 0 ? "+" : ""}${movement.delta.toFixed(2)} · ${movement.closer > 0 ? "ближе" : movement.closer < 0 ? "дальше" : "без сдвига"}`
                          : null;
                    return (
                      <div
                        className={row.met ? "ok" : ""}
                        key={`${row.condition.key || row.condition.type}-${i}`}
                      >
                        <i>{row.met ? "✓" : "·"}</i>
                        <span>
                          {conditionLabels[
                            row.condition.key || row.condition.type
                          ] ||
                            row.condition.key ||
                            row.condition.type}
                          <small>{moveText}</small>
                        </span>
                        <b>
                          {displayConditionValue(
                            row.condition.key || row.condition.type,
                            row.value,
                          )}{" "}
                          {row.condition.operator}{" "}
                          {displayConditionValue(
                            row.condition.key || row.condition.type,
                            row.condition.value,
                          )}
                        </b>
                      </div>
                    );
                  })}
                </div>
                <small className="contract-status">
                  {trackedContract.state === "available"
                    ? "Контракт можно принять у Связного."
                    : readyCount === goalRows.length && goalRows.length
                      ? "Актив готов к передаче у Связного."
                      : "Контракт принят · актив не закреплён"}
                </small>
              </>
            ) : (
              <p>
                Работайте свободно или выберите заказ для сравнения состояния.
              </p>
            )}
          </div>
          <h3>Активные контексты · {visibleContexts.length}</h3>
          {!visibleContexts.length && (
            <p className="muted">Активных контекстов нет</p>
          )}
          <h3>Одежда и оборудование</h3>
          {wornContexts.length ? (
            <div className="context-list">
              {wornContexts.map((c, i) => (
                <div key={`${c.actionId}-worn-${i}`}>
                  <b>{c.label || c.actionId}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Ничего</p>
          )}
          <h3>Поза, эффекты и состояния</h3>
          {otherContexts.length ? (
            <div className="context-list">
              {otherContexts.map((c, i) => (
                <div key={`${c.actionId}-${i}`}>
                  <span>
                    {c.type === "pose" || c.actionId.startsWith("pose_")
                      ? "Поза"
                      : c.actionId.startsWith("effect_")
                        ? "Эффект"
                        : c.pointId
                          ? `Контекст · ${c.pointId}`
                          : "Состояние"}
                  </span>
                  <b>{c.label || c.actionId}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Без дополнительных состояний</p>
          )}
          {error && <div className="outcome failure">{error}</div>}
        </aside>
        <section className="character-column">
          <div
          className={`character-stage ambient-${currentObservation?.behavioralState || "responsive"} ${edgeProfile.active ? `ambient-edge-${edgeProfile.kind}` : ""} ${secondaryVisualPath ? "has-secondary" : ""}`}
          >
            <div className="portrait-placeholder">
              {secondaryVisualPath && (
                <div
                  className={`calibration-secondary-avatar ${activeIsSecondary ? "active" : ""}`}
                  style={{ opacity: activeIsSecondary ? 1 : 0.5, viewTransitionName: activeIsSecondary ? 'avatar-main' : 'avatar-secondary' }}
                  onClick={() => swapSubjects(activeIsSecondary ? SUBJECT : (nearbyCharacter?.id || SUBJECT))}
                >
                  <span className="portrait-fallback">{(secondaryName || "?").slice(0, 1).toUpperCase()}</span>
                  <img className="calibration-character-image" src={secondaryVisualPath} alt={secondaryName || ""} onError={(e) => { e.currentTarget.hidden = true; }} />
                </div>
              )}
              <div className={`calibration-avatar-frame ${activeIsSecondary ? "dimmed" : ""}`} style={{ viewTransitionName: activeIsSecondary ? 'avatar-secondary' : 'avatar-main' }}>
                <span className="portrait-fallback">{subjectName.slice(0, 1).toUpperCase()}</span>
                <img className="calibration-character-image" src={activeVisualPath} alt={subjectName}
                  onLoad={(e) => setDisplayedVisualPath(new URL(e.currentTarget.src).pathname)}
                  onError={(e) => {
                    if (expandedVisualPath && e.currentTarget.src.endsWith(expandedVisualPath) && interactionVisualPath) {
                      e.currentTarget.src = interactionVisualPath;
                    } else if (portraitFallbackPath && e.currentTarget.src.endsWith(portraitFallbackPath)) {
                      e.currentTarget.hidden = true;
                    } else if (e.currentTarget.src.endsWith(baseVisualPath)) {
                      if (portraitFallbackPath && !e.currentTarget.src.endsWith(portraitFallbackPath)) {
                        e.currentTarget.src = portraitFallbackPath;
                      } else {
                        e.currentTarget.hidden = true;
                      }
                    } else {
                      e.currentTarget.src = baseVisualPath;
                    }
                  }}
                />
              </div>
              {activeProcesses[0] && (
                <GameSustainedEffect
                  actionId={activeProcesses[0].action.id}
                  compact
                  label={
                    activeProcesses[0].context.label ||
                    activeProcesses[0].action.label
                  }
                  minutes={Math.max(
                    0,
                    Math.floor(activeProcesses[0].context.ticksActive || 0),
                  )}
                />
              )}
              {visualEffect && (
                <GameActionEffect
                  effectKey={visualEffect.key}
                  family={visualEffect.family}
                  result={visualEffect.result}
                  intensity={visualEffect.intensity}
                  sharpness={visualEffect.sharpness}
                  actionKey={visualEffect.actionKey}
                  actionImage={visualEffect.actionImage}
                  actionLabel={visualEffect.actionLabel}
                  targetLabel={visualEffect.target}
                  characterSlug={visualCharacterSlugs[SUBJECT]}
                  emotion={visualEffect.emotion}
                  showPortrait={visualEffect.showPortrait}
                />
              )}
              <small>ДИАГНОСТИЧЕСКИЙ СТОЛ</small>
            </div>
            {isPeakEvent &&
              peakEventKind &&
              peakEventPresentation &&
              peakObservation && (
                <GamePeakEffect
                  kind={peakEventKind}
                  effectKey={`peak-${peakEventKind}-${monitorPulse}`}
                  characterSlug={visualCharacterSlugs[SUBJECT] || "mira"}
                  actionImage={peakActionImagePath(peakObservation)}
                />
              )}
          </div>
          <div className="character-chat">
            <header>
              <strong>КАНАЛ КАЛИБРОВКИ</strong>
              <span className="chat-channel-state">КАНАЛ ОТКРЫТ</span>
            </header>
            <CharacterChatFeed
              lines={chatLines}
              typing={
                generatingSpeech &&
                !chatLines.some((line) => line.id.startsWith("stream:"))
              }
              typingSpeaker={
                speechTargetId === SUBJECT
                  ? subjectName
                  : nearbyCharacters.find((character) => character.id === speechTargetId)?.name || speechTargetId
              }
              typingActorId={speechTargetId}
              typingContext="Диагностический стол"
              endRef={chatEndRef}
              speakerLabel={(line) => speakerLabel(line.speaker)}
              avatarSrc={(line) => {
                if (line.avatarPath) return line.avatarPath;
                if (line.role === "calibrator" || line.role === "system")
                  return undefined;
                const speaker = line.speaker.toLowerCase();
                if (
                  line.actorId === SUBJECT ||
                  speaker === "mira" ||
                  speaker === subjectName.toLowerCase()
                ) {
                  return `/character-images/portraits/${visualCharacterSlugs[SUBJECT]}/${line.portraitEmotion || "neutral"}.png`;
                }
                const character = nearbyCharacters.find(
                  (entry) =>
                    entry.id === line.actorId ||
                    entry.name.toLowerCase() === speaker ||
                    entry.id.toLowerCase() === speaker,
                );
                const slug = character
                  ? visualCharacterSlugs[character.id]
                  : undefined;
                return slug
                  ? `/character-images/portraits/${slug}/${line.portraitEmotion || "neutral"}.png`
                  : undefined;
              }}
            />
            <form
              className="speech-input"
              onSubmit={(e) => {
                e.preventDefault();
                sendSpeech();
              }}
            >
              <div className="chat-target-picker">
                {speechTargetMenuOpen && speechCharacters.length > 1 && (
                  <div className="chat-target-menu" role="menu" aria-label="Выбрать адресата">
                    {speechCharacters.map((character) => {
                      const portrait = speechPortraitFor(character);
                      return (
                        <button
                          type="button"
                          role="menuitem"
                          key={character.id}
                          className={character.id === speechTargetId ? "active" : ""}
                          title={character.name}
                          onClick={() => {
                            setSpeechTargetMenuOpen(false);
                            setSpeechTargetId(character.id);
                            onFocusCharacter?.(character.id);
                          }}
                        >
                          {portrait ? (
                            <img
                              src={portrait.src}
                              alt={character.name}
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = portrait.fallback;
                              }}
                            />
                          ) : (
                            <b>{character.name.slice(0, 1)}</b>
                          )}
                          <span>{character.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {(() => {
                  const target =
                    speechCharacters.find((character) => character.id === speechTargetId) ||
                    speechCharacters[0];
                  const portrait = speechPortraitFor(target);
                  return (
                    <button
                      type="button"
                      className={`chat-target-current ${speechTargetMenuOpen ? "active" : ""}`}
                      aria-label={`Адресат: ${target.name}`}
                      aria-expanded={speechTargetMenuOpen}
                      title={`Адресат: ${target.name}`}
                      disabled={busy || running || speechCharacters.length < 2}
                      onClick={() => setSpeechTargetMenuOpen((open) => !open)}
                    >
                      {portrait ? (
                        <img
                          src={portrait.src}
                          alt={target.name}
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = portrait.fallback;
                          }}
                        />
                      ) : (
                        <b>{target.name.slice(0, 1)}</b>
                      )}
                    </button>
                  );
                })()}
              </div>
              <textarea
                aria-label="Реплика калибратора"
                rows={1}
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    sendSpeech();
                  }
                }}
                disabled={busy || running}
              />
              <button
                type="submit"
                className="speech-send-icon"
                aria-label="Отправить реплику"
                title="Отправить реплику"
                disabled={busy || running || !playerInput.trim()}
              >
                ➤
              </button>
            </form>
          </div>
          <div
            className={`scene-monitor state-${currentObservation?.behavioralState || "responsive"}`}
          >
            <CalibrationBiometrics
              activation={activation}
              activationLabel={activationLabel}
              capacity={subject?.capacity || 0}
              enduranceLabel={enduranceLabel}
              capacityDelta={currentObservation?.changes?.capacity}
              pulseBpm={pulseBpm}
              pulsePeriod={pulsePeriod}
              breathingRate={breathingRate}
              breathingPeriod={breathingPeriod}
              activationBalance={activationBalance}
              currentValence={currentObservation?.reaction?.appraisal}
              activationNature={activationNature}
              overload={currentOverload}
              overloadLabel={overloadLabel}
              overloadActive={sensoryOverloadActive}
            />
            <div className="physiology-panel legacy-physiology-panel">
              <section
                className={`activation-scale level-${edgeProfile.kind === "negative" || edgeProfile.kind === "exhausted" ? "danger" : edgeProfile.active || activation >= 85 ? "edge" : activation >= 70 ? "high" : "normal"}`}
              >
                <header>
                  <span>ФИЗИОЛОГИЧЕСКАЯ АКТИВАЦИЯ</span>
                  <b>
                    {activationLabel} · {Math.round(activation)}%
                  </b>
                </header>
                <div>
                  <i style={{ width: `${activation}%` }} />
                  <em style={{ left: `${activation}%` }} />
                </div>
                <footer>
                  <span>Спокойствие</span>
                  <span>Рабочая</span>
                  <span>Предел</span>
                </footer>
                <div className="live-biosignals">
                  <section
                    className="pulse-biosignal"
                    style={
                      {
                        "--signal-period": `${pulsePeriod * 2}s`,
                      } as React.CSSProperties
                    }
                  >
                    <header>
                      <span>ПУЛЬС</span>
                      <b>
                        {pulseBpm.toFixed(0)} <i>уд/мин</i>
                      </b>
                    </header>
                    <div className="pulse-cardiogram" aria-hidden="true">
                      <svg viewBox="0 0 180 32" preserveAspectRatio="none">
                        <path
                          className="scope-trace-live"
                          d="M0 18 H24 C29 18 30 14 35 14 C40 14 42 18 47 18 H58 L63 21 L68 5 L74 28 L81 18 H96 C103 18 105 12 113 12 C122 12 126 18 135 18 H180"
                        />
                      </svg>
                    </div>
                  </section>
                  <section
                    className="breathing-biosignal"
                    style={
                      {
                        "--signal-period": `${breathingPeriod}s`,
                      } as React.CSSProperties
                    }
                  >
                    <header>
                      <span>ДЫХАНИЕ</span>
                      <b>
                        {breathingRate.toFixed(0)} <i>вдох/мин</i>
                      </b>
                    </header>
                    <div className="breathing-field" aria-hidden="true">
                      <i />
                      <em />
                    </div>
                  </section>
                </div>
                {edgeProfile.active && (
                  <p
                    className="edge-profile-note"
                    title={edgeProfile.description}
                    aria-label={`Вероятный исход: ${expectedPeakOutcome}. ${edgeProfile.description}`}
                  >
                    <span>ВЕРОЯТНЫЙ ИСХОД</span>
                    <b>{expectedPeakOutcome}</b>
                  </p>
                )}
              </section>
              <section
                className="endurance-card endurance-stack"
                style={
                  {
                    "--endurance-angle": `${clampPercent(subject?.capacity || 0) * 3.6}deg`,
                    "--balance-position": `${clampPercent(50 + activationBalance / 2)}%`,
                    "--overload-level": `${clampPercent(currentOverload)}%`,
                  } as React.CSSProperties
                }
              >
                <div className="endurance-scale">
                  <header>
                    <span>ВЫНОСЛИВОСТЬ</span>
                    <b>{enduranceLabel}</b>
                  </header>
                  <div className="endurance-liquid-container">
                    <EnduranceLiquid value={subject?.capacity || 0} overload={currentOverload} />
                  </div>
                </div>
                <div className="endurance-overload-row">
                  <small>{overloadLabel}</small>
                  <b>{currentOverload.toFixed(1)}</b>
                </div>
                <div className="endurance-pendulum-row">
                  <BalancePendulum
                    balance={activationBalance}
                    nature={activationNature}
                    valence={currentObservation?.reaction?.appraisal}
                    showLabels={false}
                  />
                </div>
                <div className="endurance-balance-labels">
                  <BalanceLabels
                    balance={activationBalance}
                    nature={activationNature}
                    valence={currentObservation?.reaction?.appraisal}
                  />
                </div>
              </section>
            </div>
            <section className="state-trends unified-state-trends">
              {(
                [
                  [
                    "Принятие",
                    "attitude",
                    subject?.attitude,
                    stateBaseline(subject, "Attitude"),
                    "mint",
                  ],
                  [
                    "Открытость",
                    "openness",
                    subject?.openness,
                    stateBaseline(subject, "Openness"),
                    "blue",
                  ],
                  [
                    "Пластичность",
                    "plasticity",
                    subject?.plasticity,
                    stateBaseline(subject, "Plasticity"),
                    "amber",
                  ],
                  [
                    "Чувствительность",
                    "sensitivity",
                    subject?.sensitivity,
                    stateBaseline(subject, "Sensitivity"),
                    "violet",
                  ],
                ] as const
              ).map(([label, key, value, baseline, tone]) => {
                const delta = currentObservation?.changes?.[key];
                const changed =
                  monitorPulse > 0 &&
                  typeof delta === "number" &&
                  Math.abs(delta) >= 0.01;
                const historyValues = stateHistory
                  .map((snapshot) => snapshot[key])
                  .filter(Number.isFinite);
                const relative =
                  key === "attitude"
                    ? undefined
                    : coreInterpretations[key as InterpretableCoreMetric];
                return (
                  <article
                    className={`metric-${key}${changed ? " just-changed" : ""}`}
                    key={`${key}-${monitorPulse}`}
                  >
                    <header className={`trend-lane-label ${tone}`}>
                      <span>{label}</span>
                      <b
                        title={
                          relative ? formatRelativeValue(relative) : undefined
                        }
                      >
                        {relative
                          ? `${relative.humanPercent}%`
                          : value?.toFixed(0) || "—"}
                      </b>
                      {changed && <em>{signed(delta)}</em>}
                    </header>
                    <CalibrationTrendInstrument
                      metricKey={key}
                      label={label}
                      value={Number(value || 0)}
                      baseline={baseline}
                      history={historyValues}
                      tone={tone}
                    />
                  </article>
                );
              })}
            </section>
            <div className="monitor-status-strip">
              <div className="condition-main">
                <div className="condition-pose">
                  {poseContext ? (
                    <>
                      <span className="condition-label">{poseContext.label || poseContext.actionId}</span>
                      {(contextLearningBySource.get(poseContext.actionId) || []).length > 0 ? (
                        <span className="condition-effect active">
                          {effectiveSelectedAction ? "+" : "±"} {(contextLearningBySource.get(poseContext.actionId) || []).slice(0, 3).map(e => semanticTagLabels[e.tag] || e.tag).join(", ")}
                        </span>
                      ) : (
                        <span className="condition-effect muted">не модифицирует</span>
                      )}
                      {!!poseContext.blocksPoints?.length && (
                        <span className="condition-effect blocked">закрыто зон: {poseContext.blocksPoints.length}</span>
                      )}
                    </>
                  ) : (
                    <span className="condition-label muted">без ограничений</span>
                  )}
                </div>
                <div className="condition-contexts">
                  {wornContexts.length > 0 && (
                    <div className="condition-group">
                      <small>надетое</small>
                      <div className="condition-list">
                        {wornContexts.map(c => {
                          const tags = contextLearningBySource.get(c.actionId) || [];
                          return (
                            <span key={c.actionId} className={`condition-item ${tags.length > 0 ? "active" : ""}`}>
                              <b>{c.label || c.actionId}</b>
                              {tags.length > 0 && (
                                <i>{effectiveSelectedAction ? "+" : "±"} {tags.slice(0, 2).map(e => semanticTagLabels[e.tag] || e.tag).join(", ")}</i>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {otherContexts.length > 0 && (
                    <div className="condition-group">
                      <small>условия</small>
                      <div className="condition-list">
                        {otherContexts.map(c => {
                          const tags = contextLearningBySource.get(c.actionId) || [];
                          return (
                            <span key={c.actionId} className={`condition-item ${tags.length > 0 ? "active" : ""}`}>
                              <b>{c.label || c.actionId}</b>
                              {tags.length > 0 && (
                                <i>{effectiveSelectedAction ? "+" : "±"} {tags.slice(0, 2).map(e => semanticTagLabels[e.tag] || e.tag).join(", ")}</i>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {lastConditioningChanges.length > 0 && (
                <div className="condition-changes">
                  <small>получено</small>
                  {lastConditioningChanges.slice(0, 3).map(({ tag, delta, source }, i) => (
                    <span key={i} className="change-entry">
                      <b>{semanticTagLabels[tag] || tag}</b>
                      <i>{signed(delta, 3)}</i>
                      {source && <em>через «{source}»</em>}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <aside
              className="monitor-control-layout__recommendations"
              aria-label="Область палитры рекомендаций"
            >
              {Array.from({ length: 3 }, (_, index) => {
                const quick = quickActions[index];
                return (
                  <button
                    className={`control-recommendation-card ${quick?.repeat ? "repeat" : ""}`}
                    disabled={!quick || busy}
                    key={`control-recommendation-${index}`}
                    onClick={() => runQuickAction(index)}
                    onMouseEnter={() =>
                      quick && setSelectedActionId(quick.action.id)
                    }
                    onMouseLeave={() => setSelectedActionId("")}
                    style={
                      quick
                        ? ({
                            "--action-image": `url("${actionImagePath(quick.action, quick.pointId)}")`,
                          } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <kbd>{index + 1}</kbd>
                    <strong>
                      {quick
                        ? `${quick.action.label} · ${quick.pointLabel || quick.pointId || "Всё тело"}`
                        : "Подбираем действие"}
                    </strong>
                    <small>
                      {quick?.reason ||
                        quick?.action.hint ||
                        "Доступное действие"}
                    </small>
                  </button>
                );
              })}
            </aside>
            <section
              className="monitor-control-layout__processes"
              aria-label="Область управления продолжительными действиями"
              style={
                {
                  "--process-count": Math.max(1, activeProcesses.length),
                } as React.CSSProperties
              }
            >
              {activeProcesses.length ? (
                activeProcesses.map((process, index) => (
                  <article
                    className={[
                      "control-process-row",
                      index === safeProcessIndex ? "selected" : "",
                      processFeedback?.processStart === process.start
                        ? `feedback-${processFeedback.command}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={`control-process-${process.start}`}
                    onClick={() => setSelectedProcessIndex(index)}
                    style={
                      {
                        "--action-image": `url("${actionImagePath(process.action, process.context.pointId || process.action.pointId)}")`,
                      } as React.CSSProperties
                    }
                  >
                    <header>
                      <kbd>{index === safeProcessIndex ? "W/S" : "·"}</kbd>
                      <strong>
                        {process.context.label || process.action.label}
                      </strong>
                      <span>
                        АВТО ·{" "}
                        {Math.max(
                          0,
                          Math.floor(process.context.ticksActive || 0),
                        )}{" "}
                        мин
                      </span>
                    </header>
                    <div
                      className="control-process-intensity"
                      aria-label={`Интенсивность ${processIntensity(process)} из 3`}
                    >
                      <span>
                        <b>
                          {processIntensity(process) === 3
                            ? "УСИЛЕННАЯ"
                            : processIntensity(process) === 2
                              ? "РАБОЧАЯ"
                              : "НИЗКАЯ"}
                        </b>
                      </span>
                      <div>
                        {[1, 2, 3].map((level) => (
                          <i
                            className={
                              level <= processIntensity(process) ? "active" : ""
                            }
                            key={level}
                          />
                        ))}
                      </div>
                    </div>
                    <footer>
                      <button
                        disabled={!canSlowProcess(process) || busy}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedProcessIndex(index);
                          processCommand("slower", index);
                        }}
                      >
                        <kbd>A</kbd> слабее
                      </button>
                      <button
                        disabled={!process.faster || busy}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedProcessIndex(index);
                          processCommand("faster", index);
                        }}
                      >
                        <kbd>D</kbd> сильнее
                      </button>
                      <button
                        disabled={!process.stop || busy}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedProcessIndex(index);
                          processCommand("stop", index);
                        }}
                      >
                        <kbd>E</kbd> завершить
                      </button>
                    </footer>
                  </article>
                ))
              ) : (
                <div className="intimacy-readiness-panel">
                  <header>
                    <small>ИНТИМНАЯ ГОТОВНОСТЬ</small>
                    <strong>
                      {intimateReadiness < 25
                        ? "НЕ ПРИНИМАЕТ"
                        : intimateReadiness < 55
                          ? "ДОПУСКАЕТ"
                          : intimateReadiness < 80
                            ? "ГОТОВА"
                            : "ЖЕЛАЕТ"}
                    </strong>
                  </header>
                  <div className="intimacy-readiness-metrics">
                    {[
                      ["Готовность", intimateReadiness],
                      ["Возбуждение", intimateArousal],
                      ["Доверие", intimateTrust],
                    ].map(([label, value]) => (
                      <span key={String(label)}>
                        <small>{label}</small>
                        <b>{Math.round(Number(value))}%</b>
                        <i>
                          <em style={{ width: `${Number(value)}%` }} />
                        </i>
                      </span>
                    ))}
                  </div>
                  <p>{intimateRecommendationText}</p>
                  <div className="intimacy-readiness-actions">
                    {intimateRecommendations.map(
                      ({ candidate, label, hotkey }) => (
                        <button
                          disabled={busy}
                          key={`${candidate.action.id}-${candidate.point.id}`}
                          onClick={() =>
                            manualAt(candidate.action, candidate.point.id)
                          }
                          style={
                            {
                              "--action-image": `url("${actionImagePath(candidate.action, candidate.point.id)}")`,
                            } as React.CSSProperties
                          }
                        >
                          <kbd>{hotkey}</kbd>
                          <span>
                            <em>{label}</em>
                            <strong>{candidate.action.label}</strong>
                            <small>{candidate.point.label}</small>
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}
            </section>
            <div className="monitor-outcome-stack">
              <section className="calibration-footer-goal monitor-goal">
                <div className="footer-goal-picker">
                  <small>ЦЕЛЬ</small>
                  <button
                    className="footer-goal-current"
                    onClick={() => setGoalPickerOpen((open) => !open)}
                  >
                    <span>{trackedContract?.title || "Свободная работа"}</span>
                    <i>▴</i>
                  </button>
                  {goalPickerOpen && (
                    <div className="footer-goal-menu">
                      <button
                        onClick={() => {
                          trackContract(null);
                          setGoalPickerOpen(false);
                        }}
                      >
                        Свободная работа
                      </button>
                      {contracts.map((contract) => (
                        <button
                          className={
                            contract.id === trackedContractId ? "active" : ""
                          }
                          key={`monitor-goal-${contract.id}`}
                          onClick={() => {
                            trackContract(contract.id);
                            setGoalPickerOpen(false);
                          }}
                        >
                          {contract.title}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    className="footer-goal-settings"
                    title="Открыть параметры цели"
                    onClick={() => {
                      setProtocolOpen(false);
                      setGoalSettingsOpen(true);
                    }}
                  >
                    ⚙
                  </button>
                </div>
                <div className="footer-goal-conditions goal-core-conditions">
                  {trackedContract
                    ? coreGoalRows.slice(0, 4).map((row, index) => (
                        <span
                          className={row.met ? "met" : ""}
                          key={`monitor-condition-${index}`}
                        >
                          <i>
                            {conditionLabels[
                              row.condition.key || row.condition.type
                            ] ||
                              row.condition.key ||
                              row.condition.type}
                          </i>
                          <b>
                            {displayConditionValue(
                              row.condition.key || row.condition.type,
                              row.value,
                            )}
                            /
                            {displayConditionValue(
                              row.condition.key || row.condition.type,
                              row.condition.value,
                            )}
                          </b>
                          <em>{row.met ? "✓" : "·"}</em>
                        </span>
                      ))
                    : trackedMetrics.slice(0, 4).map((metric) => (
                        <span key={`monitor-metric-${metric}`}>
                          <i>{trackedMetricLabel(metric)}</i>
                          <b>наблюдение</b>
                        </span>
                      ))}
                </div>
                {trackedContract && specialGoalRows.length > 0 && (
                  <div className="goal-extra-conditions">
                    <small>ДОП. УСЛОВИЯ</small>
                    {specialGoalRows.slice(0, 3).map((row, index) => (
                      <span
                        className={row.met ? "met" : ""}
                        key={`monitor-extra-condition-${index}`}
                      >
                        <i>
                          {conditionLabels[
                            row.condition.key || row.condition.type
                          ] ||
                            row.condition.key ||
                            row.condition.type}
                        </i>
                        <b>
                          {displayConditionValue(
                            row.condition.key || row.condition.type,
                            row.value,
                          )}
                          /
                          {displayConditionValue(
                            row.condition.key || row.condition.type,
                            row.condition.value,
                          )}
                        </b>
                        <em>{row.met ? "✓" : "·"}</em>
                      </span>
                    ))}
                  </div>
                )}
              </section>
              {currentObservation && (
                <div
                  className={`operation-last-result monitor-last-result ${monitorPulse > 0 ? "just-updated" : ""} ${isDischarge ? "is-discharge" : ""}`}
                  key={`monitor-result-${monitorPulse}`}
                >
                  <header>
                    <small>
                      {effectiveSelectedAction
                        ? `ПРОГНОЗ · ${effectiveSelectedAction.label}`
                        : isPeakEvent
                          ? "ПИКОВОЕ СОБЫТИЕ"
                          : `РЕЗУЛЬТАТ · ${currentObservation.action?.label || "ДЕЙСТВИЕ"}`}
                    </small>
                    <b>
                      {effectiveSelectedAction
                        ? "ОЖИДАЕТСЯ"
                        : peakEventPresentation?.title ||
                          (currentObservation.reaction?.overload > 8
                            ? "ПЕРЕГРУЗКА"
                            : currentObservation.reaction?.mixed
                              ? "СМЕШАННО"
                              : (currentObservation.reaction?.appraisal || 0) >=
                                  0
                                ? "ПРИНЯТО"
                                : "ОТВЕРГНУТО")}
                    </b>
                  </header>
                  <div className="monitor-reaction-readout">
                    {(
                      [
                        [
                          "Удовольствие",
                          "pleasure",
                          currentObservation.reaction?.pleasure,
                        ],
                        [
                          "Дискомфорт",
                          "discomfort",
                          currentObservation.reaction?.discomfort,
                        ],
                        [
                          "Перегрузка",
                          "overload",
                          currentObservation.reaction?.overload,
                        ],
                      ] as const
                    ).map(([label, metric, value]) => (
                      <span
                        className={`${typeof value === "number" && Math.abs(value) < 0.05 ? "muted-value" : ""} ${forecastedResultMetrics.has(metric) ? `forecast-expected ${forecastTone(metric, resultForecastByMetric.get(metric))} ${forecastIsUncertain(resultForecastByMetric.get(metric)) ? "forecast-uncertain" : ""}` : ""}`}
                        key={`reaction-${label}`}
                      >
                        <i>{label}</i>
                        <b>
                          {forecastedResultMetrics.has(metric)
                            ? forecastValue(resultForecastByMetric.get(metric))
                            : typeof value === "number"
                              ? value.toFixed(1)
                              : "—"}
                        </b>
                      </span>
                    ))}
                  </div>
                  <div className="monitor-change-readout">
                    {(
                      [
                        [
                          "Принятие",
                          "Принятие",
                          "attitude",
                          currentObservation.changes?.attitude,
                        ],
                        [
                          "Напряжение",
                          "Напряжение",
                          "tension",
                          currentObservation.changes?.tension,
                        ],
                        [
                          "Ресурс",
                          "Ресурс",
                          "capacity",
                          currentObservation.changes?.capacity,
                        ],
                        [
                          "Открытость",
                          "Открытость",
                          "openness",
                          currentObservation.changes?.openness,
                        ],
                        [
                          "Чувствительность",
                          "Чувствительность",
                          "sensitivity",
                          currentObservation.changes?.sensitivity,
                        ],
                      ] as const
                    )
                      .filter(
                        ([, , metric, value]) =>
                          (typeof value === "number" &&
                            Math.abs(value) >= 0.01) ||
                          forecastedResultMetrics.has(metric),
                      )
                      .map(([label, shortLabel, metric, value]) => (
                        <span
                          className={
                            forecastedResultMetrics.has(metric)
                              ? `forecast-expected ${forecastTone(metric, resultForecastByMetric.get(metric))} ${forecastIsUncertain(resultForecastByMetric.get(metric)) ? "forecast-uncertain" : ""}`
                              : ""
                          }
                          key={`change-${label}`}
                          title={label}
                        >
                          <i>{shortLabel}</i>
                          <b>
                            {forecastedResultMetrics.has(metric)
                              ? forecastValue(
                                  resultForecastByMetric.get(metric),
                                )
                              : typeof value === "number" &&
                                  Math.abs(value) >= 0.01
                                ? signed(value)
                                : "—"}
                          </b>
                        </span>
                      ))}
                    {!forecastedResultMetrics.size &&
                      !Object.values(currentObservation.changes || {}).some(
                        (value) =>
                          typeof value === "number" && Math.abs(value) >= 0.01,
                      ) && (
                        <span className="no-state-change">
                          <i>Состояние не изменилось</i>
                        </span>
                      )}
                  </div>
                  {lastConditioningChanges.length > 0 && (
                    <section className="monitor-experience-readout">
                      <small>ОПЫТ</small>
                      {lastConditioningChanges.map(({ tag, delta, source }) => (
                        <span
                          key={`conditioning-main-${tag}`}
                          title={
                            source
                              ? `${semanticTagLabels[tag] || tag} через «${source}»`
                              : semanticTagLabels[tag] || tag
                          }
                        >
                          <i>{semanticTagLabels[tag] || tag}</i>
                          <b>
                            {delta > 0 ? "+" : ""}
                            {delta.toFixed(3)}
                          </b>
                          {source && <em>через «{source}»</em>}
                        </span>
                      ))}
                    </section>
                  )}
                  {isDischarge && (
                    <footer className="discharge-aftereffect">
                      <small>ПОСЛЕ ПИКА</small>
                      <span>
                        Рефрактерный период · чувствительность{" "}
                        {signed(currentObservation.changes?.sensitivity)}
                      </span>
                    </footer>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
        <aside className="operations-column">
          {zoneOpen && (
            <CalibrationZoneMap
              subjectId={SUBJECT}
              zones={compatibleZones}
              selectedZoneId={effectiveZoneId}
              blockedPoints={blockedPoints}
              onSelect={(zoneId) => {
                setSelectedZoneId(zoneId);
                setZoneOpen(false);
              }}
              onClose={() => setZoneOpen(false)}
            />
          )}
          <div className="operation-mode-bar">
            <button
              className="session-pause-action"
              title="Дать персонажу восстановиться и приблизить состояние к базовому"
              disabled={busy}
              onClick={() => {
                setSelectedActionId("");
                setZoneOpen(false);
                manual(pauseAction);
              }}
            >
              <span>Ⅱ</span>
              Подождать
            </button>
            <div className="action-tabs">
              <button
                className={operationMode === "impact" ? "active" : ""}
                onClick={() => {
                  setOperationMode("impact");
                  setSelectedActionId("");
                }}
              >
                Воздействия
              </button>
              <button
                className={operationMode === "setup" ? "active" : ""}
                onClick={() => {
                  setOperationMode("setup");
                  setSelectedActionId("");
                }}
              >
                Подготовка
              </button>
            </div>
          </div>
          <div className="game-dock-tools">
            {!trackedContract && (
              <button
                className={goalSettingsOpen ? "active" : ""}
                onClick={() => {
                  setProtocolOpen(false);
                  setGoalSettingsOpen(true);
                }}
              >
                Цели
              </button>
            )}
          </div>
          <div className="operation-toolbar">
            <div className="target-selector">
              <small>ЗОНА</small>
              {selectedAction?.pointId ? (
                <div
                  className={`fixed-target visual-fixed-target ${preparationTarget?.fullBody ? "full-body" : "body-point"}`}
                  style={
                    preparationTarget
                      ? ({
                          "--target-image": `url("${preparationTarget.path}")`,
                        } as React.CSSProperties)
                      : undefined
                  }
                />
              ) : operationMode === "impact" ? (
                <button
                  className="target-zone-card"
                  style={
                    {
                      "--zone-image": `url("${bodypartVisualPath(SUBJECT, selectedZone?.id)}")`,
                    } as React.CSSProperties
                  }
                  onClick={() => setZoneOpen(true)}
                >
                  <span className="target-zone-card__caption">
                    <strong>{selectedZone?.label || "Выберите"}</strong>
                    <small>Карта тела →</small>
                  </span>
                </button>
              ) : selectedAction?.group === "clothing" ? (
                <div
                  className="fixed-target visual-fixed-target full-body"
                  style={
                    preparationTarget
                      ? ({
                          "--target-image": `url("${preparationTarget.path}")`,
                        } as React.CSSProperties)
                      : undefined
                  }
                />
              ) : (
                <div className="fixed-target">
                  <strong>Выберите предмет</strong>
                  <span>чтобы увидеть зону</span>
                </div>
              )}
            </div>
          </div>
          <div className="zone-dynamic-row operation-zone-readout">
            <small>
              ПАРАМЕТРЫ ЗОНЫ · {selectedZone?.label || "НЕ ВЫБРАНА"}
            </small>
            <span
              title={
                activePointSensitivity
                  ? formatRelativeValue(activePointSensitivity)
                  : "Локальная чувствительность"
              }
            >
              Чувствит.{" "}
              <b>
                {activePointSensitivity
                  ? `${activePointSensitivity.humanPercent}%`
                  : "—"}
              </b>
              <i>
                {activePointSensitivity
                  ? `индекс ${Math.round(activePointSensitivity.value)}`
                  : "нет данных"}
              </i>
            </span>
            <span
              title={
                activePointAttitude
                  ? formatRelativeValue(activePointAttitude)
                  : "Локальное принятие"
              }
            >
              Принятие{" "}
              <b>
                {activePointAttitude
                  ? `${activePointAttitude.humanPercent}%`
                  : "—"}
              </b>
              <i>
                {activePointAttitude
                  ? `индекс ${Math.round(activePointAttitude.value)}`
                  : "нет данных"}
              </i>
            </span>
            <span>
              Знакомство <b>{activePoint?.familiarity?.toFixed(0) || "0"}</b>
              <i>локальный опыт</i>
            </span>
            <span>
              Действия <b>{activePoint?.exposureCount || 0}</b>
              <i>на эту зону</i>
            </span>
          </div>
          <div
            className="operation-list compact-grid"
            onMouseLeave={(event) => {
              if (event.currentTarget.contains(document.activeElement))
                (document.activeElement as HTMLElement)?.blur();
              setSelectedActionId("");
            }}
          >
            {Array.from(new Set(visibleActions.map(actionSection))).map(
              (section) => (
                <React.Fragment key={`operation-section-${section}`}>
                  <h3 className="operation-section-heading">{section}</h3>
                  {visibleActions
                    .filter((action) => actionSection(action) === section)
                    .map((a) => {
                      const effectiveAction = a;
                      const authoredTags =
                        actionMeta.find(
                          (meta) => meta.id === effectiveAction.id,
                        )?.tags || [];
                      const tags = Array.from(
                        new Set([
                          ...authoredTags,
                          ...(actionSemanticFallback[effectiveAction.id] || []),
                        ]),
                      )
                        .filter((tag) => semanticTagLabels[tag])
                        .slice(0, 3);
                      const intensity = actionIntensity(effectiveAction, tags);
                      const justPerformed =
                        lastPerformedActionId === effectiveAction.id &&
                        monitorPulse > 0;
                      return (
                        <div
                          className={`${selectedAction?.id === a.id ? "selected" : ""} ${probes.includes(effectiveAction.id) ? "probed" : ""} ${justPerformed ? "just-performed" : ""}`}
                          key={`${a.id}-${justPerformed ? monitorPulse : 0}`}
                          onMouseEnter={() => setSelectedActionId(a.id)}
                        >
                          <button
                            className="operation-execute-tile"
                            style={
                              {
                                "--action-image": `url("${actionImagePath(effectiveAction, resolvedZone(effectiveAction)?.id)}")`,
                              } as React.CSSProperties
                            }
                            title={`${effectiveAction.hint} · Нажать, чтобы выполнить`}
                            disabled={
                              busy ||
                              Boolean(
                                resolvedZone(effectiveAction) &&
                                blockedPoints.has(
                                  resolvedZone(effectiveAction).id,
                                ),
                              )
                            }
                            onFocus={() => setSelectedActionId(a.id)}
                            onClick={() => {
                              setSelectedActionId(a.id);
                              setZoneOpen(false);
                              manual(effectiveAction);
                            }}
                          >
                            <strong>{effectiveAction.label}</strong>
                            <span
                              className="action-intensity"
                              title={`Интенсивность: ${intensity} из 3`}
                              aria-label={`Интенсивность ${intensity} из 3`}
                            >
                              {[1, 2, 3].map((level) => (
                                <i
                                  className={level <= intensity ? "active" : ""}
                                  key={level}
                                />
                              ))}
                            </span>
                            {tags.length > 0 && (
                              <small className="action-card-tags">
                                {tags.map((tag) => (
                                  <span key={tag}>
                                    {semanticTagLabels[tag]}
                                  </span>
                                ))}
                              </small>
                            )}
                            {justPerformed && (
                              <small className="action-completed-mark">
                                выполнено
                              </small>
                            )}
                          </button>
                          {phase === "preparation" &&
                            effectiveAction.group !== "intimate" && (
                              <button
                                className="operation-queue-tile"
                                title="Добавить в протокол"
                                disabled={Boolean(
                                  resolvedZone(effectiveAction) &&
                                  blockedPoints.has(
                                    resolvedZone(effectiveAction).id,
                                  ),
                                )}
                                onFocus={() => setSelectedActionId(a.id)}
                                onClick={() => {
                                  setSelectedActionId(a.id);
                                  add(effectiveAction);
                                }}
                              >
                                ＋
                              </button>
                            )}
                        </div>
                      );
                    })}
                </React.Fragment>
              ),
            )}
          </div>
        </aside>
        <aside
          className={`auxiliary-column ${protocolOpen || goalSettingsOpen ? "expanded" : ""}`}
        >
          <div className="auxiliary-summary">
            <small>СЛУЖЕБНЫЙ КАНАЛ</small>
            <strong>{trackedContract?.title || "Свободная калибровка"}</strong>
            <span>
              {protocol.reduce((n, step) => n + step.repeat, 0)} шагов ·{" "}
              {trackedMetrics.length} показателей
            </span>
            <div>
              <button
                className={protocolOpen ? "active" : ""}
                onClick={() => {
                  setGoalSettingsOpen(false);
                  setProtocolOpen(true);
                }}
              >
                Протокол
              </button>
              {!trackedContract && (
                <button
                  className={goalSettingsOpen ? "active" : ""}
                  onClick={() => {
                    setProtocolOpen(false);
                    setGoalSettingsOpen(true);
                  }}
                >
                  Цели
                </button>
              )}
            </div>
            <section>
              <small>ОЧЕРЕДЬ</small>
              {protocol.length ? (
                protocol.slice(0, 5).map((step, index) => (
                  <span key={`aux-step-${step.key}`}>
                    <b>{index + 1}</b>
                    {step.label}
                    {step.repeat > 1 ? ` ×${step.repeat}` : ""}
                  </span>
                ))
              ) : (
                <i>Добавляйте действия кнопкой ＋</i>
              )}
              {protocol.length > 5 && <i>Ещё {protocol.length - 5}</i>}
            </section>
            <section>
              <small>ОТСЛЕЖИВАЕТСЯ</small>
              <p>{trackedMetrics.map(trackedMetricLabel).join(" · ")}</p>
            </section>
            {nearbyCharacters.length > 0 && (
              <div className="calibration-presence auxiliary-presence">
                <small>ПРИСУТСТВУЮТ</small>
                {nearbyCharacters.map((character) => (
                  <div key={character.id}>
                    <b>
                      <CharacterPortrait
                        id={character.id}
                        name={character.name}
                      />
                    </b>
                    <span>
                      <strong>{character.name}</strong>
                      <i>{character.title || character.role}</i>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <aside
            className={`protocol-drawer ${protocolOpen ? "active" : ""}`}
            aria-hidden={!protocolOpen}
          >
            <header>
              <div>
                <small>АВТОМАТИЗАЦИЯ КАЛИБРОВКИ</small>
                <h2>
                  Протокол · {protocol.reduce((n, step) => n + step.repeat, 0)}{" "}
                  шагов
                </h2>
              </div>
              <button onClick={() => setProtocolOpen(false)}>×</button>
            </header>
            <div className="protocol-drawer-list">
              {protocol.length ? (
                protocol.map((step, index) => {
                  const progress = protocolProgress[step.key];
                  return (
                    <article
                      className={`protocol-drawer-step status-${progress?.status || "pending"}`}
                      key={step.key}
                    >
                      <span>
                        {progress?.status === "completed"
                          ? "✓"
                          : progress?.status === "running"
                            ? "▶"
                            : progress?.status === "error"
                              ? "!"
                              : index + 1}
                      </span>
                      <div className="protocol-step-copy">
                        <strong>
                          {step.label}
                          {step.repeat > 1 ? ` ×${step.repeat}` : ""}
                        </strong>
                        <small>
                          {step.pointLabel || step.pointId || "системно"}
                          {progress
                            ? ` · выполнено ${progress.completedRepeats}/${step.repeat}`
                            : ""}
                        </small>
                      </div>
                      {progress?.completedRepeats ? (
                        <div className="protocol-step-effect">
                          <small>ЭФФЕКТ</small>
                          {trackedMetrics.map((metric) => (
                            <span key={`${step.key}-${metric}`}>
                              {trackedMetricLabel(metric).toLowerCase()}{" "}
                              <b>{protocolMetricValue(progress, metric)}</b>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="protocol-step-effect empty">
                          Ожидает выполнения
                        </div>
                      )}
                      <div className="protocol-step-tools">
                        <button
                          disabled={running}
                          onClick={() => move(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          disabled={running}
                          onClick={() => move(index, 1)}
                        >
                          ↓
                        </button>
                        <button
                          title="Добавить один повтор"
                          disabled={running}
                          onClick={() => repeat(step.key)}
                        >
                          +1
                        </button>
                        <button
                          disabled={running}
                          onClick={() => {
                            setProtocolProgress({});
                            setProtocol((current) =>
                              current.filter((item) => item.key !== step.key),
                            );
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="protocol-drawer-empty">
                  Протокол пуст. Добавляйте действия кнопкой ＋ в панели
                  операций.
                </p>
              )}
            </div>
            <footer>
              <button
                className={running ? "stop" : "run"}
                disabled={!running && (busy || !protocol.length)}
                onClick={() => (running ? (stopRef.current = true) : run())}
              >
                {running ? "■ Остановить" : "▶ Запустить протокол"}
              </button>
            </footer>
          </aside>
          <aside
            className={`goal-settings-panel ${goalSettingsOpen ? "active" : ""}`}
            aria-hidden={!goalSettingsOpen}
          >
            <header>
              <div>
                <small>
                  {trackedContract ? "ЦЕЛЬ КАЛИБРОВКИ" : "СВОБОДНАЯ КАЛИБРОВКА"}
                </small>
                <h2>{trackedContract?.title || "Отслеживаемые параметры"}</h2>
              </div>
              <button onClick={() => setGoalSettingsOpen(false)}>×</button>
            </header>
            {trackedContract ? (
              <>
                <p>{trackedContract.description}</p>
                <div className="goal-contract-details">
                  {goalRows.map((row, index) => (
                    <span
                      className={row.met ? "selected" : ""}
                      key={`goal-detail-${index}`}
                    >
                      <i>
                        {conditionLabels[
                          row.condition.key || row.condition.type
                        ] ||
                          row.condition.key ||
                          row.condition.type}
                      </i>
                      <b>
                        {displayConditionValue(
                          row.condition.key || row.condition.type,
                          row.value,
                        )}{" "}
                        /{" "}
                        {displayConditionValue(
                          row.condition.key || row.condition.type,
                          row.condition.value,
                        )}
                      </b>
                      <strong>{row.met ? "✓" : "·"}</strong>
                    </span>
                  ))}
                </div>
                <footer>
                  <button onClick={() => setGoalSettingsOpen(false)}>
                    Закрыть
                  </button>
                </footer>
              </>
            ) : (
              <>
                <p>
                  Выбранные показатели появятся в прогнозе, результате действия
                  и протоколе.
                </p>
                <div>
                  {trackedMetricOptions.map((option) => {
                    const checked = freeTrackedMetrics.includes(option.id);
                    const limitReached =
                      !checked && freeTrackedMetrics.length >= 6;
                    return (
                      <label
                        className={`${checked ? "selected" : ""} ${limitReached ? "disabled" : ""}`}
                        key={option.id}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={limitReached}
                          onChange={() =>
                            setFreeTrackedMetrics((current) =>
                              checked
                                ? current.length > 1
                                  ? current.filter(
                                      (metric) => metric !== option.id,
                                    )
                                  : current
                                : current.length < 6
                                  ? [...current, option.id]
                                  : current,
                            )
                          }
                        />
                        <span>{option.label}</span>
                        <b>{checked ? "✓" : "+"}</b>
                      </label>
                    );
                  })}
                </div>
                <footer>
                  <small>
                    {freeTrackedMetrics.length}/6 показателей выбрано
                  </small>
                  <button onClick={() => setGoalSettingsOpen(false)}>
                    Готово
                  </button>
                </footer>
              </>
            )}
          </aside>
        </aside>
      </div>
      <footer className={`event-strip ${significantEvent?.kind || ""}`}>
        <span>СОБЫТИЕ</span>
        <div>
          <strong>{significantEvent?.action || "Наблюдение начато"}</strong>
          <p>{significantEvent?.text || "Значимых изменений пока нет."}</p>
        </div>
        <button onClick={() => setHistoryOpen(true)}>История ↑</button>
      </footer>
      {visualReviewOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setVisualReviewOpen(false)}
        >
          <aside
            className="side-drawer visual-review-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2>Ревью аватара</h2>
              <button onClick={() => setVisualReviewOpen(false)}>×</button>
            </header>
            <img src={reviewAssetPath} alt={subjectName} />
            <code>{reviewAssetPath}</code>
            <h3>Решение</h3>
            <div className="visual-review-decisions">
              {(
                [
                  ["keep", "Оставить"],
                  ["rework", "Переделать"],
                  ["reject", "Исключить"],
                ] as const
              ).map(([value, label]) => (
                <button
                  className={visualReviewDecision === value ? "active" : ""}
                  key={value}
                  onClick={() => setVisualReviewDecision(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <h3>Что не так</h3>
            <div className="visual-review-issues">
              {[
                ["identity", "Другой персонаж"],
                ["wardrobe", "Неверная одежда"],
                ["restraint", "Неверная фиксация"],
                ["interaction", "Не читается действие"],
                ["phase", "Неверная эмоция/фаза"],
                ["composition", "Прыгает композиция"],
                ["anatomy", "Анатомия"],
                ["artifacts", "Артефакты/текст"],
                ["duplicate", "Дубликат"],
                ["style", "Не подходит стиль"],
              ].map(([value, label]) => (
                <button
                  className={visualReviewIssues.includes(value) ? "active" : ""}
                  key={value}
                  onClick={() =>
                    setVisualReviewIssues((current) =>
                      current.includes(value)
                        ? current.filter((issue) => issue !== value)
                        : [...current, value],
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <h3>Комментарий</h3>
            <textarea
              value={visualReviewNote}
              onChange={(event) => setVisualReviewNote(event.target.value)}
              placeholder="Что именно нужно изменить при перегенерации?"
            />
            <button
              className="visual-review-save"
              disabled={visualReviewSaving}
              onClick={saveVisualReview}
            >
              {visualReviewSaving
                ? "Сохранение…"
                : visualReviewSaved
                  ? "Сохранено ✓"
                  : "Записать ревью"}
            </button>
          </aside>
        </div>
      )}
      {historyOpen && (
        <div className="drawer-backdrop" onClick={() => setHistoryOpen(false)}>
          <section
            className="bottom-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h2>История взаимодействия</h2>
              <button onClick={() => setHistoryOpen(false)}>Закрыть</button>
            </header>
            <ol>
              {[...entries]
                .reverse()
                .slice(0, 8)
                .map((e, i) => (
                  <li
                    className={e.kind || "normal"}
                    key={`${e.step}-full-${i}`}
                  >
                    <span>{String(e.step).padStart(2, "0")}</span>
                    <div>
                      <strong>{e.action}</strong>
                      <small>{e.metrics}</small>
                      <p>{e.text}</p>
                    </div>
                  </li>
                ))}
            </ol>
          </section>
        </div>
      )}
      {diagnosticsOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setDiagnosticsOpen(false)}
        >
          <aside className="side-drawer" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>Диагностика</h2>
              <button onClick={() => setDiagnosticsOpen(false)}>×</button>
            </header>
            <h3>Скрытая модель · отладка</h3>
            <p>
              Чувствительность:{" "}
              <b>{coreInterpretations.sensitivity.humanPercent}%</b>{" "}
              <small>
                индекс {coreInterpretations.sensitivity.value.toFixed(2)}
              </small>
            </p>
            <p>
              Принятие: <b>{subject?.attitude.toFixed(2) || "—"}</b>
            </p>
            <p>
              Открытость: <b>{coreInterpretations.openness.humanPercent}%</b>{" "}
              <small>
                индекс {coreInterpretations.openness.value.toFixed(2)}
              </small>
            </p>
            <p>
              Пластичность:{" "}
              <b>{coreInterpretations.plasticity.humanPercent}%</b>{" "}
              <small>
                индекс {coreInterpretations.plasticity.value.toFixed(2)}
              </small>
            </p>
            <p>
              Ресурс: <b>{coreInterpretations.capacity.humanPercent}%</b>{" "}
              <small>
                индекс {coreInterpretations.capacity.value.toFixed(2)}
              </small>
            </p>
            <p>
              Напряжение: <b>{subject?.tension.toFixed(2) || "—"}</b>
            </p>
            <h3>Выбранная зона</h3>
            <p>
              Чувствительность:{" "}
              <b>
                {subject?.anatomy?.[displayZoneId]?.localSensitivity?.toFixed(
                  2,
                ) || "—"}
              </b>
            </p>
            <p>
              Baseline:{" "}
              <b>
                {subject?.anatomy?.[
                  displayZoneId
                ]?.baselineLocalSensitivity?.toFixed(2) || "—"}
              </b>
            </p>
            <p>
              Принятие:{" "}
              <b>
                {subject?.anatomy?.[displayZoneId]?.localAttitude?.toFixed(2) ||
                  "—"}
              </b>
            </p>
            <h3>Основания телеметрии</h3>
            {telemetry?.signals.map((signal) => (
              <p key={`debug-${signal.id}`}>
                <b>{signal.label}:</b> {signal.evidence.join(", ")} ·
                уверенность {signal.confidence}
              </p>
            ))}
            <h3>Рабочие наблюдения</h3>
            {findings.length ? (
              <ul>
                {findings.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Наблюдений пока нет.</p>
            )}
            <h3>Последний тик</h3>
            <p className="technical">
              {currentObservation?.technicalText || "Нет данных"}
            </p>
          </aside>
        </div>
      )}
      {menuOpen && (
        <div className="drawer-backdrop" onClick={() => setMenuOpen(false)}>
          <aside
            className="side-drawer menu-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h2>Меню лаборатории</h2>
              <button onClick={() => setMenuOpen(false)}>×</button>
            </header>
            <button onClick={saveTemplate} disabled={!protocol.length}>
              Сохранить протокол
            </button>
            <button onClick={loadTemplate}>Загрузить протокол</button>
            <button onClick={() => setProtocol([])} disabled={!protocol.length}>
              Очистить протокол
            </button>
            <hr />
            <h3>Фоновый контур</h3>
            <button
              className={passive === "gentle" ? "active" : ""}
              onClick={() => setDevice(passive === "gentle" ? null : "gentle")}
            >
              Мягкий ритм
            </button>
            <button
              className={passive === "contrast" ? "active" : ""}
              onClick={() =>
                setDevice(passive === "contrast" ? null : "contrast")
              }
            >
              Контрастный режим
            </button>
            <hr />
            <button
              className="danger-action"
              onClick={() => {
                setMenuOpen(false);
                reset();
              }}
            >
              Начать новую попытку
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}
