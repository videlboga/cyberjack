import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "./i18n";
import { getRoomName, getDeviceName, getRoomDescription } from './roomTranslations';
import {
  CalibrationPrototype,
  CalibrationZoneMap,
  calibrationActions,
  ActionDef,
  actionIntensity,
  actionSemanticFallback,
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
import "./MangaTheme.css";
import "./Manga2Theme.css";
import { CharacterPortrait } from "./CharacterPortrait";
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
import { gameAudio } from "./gameAudio";
import {
  GameActionEffect,
  GamePortraitReactionEffect,
  GamePeakEffect,
  GameSustainedEffect,
  gameEffectDurationMs,
} from "./GameVisualEffects";
import { resolveActionButtonImage } from "../domain/actionButtonVisual";
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
  state?: SubjectState | null;
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
  protocolId: string;
  targetPointIds: string[];
  startedAtTick: number | null;
  updatedAtTick: number;
  targetMode?:
    | "manual"
    | "edge"
    | "positive"
    | "negative"
    | "mixed"
    | "orgasm"
    | "exhaustion";
  rhythm?: "steady" | "pulse" | "wave" | "random";
  orgasmPolicy?: "deny" | "allow" | "force" | "repeat";
  valencePolicy?: "adaptive" | "neutral" | "positive" | "negative" | "mixed";
  maxTension?: number;
  minCapacity?: number;
  durationMinutes?: number;
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
    deviceSession?: DeviceSession;
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

const capsulePortraitFor = (resident: Resident): string | null => {
  const subjectId = resident.subjectId || resident.id;
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
              : subjectId === "NPC-CAND-GEN-04"
                ? "mai"
            : null;
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
  const [uiTheme, setUiTheme] = useState<
    "industrial" | "graphite" | "paper" | "mist" | "manga" | "manga2"
  >(() => {
    if (window.location.pathname.startsWith("/manga2")) return "manga2";
    if (window.location.pathname.startsWith("/manga")) return "manga2";
    return "manga2";
  });
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
  const animationsPausedByTime = useRef<Animation[]>([]);
  const [inbox, setInbox] = useState<DirectorEvent[]>([]);
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
  const resumeTimeFlow = useCallback(() => {
    if (!timeFlow?.paused) return;
    setTimeFlow((current) => current ? { ...current, paused: false, running: true } : current);
    void api("/api/scenario/time/flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: false }),
    }).then((data) => setTimeFlow(data.timeFlow)).catch((e: any) => setError(e.message));
  }, [timeFlow?.paused]);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("game-time-paused", Boolean(timeFlow?.paused));
    if (timeFlow?.paused) {
      animationsPausedByTime.current = (document.getAnimations?.() || [])
        .filter((animation) => animation.playState === "running");
      animationsPausedByTime.current.forEach((animation) => animation.pause());
    } else {
      animationsPausedByTime.current.forEach((animation) => {
        if (animation.playState === "paused") animation.play();
      });
      animationsPausedByTime.current = [];
    }
  }, [timeFlow?.paused]);
  useEffect(() => () => document.documentElement.classList.remove("game-time-paused"), []);
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
          ["lab_recovery_capsule", "lab_sex_machine"].includes(asset.id),
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
      onClickCapture={(event) => {
        const target = event.target as HTMLElement | null;
        if (!target?.closest(".campaign-time-control, .calibration-time-control")) resumeTimeFlow();
      }}
      onSubmitCapture={() => resumeTimeFlow()}
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
        <label className="theme-switcher" style={{ display: "none" }}>
          <small>{t('game.ui.topic')}</small>
          <select
            aria-label="Тема интерфейса"
            value={uiTheme}
            onChange={(event) =>
              setUiTheme(
                event.target.value as
                  "industrial" | "graphite" | "paper" | "mist" | "manga" | "manga2",
              )
            }
          >
            <option value="manga2">Manga 2</option>
          </select>
        </label>
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
                state: resident.state,
                contexts: resident.contexts,
              }))}
              uiTheme={uiTheme}
              onThemeChange={setUiTheme}
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
              onPassTime={(minutes) =>
                mutate(
                  "/api/scenario/time/pass",
                  { playerId: "PL-1", minutes },
                  `Прошло ${minutes} минут`,
                )
              }
              onUse={(asset, resident) =>
                mutate(
                  `/api/scenario/laboratory/${asset.id}/use`,
                  { playerId: "PL-1", subjectId: resident.id },
                  asset.metadata?.subjectId === resident.id
                    ? `${resident.name}: устройство освобождено`
                    : `${resident.name}: ${asset.name}`,
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
  onPassTime,
  onUse,
}: {
  scenario: Scenario;
  busy: boolean;
  focusCharacterId: string | null;
  onFocusHandled: () => void;
  onOpenDossier: (resident: Resident) => void;
  onMove: (resident: Resident, roomId: string) => void;
  onInteract: (resident: Resident) => void;
  onRefresh: () => Promise<void>;
  onPassTime: (minutes: number) => Promise<boolean>;
  onUse: (asset: LabAsset, resident: Resident) => Promise<boolean> | void;
}) {
  const { t } = useI18n();
  const equipmentCovers: Record<string, string> = {
    lab_diagnostic_table: "/backgrounds/laboratory/diagnostic_table.png",
    lab_recovery_capsule:
      "/backgrounds/laboratory/capsule_outpaint_masked_d1.0.png",
    lab_sex_machine: "/backgrounds/laboratory/sex_machine.png",
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
          onPassTime={onPassTime}
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
            <section className="room-detail-section room-equipment-section">
              <h3>{t('game.ui.equipmentSection')}</h3>
              <div className="room-equipment">
                {roomAssets.length ? (
                  roomAssets.map((asset) => {
                    const acceptsAsset = [
                      "lab_recovery_capsule",
                      "lab_diagnostic_table",
                      "lab_sex_machine",
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
          </div>
        )}
      </section>
    </main>
  );
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
    "overview" | "state" | "zones" | "learning" | "history"
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
  return (
    <main className="character-dossier">
      <header>
        <button onClick={() => onSelect(null)}>← Назад</button>
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
            />
          </div>
          <small>
            {selected.role === "assistant"
              ? "ПЕРСОНАЛ"
              : selected.role === "asset"
                ? "АКТИВ"
                : "ПЕРСОНАЖ"}
          </small>
          <h1>{selected.name}</h1>
          <p>{selected.title}</p>
          <ContextSummary contexts={selected.contexts} />
          <button className="primary" onClick={() => onLocate(selected)}>
            Перейти к персонажу
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
              Состояние
            </button>
            <button
              className={tab === "zones" ? "active" : ""}
              onClick={() => setTab("zones")}
            >
              Зоны
            </button>
            <button
              className={tab === "learning" ? "active" : ""}
              onClick={() => setTab("learning")}
            >
              Обучение
            </button>
            <button
              className={tab === "history" ? "active" : ""}
              onClick={() => setTab("history")}
            >
              Хроника
            </button>
          </nav>
          {tab === "overview" && (
            <div className="dossier-information-grid">
              <article className="dossier-biography">
                <small>{t('game.ui.biography')}</small>
                <p>
                  {selected.biography ||
                    selected.description ||
                    "Описание пока отсутствует."}
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
                        ? "испытуемая"
                        : selected.kind === "npc"
                          ? "персонаж"
                          : "оператор"}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('game.ui.status')}</dt>
                    <dd>
                      {selected.role === "asset"
                        ? "актив"
                        : selected.role === "assistant"
                          ? "персонал"
                          : selected.role}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('game.ui.presence')}</dt>
                    <dd>{selected.presenceState || "не указано"}</dd>
                  </div>
                  <div>
                    <dt>{t('game.ui.positionRole')}</dt>
                    <dd>
                      {selected.currentRole || selected.title || "не назначена"}
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
                    ? "Содержится в лаборатории как актив и доступна для подготовки к контрактам."
                    : "Состоит в штате лаборатории и имеет рабочее назначение."}
                </p>
                <div className="role-management">
                  {selected.role === "asset" ? (
                    <button
                      disabled={busy}
                      onClick={() =>
                        window.confirm(`Назначить ${selected.name} в штат?`) &&
                        onChangeRole(selected, "staff")
                      }
                    >
                      Назначить в штат
                    </button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() =>
                        window.confirm(
                          `Оформить ${selected.name} как актив? Рабочее назначение будет снято.`,
                        ) && onChangeRole(selected, "asset")
                      }
                    >
                      Оформить как актив
                    </button>
                  )}
                  <small>
                    Изменение статуса занимает 20 минут и требует свободного
                    места.
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
                      Благоприятное принятие:{" "}
                      {favored.map((point) => point.label).join(", ")}.
                    </p>
                  )}
                  {avoided.length > 0 && (
                    <p>
                      Сопротивление:{" "}
                      {avoided.map((point) => point.label).join(", ")}.
                    </p>
                  )}
                  {sensitive.length > 0 && (
                    <p>
                      Повышенная чувствительность:{" "}
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
                <small>{t('game.ui.localIndicators')}</small>
                {observedPoints.length ? (
                  <div className="dossier-point-table">
                    <header>
                      <span>{t('game.ui.zone')}</span>
                      <span>{t('game.ui.sensitivity')}</span>
                      <span>{t('game.ui.acceptance')}</span>
                      <span>{t('game.ui.openness')}</span>
                      <span>{t('game.ui.familiarity')}</span>
                      <span>{t('game.ui.measurements')}</span>
                    </header>
                    {observedPoints.map((point) => {
                      const pointSensitivity = interpretPointSensitivity(
                        point.id,
                        point.sensitivity,
                        point.baselineSensitivity,
                      );
                      const pointAttitude = interpretPointAttitude(
                        point.id,
                        point.attitude,
                        point.baselineAttitude,
                      );
                      return (
                        <div key={point.id}>
                          <b>{point.label}</b>
                          <span>
                            {pointSensitivity.humanPercent}%{" "}
                            <i>И {Math.round(point.sensitivity)}</i>
                          </span>
                          <span>
                            {pointAttitude.humanPercent}%{" "}
                            <i>И {Math.round(point.attitude)}</i>
                          </span>
                          <span>И {Math.round(point.openness)}</span>
                          <span>{Math.round(point.familiarity)}</span>
                          <span>{point.exposureCount}</span>
                        </div>
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
          {tab === "history" && (
            <article className="dossier-history-panel">
              <header>
                <div>
                  <small>{t('game.ui.characterChronicle')}</small>
                  <b>{selected.history?.length || 0} событий</b>
                </div>
                <span>{t('game.ui.newEntriesFirst')}</span>
              </header>
              <div className="dossier-history">
                {selected.history?.length ? (
                  [...selected.history]
                    .sort(
                      (a, b) =>
                        Number(b.worldMinute || 0) - Number(a.worldMinute || 0),
                    )
                    .map((event) => (
                      <div className="dossier-history-event" key={event.id}>
                        <time>
                          {event.time ||
                            (typeof event.worldMinute === "number"
                              ? `День ${Math.floor(event.worldMinute / 1440) + 1}`
                              : "Без даты")}
                        </time>
                        <em>{event.type}</em>
                        <section>
                          <b>{event.title}</b>
                          {event.description && <p>{event.description}</p>}
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
        />
      </div>
      <div>
        <small>{resident.role === "assistant" ? "ПЕРСОНАЛ" : "АКТИВ"}</small>
        <strong>{resident.name}</strong>
        <span>{resident.title}</span>
        {state && (
          <p>
            Ресурс {Math.round(state.capacity || 0)} · напряжение{" "}
            {Math.round(state.tension || 0)}
          </p>
        )}
      </div>
      <i>Открыть досье →</i>
    </button>
  );
}

function ContextSummary({
  contexts = [],
}: {
  contexts?: Resident["contexts"];
}) {
  const clothing = contexts.filter((context) =>
    context.id.startsWith("eq_clothe_"),
  );
  const active = contexts.filter(
    (context) => !context.id.startsWith("eq_clothe_"),
  );
  return (
    <div className="character-context-summary">
      <small>ОДЕЖДА</small>
      <p>
        {clothing.length
          ? clothing
              .map((context) => context.label.replace(/^Надеть\s+/i, ""))
              .join(" · ")
          : "Нет одежды"}
      </p>
      <small>АКТИВНЫЕ КОНТЕКСТЫ</small>
      <p>
        {active.length
          ? active.map((context) => context.label).join(" · ")
          : "Нет"}
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

function DeviceControlScreen({
  asset,
  resident,
  clock,
  busy,
  onRefresh,
  onPassTime,
  onRelease,
  onExit,
}: {
  asset: LabAsset;
  resident: Resident;
  clock: Scenario["clock"];
  busy: boolean;
  onRefresh: () => Promise<void>;
  onPassTime: (minutes: number) => Promise<boolean>;
  onRelease?: () => Promise<void>;
  onExit: () => void;
}) {
  const { t } = useI18n();
  const session = asset.metadata?.deviceSession;
  const [lines, setLines] = useState<CharacterChatLine[]>([]);
  const [text, setText] = useState("");
  const [working, setWorking] = useState(false);
  const [chatWaiting, setChatWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operatorNote, setOperatorNote] = useState("");
  const subjectId = resident.subjectId || resident.id;
  const state = resident.state || {};
  const contextIds = new Set(
    (resident.contexts || []).map((context) => context.id),
  );
  const loadDeviceChat = useCallback(
    () =>
      api(`/api/characters/${subjectId}/chat?limit=100`).then((data) =>
        setLines(
          collapseRepeatedChatActions(
            (data.messages || []).map((message: any) =>
              chatLineFromStoredMessage(message, resident.name, subjectId),
            ),
          ),
        ),
      ),
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
              : subjectId === "NPC-CAND-GEN-04"
                ? "mai"
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
    "shock",
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
  const imagePath = `/character-images/sex-machine/${slug}__restrained__${affect}.png`;
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
  const targetModes = [
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
      | "durationMinutes"
    >
  > = {
    manual: {
      intensity: 40,
      rhythm: "steady",
      orgasmPolicy: "allow",
      valencePolicy: "neutral",
      maxTension: 95,
      minCapacity: 15,
      durationMinutes: 120,
    },
    edge: {
      intensity: 55,
      rhythm: "wave",
      orgasmPolicy: "deny",
      valencePolicy: "adaptive",
      maxTension: 88,
      minCapacity: 25,
      durationMinutes: 0,
    },
    positive: {
      intensity: 45,
      rhythm: "wave",
      orgasmPolicy: "allow",
      valencePolicy: "positive",
      maxTension: 90,
      minCapacity: 25,
      durationMinutes: 120,
    },
    negative: {
      intensity: 65,
      rhythm: "pulse",
      orgasmPolicy: "deny",
      valencePolicy: "negative",
      maxTension: 95,
      minCapacity: 15,
      durationMinutes: 120,
    },
    mixed: {
      intensity: 60,
      rhythm: "random",
      orgasmPolicy: "allow",
      valencePolicy: "mixed",
      maxTension: 95,
      minCapacity: 15,
      durationMinutes: 180,
    },
    orgasm: {
      intensity: 75,
      rhythm: "pulse",
      orgasmPolicy: "force",
      valencePolicy: "adaptive",
      maxTension: 100,
      minCapacity: 15,
      durationMinutes: 90,
    },
    exhaustion: {
      intensity: 55,
      rhythm: "steady",
      orgasmPolicy: "repeat",
      valencePolicy: "adaptive",
      maxTension: 95,
      minCapacity: 5,
      durationMinutes: 240,
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
          context: asset.name,
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
    return control("settings", { targetMode, ...targetPresets[targetMode] });
  };
  const machineRunning = session.status === "running";
  const machineEngaged = machineRunning || session.status === "paused";
  const tension = clampMetric(Number(state.tension || 0));
  const capacity = clampMetric(Number(state.capacity || 0));
  const maxTension = session.maxTension ?? 95;
  const minCapacity = session.minCapacity ?? 15;
  const tenMinuteHours = 1 / 6;
  const power = clampMetric(session.intensity) / 100;
  const projectedTension = clampMetric(
    Math.min(
      maxTension,
      tension +
        (6 + 16 * power) *
          tenMinuteHours *
          ((session.targetMode || "manual") === "negative" ? 1.2 : 1),
    ),
  );
  const projectedCapacity = clampMetric(
    Math.max(
      minCapacity,
      capacity -
        (2 + 8 * power) *
          tenMinuteHours *
          ((session.targetMode || "manual") === "exhaustion" ? 1.65 : 1),
    ),
  );
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
      ? "ПОРОГ"
      : session.phase === "intense"
        ? "УДЕРЖАНИЕ"
        : "РАЗГОН";
  const systemNote =
    operatorNote ||
    (risk >= 85
      ? "Протокол приблизился к установленному пределу. Рекомендуется снизить темп."
      : projectedTension >= maxTension
        ? "Следующий цикл выведет активацию к заданному пределу."
        : `Следующий цикл: активация +${Math.max(0, Math.round(projectedTension - tension))}, ресурс ${Math.round(projectedCapacity - capacity)}.`);
  const intervene = async (label: string, intensity: number) => {
    const nextIntensity = Math.max(10, Math.min(100, intensity));
    const adjusted =
      nextIntensity === session.intensity ||
      (await control("adjust", { intensity: nextIntensity }));
    if (!adjusted) return;
    const advanced = await onPassTime(10);
    if (advanced !== false)
      setOperatorNote(
        `${label} · мощность ${nextIntensity}% · выполнен цикл 10 мин.`,
      );
  };

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
          </div>
        </div>
        <section className="sex-machine-console">
          <section
            className={`sex-machine-live ${machineRunning ? "running" : ""}`}
          >
            <header>
              <div>
                <small>ТЕКУЩИЙ ПРОТОКОЛ</small>
                <strong>{activeMode[1]}</strong>
              </div>
              <span>
                <i />
                {machineRunning
                  ? "АКТИВЕН"
                  : session.status === "paused"
                    ? "ПАУЗА"
                    : "ГОТОВ"}
              </span>
            </header>
            <div className="sex-machine-readout">
              <span>
                <small>РИТМ</small>
                <b>{session.rhythm === "pulse" ? "ИМПУЛЬС" : session.rhythm === "wave" ? "ВОЛНА" : session.rhythm === "random" ? "СЛУЧАЙНЫЙ" : "РОВНЫЙ"}</b>
              </span>
              <span>
                <small>ПРЕДЕЛ</small>
                <b>{session.maxTension ?? 95}</b>
              </span>
              <span>
                <small>РЕЗЕРВ</small>
                <b>{session.minCapacity ?? 15}</b>
              </span>
            </div>
            <div className="sex-machine-power">
              <header>
                <span>МОЩНОСТЬ ВОЗДЕЙСТВИЯ</span>
                <b>
                  {session.intensity}
                  <small>%</small>
                </b>
              </header>
              <div>
                {Array.from({ length: 10 }, (_, index) => (
                  <button
                    aria-label={`Интенсивность ${(index + 1) * 10}%`}
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
                <small>ВЫБОР ПРОТОКОЛА</small>
                <span>{activeMode[3]}</span>
              </header>
              <div className="sex-machine-protocol-selector">
                <button
                  aria-label="Предыдущий протокол"
                  disabled={working}
                  onClick={() => selectAdjacentMode(-1)}
                >
                  ‹
                </button>
                <div>
                  <small>КАРТРИДЖ {String(activeModeIndex + 1).padStart(2, "0")} / {String(targetModes.length).padStart(2, "0")}</small>
                  <strong>{activeMode[1]}</strong>
                </div>
                <button
                  aria-label="Следующий протокол"
                  disabled={working}
                  onClick={() => selectAdjacentMode(1)}
                >
                  ›
                </button>
              </div>
              <div className="sex-machine-protocol-brief">
                <div>
                  <strong>{activeMode[1]}</strong>
                  <span>{activeMode[3]}</span>
                </div>
                <p>{activeMode[2]}</p>
              </div>
            </section>
          )}
          {machineEngaged && (
            <section
              className={`sex-machine-operation risk-${risk >= 85 ? "critical" : risk >= 60 ? "warning" : "stable"}`}
            >
              <header>
                <div>
                  <small>ВЕДЕНИЕ ПРОТОКОЛА</small>
                  <strong>{phaseLabel}</strong>
                </div>
                <span>
                  ЦИКЛ {String(Math.floor(elapsed / 10) + 1).padStart(2, "0")} ·{" "}
                  {elapsed} МИН
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
                    Сейчас
                  </span>
                  <span>
                    <i className="forecast" />
                    Через цикл
                  </span>
                  <span>
                    <i className="limit" />
                    Предел
                  </span>
                </footer>
              </div>
              <div className="sex-machine-operation-metrics">
                <article>
                  <small>АКТИВАЦИЯ</small>
                  <strong>{Math.round(tension)}</strong>
                  <span>→ {Math.round(projectedTension)}</span>
                </article>
                <article>
                  <small>РЕСУРС</small>
                  <strong>{Math.round(capacity)}</strong>
                  <span>→ {Math.round(projectedCapacity)}</span>
                </article>
                <article>
                  <small>РИСК</small>
                  <strong>{Math.round(risk)}</strong>
                  <span>
                    {risk >= 85
                      ? "Критический"
                      : risk >= 60
                        ? "Высокий"
                        : "Допустимый"}
                  </span>
                </article>
              </div>
              <p className="sex-machine-system-note">{systemNote}</p>
              {machineRunning && (
                <div className="sex-machine-interventions">
                  <button
                    disabled={working || busy}
                    onClick={() =>
                      intervene("Темп снижен", session.intensity - 15)
                    }
                  >
                    <strong>Снизить темп</strong>
                    <small>−15 мощности · сохранить ресурс</small>
                  </button>
                  <button
                    disabled={working || busy || session.intensity >= 100}
                    onClick={() =>
                      intervene("Импульс усилен", session.intensity + 15)
                    }
                  >
                    <strong>Усилить импульс</strong>
                    <small>+15 мощности · повысить риск</small>
                  </button>
                </div>
              )}
            </section>
          )}
          <div className="sex-machine-console-actions">
            {["loaded", "stopped"].includes(session.status) && (
              <button
                className="primary"
                disabled={working}
                onClick={() => control("start")}
              >
                <small>ПРОТОКОЛ: {activeMode[1]}</small>Запустить
              </button>
            )}
            {session.status === "running" && (
              <button onClick={() => control("pause")} disabled={working}>
                Пауза
              </button>
            )}
            {session.status === "paused" && (
              <button
                className="primary"
                onClick={() => control("resume")}
                disabled={working}
              >
                Продолжить
              </button>
            )}
            {["running", "paused"].includes(session.status) && (
              <button
                className="emergency"
                onClick={() => control("stop")}
                disabled={working}
              >
                Аварийная остановка
              </button>
            )}
          </div>
          {error && <p className="device-error">{error}</p>}
        </section>
        <div className="device-chat-panel character-chat residential-chat">
          <header>
            <strong>КАНАЛ УСТРОЙСТВА</strong>
            <span className="chat-channel-state">КАНАЛ ОТКРЫТ</span>
          </header>
          <CharacterChatFeed
            lines={lines}
            emptyText="Разговор ещё не начат."
            typing={chatWaiting}
            typingSpeaker={resident.name}
            typingActorId={subjectId}
            typingContext={asset.name}
            avatarSrc={(line) =>
              line.avatarPath ||
              (line.role !== "calibrator" && line.role !== "system"
                ? `/character-images/portraits/${slug}/${line.portraitEmotion || "neutral"}.png`
                : undefined)
            }
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
              placeholder={`Сказать: ${resident.name}`}
            />
            <button disabled={working || !text.trim()}>
              {working ? "…" : "Отправить"}
            </button>
          </form>
        </div>
      </section>
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
            .sort((left, right) => Number(left.id) - Number(right.id)),
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
      ? "Критическое истощение"
      : capsuleCapacity <= 30
        ? "Низкий ресурс"
        : null,
    capsuleActivation >= 85
      ? "Предельная активация"
      : capsuleActivation >= 70
        ? "Высокая активация"
        : null,
    Number(capsuleState.overload || 0) >= 10 ? "Сенсорная перегрузка" : null,
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
    legs: ["inner_thighs", "legs", "knees", "feet"],
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
    "knees",
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
    );
  };
  const actionDisplayTags = (action: ActionDef) => {
    if (action.group === "clothing") return ["одежда"];
    if (action.group === "pose") return ["поза"];
    const authoredTags = actionMetaFor(action.id)?.tags || [];
    return Array.from(
      new Set([...authoredTags, ...(actionSemanticFallback[action.id] || [])]),
    )
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
    knees: "legs",
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
              />
            )}
            {!equipmentMode && activeProcesses[0] && (
              <GameSustainedEffect
                actionId={activeProcesses[0].action.id}
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
                      АВТО ·{" "}
                      {Math.max(
                        0,
                        Math.floor(selectedProcess.context.ticksActive || 0),
                      )}{" "}
                      мин
                    </span>
                  </header>
                  <div className="control-process-intensity">
                    <span>
                      <b>
                        {selectedProcessLevel >= 3
                          ? "УСИЛЕННАЯ"
                          : selectedProcessLevel === 1
                            ? "НИЗКАЯ"
                            : "РАБОЧАЯ"}
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
                      <kbd>A</kbd> слабее
                    </button>
                    <button
                      disabled={!selectedProcess.faster || busy || sending}
                      onClick={() => processCommand("faster")}
                    >
                      <kbd>D</kbd> сильнее
                    </button>
                    <button
                      disabled={!selectedProcess.stop || busy || sending}
                      onClick={() => processCommand("stop")}
                    >
                      <kbd>E</kbd> завершить
                    </button>
                  </footer>
                </article>
              ) : (
                <div className="control-process-idle">
                  <i>●</i>
                  <strong>Нет активных процессов</strong>
                </div>
              )}
            </section>
          )}
        </div>
        {equipmentMode ? (
          <aside className="equipment-action-palette">
            <div className="capsule-infusion-panel">
              <header>
                <strong>СИСТЕМА ПОДАЧИ</strong>
                <small>
                  Одна медицинская ампула и один дополнительный состав
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
                            : `${infusion.effect}. Нет ампул в инвентаре.`
                        }
                        aria-label={`${infusion.label}. ${infusion.effect}`}
                        onClick={() => {
                          const action = infusionAction(infusion);
                          performAction(action, action.pointId);
                        }}
                      >
                        <strong>{infusion.label}</strong>
                        <small className="capsule-infusion-effect">
                          <b>ОЖИДАЕМЫЙ ЭФФЕКТ</b>
                          <span>{infusion.effect}</span>
                        </small>
                        <small className="action-card-tags">
                          <span>
                            {infusion.kind === "medical"
                              ? `ампул: ${charges}`
                              : "встроенный контур"}
                          </span>
                          {active && <span>активно</span>}
                          {!available && <span>нет в наличии</span>}
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
                  Воздействия
                </button>
                <button
                  className={operationMode === "setup" ? "active" : ""}
                  onClick={() => {
                    setOperationMode("setup");
                    setSelectedActionId("");
                    setZoneOpen(false);
                  }}
                >
                  Подготовка
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
                capsuleCapacity - capsuleActivation,
              )}
              activationNature={
                capsuleCapacity >= capsuleActivation
                  ? "ресурс сохранён"
                  : "ресурс расходуется"
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
            <strong>КАНАЛ КАМЕРЫ</strong>
            <span className="chat-channel-state">
              {presentResidents.length > 1
                ? `ПРИСУТСТВУЮТ: ${presentResidents.map((character) => character.name).join(" · ")}`
                : "КАНАЛ ОТКРЫТ"}
            </span>
          </header>
          <CharacterChatFeed
            lines={lines}
            emptyText="Разговор ещё не начат."
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
          <p>ОМНИКРОН · СТАНЦИОННЫЙ ТЕРМИНАЛ</p>
          <h1>{t('game.ui.station')}</h1>
          <span>Внешние связи лаборатории.</span>
        </div>
        <section>
          <small>ТЕКУЩИЙ УЗЕЛ</small>
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
          Обзор
        </button>
        <button
          className={tab === "supply" ? "active" : ""}
          onClick={() => setTab("supply")}
        >
          Снабжение · {scenario.shop.length}
        </button>
        <button
          className={tab === "storage" ? "active" : ""}
          onClick={() => setTab("storage")}
        >
          Склад · {scenario.inventory.length}
        </button>
      </nav>
      <div className="station-command-body">
        {tab === "overview" ? (
          <section className="station-overview">
            <div className="station-radial-panel">
              <header>
                <small>ОМНИКРОН</small>
                <strong>{t('game.ui.stationAroundLab')}</strong>
                <span>
                  Схема мира; активные ситуации приходят через каналы справа
                </span>
              </header>
              <div
                className="station-radial-map"
                aria-label="Схема колец станции"
              >
                <StationSchematic />
                <div className="station-node-marker">
                  <small>УЗЕЛ</small>
                  <b>CY-17</b>
                  <span>КАЛИБРАТОР</span>
                </div>
              </div>
              <footer>
                <span>
                  <i className="stable" /> внутренний контур
                </span>
                <span>
                  <i className="warning" /> внешние кольца
                </span>
                <span>
                  <i className="danger" /> граница Аномалии
                </span>
              </footer>
            </div>
            <div className="station-operations">
              <article className={inbox.length ? "attention" : ""}>
                <header>
                  <small>ВХОДЯЩИЕ</small>
                  <b>{inbox.length}</b>
                </header>
                <strong>{inbox.length ? inbox[0].title : "Канал чист"}</strong>
                <p>
                  {inbox.length
                    ? inbox[0].body
                    : "Новых разговоров и внешних возможностей пока нет."}
                </p>
                <button onClick={onOpenInbox}>
                  {inbox.length ? "Открыть входящие" : "Проверить канал"}
                </button>
              </article>
              <article className={activeContracts.length ? "active" : ""}>
                <header>
                  <small>КОНТРАКТЫ</small>
                  <b>{activeContracts.length}</b>
                </header>
                <strong>
                  {activeContracts.length
                    ? `${activeContracts.length} в работе`
                    : "Нет принятых заказов"}
                </strong>
                <p>
                  {activeContracts[0]?.title ||
                    `${contracts.filter((contract) => contract.state === "available").length} предложений доступны у Связного.`}
                </p>
                <button onClick={onOpenContracts}>К офису Связного</button>
              </article>
              <article className={limitedOffers.length ? "limited" : ""}>
                <header>
                  <small>СНАБЖЕНИЕ</small>
                  <b>{limitedOffers.length || scenario.shop.length}</b>
                </header>
                <strong>
                  {limitedOffers.length
                    ? "Ограниченная партия"
                    : "Каталог доступен"}
                </strong>
                <p>
                  {limitedOffers[0]
                    ? `${limitedOffers[0].name} · ${limitedOffers[0].supplier || "неизвестный поставщик"}`
                    : `${consumables.length} препаратов и ${equipment.length} позиций оснащения.`}
                </p>
                <button onClick={() => setTab("supply")}>
                  Открыть снабжение
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
        <strong>{offer.name}</strong>
        <p>{offer.description}</p>
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
          return (
            <article
              key={contract.id}
              className={contract.state === "accepted" ? "accepted" : ""}
            >
              <header>
                <div>
                  <small>
                    {contract.state === "accepted"
                      ? `ПРИНЯТ · ${hours} Ч ДО СРОКА`
                      : contract.issuerId}
                  </small>
                  <strong>{contract.title}</strong>
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
              {contract.state === "available" ? (
                <button disabled={busy} onClick={() => onAccept(contract)}>
                  {t('game.ui.acceptOrder')}
                </button>
              ) : (
                <button
                  className="deliver"
                  disabled={busy || !ready}
                  onClick={() => onDeliver(contract)}
                >
                  {ready
                    ? `Передать: ${subjectName}`
                    : `${subjectName} пока не соответствует`}
                </button>
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
            <p>УЧЁТ</p>
            <h1>{t('game.ui.property')}</h1>
            <span>
              Переносное оборудование, одежда и расходники калибратора.
            </span>
          </div>
          <b>{items.length} позиций</b>
        </header>
      )}
      <div className="inventory-grid">
        {items.map((item) => (
          <article key={item.itemId}>
            <div>
              <small>{item.type}</small>
              <strong>{item.name}</strong>
              <p>{item.description}</p>
            </div>
            <b>{item.charges >= 0 ? `×${item.charges}` : "постоянно"}</b>
          </article>
        ))}
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
          <small>СКЛАДСКОЙ УЧЁТ</small>
          <h2>{t('game.ui.complexProperty')}</h2>
        </div>
        <span>
          {inventory.length} позиций · {laboratory.length} установленных модулей
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
                ? "актив размещён"
                : "система доступна"}
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
              {items.map((item) => (
                <article key={item.itemId}>
                  <div>
                    <small>{item.type}</small>
                    <strong>{item.name}</strong>
                    <p>{item.description}</p>
                  </div>
                  <b>{item.charges >= 0 ? `×${item.charges}` : "постоянно"}</b>
                </article>
              ))}
            </div>
          </div>
        ) : null;
      })}
      {!inventory.length && (
        <p className="empty-screen">Склад переносимого имущества пуст.</p>
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
          <p className="empty-screen">Событий пока нет.</p>
        )}
      </section>
    </main>
  );
}
