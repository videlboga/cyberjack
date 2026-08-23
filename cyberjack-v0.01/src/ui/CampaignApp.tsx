import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "./i18n";
import { GameMenu } from "./GameMenu";
import { getRoomName, getDeviceName, getRoomDescription } from './roomTranslations';
import { translateItem, translateOffer, translateAsset } from './contentTranslations';
import {
  CalibrationPrototype,
  CalibrationZoneMap,
  calibrationActions,
  ActionDef,
  actionIntensity,
  peakActionImagePath,
  semanticTagLabels,
} from "./CalibrationPrototype";
import {
  CapsuleHistoryChart,
  CapsuleHistoryPoint,
} from "./CapsuleHistoryChart";
import {
  CalibrationBiometrics,
  CalibrationStateTrends,
} from "./CalibrationBiometrics";
import "./CampaignApp.css";
import "./LaboratoryRooms.css";
import "./Manga2Theme.css";
import { CharacterPortrait } from "./CharacterPortrait";
import { memoryTagLabel } from "../domain/memoryTagLabels";
import {
  appendCharacterChatLines,
  CharacterChatFeed,
  CharacterChatLine,
  chatLineFromStoredMessage,
  collapseRepeatedChatActions,
} from "./CharacterChat";
import { streamDeferredReply } from "./deferredReplyStream";
import { VisualAffect } from "../domain/characterVisuals";
import {
  PortraitEmotion,
  resolvePortraitEmotion,
} from "../domain/portraitEmotion";
import { deriveActivationPressure } from "../domain/edgeState";
import { gameAudio } from "./gameAudio";
import { SEX_MACHINE_STIMULATION, sexMachineAvatarPath } from "../domain/sexMachineStimulation";
import {
  GameActionEffect,
  GamePortraitReactionEffect,
  GamePeakEffect,
  GameSustainedEffect,
  gameEffectDurationMs,
} from "./GameVisualEffects";
import { hasActionPointImage, resolveActionButtonImage } from "../domain/actionButtonVisual";
import {
  acquiredTraitValue,
  deriveAcquiredTraits,
  parsePreferences,
} from "../domain/conditioning";
import {
  formatRelativeValue,
  interpretCoreMetric,
  interpretPointAttitude,
  interpretPointSensitivity,
} from "../domain/parameterInterpretation";
import { DEFAULT_CONFIG } from "../engine/config";
import { estimateCapacityLoss } from "../engine/capacityPacing";
import "./DeviceControl.css";
import "./JapaneseIndustrialTheme.css";

type Location = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  travelMinutes: number;
};
type Resident = {
  id: string;
  name: string;
  kind: "subject" | "npc" | "player";
  subjectId?: string;
  role: string;
  currentRole?: string;
  title: string;
  presenceState: string;
  description?: string;
  biography?: string;
  roleHistory?: {
    role: string;
    previousRole?: string;
    worldMinute: number;
    title: string;
    description: string;
  }[];
  portrait?: string | null;
  sleeping?: boolean;
  state?: SubjectState | null;
  recentReactions?: any[];
  contexts?: { id: string; label: string; ticksActive: number }[];
  points?: {
    id: string;
    label: string;
    sensitivity: number;
    attitude: number;
    openness: number;
    familiarity: number;
    exposureCount: number;
    baselineSensitivity?: number;
    baselineAttitude?: number;
    baselineOpenness?: number;
  }[];
  relationships?: {
    characterId: string;
    subjectId: string;
    name: string;
    attitude: number;
    openness: number;
    familiarity: number;
    knows: boolean;
    present: boolean;
    canInteract: boolean;
    opinion?: string;
    recentMemories?: string[];
  }[];
  dossierNarrative?: { selfDescription: string; traitExpression: string; updatedAt?: string };
  mentalMemories?: {
    id: number;
    title: string;
    text: string;
    tags: string[];
    tagLabels?: Record<string, string>;
    relatedSubjectIds: string[];
    worldMinute?: number | null;
    atomCount?: number;
    moments?: { id: number; title: string; text: string; worldMinute?: number | string | null; sceneId?: string; actionId?: string; participantIds?: string[]; portraitEmotion?: string }[];
    subjective?: { summary?: string; associations?: { target: string; tagLinks: string[]; evidence: string[]; valence: number; strength: number; expectation: string; manual?: boolean }[] };
  }[];
  history?: {
    id: string;
    type: string;
    title: string;
    description?: string;
    time?: string;
    worldMinute?: number;
  }[];
  statistics?: {
    interactions: number;
    recordedEvents: number;
    chatMessages: number;
    discharges: number;
    breakdowns: number;
    completedContracts: number;
  };
  interpretationGraph?: {
    nodes: { id: string; kind: string; parentId: string | null; label: string; content: string | null; valence: number; strength: number; status: string }[];
    links: { id: string; fromId: string; toId: string; kind: string; weight: number }[];
  };
};
type InventoryItem = {
  itemId: string;
  name: string;
  description: string;
  type: string;
  charges: number;
  tags?: string[];
  storageGroup?: "capsule" | "medical" | "equipment" | "clothing";
};
type DeviceSession = {
  deviceId: "sex_machine" | "capsule";
  subjectId: string;
  configuration: string;
  wardrobe: "nude" | "underwear" | "device_outfit";
  status: "loaded" | "running" | "paused" | "stopped";
  intensity: number;
  phase: "sustain" | "intense" | "peak";
  targetPointIds: string[];
  stimulationMode?: "vaginal" | "anal" | "tickling";
  startedAtTick: number | null;
  updatedAtTick: number;
  targetMode?:
    | "manual"
    | "edge"
    | "positive"
    | "negative"
    | "mixed"
    | "orgasm"
    | "exhaustion"
    | "tickle_steady"
    | "tickle_tease"
    | "tickle_disrupt"
    | "tickle_endurance";
  rhythm?: "steady" | "pulse" | "wave" | "random";
  orgasmPolicy?: "deny" | "allow" | "force";
  valencePolicy?: "adaptive" | "neutral" | "positive" | "negative" | "mixed";
  maxTension?: number;
  minCapacity?: number;
  stopAfterMinutes?: number | null;
  orgasmTargetCount?: number | null;
  orgasmCount?: number;
  stopAtReserve?: boolean;
  lastDischargeEvent?: { id: number; worldMinute: number };
};
type MentalChairSession = {
  subjectId: string;
  status: "loaded" | "running" | "paused" | "stopped";
  intensity: number;
  frame: "reinforce" | "anxiety" | "contradiction" | "reframe";
  phase: "recall" | "immersion" | "consolidation";
  memoryId: number | null;
  memoryText: string | null;
  memoryTags: string[];
  relatedSubjectIds: string[];
  focusTag: string | null;
  startedAtTick: number | null;
  updatedAtTick: number;
  lastIntervention?: {
    targetLabel: string;
    intervention: string;
    operation: string;
    affected: number;
    changes: Array<{ target: string; before: { valence: number; strength: number; expectation: string }; after: { valence: number; strength: number; expectation: string } }>;
    at: number;
  };
};
type LabAsset = {
  id: string;
  name: string;
  description: string;
  state: string;
  metadata?: {
    subjectId?: string;
    startedAt?: number;
    roomId?: string;
    enabled?: boolean;
    deviceSession?: DeviceSession;
    mentalSession?: MentalChairSession;
  };
};
type LabRoom = {
  id: string;
  name: string;
  type: "workroom" | "cell" | "staff";
  description: string;
  capacity: number;
  state: string;
  occupants: {
    id: string;
    name: string;
    kind: string;
    status: string;
    condition?: string;
  }[];
};
type ShopOffer = {
  id: string;
  itemId: string;
  name: string;
  description: string;
  category: "item" | "laboratory";
  price: number;
  stock: number;
  owned: boolean;
  limited?: boolean;
  supplier?: string;
  originLabel?: string;
  batch?: string;
  expiresAt?: number;
};
type Candidate = {
  id: string;
  name: string;
  title: string;
  description: string;
  biography: string;
  staffCost: number;
  assetCost: number;
};
type StationSectorState = {
  id: string;
  signals: {
    id: string;
    title: string;
    subjectName?: string;
    lead: string;
    stage: string;
    updatedMinute: number;
  }[];
};
type Scenario = {
  clock: {
    totalMinutes: number;
    day: number;
    year: number;
    month: number;
    dayOfMonth: number;
    hour: number;
    minute: number;
    label: string;
  };
  location: Location;
  locations: Location[];
  credits: number;
  inventory: InventoryItem[];
  laboratory: LabAsset[];
  rooms: LabRoom[];
  residents: Resident[];
  candidates: Candidate[];
  shop: ShopOffer[];
  stationSectors: StationSectorState[];
  events: { id: number; type: string; title: string; description: string }[];
};
type TimeFlowState = {
  paused: boolean;
  running: boolean;
  realIntervalMs: number;
  gameMinutesPerInterval: number;
  serverNow?: number;
  nextTickAt?: number;
  clock?: { totalMinutes: number };
};
type Condition = { type: string; key?: string; operator?: string; value: any };
type Contract = {
  id: string;
  title: string;
  description: string;
  issuerId: string;
  state: string;
  conditions: Condition[];
  rewards: { credits?: number; trust?: number; items?: string[] };
  deadlineTick?: number;
  format?: string;
  durationMinutes?: number;
  offerDeadlineMinutes?: number;
  returnProfile?: {
    acute_state?: { capacity?: number; tension?: number; sensitivity?: number; attitude?: number };
    recovery?: { durationDays?: number; method?: string; baselineCapacityLimit?: number };
    traumatic?: { response?: string; trigger?: string }[];
    temporary?: { impulse?: string; decayAfterMinutes?: number }[];
  };
  unavailableUntil?: number;
  attachedSubjectId?: string;
  subjectId?: string;
  difficulty?: "easy" | "medium" | "hard" | "extreme";
  cruelty?: "mild" | "moderate" | "severe" | "extreme";
};
type SubjectState = Record<string, any> & { attitude?: number };
type DirectorEvent = {
  id: string;
  templateId: string;
  channel: string;
  subjectId?: string;
  title: string;
  body: string;
  senderName?: string;
  availableFrom: number;
  choices: { id: string; label: string; kind: string }[];
};
type RoomVisualEffect = {
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
  duration: number;
  rayRotation: number;
  showRays: boolean;
  showPortrait: boolean;
  emotion: PortraitEmotion;
  actionKey: string;
  actionImage: string;
  actionLabel: string;
  targetLabel: string;
  portraitOnly?: boolean;
};
type RoomPeakEffect = {
  key: string;
  kind: "discharge" | "overload" | "breakdown" | "exhaustion";
  actionImage?: string;
};
const roomVisualEffectFamily = (
  actionId: string,
): RoomVisualEffect["family"] => {
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

const capsulePoseForEmotion: Record<
  PortraitEmotion,
  | "arched"
  | "calm"
  | "limp"
  | "squirming"
  | "struggling"
  | "tense"
  | "trembling"
> = {
  afterglow: "limp",
  angry: "tense",
  aroused: "squirming",
  blush: "squirming",
  bored: "calm",
  climax: "arched",
  crying: "struggling",
  curious: "calm",
  defiant: "struggling",
  disgust: "tense",
  distressed: "struggling",
  excited: "squirming",
  exhausted: "limp",
  fear: "trembling",
  guarded: "tense",
  high_negative: "struggling",
  high_positive: "arched",
  mixed: "squirming",
  mixed_overload: "arched",
  neutral: "calm",
  pain: "struggling",
  pleasure: "arched",
  receptive: "calm",
  sad: "limp",
  shy: "tense",
  sleepy: "limp",
  smile: "calm",
  smug: "calm",
  submissive: "trembling",
  subspace: "trembling",
  surprise: "trembling",
  unconscious: "limp",
};

const visualSlugFor = (subjectId: string | undefined | null): string | undefined => {
  if (!subjectId) return undefined;
  return subjectId === "S-AV-01"
    ? "mira"
    : subjectId === "NPC-LAB-01"
      ? "iona"
      : subjectId === "NPC-CAND-01"
        ? "nika"
        : subjectId === "NPC-CAND-SUMI"
          ? "sumi"
          : subjectId === "NPC-CAND-GEN-02"
            ? "eli"
            : subjectId === "NPC-CAND-GEN-03"
              ? "rin"
              : subjectId === "NPC-CAND-GEN-04"
                ? "mai"
                : subjectId === "NPC-CAND-KATE"
                  ? "kate"
                  : subjectId === "NPC-RIN-01"
                    ? "rin"
                    : undefined;
            };

const capsulePortraitFor = (resident: Resident): string | null => {
  const subjectId = resident.subjectId || resident.id;
  const slug = visualSlugFor(subjectId);
  if (!slug) return null;
  const state = resident.state || {};
  const emotion = resolvePortraitEmotion({
    behavioralState: state.behavioralState,
    reaction: state.reaction || state.lastReaction,
    transitions: state.transitions,
    state: {
      tension: state.tension,
      capacity: state.capacity,
      attitude: state.attitude,
      openness: state.openness,
      plasticity: state.plasticity,
      contexts: (resident.contexts || []).map((context) => ({
        actionId: context.id,
      })),
    },
  });
  return `/character-images/capsule/${slug}__${capsulePoseForEmotion[emotion]}.png`;
};
const conditionLabels: Record<string, string> = {
  attitude: "Принятие",
  sensitivity: "Чувствительность",
  capacity: "Ресурс",
  openness: "Открытость",
  plasticity: "Пластичность",
  pain: "Закреплённая реакция · боль",
  restraint: "Закреплённая реакция · фиксация",
  exposure: "Закреплённая реакция · демонстрация",
  clinical: "Закреплённая реакция · клинические процедуры",
  electronic: "Закреплённая реакция · электроника",
  trait_masochist: "Мазохизм",
  trait_restraint_fetish: "Фетиш фиксации",
  trait_conditioned_submission: "Обусловленная покорность",
  trait_exhibitionist: "Эксгибиционизм",
  trait_clinical_fetish: "Медицинский фетиш",
  trait_technophile: "Технофилия",
  trait_chem_addict: "Хим-зависимость",
  trait_sexual_dependency: "Сексуальная зависимость",
};
const difficultyLabel = (d: string) =>
  ({ easy: "Лёгкий", medium: "Средний", hard: "Тяжёлый", extreme: "Экстремальный" } as Record<string, string>)[d] || d;
const crueltyLabel = (c: string) =>
  ({ mild: "Мягкий", moderate: "Умеренный", severe: "Жестокий", extreme: "Предельный" } as Record<string, string>)[c] || c;
const sectionForLocation: Record<
  string,
  "laboratory" | "contracts" | "supply"
> = {
  scene_lab_calibrator: "laboratory",
  scene_liaison: "contracts",
  scene_broker: "supply",
};

type LabTrendKey = "tension" | "capacity" | "attitude" | "sensitivity";
const clampMetric = (value: number) => Math.max(0, Math.min(100, value));
function residentTrend(subjectId: string, key: LabTrendKey, current: number) {
  try {
    const saved = JSON.parse(
      localStorage.getItem(`cyberjack.stateHistory.${subjectId}`) || "[]",
    );
    const values = Array.isArray(saved)
      ? saved
          .map((entry) => Number(entry?.[key]))
          .filter(Number.isFinite)
          .slice(-20)
      : [];
    if (!values.length || values[values.length - 1] !== current)
      values.push(current);
    return values.length === 1 ? [values[0], values[0]] : values;
  } catch {
    return [current, current];
  }
}
function recordWorldStateHistory(residents: Resident[], worldMinute: number) {
  residents.forEach((resident) => {
    const state = resident.state;
    if (!state) return;
    const key = `cyberjack.stateHistory.${resident.subjectId || resident.id}`;
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      const entries = Array.isArray(raw) ? raw : [];
      const normalized = entries.map((entry: any, index: number) => ({
        ...entry,
        at:
          Number(entry.at) > 10_000_000
            ? Math.max(0, worldMinute - (entries.length - index) * 5)
            : Number(
                entry.at ??
                  Math.max(0, worldMinute - (entries.length - index) * 5),
              ),
      }));
      const last = normalized[normalized.length - 1];
      if (last && worldMinute - Number(last.at || 0) < 5) return;
      const actions = (resident.contexts || [])
        .map((context) => context.label)
        .filter(Boolean);
      normalized.push({
        at: worldMinute,
        sensitivity: Number(state.sensitivity || 0),
        attitude: Number(state.attitude || 0),
        openness: Number(state.openness || 0),
        plasticity: Number(state.plasticity || 0),
        capacity: Number(state.capacity || 0),
        tension: Number(state.tension || 0),
        actions,
      });
      localStorage.setItem(key, JSON.stringify(normalized.slice(-40)));
    } catch {
      /* A broken local history must not block world refresh. */
    }
  });
}
const formatGameClock = (totalMinutes: number) => {
  const dayIndex = Math.floor(Math.max(0, totalMinutes) / 1440);
  const year = 17349 + Math.floor(dayIndex / 360);
  const dayOfYear = dayIndex % 360;
  const month = Math.floor(dayOfYear / 30);
  const day = (dayOfYear % 30) + 1;
  const minuteOfDay = Math.floor(Math.max(0, totalMinutes)) % 1440;
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const months = [
    "янв",
    "фев",
    "мар",
    "апр",
    "май",
    "июн",
    "июл",
    "авг",
    "сен",
    "окт",
    "ноя",
    "дек",
  ];
  return `${String(day).padStart(2, "0")} ${months[month]} ${year} · ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};
function SmoothGameClock({
  totalMinutes,
  flow,
}: {
  totalMinutes: number;
  flow: TimeFlowState | null;
}) {
  const [displayed, setDisplayed] = useState(totalMinutes);
  useEffect(() => {
    setDisplayed(totalMinutes);
    if (!flow || flow.paused) return;
    const intervalMs = Math.max(250, flow.realIntervalMs || 5000);
    const step = flow.gameMinutesPerInterval || 1;
    const serverOffset = Date.now() - Number(flow.serverNow || Date.now());
    const firstDelay = Math.max(
      0,
      Number(flow.nextTickAt || Date.now() + intervalMs) +
        serverOffset -
        Date.now(),
    );
    let interval: number | undefined;
    const timeout = window.setTimeout(() => {
      setDisplayed((value) => value + step);
      interval = window.setInterval(
        () => setDisplayed((value) => value + step),
        intervalMs,
      );
    }, firstDelay);
    return () => {
      window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [
    totalMinutes,
    flow?.paused,
    flow?.realIntervalMs,
    flow?.gameMinutesPerInterval,
    flow?.serverNow,
    flow?.nextTickAt,
  ]);
  return <>{formatGameClock(displayed)}</>;
}
function LabMetricChart({
  resident,
  metric,
  label,
  tone,
}: {
  resident: Resident;
  metric: LabTrendKey;
  label: string;
  tone: string;
}) {
  const { t } = useI18n();
  const state = resident.state || {};
  const current = Number(state[metric] ?? 0);
  const values = residentTrend(
    resident.subjectId || resident.id,
    metric,
    current,
  );
  const points = values
    .map(
      (value, index) =>
        `${(index / Math.max(1, values.length - 1)) * 100},${100 - clampMetric(value)}`,
    )
    .join(" ");
  const baselineName = `baseline${metric[0].toUpperCase()}${metric.slice(1)}`;
  const baseline = Number(
    state[baselineName] ?? state[`baseline_${metric}`] ?? current,
  );
  return (
    <div className={`lab-metric-chart ${tone}`}>
      <header>
        <span>{label}</span>
        <b>{Math.round(current)}</b>
      </header>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line className="grid" x1="0" x2="100" y1="50" y2="50" />
        <line
          className="baseline"
          x1="0"
          x2="100"
          y1={100 - clampMetric(baseline)}
          y2={100 - clampMetric(baseline)}
        />
        <polyline className="history" points={points} />
        <circle
          className="latest"
          cx="100"
          cy={100 - clampMetric(current)}
          r="3"
        />
      </svg>
    </div>
  );
}

const currentFor = (condition: Condition, subject: SubjectState | null) => {
  if (!subject) return undefined;
  if (condition.type === "preference" && condition.key)
    return parsePreferences(subject.preferences).tags[condition.key] || 0;
  if (condition.type === "acquired_trait" && condition.key)
    return acquiredTraitValue(subject.preferences, condition.key);
  const key =
    condition.type === "attitude"
      ? "attitude"
      : condition.type === "custom"
        ? condition.key
        : undefined;
  if (!key) return undefined;
  const baselineKeys: Record<string, string> = {
    attitude: "attitude",
    sensitivity: "sensitivity",
    openness: "openness",
    plasticity: "plasticity",
  };
  if (baselineKeys[key]) {
    const suffix = baselineKeys[key];
    const camel = `baseline${suffix[0].toUpperCase()}${suffix.slice(1)}`;
    return subject[camel] ?? subject[`baseline_${suffix}`] ?? subject[key];
  }
  return subject[key];
};
const met = (actual: any, operator = "==", target: any) =>
  actual === undefined
    ? false
    : operator === ">"
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

async function api(path: string, options?: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  const externalSignal = options?.signal;
  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  let response: Response;
  try {
    response = await fetch(path, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Сервер не ответил вовремя. Повторите действие.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
  const raw = await response.text();
  if (!raw.trim())
    throw new Error(
      response.ok
        ? "Сервер вернул пустой ответ. Повторите действие."
        : `Сервер недоступен (${response.status}). Повторите действие.`,
    );
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Сервер вернул некорректный ответ (${response.status}).`);
  }
  if (!data.success) throw new Error(data.error || "Операция не выполнена");
  return data;
}

async function resolveDeferredReply(data: any, timeoutMs = 60_000, onText?: (text: string) => void) {
  if (!data?.replyPending || !data?.replyJobId) return data;
  try {
    const job = await streamDeferredReply(data.replyJobId, onText, timeoutMs);
    return {
      ...data,
      replyPending: false,
      reply: job.metrics?.reply || null,
      actorReplies: job.metrics?.actorReplies || [],
      llmError: job.error || null,
    };
  } catch {
    // Older API instances do not expose SSE; retain one-shot long polling as
    // a compatibility fallback, never the former interval polling loop.
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const job = await api(
      `/api/tick/replies/${encodeURIComponent(data.replyJobId)}/wait`,
      { signal: controller.signal },
    );
    if (job.done) return {
      ...data,
      replyPending: false,
      reply: job.metrics?.reply || null,
      actorReplies: job.metrics?.actorReplies || [],
      llmError: job.error || null,
    };
  } finally {
    window.clearTimeout(timer);
  }
  return {
    ...data,
    replyPending: false,
    llmError: "Ответ модели не получен вовремя",
  };
}

