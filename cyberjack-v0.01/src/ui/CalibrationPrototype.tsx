import React, { useEffect, useRef, useState } from "react";
import {
  activeVisualInteractionFromContexts,
  buildCalibrationVisualDescriptorV4,
  expandedInteractionAssetPath,
  resolveCalibrationAvatarV4,
  resolveFirstAvailableVisual,
} from "../domain/characterVisuals";
import { deriveEdgeProfile, deriveReactionCharacter } from "../domain/edgeState";
import { canonicalCharacterPortrait, CharacterPortrait } from "./CharacterPortrait";
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
const SCENE = "scene_lab_calibrator",
  ZONE = "neck",
  ENABLE_ADAPTIVE_PROTOCOL = false;
type Phase = "diagnosis" | "preparation";
type PassiveMode = "gentle" | "contrast";
type ProtocolMode = "exact" | "adaptive";
type ActionGroup = "contact" | "pose" | "equipment";
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
};
type Zone = {
  id: string;
  label: string;
  local_sensitivity: number;
  local_attitude: number;
  local_openness?: number;
  familiarity?: number;
};
type ActionMeta = { id: string; validTargets?: string[] | null };
type ActionDef = {
  id: string;
  label: string;
  hint: string;
  group: ActionGroup;
  pointId?: string;
  requiresContext?: string;
  hideWhenContext?: string;
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
type TrackedMetric = "pleasure" | "discomfort" | "overload" | "engagement" | "appraisal" | "tension" | "capacity" | "attitude" | "localAttitude" | "sensitivity" | "localSensitivity" | "baselineLocalSensitivity" | "openness" | "localOpenness" | "plasticity" | "familiarity";
type CalibrationVisualEffect = {
  key: string;
  family: "electric" | "vibration" | "impact" | "cold" | "heat" | "soft" | "sharp" | "restraint" | "pulse";
  result: "accepted" | "mixed" | "rejected" | "overload";
  intensity: number;
  target: string;
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
const trackedMetricLabel = (id: TrackedMetric) => trackedMetricOptions.find((option) => option.id === id)?.label || id;
const visualEffectFamily = (actionId: string): CalibrationVisualEffect["family"] => {
  if (/(shock|taser|electro|tens)/.test(actionId)) return "electric";
  if (/(vibrat|sensory_loop|sensory_pulse)/.test(actionId)) return "vibration";
  if (/(slap|strike|punch|belt|whip)/.test(actionId)) return "impact";
  if (/(ice|cold)/.test(actionId)) return "cold";
  if (/(wax|hot)/.test(actionId)) return "heat";
  if (/(kiss|stroke|massage|lick|breath)/.test(actionId)) return "soft";
  if (/(bite|needle|pinch|scratch)/.test(actionId)) return "sharp";
  if (/(cuff|restraint|suspend|collar|blindfold|gag)/.test(actionId)) return "restraint";
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
type ChatLine = { id: string; speaker: string; text: string; context?: string; repeat?: number; action?: boolean };

const collapseRepeatedActions = (lines: ChatLine[]) => lines.reduce<ChatLine[]>((result, line) => {
  const previous = result[result.length - 1];
  if (line.action && previous?.action && previous.text === line.text) {
    previous.repeat = (previous.repeat || 1) + (line.repeat || 1);
    previous.id = line.id;
    return result;
  }
  result.push({ ...line });
  return result;
}, []);
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
const actions: ActionDef[] = [
  {
    id: "feather_stroke",
    label: "Провести пером",
    hint: "Поверхностный непредсказуемый контакт",
    group: "contact",
  },
  {
    id: "breath_blow",
    label: "Обдать дыханием",
    hint: "Почти бесконтактный тёплый стимул",
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
    group: "contact",
  },
  {
    id: "deep_kiss",
    label: "Поцеловать глубоко",
    hint: "Интенсивный продолжительный контакт",
    group: "contact",
  },
  {
    id: "licking",
    label: "Провести языком",
    hint: "Влажный чувствительный контакт",
    group: "contact",
  },
  {
    id: "deep_massage",
    label: "Надавить и размять",
    hint: "Глубокое давление и принятие",
    group: "contact",
  },
  {
    id: "firm_grip",
    label: "Крепко сжать",
    hint: "Сильный удерживающий контакт",
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
    id: "vibrator_pulse",
    label: "Дать импульс вибратором",
    hint: "Ритмическая направленная стимуляция",
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
    id: "hair_pull",
    label: "Потянуть за волосы",
    hint: "Натяжение и потеря контроля",
    group: "contact",
  },
  {
    id: "finger_insertion",
    label: "Ввести палец",
    hint: "Внутренний контакт без оборудования",
    group: "contact",
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
    label: "Удерживать открытую позу",
    hint: "Продолжительная демонстрация в текущей позе",
    group: "pose",
    pointId: "systemic",
    hideWhenContext: "act_hold_exposure",
  },
  {
    id: "act_end_exposure",
    label: "Завершить демонстрацию",
    hint: "Выйти из удерживаемой открытой позы",
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
  },
  {
    id: "act_shock_collar",
    label: "Разряд через ошейник",
    hint: "Резкое болезненное воздействие",
    group: "equipment",
    pointId: "neck",
    requiresContext: "act_apply_collar",
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
    pointId: "groin",
    hideWhenContext: "act_insert_plug",
  },
  {
    id: "act_activate_plug",
    label: "Включить плаг",
    hint: "Подать ритмический внутренний импульс",
    group: "equipment",
    pointId: "groin",
    requiresContext: "act_insert_plug",
    hideWhenContext: "act_activate_plug",
  },
  {
    id: "act_deactivate_plug",
    label: "Выключить плаг",
    hint: "Остановить внутреннюю вибрацию",
    group: "equipment",
    pointId: "groin",
    requiresContext: "act_activate_plug",
  },
  {
    id: "act_start_vibrator",
    label: "Закрепить вибратор",
    hint: "Запустить устойчивую вибрацию",
    group: "equipment",
    pointId: "groin",
    hideWhenContext: "act_start_vibrator",
  },
  {
    id: "act_adjust_vibration",
    label: "Усилить вибрацию",
    hint: "Перевести устройство в интенсивный режим",
    group: "equipment",
    pointId: "groin",
    requiresContext: "act_start_vibrator",
    hideWhenContext: "act_adjust_vibration",
  },
  {
    id: "act_stop_vibrator",
    label: "Убрать вибратор",
    hint: "Остановить продолжительное воздействие",
    group: "equipment",
    pointId: "groin",
    requiresContext: "act_start_vibrator",
  },
  {
    id: "act_remove_plug",
    label: "Извлечь плаг",
    hint: "Снять внутреннее устройство",
    group: "equipment",
    pointId: "groin",
    requiresContext: "act_insert_plug",
  },
  {
    id: "eq_clothe_jumpsuit",
    label: "Надеть комбинезон",
    hint: "Изолировать большую часть тела",
    group: "equipment",
    pointId: "systemic",
    hideWhenContext: "eq_clothe_jumpsuit",
  },
  {
    id: "eq_clothe_jumpsuit_remove",
    label: "Снять комбинезон",
    hint: "Вернуть доступ к телу",
    group: "equipment",
    pointId: "systemic",
    requiresContext: "eq_clothe_jumpsuit",
  },
  {
    id: "eq_clothe_underwear",
    label: "Надеть бельё",
    hint: "Надеть комплект белья",
    group: "equipment",
    pointId: "systemic",
    hideWhenContext: "eq_clothe_underwear",
  },
  {
    id: "eq_clothe_underwear_remove",
    label: "Снять бельё",
    hint: "Снять комплект белья полностью",
    group: "equipment",
    pointId: "systemic",
    requiresContext: "eq_clothe_underwear",
  },
  {
    id: "eq_clothe_lab_gown",
    label: "Надеть лабораторную рубашку",
    hint: "Свободная одежда для диагностики",
    group: "equipment",
    pointId: "systemic",
    hideWhenContext: "eq_clothe_lab_gown",
  },
  {
    id: "eq_clothe_lab_gown_remove",
    label: "Снять лабораторную рубашку",
    hint: "Открыть тело для работы",
    group: "equipment",
    pointId: "systemic",
    requiresContext: "eq_clothe_lab_gown",
  },
  {
    id: "eq_clothe_calibration_set",
    label: "Надеть калибровочный комплект",
    hint: "Одежда с доступом к датчикам",
    group: "equipment",
    pointId: "systemic",
    hideWhenContext: "eq_clothe_calibration_set",
  },
  {
    id: "eq_clothe_calibration_set_remove",
    label: "Снять калибровочный комплект",
    hint: "Снять топ и шорты",
    group: "equipment",
    pointId: "systemic",
    requiresContext: "eq_clothe_calibration_set",
  },
];
const point = (s: State | null) => s?.anatomy?.[ZONE] || null;
const metricLine = (r: any) =>
  `P ${Number(r?.pleasure || 0).toFixed(1)} · D ${Number(r?.discomfort || 0).toFixed(1)} · O ${Number(r?.overload || 0).toFixed(1)}`;
function calibrationForecast(action: ActionDef, recent: Obs[], metrics: TrackedMetric[]) {
  const precedent = recent.find(item => item.action?.id === action.id);
  const approximate = (value: number | undefined) => `~${Number(value || 0).toFixed(1)}`;
  const directional = (value: number | undefined) => typeof value !== "number" ? "?" : Math.abs(value) < .05 ? "≈" : value > 0 ? "↑" : "↓";
  return metrics.map((metric) => {
    const label = trackedMetricLabel(metric).toLowerCase();
    if (action.id === "wait") return `${label} ${metric === "capacity" ? "↑" : ["tension", "sensitivity"].includes(metric) ? "↓" : "→ к базе"}`;
    if (action.group !== "contact") return `${label} —`;
    if (!precedent) return `${label} ${metric === "capacity" ? "↓" : metric === "tension" ? "вероятно ↑" : "?"}`;
    const value = metric === "pleasure" ? precedent.reaction?.pleasure
      : metric === "discomfort" ? precedent.reaction?.discomfort
      : metric === "overload" ? precedent.reaction?.overload
      : metric === "engagement" ? precedent.reaction?.engagement
      : metric === "appraisal" ? precedent.reaction?.appraisal
      : metric === "localSensitivity" ? precedent.learning?.sensitivityDelta
      : metric === "baselineLocalSensitivity" ? precedent.learning?.baselineSensitivityDelta
      : metric === "familiarity" ? precedent.learning?.familiarityDelta
      : precedent.changes?.[metric as keyof NonNullable<Obs["changes"]>];
    return `${label} ${["pleasure", "discomfort", "overload", "engagement", "appraisal", "capacity"].includes(metric) ? approximate(value) : directional(value)}`;
  });
}
const observationMetricValue = (observation: Obs, metric: TrackedMetric) => ["pleasure", "discomfort", "overload", "engagement", "appraisal"].includes(metric)
  ? Number(observation.reaction?.[metric as keyof NonNullable<Obs["reaction"]>] || 0).toFixed(1)
  : metric === "localSensitivity" ? signed(observation.learning?.sensitivityDelta)
    : metric === "baselineLocalSensitivity" ? signed(observation.learning?.baselineSensitivityDelta)
      : metric === "familiarity" ? signed(observation.learning?.familiarityDelta)
        : signed(observation.changes?.[metric as keyof NonNullable<Obs["changes"]>]);
const protocolMetricValue = (progress: ProtocolStepProgress, metric: TrackedMetric) => ["pleasure", "discomfort", "overload", "engagement", "appraisal"].includes(metric)
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
};
const conditionCurrentValue = (condition: ContractCondition, state: State | null) => {
  if (!state) return undefined;
  if (condition.type === "attitude") return state.attitude;
  if (condition.type === "custom" && condition.key)
    return (state as any)[condition.key];
  return undefined;
};
const conditionValue = (condition: ContractCondition, state: State | null) => {
  if (!state) return undefined;
  const key = condition.type === "attitude" ? "attitude" : condition.key;
  const baselineKeys: Record<string, "Sensitivity" | "Openness" | "Plasticity" | "Attitude"> = {
    sensitivity: "Sensitivity", openness: "Openness", plasticity: "Plasticity", attitude: "Attitude",
  };
  const baselineKey = key ? baselineKeys[key] : undefined;
  return baselineKey
    ? stateBaseline(state, baselineKey) ?? conditionCurrentValue(condition, state)
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
const signed = (value: number | undefined, digits = 1) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value > 0 ? "+" : ""}${value.toFixed(digits)}`
    : "—";
const baselineDelta = (value: number | undefined, baseline: number | undefined) =>
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
    <svg className={`state-sparkline ${tone}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {[25, 50, 75].map((level) => <line className="grid" x1="0" x2="100" y1={level} y2={level} key={level} />)}
      {typeof baseline === "number" && (
        <line className="baseline" x1="0" x2="100" y1={100 - clampPercent(baseline)} y2={100 - clampPercent(baseline)} />
      )}
      <polyline className="history" points={line} />
      <circle className="latest" cx="100" cy={100 - clampPercent(points[points.length - 1])} r="2.7" />
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
};
const characterVisualPath = (
  subjectId: string,
  state: State | null,
  behavioralState?: string,
  climax = false,
) => {
  const descriptor = buildCalibrationVisualDescriptorV4(subjectId, state, behavioralState, climax);
  return resolveCalibrationAvatarV4(descriptor)
    || `/character-images/rendered/${descriptor.characterSlug}/standing__${descriptor.clothing}__none__neutral.png`;
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
      "groin",
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
export function CalibrationPrototype({
  subjectId = "S-AV-01",
  subjectName = "Мира",
  nearbyCharacters = [],
  uiTheme = "industrial",
  onThemeChange,
  onExit,
}: {
  subjectId?: string;
  subjectName?: string;
  nearbyCharacters?: Array<{
    id: string;
    name: string;
    role: string;
    title?: string;
  }>;
  uiTheme?: "industrial" | "graphite" | "paper" | "mist";
  onThemeChange?: (theme: "industrial" | "graphite" | "paper" | "mist") => void;
  onExit?: () => void;
} = {}) {
  const SUBJECT = subjectId;
  const [phase, setPhase] = useState<Phase>("preparation"),
    [actionGroup, setActionGroup] = useState<ActionGroup>("contact"),
    [selectedActionId, setSelectedActionId] = useState(""),
    [selectedZoneId, setSelectedZoneId] = useState(ZONE),
    [zoneOpen, setZoneOpen] = useState(false),
    [zones, setZones] = useState<Zone[]>([]),
    [actionMeta, setActionMeta] = useState<ActionMeta[]>([]),
    [playerInput, setPlayerInput] = useState(""),
    [speechTargetId, setSpeechTargetId] = useState(SUBJECT),
    [chatLines, setChatLines] = useState<ChatLine[]>([]),
    [generatingSpeech, setGeneratingSpeech] = useState(false),
    [llmError, setLlmError] = useState<string | null>(null),
    [protocolOpen, setProtocolOpen] = useState(false),
    [goalSettingsOpen, setGoalSettingsOpen] = useState(false),
    [freeTrackedMetrics, setFreeTrackedMetrics] = useState<TrackedMetric[]>(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(`cyberjack.calibrationMetrics.v2.${SUBJECT}`) || "[]");
        return Array.isArray(saved) && saved.length ? saved.slice(0, 6) : ["attitude", "localAttitude", "localSensitivity", "capacity"];
      } catch { return ["attitude", "localAttitude", "localSensitivity", "capacity"]; }
    }),
    [historyOpen, setHistoryOpen] = useState(false),
    [menuOpen, setMenuOpen] = useState(false),
    [visualReviewOpen, setVisualReviewOpen] = useState(false),
    [visualReviewDecision, setVisualReviewDecision] = useState<"keep" | "rework" | "reject">("rework"),
    [visualReviewIssues, setVisualReviewIssues] = useState<string[]>([]),
    [visualReviewNote, setVisualReviewNote] = useState(""),
    [visualReviewSaving, setVisualReviewSaving] = useState(false),
    [visualReviewSaved, setVisualReviewSaved] = useState(false),
    [displayedVisualPath, setDisplayedVisualPath] = useState<string | null>(null),
    [visualEffect, setVisualEffect] = useState<CalibrationVisualEffect | null>(null),
    [diagnosticsOpen, setDiagnosticsOpen] = useState(false),
    [subject, setSubject] = useState<State | null>(null),
    [relationAttitude, setRelationAttitude] = useState<number | null>(null),
    [stateHistory, setStateHistory] = useState<StateSnapshot[]>(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(`cyberjack.stateHistory.${SUBJECT}`) || "[]");
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
    [recentObservations, setRecentObservations] = useState<Obs[]>([]),
    [protocolMode, setProtocolMode] = useState<ProtocolMode>("exact"),
    [probes, setProbes] = useState<string[]>([]),
    [findings, setFindings] = useState<string[]>([]),
    [entries, setEntries] = useState<Entry[]>([]),
    [protocol, setProtocol] = useState<Step[]>([]),
    [protocolProgress, setProtocolProgress] = useState<Record<string, ProtocolStepProgress>>({}),
    [busy, setBusy] = useState(false),
    [running, setRunning] = useState(false),
    [error, setError] = useState<string | null>(null),
    [passive, setPassive] = useState<PassiveMode | null>(null);
  const stepRef = useRef(0),
    stopRef = useRef(false),
    subjectRef = useRef<State | null>(null),
    observationRef = useRef<Obs | null>(null),
    chatEndRef = useRef<HTMLDivElement | null>(null);
  const load = async () => {
    const q = await fetch(
        `/api/state?subjectId=${SUBJECT}&sceneId=${SCENE}&pointId=${selectedZoneId || ZONE}`,
      ),
      d = await q.json();
    if (!d.success) throw new Error(d.error);
    subjectRef.current = d.subject;
    setSubject(d.subject);
    setRelationAttitude(d.relations?.find((relation: any) => relation.toId === "PL-1" || relation.to_id === "PL-1")?.attitude ?? null);
    setTelemetry(d.telemetry || null);
    setRecentObservations(d.recentObservations || []);
    if (d.recentObservations?.[0]) {
      observationRef.current = d.recentObservations[0];
      setCurrentObservation(d.recentObservations[0]);
    }
    setZones(d.availablePoints || []);
    setActionMeta(d.availableActions || []);
    return d.subject as State;
  };
  const append = (e: Omit<Entry, "step">) => {
    stepRef.current++;
    setEntries((x) => [...x, { ...e, step: stepRef.current }].slice(-16));
  };
  const pushChat = (...lines: Array<Omit<ChatLine, "id">>) =>
    setChatLines((current) =>
      collapseRepeatedActions([
        ...current,
        ...lines.map((line) => ({ ...line, id: crypto.randomUUID() })),
      ]).slice(-100),
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
    const participants = Array.from(new Set([SUBJECT, ...nearbyCharacters.map(character => character.id)]));
    const histories = await Promise.all(participants.map(async participantId => {
      const q = await fetch(`/api/characters/${participantId}/chat?limit=100`),
        d = await q.json();
      if (!d.success) return [];
      return (d.messages || []).map((message: any) => ({ ...message, participantId }));
    }));
    const participantNames = new Map(nearbyCharacters.map(character => [character.id, character.name]));
    const restored = histories
      .flat()
      .sort((left: any, right: any) => Number(left.id) - Number(right.id))
      .map((message: any) => {
        const action = String(message.content || '').match(/^\[Действие\]\s*(.*)$/s);
        return {
          id: String(message.id),
          speaker: action ? "system" : message.role === "assistant"
            ? message.participantId === SUBJECT ? "mira" : participantNames.get(message.participantId) || message.participantId
            : "calibrator",
          text: action ? action[1] : message.content,
          context: message.contextLabel,
          action: Boolean(action),
        };
      });
    setChatLines(collapseRepeatedActions(restored).slice(-100));
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
    Promise.all([load(), loadContracts(), loadChat()]).catch((e) =>
      setError(e.message),
    );
  }, []);
  useEffect(() => {
    if (!subject) return;
    const snapshot: StateSnapshot = {
      at: Date.now(),
      sensitivity: subject.sensitivity,
      attitude: subject.attitude,
      openness: subject.openness,
      plasticity: subject.plasticity,
      capacity: subject.capacity,
      tension: subject.tension,
    };
    setStateHistory((current) => {
      const last = current[current.length - 1];
      if (
        last &&
        ["sensitivity", "attitude", "openness", "plasticity", "capacity", "tension"].every(
          (key) => Math.abs(last[key as keyof StateSnapshot] as number - snapshot[key as keyof StateSnapshot] as number) < 0.001,
        )
      ) return current;
      const next = [...current, snapshot].slice(-40);
      localStorage.setItem(`cyberjack.stateHistory.${SUBJECT}`, JSON.stringify(next));
      return next;
    });
  }, [subject?.sensitivity, subject?.attitude, subject?.openness, subject?.plasticity, subject?.capacity, subject?.tension, SUBJECT]);
  useEffect(() => {
    localStorage.setItem(`cyberjack.calibrationMetrics.v2.${SUBJECT}`, JSON.stringify(freeTrackedMetrics));
  }, [freeTrackedMetrics, SUBJECT]);
  useEffect(() => {
    if (!visualEffect) return;
    const timer = window.setTimeout(() => setVisualEffect(null), visualEffect.family === "vibration" ? 1400 : 1200);
    return () => window.clearTimeout(timer);
  }, [visualEffect?.key]);
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
        body: JSON.stringify(
          wait
            ? {
                subjectId: SUBJECT,
                eventId: SCENE,
                ticks: 1,
                deltaTime: 8,
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
                llmMode: callLLM
                  ? nearbyCharacters.length
                    ? "scene_chance"
                    : "speech_chance"
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
    if (callLLM) setGeneratingSpeech(true);
    try {
      const before = subjectRef.current;
      setLastStateBefore(before ? { ...before } : null);
      const d = await request(item, callLLM);
      if (item.actionId !== "wait") {
        pushChat({
          speaker: "system",
          text: `${item.label} · ${item.pointLabel || selectedZone?.label || "системно"}`,
          context: "Действие",
          action: true,
        });
      } else if (Array.isArray(d.sustainedEffects) && d.sustainedEffects.length) {
        pushChat(...d.sustainedEffects.map((effect: any) => ({
          speaker: "system",
          text: `${effect.label} · ${effect.pointId}`,
          context: "Продолжается",
          action: true,
          repeat: effect.pulses,
        })));
      }
      let after = await load(),
        shared = (d.diagnostics || d.bundle?.diagnostics)?.observation as
          Obs | undefined,
        insight =
          shared?.uiText ||
          observation(item.actionId, d.tickResult, before, after);
      recordObservation(item.label, shared, insight, metricLine(d.tickResult));
      if (item.actionId !== "wait") {
        const reaction = shared?.reaction || d.tickResult || {};
        const overload = Number(reaction.overload || 0);
        const appraisal = Number(reaction.appraisal ?? d.tickResult?.finalValence ?? 0);
        const mixed = Boolean(reaction.mixed) || (Number(reaction.pleasure || 0) > .5 && Number(reaction.discomfort || 0) > .5);
        setVisualEffect({
          key: crypto.randomUUID(),
          family: visualEffectFamily(item.actionId),
          result: overload > 8 ? "overload" : mixed ? "mixed" : appraisal < 0 ? "rejected" : "accepted",
          intensity: clampPercent((Number(reaction.pleasure || 0) + Number(reaction.discomfort || 0) + overload) * 4) / 100,
          target: item.pointLabel || selectedZone?.label || "системно",
        });
      }
      if (callLLM) {
        const replies = (d.actorReplies || []).filter(
          (reply: any) => reply.speech,
        );
        const speech = d.reply?.speech || "";
        setLlmError(d.llmError || null);
        if (replies.length)
          pushChat(
            ...replies.map((reply: any) => ({
              speaker:
                reply.actorId === SUBJECT
                  ? "mira"
                  : reply.actorName || reply.actorId,
              text: reply.speech,
              context: "Диагностический стол",
            })),
          );
        else if (speech)
          pushChat({
            speaker: "mira",
            text: speech,
            context: "Диагностический стол",
          });
        else if (d.llmError)
          pushChat({ speaker: "system", text: "Ответ модели недоступен." });
        else if (!d.llmSkipped)
          pushChat({ speaker: "system", text: `${subjectName} молчит.` });
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
      if (callLLM) setGeneratingSpeech(false);
    }
  };
  const anatomyZones = () =>
    zones.filter((z) =>
      zoneGroups.some((group) => group.points.includes(z.id)),
    );
  const zonesForAction = (a: ActionDef) => {
    if (a.pointId) return zones.filter((z) => z.id === a.pointId);
    const targets =
      actionMeta.find((meta) => meta.id === a.id)?.validTargets || [];
    const allowed = new Set(
      targets.flatMap((target) => targetAliases[target] || [target]),
    );
    const playable = anatomyZones();
    return allowed.size ? playable.filter((z) => allowed.has(z.id)) : playable;
  };
  const playableZones = () =>
    anatomyZones().filter((zone) =>
      actions.some(
        (action) =>
          action.group === "contact" &&
          action.id !== "wait" &&
          zonesForAction(action).some((candidate) => candidate.id === zone.id),
      ),
    );
  const resolvedZone = (a: ActionDef) => {
    const compatible = zonesForAction(a),
      chosen = zones.find((z) => z.id === selectedZoneId),
      selected =
        chosen && compatible.some((z) => z.id === chosen.id)
          ? chosen
          : compatible[0];
    return (
      selected || ({ id: a.pointId || ZONE, label: a.pointId || "Шея" } as Zone)
    );
  };
  const manual = async (a: ActionDef) => {
    if (busy) return;
    const target = resolvedZone(a);
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
    } finally {
      setBusy(false);
    }
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
          body: JSON.stringify({
            subjectId: SUBJECT,
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
      if (shared) {
        observationRef.current = shared;
        setCurrentObservation(shared);
      }
      await load();
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
      if (replies.length)
        pushChat(
          ...replies.map((reply: any) => ({
            speaker:
              reply.actorId === SUBJECT
                ? "mira"
                : reply.actorName || reply.actorId,
            text: reply.speech,
            context: "Диагностический стол",
          })),
        );
      else if (speech)
        pushChat({
          speaker: speechTargetId === SUBJECT ? "mira" : targetName,
          text: speech,
          context: "Диагностический стол",
        });
      else if (d.llmError)
        pushChat({ speaker: "system", text: "Ответ модели недоступен." });
      else pushChat({ speaker: "system", text: `${targetName} не отвечает.` });
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
      return x.map((s) => (s.key === key ? { ...s, repeat: (s.repeat % 3) + 1 } : s));
    });
  const run = async () => {
    if (!protocol.length || busy) return;
    const emptyProgress = (status: ProtocolStepProgress["status"] = "pending"): ProtocolStepProgress => ({
      status, completedRepeats: 0, pleasure: 0, discomfort: 0, overload: 0, engagement: 0, appraisal: 0,
      tension: 0, capacity: 0, attitude: 0, localAttitude: 0, sensitivity: 0, localSensitivity: 0,
      baselineLocalSensitivity: 0, openness: 0, localOpenness: 0, plasticity: 0, familiarity: 0,
    });
    setProtocolProgress(Object.fromEntries(protocol.map((step) => [step.key, emptyProgress()])));
    setGoalSettingsOpen(false);
    setProtocolOpen(true);
    setBusy(true);
    setRunning(true);
    stopRef.current = false;
    try {
      for (const item of protocol) {
        if (stopRef.current) break;
        setProtocolProgress((current) => ({ ...current, [item.key]: { ...(current[item.key] || emptyProgress()), status: "running" } }));
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
                  ? "Реактивность снижена после разрядки — вставлена пауза."
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
                discomfort: previous.discomfort + (obs?.reaction?.discomfort || 0),
                overload: previous.overload + (obs?.reaction?.overload || 0),
                engagement: previous.engagement + (obs?.reaction?.engagement || 0),
                appraisal: previous.appraisal + (obs?.reaction?.appraisal || 0),
                tension: previous.tension + (obs?.changes?.tension || 0),
                capacity: previous.capacity + (obs?.changes?.capacity || 0),
                attitude: previous.attitude + (obs?.changes?.attitude || 0),
                localAttitude: previous.localAttitude + (obs?.changes?.localAttitude || 0),
                sensitivity: previous.sensitivity + (obs?.changes?.sensitivity || 0),
                localSensitivity: previous.localSensitivity + (obs?.learning?.sensitivityDelta || 0),
                baselineLocalSensitivity: previous.baselineLocalSensitivity + (obs?.learning?.baselineSensitivityDelta || 0),
                openness: previous.openness + (obs?.changes?.openness || 0),
                localOpenness: previous.localOpenness + (obs?.changes?.localOpenness || 0),
                plasticity: previous.plasticity + (obs?.changes?.plasticity || 0),
                familiarity: previous.familiarity + (obs?.learning?.familiarityDelta || 0),
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
        setProtocolProgress((current) => current[item.key]?.status === "running"
          ? { ...current, [item.key]: { ...current[item.key], status: "completed" } }
          : current);
      }
    } catch (e: any) {
      setError(e.message);
      setProtocolProgress((current) => {
        const runningEntry = Object.entries(current).find(([, progress]) => progress.status === "running");
        return runningEntry ? { ...current, [runningEntry[0]]: { ...runningEntry[1], status: "error" } } : current;
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
          v.map((s: any) => ({ ...s, key: crypto.randomUUID() })).slice(0, 8),
        );
    } catch {
      setError("Сохранённый шаблон повреждён");
    }
  };
  const activeContextIds = new Set(
      (subject?.contexts || []).map((c) => c.actionId),
    ),
    submissionModifier = (activeContextIds.has("effect_suggestibility") ? 15 : 0) +
      (activeContextIds.has("effect_subspace") ? 10 : 0),
    submission = clampPercent((relationAttitude ?? subject?.attitude ?? 0) + (subject?.plasticity ?? 0) * .5 + submissionModifier),
    submissionLabel = submission >= 65 && (relationAttitude ?? subject?.attitude ?? 0) < 45
      ? "Смирение"
      : submission >= 75 ? "Высокое" : submission >= 50 ? "Умеренное" : "Низкое",
    visibleActions = actions.filter(
      (a) =>
        a.group === actionGroup &&
        (!a.requiresContext || activeContextIds.has(a.requiresContext)) &&
        (!a.hideWhenContext || !activeContextIds.has(a.hideWhenContext)) &&
        (a.group !== "contact" ||
          a.id === "wait" ||
          zonesForAction(a).some((z) => z.id === selectedZoneId)),
    ),
    selectedAction = visibleActions.find((a) => a.id === selectedActionId),
    selectedZone =
      actionGroup === "contact"
        ? zones.find((z) => z.id === selectedZoneId) || playableZones()[0]
        : selectedAction
          ? resolvedZone(selectedAction)
          : undefined,
    compatibleZones =
      actionGroup === "contact"
        ? playableZones()
        : selectedAction
          ? zonesForAction(selectedAction)
          : [],
    blockedPoints = new Set(
      (subject?.contexts || []).flatMap((c) => c.blocksPoints || []),
    ),
    visibleContexts = Array.from(
      new Map(
        (subject?.contexts || [])
          .map((c) => [c.actionId, c]),
      ).values(),
    ),
    wornContexts = visibleContexts.filter(
      (c) =>
        c.type === "clothing" ||
        c.type === "equipment" ||
        c.type === "restraint",
    ),
    otherContexts = visibleContexts.filter(
      (c) =>
        c.type !== "clothing" &&
        c.type !== "equipment" &&
        c.type !== "restraint",
    ),
    poseContext = visibleContexts.find(
      (context) =>
        context.type === "pose" ||
        context.actionId.startsWith("pose_") ||
        context.actionId === "act_suspend_wrists",
    ),
    sessionContexts = visibleContexts.filter((context) => context !== poseContext),
    trackedContract = contracts.find((c) => c.id === trackedContractId) || null,
    trackedMetrics = trackedContract
      ? Array.from(new Set((trackedContract.conditions || []).map((condition) => condition.type === "attitude" ? "attitude" : condition.key).filter((key): key is TrackedMetric => trackedMetricOptions.some((option) => option.id === key)))).slice(0, 6)
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
    readyCount = goalRows.filter((x) => x.met).length,
    currentState =
      currentObservation?.currentState || stateFromContexts(subject),
    activePoint = selectedZoneId
      ? subject?.anatomy?.[selectedZoneId]
      : undefined,
    activation = clampPercent(subject?.tension || 0),
    edgeProfile = deriveEdgeProfile({ tension: subject?.tension || 0, capacity: subject?.capacity || 0 } as any, recentObservations),
    activationLabel = activation < 20
      ? "Спокойная"
      : activation < 45
        ? "Повышенная"
        : activation < 70
          ? "Высокая"
          : activation < 85
            ? "Предельная"
            : edgeProfile.label,
    activationNature = ({ positive: "положительная", negative: "защитная", mixed: "смешанная", neutral: "нейтральная" } as const)[deriveReactionCharacter(recentObservations)],
    pulseSignal = telemetry?.signals.find((signal) => signal.id === "pulse"),
    breathingSignal = telemetry?.signals.find((signal) => signal.id === "breathing"),
    toneSignal = telemetry?.signals.find((signal) => signal.id === "muscleTone"),
    enduranceLabel = (subject?.capacity || 0) < 20
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
        ["effect_apathy", "effect_chronic_apathy", "effect_panic", "effect_sensory_overload"].includes(context.actionId),
      ),
    interactionVisualPath = activeVisualInteraction
      ? `/character-images/interactions/${visualCharacterSlugs[SUBJECT] || SUBJECT}/${activeVisualInteraction.family}/${activeVisualInteraction.variant}__${activeVisualInteraction.phase}.png`
      : null,
    expandedVisualPath = activeVisualInteraction && !criticalVisualState
      ? expandedInteractionAssetPath({
          characterSlug: visualCharacterSlugs[SUBJECT] || SUBJECT,
          interaction: activeVisualInteraction,
          contexts: subject?.contexts || [],
          tension: subject?.tension || 0,
          attitude: subject?.attitude || 0,
          openness: subject?.openness || 0,
          behavioralState: currentObservation?.behavioralState,
          discharged: currentObservation?.transitions?.some((transition) => transition.kind === "discharge") || false,
        })
      : null,
    visualPath = resolveFirstAvailableVisual([
      !criticalVisualState ? expandedVisualPath : null,
      !criticalVisualState ? interactionVisualPath : null,
      baseVisualPath,
      portraitFallbackPath,
    ]) || baseVisualPath,
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
      const response = await fetch(`/api/visual-reviews?assetPath=${encodeURIComponent(reviewAssetPath)}`);
      const data = await response.json();
      const review = data.reviews?.find((entry: any) => entry.characterId === SUBJECT);
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
            contexts: (subject?.contexts || []).map(context => ({ actionId: context.actionId, pointId: context.pointId })),
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
          {onThemeChange && <select className="calibration-theme-switcher" aria-label="Тема интерфейса" value={uiTheme} onChange={event => onThemeChange(event.target.value as "industrial" | "graphite" | "paper" | "mist")}><option value="industrial">Industrial</option><option value="graphite">Graphite</option><option value="paper">Sage</option><option value="mist">Mist</option></select>}
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
                          ? `${movement.delta > 0 ? "+" : ""}${movement.delta.toFixed(1)} · ${movement.closer > 0 ? "ближе" : movement.closer < 0 ? "дальше" : "без сдвига"}`
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
                          {typeof row.value === "number"
                            ? row.value.toFixed(0)
                            : "—"}{" "}
                          {row.condition.operator} {String(row.condition.value)}
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
          {!visibleContexts.length && <p className="muted">Активных контекстов нет</p>}
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
                    {c.type === "pose" || c.actionId.startsWith("pose_") ? "Поза" : c.actionId.startsWith("effect_") ? "Эффект" : c.pointId ? `Контекст · ${c.pointId}` : "Состояние"}
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
          <div className={`character-stage ambient-${currentObservation?.behavioralState || "responsive"} ${edgeProfile.active ? `ambient-edge-${edgeProfile.kind}` : ""}`}>
            <div className="portrait-placeholder">
              <div className={`calibration-avatar-frame ${visualEffect ? `avatar-effect-${visualEffect.family}` : ""}`}>
                <span className="portrait-fallback">
                  {subjectName.slice(0, 1).toUpperCase()}
                </span>
                <img
                  className="calibration-character-image"
                  key={visualPath}
                  src={visualPath}
                  alt={subjectName}
                  onLoad={(event) => setDisplayedVisualPath(new URL(event.currentTarget.src).pathname)}
                  onError={(event) => {
                    if (expandedVisualPath && event.currentTarget.src.endsWith(expandedVisualPath) && interactionVisualPath) {
                      event.currentTarget.src = interactionVisualPath;
                    } else if (portraitFallbackPath && event.currentTarget.src.endsWith(portraitFallbackPath)) {
                      event.currentTarget.hidden = true;
                    } else if (event.currentTarget.src.endsWith(baseVisualPath)) {
                      if (portraitFallbackPath && !event.currentTarget.src.endsWith(portraitFallbackPath)) {
                        event.currentTarget.src = portraitFallbackPath;
                      } else {
                        event.currentTarget.hidden = true;
                      }
                    } else {
                      event.currentTarget.src = baseVisualPath;
                    }
                  }}
                />
              </div>
              {visualEffect && (
                <div
                  className={`calibration-visual-effect effect-${visualEffect.family} result-${visualEffect.result}`}
                  key={visualEffect.key}
                  style={{ "--effect-intensity": Math.max(.25, visualEffect.intensity) } as React.CSSProperties}
                >
                  <i /><i /><i />
                  <b>{visualEffect.target}</b>
                </div>
              )}
              <small>ДИАГНОСТИЧЕСКИЙ СТОЛ</small>
            </div>
            {nearbyCharacters.length > 0 && (
              <div className="calibration-presence">
                <small>ПРИСУТСТВУЮТ</small>
                {nearbyCharacters.map((character) => (
                  <div key={character.id}>
                    <b><CharacterPortrait id={character.id} name={character.name} /></b>
                    <span>
                      <strong>{character.name}</strong>
                      <i>{character.title || character.role}</i>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {selectedZone && (
              <div className="target-indicator">
                <small>ЦЕЛЬ ВОЗДЕЙСТВИЯ</small>
                <strong>{selectedZone.label}</strong>
              </div>
            )}
          </div>
          <div className="monitor-session-strip avatar-session-strip">
            <div>
              <small>ПОЗА</small>
              <b>{poseContext?.label || "Стоит свободно"}</b>
            </div>
            <div>
              <small>ПОДЧИНЕНИЕ</small>
              <b>{Math.round(submission)} · {submissionLabel}</b>
            </div>
            <div className="monitor-session-contexts">
              <small>АКТИВНЫЕ КОНТЕКСТЫ · {sessionContexts.length}</small>
              <b title={sessionContexts.map((context) => context.label || context.actionId).join(" · ")}>
                {sessionContexts.length
                  ? sessionContexts.slice(0, 2).map((context) => context.label || context.actionId).join(" · ")
                  : "Нет"}
                {sessionContexts.length > 2 ? ` · +${sessionContexts.length - 2}` : ""}
              </b>
            </div>
          </div>
            <div className="character-chat">
              <header>
                <strong>КАНАЛ КАЛИБРОВКИ</strong>
                <span>{chatLines.length}/100</span>
              </header>
              <div className="chat-scroll">
                {!chatLines.length && !generatingSpeech && (
                  <p className="chat-empty">Реплик пока нет.</p>
                )}
                {chatLines.map((line) => line.action ? (
                  <div className="chat-action" key={line.id}>
                    <span>{line.text}</span>
                    {(line.repeat || 1) > 1 && <b>×{line.repeat}</b>}
                  </div>
                ) : (
                  <div
                    className={`chat-line ${["mira", "calibrator", "system"].includes(line.speaker) ? line.speaker : "observer"}`}
                    key={line.id}
                  >
                    <small>
                      {speakerLabel(line.speaker)}
                      {line.context ? ` · ${line.context.toUpperCase()}` : ""}
                    </small>
                    <p>{line.text}</p>
                  </div>
                ))}
                {generatingSpeech && (
                  <div className="chat-line mira typing">
                    <small>СЦЕНА · ДИАГНОСТИЧЕСКИЙ СТОЛ</small>
                    <p>Формируется реакция…</p>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>
            <div
              className={`scene-monitor state-${currentObservation?.behavioralState || "responsive"}`}
            >
              <div className="physiology-panel">
                <section className={`activation-scale level-${edgeProfile.kind === "negative" || edgeProfile.kind === "exhausted" ? "danger" : edgeProfile.active || activation >= 85 ? "edge" : activation >= 70 ? "high" : "normal"}`}>
                  <header><span>ФИЗИОЛОГИЧЕСКАЯ АКТИВАЦИЯ</span><b>{activationLabel} · {Math.round(activation)}%</b></header>
                  <div><i style={{ width: `${activation}%` }} /><em style={{ left: `${activation}%` }} /></div>
                  <footer><span>Спокойствие</span><span>Рабочая</span><span>Предел</span></footer>
                  <p>
                    <span>Характер <b>{activationNature}</b></span>
                    <span>Пульс <b>{pulseSignal?.value || "—"}</b></span>
                    <span>Дыхание <b>{breathingSignal?.value || "—"}</b></span>
                    <span>Тонус <b>{toneSignal?.value || "—"}</b></span>
                  </p>
                  {edgeProfile.active && <p className="edge-profile-note">{edgeProfile.description}</p>}
                </section>
                <section className="endurance-scale">
                  <header><span>ВЫНОСЛИВОСТЬ</span><b>{enduranceLabel}</b></header>
                  <div><i style={{ width: `${clampPercent(subject?.capacity || 0)}%` }} /></div>
                  <p><strong>{subject?.capacity.toFixed(0) || "—"}%</strong><span>{signed(currentObservation?.changes?.capacity)} за действие</span></p>
                </section>
              </div>
              <section className="monitor-contract">
                <header>
                  <small>ЦЕЛЬ КАЛИБРОВКИ</small>
                  <div className="monitor-contract-picker">
                    <select aria-label="Цель калибровки" value={trackedContractId || ""} onChange={(event) => { trackContract(event.target.value || null); setGoalSettingsOpen(false); }}>
                      <option value="">Свободная работа</option>
                      {contracts.map((contract) => <option value={contract.id} key={`monitor-goal-${contract.id}`}>{contract.title}</option>)}
                    </select>
                    {!trackedContract && <button title="Настроить отслеживаемые параметры" onClick={() => { setProtocolOpen(false); setGoalSettingsOpen((open) => !open); }}>⚙</button>}
                  </div>
                </header>
                {trackedContract && (
                  <>
                    <div>
                      {goalRows.slice(0, 4).map((row, index) => (
                        <span className={row.met ? "met" : ""} key={`monitor-condition-${index}`}>
                          <i>{conditionLabels[row.condition.key || row.condition.type] || row.condition.key || row.condition.type}</i>
                          <b>{typeof row.value === "number" ? row.value.toFixed(0) : "—"} / {String(row.condition.value)}</b>
                          {typeof row.currentValue === "number" && typeof row.value === "number" && Math.abs(row.currentValue - row.value) >= .5 && <em>сейчас {row.currentValue.toFixed(0)}</em>}
                          <strong>{row.met ? "✓" : "·"}</strong>
                        </span>
                      ))}
                    </div>
                    <div className="monitor-contract-extra">
                      <small>ДОП. ТРЕБОВАНИЯ</small>
                      <span>Не заданы</span>
                    </div>
                  </>
                )}
              </section>
              <div className="state-trends">
                {([
                  ["Принятие", "attitude", subject?.attitude, stateBaseline(subject, "Attitude"), "mint"],
                  ["Открытость", "openness", subject?.openness, stateBaseline(subject, "Openness"), "blue"],
                  ["Пластичность", "plasticity", subject?.plasticity, stateBaseline(subject, "Plasticity"), "amber"],
                  ["Чувствительность", "sensitivity", subject?.sensitivity, stateBaseline(subject, "Sensitivity"), "violet"],
                ] as const).map(([label, key, value, baseline, tone]) => (
                  <section key={key}>
                    <header><span>{label}</span><b>{value?.toFixed(0) || "—"}</b></header>
                    <Sparkline values={stateHistory.map((snapshot) => snapshot[key])} baseline={baseline} tone={tone} />
                    <footer><span>база {baseline?.toFixed(0) || "—"}</span><b>{signed(baselineDelta(value, baseline))}</b></footer>
                  </section>
                ))}
              </div>
            </div>
          <div className="stage-contexts">
            {selectedZone && (
              <span className="target-chip">Зона: {selectedZone.label}</span>
            )}
            {visibleContexts.slice(0, 2).map((c, i) => (
              <span key={`${c.actionId}-stage-${i}`}>
                {c.label || c.actionId}
              </span>
            ))}
            {visibleContexts.length > 2 && (
              <span>+{visibleContexts.length - 2}</span>
            )}
          </div>
          <form
            className="speech-input"
            onSubmit={(e) => {
              e.preventDefault();
              sendSpeech();
            }}
          >
            <select
              aria-label="Адресат реплики"
              value={speechTargetId}
              onChange={(e) => setSpeechTargetId(e.target.value)}
              disabled={busy || running}
            >
              <option value={SUBJECT}>{subjectName}</option>
              {nearbyCharacters
                .filter((character) => character.id !== SUBJECT)
                .map((character) => (
                  <option value={character.id} key={character.id}>
                    {character.name}
                  </option>
                ))}
            </select>
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
              disabled={busy || running || !playerInput.trim()}
            >
              Отправить
            </button>
          </form>
        </section>
        <aside className="operations-column">
          {zoneOpen && (
            <section className="zone-map-panel">
              <header>
                <div>
                  <small>ЦЕЛЬ ВОЗДЕЙСТВИЯ</small>
                  <h2>Карта тела</h2>
                  <p>Выберите область по её текущему отклику.</p>
                </div>
                <button onClick={() => setZoneOpen(false)}>← К операциям</button>
              </header>
              <div className="zone-map-body">
                {zoneGroups.map((group) => {
                  const groupZones = compatibleZones.filter((zone) =>
                    group.points.includes(zone.id),
                  );
                  return groupZones.length ? (
                    <section className={`zone-map-group ${group.id}`} key={group.id}>
                      <h3>{group.label}</h3>
                      <div>
                        {groupZones.map((zone) => {
                          const blocked = blockedPoints.has(zone.id);
                          const selected = zone.id === selectedZoneId;
                          return (
                            <button
                              className={selected ? "selected" : ""}
                              key={zone.id}
                              disabled={blocked}
                              onClick={() => {
                                setSelectedZoneId(zone.id);
                                setZoneOpen(false);
                              }}
                            >
                              <span>
                                <strong>{zone.label}</strong>
                                <small>
                                  {blocked ? "Закрыта контекстом" : selected ? "Текущая цель" : "Доступна"}
                                </small>
                              </span>
                              <span className="zone-map-values">
                                <i>Ч {zone.local_sensitivity.toFixed(0)}</i>
                                <i>П {zone.local_attitude.toFixed(0)}</i>
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
                <span><i>Ч</i> чувствительность</span>
                <span><i>П</i> принятие контакта</span>
              </footer>
            </section>
          )}
          <div className="operations-heading">
            <div>
              <h2>
                {phase === "diagnosis" ? "Диагностические пробы" : "Операции"}
              </h2>
              <p>
                {phase === "diagnosis"
                  ? "Выполните три разных воздействия."
                  : "Соберите воздействие и выполните его."}
              </p>
            </div>
          </div>
          {currentObservation && (
            <div className="operation-last-result">
              <header>
                <small>ПОСЛЕДНЕЕ · {currentObservation.action?.label || "ДЕЙСТВИЕ"}</small>
                <b>{currentObservation.reaction?.overload > 8 ? "ПЕРЕГРУЗКА" : currentObservation.reaction?.mixed ? "СМЕШАННО" : (currentObservation.reaction?.appraisal || 0) >= 0 ? "ПРИНЯТО" : "ОТВЕРГНУТО"}</b>
              </header>
              <div>
                {trackedMetrics.map((metric) => <span key={`result-${metric}`}>{trackedMetricLabel(metric).toLowerCase()} <b>{observationMetricValue(currentObservation, metric)}</b></span>)}
              </div>
            </div>
          )}
          {phase === "preparation" && (
            <div className="action-tabs">
              <button
                className={actionGroup === "contact" ? "active" : ""}
                onClick={() => setActionGroup("contact")}
              >
                Контакт
              </button>
              <button
                className={actionGroup === "pose" ? "active" : ""}
                onClick={() => setActionGroup("pose")}
              >
                Поза
              </button>
              <button
                className={actionGroup === "equipment" ? "active" : ""}
                onClick={() => setActionGroup("equipment")}
              >
                Вещи
              </button>
            </div>
          )}
          <div className="operation-toolbar">
            <div className="target-selector">
              <small>ЗОНА</small>
              {selectedAction?.pointId ? (
                  <div className="fixed-target">
                    <strong>
                      {selectedZone?.label || selectedAction.pointId}
                    </strong>
                    <span>задана</span>
                  </div>
                ) : actionGroup === "contact" ? (
                  <button onClick={() => setZoneOpen(true)}>
                    <strong>{selectedZone?.label || "Выберите"}</strong>
                    <span>Карта тела →</span>
                  </button>
                ) : (
                  <div className="fixed-target"><strong>Не применяется</strong><span>системно</span></div>
                )}
            </div>
          </div>
          <div className="zone-dynamic-row operation-zone-readout">
            <small>ПАРАМЕТРЫ ЗОНЫ · {selectedZone?.label || "НЕ ВЫБРАНА"}</small>
            <span title="Локальная чувствительность">Чувствит. <b>{activePoint?.localSensitivity?.toFixed(0) || "—"}</b><i>{signed(baselineDelta(activePoint?.localSensitivity, activePoint?.baselineLocalSensitivity))} от базы</i></span>
            <span>Принятие <b>{activePoint?.localAttitude?.toFixed(0) || "—"}</b><i>{signed(baselineDelta(activePoint?.localAttitude, activePoint?.baselineLocalAttitude))} от базы</i></span>
            <span>Знакомство <b>{activePoint?.familiarity?.toFixed(0) || "0"}</b><i>локальный опыт</i></span>
            <span>Действия <b>{activePoint?.exposureCount || 0}</b><i>на эту зону</i></span>
          </div>
          <div className={`action-forecast-strip ${selectedAction ? "" : "empty"}`}>
            <small>{selectedAction ? `ПРОГНОЗ · ${selectedAction.label}` : "ПРОГНОЗ"}</small>
            {selectedAction ? (
              <>
              <div className="calibration-forecast">
                {calibrationForecast(selectedAction, recentObservations, trackedMetrics).map(item => <i key={item}>{item}</i>)}
              </div>
              {(subject?.capacity || 0) < 25 && selectedAction.id !== "wait" && selectedAction.group === "contact" && (
                <em className="capacity-learning-warning">Ресурс ниже 25: принятие почти не закрепляется.</em>
              )}
              </>
            ) : <p>Наведите на действие, чтобы увидеть прогноз.</p>}
          </div>
          <div
            className="operation-list compact-grid"
            onMouseLeave={(event) => {
              if (event.currentTarget.contains(document.activeElement))
                (document.activeElement as HTMLElement)?.blur();
              setSelectedActionId("");
            }}
          >
            {visibleActions.map((a) => (
              <div
                className={`${selectedAction?.id === a.id ? "selected" : ""} ${probes.includes(a.id) ? "probed" : ""}`}
                key={a.id}
                onMouseEnter={() => setSelectedActionId(a.id)}
              >
                <button
                  className="operation-execute-tile"
                  title={`${a.hint} · Нажать, чтобы выполнить`}
                  disabled={busy || Boolean(resolvedZone(a) && blockedPoints.has(resolvedZone(a).id))}
                  onFocus={() => setSelectedActionId(a.id)}
                  onClick={() => { setSelectedActionId(a.id); setZoneOpen(false); manual(a); }}
                ><strong>{a.label}</strong></button>
                {phase === "preparation" && (
                  <button
                    className="operation-queue-tile"
                    title="Добавить в протокол"
                    disabled={Boolean(resolvedZone(a) && blockedPoints.has(resolvedZone(a).id))}
                    onFocus={() => setSelectedActionId(a.id)}
                    onClick={() => { setSelectedActionId(a.id); add(a); }}
                  >＋</button>
                )}
              </div>
            ))}
          </div>
        </aside>
        <aside className={`auxiliary-column ${protocolOpen || goalSettingsOpen ? "expanded" : ""}`}>
          <div className="auxiliary-summary">
            <small>СЛУЖЕБНЫЙ КАНАЛ</small>
            <strong>{trackedContract?.title || "Свободная калибровка"}</strong>
            <span>{protocol.reduce((n, step) => n + step.repeat, 0)} шагов · {trackedMetrics.length} показателей</span>
            <div>
              <button className={protocolOpen ? "active" : ""} onClick={() => { setGoalSettingsOpen(false); setProtocolOpen(true); }}>Протокол</button>
              {!trackedContract && <button className={goalSettingsOpen ? "active" : ""} onClick={() => { setProtocolOpen(false); setGoalSettingsOpen(true); }}>Цели</button>}
            </div>
            <section>
              <small>ОЧЕРЕДЬ</small>
              {protocol.length ? protocol.slice(0, 5).map((step, index) => <span key={`aux-step-${step.key}`}><b>{index + 1}</b>{step.label}{step.repeat > 1 ? ` ×${step.repeat}` : ""}</span>) : <i>Добавляйте действия кнопкой ＋</i>}
              {protocol.length > 5 && <i>Ещё {protocol.length - 5}</i>}
            </section>
            <section>
              <small>ОТСЛЕЖИВАЕТСЯ</small>
              <p>{trackedMetrics.map(trackedMetricLabel).join(" · ")}</p>
            </section>
          </div>
          <aside className={`protocol-drawer ${protocolOpen ? "active" : ""}`} aria-hidden={!protocolOpen}>
            <header>
              <div><small>АВТОМАТИЗАЦИЯ КАЛИБРОВКИ</small><h2>Протокол · {protocol.reduce((n, step) => n + step.repeat, 0)} шагов</h2></div>
              <button onClick={() => setProtocolOpen(false)}>×</button>
            </header>
            <div className="protocol-drawer-list">
              {protocol.length ? protocol.map((step, index) => {
                const progress = protocolProgress[step.key];
                return (
                  <article className={`protocol-drawer-step status-${progress?.status || "pending"}`} key={step.key}>
                    <span>{progress?.status === "completed" ? "✓" : progress?.status === "running" ? "▶" : progress?.status === "error" ? "!" : index + 1}</span>
                    <div className="protocol-step-copy">
                      <strong>{step.label}{step.repeat > 1 ? ` ×${step.repeat}` : ""}</strong>
                      <small>{step.pointLabel || step.pointId || "системно"}{progress ? ` · выполнено ${progress.completedRepeats}/${step.repeat}` : ""}</small>
                    </div>
                    {progress?.completedRepeats ? (
                      <div className="protocol-step-effect">
                        <small>ЭФФЕКТ</small>
                        {trackedMetrics.map((metric) => <span key={`${step.key}-${metric}`}>{trackedMetricLabel(metric).toLowerCase()} <b>{protocolMetricValue(progress, metric)}</b></span>)}
                      </div>
                    ) : <div className="protocol-step-effect empty">Ожидает выполнения</div>}
                    <div className="protocol-step-tools">
                      <button disabled={running} onClick={() => move(index, -1)}>↑</button>
                      <button disabled={running} onClick={() => move(index, 1)}>↓</button>
                      <button disabled={running} onClick={() => repeat(step.key)}>×</button>
                      <button disabled={running} onClick={() => { setProtocolProgress({}); setProtocol((current) => current.filter((item) => item.key !== step.key)); }}>✕</button>
                    </div>
                  </article>
                );
              }) : <p className="protocol-drawer-empty">Протокол пуст. Добавляйте действия кнопкой ＋ в панели операций.</p>}
            </div>
            <footer>
              <button className={running ? "stop" : "run"} disabled={!running && (busy || !protocol.length)} onClick={() => running ? (stopRef.current = true) : run()}>{running ? "■ Остановить" : "▶ Запустить протокол"}</button>
            </footer>
          </aside>
          <aside className={`goal-settings-panel ${goalSettingsOpen && !trackedContract ? "active" : ""}`} aria-hidden={!goalSettingsOpen || Boolean(trackedContract)}>
            <header>
              <div><small>СВОБОДНАЯ КАЛИБРОВКА</small><h2>Отслеживаемые параметры</h2></div>
              <button onClick={() => setGoalSettingsOpen(false)}>×</button>
            </header>
            <p>Выбранные показатели появятся в прогнозе, результате действия и протоколе.</p>
            <div>
              {trackedMetricOptions.map((option) => {
                const checked = freeTrackedMetrics.includes(option.id);
                const limitReached = !checked && freeTrackedMetrics.length >= 6;
                return <label className={`${checked ? "selected" : ""} ${limitReached ? "disabled" : ""}`} key={option.id}>
                  <input type="checkbox" checked={checked} disabled={limitReached} onChange={() => setFreeTrackedMetrics((current) => checked ? current.length > 1 ? current.filter((metric) => metric !== option.id) : current : current.length < 6 ? [...current, option.id] : current)} />
                  <span>{option.label}</span><b>{checked ? "✓" : "+"}</b>
                </label>;
              })}
            </div>
            <footer><small>{freeTrackedMetrics.length}/6 показателей выбрано</small><button onClick={() => setGoalSettingsOpen(false)}>Готово</button></footer>
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
        <div className="drawer-backdrop" onClick={() => setVisualReviewOpen(false)}>
          <aside className="side-drawer visual-review-drawer" onClick={(event) => event.stopPropagation()}>
            <header><h2>Ревью аватара</h2><button onClick={() => setVisualReviewOpen(false)}>×</button></header>
            <img src={reviewAssetPath} alt={subjectName} />
            <code>{reviewAssetPath}</code>
            <h3>Решение</h3>
            <div className="visual-review-decisions">
              {([['keep', 'Оставить'], ['rework', 'Переделать'], ['reject', 'Исключить']] as const).map(([value, label]) => (
                <button className={visualReviewDecision === value ? 'active' : ''} key={value} onClick={() => setVisualReviewDecision(value)}>{label}</button>
              ))}
            </div>
            <h3>Что не так</h3>
            <div className="visual-review-issues">
              {[
                ['identity', 'Другой персонаж'], ['wardrobe', 'Неверная одежда'], ['restraint', 'Неверная фиксация'],
                ['interaction', 'Не читается действие'], ['phase', 'Неверная эмоция/фаза'], ['composition', 'Прыгает композиция'],
                ['anatomy', 'Анатомия'], ['artifacts', 'Артефакты/текст'], ['duplicate', 'Дубликат'], ['style', 'Не подходит стиль'],
              ].map(([value, label]) => (
                <button className={visualReviewIssues.includes(value) ? 'active' : ''} key={value} onClick={() => setVisualReviewIssues(current => current.includes(value) ? current.filter(issue => issue !== value) : [...current, value])}>{label}</button>
              ))}
            </div>
            <h3>Комментарий</h3>
            <textarea value={visualReviewNote} onChange={event => setVisualReviewNote(event.target.value)} placeholder="Что именно нужно изменить при перегенерации?" />
            <button className="visual-review-save" disabled={visualReviewSaving} onClick={saveVisualReview}>{visualReviewSaving ? 'Сохранение…' : visualReviewSaved ? 'Сохранено ✓' : 'Записать ревью'}</button>
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
              Чувствительность: <b>{subject?.sensitivity.toFixed(2) || "—"}</b>
            </p>
            <p>
              Принятие: <b>{subject?.attitude.toFixed(2) || "—"}</b>
            </p>
            <p>
              Открытость: <b>{subject?.openness.toFixed(2) || "—"}</b>
            </p>
            <p>
              Пластичность: <b>{subject?.plasticity.toFixed(2) || "—"}</b>
            </p>
            <p>
              Ресурс: <b>{subject?.capacity.toFixed(2) || "—"}</b>
            </p>
            <p>
              Напряжение: <b>{subject?.tension.toFixed(2) || "—"}</b>
            </p>
            <h3>Выбранная зона</h3>
            <p>
              Чувствительность:{" "}
              <b>
                {subject?.anatomy?.[selectedZoneId]?.localSensitivity?.toFixed(
                  2,
                ) || "—"}
              </b>
            </p>
            <p>
              Baseline:{" "}
              <b>
                {subject?.anatomy?.[
                  selectedZoneId
                ]?.baselineLocalSensitivity?.toFixed(2) || "—"}
              </b>
            </p>
            <p>
              Принятие:{" "}
              <b>
                {subject?.anatomy?.[selectedZoneId]?.localAttitude?.toFixed(
                  2,
                ) || "—"}
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
