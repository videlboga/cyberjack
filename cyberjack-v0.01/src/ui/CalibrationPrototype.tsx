import React, { useEffect, useRef, useState } from "react";
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
  baselineLocalSensitivity?: number;
};
type ActiveContext = {
  actionId: string;
  pointId?: string;
  label?: string;
  type?: string;
  occupiesPoints?: string[];
  blocksPoints?: string[];
};
type State = {
  sensitivity: number;
  capacity: number;
  openness: number;
  attitude: number;
  tension: number;
  plasticity: number;
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
  action?: { label: string };
  currentState?: { title: string; description: string };
  uiText: string;
  technicalText: string;
  learning?: { effect: number };
  contexts?: { id: string }[];
  transitions?: { title: string; text: string; severity: string }[];
};
type ChatLine = { id: string; speaker: string; text: string; context?: string };
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
    id: "eq_clothe_panties",
    label: "Надеть трусики",
    hint: "Закрыть интимные зоны",
    group: "equipment",
    pointId: "systemic",
    hideWhenContext: "eq_clothe_panties",
  },
  {
    id: "eq_clothe_panties_remove",
    label: "Снять трусики",
    hint: "Открыть интимные зоны",
    group: "equipment",
    pointId: "systemic",
    requiresContext: "eq_clothe_panties",
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
      ? "Ровный контакт принят. Повтор укрепляет отношение, но теряет новизну."
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
const conditionValue = (condition: ContractCondition, state: State | null) => {
  if (!state) return undefined;
  if (condition.type === "attitude") return state.attitude;
  if (condition.type === "custom" && condition.key)
    return (state as any)[condition.key];
  return undefined;
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
  onExit?: () => void;
} = {}) {
  const SUBJECT = subjectId;
  const [phase, setPhase] = useState<Phase>("preparation"),
    [actionGroup, setActionGroup] = useState<ActionGroup>("contact"),
    [selectedActionId, setSelectedActionId] = useState("gentle_stroke"),
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
    [historyOpen, setHistoryOpen] = useState(false),
    [menuOpen, setMenuOpen] = useState(false),
    [diagnosticsOpen, setDiagnosticsOpen] = useState(false),
    [subject, setSubject] = useState<State | null>(null),
    [telemetry, setTelemetry] = useState<Telemetry | null>(null),
    [lastStateBefore, setLastStateBefore] = useState<State | null>(null),
    [contracts, setContracts] = useState<ContractInfo[]>([]),
    [trackedContractId, setTrackedContractId] = useState<string | null>(() =>
      localStorage.getItem("cyberjack.trackedContract"),
    ),
    [currentObservation, setCurrentObservation] = useState<Obs | null>(null),
    [protocolMode, setProtocolMode] = useState<ProtocolMode>("exact"),
    [probes, setProbes] = useState<string[]>([]),
    [findings, setFindings] = useState<string[]>([]),
    [entries, setEntries] = useState<Entry[]>([]),
    [protocol, setProtocol] = useState<Step[]>([]),
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
    setTelemetry(d.telemetry || null);
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
      [
        ...current,
        ...lines.map((line) => ({ ...line, id: crypto.randomUUID() })),
      ].slice(-10),
    );
  const loadContracts = async () => {
    const q = await fetch("/api/contracts?playerId=PL-1"),
      d = await q.json();
    if (!d.success) throw new Error(d.error);
    setContracts([...(d.accepted || []), ...(d.available || [])]);
    return d;
  };
  const loadChat = async () => {
    const q = await fetch(`/api/characters/${SUBJECT}/chat?limit=10`),
      d = await q.json();
    if (!d.success) throw new Error(d.error);
    setChatLines(
      (d.messages || []).map((m: any) => ({
        id: String(m.id),
        speaker: m.role === "assistant" ? "mira" : "calibrator",
        text: m.content,
        context: m.contextLabel,
      })),
    );
    return d;
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
      await fetch("/api/attempt/reset-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId: SUBJECT, sceneId: SCENE }),
      });
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
      setChatLines([]);
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
            "eq_clothe_jumpsuit",
            "eq_clothe_panties",
            "eq_clothe_lab_gown",
            "eq_clothe_calibration_set",
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
      let after = await load(),
        shared = (d.diagnostics || d.bundle?.diagnostics)?.observation as
          Obs | undefined,
        insight =
          shared?.uiText ||
          observation(item.actionId, d.tickResult, before, after);
      recordObservation(item.label, shared, insight, metricLine(d.tickResult));
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
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const repeat = (key: string) =>
    setProtocol((x) =>
      x.map((s) => (s.key === key ? { ...s, repeat: (s.repeat % 3) + 1 } : s)),
    );
  const run = async () => {
    if (!protocol.length || busy) return;
    setBusy(true);
    setRunning(true);
    stopRef.current = false;
    try {
      for (const item of protocol) {
        if (stopRef.current) break;
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
      }
    } catch (e: any) {
      setError(e.message);
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
    visibleActions = actions.filter(
      (a) =>
        a.group === actionGroup &&
        (!a.requiresContext || activeContextIds.has(a.requiresContext)) &&
        (!a.hideWhenContext || !activeContextIds.has(a.hideWhenContext)) &&
        (a.group !== "contact" ||
          a.id === "wait" ||
          zonesForAction(a).some((z) => z.id === selectedZoneId)),
    ),
    selectedAction =
      visibleActions.find((a) => a.id === selectedActionId) ||
      visibleActions[0],
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
          .filter(
            (c) =>
              !c.actionId.startsWith("effect_") &&
              c.actionId !== "device_sensory_loop",
          )
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
    trackedContract = contracts.find((c) => c.id === trackedContractId) || null,
    goalRows = (trackedContract?.conditions || []).map((condition) => {
      const value = conditionValue(condition, subject),
        movement = conditionMovement(condition, lastStateBefore, subject);
      return {
        condition,
        value,
        movement,
        met:
          value !== undefined &&
          conditionMet(value, condition.operator, condition.value),
      };
    }),
    readyCount = goalRows.filter((x) => x.met).length,
    currentState =
      currentObservation?.currentState || stateFromContexts(subject),
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
          <h3>Надето</h3>
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
          <h3>Положение и состояние</h3>
          {otherContexts.length ? (
            <div className="context-list">
              {otherContexts.map((c, i) => (
                <div key={`${c.actionId}-${i}`}>
                  <span>{c.type === "pose" ? "Положение" : "Состояние"}</span>
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
          <div className="character-stage">
            <div className="portrait-placeholder">
              <span>{subjectName.slice(0, 1).toUpperCase()}</span>
              <small>ОБЛАСТЬ ИЗОБРАЖЕНИЯ ПЕРСОНАЖА</small>
            </div>
            {nearbyCharacters.length > 0 && (
              <div className="calibration-presence">
                <small>ПРИСУТСТВУЮТ</small>
                {nearbyCharacters.map((character) => (
                  <div key={character.id}>
                    <b>{character.name.slice(0, 1)}</b>
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
            <div className="character-chat">
              <header>
                <strong>КАНАЛ КАЛИБРОВКИ</strong>
                <span>{chatLines.length}/10</span>
              </header>
              <div className="chat-scroll">
                {!chatLines.length && !generatingSpeech && (
                  <p className="chat-empty">Реплик пока нет.</p>
                )}
                {chatLines.slice(-2).map((line) => (
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
            <div className="scene-monitor-contexts">
              {visibleContexts.slice(0, 3).map((context, index) => (
                <span key={`${context.actionId}-monitor-${index}`}>
                  {context.label || context.actionId}
                </span>
              ))}
              {visibleContexts.length > 3 && (
                <span>+{visibleContexts.length - 3}</span>
              )}
            </div>
            <div
              className={`scene-monitor state-${currentObservation?.behavioralState || "responsive"}`}
            >
              <strong>{currentState.title}</strong>
              <div className="scene-monitor-lines">
                {telemetry?.signals
                  .filter((signal) =>
                    ["pulse", "breathing", "contact"].includes(signal.id),
                  )
                  .map((signal) => (
                    <span key={`monitor-${signal.id}`}>
                      <b>{signal.label}:</b> {signal.value}
                      {signal.trend === "up"
                        ? ", растёт"
                        : signal.trend === "down"
                          ? ", снижается"
                          : ""}
                      .
                    </span>
                  ))}
              </div>
              <p>
                {currentObservation?.uiText ||
                  telemetry?.behavioral?.[0] ||
                  `${subjectName} ожидает следующего действия калибратора.`}
              </p>
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
          <section className="operation-goal">
            <small>ЦЕЛЬ</small>
            <select
              aria-label="Цель калибровки"
              value={trackedContractId || ""}
              onChange={(event) => trackContract(event.target.value || null)}
            >
              <option value="">Свободная работа</option>
              {contracts.map((contract) => (
                <option value={contract.id} key={`goal-${contract.id}`}>
                  {contract.title}
                </option>
              ))}
            </select>
            {trackedContract ? (
              <div>
                {goalRows.slice(0, 4).map((row, index) => {
                  const movement = row.movement?.closer || 0;
                  return (
                    <span
                      key={`goal-condition-${index}`}
                      className={row.met ? "met" : movement < 0 ? "away" : ""}
                    >
                      <i>
                        {row.met
                          ? "✓"
                          : movement > 0
                            ? "↑"
                            : movement < 0
                              ? "↓"
                              : "·"}
                      </i>
                      {conditionLabels[
                        row.condition.key || row.condition.type
                      ] ||
                        row.condition.key ||
                        row.condition.type}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p>Контракт не выбран</p>
            )}
          </section>
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
          {selectedAction && (
            <div className="operation-toolbar">
              <div className="target-selector">
                <small>ЗОНА</small>
                {selectedAction.pointId ? (
                  <div className="fixed-target">
                    <strong>
                      {selectedZone?.label || selectedAction.pointId}
                    </strong>
                    <span>задана</span>
                  </div>
                ) : (
                  <>
                    <button onClick={() => setZoneOpen((v) => !v)}>
                      <strong>{selectedZone?.label || "Выберите"}</strong>
                      <span>▾</span>
                    </button>
                    {zoneOpen && (
                      <div className="zone-popover">
                        {zoneGroups.map((group) => {
                          const groupZones = compatibleZones.filter((z) =>
                            group.points.includes(z.id),
                          );
                          return groupZones.length ? (
                            <section key={group.id}>
                              <h4>{group.label}</h4>
                              <div>
                                {groupZones.map((z) => {
                                  const blocked = blockedPoints.has(z.id);
                                  return (
                                    <button
                                      key={z.id}
                                      disabled={blocked}
                                      title={
                                        blocked
                                          ? "Зона закрыта активным контекстом"
                                          : ""
                                      }
                                      onClick={() => {
                                        setSelectedZoneId(z.id);
                                        setZoneOpen(false);
                                      }}
                                    >
                                      <strong>{z.label}</strong>
                                      <small>
                                        {blocked
                                          ? "Недоступна"
                                          : `чувств. ${z.local_sensitivity.toFixed(0)} · принятие ${z.local_attitude.toFixed(0)}`}
                                      </small>
                                    </button>
                                  );
                                })}
                              </div>
                            </section>
                          ) : null;
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          <div className="operation-list compact-grid">
            {visibleActions.map((a) => (
              <button
                title={a.hint}
                className={`${selectedAction?.id === a.id ? "selected" : ""} ${probes.includes(a.id) ? "probed" : ""}`}
                key={a.id}
                onClick={() => {
                  setSelectedActionId(a.id);
                  setZoneOpen(false);
                }}
              >
                <strong>{a.label}</strong>
              </button>
            ))}
          </div>
          {selectedAction && (
            <div className="selected-operation compact-execution">
              <div className="selected-copy">
                <strong>{selectedAction.label}</strong>
                <span>{selectedAction.hint}</span>
              </div>
              <div className="operation-actions">
                <button
                  className="execute"
                  onClick={() => manual(selectedAction)}
                  disabled={
                    busy ||
                    Boolean(selectedZone && blockedPoints.has(selectedZone.id))
                  }
                >
                  Выполнить
                </button>
                {phase === "preparation" && (
                  <button
                    onClick={() => add(selectedAction)}
                    disabled={Boolean(
                      selectedZone && blockedPoints.has(selectedZone.id),
                    )}
                  >
                    + Протокол
                  </button>
                )}
              </div>
            </div>
          )}
          {phase === "preparation" && (
            <div className={`compact-protocol ${protocolOpen ? "open" : ""}`}>
              <div className="protocol-bar">
                <button
                  className="protocol-toggle"
                  onClick={() => setProtocolOpen((v) => !v)}
                >
                  <span>
                    Протокол · {protocol.reduce((n, s) => n + s.repeat, 0)}{" "}
                    шагов
                  </span>
                  <b>{protocolOpen ? "−" : "+"}</b>
                </button>
                <button
                  className={running ? "protocol-stop" : "protocol-quick-run"}
                  disabled={!running && (busy || !protocol.length)}
                  onClick={() => (running ? (stopRef.current = true) : run())}
                >
                  {running ? "■" : "▶"}
                </button>
              </div>
              {protocolOpen && (
                <div className="protocol-overlay">
                  {protocol.length ? (
                    <ol>
                      {protocol.map((s, i) => (
                        <li key={s.key}>
                          <span>{i + 1}</span>
                          <div>
                            <strong>
                              {s.label} {s.repeat > 1 && `×${s.repeat}`}
                            </strong>
                            <small>
                              {s.pointLabel || s.pointId || "системно"}
                            </small>
                          </div>
                          <div className="compact-step-tools">
                            <button onClick={() => move(i, -1)}>↑</button>
                            <button onClick={() => move(i, 1)}>↓</button>
                            <button onClick={() => repeat(s.key)}>×</button>
                            <button
                              onClick={() =>
                                setProtocol((x) =>
                                  x.filter((v) => v.key !== s.key),
                                )
                              }
                            >
                              ✕
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="muted">Очередь пуста</p>
                  )}
                </div>
              )}
            </div>
          )}
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