export function CampaignApp() {
  const { t, locale } = useI18n();
  // Единственная активная тема интерфейса — manga2 (см. Manga2Theme.css).
  const uiTheme = "manga2" as const;
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [subject, setSubject] = useState<SubjectState | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [directoryCharacterId, setDirectoryCharacterId] = useState<
    string | null
  >(null);
  const [interaction, setInteraction] = useState<Resident | null>(null);
  const [utility, setUtility] = useState<
    "people" | "supply" | "journal" | "inbox" | null
  >(null);
  const [focusCharacterId, setFocusCharacterId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [timeFlow, setTimeFlow] = useState<TimeFlowState | null>(null);
  const [inbox, setInbox] = useState<DirectorEvent[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  // The periodic refresh and an interaction-triggered refresh can overlap.
  // Never let an older snapshot erase a context (and therefore its avatar)
  // that was just applied by the newer tick.
  const latestLoadRequestRef = useRef(0);

  // Network work must never leave the whole game permanently inert. Individual
  // requests already have their own timeout; this is a final UI-state guard for
  // abandoned promises and stale components after a dev-server reload.
  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => setBusy(false), 16_000);
    return () => window.clearTimeout(timer);
  }, [busy]);

  const load = useCallback(
    async (quiet = false) => {
      const requestId = ++latestLoadRequestRef.current;
      try {
        const [world, flowData, inboxData] = await Promise.all([
          api("/api/scenario?playerId=PL-1"),
          api("/api/scenario/time/flow"),
          api("/api/events/inbox"),
        ]);
        const assets = (world.residents as Resident[]).filter(
          (resident) =>
            resident.role === "asset" || resident.kind === "subject",
        );
        const activeId = assets.some(
          (resident) => resident.id === selectedAssetId,
        )
          ? selectedAssetId
          : assets[0]?.id || null;
        if (requestId !== latestLoadRequestRef.current) return;
        setScenario(world);
        setTimeFlow(flowData.timeFlow);
        setInbox(inboxData.events || []);
        recordWorldStateHistory(
          world.residents || [],
          world.clock.totalMinutes,
        );
        if (!quiet) {
          const [orderData, stateData] = await Promise.all([
            api("/api/contracts?playerId=PL-1"),
            activeId
              ? api(
                  `/api/state?subjectId=${activeId}&sceneId=scene_lab_calibrator&pointId=neck`,
                )
              : Promise.resolve(null),
          ]);
          if (requestId !== latestLoadRequestRef.current) return;
          setContracts([
            ...(orderData.inTransfer || []),
            ...(orderData.accepted || []),
            ...(orderData.available || []),
          ]);
          setSubject(stateData?.subject || null);
        }
        if (activeId !== selectedAssetId) setSelectedAssetId(activeId);
        if (!quiet) setError(null);
      } catch (e: any) {
        if (!quiet) setError(e.message);
      }
    },
    [selectedAssetId],
  );

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 12_000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    document.documentElement.dataset.uiTheme = uiTheme;
    window.localStorage.setItem("cyberjack-ui-theme", uiTheme);
  }, [uiTheme]);

  const mutate = async (
    path: string,
    body: Record<string, unknown>,
    successText: string,
  ) => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      await api(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setNotice(successText);
      await load();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const enterInteraction = async (resident: Resident) => {
    const device = scenario?.laboratory.find(
      (asset) => asset.metadata?.subjectId === resident.id,
    );
    // A device-bound character is approached at that device. A free
    // character is approached directly, which creates a near:<character> slot.
    const targetLocation = device?.name || resident.name;
    const moved = await mutate(
      "/api/scenario/characters/PL-1/move",
      { playerId: "PL-1", roomId: targetLocation },
      "",
    );
    if (moved) {
      setUtility(null);
      setInteraction(resident);
    }
  };

  const navigate = async (locationId: string) => {
    setUtility(null);
    setInteraction(null);
    if (scenario?.location.id === locationId) return;
    const target = scenario?.locations.find((item) => item.id === locationId);
    await mutate(
      "/api/scenario/travel",
      { playerId: "PL-1", locationId },
      `Прибытие: ${target?.shortTitle || locationId}`,
    );
  };
  const toggleTimeFlow = async () => {
    if (!timeFlow) return;
    const previous = timeFlow;
    setTimeFlow({
      ...previous,
      paused: !previous.paused,
      running: previous.paused,
    });
    try {
      const data = await api("/api/scenario/time/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !previous.paused }),
      });
      setTimeFlow(data.timeFlow);
    } catch (e: any) {
      setTimeFlow(previous);
      setError(e.message);
    }
  };
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("game-time-paused", Boolean(timeFlow?.paused));
    return () => root.classList.remove("game-time-paused");
  }, [timeFlow?.paused]);
  const chooseDirectorEvent = async (event: DirectorEvent, choice: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api(`/api/events/${event.id}/choose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      await load(true);
      if (data.result?.focusSubjectId) {
        const resident = scenario?.residents.find(
          (item) =>
            item.id === data.result.focusSubjectId ||
            item.subjectId === data.result.focusSubjectId,
        );
        if (resident) {
          await enterInteraction(resident);
        }
      } else if (data.result?.focusSection === "contracts") {
        setInteraction(null);
        setUtility(null);
        if (scenario?.location.id !== "scene_liaison") {
          await api("/api/scenario/travel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              playerId: "PL-1",
              locationId: "scene_liaison",
            }),
          });
        }
        await load();
      } else if (data.result?.focusSection === "supply") {
        setInteraction(null);
        setUtility("supply");
        await load();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.code !== "Space" ||
        event.repeat ||
        target?.matches(
          'input, textarea, select, button, a, [contenteditable="true"]',
        ) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      void toggleTimeFlow();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [timeFlow?.paused]);

  const accepted = contracts.filter(
    (contract) => contract.state === "accepted",
  );
  const deadline = useMemo(() => {
    const nearest = accepted
      .map((item) => item.deadlineTick)
      .filter((value): value is number => typeof value === "number")
      .sort((a, b) => a - b)[0];
    if (!nearest || !scenario) return null;
    const left = Math.max(0, nearest - scenario.clock.totalMinutes);
    return `${Math.floor(left / 1440)}д ${Math.floor((left % 1440) / 60)}ч`;
  }, [accepted, scenario]);

  if (!scenario)
    return (
      <main className="campaign-loading">{error || "Загрузка сектора…"}</main>
    );
  const selectedAsset =
    scenario.residents.find((resident) => resident.id === selectedAssetId) ||
    null;
  const currentSection =
    utility || sectionForLocation[scenario.location.id] || "laboratory";
  const calibrationWitnesses = (() => {
    if (!interaction) return [];
    const targetDevice = scenario.laboratory.find(
      (asset) => asset.metadata?.subjectId === interaction.id,
    );
    const roomId =
      targetDevice?.metadata?.roomId ||
      scenario.rooms.find((room) =>
        room.occupants.some((person) => person.id === interaction.id),
      )?.id;
    if (!roomId) return [];
    const isolatedIds = new Set(
      scenario.laboratory
        .filter((asset) =>
          ["lab_recovery_capsule", "lab_sex_machine", "lab_mental_correction_chair"].includes(asset.id),
        )
        .map((asset) => asset.metadata?.subjectId)
        .filter(Boolean),
    );
    return scenario.residents.filter(
      (resident) =>
        resident.id !== interaction.id &&
        !isolatedIds.has(resident.id) &&
        (scenario.laboratory.find(
          (asset) => asset.metadata?.subjectId === resident.id,
        )?.metadata?.roomId ||
          scenario.rooms.find((room) =>
            room.occupants.some((person) => person.id === resident.id),
          )?.id) === roomId,
    );
  })();

  return (
    <div
      className="campaign-shell"
      data-theme={uiTheme}
    >
      <header className="campaign-statusbar">
        <div className="campaign-brand">
          <b>CYBERJACK</b>
          <span>{t('game.ui.calibratorTerminal')}</span>
        </div>
        <div className="campaign-current">
          <small>{t('game.ui.location')}</small>
          <strong>
            {interaction
              ? `${scenario.location.shortTitle} / ${interaction.name}`
              : scenario.location.shortTitle}
          </strong>
        </div>
        <div className="campaign-status-spacer" />
        {deadline && (
          <div className="campaign-stat deadline">
            <small>{t('game.ui.term')}</small>
            <strong>{deadline}</strong>
          </div>
        )}
        <div className="campaign-stat credits">
          <small>{t('game.ui.account')}</small>
          <strong>{Math.round(scenario.credits)} cr</strong>
        </div>
        <button
          className={`campaign-time-control ${timeFlow?.paused ? "paused" : "running"}`}
          onClick={toggleTimeFlow}
          title={
            timeFlow?.paused
              ? "Продолжить ход времени"
              : "Поставить время на паузу"
          }
        >
          <i>{timeFlow?.paused ? "▶" : "Ⅱ"}</i>
          <span>
            <small>{t('game.ui.time')} · {timeFlow?.paused ? t('game.ui.paused') : t('game.ui.running')}</small>
            <strong>
              <SmoothGameClock
                totalMinutes={scenario.clock.totalMinutes}
                flow={timeFlow}
              />
            </strong>
          </span>
        </button>
        <button
          className="campaign-menu-button"
          onClick={() => setMenuOpen(true)}
          title="Меню"
        >
          <i>≡</i>
          <span>Меню</span>
        </button>
      </header>
      <div className="campaign-frame">
        <nav className="campaign-nav">
          <section>
            <small>{t('game.ui.sections')}</small>
            <NavButton
              active={
                !utility && scenario.location.id === "scene_lab_calibrator"
              }
              label={t('game.ui.laboratory')}
              meta={`${scenario.residents.length} ${t('game.ui.residents')}`}
              onClick={() => navigate("scene_lab_calibrator")}
            />
            <NavButton
              active={utility === "people"}
              label={t('game.ui.characters')}
              meta={`${scenario.residents.length} ${t('game.ui.inComplex')}`}
              onClick={() => {
                setInteraction(null);
                setDirectoryCharacterId(null);
                setUtility("people");
              }}
            />
            <NavButton
              active={utility === "inbox"}
              label={t('game.ui.incoming')}
              meta={inbox.length ? `${inbox.length} ${t('game.ui.new')}` : t('game.ui.noNew')}
              onClick={() => {
                setInteraction(null);
                setUtility("inbox");
              }}
            />
            <NavButton
              active={!utility && scenario.location.id === "scene_liaison"}
              label={t('game.ui.contracts')}
              meta={`${accepted.length} ${t('game.ui.active')}`}
              onClick={() => navigate("scene_liaison")}
            />
            <NavButton
              active={
                utility === "supply" ||
                (!utility && scenario.location.id === "scene_broker")
              }
              label={t('game.ui.station')}
              meta={`${scenario.inventory.length} ${t('game.ui.inStock')}`}
              onClick={() => {
                setInteraction(null);
                setUtility("supply");
              }}
            />
            <NavButton
              active={utility === "journal"}
              label={t('game.ui.journal')}
              meta={`${scenario.events.length} ${t('game.ui.events')}`}
              onClick={() => {
                setInteraction(null);
                setUtility("journal");
              }}
            />
          </section>
        </nav>
        <div className="campaign-content">
          {interaction ? (
            <CalibrationPrototype
              key={interaction.id}
              subjectId={interaction.subjectId || interaction.id}
              subjectName={interaction.name}
              nearbyCharacters={calibrationWitnesses.map((resident) => ({
                id: resident.subjectId || resident.id,
                name: resident.name,
                role: resident.role,
                title: resident.title,
                state: resident.state ?? undefined,
                contexts: resident.contexts,
              }))}
              worldMinute={scenario.clock.totalMinutes}
              timeLabel={
                <SmoothGameClock
                  totalMinutes={scenario.clock.totalMinutes}
                  flow={timeFlow}
                />
              }
              timePaused={Boolean(timeFlow?.paused)}
              onToggleTime={toggleTimeFlow}
              onFocusCharacter={(characterId) => {
                const next = scenario.residents.find(
                  (resident) =>
                    resident.id === characterId || resident.subjectId === characterId,
                );
                if (next) void enterInteraction(next);
              }}
              onExit={() => setInteraction(null)}
            />
          ) : currentSection === "people" ? (
            directoryCharacterId ? (
              <CharacterDirectory
                residents={scenario.residents}
                dossierId={directoryCharacterId}
                busy={busy}
                onSelect={(id) =>
                  id
                    ? setDirectoryCharacterId(id)
                    : setDirectoryCharacterId(null)
                }
                onLocate={(resident) => {
                  if (resident.role === "asset" || resident.kind === "subject")
                    setSelectedAssetId(resident.id);
                  setFocusCharacterId(resident.id);
                  setDirectoryCharacterId(null);
                  setUtility(null);
                }}
                onChangeRole={(resident, role) =>
                  mutate(
                    `/api/scenario/characters/${resident.id}/role`,
                    { playerId: "PL-1", role },
                    role === "asset"
                      ? `${resident.name}: оформлена как актив`
                      : `${resident.name}: назначена в штат`,
                  )
                }
              />
            ) : (
              <PeopleView
                residents={scenario.residents}
                onOpen={(resident) => setDirectoryCharacterId(resident.id)}
              />
            )
          ) : currentSection === "laboratory" ? (
            <LaboratoryOverview
              scenario={scenario}
              busy={busy}
              focusCharacterId={focusCharacterId}
              onFocusHandled={() => setFocusCharacterId(null)}
              onOpenDossier={(resident) => {
                setDirectoryCharacterId(resident.id);
                setUtility("people");
              }}
              onMove={(resident, roomId) =>
                mutate(
                  `/api/scenario/characters/${resident.id}/move`,
                  { playerId: "PL-1", roomId },
                  `${resident.name}: перемещение выполнено`,
                )
              }
              onInteract={setInteraction}
              onRefresh={() => load(true)}
              onUse={(asset, resident) =>
                mutate(
                  `/api/scenario/laboratory/${asset.id}/use`,
                  { playerId: "PL-1", subjectId: resident.id },
                  asset.metadata?.subjectId === resident.id
                    ? `${resident.name}: устройство освобождено`
                    : `${resident.name}: ${asset.name}`,
                )
              }
              onTogglePanel={(asset) =>
                mutate(
                  `/api/scenario/laboratory/${asset.id}/control`,
                  { playerId: "PL-1", command: "toggle" },
                  asset.metadata?.enabled
                    ? `${asset.name}: выключено`
                    : `${asset.name}: включено`,
                )
              }
            />
          ) : currentSection === "supply" ? (
            <SupplyView
              scenario={scenario}
              contracts={contracts}
              inbox={inbox}
              busy={busy}
              onBuy={(offer) =>
                mutate(
                  `/api/scenario/shop/${offer.id}/buy`,
                  { playerId: "PL-1" },
                  `${offer.name}: доставлено на склад`,
                )
              }
              onOpenInbox={() => {
                setInteraction(null);
                setUtility("inbox");
              }}
              onOpenContracts={() => navigate("scene_liaison")}
            />
          ) : currentSection === "contracts" ? (
            <ContractOffice
              contracts={contracts}
              subject={subject}
              assets={scenario.residents.filter(
                (resident) =>
                  resident.role === "asset" || resident.kind === "subject",
              )}
              selectedAssetId={selectedAssetId}
              onSelectAsset={setSelectedAssetId}
              busy={busy}
              now={scenario.clock.totalMinutes}
              onAccept={(contract) =>
                mutate(
                  `/api/contracts/${contract.id}/accept`,
                  { playerId: "PL-1" },
                  `Контракт принят: ${contract.title}`,
                )
              }
              onDeliver={(contract) =>
                selectedAssetId
                  ? mutate(
                      `/api/contracts/${contract.id}/deliver`,
                      { subjectId: selectedAssetId },
                      `Контракт выполнен: ${contract.title}`,
                    )
                  : Promise.resolve(false)
              }
              onRefuse={(contract) =>
                mutate(
                  `/api/contracts/${contract.id}/refuse`,
                  {},
                  `Контракт отклонён: ${contract.title}`,
                )
              }
            />
          ) : currentSection === "inbox" ? (
            <EventInbox
              events={inbox}
              busy={busy}
              onChoose={chooseDirectorEvent}
            />
          ) : (
            <JournalView events={scenario.events} />
          )}
        </div>
      </div>
      {(error || notice) && (
        <div
          className={`campaign-toast ${error ? "error" : ""}`}
          onClick={() => {
            setError(null);
            setNotice(null);
          }}
        >
          {error || notice}
          <button>×</button>
        </div>
      )}
      <GameMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}

function NavButton({
  active,
  label,
  meta,
  onClick,
}: {
  active: boolean;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      <span>{label}</span>
      <small>{meta}</small>
    </button>
  );
}

function EventInbox({
  events,
  busy,
  onChoose,
}: {
  events: DirectorEvent[];
  busy: boolean;
  onChoose: (event: DirectorEvent, choice: string) => void;
}) {
  const { t } = useI18n();
  return (
    <main className="management-screen director-inbox">
      <header className="screen-heading">
        <div>
          <p>{t('game.ui.omnikronEvents')}</p>
          <h1>{t('game.ui.inbox')}</h1>
          <span>{t('game.ui.inboxDescription')}</span>
        </div>
        <b>{events.length}</b>
      </header>
      <section className="director-inbox-list">
        {events.length ? (
          events.map((event) => (
            <article key={event.id}>
              <header>
                <small>
                  {event.channel === "inbox"
                    ? "ЛИЧНЫЙ КАНАЛ"
                    : event.channel.toUpperCase()}
                </small>
                <span>{event.senderName || "Система станции"}</span>
              </header>
              <h2>{event.title}</h2>
              <p>{event.body}</p>
              <footer>
                {event.choices.map((choice) => (
                  <button
                    className={choice.kind}
                    disabled={busy}
                    key={choice.id}
                    onClick={() => onChoose(event, choice.id)}
                  >
                    {choice.label}
                  </button>
                ))}
              </footer>
            </article>
          ))
        ) : (
          <div className="director-inbox-empty">
            <i>○</i>
            <strong>{t('game.ui.noNewIncoming')}</strong>
            <span>
              {t('game.ui.inboxEmpty')}
            </span>
          </div>
        )}
      </section>
    </main>
  );
}

function LaboratoryOverview({
  scenario,
  busy,
  focusCharacterId,
  onFocusHandled,
  onOpenDossier,
  onMove,
  onInteract,
  onRefresh,
  onUse,
  onTogglePanel,
}: {
  scenario: Scenario;
  busy: boolean;
  focusCharacterId: string | null;
  onFocusHandled: () => void;
  onOpenDossier: (resident: Resident) => void;
  onMove: (resident: Resident, roomId: string) => void;
  onInteract: (resident: Resident) => void;
  onRefresh: () => Promise<void>;
  onUse: (asset: LabAsset, resident: Resident) => Promise<boolean> | void;
  onTogglePanel: (asset: LabAsset) => Promise<boolean> | void;
}) {
  const { t } = useI18n();
  const equipmentCovers: Record<string, string> = {
    lab_diagnostic_table: "/backgrounds/laboratory/diagnostic_table.png",
    lab_recovery_capsule:
      "/backgrounds/laboratory/capsule_outpaint_masked_d1.0.png",
    lab_sex_machine: "/backgrounds/laboratory/sex_machine.png",
    lab_mental_correction_chair: "/backgrounds/laboratory/mental_correction_chair.png",
  };
  const [selectedRoomId, setSelectedRoomId] = useState(
    scenario.rooms[0]?.id || "",
  );
  const [conversation, setConversation] = useState<{
    resident: Resident;
    container: string;
    kind: "cell" | "staff" | "room" | "capsule";
    asset?: LabAsset;
  } | null>(null);
  const selectedRoom =
    scenario.rooms.find((room) => room.id === selectedRoomId) ||
    scenario.rooms[0];
  const assets = scenario.residents.filter(
    (resident) => resident.role === "asset" || resident.kind === "subject",
  );
  const [movePickerId, setMovePickerId] = useState<string | null>(null);
  const [assignmentAssetId, setAssignmentAssetId] = useState<string | null>(
    null,
  );
  const roomAssets = scenario.laboratory.filter(
    (asset) =>
      asset.id !== "lab_sensory_pod" &&
      asset.metadata?.roomId === selectedRoom?.id,
  );
  const visibleOccupants =
    selectedRoom?.occupants.filter(
      (person) => !person.status.startsWith("device:"),
    ) || [];
  const roomPanelResidents = scenario.residents.filter(
    (resident) =>
      visibleOccupants.some((person) => person.id === resident.id) ||
      roomAssets.some((asset) => asset.metadata?.subjectId === resident.id),
  );
  const roomForCharacter = (characterId: string) =>
    scenario.laboratory.find(
      (asset) => asset.metadata?.subjectId === characterId,
    )?.metadata?.roomId ||
    scenario.rooms.find((room) =>
      room.occupants.some((person) => person.id === characterId),
    )?.id;
  useEffect(() => {
    if (!focusCharacterId) return;
    const device = scenario.laboratory.find(
      (asset) => asset.metadata?.subjectId === focusCharacterId,
    );
    const room =
      device?.metadata?.roomId ||
      scenario.rooms.find((entry) =>
        entry.occupants.some((person) => person.id === focusCharacterId),
      )?.id;
    if (room) setSelectedRoomId(room);
    onFocusHandled();
  }, [focusCharacterId, onFocusHandled, scenario.laboratory, scenario.rooms]);
  if (conversation) {
    const currentResident =
      scenario.residents.find(
        (entry) => entry.id === conversation.resident.id,
      ) || conversation.resident;
    const currentDevice = scenario.laboratory.find(
      (asset) => asset.metadata?.subjectId === currentResident.id,
    );
    const currentRoom = scenario.rooms.find(
      (room) => room.id === roomForCharacter(currentResident.id),
    );
    // Device name only applies if the character is actually on that device
    // (status starts with 'device:'). Otherwise use the room name.
    const occupant = currentRoom?.occupants.find((o) => o.id === currentResident.id);
    const isOnDevice = occupant?.status?.startsWith('device:');
    const currentContainer =
      currentDevice && isOnDevice
        ? currentDevice.name
        : currentRoom?.name || conversation.container;
    const currentKind = currentDevice
      ? currentDevice.id === "lab_recovery_capsule"
        ? "capsule"
        : conversation.kind
      : currentRoom?.type === "cell"
        ? "cell"
        : currentRoom?.type === "staff"
          ? "staff"
          : "room";
    const presentResidents = currentDevice
      ? [currentResident]
      : scenario.residents.filter((resident) =>
          currentRoom?.occupants.some(
            (occupant) =>
              occupant.id === resident.id && !occupant.status.startsWith("device:"),
          ),
        );
    if (currentDevice?.id === "lab_sex_machine") {
      return (
        <DeviceControlScreen
          asset={currentDevice}
          resident={currentResident}
          clock={scenario.clock}
          busy={busy}
          onRefresh={onRefresh}
          onRelease={async () => {
            const released = await onUse(currentDevice, currentResident);
            if (released !== false) setConversation(null);
          }}
          onExit={() => setConversation(null)}
        />
      );
    }
    if (currentDevice?.id === "lab_mental_correction_chair") {
      return (
        <MentalChairControlScreen
          asset={currentDevice}
          resident={currentResident}
          clock={scenario.clock}
          busy={busy}
          onRefresh={onRefresh}
          onRelease={async () => {
            const released = await onUse(currentDevice, currentResident);
            if (released !== false) setConversation(null);
          }}
          onExit={() => setConversation(null)}
        />
      );
    }
    return (
      <ContainerConversation
        key={currentResident.id}
        resident={currentResident}
        container={currentContainer}
        roomName={currentRoom?.name || conversation.container}
        kind={currentKind}
        asset={currentDevice || conversation.asset}
        worldMinute={scenario.clock.totalMinutes}
        busy={busy}
        presentResidents={presentResidents}
        onSelectResident={(next) =>
          setConversation({
            resident: next,
            container: currentRoom?.name || conversation.container,
            kind: currentKind,
          })
        }
        onRefresh={onRefresh}
        onRelease={
          currentDevice
            ? async () => {
                const released = await onUse(currentDevice, currentResident);
                if (released !== false) setConversation(null);
              }
            : undefined
        }
        onExit={() => setConversation(null)}
      />
    );
  }
  return (
    <main className="lab-overview">
      <header className="screen-heading lab-heading">
        <div>
          <p>{t('game.ui.personalComplex')}</p>
          <h1>{t('game.ui.laboratory')}</h1>
          <span>
            {t('game.ui.selectRoom')}
          </span>
        </div>
        <div className="lab-capacity">
          <small>{t('game.ui.rooms')}</small>
          <strong>{scenario.rooms.length}</strong>
          <span>{t('game.ui.available')}</span>
        </div>
      </header>
      <section className="lab-spatial">
        <aside className="room-rail">
          <small>{t('game.ui.labPlan')}</small>
          {scenario.rooms.map((room) => {
            const assets = scenario.laboratory.filter(
              (asset) =>
                asset.id !== "lab_sensory_pod" &&
                asset.metadata?.roomId === room.id,
            );
            const people =
              room.occupants.filter(
                (person) => !person.status.startsWith("device:"),
              ).length +
              assets.filter((asset) => asset.metadata?.subjectId).length;
            return (
              <button
                className={room.id === selectedRoom?.id ? "active" : ""}
                key={room.id}
                onClick={() => setSelectedRoomId(room.id)}
              >
                <span>{getRoomName(room.id, t)}</span>
                <small>
                  {people} {t('game.ui.people')} · {assets.length} {t('game.ui.equipment')}
                </small>
              </button>
            );
          })}
        </aside>
        {selectedRoom && (
          <div className="room-detail">
            <header>
              <div>
                <small>
                  {selectedRoom.type === "cell"
                    ? t('game.ui.livingCell')
                    : selectedRoom.type === "staff"
                      ? t('game.ui.staffRoom')
                      : t('game.ui.workspace')}
                </small>
                <h2>{getRoomName(selectedRoom.id, t)}</h2>
                <p>{getRoomDescription(selectedRoom.id, t)}</p>
              </div>
              <b>
                {visibleOccupants.length +
                  roomAssets.filter((asset) => asset.metadata?.subjectId)
                    .length}
                /{selectedRoom.capacity}
              </b>
            </header>
            <section className="room-detail-section room-people-section">
              <h3>{t('game.ui.charactersSection')}</h3>
              <div className="room-people">
                {roomPanelResidents.length ? (
                  roomPanelResidents.map((resident) => {
                    const device = roomAssets.find(
                      (asset) => asset.metadata?.subjectId === resident.id,
                    );
                    const moving = movePickerId === resident.id;
                    return (
                      <article
                        className={moving ? "move-open" : ""}
                        key={resident.id}
                      >
                        <div className="room-person-identity">
                          <div className="resident-avatar">
                            <CharacterPortrait
                              id={resident.subjectId || resident.id}
                              name={resident.name}
                              portrait={resident.portrait}
                              contexts={resident.contexts}
                              state={resident.state}
                              sleeping={resident.sleeping}
                            />
                          </div>
                          <div>
                            <strong>{resident.name}</strong>
                            <span>
                              {device ? getDeviceName(device.id, t) :
                                (resident.role === "assistant"
                                  ? t('game.ui.staff')
                                  : t('game.ui.activeFree'))}
                            </span>
                          </div>
                        </div>
                        <div className="room-person-actions">
                          <button
                            className="primary"
                            onClick={() =>
                              device?.id === "lab_diagnostic_table"
                                ? onInteract(resident)
                                : setConversation({
                                    resident,
                                    container:
                                      device?.name || selectedRoom.name,
                                    kind: device
                                      ? "capsule"
                                      : selectedRoom.type === "cell"
                                        ? "cell"
                                        : selectedRoom.type === "staff"
                                          ? "staff"
                                          : "room",
                                    asset: device,
                                  })
                            }
                          >
                            {device?.id === "lab_diagnostic_table"
                              ? t('game.ui.calibration')
                              : t('game.ui.interact')}
                          </button>
                          <button onClick={() => onOpenDossier(resident)}>
                            {t('game.ui.dossier')}
                          </button>
                          <button
                            className={moving ? "active" : ""}
                            onClick={() =>
                              setMovePickerId(moving ? null : resident.id)
                            }
                          >
                            {device
                              ? t('game.ui.releaseAndMove')
                              : t('game.ui.move')}
                          </button>
                        </div>
                        {moving && (
                          <div className="room-move-picker">
                            <small>
                              {device
                                ? `ОСВОБОДИТЬ И ПЕРЕМЕСТИТЬ ИЗ «${device.name}»`
                                : "ПЕРЕМЕСТИТЬ В"}
                            </small>
                            {scenario.rooms
                              .filter((room) => room.id !== selectedRoom.id)
                              .map((room) => (
                                <button
                                  disabled={busy}
                                  key={`${resident.id}-move-${room.id}`}
                                  onClick={async () => {
                                    setMovePickerId(null);
                                    if (device) {
                                      const released = await onUse(
                                        device,
                                        resident,
                                      );
                                      if (released === false) return;
                                    }
                                    onMove(resident, room.id);
                                  }}
                                >
                                  <span>{getRoomName(room.id, t)}</span>
                                  <i>
                                    {room.occupants.length}/{room.capacity}
                                  </i>
                                </button>
                              ))}
                          </div>
                        )}
                      </article>
                    );
                  })
                ) : (
                  <p>{t('game.ui.roomEmpty')}</p>
                )}
              </div>
              {selectedRoom.type === "cell" && (
                <small className="passive-note">
                  Размещённые здесь активы восстанавливаются автоматически с
                  глобальным временем.
                </small>
              )}
            </section>
            {assignmentAssetId &&
              (() => {
                const assignmentAsset = roomAssets.find(
                  (asset) => asset.id === assignmentAssetId,
                );
                if (!assignmentAsset) return null;
                return (
                  <section className="equipment-assignment-panel">
                    <header>
                      <div>
                        <small>{t('game.ui.placement')}</small>
                        <strong>{t('game.ui.placeIn').replace('{name}', assignmentAsset.name)}</strong>
                      </div>
                      <button onClick={() => setAssignmentAssetId(null)}>
                        ×
                      </button>
                    </header>
                    <div>
                      {assets.map((resident) => {
                        const residentDevice = scenario.laboratory.find(
                          (entry) => entry.metadata?.subjectId === resident.id,
                        );
                        const residentRoom = scenario.rooms.find(
                          (room) => room.id === roomForCharacter(resident.id),
                        );
                        return (
                          <button
                            disabled={busy}
                            key={`assign-${assignmentAsset.id}-${resident.id}`}
                            onClick={async () => {
                              const placed = await onUse(
                                assignmentAsset,
                                resident,
                              );
                              if (placed !== false) setAssignmentAssetId(null);
                            }}
                          >
                            <span className="equipment-target-avatar">
                              <CharacterPortrait
                                id={resident.subjectId || resident.id}
                                name={resident.name}
                                portrait={resident.portrait}
                                contexts={resident.contexts}
                                state={resident.state}
                                sleeping={resident.sleeping}
                              />
                            </span>
                            <span>
                              <b>{resident.name}</b>
                              <i>
                                {residentDevice?.name ||
                                  residentRoom?.name ||
                                  "Местоположение не определено"}
                              </i>
                            </span>
                            <em>{t('game.ui.placeArrow')}</em>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })()}
            {selectedRoom.type === "cell" || selectedRoom.type === "staff" ? null : (
            <section className="room-detail-section room-equipment-section">
              <h3>{t('game.ui.equipmentSection')}</h3>
              <div className="room-equipment">
                {roomAssets.length ? (
                  roomAssets.map((asset) => {
                    const acceptsAsset = [
                      "lab_recovery_capsule",
                      "lab_diagnostic_table",
                      "lab_sex_machine",
                      "lab_mental_correction_chair",
                    ].includes(asset.id);
                    const occupant = scenario.residents.find(
                      (resident) => resident.id === asset.metadata?.subjectId,
                    );
                    const occupantState = occupant?.state;
                    const occupantEquipmentPortrait =
                      occupant && asset.id === "lab_recovery_capsule"
                        ? capsulePortraitFor(occupant)
                        : null;
                    const cover = equipmentCovers[asset.id];
                    return (
                      <article
                        className={`laboratory-module ${occupant ? "occupied" : "available"} ${cover ? "illustrated" : "unillustrated"}`}
                        key={asset.id}
                      >
                        {cover && (
                          <div
                            className="laboratory-module-cover"
                            style={{ backgroundImage: `url("${cover}")` }}
                            aria-hidden="true"
                          />
                        )}
                        <div className="laboratory-module-copy">
                          <header>
                            <small>
                              {occupant ? t('game.ui.sessionActive') : t('game.ui.readyToWork')}
                            </small>
                            <strong>{getDeviceName(asset.id, t)}</strong>
                          </header>
                          <p>{asset.description}</p>
                        </div>
                        {occupant && (
                          <div className="device-card-occupant">
                            <div className="device-card-avatar">
                              {occupantEquipmentPortrait ? (
                                <img
                                  className="character-portrait-image capsule-character-portrait"
                                  src={occupantEquipmentPortrait}
                                  alt={occupant.name}
                                />
                              ) : (
                                <CharacterPortrait
                                  id={occupant.subjectId || occupant.id}
                                  name={occupant.name}
                                  portrait={occupant.portrait}
                                  contexts={occupant.contexts}
                                  state={occupant.state}
                                  sleeping={occupant.sleeping}
                                />
                              )}
                            </div>
                            <div className="device-card-telemetry">
                              <b>{occupant.name}</b>
                              {occupantState ? (
                                <div>
                                  <LabMetricChart
                                    resident={occupant}
                                    metric="tension"
                                    label="АКТ"
                                    tone="amber"
                                  />
                                  <LabMetricChart
                                    resident={occupant}
                                    metric="capacity"
                                    label="РЕС"
                                    tone="mint"
                                  />
                                  <LabMetricChart
                                    resident={occupant}
                                    metric="attitude"
                                    label="ПРН"
                                    tone="blue"
                                  />
                                  <LabMetricChart
                                    resident={occupant}
                                    metric="sensitivity"
                                    label="ЧУВ"
                                    tone="violet"
                                  />
                                </div>
                              ) : (
                                <span>{t('game.ui.stateDataUnavailable')}</span>
                              )}
                            </div>
                          </div>
                        )}
                        <footer>
                          {asset.id === "lab_diagnostic_table" && occupant ? (
                            <button
                              className="primary"
                              disabled={busy}
                              onClick={() => onInteract(occupant)}
                            >
                              {t('game.ui.calibration')}
                            </button>
                          ) : (
                            occupant && (
                              <button
                                className="primary"
                                disabled={busy}
                                onClick={() =>
                                  setConversation({
                                    resident: occupant,
                                    container: asset.name,
                                    kind: "capsule",
                                    asset,
                                  })
                                }
                              >
                                {t('game.ui.control')}
                              </button>
                            )
                          )}
                          {acceptsAsset && occupant && (
                            <button
                              disabled={busy}
                              onClick={() => onUse(asset, occupant)}
                            >
                              {t('game.ui.release')}
                            </button>
                          )}
                          {acceptsAsset && !occupant && (
                            <button
                              disabled={busy || !assets.length}
                              onClick={() => setAssignmentAssetId(asset.id)}
                            >
                              {t('game.ui.placeCharacter')}
                            </button>
                          )}
                        </footer>
                      </article>
                    );
                  })
                ) : (
                  <p>{t('game.ui.noEquipmentInstalled')}</p>
                )}
              </div>
            </section>
            )}
            {(selectedRoom.type === "cell" || selectedRoom.type === "staff") && (
              <div
                className="room-scene"
                style={{
                  backgroundImage: `url("${roomSceneBackground(selectedRoom.id)}")`,
                }}
              >
                <div className="room-scene-shade" />
                <span className="room-scene-label">
                  {getRoomName(selectedRoom.id, t)}
                </span>
                <div className="room-character-layer">
                  {roomPanelResidents.map((resident, index) => {
                    const anchor = roomAnchorFor(resident, index);
                    const pos = anchorsForRoom(selectedRoom.id)[anchor];
                    return (
                      <button
                        key={resident.id}
                        className={`room-character-anchor anchor-${anchor}`}
                        style={{ left: pos.left, bottom: pos.bottom }}
                        onClick={() => onInteract(resident)}
                        title={resident.name}
                      >
                        <CharacterPortrait
                          id={resident.subjectId || resident.id}
                          name={resident.name}
                          portrait={resident.portrait}
                          contexts={resident.contexts}
                          state={resident.state}
                          sleeping={resident.sleeping}
                        />
                        <span>{resident.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="room-equipment-compact-overlay">
                  {roomAssets
                    .filter(
                      (asset) =>
                        asset.id.endsWith("_music_panel") ||
                        asset.id.endsWith("_light_panel"),
                    )
                    .map((asset) => {
                      const enabled = Boolean(asset.metadata?.enabled);
                      return (
                        <button
                          className={`room-equipment-switch ${enabled ? "on" : "off"}`}
                          key={asset.id}
                          disabled={busy}
                          onClick={() => onTogglePanel(asset)}
                          aria-pressed={enabled}
                          title={asset.name}
                        >
                          <span className="room-equipment-switch-track">
                            <span className="room-equipment-switch-thumb" />
                          </span>
                          <span className="room-equipment-switch-label">
                            {asset.name}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function roomSceneBackground(roomId: string): string {
  switch (roomId) {
    case "room_cell_a":
    case "room_cell_b":
    case "room_cell_c":
    case "room_staff_living":
      return "/backgrounds/laboratory/living-cell-v2.png";
    case "room_cell_special":
      return "/backgrounds/laboratory/special-containment-cell.png";
    case "room_control":
      return "/backgrounds/laboratory/observation.png";
    default:
      return "/backgrounds/laboratory/calibration.png";
  }
}

/**
 * Точки привязки аватаров на фоне жилой камеры (living-cell-v2.png).
 * Координаты — проценты от ширины/высоты сцены, центр нижней точки аватара.
 * Фон: кровать слева (24%), табурет (40%), стол (50%), табурет (60%),
 * кровать справа (76%), санитарный модуль (65%).
 */
const ROOM_ANCHORS: Record<string, { left: string; bottom: string }> = {
  bed_1: { left: "24%", bottom: "18%" },
  bed_2: { left: "76%", bottom: "18%" },
  table_1: { left: "40%", bottom: "6%" },
  table_2: { left: "60%", bottom: "6%" },
  toilet: { left: "65%", bottom: "10%" },
  standing: { left: "50%", bottom: "4%" },
};

/**
 * Точки привязки для камеры особого содержания (special-containment-cell.png).
 * Одна кровать (29%), один стол (52%), санитарный модуль (67%).
 */
const SPECIAL_ROOM_ANCHORS: Record<string, { left: string; bottom: string }> = {
  bed_1: { left: "29%", bottom: "30%" },
  bed_2: { left: "29%", bottom: "30%" },
  table_1: { left: "52%", bottom: "20%" },
  table_2: { left: "52%", bottom: "20%" },
  toilet: { left: "67%", bottom: "35%" },
  standing: { left: "50%", bottom: "4%" },
};

/**
 * Определяет точку привязки персонажа на фоне камеры по его состоянию.
 * Приоритет: сон → кровать, рутина (еда/туалет) → стол/санитарный модуль,
 * иначе — стоя в центре. Два персонажа в одном состоянии разводятся по
 * кроватям/столам по индексу.
 */
function roomAnchorFor(resident: Resident, index: number): string {
  const ids = new Set(
    (resident.contexts || []).map((c) => c.id || (c as any).actionId).filter(Boolean),
  );
  if (resident.sleeping) return index % 2 === 0 ? "bed_1" : "bed_2";
  if (ids.has("routine_toilet")) return "toilet";
  if (ids.has("routine_eat")) return index % 2 === 0 ? "table_1" : "table_2";
  return "standing";
}

/** Набор якорей для выбранной комнаты. */
function anchorsForRoom(roomId: string): Record<string, { left: string; bottom: string }> {
  return roomId === "room_cell_special" ? SPECIAL_ROOM_ANCHORS : ROOM_ANCHORS;
}

function CharacterDirectory({
  residents,
  dossierId,
  busy,
  onSelect,
  onLocate,
  onChangeRole,
}: {
  residents: Resident[];
  dossierId: string | null;
  busy: boolean;
  onSelect: (id: string | null) => void;
  onLocate: (resident: Resident) => void;
  onChangeRole: (resident: Resident, role: "staff" | "asset") => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<
    "overview" | "state" | "zones" | "learning" | "relations" | "history"
  >("overview");
  const selected = residents.find((resident) => resident.id === dossierId);
  if (!selected) return null;
  const state = selected.state;
  const assessment = (() => {
    if (!state) return ["Состояние пока не оценено."];
    const notes: string[] = [];
    const baselineCapacity = state.baselineCapacity ?? state.capacity ?? 50;
    if (baselineCapacity <= 25)
      notes.push(
        "Наблюдаются признаки глубокого хронического истощения; обычного отдыха недостаточно.",
      );
    else if (baselineCapacity <= 40)
      notes.push(
        "Выносливость снижена длительной нагрузкой. Требуется продолжительное восстановление.",
      );
    else if ((state.capacity || 0) < 25)
      notes.push(
        "Сильно истощена в настоящий момент, хотя долговременный запас ещё сохранён.",
      );
    else if ((state.capacity || 0) > baselineCapacity + 3)
      notes.push(
        "Находится в восстановительном резерве и способна выдержать нагрузку выше привычной.",
      );
    else notes.push("Физический ресурс находится возле привычного уровня.");
    if ((state.tension || 0) >= 85)
      notes.push("Крайне напряжена; речь и реакции могут быть фрагментарными.");
    else if ((state.tension || 0) >= 55)
      notes.push("Заметно возбуждена и реагирует эмоциональнее обычного.");
    else if ((state.tension || 0) <= 15)
      notes.push("Внешне спокойна, выраженного возбуждения не наблюдается.");
    if ((state.attitude || 0) >= 70 && (state.openness || 0) >= 60)
      notes.push(
        "Охотно допускает контакт и сравнительно открыто сообщает о своих ощущениях.",
      );
    else if ((state.attitude || 0) <= 30)
      notes.push(
        "Относится к калибратору настороженно или враждебно; сотрудничество ненадёжно.",
      );
    else if ((state.openness || 0) <= 30)
      notes.push("Сохраняет дистанцию и склонна скрывать собственную реакцию.");
    return notes;
  })();
  const observedPoints = (selected.points || [])
    .filter((point) => !["posture", "slot_room", "slot_social", "global_pose", "mind_state", "systemic"].includes(point.id))
    .filter((point) => point.exposureCount > 0)
    .sort((a, b) => b.exposureCount - a.exposureCount);
  const favored = [...observedPoints]
    .sort((a, b) => b.attitude - a.attitude)
    .filter((point) => point.attitude >= 60)
    .slice(0, 3);
  const avoided = [...observedPoints]
    .sort((a, b) => a.attitude - b.attitude)
    .filter((point) => point.attitude <= 40)
    .slice(0, 3);
  const sensitive = observedPoints
    .map((point) => ({
      point,
      interpreted: interpretPointSensitivity(
        point.id,
        point.sensitivity,
        point.baselineSensitivity,
      ),
    }))
    .filter((entry) => entry.interpreted.humanRatio >= 1.35)
    .sort((a, b) => b.interpreted.humanRatio - a.interpreted.humanRatio)
    .slice(0, 3);
  const acquiredTraits = deriveAcquiredTraits(state?.preferences).filter(
    (trait) => trait.level > 0,
  );
  const preferenceData = parsePreferences(state?.preferences);
  const learnedTags = Object.entries(preferenceData.tags)
    .filter(
      (entry): entry is [string, number] =>
        Number.isFinite(entry[1]) && Math.abs(entry[1]) >= 0.1,
    )
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const relativeCore = (
    key: "capacity" | "openness" | "plasticity" | "sensitivity",
    value: number,
  ) =>
    interpretCoreMetric(
      key,
      value,
      Number(
        state?.[`baseline${key[0].toUpperCase()}${key.slice(1)}`] ?? value,
      ),
    );
  const coreMetrics = state
    ? [
        {
          label: "Активация",
          value: Number(state.tension || 0),
          display: `${Math.round(Number(state.tension || 0))}`,
          note: "текущее возбуждение",
        },
        {
          label: "Выносливость",
          value: Number(state.capacity || 0),
          display: `${relativeCore("capacity", Number(state.capacity || 0)).humanPercent}%`,
          note: `индекс ${Math.round(Number(state.capacity || 0))}`,
        },
        {
          label: "Принятие",
          value: Number(state.attitude || 0),
          display: `${Math.round(Number(state.attitude || 0))}`,
          note: "отношение к калибратору",
        },
        {
          label: "Открытость",
          value: Number(state.openness || 0),
          display: `${relativeCore("openness", Number(state.openness || 0)).humanPercent}%`,
          note: `индекс ${Math.round(Number(state.openness || 0))}`,
        },
        {
          label: "Пластичность",
          value: Number(state.plasticity || 0),
          display: `${relativeCore("plasticity", Number(state.plasticity || 0)).humanPercent}%`,
          note: `индекс ${Math.round(Number(state.plasticity || 0))}`,
        },
        {
          label: "Чувствительность",
          value: Number(state.sensitivity || 0),
          display: `${relativeCore("sensitivity", Number(state.sensitivity || 0)).humanPercent}%`,
          note: `индекс ${Math.round(Number(state.sensitivity || 0))}`,
        },
        {
          label: "Перегрузка",
          value: Number(state.overload || 0),
          display: Number(state.overload || 0).toFixed(1),
          note:
            Number(state.overload || 0) >= 10
              ? "критический уровень"
              : "контролируемо",
        },
      ]
    : [];
  const statistics = selected.statistics
    ? [
        ["Взаимодействия", selected.statistics.interactions],
        ["Записанные события", selected.statistics.recordedEvents],
        ["Сообщения", selected.statistics.chatMessages],
        ["Разрядки", selected.statistics.discharges],
        ["Срывы", selected.statistics.breakdowns],
        ["Выполненные контракты", selected.statistics.completedContracts],
      ]
    : [];
  const chronicleKind = (type: string) => {
    if (/interaction|device_protocol|equipment/u.test(type)) return "процедура";
    if (/mental_correction/u.test(type)) return "коррекция";
    if (/social|chat|speech/u.test(type)) return "разговор";
    if (/discharge|breakdown/u.test(type)) return "перелом";
    if (/role_change|recruitment/u.test(type)) return "статус";
    return "событие";
  };
  const meaningfulChronicle = Object.values((selected.history || []).reduce((groups, event) => {
    const kind = chronicleKind(event.type);
    const day = Math.floor(Number(event.worldMinute || 0) / 1440) + 1;
    const key = `${day}:${kind}:${event.title}`;
    const group = groups[key] || { ...event, kind, day, count: 0, descriptions: [] as string[] };
    group.count++;
    if (event.description && !group.descriptions.includes(event.description)) group.descriptions.push(event.description);
    groups[key] = group;
    return groups;
  }, {} as Record<string, { id: string; title: string; type: string; time?: string; worldMinute?: number; kind: string; day: number; count: number; descriptions: string[] }>))
    .sort((a, b) => Number(b.worldMinute || 0) - Number(a.worldMinute || 0));
  const bodypartSlug: Record<string, string> = {
    "S-AV-01": "mira", "NPC-LAB-01": "iona", "NPC-CAND-01": "nika",
    "NPC-CAND-SUMI": "sumi", "NPC-CAND-GEN-02": "eli", "NPC-CAND-GEN-04": "mai",
    "NPC-CAND-KATE": "kate",
  };
  const zoneImage = (pointId: string) => {
    const slug = bodypartSlug[selected.subjectId || selected.id];
    if (!slug) return null;
    const aliases: Record<string, string> = {
      chest: "breasts", belly: "stomach", mouth: "lips", oral: "lips", thighs: "inner_thighs",
      ass: "buttocks", butt: "buttocks", arms: "arms", hands: "hands",
    };
    const image = aliases[pointId] || pointId;
    return `/character-images/bodyparts/${slug}/${image}.png`;
  };
  const relationTone = (value: number) => value >= 68 ? t('game.ui.relationToneWarm') : value <= 35 ? t('game.ui.relationToneStrained') : t('game.ui.relationToneNeutral');
  const operationalSummary = assessment[0] || t('game.ui.noAssessmentDataYet');
  return (
    <main className="character-dossier">
      <header>
        <button onClick={() => onSelect(null)}>{t('game.ui.back')}</button>
        <span>{t('game.ui.characterDossier')}</span>
        <label className="dossier-character-picker">
          <small>{t('game.ui.character')}</small>
          <select
            value={selected.id}
            onChange={(event) => onSelect(event.target.value)}
          >
            {residents.map((resident) => (
              <option key={`dossier-${resident.id}`} value={resident.id}>
                {resident.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="dossier-layout">
        <aside>
          <div className="dossier-portrait">
            <CharacterPortrait
              id={selected.subjectId || selected.id}
              name={selected.name}
              portrait={selected.portrait}
              contexts={selected.contexts}
              state={selected.state}
              sleeping={selected.sleeping}
            />
          </div>
          <small>
            {selected.role === "assistant"
              ? t('game.ui.staffShort')
              : selected.role === "asset"
                ? t('game.ui.assetShort')
                : t('game.ui.character')}
          </small>
          <h1>{selected.name}</h1>
          <p>{selected.title}</p>
          <ContextSummary contexts={selected.contexts} />
          <button className="primary" onClick={() => onLocate(selected)}>
            {t('game.ui.goToCharacter')}
          </button>
        </aside>
        <section>
          <nav className="dossier-tabs">
            <button
              className={tab === "overview" ? "active" : ""}
              onClick={() => setTab("overview")}
            >
              {t('game.ui.dossier')}
            </button>
            <button
              className={tab === "state" ? "active" : ""}
              onClick={() => setTab("state")}
            >
              {t('game.ui.tabState')}
            </button>
            <button
              className={tab === "zones" ? "active" : ""}
              onClick={() => setTab("zones")}
            >
              {t('game.ui.tabZones')}
            </button>
            <button
              className={tab === "learning" ? "active" : ""}
              onClick={() => setTab("learning")}
            >
              {t('game.ui.tabLearning')}
            </button>
            <button
              className={tab === "relations" ? "active" : ""}
              onClick={() => setTab("relations")}
            >
              {t('game.ui.tabRelations')}
            </button>
            <button
              className={tab === "history" ? "active" : ""}
              onClick={() => setTab("history")}
            >
              {t('game.ui.tabHistory')}
            </button>
          </nav>
          {tab === "overview" && (
            <div className="dossier-information-grid">
              <article className="dossier-wide dossier-operational-brief">
                <small>{t('game.ui.operationalBrief')}</small>
                <b>{operationalSummary}</b>
                <div className="dossier-brief-signals">
                  <span>{t('game.ui.resource')} {Math.round(Number(state?.capacity || 0))}</span>
                  <span>{t('game.ui.tension')} {Math.round(Number(state?.tension || 0))}</span>
                  <span>{t('game.ui.contact')} {Math.round(Number(state?.attitude || 0))}</span>
                  <span>{selected.contexts?.length ? t('game.ui.activeContextsCount').replace('{n}', String(selected.contexts.length)) : t('game.ui.freeOfContexts')}</span>
                </div>
              </article>
              <article className="dossier-biography">
                <small>{t('game.ui.biography')}</small>
                <p>
                  {selected.biography ||
                    selected.description ||
                    t('game.ui.noDescription')}
                </p>
              </article>
              <article>
                <small>{t('game.ui.recordPassport')}</small>
                <dl className="dossier-facts">
                  <div>
                    <dt>{t('game.ui.identifier')}</dt>
                    <dd>{selected.subjectId || selected.id}</dd>
                  </div>
                  <div>
                    <dt>{t('game.ui.category')}</dt>
                    <dd>
                      {selected.kind === "subject"
                        ? t('game.ui.kindSubject')
                        : selected.kind === "npc"
                          ? t('game.ui.kindNpc')
                          : t('game.ui.kindOperator')}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('game.ui.status')}</dt>
                    <dd>
                      {selected.role === "asset"
                        ? t('game.ui.roleAsset')
                        : selected.role === "assistant"
                          ? t('game.ui.roleStaff')
                          : selected.role}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('game.ui.presence')}</dt>
                    <dd>{selected.presenceState || t('game.ui.notSpecified')}</dd>
                  </div>
                  <div>
                    <dt>{t('game.ui.positionRole')}</dt>
                    <dd>
                      {selected.currentRole || selected.title || t('game.ui.notAssigned')}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('game.ui.exploredZones')}</dt>
                    <dd>
                      {observedPoints.length} / {selected.points?.length || 0}
                    </dd>
                  </div>
                </dl>
              </article>
              <article>
                <small>{t('game.ui.currentAssessment')}</small>
                <div className="narrative-notes">
                  {assessment.map((note, index) => (
                    <p key={index}>{note}</p>
                  ))}
                </div>
              </article>
              <article>
                <small>{t('game.ui.observationStats')}</small>
                {statistics.length ? (
                  <dl className="dossier-facts dossier-statistics">
                    {statistics.map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p>{t('game.ui.noStatsYet')}</p>
                )}
              </article>
              {selected.roleHistory?.length ? (
                <article className="dossier-wide">
                  <small>{t('game.ui.statusHistory')}</small>
                  <div className="dossier-role-history">
                    {selected.roleHistory.map((entry, index) => (
                      <div key={`${entry.worldMinute}-${index}`}>
                        <i>{t('game.ui.day')} {Math.floor(entry.worldMinute / 1440) + 1}</i>
                        <b>{entry.title}</b>
                        <span>{entry.description}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}
              <article className="dossier-wide">
                <small>{t('game.ui.operationalStatus')}</small>
                <p>
                  {selected.role === "asset"
                    ? t('game.ui.assetBrief')
                    : t('game.ui.staffBrief')}
                </p>
                <div className="role-management">
                  {selected.role === "asset" ? (
                    <button
                      disabled={busy}
                      onClick={() =>
                        window.confirm(t('game.ui.confirmAssignStaff').replace('{name}', selected.name)) &&
                        onChangeRole(selected, "staff")
                      }
                    >
                      {t('game.ui.assignToStaff')}
                    </button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() =>
                        window.confirm(
                          t('game.ui.confirmRegisterAsset').replace('{name}', selected.name),
                        ) && onChangeRole(selected, "asset")
                      }
                    >
                      {t('game.ui.registerAsAsset')}
                    </button>
                  )}
                  <small>
                    {t('game.ui.roleChangeNote')}
                  </small>
                </div>
              </article>
            </div>
          )}
          {tab === "state" && (
            <div className="dossier-information-grid">
              <article className="dossier-wide">
                <small>{t('game.ui.stateSummary')}</small>
                {coreMetrics.length ? (
                  <div className="dossier-parameter-table">
                    {coreMetrics.map((metric) => (
                      <div key={metric.label}>
                        <span>{metric.label}</span>
                        <b>{metric.display}</b>
                        <small>{metric.note}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>{t('game.ui.stateNotMeasured')}</p>
                )}
              </article>
              <article>
                <small>{t('game.ui.observedFeatures')}</small>
                <div className="narrative-notes">
                  {assessment.map((note, index) => (
                    <p key={index}>{note}</p>
                  ))}
                </div>
              </article>
              <article>
                <small>{t('game.ui.establishedReactions')}</small>
                <div className="narrative-notes">
                  {favored.length > 0 && (
                    <p>
                      {t('game.ui.favoredAcceptance')}{" "}
                      {favored.map((point) => point.label).join(", ")}.
                    </p>
                  )}
                  {avoided.length > 0 && (
                    <p>
                      {t('game.ui.resistance')}{" "}
                      {avoided.map((point) => point.label).join(", ")}.
                    </p>
                  )}
                  {sensitive.length > 0 && (
                    <p>
                      {t('game.ui.increasedSensitivity')}{" "}
                      {sensitive
                        .map(
                          (entry) =>
                            `${entry.point.label} — ${entry.interpreted.humanPercent}%`,
                        )
                        .join("; ")}
                      .
                    </p>
                  )}
                  {!observedPoints.length && (
                    <p>{t('game.ui.noReactionsYet')}</p>
                  )}
                </div>
              </article>
              <article className="dossier-wide">
                <small>{t('game.ui.currentCircumstances')}</small>
                <div className="dossier-tags">
                  {selected.contexts?.length ? (
                    selected.contexts.map((context) => (
                      <span key={context.id}>
                        {context.label} · {context.ticksActive} мин.
                      </span>
                    ))
                  ) : (
                    <i>{t('game.ui.noActiveStates')}</i>
                  )}
                </div>
              </article>
            </div>
          )}
          {tab === "zones" && (
            <div className="dossier-information-grid dossier-zones-view">
              <article className="dossier-wide">
                <small>{t('game.ui.localIndicators')} · {t('game.ui.observedZones')}</small>
                {observedPoints.length ? (
                  <div className="dossier-zone-gallery">
                    {observedPoints.map((point) => {
                      const pointSensitivity = interpretPointSensitivity(
                        point.id,
                        point.sensitivity,
                        point.baselineSensitivity,
                      );
                      const pointAttitude = interpretPointAttitude(
                        point.attitude,
                        point.baselineAttitude,
                      );
                      return (
                        <article className="dossier-zone-card" key={point.id}>
                          {zoneImage(point.id) && <img src={zoneImage(point.id)!} alt="" onError={event => { event.currentTarget.style.display = "none"; }} />}
                          <section>
                            <b>{point.label}</b>
                            <p>{t('game.ui.zoneSensitivity').replace('{sens}', String(pointSensitivity.humanPercent)).replace('{att}', String(pointAttitude.humanPercent))}</p>
                            <p>{t('game.ui.zoneStats').replace('{open}', String(Math.round(point.openness))).replace('{fam}', String(Math.round(point.familiarity))).replace('{n}', String(point.exposureCount))}</p>
                          </section>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p>{t('game.ui.noZonesExplored')}</p>
                )}
              </article>
            </div>
          )}
          {tab === "learning" && (
            <div className="dossier-information-grid dossier-learning-view">
              {selected.dossierNarrative && <article className="dossier-wide dossier-voice-note"><small>{t('game.ui.ownWords')}</small><p>«{selected.dossierNarrative.selfDescription}»</p><i>{selected.dossierNarrative.traitExpression}</i></article>}
              <article>
                <small>{t('game.ui.acquiredFeatures')}</small>
                <div className="dossier-tags">
                  {acquiredTraits.length ? (
                    acquiredTraits.map((trait) => (
                      <span key={trait.id}>
                        {trait.label} · {["", "I", "II", "III"][trait.level]}
                      </span>
                    ))
                  ) : (
                    <i>{t('game.ui.noDeepChanges')}</i>
                  )}
                </div>
              </article>
              <article>
                <small>{t('game.ui.learnedAssociations')}</small>
                {learnedTags.length ? (
                  <div className="dossier-learning-list">
                    {learnedTags.map(([tag, strength]) => (
                      <div key={tag}>
                        <span>{semanticTagLabels[tag] || tag}</span>
                        <b className={strength >= 0 ? "positive" : "negative"}>
                          {strength > 0 ? "+" : ""}
                          {strength.toFixed(2)}
                        </b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>{t('game.ui.noAssociationsYet')}</p>
                )}
              </article>
            </div>
          )}
          {tab === "relations" && (
            <article className="dossier-relations-panel">
              <header>
                <div><small>{t('game.ui.relationsMatrix')}</small><b>{t('game.ui.howPerceivesOthers').replace('{name}', selected.name)}</b></div>
                <span>{t('game.ui.directedRelationsNote')}</span>
              </header>
              <div className="dossier-relation-list">
                {(selected.relationships || []).sort((a, b) => b.familiarity - a.familiarity).map(relation => (
                  <article key={relation.characterId}>
                    <div className="dossier-relation-avatar"><CharacterPortrait id={relation.subjectId} name={relation.name} /></div>
                    <section>
                      <b>{relation.name}</b>
                      <p>{relation.opinion || `${relationTone(relation.attitude)} ${t('game.ui.relationNoStable')}`}</p>
                      {relation.recentMemories?.[0] && <i>{relation.recentMemories[relation.recentMemories.length - 1]}</i>}
                    </section>
                    <dl>
                      <div><dt>{t('game.ui.relationAttitude')}</dt><dd>{Math.round(relation.attitude)}</dd></div>
                      <div><dt>{t('game.ui.relationOpenness')}</dt><dd>{Math.round(relation.openness)}</dd></div>
                      <div><dt>{t('game.ui.relationFamiliarity')}</dt><dd>{Math.round(relation.familiarity * 100)}%</dd></div>
                    </dl>
                    <em>{relation.present ? t('game.ui.nearby') : relation.knows ? t('game.ui.known') : t('game.ui.notKnown')}</em>
                  </article>
                ))}
                {!(selected.relationships || []).length && <p>{t('game.ui.noRelationsYet')}</p>}
              </div>
            </article>
          )}
          {tab === "history" && (
            <article className="dossier-history-panel">
              <header>
                <div>
                  <small>{t('game.ui.significantChanges')}</small>
                  <b>{t('game.ui.episodesCount').replace('{n}', String(meaningfulChronicle.length))}</b>
                </div>
                <span>{t('game.ui.historyNote')}</span>
              </header>
              <div className="dossier-history">
                {meaningfulChronicle.length ? (
                  meaningfulChronicle.map((event) => (
                      <div className="dossier-history-event" key={`${event.id}:${event.kind}`}>
                        <time>
                          {event.time ||
                            `День ${event.day}`}
                        </time>
                        <em>{event.kind}{event.count > 1 ? ` · ${event.count}` : ""}</em>
                        <section>
                          <b>{event.title}</b>
                          {event.descriptions[0] && <p>{event.descriptions[0]}</p>}
                        </section>
                      </div>
                    ))
                ) : (
                  <p>{t('game.ui.noEventsYet')}</p>
                )}
              </div>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}

function PeopleView({
  residents,
  onOpen,
}: {
  residents: Resident[];
  onOpen: (resident: Resident) => void;
}) {
  const { t } = useI18n();
  const assets = residents.filter(
    (resident) => resident.role === "asset" || resident.kind === "subject",
  );
  const staff = residents.filter((resident) => !assets.includes(resident));
  return (
    <main className="character-directory">
      <header className="screen-heading">
        <div>
          <p>{t('game.ui.composition')}</p>
          <h1>{t('game.ui.characters')}</h1>
          <span>
            {t('game.ui.charactersDescription')}
          </span>
        </div>
        <b>{residents.length} {t('game.ui.total')}</b>
      </header>
      <section>
        <div className="directory-group">
          <h2>{t('game.ui.assets')}</h2>
          {assets.length ? (
            assets.map((resident) => (
              <DirectoryCard
                key={resident.id}
                resident={resident}
                onOpen={() => onOpen(resident)}
              />
            ))
          ) : (
            <p className="empty-screen">{t('game.ui.noAssets')}</p>
          )}
        </div>
        <div className="directory-group">
          <h2>{t('game.ui.staff')}</h2>
          {staff.length ? (
            staff.map((resident) => (
              <DirectoryCard
                key={resident.id}
                resident={resident}
                onOpen={() => onOpen(resident)}
              />
            ))
          ) : (
            <p className="empty-screen">{t('game.ui.staffMissing')}</p>
          )}
        </div>
      </section>
    </main>
  );
}

function DirectoryCard({
  resident,
  onOpen,
}: {
  resident: Resident;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const state = resident.state;
  return (
    <button className="directory-card" onClick={onOpen}>
      <div className="directory-photo">
        <CharacterPortrait
          id={resident.subjectId || resident.id}
          name={resident.name}
          portrait={resident.portrait}
          contexts={resident.contexts}
          state={resident.state}
          sleeping={resident.sleeping}
        />
      </div>
      <div>
        <small>{resident.role === "assistant" ? "ПЕРСОНАЛ" : "АКТИВ"}</small>
        <strong>{resident.name}</strong>
        <span>{resident.title}</span>
        {state && (
          <p>
            {t('game.ui.resource')} {Math.round(state.capacity || 0)} · {t('game.ui.tension').toLowerCase()}{" "}
            {Math.round(state.tension || 0)}
          </p>
        )}
      </div>
      <i>{t('game.ui.openDossier')}</i>
    </button>
  );
}

function ContextSummary({
  contexts = [],
}: {
  contexts?: Resident["contexts"];
}) {
  const { t } = useI18n();
  const clothing = contexts.filter((context) =>
    context.id.startsWith("eq_clothe_"),
  );
  const active = contexts.filter(
    (context) => !context.id.startsWith("eq_clothe_"),
  );
  return (
    <div className="character-context-summary">
      <small>{t('game.ui.clothing')}</small>
      <p>
        {clothing.length
          ? clothing
              .map((context) => context.label.replace(/^Надеть\s+/i, ""))
              .join(" · ")
          : t('game.ui.noClothing')}
      </p>
      <small>{t('game.ui.activeContexts')}</small>
      <p>
        {active.length
          ? active.map((context) => context.label).join(" · ")
          : t('game.ui.none')}
      </p>
    </div>
  );
}

const deviceStatusLabels: Record<DeviceSession["status"], string> = {
  loaded: "Загружено",
  running: "Работает",
  paused: "Пауза",
  stopped: "Остановлено",
};

const episodeSceneBackgrounds: Record<string, string> = {
  scene_lab_calibrator: "/backgrounds/laboratory/calibration.png",
  scene_broker: "/backgrounds/laboratory/observation.png",
  scene_liaison: "/backgrounds/laboratory/observation.png",
};

const episodePortraitSlugs: Record<string, string> = {
  "S-AV-01": "mira", "NPC-LAB-01": "iona", "NPC-CAND-01": "nika",
  "NPC-CAND-SUMI": "sumi", "NPC-CAND-GEN-02": "eli", "NPC-CAND-GEN-04": "mai",
  "NPC-CAND-KATE": "kate",
};

const episodeActionGroup = (actionId: string): "contact" | "intimate" | "equipment" | "pose" | "clothing" | null => {
  if (/^(light_kiss|deep_kiss|licking|finger_insertion|act_.*(penetration|friction|climax))/u.test(actionId)) return "intimate";
  if (/^(act_|eq_|vibrator_)/u.test(actionId)) return "equipment";
  if (/^(pose_|act_(present|release|hold|suspend))/u.test(actionId)) return "pose";
  if (/^(gentle_stroke|tickle|slap|hard_slap|deep_massage|feather_stroke|hair_pull|pinch|scratching|firm_grip|light_bite|hard_bite|whip_strike|hot_wax|taser_shock|ice_cube|needle_prick|belt_strike|wait)$/u.test(actionId)) return "contact";
  return null;
};

function EpisodeMemoryCollage({ memory, subjectId }: { memory: NonNullable<Resident["mentalMemories"]>[number]; subjectId: string }) {
  const moments = memory.moments || [];
  const sceneCounts = new Map<string, number>();
  const actionCounts = new Map<string, number>();
  const participants = new Set<string>([subjectId]);
  const emotions = new Set<string>();
  for (const moment of moments) {
    if (moment.sceneId) sceneCounts.set(moment.sceneId, (sceneCounts.get(moment.sceneId) || 0) + 1);
    if (moment.actionId) actionCounts.set(moment.actionId, (actionCounts.get(moment.actionId) || 0) + 1);
    moment.participantIds?.forEach(id => participants.add(id));
    if (moment.portraitEmotion) emotions.add(moment.portraitEmotion);
  }
  const sceneId = [...sceneCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "scene_lab_calibrator";
  const actions = [...actionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => ({ id, group: episodeActionGroup(id) }));
  const portraits = [...participants].map(id => episodePortraitSlugs[id]).filter(Boolean).slice(0, 3);
  const emotionRank = ["climax", "unconscious", "subspace", "mixed_overload", "high_negative", "high_positive", "fear", "pain", "distressed", "aroused", "pleasure", "receptive", "guarded", "neutral"];
  const emotion = emotionRank.find(value => emotions.has(value)) || "neutral";
  return <span className="mental-memory-collage" aria-hidden="true" style={{ "--episode-scene": `url(${episodeSceneBackgrounds[sceneId] || episodeSceneBackgrounds.scene_lab_calibrator})` } as React.CSSProperties}>
    {actions.map((action, index) => action.group
      ? <img key={action.id} className={`episode-action-layer layer-${index + 1}`} src={resolveActionButtonImage(action.id, action.group)} onError={event => { event.currentTarget.style.display = "none"; }} />
      : <span key={action.id} className={`episode-action-label layer-${index + 1}`}>{action.id.replace(/^(act_|context_)/, "").replace(/_/g, " ")}</span>)}
    {portraits.map((slug, index) => <img key={`${slug}:${index}`} className={`episode-portrait-layer portrait-${index + 1}`} src={`/character-images/portraits/${slug}/${emotion}.png`} onError={event => { if (!event.currentTarget.dataset.fallback) { event.currentTarget.dataset.fallback = "true"; event.currentTarget.src = `/character-images/portraits/${slug}/neutral.png`; } else event.currentTarget.style.display = "none"; }} />)}
  </span>;
}

function MentalChairControlScreen({
  asset,
  resident,
  clock,
  busy,
  onRefresh,
  onRelease,
  onExit,
}: {
  asset: LabAsset;
  resident: Resident;
  clock: Scenario["clock"];
  busy: boolean;
  onRefresh: () => Promise<void>;
  onRelease?: () => Promise<void>;
  onExit: () => void;
}) {
  const { t } = useI18n();
  const session = asset.metadata?.mentalSession;
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoryId, setMemoryId] = useState<number | null>(session?.memoryId || null);
  const [frame, setFrame] = useState<MentalChairSession["frame"]>(session?.frame || "reframe");
  const [focusTag, setFocusTag] = useState<string | null>(session?.focusTag || null);
  const [intensity, setIntensity] = useState(session?.intensity || 40);
  const [memoryPage, setMemoryPage] = useState(0);
  const [episodeWorkspace, setEpisodeWorkspace] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedAssociationTarget, setSelectedAssociationTarget] = useState<string | null>(null);
  const [intervention, setIntervention] = useState("");
  const [episodeView, setEpisodeView] = useState<"list" | "map">("map");
  const [selectedMindNode, setSelectedMindNode] = useState<string | null>(null);
  // Панорамирование и зум холста майнд-мэпа.
  const [mindView, setMindView] = useState({ x: 0, y: 0, scale: 1 });
  const mindDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; origScale: number; moved: boolean } | null>(null);
  const memories = resident.mentalMemories || [];
  const selectedMemory = memories.find((memory) => memory.id === memoryId) || null;
  const memoryPageSize = 14;
  const memoryPages = Math.max(1, Math.ceil(memories.length / memoryPageSize));
  const visibleMemories = memories.slice(memoryPage * memoryPageSize, (memoryPage + 1) * memoryPageSize);
  const tagLabel = (tag: string) => selectedMemory?.tagLabels?.[tag] || `${t('game.ui.themePrefix')} ${tag.replace(/[_-]+/g, " ")}`;
  const associationLinks = selectedMemory?.subjective?.associations || [];
  const memoryTags = selectedMemory?.tags || [];
  // Central card bounds in graph % space (used only by the force sim below).
  const CORE = { xmin: 35, xmax: 65, ymin: 30, ymax: 70 };
  // Edges are NOT clipped to the card: the card is opaque and sits above the
  // edge SVG, so it naturally masks the middle of any line that crosses it.
  // The two visible stubs then terminate exactly at the card's ink border —
  // flush, with no white gap. (Clipping to an inset box produced a visible gap
  // between the line end and the border.)
  const clipSegments = (x1: number, y1: number, x2: number, y2: number): { x1: number; y1: number; x2: number; y2: number }[] =>
    [{ x1, y1, x2, y2 }];
  const memoryGraph = useMemo(() => {
    type GraphNode = { id: string; label: string; kind: 'tag' | 'association'; degree: number; strength: number; valence: number; x: number; y: number; vx: number; vy: number };
    const tags = [...new Set(memoryTags)];
    const targets = [...new Set(associationLinks.filter(link => !link.manual).map(link => link.target))];
    const edges = associationLinks.filter(link => !link.manual).flatMap(link => link.tagLinks
      .filter(tag => tags.includes(tag))
      .map(tag => ({ from: `association:${link.target}`, to: `tag:${tag}`, target: link.target, strength: Number(link.strength) || 0, valence: Number(link.valence) || 0 })));
    for (const link of associationLinks.filter(link => link.manual && link.tagLinks.length === 2)) {
      edges.push({ from: `tag:${link.tagLinks[0]}`, to: `tag:${link.tagLinks[1]}`, target: link.target, strength: Number(link.strength) || 0, valence: Number(link.valence) || 0 });
    }
    const hash = (text: string) => [...text].reduce((value, char) => ((value * 31 + char.charCodeAt(0)) >>> 0), 2166136261);
    const seeded = (text: string, offset: number) => ((hash(`${selectedMemory?.id || 0}:${text}:${offset}`) % 10000) / 10000);
    const nodes: GraphNode[] = [
      ...tags.map(tag => ({ id: `tag:${tag}`, label: tagLabel(tag), kind: 'tag' as const, degree: 0, strength: 0, valence: 0, x: 0, y: 0, vx: 0, vy: 0 })),
      ...targets.map(target => ({ id: `association:${target}`, label: target, kind: 'association' as const, degree: 0, strength: 0, valence: 0, x: 0, y: 0, vx: 0, vy: 0 })),
    ];
    const byId = new Map(nodes.map(node => [node.id, node]));
    for (const edge of edges) {
      const from = byId.get(edge.from); const to = byId.get(edge.to);
      if (!from || !to) continue;
      from.degree++; to.degree++;
      from.strength = Math.max(from.strength, edge.strength);
      from.valence += edge.valence;
    }
    // Two-ring hub-and-spoke layout.
    //   • association nodes (entities) sit on the OUTER ring;
    //   • tag nodes (concepts) sit on the INNER ring, closer to the card.
    // Each kind gets its OWN evenly-spaced angle sweep. The home pull is made
    // deliberately dominant so nodes STAY on their ring; edge pull is kept
    // weak so it nudges clusters without dragging nodes off their radius
    // (which is what previously made the graph collapse into a heap).
    const home = new Map<GraphNode, { x: number; y: number }>();
    for (const kind of ['association', 'tag'] as const) {
      const kindNodes = nodes
        .filter(node => node.kind === kind)
        .slice()
        .sort((a, b) => seeded(a.id, 5) - seeded(b.id, 5));
      const outer = kind === 'association';
      const rx = outer ? 39 : 36;
      const ry = outer ? 42 : 39;
      kindNodes.forEach((node, index) => {
        const angle = (index / Math.max(1, kindNodes.length)) * Math.PI * 2;
        node.x = 50 + Math.cos(angle) * rx;
        node.y = 50 + Math.sin(angle) * ry;
        home.set(node, { x: node.x, y: node.y });
      });
    }
    // A small deterministic force simulation keeps meaningful clusters close,
    // but preserves an Obsidian-like irregular topology across rerenders.
    for (let step = 0; step < 140; step++) {
      // Gentle mutual repulsion prevents node overlap (the core defect).
      for (let left = 0; left < nodes.length; left++) for (let right = left + 1; right < nodes.length; right++) {
        const a = nodes[left], b = nodes[right];
        let dx = b.x - a.x, dy = b.y - a.y;
        const distance2 = Math.max(9, dx * dx + dy * dy);
        const force = 34 / distance2;
        if (Math.abs(dx) + Math.abs(dy) < .01) { dx = seeded(`${a.id}:${b.id}`, 3) - .5; dy = seeded(`${b.id}:${a.id}`, 4) - .5; }
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        a.vx -= dx / distance * force; a.vy -= dy / distance * force;
        b.vx += dx / distance * force; b.vy += dy / distance * force;
      }
      for (const edge of edges) {
        const a = byId.get(edge.from), b = byId.get(edge.to); if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 1;
        const pull = (distance - (14 - edge.strength * 2)) * .012;
        a.vx += dx / distance * pull; a.vy += dy / distance * pull;
        b.vx -= dx / distance * pull; b.vy -= dy / distance * pull;
      }
      for (const node of nodes) {
        // The central card is a solid object in the graph. Push nodes out of
        // the card rectangle.
        if (node.x > CORE.xmin && node.x < CORE.xmax && node.y > CORE.ymin && node.y < CORE.ymax) {
          const dx = node.x - 50, dy = node.y - 50;
          const ax = Math.abs(dx) / ((CORE.xmax - CORE.xmin) / 2), ay = Math.abs(dy) / ((CORE.ymax - CORE.ymin) / 2);
          if (ax > ay) node.vx += Math.sign(dx || .1) * 2;
          else node.vy += Math.sign(dy || .1) * 2;
        }
        // Dominant home pull keeps each node ON its ring slot. This enforces
        // the two-ring structure; without it repulsion/edges scatter kinds
        // into a mixed cloud.
        const h = home.get(node)!;
        node.vx += (h.x - node.x) * .22; node.vy += (h.y - node.y) * .22;
        node.vx *= .6; node.vy *= .6;
        node.x = Math.max(4, Math.min(96, node.x + node.vx));
        node.y = Math.max(5, Math.min(95, node.y + node.vy));
      }
    }
    return { nodes, edges, byId };
  }, [selectedMemory?.id, memoryTags.join('|'), JSON.stringify(associationLinks)]);
  // Майнд-мэп интерпретаций: радиальная раскладка по глубине дерева.
  // worldview в центре, ветви (relationships/biography/station/self) на среднем
  // кольце, листья (rel/trait/episode/station:<key>) на внешнем. Кросс-линки
  // рисуются как рёбра между нодами.
  const interpretationGraph = resident.interpretationGraph;
  // Человекочитаемая метка ноды: trait:<tag> → memoryTagLabel, episode:<id> → title,
  // rel:<id> → имя, station:<key> → ключ, ветви → label.
  const mindNodeLabel = (node: { id: string; kind: string; label: string }): string => {
    if (node.kind === 'trait') {
      const tag = node.id.startsWith('trait:') ? node.id.slice(6) : node.label;
      return memoryTagLabel(tag);
    }
    if (node.kind === 'episode') return node.label || 'Эпизод';
    if (node.kind === 'relationships' && node.id.startsWith('rel:')) return node.label || node.id.slice(4);
    if (node.kind === 'station' && node.id.startsWith('station:')) return node.label || node.id.slice(8);
    return node.label;
  };
  // Перенос метки на строки с ограничением ширины (maxChars на строку, ≤2 строки).
  const wrapLabel = (label: string, maxChars: number): string[] => {
    if (label.length <= maxChars) return [label];
    const words = label.split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
      const next = cur ? `${cur} ${word}` : word;
      if (next.length <= maxChars) { cur = next; continue; }
      if (cur) { lines.push(cur); cur = word; }
      else { lines.push(word.slice(0, maxChars)); cur = ''; }
      if (lines.length === 2) break;
    }
    if (cur && lines.length < 2) lines.push(cur);
    // Если текст всё ещё длиннее показанного — обрезаем последнюю строку с многоточием.
    const shown = lines.join(' ');
    if (label.length > shown.length && lines.length) {
      lines[lines.length - 1] = lines[lines.length - 1].slice(0, maxChars - 1).trimEnd() + '…';
    }
    return lines;
  };
  const mindMap = useMemo(() => {
    type MindNode = { id: string; kind: string; parentId: string | null; label: string; content: string | null; valence: number; strength: number; status: string; depth: number; x: number; y: number; children: string[]; floatDelay: number; w: number; h: number };
    const raw = interpretationGraph?.nodes || [];
    const links = interpretationGraph?.links || [];
    if (!raw.length) return { nodes: [] as MindNode[], edges: [] as { from: string; to: string; kind: string }[], byId: new Map<string, MindNode>(), parentOf: new Map<string, string | null>() };
    const byId = new Map<string, MindNode>();
    const nodes: MindNode[] = raw.map(n => ({ ...n, depth: 0, x: 0, y: 0, children: [], floatDelay: 0, w: 0, h: 0 }));
    nodes.forEach(n => byId.set(n.id, n));
    const root = nodes.find(n => n.kind === 'worldview') || nodes[0];
    // Эффективный родитель: episode-ноды (parentId=null) вешаем на цель их
    // самого сильного evidence-линка; прочие сироты — на корень.
    const parentOf = new Map<string, string | null>();
    for (const n of nodes) {
      if (n.parentId && byId.has(n.parentId)) { parentOf.set(n.id, n.parentId); continue; }
      if (n.id === root.id) { parentOf.set(n.id, null); continue; }
      if (n.kind === 'episode') {
        // evidence-линки идут episode → rel/trait (from=episode, to=цель).
        const ev = links.filter(l => l.fromId === n.id && l.kind === 'evidence').sort((a, b) => b.weight - a.weight)[0];
        parentOf.set(n.id, ev && byId.has(ev.toId) ? ev.toId : root.id);
      } else {
        parentOf.set(n.id, root.id);
      }
    }
    for (const n of nodes) { const p = parentOf.get(n.id); if (p && byId.has(p)) byId.get(p)!.children.push(n.id); }
    const depthOf = (id: string): number => { let d = 0; let cur = byId.get(id); while (cur) { const p = parentOf.get(cur.id); if (!p || !byId.has(p)) break; d++; cur = byId.get(p); } return d; };
    nodes.forEach(n => n.depth = depthOf(n.id));
    // Радиальная раскладка дерева (координаты 0..1000) с jitter — меньше симметрии.
    const CX = 500, CY = 500, R_STEP = 170;
    const hash = (text: string) => [...text].reduce((v, c) => ((v * 31 + c.charCodeAt(0)) >>> 0), 2166136261);
    const jitter = (id: string, depth: number) => {
      const amp = depth === 0 ? 0 : depth === 1 ? 26 : 40;
      const a = (hash(id) % 10000) / 10000 * Math.PI * 2;
      const b = (hash(id + ':y') % 10000) / 10000;
      return { dx: Math.cos(a) * amp * b, dy: Math.sin(a) * amp * b };
    };
    const layout = (node: MindNode, a0: number, a1: number, radius: number) => {
      const mid = (a0 + a1) / 2;
      const j = jitter(node.id, node.depth);
      node.x = CX + Math.cos(mid) * radius + j.dx;
      node.y = CY + Math.sin(mid) * radius + j.dy;
      node.floatDelay = (hash(node.id) % 1000) / 1000 * 6;
      // Габариты пилюли (совпадают с рендером): перенос на ≤2 строки.
      const fontSize = node.kind === 'worldview' ? 13 : node.depth === 1 ? 11 : 9;
      const maxChars = node.kind === 'worldview' ? 20 : node.depth === 1 ? 16 : 14;
      const padX = 11, padY = 8;
      const lines = wrapLabel(mindNodeLabel(node), maxChars);
      const longest = Math.max(...lines.map(l => l.length));
      node.w = longest * fontSize * 0.6 + padX * 2;
      node.h = lines.length * (fontSize + 3) + padY * 2;
      const kids = node.children.map(id => byId.get(id)!).filter(Boolean);
      if (!kids.length) return;
      const span = a1 - a0;
      kids.forEach((k, i) => layout(k, a0 + (span * i) / kids.length, a0 + (span * (i + 1)) / kids.length, radius + R_STEP));
    };
    layout(root, -Math.PI / 2, Math.PI * 1.5, 0);
    // Отталкивание: раздвигаем перекрывающиеся пилюли по их реальным габаритам.
    const GAP = 10;
    for (let iter = 0; iter < 8; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const minX = (a.w + b.w) / 2 + GAP;
          const minY = (a.h + b.h) / 2 + GAP;
          const overlapX = Math.abs(dx) < minX;
          const overlapY = Math.abs(dy) < minY;
          if (overlapX && overlapY) {
            // Выталкиваем по оси с меньшим перекрытием.
            const pushX = minX - Math.abs(dx);
            const pushY = minY - Math.abs(dy);
            if (pushX < pushY) {
              const s = dx >= 0 ? 1 : -1;
              a.x -= s * pushX / 2; b.x += s * pushX / 2;
            } else {
              const s = dy >= 0 ? 1 : -1;
              a.y -= s * pushY / 2; b.y += s * pushY / 2;
            }
          }
        }
      }
    }
    // Рёбра: иерархия + кросс-линки.
    const edges: { from: string; to: string; kind: string }[] = [];
    for (const n of nodes) { const p = parentOf.get(n.id); if (p && byId.has(p)) edges.push({ from: p, to: n.id, kind: 'hierarchy' }); }
    for (const l of links) if (byId.has(l.fromId) && byId.has(l.toId)) edges.push({ from: l.fromId, to: l.toId, kind: l.kind });
    return { nodes, edges, byId, parentOf };
  }, [JSON.stringify(interpretationGraph?.nodes), JSON.stringify(interpretationGraph?.links)]);
  const selectedAssociation = selectedAssociationTarget
    ? associationLinks.find(link => link.target === selectedAssociationTarget)
    : null;
  // The workspace must show the same complete memory as the selected-episode
  // panel. `subjective.summary` is intentionally only a brief; using it here
  // made the central card look as if its text had been cut off.
  const episodeCopy = selectedMemory?.text || "";
  const episodeCopySize = Math.max(11, Math.min(13, 13 - Math.ceil(episodeCopy.length / 520)));
  const interventionResult = session?.lastIntervention && session.memoryId === selectedMemory?.id ? session.lastIntervention : null;
  const formatAssociationNumber = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
  const selectedTagEvidence = selectedTags.length
    ? associationLinks.filter(link => link.tagLinks.some(tag => selectedTags.includes(tag))).flatMap(link => link.evidence || [])
    : [];
  const highlightTerms = selectedAssociation?.evidence?.length
    ? selectedAssociation.evidence
    : selectedTagEvidence.length
      ? [...new Set(selectedTagEvidence)]
    : [...new Set([
      selectedAssociation?.target,
      selectedTag ? tagLabel(selectedTag) : null,
    ].filter((term): term is string => Boolean(term && term.trim().length > 2)))];
  const renderEpisodeCopy = (text: string) => {
    if (!highlightTerms.length) return text;
    const expression = new RegExp(`(${highlightTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "giu");
    return text.split(expression).map((part, index) => highlightTerms.some(term => part.localeCompare(term, "ru", { sensitivity: "accent" }) === 0)
      ? <mark key={index}>{part}</mark>
      : part);
  };
  const control = async (
    command: "configure" | "settings" | "start" | "pause" | "resume" | "stop" | "intervene",
    payload: Record<string, unknown> = {},
  ) => {
    if (working || busy) return false;
    setWorking(true);
    setError(null);
    try {
      await api(`/api/scenario/laboratory/${asset.id}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: "PL-1", command, ...payload }),
      });
      await onRefresh();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setWorking(false);
    }
  };
  const saveSelection = () => control("configure", {
    memoryId,
    frame,
    focusTag,
    intensity,
  });
  if (!session) {
    return <main className="mental-chair-screen"><header><button onClick={onExit}>← {t('game.ui.laboratory')}</button><h1>{getDeviceName(asset.id, t)}</h1></header><p>{t('game.ui.sessionNotInitialized')}</p></main>;
  }
  return (
    <main className="mental-chair-screen">
      <header className="device-control-header">
        <button onClick={onExit}>← {t('game.ui.laboratory')}</button>
        <div><small>{t('game.ui.mentalCorrection')}</small><h1>{resident.name}</h1><p>{getDeviceName(asset.id, t)}</p></div>
        <div className={`device-status ${session.status}`}><i>●</i><span>{deviceStatusLabels[session.status]}</span></div>
      </header>
      <section className="mental-chair-layout">
        <aside className="mental-chair-subject">
          <div className="mental-chair-portrait"><CharacterPortrait id={resident.subjectId || resident.id} name={resident.name} portrait={resident.portrait} contexts={resident.contexts} state={resident.state} sleeping={resident.sleeping} /></div>
          <small>{t('game.ui.chairMode')}</small><strong>{t('game.ui.selectEpisode')}</strong>
          <p>{t('game.ui.chairIntro')}</p>
          <div className="mental-chair-metrics"><span><small>{t('game.ui.plasticity')}</small><b>{Math.round(Number(resident.state?.plasticity || 0))}</b></span><span><small>{t('game.ui.resourceMetric')}</small><b>{Math.round(Number(resident.state?.capacity || 0))}</b></span></div>
        </aside>
        <section className={`mental-chair-console${episodeWorkspace && selectedMemory ? " workspace" : ""}${!episodeWorkspace && episodeView === "map" ? " map-mode" : ""}`}>
          {episodeWorkspace && selectedMemory ? <>
            <header><button className="mental-work-back" onClick={() => { setEpisodeWorkspace(false); setSelectedTag(null); setSelectedTags([]); setSelectedAssociationTarget(null); }}>{t('game.ui.backToEpisodes')}</button><b>{t('game.ui.workWithEpisode')}</b></header>
            <div className="mental-work-canvas">
              <div className="mental-association-map" aria-label={t('game.ui.associationMap')}>
                <article className="mental-episode-core" style={{ "--episode-copy-size": `${episodeCopySize}px` } as any}><small>{t('game.ui.memoryCenter')}</small><b>{selectedMemory.title}</b><p>{renderEpisodeCopy(episodeCopy)}</p></article>
                <svg className="mental-association-edges" viewBox="0 0 100 100" preserveAspectRatio="none">{memoryGraph.edges.map((edge, index) => { const from = memoryGraph.byId.get(edge.from); const to = memoryGraph.byId.get(edge.to); if (!from || !to) return null; const selected = selectedAssociationTarget === edge.target || selectedTags.some(tag => edge.to === `tag:${tag}`); const segments = clipSegments(from.x, from.y, to.x, to.y); return segments.map((seg, segIndex) => <g key={`${edge.from}:${edge.to}:${index}:${segIndex}`} className={selected ? "selected" : ""}><line className="hitbox" x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} onClick={() => { setSelectedAssociationTarget(edge.target); setSelectedTag(null); setSelectedTags([]); }} /><line className="visible" x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} style={{ "--association-strength": edge.strength, "--association-valence": edge.valence } as any} /></g>); })}</svg>
                {memoryGraph.nodes.map(node => <button key={node.id} className={`mental-association-node ${node.kind}${(node.kind === 'tag' ? selectedTags.includes(node.id.slice(4)) : selectedAssociationTarget === node.label) ? " selected" : ""}`} style={{ left: `${node.x}%`, top: `${node.y}%`, "--node-degree": node.degree, "--node-strength": node.strength, "--association-valence": node.valence / Math.max(node.degree, 1) } as any} onClick={() => { if (node.kind === 'tag') { const tag = node.id.slice(4); const nextTags = selectedTags.includes(tag) ? selectedTags.filter(item => item !== tag) : [...selectedTags, tag]; setSelectedTags(nextTags); setSelectedTag(nextTags.at(-1) || null); setSelectedAssociationTarget(null); } else { setSelectedAssociationTarget(node.label); setSelectedTag(null); setSelectedTags([]); } }}><b>{node.label}</b></button>)}
              </div>
              <section className="mental-intervention-panel">
                <header><small>{t('game.ui.suggestion')}</small><b>{selectedAssociationTarget ? t('game.ui.selectedLink').replace('{target}', selectedAssociationTarget) : selectedTags.length > 1 ? t('game.ui.newBundle').replace('{tags}', selectedTags.map(tagLabel).join(' · ')) : selectedTag ? t('game.ui.selectedTag').replace('{tag}', tagLabel(selectedTag)) : t('game.ui.selectTagOrLink')}</b></header>
                <textarea value={intervention} onChange={event => setIntervention(event.target.value)} placeholder={selectedTags.length || selectedAssociationTarget ? t('game.ui.enterSuggestion') : t('game.ui.selectTagFirst')} disabled={!selectedTags.length && !selectedAssociationTarget} />
                <button disabled={(!selectedTags.length && !selectedAssociationTarget) || !intervention.trim() || working} onClick={async () => { if (await control("intervene", { targetLabel: selectedAssociation?.target, tags: selectedTags, unlinkTags: selectedAssociation?.manual ? selectedAssociation.tagLinks : undefined, intervention })) { setIntervention(""); await onRefresh(); } }}>{working ? t('game.ui.forming') : selectedAssociation?.manual ? t('game.ui.breakBundle') : t('game.ui.runSuggestion')}</button>
              </section>
              {interventionResult && <section className={`mental-intervention-result ${interventionResult.affected ? "applied" : "missed"}`}>
                <header><small>{t('game.ui.lastSuggestionResult')}</small><b>{interventionResult.affected ? t('game.ui.linkChanged').replace('{target}', interventionResult.targetLabel) : t('game.ui.linkNotFound').replace('{target}', interventionResult.targetLabel)}</b></header>
                {interventionResult.changes.map(change => <p key={change.target}><b>{change.target}</b>: {t('game.ui.estimate')} {formatAssociationNumber(change.before.valence)} → {formatAssociationNumber(change.after.valence)} · {t('game.ui.strength')} {change.before.strength.toFixed(2)} → {change.after.strength.toFixed(2)} · {t('game.ui.reaction')} {change.after.expectation}</p>)}
                {!interventionResult.affected && <p>{t('game.ui.resuggestionMiss')}</p>}
                {interventionResult.affected > 0 && <p>{t('game.ui.suggestionApplied')}</p>}
              </section>}
            </div>
            {error && <p className="mental-chair-error">{error}</p>}
          </> : <>
          <header><small>{t('game.ui.episodeFromMemory')}</small><b>{selectedMemory ? t('game.ui.selected') : t('game.ui.notSelected')}</b><nav className="mental-view-toggle"><button className={episodeView === "map" ? "active" : ""} onClick={() => setEpisodeView("map")}>Карта</button><button className={episodeView === "list" ? "active" : ""} onClick={() => setEpisodeView("list")}>Список</button></nav></header>
          {episodeView === "map" ? (() => {
            // Концепт: все ноды всегда видны; зум масштабирует, а не скрывает.
            // Детализация = подписи: листья на отдалении — точки, при приближении — пилюли.
            const crossEdges = mindMap.edges.filter(e => e.kind !== 'hierarchy' && (e.from === selectedMindNode || e.to === selectedMindNode));
            const hierEdges = mindMap.edges.filter(e => e.kind === 'hierarchy');
            const labelScale = 1.3;
            const zoomAt = (cx: number, cy: number, factor: number) => setMindView(prev => {
              const scale = Math.max(0.4, Math.min(3, prev.scale * factor));
              const k = scale / prev.scale;
              return { scale, x: cx - (cx - prev.x) * k, y: cy - (cy - prev.y) * k };
            });
            return (
            <div
              className="mental-mindmap"
              aria-label="Карта интерпретаций"
              onWheel={(event) => {
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                zoomAt(event.clientX - rect.left, event.clientY - rect.top, event.deltaY < 0 ? 1.15 : 0.87);
              }}
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                mindDragRef.current = { startX: event.clientX, startY: event.clientY, origX: mindView.x, origY: mindView.y, origScale: mindView.scale, moved: false };
              }}
              onMouseMove={(event) => {
                const drag = mindDragRef.current;
                if (!drag) return;
                const dx = event.clientX - drag.startX;
                const dy = event.clientY - drag.startY;
                if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
                if (drag.moved) setMindView(prev => ({ ...prev, x: drag.origX + dx, y: drag.origY + dy }));
              }}
              onMouseUp={() => { mindDragRef.current = null; }}
              onMouseLeave={() => { mindDragRef.current = null; }}
            >
              <svg className="mental-mindmap-svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet">
                <g transform={`translate(${mindView.x} ${mindView.y}) scale(${mindView.scale})`}>
                  {hierEdges.map((edge, i) => {
                    const from = mindMap.byId.get(edge.from); const to = mindMap.byId.get(edge.to);
                    if (!from || !to) return null;
                    return <line key={`h${i}`} className="mind-edge hierarchy" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
                  })}
                  {crossEdges.map((edge, i) => {
                    const from = mindMap.byId.get(edge.from); const to = mindMap.byId.get(edge.to);
                    if (!from || !to) return null;
                    const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
                    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
                    const nx = -dy / len * 40, ny = dx / len * 40;
                    return <path key={`c${i}`} className="mind-edge cross" d={`M ${from.x} ${from.y} Q ${mx + nx} ${my + ny} ${to.x} ${to.y}`} />;
                  })}
                  {mindMap.nodes.map(node => {
                    const selected = selectedMindNode === node.id;
                    const label = mindNodeLabel(node);
                    // Пилюля: ширина по тексту. Листья (depth>=2) на отдалении — точки.
                    const isLeaf = node.depth >= 2;
                    const showLabel = !isLeaf || mindView.scale >= labelScale;
                    const fontSize = node.kind === 'worldview' ? 13 : node.depth === 1 ? 11 : 9;
                    const maxChars = node.kind === 'worldview' ? 20 : node.depth === 1 ? 16 : 14;
                    const padX = 11, padY = 8;
                    const lines = wrapLabel(label, maxChars);
                    const longest = Math.max(...lines.map(l => l.length));
                    const w = showLabel ? longest * fontSize * 0.6 + padX * 2 : 12;
                    const lineHeight = fontSize + 3;
                    const h = showLabel ? lines.length * lineHeight + padY * 2 : 12;
                    // Вертикальное центрирование: явный y для каждой строки.
                    const firstY = -(lines.length - 1) * lineHeight / 2;
                    return (
                      <g key={node.id} className={`mind-node ${node.kind}${node.status === 'dirty' ? ' dirty' : ''}${selected ? ' selected' : ''}${showLabel ? '' : ' dot'}`} transform={`translate(${node.x} ${node.y})`} style={{ "--float-delay": `${node.floatDelay}s`, "--float-amp": `${node.depth === 0 ? 0 : node.depth === 1 ? 2 : 4}px` } as any} onClick={() => { if (mindDragRef.current?.moved) return; setSelectedMindNode(selected ? null : node.id); }} onDoubleClick={(event) => { event.stopPropagation(); zoomAt(node.x, node.y, 1.6); }}>
                        <g className="mind-node-float">
                          <rect className="mind-node-pill" x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} />
                          {showLabel && <text className="mind-node-label" textAnchor="middle" dominantBaseline="central" fontSize={fontSize}>
                            {lines.map((line, i) => <tspan key={i} x={0} y={firstY + i * lineHeight}>{line}</tspan>)}
                          </text>}
                        </g>
                      </g>
                    );
                  })}
                </g>
              </svg>
              <div className="mental-mindmap-controls">
                <button onClick={() => zoomAt(500, 500, 1.25)}>+</button>
                <button onClick={() => zoomAt(500, 500, 0.8)}>−</button>
                <button onClick={() => setMindView({ x: 0, y: 0, scale: 1 })}>⟲</button>
              </div>
              {selectedMindNode && (() => {
                const node = mindMap.byId.get(selectedMindNode);
                if (!node) return null;
                return <section className="mental-mindmap-detail"><header><small>{node.kind}</small><b>{mindNodeLabel(node)}</b></header><p>{node.content || "Интерпретация ещё не сформирована."}</p></section>;
              })()}
            </div>
            );
          })() : (
          <div className="mental-memory-list">
            {memories.length ? visibleMemories.map((memory) => (
              <button key={memory.id} className={memory.id === memoryId ? "selected" : ""} onClick={() => { setMemoryId(memory.id); setFocusTag(memory.tags[0] || null); setSelectedTag(null); setSelectedTags([]); setSelectedAssociationTarget(null); }}>
                <b>{memory.title}</b><small>{memory.tags.slice(0, 3).map(tag => memory.tagLabels?.[tag] || `${t('game.ui.themePrefix')} ${tag.replace(/[_-]+/g, " ")}`).join(" · ") || t('game.ui.episode')}{memory.atomCount && memory.atomCount > 1 ? ` · ${memory.atomCount} ${t('game.ui.moments')}` : ""}</small>
              </button>
            )) : <p>{t('game.ui.noEpisodesForProcessing')}</p>}
          </div>
          )}
          {episodeView === "list" && memories.length > memoryPageSize && <nav className="mental-memory-pages" aria-label={t('game.ui.episodePages')}><button disabled={memoryPage === 0} onClick={() => setMemoryPage(page => Math.max(0, page - 1))}>←</button><span>{memoryPage + 1} / {memoryPages}</span><button disabled={memoryPage >= memoryPages - 1} onClick={() => setMemoryPage(page => Math.min(memoryPages - 1, page + 1))}>→</button></nav>}
          {episodeView === "list" && <section className={`mental-memory-detail ${selectedMemory ? "selected" : ""}`}>
            {selectedMemory ? <><EpisodeMemoryCollage memory={selectedMemory} subjectId={resident.subjectId || resident.id} /><header><small>{t('game.ui.selectedEpisode')}</small><b>{selectedMemory.title}</b></header><p>{selectedMemory.text}</p></> : <p>{t('game.ui.selectCardToRead')}</p>}
          </section>}
          <footer className="mental-chair-actions mental-selection-actions">
            <button disabled={!selectedMemory || !focusTag || working || busy} onClick={async () => { if (await saveSelection()) setEpisodeWorkspace(true); }}>{t('game.ui.workEpisode')}</button>
            <button className="secondary" onClick={onRelease}>{t('game.ui.releaseShort')}</button>
          </footer>
          {error && <p className="mental-chair-error">{error}</p>}
          </>}
        </section>
      </section>
    </main>
  );
}

function DeviceControlScreen({
  asset,
  resident,
  clock,
  busy,
  onRefresh,
  onRelease,
  onExit,
}: {
  asset: LabAsset;
  resident: Resident;
  clock: Scenario["clock"];
  busy: boolean;
  onRefresh: () => Promise<void>;
  onRelease?: () => Promise<void>;
  onExit: () => void;
}) {
  const { t } = useI18n();
  const session = asset.metadata?.deviceSession;
  const machineRunning = session?.status === "running";
  const [lines, setLines] = useState<CharacterChatLine[]>([]);
  const [text, setText] = useState("");
  const [working, setWorking] = useState(false);
  const [chatWaiting, setChatWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operatorNote, setOperatorNote] = useState("");
  const [peakEffect, setPeakEffect] = useState<{ key: string } | null>(null);
  const seenDischargeEventRef = useRef<number | null>(null);
  const subjectId = resident.subjectId || resident.id;
  const state = resident.state || {};
  const contextIds = new Set(
    (resident.contexts || []).map((context) => context.id),
  );
  const loadDeviceChat = useCallback(
    () =>
      api(`/api/characters/${subjectId}/chat?limit=100`).then((data) => {
        const restored = collapseRepeatedChatActions(
          (data.messages || []).map((message: any) =>
            chatLineFromStoredMessage(message, resident.name, subjectId),
          ),
        );
        // Merge, never replace. A just-sent player message is appended to the
        // durable history only inside the deferred LLM job, so a history reload
        // that races that job would otherwise wipe the optimistic line and make
        // the player's own message flash out and back in.
        setLines((current) => {
          const keyFor = (line: CharacterChatLine) =>
            `${line.actorId || ""}\u0000${line.speaker}\u0000${line.text}\u0000${line.context || ""}\u0000${line.action ? 1 : 0}`;
          const restoredKeys = new Set(restored.map(keyFor));
          const newer = current.filter(
            (line) =>
              line.id.startsWith("stream:") || !restoredKeys.has(keyFor(line)),
          );
          return collapseRepeatedChatActions([...restored, ...newer]).slice(-100);
        });
      }),
    [resident.name, subjectId],
  );

  useEffect(() => {
    loadDeviceChat().catch((e: any) => setError(e.message));
  }, [loadDeviceChat]);
  useEffect(() => {
    if (session?.status !== "running") return;
    const timer = window.setInterval(() => {
      loadDeviceChat().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [loadDeviceChat, session?.status]);
  const machineAudioMode =
    session?.status !== "running"
      ? "sex_machine_stop"
      : session.phase === "peak"
        ? "sex_machine_peak"
        : session.intensity >= 60
          ? "sex_machine_fast"
          : "sex_machine_slow";
  useEffect(() => {
    void gameAudio.playExclusiveAction(machineAudioMode);
  }, [machineAudioMode]);
  useEffect(
    () => () => {
      void gameAudio.playAction("sex_machine_stop");
    },
    [],
  );
  useEffect(() => {
    const eventId = session?.lastDischargeEvent?.id;
    // Opening a machine must not replay its old result. From this point on,
    // each new engine event is rendered once, regardless of polling cadence.
    if (seenDischargeEventRef.current === null) {
      seenDischargeEventRef.current = eventId || 0;
      return;
    }
    if (!eventId) return;
    if (seenDischargeEventRef.current === eventId) return;
    seenDischargeEventRef.current = eventId;
    setPeakEffect({ key: crypto.randomUUID() });
    void gameAudio.playReaction(resident.name, "climax", 1);
  }, [resident.name, session?.lastDischargeEvent?.id]);
  useEffect(() => {
    if (!peakEffect) return;
    const timer = window.setTimeout(() => setPeakEffect(null), 5300);
    return () => window.clearTimeout(timer);
  }, [peakEffect?.key]);

  if (!session)
    return (
      <main className="device-control-screen">
        <header>
          <button onClick={onExit}>← {t('game.ui.laboratory')}</button>
          <h1>{getDeviceName(asset.id, t)}</h1>
        </header>
        <p>{t('game.ui.deviceSessionNotInitialized')}</p>
      </main>
    );

  const slug =
    subjectId === "S-AV-01"
      ? "mira"
      : subjectId === "NPC-LAB-01"
        ? "iona"
        : subjectId === "NPC-CAND-01"
          ? "nika"
          : subjectId === "NPC-CAND-SUMI"
            ? "sumi"
            : subjectId === "NPC-CAND-GEN-02"
              ? "eli"
              : subjectId === "NPC-CAND-GEN-03"
                ? "rin"
                : subjectId === "NPC-CAND-GEN-04"
                  ? "mai"
                  : subjectId === "NPC-CAND-KATE"
                    ? "kate"
                    : subjectId === "NPC-RIN-01"
                      ? "rin"
                      : subjectId.toLowerCase();
  const portraitEmotion = resolvePortraitEmotion({
    behavioralState: state.behavioralState,
    reaction: state.reaction || state.lastReaction,
    transitions: state.transitions,
    state: {
      tension: state.tension,
      capacity: state.capacity,
      attitude: state.attitude,
      openness: state.openness,
      plasticity: state.plasticity,
      contexts: (resident.contexts || []).map((context) => ({
        actionId: context.id,
      })),
    },
  });
  const negativeEmotions = new Set<PortraitEmotion>([
    "angry",
    "distressed",
    "fear",
    "pain",
    "sad",
  ]);
  const positiveEmotions = new Set<PortraitEmotion>([
    "aroused",
    "blush",
    "pleasure",
  ]);
  const affect: VisualAffect =
    portraitEmotion === "climax"
      ? "climax"
      : contextIds.has("effect_subspace") ||
          portraitEmotion === "afterglow" ||
          portraitEmotion === "subspace"
        ? "subspace"
        : portraitEmotion === "high_negative" ||
            (negativeEmotions.has(portraitEmotion) &&
              Number(state.tension || 0) >= 55)
          ? "high_negative"
          : portraitEmotion === "high_positive" ||
              (positiveEmotions.has(portraitEmotion) &&
                Number(state.tension || 0) >= 55)
            ? "high_positive"
            : portraitEmotion === "guarded" ||
                Number(state.attitude || 0) < 45 ||
                negativeEmotions.has(portraitEmotion)
              ? "guarded"
              : "receptive";
  const stimulationMode = session.stimulationMode || "vaginal";
  const imagePath = sexMachineAvatarPath(slug, stimulationMode, affect, machineRunning);
  const control = async (
    command: "settings" | "start" | "adjust" | "pause" | "resume" | "stop",
    payload: Record<string, unknown> = {},
  ) => {
    if (working || busy) return;
    setWorking(true);
    setError(null);
    try {
      await api(`/api/scenario/laboratory/${asset.id}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: "PL-1", command, ...payload }),
      });
      await onRefresh();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setWorking(false);
    }
  };
  const sexualTargetModes = [
    ["manual", "Контроль", "Постоянная заданная мощность", "Низкий риск"],
    ["edge", "На грани", "Удерживать возле порога", "Точный контроль"],
    [
      "positive",
      "Позитивный",
      "Повышать удовольствие и принятие",
      "Мягкое воздействие",
    ],
    [
      "negative",
      "Негативный",
      "Поддерживать стрессовую реакцию",
      "Высокий стресс",
    ],
    ["mixed", "Смешанный", "Чередовать характер воздействия", "Непредсказуемо"],
    [
      "orgasm",
      "Разрядка",
      "Последовательно доводить до разрядки",
      "Пиковая нагрузка",
    ],
    [
      "exhaustion",
      "Истощение",
      "Работать до резерва выносливости",
      "Критический риск",
    ],
  ] as const;
  const ticklingTargetModes = [
    ["tickle_steady", "Ровная щекотка", "Ровно вести щётки по подошвам без резких смен", "Низкий риск"],
    ["tickle_tease", "Дразнящие серии", "Чередовать короткие серии и передышки, не давая привыкнуть", "Умеренная нагрузка"],
    ["tickle_disrupt", "Срыв ритма", "Непредсказуемо менять участок и темп щекотки", "Высокая реактивность"],
    ["tickle_endurance", "Предел выносливости", "Продолжать до заданного резерва, не переходя его", "Критический риск"],
  ] as const;
  const targetPresets: Record<
    NonNullable<DeviceSession["targetMode"]>,
    Pick<
      DeviceSession,
      | "intensity"
      | "rhythm"
      | "orgasmPolicy"
      | "valencePolicy"
      | "maxTension"
      | "minCapacity"
      | "stopAtReserve"
    >
  > = {
    manual: {
      intensity: 40,
      rhythm: "steady",
      orgasmPolicy: "allow",
      valencePolicy: "neutral",
      maxTension: 95,
      minCapacity: 15,
      stopAtReserve: false,
    },
    edge: {
      intensity: 55,
      rhythm: "wave",
      orgasmPolicy: "deny",
      valencePolicy: "adaptive",
      maxTension: 88,
      minCapacity: 25,
      stopAtReserve: false,
    },
    positive: {
      intensity: 45,
      rhythm: "wave",
      orgasmPolicy: "allow",
      valencePolicy: "positive",
      maxTension: 90,
      minCapacity: 25,
      stopAtReserve: false,
    },
    negative: {
      intensity: 65,
      rhythm: "pulse",
      orgasmPolicy: "deny",
      valencePolicy: "negative",
      maxTension: 95,
      minCapacity: 15,
      stopAtReserve: false,
    },
    mixed: {
      intensity: 60,
      rhythm: "random",
      orgasmPolicy: "allow",
      valencePolicy: "mixed",
      maxTension: 95,
      minCapacity: 15,
      stopAtReserve: false,
    },
    orgasm: {
      intensity: 75,
      rhythm: "pulse",
      orgasmPolicy: "force",
      valencePolicy: "adaptive",
      maxTension: 100,
      minCapacity: 15,
      stopAtReserve: false,
    },
    exhaustion: {
      intensity: 55,
      rhythm: "steady",
      orgasmPolicy: "allow",
      valencePolicy: "adaptive",
      maxTension: 95,
      minCapacity: 5,
      stopAtReserve: true,
    },
    tickle_steady: {
      intensity: 35,
      rhythm: "steady",
      orgasmPolicy: "deny",
      valencePolicy: "neutral",
      maxTension: 60,
      minCapacity: 30,
      stopAtReserve: false,
    },
    tickle_tease: {
      intensity: 45,
      rhythm: "wave",
      orgasmPolicy: "deny",
      valencePolicy: "positive",
      maxTension: 72,
      minCapacity: 25,
      stopAtReserve: false,
    },
    tickle_disrupt: {
      intensity: 62,
      rhythm: "random",
      orgasmPolicy: "deny",
      valencePolicy: "negative",
      maxTension: 82,
      minCapacity: 20,
      stopAtReserve: false,
    },
    tickle_endurance: {
      intensity: 52,
      rhythm: "pulse",
      orgasmPolicy: "deny",
      valencePolicy: "negative",
      maxTension: 90,
      minCapacity: 5,
      stopAtReserve: true,
    },
  };

  const send = async () => {
    const message = text.trim();
    if (!message || working) return;
    setText("");
    setWorking(true);
    setChatWaiting(true);
    setError(null);
    setLines((previous) =>
      appendCharacterChatLines(previous, [
        {
          speaker: "Калибратор",
          role: "calibrator",
          text: message,
          context: `${asset.name}: фиксированная платформа`,
        },
      ]),
    );
    try {
      const data = await api("/api/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          playerId: "PL-1",
          sceneId: "scene_lab_calibrator",
          pointId: "systemic",
          presetId: "verbal_pressure",
          textMessage: message,
          interactionContext: `${asset.name}: фиксированная платформа`,
          intensity: 1,
          skipLLM: false,
          deferLLM: true,
          llmMode: "scene_dialogue",
          skipImageGen: true,
        }),
      });
      void resolveDeferredReply(data)
        .then((replyData) => {
          void loadDeviceChat();
          if (replyData.llmError) setError(replyData.llmError);
        })
        .catch((e) => setError(e.message))
        .finally(() => setChatWaiting(false));
      setWorking(false);
      void onRefresh();
    } catch (e: any) {
      setError(e.message);
      setChatWaiting(false);
    } finally {
      setWorking(false);
    }
  };
  const targetModes = stimulationMode === "tickling"
    ? ticklingTargetModes
    : sexualTargetModes;
  const activeMode =
    targetModes.find((mode) => mode[0] === (session.targetMode || "manual")) ||
    targetModes[0];
  const activeModeIndex = Math.max(
    0,
    targetModes.findIndex((mode) => mode[0] === activeMode[0]),
  );
  const selectAdjacentMode = (offset: number) => {
    const nextIndex =
      (activeModeIndex + offset + targetModes.length) % targetModes.length;
    const [targetMode] = targetModes[nextIndex];
    return control("settings", {
      targetMode,
      ...targetPresets[targetMode],
      orgasmTargetCount: targetMode === "orgasm" ? session.orgasmTargetCount || 1 : null,
    });
  };
  const selectStimulation = (nextMode: "vaginal" | "anal" | "tickling") =>
    control("settings", {
      stimulationMode: nextMode,
      ...(nextMode === "tickling"
        ? { targetMode: "tickle_steady", ...targetPresets.tickle_steady, orgasmTargetCount: null }
        : String(session.targetMode || "").startsWith("tickle_")
          ? { targetMode: "manual", ...targetPresets.manual, orgasmTargetCount: null }
          : {}),
    });
  const stopAfterMinutes = Math.max(0, Number(session.stopAfterMinutes || 0));
  const orgasmTargetCount = Math.max(1, Number(session.orgasmTargetCount || 1));
  const rhythm = session.rhythm || "steady";
  const waveformKey = session.targetMode || rhythm;
  const waveformPaths: Record<string, string> = {
    manual:
      "M0 12 C5 8 10 8 15 12 S25 16 30 12 S40 8 45 12 S55 16 60 12 S70 8 75 12 S85 16 90 12 S100 8 105 12 S115 16 120 12 S125 9 128 12",
    edge:
      "M0 12 C7 11 10 8 14 6 C18 4 21 4 24 7 C27 10 29 16 34 17 C39 18 42 12 46 8 C50 4 54 3 58 6 C62 10 63 18 69 19 C75 19 78 10 82 6 C86 2 91 3 95 7 C99 12 100 20 107 20 C114 20 117 8 121 5 C124 3 126 6 128 12",
    positive:
      "M0 12 C6 12 8 7 13 7 C18 7 19 14 24 14 C29 14 31 5 36 5 C41 5 42 16 48 16 C54 16 55 3 61 3 C67 3 68 18 75 18 C82 18 83 5 89 5 C95 5 96 16 102 16 C108 16 110 7 115 7 C120 7 122 12 128 12",
    negative:
      "M0 12 L8 12 L11 4 L14 20 L18 8 L22 17 L26 3 L30 21 L35 11 L43 11 L47 2 L51 22 L56 7 L61 18 L66 4 L70 20 L75 12 L83 12 L87 3 L91 21 L96 6 L101 18 L106 4 L110 20 L115 12 L128 12",
    mixed:
      "M0 12 C5 4 10 4 15 12 L22 18 L29 7 C35 2 39 14 45 15 L53 5 L59 20 L67 10 C73 6 78 7 83 13 L91 19 L98 4 L106 16 L114 8 C120 5 124 10 128 12",
    orgasm:
      "M0 12 C5 10 8 10 12 12 S19 14 24 12 S31 8 36 12 S43 17 48 12 S55 5 60 12 S67 20 72 12 S79 2 84 12 S91 22 96 12 S103 0 108 12 S115 23 120 12 S125 2 128 12",
    exhaustion:
      "M0 12 L7 5 L13 19 L20 3 L27 21 L34 6 L41 18 L48 8 L55 16 L62 9 L69 15 L76 10 L83 14 L90 11 L97 13 L104 11 L111 13 L118 12 L128 12",
    tickle_steady:
      "M0 12 C6 8 12 8 18 12 S30 16 36 12 S48 8 54 12 S66 16 72 12 S84 8 90 12 S102 16 108 12 S120 8 128 12",
    tickle_tease:
      "M0 12 C7 12 9 7 14 7 C19 7 20 15 26 15 L38 15 C43 15 45 8 51 8 C57 8 58 16 65 16 L78 16 C83 16 85 6 92 6 C99 6 100 15 108 15 L128 15",
    tickle_disrupt:
      "M0 12 L7 7 L16 18 L25 4 L35 15 L43 9 L52 20 L62 5 L71 16 L81 3 L91 18 L102 6 L112 15 L121 9 L128 12",
    tickle_endurance:
      "M0 12 L11 12 L15 4 L19 20 L24 12 L36 12 L40 5 L44 19 L49 12 L61 12 L65 6 L69 18 L74 12 L86 12 L90 7 L94 17 L99 12 L111 12 L115 8 L119 16 L128 12",
    steady:
      "M0 12 C6 5 12 5 18 12 S30 19 36 12 S48 5 54 12 S66 19 72 12 S84 5 90 12 S102 19 108 12 S120 5 126 12",
    pulse:
      "M0 12 L14 12 L18 3 L22 21 L26 12 L42 12 L46 3 L50 21 L54 12 L70 12 L74 3 L78 21 L82 12 L98 12 L102 3 L106 21 L110 12 L126 12",
    wave:
      "M0 12 C8 3 16 3 24 12 S40 21 48 12 S64 3 72 12 S88 21 96 12 S112 3 120 12 S124 15 128 12",
    random:
      "M0 12 L9 6 L17 17 L28 4 L37 14 L48 9 L59 20 L70 5 L81 15 L92 3 L104 18 L115 8 L128 12",
  };
  const rhythmWavePath = waveformPaths[waveformKey] || "M0 12 H128";
  const machineEngaged = machineRunning || session.status === "paused";
  const tension = clampMetric(Number(state.tension || 0));
  const capacity = clampMetric(Number(state.capacity || 0));
  const maxTension = session.maxTension ?? 95;
  const minCapacity = session.minCapacity ?? 15;
  const power = clampMetric(session.intensity) / 100;
  const tenMinuteHours = 10 / 60;
  const projectedTension = clampMetric(
    Math.min(
      maxTension,
      tension +
        (6 + 16 * power) *
          tenMinuteHours *
          ((session.targetMode || "manual") === "negative" ? 1.2 : 1),
    ),
  );
  const projectedTickIntensity = 14 + 72 * power;
  const projectedDiscomfort = stimulationMode === "tickling"
    ? projectedTickIntensity * ((session.targetMode || "") === "tickle_tease" ? .22 : .43)
    : (session.targetMode || "manual") === "negative"
    ? projectedTickIntensity * .38
    : (session.targetMode || "manual") === "exhaustion"
      ? projectedTickIntensity * .24
      : projectedTickIntensity * .06;
  const projectedCapacityLoss = estimateCapacityLoss({
    experiencedIntensity: projectedTickIntensity,
    pleasure: Math.max(0, projectedTickIntensity - projectedDiscomfort) * (stimulationMode === "tickling" ? .3 : .72),
    discomfort: projectedDiscomfort,
    tension,
    deltaTime: 1,
  }, DEFAULT_CONFIG.formulas.applyLearning) * 10;
  const projectedCapacity = clampMetric(Math.max(minCapacity, capacity - projectedCapacityLoss));
  const tensionRisk = Math.max(0, tension / Math.max(1, maxTension));
  const capacityRisk = Math.max(
    0,
    (100 - capacity) / Math.max(1, 100 - minCapacity),
  );
  const risk = clampMetric(Math.max(tensionRisk, capacityRisk) * 100);
  const elapsed =
    session.startedAtTick === null
      ? 0
      : Math.max(0, clock.totalMinutes - session.startedAtTick);
  const phaseLabel =
    session.phase === "peak"
      ? t('game.ui.phaseThreshold')
      : session.phase === "intense"
        ? t('game.ui.phaseHold')
        : t('game.ui.phaseRamp');
  const systemNote =
    operatorNote ||
    (risk >= 85
      ? t('game.ui.systemNoteNearLimit')
      : projectedTension >= maxTension
        ? t('game.ui.systemNoteNextCycleLimit')
        : t('game.ui.systemNoteNextCycle')
            .replace('{tension}', String(Math.max(0, Math.round(projectedTension - tension))))
            .replace('{capacity}', String(Math.round(projectedCapacity - capacity))));
  return (
    <main className="device-control-screen sex-machine-screen">
      <header className="device-control-header">
        <button onClick={onExit}>← {t('game.ui.laboratory')}</button>
        <div>
          <small>{t('game.ui.sexMachineFixedPlatform')}</small>
          <h1>{resident.name}</h1>
          <p>{getDeviceName(asset.id, t)}</p>
        </div>
        <div className={`device-status ${session.status}`}>
          <i>●</i>
          <span>{deviceStatusLabels[session.status]}</span>
        </div>
      </header>
      <section className="device-control-layout">
        <div className="device-visual-panel">
          <div
            className={`device-avatar-frame sex-machine-effect-host ${machineRunning ? `running phase-${session.phase}` : ""}`}
          >
            <img
              src={imagePath}
              alt={`${resident.name}: фиксированная платформа`}
            />
            {machineRunning && (
              <GameSustainedEffect
                actionId="act_start_penetration"
                label={activeMode[1]}
                contained
                minutes={Math.max(
                  0,
                  Math.floor(
                    clock.totalMinutes -
                      (session.startedAtTick || clock.totalMinutes),
                  ),
                )}
              />
            )}
            {peakEffect && (
              <GamePeakEffect
                kind="discharge"
                effectKey={peakEffect.key}
                characterSlug={slug}
                actionImage={imagePath}
              />
            )}
          </div>
        </div>
        <section className="sex-machine-console">
          <section
            className={`sex-machine-live ${machineRunning ? "running" : ""}`}
          >
            <header>
              <div>
                <small>{t('game.ui.currentProtocol')}</small>
                <strong>{activeMode[1]}</strong>
              </div>
              <span>
                <i />
                {machineRunning
                  ? t('game.ui.activeState')
                  : session.status === "paused"
                    ? t('game.ui.paused')
                    : t('game.ui.readyState')}
              </span>
            </header>
            <div className="sex-machine-readout">
              <span>
                <small>{t('game.ui.rhythm')}</small>
                <b>{session.rhythm === "pulse" ? t('game.ui.rhythmPulse') : session.rhythm === "wave" ? t('game.ui.rhythmWave') : session.rhythm === "random" ? t('game.ui.rhythmRandom') : t('game.ui.rhythmSteady')}</b>
              </span>
              <span>
                <small>{t('game.ui.limit')}</small>
                <b>{session.maxTension ?? 95}</b>
              </span>
              <span>
                <small>{t('game.ui.reserve')}</small>
                <b>{session.minCapacity ?? 15}</b>
              </span>
            </div>
            <div
              className={`sex-machine-rhythm rhythm-${rhythm} protocol-${waveformKey} ${machineRunning ? "running" : ""}`}
              aria-label={t('game.ui.rhythmVisualization').replace('{rhythm}', rhythm)}
            >
              <small>{t('game.ui.rhythmSignal')}</small>
              <svg viewBox="0 0 128 24" preserveAspectRatio="none" aria-hidden="true">
                <path className="baseline" d="M0 12H128" />
                <path className="wave" d={rhythmWavePath} pathLength={100} />
              </svg>
            </div>
            <div className="sex-machine-power">
              <header>
                <span>{t('game.ui.impactPower')}</span>
                <b>
                  {session.intensity}
                  <small>%</small>
                </b>
              </header>
              <div>
                {Array.from({ length: 10 }, (_, index) => (
                  <button
                    aria-label={t('game.ui.intensityLabel').replace('{n}', String((index + 1) * 10))}
                    className={
                      index < Math.ceil(session.intensity / 10) ? "active" : ""
                    }
                    disabled={working}
                    key={index}
                    onClick={() =>
                      control("adjust", { intensity: (index + 1) * 10 })
                    }
                  >
                    <i />
                  </button>
                ))}
              </div>
            </div>
          </section>
          {!machineEngaged && (
            <section className="sex-machine-protocols">
              <header>
                <small>{t('game.ui.selectProtocol')}</small>
              </header>
              <div className="sex-machine-protocol-selector">
                <button
                  aria-label={t('game.ui.previousProtocol')}
                  disabled={working}
                  onClick={() => selectAdjacentMode(-1)}
                >
                  ‹
                </button>
                <div>
                  <small>{t('game.ui.cartridge').replace('{cur}', String(activeModeIndex + 1).padStart(2, "0")).replace('{total}', String(targetModes.length).padStart(2, "0"))}</small>
                  <div className="sex-machine-protocol-title">
                    <strong>{activeMode[1]}</strong>
                    <span>{activeMode[3]}</span>
                  </div>
                  <p>{activeMode[2]}</p>
                </div>
                <button
                  aria-label={t('game.ui.nextProtocol')}
                  disabled={working}
                  onClick={() => selectAdjacentMode(1)}
                >
                  ›
                </button>
              </div>
              <section className="sex-machine-session-settings">
                <div className="sex-machine-session-targets">
                  <div className="sex-machine-session-target">
                    <small title={t('game.ui.sessionLimit')}>{t('game.ui.limit')}</small>
                    <button
                      aria-label={t('game.ui.decreaseSessionLimit')}
                      disabled={working || stopAfterMinutes <= 0}
                      onClick={() => control("settings", { stopAfterMinutes: Math.max(0, stopAfterMinutes - 30) || null })}
                    >
                      −
                    </button>
                    <b title={stopAfterMinutes ? `${stopAfterMinutes} ${t('game.ui.minutes')}` : t('game.ui.manual')}>{stopAfterMinutes ? `${stopAfterMinutes}′` : "—"}</b>
                    <button
                      aria-label={t('game.ui.increaseSessionLimit')}
                      disabled={working || stopAfterMinutes >= 1440}
                      onClick={() => control("settings", { stopAfterMinutes: Math.min(1440, stopAfterMinutes + 30) })}
                    >
                      +
                    </button>
                  </div>
                  {activeMode[0] === "orgasm" && (
                    <div className="sex-machine-session-target">
                    <small title={t('game.ui.orgasmTarget')}>{t('game.ui.orgasms')}</small>
                    <button
                      aria-label={t('game.ui.decreaseOrgasms')}
                      disabled={working || orgasmTargetCount <= 1}
                      onClick={() => control("settings", { orgasmTargetCount: orgasmTargetCount - 1 })}
                    >
                      −
                    </button>
                    <b>{orgasmTargetCount}</b>
                    <button
                      aria-label={t('game.ui.increaseOrgasms')}
                      disabled={working || orgasmTargetCount >= 10}
                      onClick={() => control("settings", { orgasmTargetCount: orgasmTargetCount + 1 })}
                    >
                      +
                    </button>
                  </div>
                  )}
                </div>
              </section>
            </section>
          )}
          {machineEngaged && (
            <section
              className={`sex-machine-operation risk-${risk >= 85 ? "critical" : risk >= 60 ? "warning" : "stable"}`}
            >
              <header>
                <div>
                  <small>{t('game.ui.protocolRunning')}</small>
                  <strong>{phaseLabel}</strong>
                </div>
                <span>
                  {t('game.ui.cycle').replace('{n}', String(Math.floor(elapsed / 10) + 1).padStart(2, "0")).replace('{elapsed}', String(elapsed))}
                </span>
              </header>
              <div className="sex-machine-trajectory">
                <div className="trajectory-track">
                  <i className="progress" style={{ width: `${tension}%` }} />
                  <i className="current" style={{ left: `${tension}%` }} />
                  <i
                    className="forecast"
                    style={{ left: `${projectedTension}%` }}
                  />
                  <i className="limit" style={{ left: `${maxTension}%` }} />
                </div>
                <footer>
                  <span>
                    <i className="current" />
                    {t('game.ui.now')}
                  </span>
                  <span>
                    <i className="forecast" />
                    {t('game.ui.nextCycle')}
                  </span>
                  <span>
                    <i className="limit" />
                    {t('game.ui.limitShort')}
                  </span>
                </footer>
              </div>
              <div className="sex-machine-operation-metrics">
                <article>
                  <small>{stimulationMode === "tickling" ? t('game.ui.reactionMetric') : t('game.ui.activation')}</small>
                  <strong>{Math.round(tension)}</strong>
                  <span>→ {Math.round(projectedTension)}</span>
                </article>
                <article>
                  <small>{t('game.ui.resourceMetric')}</small>
                  <strong>{Math.round(capacity)}</strong>
                  <span>→ {Math.round(projectedCapacity)}</span>
                </article>
                <article>
                  <small>{t('game.ui.risk')}</small>
                  <strong>{Math.round(risk)}</strong>
                  <span>
                    {risk >= 85
                      ? t('game.ui.riskCritical')
                      : risk >= 60
                        ? t('game.ui.riskHigh')
                        : t('game.ui.riskAcceptable')}
                  </span>
                </article>
              </div>
              <p className="sex-machine-system-note">{systemNote}</p>
            </section>
          )}
          <div className="sex-machine-console-actions">
            {["loaded", "stopped"].includes(session.status) && (
              <button
                className="primary"
                disabled={working}
                onClick={() => control("start")}
              >
                <small>{t('game.ui.protocolStart').replace('{name}', activeMode[1])}</small>{t('game.ui.start')}
              </button>
            )}
            {session.status === "running" && (
              <button onClick={() => control("pause")} disabled={working}>
                {t('game.ui.pause')}
              </button>
            )}
            {session.status === "paused" && (
              <button
                className="primary"
                onClick={() => control("resume")}
                disabled={working}
              >
                {t('game.ui.resume')}
              </button>
            )}
            {["running", "paused"].includes(session.status) && (
              <button
                className="emergency"
                onClick={() => control("stop")}
                disabled={working}
              >
                {t('game.ui.emergencyStop')}
              </button>
            )}
          </div>
          {error && <p className="device-error">{error}</p>}
        </section>
        <div className="device-chat-panel character-chat residential-chat">
          <header>
            <strong>{t('game.ui.deviceChannel')}</strong>
            <span className="chat-channel-state">{t('game.ui.channelOpen')}</span>
          </header>
          <CharacterChatFeed
            lines={lines}
            emptyText={t('game.ui.chatNotStarted')}
            typing={chatWaiting}
            typingSpeaker={resident.name}
            typingActorId={subjectId}
            typingContext={asset.name}
            avatarSrc={(line) => {
              if (line.avatarPath) return line.avatarPath;
              if (line.role === "calibrator" || line.role === "system") return undefined;
              const actorId = line.actorId || subjectId;
              const lineSlug = visualSlugFor(actorId);
              return lineSlug
                ? `/character-images/portraits/${lineSlug}/${line.portraitEmotion || "neutral"}.png`
                : undefined;
            }}
          />
          {error && <small className="residential-error">{error}</small>}
          <form
            className="speech-input"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <textarea
              rows={1}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder={t('game.ui.say').replace('{name}', resident.name)}
            />
            <button disabled={working || !text.trim()}>
              {working ? "…" : t('game.ui.send')}
            </button>
          </form>
        </div>
      </section>
      {!machineEngaged && (
        <section className="sex-machine-stimulation-selector" aria-label={t('game.ui.stimulationMode')}>
          <small>{t('game.ui.stimulationType')}</small>
          <div>
            {(Object.entries(SEX_MACHINE_STIMULATION) as Array<["vaginal" | "anal" | "tickling", typeof SEX_MACHINE_STIMULATION.anal]>).map(([mode, definition]) => (
              <button
                key={mode}
                className={stimulationMode === mode ? "active" : ""}
                disabled={working}
                onClick={() => selectStimulation(mode)}
                title={mode === "tickling" ? t('game.ui.modeTicklingDesc') : mode === "anal" ? t('game.ui.modeAnalDesc') : t('game.ui.modeVaginalDesc')}
              >
                {mode === "tickling" ? t('game.ui.modeTickling') : mode === "anal" ? t('game.ui.modeAnal') : t('game.ui.modeVaginal')}
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function ContainerConversation({
  resident,
  container,
  roomName,
  kind,
  asset,
  worldMinute,
  busy,
  presentResidents = [],
  onSelectResident,
  onRefresh,
  onRelease,
  onExit,
}: {
  resident: Resident;
  container: string;
  roomName?: string;
  kind: "cell" | "staff" | "room" | "capsule";
  asset?: LabAsset;
  worldMinute: number;
  busy: boolean;
  presentResidents?: Resident[];
  onSelectResident?: (resident: Resident) => void;
  onRefresh: () => Promise<void>;
  onRelease?: () => Promise<void>;
  onExit: () => void;
}) {
  const { t } = useI18n();
  const [lines, setLines] = useState<CharacterChatLine[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyPending, setReplyPending] = useState(false);
  const [targetMenuOpen, setTargetMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationMode, setOperationMode] = useState<"impact" | "setup">(
    "impact",
  );
  const [selectedActionId, setSelectedActionId] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState("neck");
  const [zoneOpen, setZoneOpen] = useState(false);
  const [paletteZones, setPaletteZones] = useState<
    Array<{
      id: string;
      label: string;
      local_sensitivity?: number;
      local_attitude?: number;
    }>
  >([]);
  const [paletteActionMeta, setPaletteActionMeta] = useState<
    Array<{
      id: string;
      validTargets?: string[];
      requiresItem?: string | null;
      intensity?: number;
      tags?: string[];
    }>
  >([]);
  const [ownedItemIds, setOwnedItemIds] = useState<Set<string>>(new Set());
  const [ownedItemCharges, setOwnedItemCharges] = useState<Map<string, number>>(
    new Map(),
  );
  const [selectedProcessIndex, setSelectedProcessIndex] = useState(0);
  const [roomVisualEffect, setRoomVisualEffect] =
    useState<RoomVisualEffect | null>(null);
  const [roomPeakEffect, setRoomPeakEffect] = useState<RoomPeakEffect | null>(
    null,
  );
  useEffect(() => {
    if (!sending) return;
    const timer = window.setTimeout(() => setSending(false), 16_000);
    return () => window.clearTimeout(timer);
  }, [sending]);
  useEffect(() => {
    if (!replyPending) return;
    const timer = window.setTimeout(() => setReplyPending(false), 65_000);
    return () => window.clearTimeout(timer);
  }, [replyPending]);
  const chatParticipantKey = (presentResidents.length
    ? presentResidents
    : [resident]
  )
    .map((character) => character.subjectId || character.id)
    .sort()
    .join("|");
  const deliverDeferredReply = (data: any) => {
    // A probabilistic scene may deliberately choose silence. In that case
    // there is no deferred job and, crucially, no synthetic chat message.
    // Only display speech that was actually produced by the orchestrator.
    if (!data?.replyPending && !data?.reply?.speech && !data?.actorReplies?.some((reply: any) => reply.speech)) {
      setReplyPending(false);
      return;
    }
    setReplyPending(true);
    const streamingId = `stream:${data.replyJobId}`;
    let streamFinished = false;
    void resolveDeferredReply(data, 60_000, (text) => {
      if (streamFinished) return;
      setLines((previous) => {
        if (streamFinished) return previous;
        const existing = previous.some((line) => line.id === streamingId);
        if (existing)
          return previous.map((line) =>
            line.id === streamingId ? { ...line, text } : line,
          );
        return [
          ...previous,
          {
            id: streamingId,
            actorId: resident.subjectId || resident.id,
            speaker: resident.name,
            role: "character",
            text,
            context: container,
          } as CharacterChatLine,
        ];
      });
    })
      .then((replyData) => {
        streamFinished = true;
        const replies = (replyData.actorReplies || [])
          .filter((reply: any) => reply.speech)
          .map((reply: any) => ({
            actorId: reply.actorId,
            speaker: reply.actorName || reply.actorId || resident.name,
            role: (reply.actorName && reply.actorName !== resident.name
              ? "observer"
              : "character") as CharacterChatLine["role"],
            text: reply.speech,
            context: container,
            portraitEmotion: reply.portraitEmotion,
          }));
        const primarySpeech = replyData.reply?.speech?.trim();
        const primaryActorId = replyData.reply?.actorId || resident.subjectId || resident.id;
        const primaryActorName = replyData.reply?.actorId
          ? (presentResidents.find((c) => c.subjectId === replyData.reply.actorId || c.id === replyData.reply.actorId)?.name || replyData.reply.actorId)
          : resident.name;
        const completedReplies = replies.length
          ? replies
          : primarySpeech
            ? [
                {
                  actorId: primaryActorId,
                  speaker: primaryActorName,
                  role: "character" as const,
                  text: primarySpeech,
                  context: container,
                  portraitEmotion: replyData.reply?.portraitEmotion,
                },
              ]
            : [];
        setLines((previous) => {
          const withoutStream = previous.filter((line) => line.id !== streamingId);
          return completedReplies.length
            ? appendCharacterChatLines(withoutStream, completedReplies)
            : withoutStream;
        });
        // ── Cross-character action visual effect ──
        // When the player commands an NPC to act on another character, the
        // second tick produces a reaction on the target. Play the same visual
        // effect as a player-initiated action so the user sees the result.
        const cmdIntent = data?.bundle?.metadata?.commandIntent;
        if (
          cmdIntent?.type === "perform_action" &&
          cmdIntent.targetId &&
          cmdIntent.targetId !== (resident.subjectId || resident.id) &&
          cmdIntent.actionId
        ) {
          const effectFamily = roomVisualEffectFamily(cmdIntent.actionId);
          const targetReply = (replyData.actorReplies || []).find(
            (r: any) => r.actorId === cmdIntent.targetId,
          );
          const targetEmotion = (targetReply?.portraitEmotion as PortraitEmotion) ||
            resolvePortraitEmotion({ speech: targetReply?.speech || "" });
          void gameAudio.playAction(cmdIntent.actionId);
          setRoomVisualEffect({
            key: crypto.randomUUID(),
            family: effectFamily,
            result: "accepted",
            intensity: 0.5,
            sharpness: effectFamily === "soft" ? 0.18 : 0.48,
            duration: Math.round(1450 + 0.5 * 260),
            rayRotation: -7 + Math.random() * 14,
            showRays: effectFamily !== "soft",
            showPortrait: false,
            emotion: targetEmotion,
            actionKey: `${cmdIntent.pointId}/${cmdIntent.actionId}`,
            actionImage: "",
            actionLabel: "",
            targetLabel: "",
          });
        }
        if (replyData.llmError) setError(replyData.llmError);
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        streamFinished = true;
        setLines((previous) => previous.filter((line) => line.id !== streamingId));
        setReplyPending(false);
      });
  };
  useEffect(() => {
    if (!roomVisualEffect) return;
    const timer = window.setTimeout(
      () => setRoomVisualEffect(null),
      Math.max(
        roomVisualEffect.duration,
        gameEffectDurationMs(roomVisualEffect.family),
      ) + 100,
    );
    return () => window.clearTimeout(timer);
  }, [roomVisualEffect?.key]);
  useEffect(() => {
    if (!roomPeakEffect) return;
    const timer = window.setTimeout(() => setRoomPeakEffect(null), 5300);
    return () => window.clearTimeout(timer);
  }, [roomPeakEffect?.key]);
  const showPeakEffectFromTick = (data: any) => {
    const observation = data?.observation || data?.diagnostics?.observation;
    const transition = observation?.transitions?.find((entry: any) =>
      ["discharge", "overload", "breakdown"].includes(entry?.kind),
    );
    if (!transition) return;
    const kind: RoomPeakEffect["kind"] =
      transition.kind === "discharge"
        ? "discharge"
        : transition.kind === "overload"
          ? "overload"
          : /истощ/i.test(String(transition.title || ""))
            ? "exhaustion"
            : "breakdown";
    setRoomPeakEffect({
      key: crypto.randomUUID(),
      kind,
      actionImage: peakActionImagePath(observation),
    });
  };
  useEffect(() => {
    const chatParticipants = presentResidents.length
      ? presentResidents
      : [resident];
    const contextLabels = Array.from(
      new Set([container, roomName].filter((label): label is string => Boolean(label))),
    );
    Promise.all([
      Promise.all(
        chatParticipants.map((character) =>
          api(
            `/api/characters/${character.subjectId || character.id}/chat?limit=100`,
          ).then((data) => ({ character, messages: data.messages || [] })),
        ),
      ),
      api(
        `/api/state?subjectId=${resident.subjectId || resident.id}&sceneId=scene_lab_calibrator&pointId=${selectedZoneId}`,
      ),
      api(`/api/chat/context?contexts=${encodeURIComponent(contextLabels.join("|"))}&limit=100`),
    ])
      .then(([chatHistories, stateData, contextHistory]) => {
        const contextMessages = (contextHistory.messages || []).map((message: any) => ({
          ...message,
          participantId: message.subjectId,
          participantName: message.characterName || message.subjectId,
        }));
        // Context-less legacy rows have no slot to query by. Keep them for
        // current occupants, but source all labelled rows from the durable
        // context journal so departed occupants remain visible in this slot.
        const legacyMessages = chatHistories.flatMap(({ character, messages }) =>
          messages
            .filter((message: any) => !message.contextLabel)
            .map((message: any) => ({
              ...message,
              participantId: character.subjectId || character.id,
              participantName: character.name,
            })),
        );
        const restored = collapseRepeatedChatActions(
          [...contextMessages, ...legacyMessages]
            .map((message: any) => ({
              ...chatLineFromStoredMessage(
                message,
                message.participantName || message.participantId,
                message.participantId,
              ),
              actorId: message.role === "assistant" ? message.participantId : undefined,
            }))
            .sort((left, right) =>
              (Number(left.worldMinute ?? left.id) - Number(right.worldMinute ?? right.id)) ||
              (Number(left.id) - Number(right.id)),
            ),
        ).slice(-100);
        // A state/chat refresh may have started before a deferred reply and
        // finished after it. Never let that older snapshot erase streamed or
        // freshly completed lines; merge anything it does not contain yet.
        setLines((current) => {
          const keyFor = (line: CharacterChatLine) =>
            `${line.actorId || ""}\u0000${line.speaker}\u0000${line.text}\u0000${line.context || ""}\u0000${line.action ? 1 : 0}`;
          const restoredKeys = new Set(restored.map(keyFor));
          const newer = current.filter(
            (line) => line.id.startsWith("stream:") || !restoredKeys.has(keyFor(line)),
          );
          return collapseRepeatedChatActions([...restored, ...newer]).slice(-100);
        });
        setPaletteZones(stateData.availablePoints || []);
        setPaletteActionMeta(stateData.availableActions || []);
        const activeInventory = (stateData.player?.inventory || []).filter(
          (item: any) =>
            item.state !== "consumed" &&
            item.state !== "broken" &&
            Number(item.charges) !== 0,
        );
        setOwnedItemIds(new Set(activeInventory.map((item: any) => item.id)));
        setOwnedItemCharges(
          new Map(
            activeInventory.map((item: any) => [item.id, Number(item.charges)]),
          ),
        );
      })
      .catch((e: any) => setError(e.message));
  }, [
    resident.id,
    resident.name,
    resident.subjectId,
    selectedZoneId,
    chatParticipantKey,
  ]);
  const send = async () => {
    const message = text.trim();
    if (!message || sending) return;
    setText("");
    setSending(true);
    setError(null);
    setLines((previous) =>
      appendCharacterChatLines(previous, [
        {
          speaker: "Калибратор",
          role: "calibrator",
          text: message,
          context: container,
        },
      ]),
    );
    try {
      const data = await api("/api/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: resident.subjectId || resident.id,
          addressedCharacterId: resident.subjectId || resident.id,
          playerId: "PL-1",
          sceneId: "scene_lab_calibrator",
          pointId: "systemic",
          presetId: "verbal_pressure",
          textMessage: message,
          interactionContext: container,
          intensity: 1,
          skipLLM: false,
          deferLLM: true,
          llmMode: "scene_dialogue",
          skipImageGen: true,
        }),
      });
      deliverDeferredReply(data);
      setSending(false);
      await onRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };
  const performAction = async (action: ActionDef, targetPointId?: string) => {
    if (sending || busy) return;
    setSending(true);
    setError(null);
    setLines((previous) =>
      appendCharacterChatLines(previous, [
        {
          speaker: "Система",
          role: "system",
          text: action.label,
          context: container,
          action: true,
        },
      ]),
    );
    const currentReaction =
      resident.state?.reaction || resident.state?.lastReaction || {};
    const capsuleDrug =
      kind === "capsule" && action.id.startsWith("capsule_infusion_");
    const effectFamily = roomVisualEffectFamily(action.id);
    const effectIntensity = Math.max(
      0.28,
      Math.min(
        1,
        Number(
          paletteActionMeta.find((meta) => meta.id === action.id)?.intensity ||
            3,
        ) / 8,
      ),
    );
    const effectSharpness =
      effectFamily === "impact" || effectFamily === "sharp"
        ? 0.82
        : effectFamily === "soft"
          ? 0.18
          : 0.48;
    const currentEmotion = resolvePortraitEmotion({
      behavioralState: resident.state?.behavioralState,
      reaction: currentReaction,
      transitions: resident.state?.transitions,
      state: resident.state,
    });
    if (!capsuleDrug) void gameAudio.playAction(action.id);
    if (!capsuleDrug) setRoomVisualEffect({
      key: crypto.randomUUID(),
      family: effectFamily,
      result:
        Number(currentReaction.overload || 0) > 8
          ? "overload"
          : currentReaction.mixed
            ? "mixed"
            : Number(currentReaction.appraisal || 0) < 0
              ? "rejected"
              : "accepted",
      intensity: effectIntensity,
      sharpness: effectSharpness,
      duration: Math.round(1450 + effectIntensity * 260),
      rayRotation: -7 + Math.random() * 14,
      showRays:
        effectFamily !== "soft" || effectIntensity + effectSharpness > 0.72,
      showPortrait: false,
      emotion: currentEmotion,
      actionKey: `${targetPointId || action.pointId || selectedZoneId}/${action.id}`,
      actionImage:
        capsuleInfusions.find((infusion) => infusion.id === action.id)?.image ||
        resolveActionButtonImage(
          action.id,
          action.group,
          targetPointId || action.pointId || selectedZoneId,
          residentPortraitSlug,
        ),
      actionLabel: action.label,
      targetLabel:
        paletteZones.find(
          (zone) =>
            zone.id === (targetPointId || action.pointId || selectedZoneId),
        )?.label ||
        targetPointId ||
        action.pointId ||
        selectedZoneId,
    });
    try {
      const data = await api("/api/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: resident.subjectId || resident.id,
          addressedCharacterId: resident.subjectId || resident.id,
          playerId: "PL-1",
          sceneId: "scene_lab_calibrator",
          pointId: targetPointId || action.pointId || selectedZoneId,
          presetId: action.id,
          interactionContext: container,
          intensity: 1,
          skipLLM: false,
          deferLLM: true,
          llmMode: "scene_chance",
          skipImageGen: true,
        }),
      });
      const observation = data.diagnostics?.observation;
      const snapshot = observation?.reactionSnapshot;
      const resolvedEmotion =
        (snapshot?.affect?.emotion as PortraitEmotion) ||
        resolvePortraitEmotion({
          behavioralState: observation?.behavioralState,
          reaction: observation?.reaction,
          transitions: observation?.transitions,
          state: data.state,
        });
      setRoomVisualEffect((current) =>
        capsuleDrug
          ? {
              key: crypto.randomUUID(),
              family: "soft",
              result: "accepted",
              intensity: effectIntensity,
              sharpness: 0,
              duration: 2350,
              rayRotation: 0,
              showRays: false,
              showPortrait: true,
              portraitOnly: true,
              emotion: resolvedEmotion,
              actionKey: action.id,
              actionImage: "",
              actionLabel: action.label,
              targetLabel: "",
            }
          : current
          ? {
              ...current,
              emotion: resolvedEmotion,
              result:
                Number(
                  snapshot?.sensation?.overload ||
                    observation?.reaction?.overload ||
                    0,
                ) > 8
                  ? "overload"
                  : observation?.reaction?.mixed
                    ? "mixed"
                    : Number(
                          snapshot?.appraisal?.valence ??
                            observation?.reaction?.appraisal ??
                            0,
                        ) < 0
                      ? "rejected"
                      : "accepted",
              showPortrait: true,
            }
          : current,
      );
      if (!capsuleDrug) showPeakEffectFromTick(data);
      deliverDeferredReply(data);
      setSending(false);
      await onRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };
  const contextTitle =
    kind === "cell"
      ? "ОТДЫХ И НАБЛЮДЕНИЕ"
      : kind === "capsule"
        ? "КОНТРОЛЬ ОБОРУДОВАНИЯ"
        : kind === "staff"
          ? "РАБОЧИЙ РАЗГОВОР"
          : "ВЗАИМОДЕЙСТВИЕ В ПОМЕЩЕНИИ";
  const equipmentMode = kind === "capsule";
  const equipmentPortrait = equipmentMode ? capsulePortraitFor(resident) : null;
  const capsuleActivation = clampMetric(Number(resident.state?.tension || 0));
  const capsuleCapacity = clampMetric(Number(resident.state?.capacity || 0));
  const capsuleState = resident.state || {};
  const capsuleReaction =
    capsuleState.reaction || capsuleState.lastReaction || {};
  const capsuleBehaviorLabels: Record<string, string> = {
    responsive: "Контактна",
    subspace: "Сабспейс",
    overload: "Перегрузка",
    freeze: "Замирание",
    panic: "Паника",
    defiance: "Сопротивление",
    unresponsive: "Без сознания",
  };
  const capacityHistory = residentTrend(
    resident.subjectId || resident.id,
    "capacity",
    capsuleCapacity,
  );
  const tensionHistory = residentTrend(
    resident.subjectId || resident.id,
    "tension",
    capsuleActivation,
  );
  const capacityTrend =
    capacityHistory.length > 1
      ? capacityHistory[capacityHistory.length - 1] -
        capacityHistory[capacityHistory.length - 2]
      : null;
  const tensionTrend =
    tensionHistory.length > 1
      ? tensionHistory[tensionHistory.length - 1] -
        tensionHistory[tensionHistory.length - 2]
      : null;
  const baselineCapacity = Number(
    capsuleState.baselineCapacity ??
      capsuleState.baseline_capacity ??
      capsuleCapacity,
  );
  const recoveryRemaining = Math.max(0, baselineCapacity - capsuleCapacity);
  const recoveryEstimate =
    capacityTrend && capacityTrend > 0
      ? Math.ceil(recoveryRemaining / capacityTrend)
      : null;
  const capsuleRisks = [
    capsuleCapacity <= 15
      ? t('game.ui.riskCriticalExhaustion')
      : capsuleCapacity <= 30
        ? t('game.ui.lowResource')
        : null,
    capsuleActivation >= 85
      ? t('game.ui.peakActivation')
      : capsuleActivation >= 70
        ? t('game.ui.highActivation')
        : null,
    Number(capsuleState.overload || 0) >= 10 ? t('game.ui.sensoryOverload') : null,
  ].filter((risk): risk is string => Boolean(risk));
  const informativeCapsuleContexts = Array.from(
    new Set(
      (resident.contexts || [])
        .filter(
          (context) => !/помещ[её]н.*(?:устройств|капсул)/i.test(context.label),
        )
        .map((context) => context.label)
        .filter(Boolean),
    ),
  );
  const informativeCapsuleEvents = (resident.history || [])
    .filter(
      (event) =>
        !/(?:помещ[её]н|извлеч[её]н|освобожд[её]н).*(?:устройств|капсул)/i.test(
          `${event.title} ${event.description || ""}`,
        ),
    )
    .filter(
      (event, index, events) =>
        events.findIndex((candidate) => candidate.title === event.title) ===
        index,
    )
    .slice(-2)
    .reverse();
  const capsuleHistory = (() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(
          `cyberjack.stateHistory.${resident.subjectId || resident.id}`,
        ) || "[]",
      );
      const entries = Array.isArray(saved) ? saved : [];
      const timedEvents = (resident.history || []).flatMap((event: any) => {
        if (event.type === "state") return [];
        const at = Number(event.worldMinute);
        return Number.isFinite(at)
          ? [
              {
                at,
                label: event.title || event.description || "Событие",
                actionKey: String(event.actionKey || ""),
                outcome: event.outcome ? String(event.outcome) : undefined,
              },
            ]
          : [];
      });
      const actionFamily = (actionKey: string) => {
        if (
          [
            "act_start_penetration",
            "act_start_oral_giving",
            "act_deepen_oral",
            "sustained_sexual_pulse",
            "finger_insertion",
            "act_increase_friction",
            "act_decrease_friction",
            "act_end_sexual_contact",
            "act_sexual_climax",
          ].includes(actionKey)
        )
          return "sexual-process";
        if (actionKey.startsWith("pose_")) return "pose";
        if (
          [
            "act_start_vibrator",
            "sustained_vibration_pulse",
            "act_adjust_vibration",
            "act_stop_vibrator",
          ].includes(actionKey)
        )
          return "vibration-process";
        if (
          [
            "act_start_electrostimulation",
            "sustained_electro_pulse",
            "act_adjust_electrostimulation",
            "act_stop_electrostimulation",
          ].includes(actionKey)
        )
          return "electro-process";
        return actionKey || "other";
      };
      const withoutTechnicalWait = (actions: string[]) => {
        const hasActiveProcess = actions.some(
          (label) =>
            /(секс|стимуляц|фрикц|вибрац|проникновен)/i.test(label) &&
            !/(заверш[её]н|останов)/i.test(label),
        );
        return hasActiveProcess
          ? actions.filter(
              (label) =>
                label !== "Ожидание" &&
                label !== "wait" &&
                label !== "Подождать",
            )
          : actions;
      };
      const actionsAt = (at: number) => {
        const candidates = timedEvents
          .filter((event) => event.at <= at + 1 && at - event.at <= 15)
          .sort(
            (left, right) => Math.abs(left.at - at) - Math.abs(right.at - at),
          );
        const selected = new Map<string, (typeof candidates)[number]>();
        for (const event of candidates) {
          const family = actionFamily(event.actionKey);
          if (!selected.has(family)) selected.set(family, event);
        }
        return withoutTechnicalWait(
          Array.from(
            new Set(
              Array.from(selected.values()).flatMap((event) =>
                [
                  event.label === "wait" || event.label === "Подождать"
                    ? "Ожидание"
                    : event.label,
                  event.outcome,
                ].filter((value): value is string => Boolean(value)),
              ),
            ),
          ),
        );
      };
      const currentInfluences = (resident.contexts || [])
        .filter((context: any) =>
          [
            "pose",
            "interaction",
            "sexual_interaction",
            "interaction_level",
          ].includes(context.type || ""),
        )
        .map((context: any) => context.label || context.id)
        .filter(Boolean);
      const currentEvents = actionsAt(worldMinute);
      const current: CapsuleHistoryPoint = {
        at: worldMinute,
        activation: capsuleActivation,
        endurance: capsuleCapacity,
        balance: clampMetric(50 + (capsuleCapacity - capsuleActivation) / 2),
        strain: clampMetric(capsuleActivation * (1 - capsuleCapacity / 100)),
        actions: withoutTechnicalWait(
          Array.from(
            new Set([...currentEvents, ...currentInfluences].filter(Boolean)),
          ) as string[],
        ),
      };
      const normalized = entries.map((entry: any, index: number) => {
        const rawAt = Number(entry.at);
        const at =
          rawAt > 10_000_000
            ? Math.max(0, worldMinute - (entries.length - index) * 10)
            : Number.isFinite(rawAt)
              ? rawAt
              : Math.max(0, worldMinute - (entries.length - index) * 10);
        const activation = Number(entry.activation ?? entry.tension ?? 0);
        const endurance = Number(entry.endurance ?? entry.capacity ?? 0);
        return {
          at,
          activation,
          endurance,
          balance: Number(
            entry.balance ?? clampMetric(50 + (endurance - activation) / 2),
          ),
          strain: Number(
            entry.strain ?? clampMetric(activation * (1 - endurance / 100)),
          ),
          actions: withoutTechnicalWait(
            Array.from(
              new Set(
                (Array.isArray(entry.actions) && entry.actions.length
                  ? entry.actions
                  : entry.action
                    ? [entry.action]
                    : actionsAt(at)
                ).filter(Boolean),
              ),
            ) as string[],
          ),
        };
      });
      const last = normalized[normalized.length - 1];
      return [
        ...normalized,
        ...(!last ||
        ["activation", "endurance", "balance", "strain"].some(
          (key) => Math.abs((last as any)[key] - (current as any)[key]) > 0.001,
        )
          ? [current]
          : []),
      ].slice(-40);
    } catch {
      return [];
    }
  })();
  const capsuleInfusions = [
    {
      id: "capsule_infusion_regenerative",
      itemId: "drug_regenerative",
      label: "Regen-R",
      effect: "Регенеративный раствор · восстановление и снижение нагрузки",
      kind: "medical",
      image: "/capsule-infusions/regenerative.png",
    },
    {
      id: "capsule_infusion_neurostabilizer",
      itemId: "drug_neurostabilizer",
      label: "NeuroCalm",
      effect: "Нейростабилизатор · сглаживание реакции и защита от перегрузки",
      kind: "medical",
      image: "/capsule-infusions/neurostabilizer.png",
    },
    {
      id: "capsule_infusion_sensitizer",
      itemId: "drug_sensitizer",
      label: "NeuroSpike",
      effect: "Сенсибилизатор · усиление чувствительности и телесного отклика",
      kind: "medical",
      image: "/capsule-infusions/sensitizer.png",
    },
    {
      id: "capsule_infusion_plasticity",
      itemId: "drug_plasticity_catalyst",
      label: "Mnemosyne-P",
      effect: "Пластический катализатор · усиленное закрепление опыта",
      kind: "medical",
      image: "/capsule-infusions/plasticity.png",
    },
    {
      id: "capsule_infusion_hormonal_primer",
      itemId: "drug_aphrodisiac",
      label: "Eros-V",
      effect: "Гормональный праймер · усиление телесного возбуждения",
      kind: "medical",
      image: "/capsule-infusions/hormonal.png",
    },
    {
      id: "capsule_additive_seminal",
      itemId: null,
      label: "Биоматериальный состав",
      effect: "Семенная жидкость калибратора · подача в рот",
      kind: "additive",
      image: "/capsule-infusions/biomaterial.png",
    },
  ] as const;
  const infusionAction = (
    infusion: (typeof capsuleInfusions)[number],
  ): ActionDef => ({
    id: infusion.id,
    label: `Подключить: ${infusion.label}`,
    hint: infusion.effect,
    group: "contact",
    pointId: infusion.id === "capsule_additive_seminal" ? "lips" : "systemic",
  });
  const targetAliases: Record<string, string[]> = {
    head: ["face"],
    torso: ["chest", "belly", "back", "waist"],
    groin: ["vulva", "vagina", "clitoris", "anus"],
    arms: ["arms", "hands"],
    legs: ["inner_thighs", "legs", "feet"],
  };
  const playablePointIds = new Set([
    "face",
    "head",
    "hair",
    "lips",
    "neck",
    "shoulders",
    "arms",
    "hands",
    "chest",
    "nipples",
    "belly",
    "back",
    "waist",
    "inner_thighs",
    "legs",
    "feet",
    "vulva",
    "vagina",
    "clitoris",
    "anus",
    "buttocks",
  ]);
  const playableZones = paletteZones.filter((zone) =>
    playablePointIds.has(zone.id),
  );
  const actionMetaFor = (id: string) =>
    paletteActionMeta.find((meta) => meta.id === id);
  const activeContextIds = new Set(
    (resident.contexts || []).map((context) => context.id),
  );
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
      start: "act_start_oral_giving",
      slower: undefined,
      faster: "act_deepen_oral",
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
  ];
  const activeProcesses = processDefinitions
    .flatMap((definition) => {
      const context = resident.contexts?.find(
        (entry) => entry.id === definition.start,
      );
      const action = calibrationActions.find(
        (entry) => entry.id === definition.start,
      );
      return context && action ? [{ ...definition, context, action }] : [];
    })
    .slice(0, 3);
  const safeProcessIndex = activeProcesses.length
    ? Math.min(selectedProcessIndex, activeProcesses.length - 1)
    : 0;
  const selectedProcess = activeProcesses[safeProcessIndex];
  const selectedProcessLevel = selectedProcess
    ? selectedProcess.start === "act_activate_plug"
      ? 1
      : activeContextIds.has(selectedProcess.faster || "")
        ? 3
        : 2
    : 0;
  const processCommand = (command: "slower" | "faster" | "stop") => {
    if (!selectedProcess) return;
    const actionId = selectedProcess[command];
    const action = actionId
      ? calibrationActions.find((entry) => entry.id === actionId)
      : undefined;
    if (action) performAction(action, selectedProcess.action.pointId);
  };
  const zonesForAction = (action: ActionDef) => {
    if (action.pointId && action.pointId !== "systemic")
      return playableZones.filter((zone) => zone.id === action.pointId);
    const allowed = new Set(
      (actionMetaFor(action.id)?.validTargets || []).flatMap(
        (target) => targetAliases[target] || [target],
      ),
    );
    return allowed.size
      ? playableZones.filter((zone) => allowed.has(zone.id))
      : playableZones;
  };
  const compatibleZones =
    operationMode === "impact"
      ? playableZones.filter((zone) =>
          calibrationActions.some(
            (action) =>
              ["contact", "intimate"].includes(action.group) &&
              !action.contextual &&
              !["wait", "act_examine", "act_start_vibrator"].includes(
                action.id,
              ) &&
              zonesForAction(action).some(
                (candidate) => candidate.id === zone.id,
              ),
          ),
        )
      : [];
  const effectiveZoneId = compatibleZones.some(
    (zone) => zone.id === selectedZoneId,
  )
    ? selectedZoneId
    : compatibleZones[0]?.id || selectedZoneId;
  const visibleActions = calibrationActions
    .filter((action) => {
      const modeMatch =
        operationMode === "impact"
          ? action.group === "contact" || action.group === "intimate"
          : action.group === "pose" || action.group === "clothing";
      if (
        !modeMatch ||
        action.contextual ||
        ["wait", "act_examine", "act_start_vibrator"].includes(action.id)
      )
        return false;
      const meta = actionMetaFor(action.id);
      if (paletteActionMeta.length && !meta) return false;
      if (meta?.requiresItem && !ownedItemIds.has(meta.requiresItem))
        return false;
      if (
        action.requiresContext &&
        !activeContextIds.has(action.requiresContext)
      )
        return false;
      if (
        action.hideWhenContext &&
        activeContextIds.has(action.hideWhenContext)
      )
        return false;
      // Tickle has no generic artwork in this palette: do not offer it for a
      // body point that would otherwise silently fall back to the generic tile.
      if (action.id === "tickle" && !hasActionPointImage(action.id, effectiveZoneId))
        return false;
      return (
        operationMode === "setup" ||
        zonesForAction(action).some((zone) => zone.id === effectiveZoneId)
      );
    })
    .slice(0, 19);
  const actionImage = (action: ActionDef) => {
    return resolveActionButtonImage(
      action.id,
      action.group,
      operationMode === "impact" ? effectiveZoneId : action.pointId,
      residentPortraitSlug,
    );
  };
  const actionDisplayTags = (action: ActionDef) => {
    if (action.group === "clothing") return ["одежда"];
    if (action.group === "pose") return ["поза"];
    const authoredTags = actionMetaFor(action.id)?.tags || [];
    return Array.from(new Set(authoredTags))
      .filter((tag) => semanticTagLabels[tag])
      .slice(0, 3)
      .map((tag) => semanticTagLabels[tag]);
  };
  const residentPortraitSlug =
    (resident.subjectId || resident.id) === "S-AV-01"
      ? "mira"
      : (resident.subjectId || resident.id) === "NPC-LAB-01"
        ? "iona"
        : (resident.subjectId || resident.id) === "NPC-CAND-01"
          ? "nika"
          : (resident.subjectId || resident.id) === "NPC-CAND-SUMI"
            ? "sumi"
            : (resident.subjectId || resident.id) === "NPC-CAND-GEN-02"
              ? "eli"
              : (resident.subjectId || resident.id) === "NPC-CAND-GEN-04"
                ? "mai"
                : (resident.subjectId || resident.id) === "NPC-CAND-KATE"
                  ? "kate"
                  : null;
  const emotionalPortraitFor = (character: Resident) => {
    const id = character.subjectId || character.id;
    const slug =
      id === "S-AV-01"
        ? "mira"
        : id === "NPC-LAB-01"
          ? "iona"
          : id === "NPC-CAND-01"
            ? "nika"
            : id === "NPC-CAND-SUMI"
              ? "sumi"
              : id === "NPC-CAND-GEN-02"
                ? "eli"
                : id === "NPC-CAND-GEN-04"
                  ? "mai"
                  : id === "NPC-CAND-KATE"
                    ? "kate"
                    : null;
                if (!slug) return null;
    const state = character.state || {};
    const emotion = resolvePortraitEmotion({
      behavioralState: state.behavioralState,
      reaction: state.reaction || state.lastReaction,
      transitions: state.transitions,
      state: {
        ...state,
        contexts: (character.contexts || []).map((context) => ({
          actionId: context.id,
        })),
      },
    });
    return {
      src: `/character-images/portraits/${slug}/${emotion}.png`,
      fallback: `/character-images/portraits/${slug}/neutral.png`,
    };
  };
  const selectedRoomAction =
    visibleActions.find((action) => action.id === selectedActionId) ||
    visibleActions[0];
  const bodypartAliases: Record<string, string> = {
    head: "face",
    chest: "breasts",
    belly: "stomach",
    systemic: "face",
  };
  const palettePreview =
    operationMode === "setup" && selectedRoomAction
      ? actionImage(selectedRoomAction)
      : `/character-images/bodyparts/${residentPortraitSlug || "mira"}/${bodypartAliases[effectiveZoneId] || effectiveZoneId || "face"}.png`;
  const renderPaletteAction = (action: ActionDef) => {
    const tags = actionDisplayTags(action);
    const intensity = actionIntensity(
      action,
      actionMetaFor(action.id)?.tags || [],
    );
    return (
      <div
        className={selectedActionId === action.id ? "selected" : ""}
        key={action.id}
        onMouseEnter={() => setSelectedActionId(action.id)}
      >
        <button
          className="operation-execute-tile"
          style={
            {
              "--action-image": `url("${actionImage(action)}")`,
            } as React.CSSProperties
          }
          disabled={busy || sending}
          onFocus={() => setSelectedActionId(action.id)}
          onClick={() =>
            performAction(
              action,
              operationMode === "impact" ? effectiveZoneId : action.pointId,
            )
          }
        >
          <strong>{action.label}</strong>
          <span
            className="action-intensity"
            title={`Интенсивность: ${intensity} из 3`}
          >
            {[1, 2, 3].map((level) => (
              <i className={level <= intensity ? "active" : ""} key={level} />
            ))}
          </span>
          {tags.length > 0 && (
            <small className="action-card-tags">
              {tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </small>
          )}
        </button>
      </div>
    );
  };
  useEffect(() => {
    if (equipmentMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches('input, textarea, select, [contenteditable="true"]') ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (event.code === "KeyW" && activeProcesses.length) {
        event.preventDefault();
        setSelectedProcessIndex(
          (index) =>
            (index - 1 + activeProcesses.length) % activeProcesses.length,
        );
      } else if (event.code === "KeyS" && activeProcesses.length) {
        event.preventDefault();
        setSelectedProcessIndex(
          (index) => (index + 1) % activeProcesses.length,
        );
      } else if (event.code === "KeyA") {
        event.preventDefault();
        processCommand("slower");
      } else if (event.code === "KeyD") {
        event.preventDefault();
        processCommand("faster");
      } else if (event.code === "KeyE") {
        event.preventDefault();
        processCommand("stop");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
  return (
    <main
      className={`container-conversation residential-workbench ${equipmentMode ? "equipment-conversation-workbench" : ""}`}
    >
      <header>
        <button onClick={onExit}>← {container}</button>
        <div>
          <small>{contextTitle}</small>
          <h1>{resident.name}</h1>
          <p>{container}</p>
        </div>
        {kind === "capsule" && onRelease && (
          <button onClick={onRelease}>{t('game.ui.release')}</button>
        )}
      </header>
      <section className="residential-workbench-layout">
        <div className="conversation-presence">
          <div className="dossier-portrait">
            {equipmentPortrait ? (
              <img
                className="character-portrait-image capsule-character-portrait"
                src={equipmentPortrait}
                alt={resident.name}
              />
            ) : (
              <CharacterPortrait
                id={resident.subjectId || resident.id}
                name={resident.name}
                portrait={resident.portrait}
                contexts={resident.contexts}
                state={resident.state}
                sleeping={resident.sleeping}
              />
            )}
            {!equipmentMode && activeProcesses[0] && (
              <GameSustainedEffect
                actionId={activeProcesses[0].action.id}
                characterSlug={residentPortraitSlug || undefined}
                deepened={activeContextIds.has("act_deepen_oral")}
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
            {roomVisualEffect?.portraitOnly && residentPortraitSlug && (
              <GamePortraitReactionEffect
                effectKey={roomVisualEffect.key}
                characterSlug={residentPortraitSlug}
                emotion={roomVisualEffect.emotion}
              />
            )}
            {roomVisualEffect && !roomVisualEffect.portraitOnly && (
              <GameActionEffect
                effectKey={roomVisualEffect.key}
                family={roomVisualEffect.family}
                result={roomVisualEffect.result}
                intensity={roomVisualEffect.intensity}
                sharpness={roomVisualEffect.sharpness}
                actionKey={roomVisualEffect.actionKey}
                actionImage={roomVisualEffect.actionImage}
                actionLabel={roomVisualEffect.actionLabel}
                targetLabel={roomVisualEffect.targetLabel}
                characterSlug={residentPortraitSlug || undefined}
                emotion={roomVisualEffect.emotion}
                showPortrait={
                  roomVisualEffect.showPortrait && Boolean(residentPortraitSlug)
                }
              />
            )}
            {roomPeakEffect && (
              <div
                className="calibration-workbench residential-peak-effect-host"
                aria-live="assertive"
              >
                <GamePeakEffect
                  kind={roomPeakEffect.kind}
                  effectKey={roomPeakEffect.key}
                  characterSlug={residentPortraitSlug || "mira"}
                  actionImage={roomPeakEffect.actionImage}
                />
              </div>
            )}
          </div>
          {!equipmentMode && (
            <section className="residential-avatar-controls residential-process-control">
              {selectedProcess ? (
                <article className="control-process-row selected">
                  <header>
                    <kbd>W/S</kbd>
                    <strong>
                      {selectedProcess.context.label ||
                        selectedProcess.action.label}
                    </strong>
                    <span>
                      {t('game.ui.auto')} ·{" "}
                      {Math.max(
                        0,
                        Math.floor(selectedProcess.context.ticksActive || 0),
                      )}{" "}
                      {t('game.ui.min')}
                    </span>
                  </header>
                  <div className="control-process-intensity">
                    <span>
                      <b>
                        {selectedProcessLevel >= 3
                          ? t('game.ui.levelEnhanced')
                          : selectedProcessLevel === 1
                            ? t('game.ui.levelLow')
                            : t('game.ui.levelWorking')}
                      </b>
                    </span>
                    <div>
                      {[1, 2, 3].map((level) => (
                        <i
                          className={
                            level <= selectedProcessLevel ? "active" : ""
                          }
                          key={level}
                        />
                      ))}
                    </div>
                  </div>
                  <footer>
                    <button
                      disabled={!selectedProcess.slower || busy || sending}
                      onClick={() => processCommand("slower")}
                    >
                      <kbd>A</kbd> {t('game.ui.weaker')}
                    </button>
                    <button
                      disabled={!selectedProcess.faster || busy || sending}
                      onClick={() => processCommand("faster")}
                    >
                      <kbd>D</kbd> {t('game.ui.stronger')}
                    </button>
                    <button
                      disabled={!selectedProcess.stop || busy || sending}
                      onClick={() => processCommand("stop")}
                    >
                      <kbd>E</kbd> {t('game.ui.finish')}
                    </button>
                  </footer>
                </article>
              ) : (
                <div className="control-process-idle">
                  <i>●</i>
                  <strong>{t('game.ui.noActiveProcesses')}</strong>
                </div>
              )}
            </section>
          )}
        </div>
        {equipmentMode ? (
          <aside className="equipment-action-palette">
            <div className="capsule-infusion-panel">
              <header>
                <strong>{t('game.ui.feedingSystem')}</strong>
                <small>
                  {t('game.ui.feedingSystemNote')}
                </small>
              </header>
              <div className="equipment-action-list capsule-infusion-list">
                {capsuleInfusions.map((infusion) => {
                  const active = activeContextIds.has(infusion.id);
                  const charges = infusion.itemId
                    ? ownedItemCharges.get(infusion.itemId) || 0
                    : -1;
                  const available = !infusion.itemId || charges > 0;
                  return (
                    <div
                      className={`${active ? "selected active" : ""} ${infusion.kind}`}
                      key={infusion.id}
                    >
                      <button
                        className="operation-execute-tile"
                        style={
                          {
                            "--action-image": `url("${infusion.image}")`,
                          } as React.CSSProperties
                        }
                        disabled={busy || sending || active || !available}
                        title={
                          available
                            ? infusion.effect
                            : `${infusion.effect}. ${t('game.ui.noAmpoules')}`
                        }
                        aria-label={`${infusion.label}. ${infusion.effect}`}
                        onClick={() => {
                          const action = infusionAction(infusion);
                          performAction(action, action.pointId);
                        }}
                      >
                        <strong>{infusion.label}</strong>
                        <small className="capsule-infusion-effect">
                          <b>{t('game.ui.expectedEffect')}</b>
                          <span>{infusion.effect}</span>
                        </small>
                        <small className="action-card-tags">
                          <span>
                            {infusion.kind === "medical"
                              ? t('game.ui.ampoules').replace('{n}', String(charges))
                              : t('game.ui.builtinCircuit')}
                          </span>
                          {active && <span>{t('game.ui.tagActive')}</span>}
                          {!available && <span>{t('game.ui.outOfStock')}</span>}
                        </small>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="capsule-information-history">
              <CapsuleHistoryChart
                points={capsuleHistory}
                baselineCapacity={baselineCapacity}
              />
            </div>
          </aside>
        ) : (
          <aside className="residential-operation-palette">
            <div className="operation-mode-bar">
              <div className="action-tabs">
                <button
                  className={operationMode === "impact" ? "active" : ""}
                  onClick={() => {
                    setOperationMode("impact");
                    setSelectedActionId("");
                    setZoneOpen(false);
                  }}
                >
                  {t('game.ui.impacts')}
                </button>
                <button
                  className={operationMode === "setup" ? "active" : ""}
                  onClick={() => {
                    setOperationMode("setup");
                    setSelectedActionId("");
                    setZoneOpen(false);
                  }}
                >
                  {t('game.ui.preparation')}
                </button>
              </div>
            </div>
            {zoneOpen && (
              <CalibrationZoneMap
                subjectId={resident.subjectId || resident.id}
                zones={compatibleZones as any}
                selectedZoneId={effectiveZoneId}
                onSelect={(zoneId) => {
                  setSelectedZoneId(zoneId);
                  setSelectedActionId("");
                  setZoneOpen(false);
                }}
                onClose={() => setZoneOpen(false)}
              />
            )}
            <div className="residential-palette-deck">
              <div className="residential-palette-feature">
                <button
                  className="residential-target-preview"
                  disabled={operationMode === "setup"}
                  onClick={() => setZoneOpen(true)}
                >
                  <img src={palettePreview} alt="" />
                  <span>
                    {operationMode === "setup"
                      ? selectedRoomAction?.label || "Подготовка"
                      : compatibleZones.find(
                          (zone) => zone.id === effectiveZoneId,
                        )?.label || effectiveZoneId}
                  </span>
                </button>
                <div className="operation-list compact-grid residential-featured-actions">
                  {visibleActions.slice(0, 4).map(renderPaletteAction)}
                </div>
              </div>
              <div className="operation-list compact-grid">
                {visibleActions.slice(4).map(renderPaletteAction)}
              </div>
            </div>
          </aside>
        )}
        {equipmentMode && (
          <div className="capsule-biometry-host calibration-workbench">
            <CalibrationBiometrics
              activation={capsuleActivation}
              activationLabel={
                capsuleActivation >= 85
                  ? "Предел"
                  : capsuleActivation >= 55
                    ? "Рабочая"
                    : "Спокойная"
              }
              capacity={capsuleCapacity}
              enduranceLabel={
                capsuleCapacity < 20
                  ? "Критическая"
                  : capsuleCapacity < 40
                    ? "Сниженная"
                    : capsuleCapacity < 70
                      ? "Рабочая"
                      : "Высокая"
              }
              pulseBpm={62 + capsuleActivation * 0.72}
              pulsePeriod={60 / Math.max(1, 62 + capsuleActivation * 0.72)}
              breathingRate={10 + capsuleActivation * 0.18}
              breathingPeriod={60 / Math.max(1, 10 + capsuleActivation * 0.18)}
              activationBalance={Math.round(
                deriveActivationPressure(resident.recentReactions || [])
                  .activationBalance,
              )}
              currentValence={
                Number(resident.recentReactions?.[0]?.reaction?.appraisal)
              }
              activationNature={
                (() => {
                  const balance = deriveActivationPressure(
                    resident.recentReactions || [],
                  ).activationBalance;
                  return balance > 12
                    ? "положительная"
                    : balance < -12
                      ? "защитная"
                      : "нейтральная";
                })()
              }
              overload={Number(resident.state?.overload || 0)}
              overloadLabel={
                Number(resident.state?.overload || 0) >= 10
                  ? "перегрузка"
                  : "в норме"
              }
              overloadActive={Number(resident.state?.overload || 0) >= 10}
            />
            <CalibrationStateTrends
              trends={[
                {
                  key: "attitude",
                  label: "Принятие",
                  value: Number(resident.state?.attitude || 0),
                  baseline: Number(
                    resident.state?.baselineAttitude ??
                      resident.state?.attitude ??
                      0,
                  ),
                  history: residentTrend(
                    resident.subjectId || resident.id,
                    "attitude",
                    Number(resident.state?.attitude || 0),
                  ),
                  tone: "mint",
                },
                (() => {
                  const value = Number(resident.state?.openness || 0);
                  const baseline = Number(
                    resident.state?.baselineOpenness ?? value,
                  );
                  const relative = interpretCoreMetric(
                    "openness",
                    value,
                    baseline,
                  );
                  return {
                    key: "openness",
                    label: "Открытость",
                    value,
                    displayValue: `${relative.humanPercent}%`,
                    detail: formatRelativeValue(relative),
                    baseline,
                    history: residentTrend(
                      resident.subjectId || resident.id,
                      "openness" as LabTrendKey,
                      value,
                    ),
                    tone: "blue" as const,
                  };
                })(),
                (() => {
                  const value = Number(resident.state?.plasticity || 0);
                  const baseline = Number(
                    resident.state?.baselinePlasticity ?? value,
                  );
                  const relative = interpretCoreMetric(
                    "plasticity",
                    value,
                    baseline,
                  );
                  return {
                    key: "plasticity",
                    label: "Пластичность",
                    value,
                    displayValue: `${relative.humanPercent}%`,
                    detail: formatRelativeValue(relative),
                    baseline,
                    history: residentTrend(
                      resident.subjectId || resident.id,
                      "plasticity" as LabTrendKey,
                      value,
                    ),
                    tone: "amber" as const,
                  };
                })(),
                (() => {
                  const value = Number(resident.state?.sensitivity || 0);
                  const baseline = Number(
                    resident.state?.baselineSensitivity ?? value,
                  );
                  const relative = interpretCoreMetric(
                    "sensitivity",
                    value,
                    baseline,
                  );
                  return {
                    key: "sensitivity",
                    label: "Чувствительность",
                    value,
                    displayValue: `${relative.humanPercent}%`,
                    detail: formatRelativeValue(relative),
                    baseline,
                    history: residentTrend(
                      resident.subjectId || resident.id,
                      "sensitivity",
                      value,
                    ),
                    tone: "violet" as const,
                  };
                })(),
              ]}
            />
          </div>
        )}
        <div className="character-chat residential-chat">
          <header>
            <strong>{t('game.ui.cameraChannel')}</strong>
            <span className="chat-channel-state">
              {presentResidents.length > 1
                ? t('game.ui.present').replace('{names}', presentResidents.map((character) => character.name).join(" · "))
                : t('game.ui.channelOpen')}
            </span>
          </header>
          <CharacterChatFeed
            lines={lines}
            emptyText={t('game.ui.chatNotStarted')}
            typing={
              sending ||
              (replyPending &&
                !lines.some((line) => line.id.startsWith("stream:")))
            }
            typingSpeaker={resident.name}
            typingActorId={resident.subjectId || resident.id}
            typingContext={container}
            avatarSrc={(line) => {
              if (line.avatarPath) return line.avatarPath;
              if (line.role === "calibrator" || line.role === "system") return undefined;
              const actorId = line.actorId || resident.subjectId || resident.id;
              const slug
                = actorId === "S-AV-01" ? "mira"
                : actorId === "NPC-LAB-01" ? "iona"
                : actorId === "NPC-CAND-01" ? "nika"
                : actorId === "NPC-CAND-SUMI" ? "sumi"
                : actorId === "NPC-CAND-GEN-02" ? "eli"
                : actorId === "NPC-CAND-GEN-04" ? "mai"
                : actorId === "NPC-CAND-KATE" ? "kate"
                : undefined;
              return slug
                ? `/character-images/portraits/${slug}/${line.portraitEmotion || "neutral"}.png`
                : undefined;
            }}
          />
          {error && <small className="residential-error">{error}</small>}
          <form
            className="speech-input"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <div className="chat-target-picker">
              {targetMenuOpen && presentResidents.length > 1 && onSelectResident && (
                <div className="chat-target-menu" role="menu" aria-label="Выбрать адресата">
                  {presentResidents.map((character) => (
                    <button
                      type="button"
                      role="menuitem"
                      key={character.id}
                      className={character.id === resident.id ? "active" : ""}
                      title={character.name}
                      onClick={() => {
                        setTargetMenuOpen(false);
                        onSelectResident(character);
                      }}
                    >
                      {emotionalPortraitFor(character) ? (
                        <img
                          src={emotionalPortraitFor(character)!.src}
                          alt={character.name}
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = emotionalPortraitFor(character)!.fallback;
                          }}
                        />
                      ) : (
                        <CharacterPortrait
                          id={character.subjectId || character.id}
                          name={character.name}
                          portrait={character.portrait}
                          contexts={character.contexts}
                          state={character.state}
                          sleeping={character.sleeping}
                        />
                      )}
                      <span>{character.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className={`chat-target-current ${targetMenuOpen ? "active" : ""}`}
                aria-label={`Адресат: ${resident.name}`}
                aria-expanded={targetMenuOpen}
                title={`Адресат: ${resident.name}`}
                disabled={sending || replyPending || presentResidents.length < 2}
                onClick={() => setTargetMenuOpen((open) => !open)}
              >
                {emotionalPortraitFor(resident) ? (
                  <img
                    src={emotionalPortraitFor(resident)!.src}
                    alt={resident.name}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = emotionalPortraitFor(resident)!.fallback;
                    }}
                  />
                ) : (
                  <CharacterPortrait
                    id={resident.subjectId || resident.id}
                    name={resident.name}
                    portrait={resident.portrait}
                    contexts={resident.contexts}
                    state={resident.state}
                    sleeping={resident.sleeping}
                  />
                )}
              </button>
            </div>
            <textarea
              rows={1}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={`Сказать: ${resident.name}`}
            />
            <button
              className="speech-send-icon"
              aria-label="Отправить реплику"
              title="Отправить реплику"
              disabled={sending || !text.trim()}
            >
              {sending ? "…" : "➤"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

const stationSectors = [
  {
    id: "eye",
    index: "00",
    short: "ОКО",
    name: "Центр / Око",
    authority: "Директорат",
    status: "закрытый контур",
    tone: "core",
    description:
      "Резонансный купол и главные лаборатории. Сюда поступают уже подготовленные активы; доступ к прямому контакту выдаётся только по корпоративным каналам.",
    function: "Финальная передача, резонанс, высшая научная юрисдикция.",
  },
  {
    id: "scholarium",
    index: "01",
    short: "СХОЛАРИУМ",
    name: "Внутреннее кольцо",
    authority: "Helix · Veil",
    status: "контролируемый",
    tone: "inner",
    description:
      "Залы метрик, сады плоти и административные кварталы. Здесь формируются заказы, протоколы и критерии пригодности активов.",
    function: "Контракты, корпоративные связи, доступ к редким препаратам.",
  },
  {
    id: "archive",
    index: "02",
    short: "АРХИВ",
    name: "Срединное кольцо",
    authority: "Continuum",
    status: "доступен",
    tone: "middle",
    description:
      "Логистический хаб и Великий Архив. Потоки снабжения, досье и старые записи сходятся здесь прежде, чем попасть во внутренние сектора.",
    function: "Снабжение, учёт, архивные события и проверка происхождения.",
  },
  {
    id: "cultivation",
    index: "03",
    short: "ИНКУБАЦИЯ",
    name: "Внешние кольца",
    authority: "Секторные управы",
    status: "нестабильный",
    tone: "outer",
    description:
      "Жилые и промышленные массивы большинства населения станции: гидропоника, ремонтные зоны, карго-узлы и серый рынок.",
    function:
      "Кандидаты, слухи, неформальные сделки и новые событийные цепочки.",
  },
  {
    id: "perimeter",
    index: "04",
    short: "КОНТУР",
    name: "Обшивка / Периметр",
    authority: "Lattice",
    status: "опасный",
    tone: "danger",
    description:
      "Последняя физическая граница перед Аномалией. Гул корпуса, сбои пространства и ремонтные бригады, работающие на пределе.",
    function:
      "Редкие происшествия, аномальные сигналы и высокорисковые возможности.",
  },
] as const;

function StationSchematic({
  selectedSectorId,
  compact = false,
}: {
  selectedSectorId?: (typeof stationSectors)[number]["id"];
  compact?: boolean;
}) {
  const selectedIndex = stationSectors.findIndex(
    (sector) => sector.id === selectedSectorId,
  );
  const ringClass = (id: string) => (id === selectedSectorId ? "selected" : "");
  return (
    <svg
      className={`station-code-schematic ${compact ? "compact" : ""}`}
      viewBox="0 0 160 90"
      role="img"
      aria-label="Техническая схема станции Омникрон"
    >
      <defs>
        <pattern
          id={`station-grid-${compact ? "compact" : "full"}`}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
        >
          <path d="M5 0H0V5" />
        </pattern>
        <radialGradient id={`station-core-${compact ? "compact" : "full"}`}>
          <stop offset="0" stopColor="var(--ji-lcd)" stopOpacity=".55" />
          <stop offset="1" stopColor="var(--ji-lcd)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect
        className="station-grid-plane"
        width="160"
        height="90"
        fill={`url(#station-grid-${compact ? "compact" : "full"})`}
      />
      <g className="station-anomaly-field">
        <path d="M2 13 Q21 2 38 12 T76 9 M3 78 Q25 66 43 79 T91 75 M118 4 Q136 16 157 8 M121 82 Q140 69 158 78" />
        <circle cx="60" cy="45" r="44" />
      </g>
      <g className="station-transit-spokes">
        {Array.from({ length: 16 }, (_, index) => {
          const angle = (index / 16) * Math.PI * 2;
          return (
            <line
              key={index}
              x1={60 + Math.cos(angle) * 8}
              y1={45 + Math.sin(angle) * 8}
              x2={60 + Math.cos(angle) * 41}
              y2={45 + Math.sin(angle) * 41}
            />
          );
        })}
      </g>
      <g className={`station-code-ring perimeter ${ringClass("perimeter")}`}>
        <circle cx="60" cy="45" r="41" />
        <circle cx="60" cy="45" r="38.5" />
      </g>
      <g
        className={`station-code-ring cultivation ${ringClass("cultivation")}`}
      >
        <circle cx="60" cy="45" r="33" />
        <circle cx="60" cy="45" r="29.5" />
      </g>
      <g className={`station-code-ring archive ${ringClass("archive")}`}>
        <circle cx="60" cy="45" r="25" />
        <circle cx="60" cy="45" r="22" />
      </g>
      <g className={`station-code-ring scholarium ${ringClass("scholarium")}`}>
        <circle cx="60" cy="45" r="17" />
        <circle cx="60" cy="45" r="14" />
      </g>
      <g className={`station-code-ring eye ${ringClass("eye")}`}>
        <circle
          className="core-halo"
          cx="60"
          cy="45"
          r="13"
          fill={`url(#station-core-${compact ? "compact" : "full"})`}
        />
        <circle cx="60" cy="45" r="9" />
        <circle cx="60" cy="45" r="4" />
      </g>
      <g className="station-module-nodes">
        <rect
          className={selectedIndex === 4 ? "selected" : ""}
          x="55"
          y="2.5"
          width="10"
          height="4"
        />
        <rect
          x="84"
          y="13"
          width="7"
          height="4"
          transform="rotate(35 87.5 15)"
        />
        <rect
          className={selectedIndex === 3 ? "selected" : ""}
          x="91"
          y="39"
          width="8"
          height="5"
        />
        <rect
          x="80"
          y="70"
          width="8"
          height="4"
          transform="rotate(-32 84 72)"
        />
        <rect
          className={selectedIndex === 2 ? "selected" : ""}
          x="55"
          y="76.5"
          width="10"
          height="5"
        />
        <rect x="28" y="69" width="8" height="4" transform="rotate(32 32 71)" />
        <rect
          className={selectedIndex === 1 ? "selected" : ""}
          x="21"
          y="42"
          width="8"
          height="5"
        />
        <rect
          x="31"
          y="15"
          width="7"
          height="4"
          transform="rotate(-35 34.5 17)"
        />
      </g>
      <g className="station-orbit-signals">
        <circle cx="60" cy="45" r="35">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 60 45"
            to="360 60 45"
            dur="18s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="60" cy="45" r="27">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="360 60 45"
            to="0 60 45"
            dur="13s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
      {!compact && (
        <g className="station-schematic-labels">
          <path d="M68 45H112" />
          <text x="115" y="43">
            00 · ОКО
          </text>
          <text className="secondary" x="115" y="48">
            РЕЗОНАНСНЫЙ ЦЕНТР
          </text>
          <path d="M74 29L105 18H112" />
          <text x="115" y="17">
            01 · СХОЛАРИУМ
          </text>
          <text className="secondary" x="115" y="22">
            КОРПОРАТИВНЫЙ КОНТУР
          </text>
          <path d="M80 57L104 65H112" />
          <text x="115" y="64">
            02 · АРХИВ
          </text>
          <text className="secondary" x="115" y="69">
            ДАННЫЕ И ЛОГИСТИКА
          </text>
          <path d="M26 45H5" />
          <text x="5" y="41">
            03
          </text>
          <text className="secondary" x="5" y="47">
            ИНКУБАЦИЯ
          </text>
          <path d="M25 21L7 11" />
          <text x="5" y="7">
            04 · КОНТУР
          </text>
        </g>
      )}
      <g className="station-calibrator-node">
        <circle cx="66" cy="39" r="1.4" />
        <path d="M68 38L75 33" />
        <text x="76" y="32">
          CY-17
        </text>
      </g>
    </svg>
  );
}

function SupplyView({
  scenario,
  contracts,
  inbox,
  busy,
  onBuy,
  onOpenInbox,
  onOpenContracts,
}: {
  scenario: Scenario;
  contracts: Contract[];
  inbox: DirectorEvent[];
  busy: boolean;
  onBuy: (offer: ShopOffer) => void;
  onOpenInbox: () => void;
  onOpenContracts: () => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"overview" | "supply" | "storage">("overview");
  const modules = scenario.shop.filter(
    (offer) => offer.category === "laboratory",
  );
  const consumables = scenario.shop.filter(
    (offer) => offer.category === "item" && offer.itemId.startsWith("drug_"),
  );
  const equipment = scenario.shop.filter(
    (offer) => offer.category === "item" && !offer.itemId.startsWith("drug_"),
  );
  const activeContracts = contracts.filter(
    (contract) => contract.state === "accepted",
  );
  const limitedOffers = scenario.shop.filter((offer) => offer.limited);
  return (
    <main className="management-screen supply-screen station-screen station-command">
      <header className="station-command-header">
        <div>
          <p>{t('game.ui.omnikronTerminal')}</p>
          <h1>{t('game.ui.station')}</h1>
          <span>{t('game.ui.stationExternalNote')}</span>
        </div>
        <section>
          <small>{t('game.ui.currentNode')}</small>
          <strong>{scenario.location.shortTitle}</strong>
          <span>{scenario.clock.label}</span>
        </section>
        <b>
          {Math.round(scenario.credits)} <small>CR</small>
        </b>
      </header>
      <nav className="supply-tabs station-tabs">
        <button
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          {t('game.ui.overview')}
        </button>
        <button
          className={tab === "supply" ? "active" : ""}
          onClick={() => setTab("supply")}
        >
          {t('game.ui.supplyTab').replace('{n}', String(scenario.shop.length))}
        </button>
        <button
          className={tab === "storage" ? "active" : ""}
          onClick={() => setTab("storage")}
        >
          {t('game.ui.storageTab').replace('{n}', String(scenario.inventory.length))}
        </button>
      </nav>
      <div className="station-command-body">
        {tab === "overview" ? (
          <section className="station-overview">
            <div className="station-radial-panel">
              <header>
                <small>{t('game.ui.omnikron')}</small>
                <strong>{t('game.ui.stationAroundLab')}</strong>
                <span>
                  {t('game.ui.omnikronIntro')}
                </span>
              </header>
              <div
                className="station-radial-map"
                aria-label={t('game.ui.stationRingMap')}
              >
                <StationSchematic />
                <div className="station-node-marker">
                  <small>{t('game.ui.node')}</small>
                  <b>CY-17</b>
                  <span>{t('game.ui.calibratorNode')}</span>
                </div>
              </div>
              <footer>
                <span>
                  <i className="stable" /> {t('game.ui.innerLoop')}
                </span>
                <span>
                  <i className="warning" /> {t('game.ui.outerRings')}
                </span>
                <span>
                  <i className="danger" /> {t('game.ui.anomalyBorder')}
                </span>
              </footer>
            </div>
            <div className="station-operations">
              <article className={inbox.length ? "attention" : ""}>
                <header>
                  <small>{t('game.ui.incoming')}</small>
                  <b>{inbox.length}</b>
                </header>
                <strong>{inbox.length ? inbox[0].title : t('game.ui.channelClean')}</strong>
                <p>
                  {inbox.length
                    ? inbox[0].body
                    : t('game.ui.noNewIncomingDetailed')}
                </p>
                <button onClick={onOpenInbox}>
                  {inbox.length ? t('game.ui.openInbox') : t('game.ui.checkChannel')}
                </button>
              </article>
              <article className={activeContracts.length ? "active" : ""}>
                <header>
                  <small>{t('game.ui.contracts')}</small>
                  <b>{activeContracts.length}</b>
                </header>
                <strong>
                  {activeContracts.length
                    ? t('game.ui.inWork').replace('{n}', String(activeContracts.length))
                    : t('game.ui.noAcceptedOrders')}
                </strong>
                <p>
                  {activeContracts[0]?.title ||
                    t('game.ui.offersAtLiaison').replace('{n}', String(contracts.filter((contract) => contract.state === "available").length))}
                </p>
                <button onClick={onOpenContracts}>{t('game.ui.goToLiaisonOffice')}</button>
              </article>
              <article className={limitedOffers.length ? "limited" : ""}>
                <header>
                  <small>{t('game.ui.supplyHeader')}</small>
                  <b>{limitedOffers.length || scenario.shop.length}</b>
                </header>
                <strong>
                  {limitedOffers.length
                    ? t('game.ui.limitedBatchShort')
                    : t('game.ui.catalogAvailable')}
                </strong>
                <p>
                  {limitedOffers[0]
                    ? `${limitedOffers[0].name} · ${limitedOffers[0].supplier || t('game.ui.unknownSupplier')}`
                    : t('game.ui.consumablesCount').replace('{n}', String(consumables.length)).replace('{m}', String(equipment.length))}
                </p>
                <button onClick={() => setTab("supply")}>
                  {t('game.ui.openSupply')}
                </button>
              </article>
            </div>
          </section>
        ) : tab === "supply" ? (
          <section className="management-section station-supply">
            <header className="station-section-heading">
              <div>
                <small>{t('game.ui.availableLots')}</small>
                <h2>{t('game.ui.complexSupply')}</h2>
              </div>
              <span>{t('game.ui.obtainedViaStation')}</span>
            </header>
            {modules.length > 0 && (
              <>
                <h2>{t('game.ui.labModules')}</h2>
                <div className="offer-grid">
                  {modules.map((offer) => (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      credits={scenario.credits}
                      busy={busy}
                      onBuy={onBuy}
                    />
                  ))}
                </div>
              </>
            )}
            <h2>{t('game.ui.drugsAndCompounds')}</h2>
            <div className="offer-grid">
              {consumables.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  credits={scenario.credits}
                  busy={busy}
                  onBuy={onBuy}
                />
              ))}
            </div>
            <h2>{t('game.ui.equipmentAndClothing')}</h2>
            <div className="offer-grid">
              {equipment.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  credits={scenario.credits}
                  busy={busy}
                  onBuy={onBuy}
                />
              ))}
            </div>
          </section>
        ) : (
          <StationStorage
            inventory={scenario.inventory}
            laboratory={scenario.laboratory}
          />
        )}
      </div>
    </main>
  );
}

function OfferCard({
  offer,
  credits,
  busy,
  onBuy,
}: {
  offer: ShopOffer;
  credits: number;
  busy: boolean;
  onBuy: (offer: ShopOffer) => void;
}) {
  const { t } = useI18n();
  const unavailable = offer.owned || offer.stock === 0;
  const translatedOffer = translateOffer(offer.id, t) || translateAsset(offer.id, t);
  const offerName = translatedOffer?.name || offer.name;
  const offerDescription = translatedOffer?.description || offer.description;
  return (
    <article
      className={`${unavailable ? "owned " : ""}${offer.limited ? "limited-offer" : ""}`}
    >
      <div>
        <small>
          {offer.limited
            ? `${t('game.ui.limitedBatch')} · ${offer.batch}`
            : offer.category === "laboratory"
              ? t('game.ui.module')
              : offer.stock > 0
                ? `${t('game.ui.remaining')} ${offer.stock}`
                : t('game.ui.equipmentSection')}
        </small>
        <strong>{offerName}</strong>
        <p>{offerDescription}</p>
        {offer.limited && (
          <p className="offer-provenance">
            <span>{offer.supplier}</span>
            {offer.originLabel}
          </p>
        )}
      </div>
      <footer>
        <b>{offer.price} cr</b>
        <button
          disabled={busy || unavailable || credits < offer.price}
          onClick={() => onBuy(offer)}
        >
          {offer.owned
            ? "Установлено"
            : credits < offer.price
              ? "Недостаточно средств"
              : "Приобрести"}
        </button>
      </footer>
    </article>
  );
}

function ContractOffice({
  contracts,
  subject,
  assets,
  selectedAssetId,
  onSelectAsset,
  busy,
  onAccept,
  onDeliver,
  onRefuse,
  now,
}: {
  contracts: Contract[];
  subject: SubjectState | null;
  assets: Resident[];
  selectedAssetId: string | null;
  onSelectAsset: (id: string) => void;
  busy: boolean;
  onAccept: (contract: Contract) => void;
  onDeliver: (contract: Contract) => void;
  onRefuse: (contract: Contract) => void;
  now: number;
}) {
  const { t } = useI18n();
  const subjectName =
    assets.find((asset) => asset.id === selectedAssetId)?.name || t('game.ui.asset');
  return (
    <main className="management-screen">
      <header className="screen-heading">
        <div>
          <p>{t('game.ui.liaisonOffice')}</p>
          <h1>{t('game.ui.contracts')}</h1>
          <span>
            {t('game.ui.selectAssetForContract')}
          </span>
        </div>
        <label className="contract-asset-picker">
          <small>{t('game.ui.checkAsset')}</small>
          <select
            value={selectedAssetId || ""}
            onChange={(event) => onSelectAsset(event.target.value)}
          >
            {assets.map((asset) => (
              <option key={`contract-asset-${asset.id}`} value={asset.id}>
                {getDeviceName(asset.id, t)}
              </option>
            ))}
          </select>
        </label>
      </header>
      <section className="contract-office-list">
        {contracts.map((contract) => {
          const rows = contract.conditions.map((condition) => ({
            condition,
            current: currentFor(condition, subject),
            met: met(
              currentFor(condition, subject),
              condition.operator,
              condition.value,
            ),
          }));
          const ready = rows.length > 0 && rows.every((row) => row.met);
          const hours = contract.deadlineTick
            ? Math.max(0, Math.ceil((contract.deadlineTick - now) / 60))
            : null;
          const returnHours = contract.unavailableUntil
            ? Math.max(0, Math.ceil((contract.unavailableUntil - now) / 60))
            : null;
          const rp = contract.returnProfile;
          return (
            <article
              key={contract.id}
              className={`${contract.state === "accepted" ? "accepted" : ""} ${
                contract.state === "in_transfer" ? "in-transfer" : ""
              }`}
            >
              <header>
                <div>
                  <small>
                    {contract.state === "accepted"
                      ? `ПРИНЯТ · ${hours} Ч ДО СРОКА`
                      : contract.state === "in_transfer"
                        ? `В ПЕРЕДАЧЕ · ВОЗВРАТ ЧЕРЕЗ ${returnHours} Ч`
                        : contract.issuerId}
                  </small>
                  <strong>{contract.title}</strong>
                  {contract.format && (
                    <em className="contract-format">
                      {contract.format === "external_transfer"
                        ? "внешняя передача"
                        : contract.format}
                      {contract.durationMinutes
                        ? ` · ${Math.round(contract.durationMinutes / 60)} ч`
                        : ""}
                    </em>
                  )}
                  {(contract.difficulty || contract.cruelty) && (
                    <span className="contract-tier">
                      {contract.difficulty && (
                        <em className={`tier-difficulty tier-${contract.difficulty}`}>
                          {difficultyLabel(contract.difficulty)}
                        </em>
                      )}
                      {contract.cruelty && (
                        <em className={`tier-cruelty tier-${contract.cruelty}`}>
                          {crueltyLabel(contract.cruelty)}
                        </em>
                      )}
                    </span>
                  )}
                </div>
                <b>{contract.rewards?.credits || 0} cr</b>
              </header>
              <p>{contract.description}</p>
              <div className="contract-requirements">
                {rows.map((row, i) => (
                  <span className={row.met ? "met" : ""} key={i}>
                    {row.met ? "✓" : "·"}{" "}
                    {conditionLabels[row.condition.key || row.condition.type] ||
                      row.condition.key}{" "}
                    <b>
                      {typeof row.current === "number"
                        ? Math.round(row.current)
                        : "—"}{" "}
                      {row.condition.operator} {String(row.condition.value)}
                    </b>
                  </span>
                ))}
              </div>
              {rp && (
                <div className="contract-return-profile">
                  <small>ПОСЛЕДСТВИЯ ВОЗВРАТА</small>
                  {(rp.acute_state?.capacity != null ||
                    rp.acute_state?.tension != null ||
                    rp.acute_state?.sensitivity != null ||
                    rp.acute_state?.attitude != null) && (
                    <span>
                      Острый сдвиг:{" "}
                      {[
                        rp.acute_state?.capacity != null
                          ? `выносливость ${rp.acute_state.capacity > 0 ? "+" : ""}${rp.acute_state.capacity}`
                          : null,
                        rp.acute_state?.tension != null
                          ? `напряжение ${rp.acute_state.tension > 0 ? "+" : ""}${rp.acute_state.tension}`
                          : null,
                        rp.acute_state?.sensitivity != null
                          ? `чувствительность ${rp.acute_state.sensitivity > 0 ? "+" : ""}${rp.acute_state.sensitivity}`
                          : null,
                        rp.acute_state?.attitude != null
                          ? `принятие ${rp.acute_state.attitude > 0 ? "+" : ""}${rp.acute_state.attitude}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}
                  {rp.recovery?.durationDays && (
                    <span>
                      Восстановление {rp.recovery.durationDays} сут.
                      {rp.recovery.method ? ` (${rp.recovery.method})` : ""}
                    </span>
                  )}
                  {rp.traumatic?.map((t, i) => (
                    <span key={i} className="traumatic">
                      {t.trigger && `Триггер: ${t.trigger}. `}
                      {t.response}
                    </span>
                  ))}
                  {rp.temporary?.map((t, i) => (
                    <span key={i} className="temporary">
                      {t.impulse}
                    </span>
                  ))}
                </div>
              )}
              {contract.state === "available" ? (
                <button disabled={busy} onClick={() => onAccept(contract)}>
                  {t('game.ui.acceptOrder')}
                </button>
              ) : contract.state === "in_transfer" ? (
                <span className="contract-in-transfer-note">
                  Актив вернётся автоматически после передачи
                </span>
              ) : (
                <>
                  <button
                    className="deliver"
                    disabled={busy || !ready}
                    onClick={() => onDeliver(contract)}
                  >
                    {ready
                      ? `Передать: ${subjectName}`
                      : `${subjectName} пока не соответствует`}
                  </button>
                  <button
                    className="refuse"
                    disabled={busy}
                    onClick={() => onRefuse(contract)}
                  >
                    {t('game.ui.refuseOrder') || "Отказаться"}
                  </button>
                </>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}

function InventoryView({
  items,
  embedded = false,
}: {
  items: InventoryItem[];
  embedded?: boolean;
}) {
  const { t } = useI18n();
  return (
    <section className={embedded ? "embedded-inventory" : "management-screen"}>
      {!embedded && (
        <header className="screen-heading">
          <div>
            <p>{t('game.ui.accounting')}</p>
            <h1>{t('game.ui.property')}</h1>
            <span>
              {t('game.ui.accountingIntro')}
            </span>
          </div>
          <b>{items.length} {t('game.ui.positions')}</b>
        </header>
      )}
      <div className="inventory-grid">
        {items.map((item) => {
          const translated = translateItem(item.itemId, t);
          return (
          <article key={item.itemId}>
            <div>
              <small>{item.type}</small>
              <strong>{translated?.name || item.name}</strong>
              <p>{translated?.description || item.description}</p>
            </div>
            <b>{item.charges >= 0 ? `×${item.charges}` : t('game.ui.permanent')}</b>
          </article>
          );
        })}
      </div>
    </section>
  );
}

function StationStorage({
  inventory,
  laboratory,
}: {
  inventory: InventoryItem[];
  laboratory: LabAsset[];
}) {
  const { t } = useI18n();
  const groups = [
    { id: "capsule", label: t('game.ui.capsuleDrugs') },
    { id: "medical", label: t('game.ui.medicalSupplies') },
    { id: "equipment", label: t('game.ui.portableEquipment') },
    { id: "clothing", label: t('game.ui.clothingAndGear') },
  ] as const;
  return (
    <section className="management-section station-storage">
      <header className="station-section-heading">
        <div>
          <small>{t('game.ui.storageAccounting')}</small>
          <h2>{t('game.ui.complexProperty')}</h2>
        </div>
        <span>
          {t('game.ui.storageCount').replace('{n}', String(inventory.length)).replace('{m}', String(laboratory.length))}
        </span>
      </header>
      <h2>{t('game.ui.installedInLab')}</h2>
      <div className="installed-module-grid">
        {laboratory.map((asset) => (
          <article key={asset.id}>
            <small>{asset.metadata?.subjectId ? t('game.ui.busy') : t('game.ui.ready')}</small>
            <strong>{getDeviceName(asset.id, t)}</strong>
            <p>{asset.description}</p>
            <span>
              {asset.metadata?.subjectId
                ? t('game.ui.assetPlaced')
                : t('game.ui.systemAvailable')}
            </span>
          </article>
        ))}
      </div>
      {groups.map((group) => {
        const items = inventory.filter(
          (item) => item.storageGroup === group.id,
        );
        return items.length ? (
          <div className="storage-group" key={group.id}>
            <h2>{group.label}</h2>
            <div className="inventory-grid">
              {items.map((item) => {
                const translated = translateItem(item.itemId, t);
                return (
                <article key={item.itemId}>
                  <div>
                    <small>{item.type}</small>
                    <strong>{translated?.name || item.name}</strong>
                    <p>{translated?.description || item.description}</p>
                  </div>
                  <b>{item.charges >= 0 ? `×${item.charges}` : t('game.ui.permanent')}</b>
                </article>
                );
              })}
            </div>
          </div>
        ) : null;
      })}
      {!inventory.length && (
        <p className="empty-screen">{t('game.ui.emptyInventory')}</p>
      )}
    </section>
  );
}

function JournalView({ events }: { events: Scenario["events"] }) {
  const { t } = useI18n();
  return (
    <main className="management-screen">
      <header className="screen-heading">
        <div>
          <p>{t('game.ui.chronicle')}</p>
          <h1>{t('game.ui.sectorJournal')}</h1>
          <span>
            {t('game.ui.journalDescription')}
          </span>
        </div>
      </header>
      <section className="journal-list">
        {events.length ? (
          events.map((event) => (
            <article key={event.id}>
              <small>{event.type}</small>
              <strong>{event.title}</strong>
              <p>{event.description}</p>
            </article>
          ))
        ) : (
          <p className="empty-screen">{t('game.ui.noEventsYetShort')}</p>
        )}
      </section>
    </main>
  );
}
