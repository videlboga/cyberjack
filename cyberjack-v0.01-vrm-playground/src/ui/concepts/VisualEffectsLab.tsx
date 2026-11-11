import React, { useEffect, useState } from "react";
import type { PortraitEmotion } from "../../domain/portraitEmotion";
import actionPointMatrix from "../../infrastructure/data/visual/action-point-button-matrix.generated.json";
import actionPointAssets from "../../infrastructure/data/visual/action-point-assets.generated.json";
import { gameAudio } from "../gameAudio";
import "./VisualEffectsLab.css";
import "./VisualEffectsAvatarFit.css";
import "./VisualEffectsCinematic.css";
import "./VisualEffectsMontage.css";
import "./VisualEffectsVibration.css";
import "./VisualEffectsExtended.css";
import "./VisualEffectsPeaks.css";
import "./VisualEffectsSustained.css";

type Family =
  | "electric"
  | "vibration"
  | "impact"
  | "cold"
  | "heat"
  | "soft"
  | "sharp"
  | "restraint"
  | "pulse";
type Result = "accepted" | "mixed" | "rejected" | "overload";
type Peak = "discharge" | "overload" | "exhaustion" | "breakdown";
type ProcessTempo = "slow" | "steady" | "fast";
type ProcessKind = "friction" | "vibration" | "pulse" | "electric";
type ActionCombination = {
  pointId: string;
  actionId: string;
  actionLabel: string;
  assetPath: string;
};
const actionCombinations =
  actionPointMatrix.combinations as ActionCombination[];
const actionPoints = Object.keys(actionPointMatrix.points);
const pointNames: Record<string, string> = {
  hair: "Волосы",
  face: "Лицо",
  neck: "Шея",
  shoulders: "Плечи",
  arms: "Руки",
  hands: "Кисти",
  chest: "Грудь",
  breasts: "Грудь",
  nipples: "Соски",
  back: "Спина",
  belly: "Живот",
  waist: "Талия",
  buttocks: "Ягодицы",
  vagina: "Вагина",
  clitoris: "Клитор",
  anus: "Анус",
  thighs: "Бёдра",
  legs: "Ноги",
  knees: "Колени",
  feet: "Ступни",
  toes: "Пальцы ног",
};
const actionFamily = (actionId: string): Family => {
  if (/(shock|taser|electro|tens)/.test(actionId)) return "electric";
  if (/(vibrat|sensory_loop|sensory_pulse)/.test(actionId)) return "vibration";
  if (/(slap|strike|punch|belt|whip)/.test(actionId)) return "impact";
  if (/(ice|cold)/.test(actionId)) return "cold";
  if (/(wax|hot)/.test(actionId)) return "heat";
  if (/(kiss|stroke|massage|lick|breath|feather)/.test(actionId)) return "soft";
  if (/(bite|needle|pinch|scratch|hair_pull)/.test(actionId)) return "sharp";
  if (/(cuff|restraint|suspend|collar|blindfold|gag)/.test(actionId))
    return "restraint";
  return "pulse";
};
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
  "knees/light_kiss",
  "feet/needle_prick",
]);
const families: Family[] = [
  "soft",
  "impact",
  "vibration",
  "pulse",
  "electric",
  "cold",
  "heat",
  "sharp",
  "restraint",
];
const familyNames: Record<Family, string> = {
  soft: "Мягкое",
  vibration: "Вибрация",
  pulse: "Импульс",
  electric: "Электричество",
  impact: "Удар",
  sharp: "Резкое",
  cold: "Холод",
  heat: "Тепло",
  restraint: "Фиксация",
};
const resultNames: Record<Result, string> = {
  accepted: "Принято",
  mixed: "Смешанно",
  rejected: "Отвергнуто",
  overload: "Перегрузка",
};
const familyActionImage: Record<Family, string> = {
  soft: "/character-images/actions-by-point/feet/gentle_stroke_s2.png",
  impact: "/character-images/actions-by-point/feet/slap.png",
  vibration: "/character-images/actions-by-point/feet/deep_massage.png",
  pulse: "/character-images/actions-by-point/feet/light_kiss_s3.png",
  electric: "/character-images/actions-by-point/feet/taser_shock.png",
  cold: "/character-images/actions-by-point/feet/ice_cube_s2.png",
  heat: "/character-images/actions-by-point/back/hot_wax.png",
  sharp: "/character-images/actions-by-point/feet/needle_prick_s2.png",
  restraint: "/character-images/actions/equipment/act_apply_handcuffs.png",
};
const familyActionLabel: Record<Family, string> = {
  soft: "МЯГКОЕ ПОГЛАЖИВАНИЕ",
  impact: "РЕЗКИЙ УДАР",
  vibration: "РИТМИЧЕСКАЯ ВИБРАЦИЯ",
  pulse: "ПУЛЬСИРУЮЩИЙ КОНТАКТ",
  electric: "ЭЛЕКТРИЧЕСКИЙ РАЗРЯД",
  cold: "ХОЛОДОВОЙ КОНТАКТ",
  heat: "ГОРЯЧИЙ ВОСК",
  sharp: "УКОЛ ИГЛОЙ",
  restraint: "ФИКСАЦИЯ",
};
const familyAudio: Record<Family, string> = {
  soft: "act_caress",
  impact: "act_slap",
  vibration: "act_start_vibrator",
  pulse: "act_kiss",
  electric: "act_shock_collar",
  cold: "act_examine",
  heat: "act_caress",
  sharp: "act_inject",
  restraint: "act_apply_handcuffs",
};
const peakCopy: Record<Peak, [string, string]> = {
  discharge: ["LIMIT RELEASE", "FINISH"],
  overload: ["CORE OVERLOAD", "OVERDRIVE"],
  exhaustion: ["SYSTEM DOWN", "EXHAUSTED"],
  breakdown: ["GUARD BREAK", "BREAKDOWN"],
};
const peakPortraits: Record<
  Peak,
  [PortraitEmotion, PortraitEmotion, PortraitEmotion]
> = {
  discharge: ["aroused", "climax", "afterglow"],
  overload: ["pain", "mixed_overload", "high_negative"],
  exhaustion: ["aroused", "exhausted", "afterglow"],
  breakdown: ["defiant", "distressed", "crying"],
};
const peakActionImage: Record<Peak, string> = {
  discharge: "/character-images/actions-by-point/feet/licking_s3.png",
  overload: "/character-images/actions-by-point/feet/taser_shock.png",
  exhaustion: "/character-images/actions-by-point/feet/deep_massage.png",
  breakdown: "/character-images/actions-by-point/feet/slap.png",
};
const processActionImage: Record<ProcessKind, string> = {
  friction:
    "/character-images/actions-by-point/vagina/act_start_penetration.png",
  vibration: "/character-images/actions/equipment/act_start_vibrator.png",
  pulse: "/character-images/actions/equipment/vibrator_pulse.png",
  electric:
    "/character-images/actions/equipment/act_start_electrostimulation.png",
};
const peakDescription: Record<Peak, string> = {
  discharge: "Разряд проходит через всё тело",
  overload: "Ощущения вышли за предел контроля",
  exhaustion: "Тело больше не держит напряжение",
  breakdown: "Сопротивление сменяется срывом",
};

export function VisualEffectsLab() {
  const [theme, setTheme] = useState<
    "industrial" | "graphite" | "paper" | "mist"
  >("industrial");
  const [family, setFamily] = useState<Family>("soft");
  const [result, setResult] = useState<Result>("accepted");
  const [intensity, setIntensity] = useState(0.72);
  const [sharpness, setSharpness] = useState(0.55);
  const [rays, setRays] = useState(true);
  const [portrait, setPortrait] = useState(true);
  const [nonce, setNonce] = useState(1);
  const [peak, setPeak] = useState<Peak | null>(null);
  const [ambient, setAmbient] = useState("responsive");
  const [process, setProcess] = useState(false);
  const [processTempo, setProcessTempo] = useState<ProcessTempo>("steady");
  const [processKind, setProcessKind] = useState<ProcessKind>("friction");
  const [selectedComboKey, setSelectedComboKey] =
    useState("feet/gentle_stroke");
  useEffect(() => () => gameAudio.stop(), []);
  const play = () => {
    setPeak(null);
    setNonce((n) => n + 1);
    const actionId = familyAudio[family];
    void gameAudio.playExclusiveAction(actionId);
    void gameAudio.playReaction("mira", activePortraitEmotion, intensity);
    if (family === "vibration")
      window.setTimeout(
        () => void gameAudio.playAction("act_stop_vibrator"),
        2300,
      );
  };
  const playPeak = (kind: Peak) => {
    setPeak(kind);
    setNonce((n) => n + 1);
    const emotion = peakPortraits[kind][1];
    const actionId =
      kind === "discharge"
        ? "act_sexual_climax"
        : kind === "overload"
          ? "act_shock_collar"
          : kind === "exhaustion"
            ? "act_end_sexual_contact"
            : "act_slap";
    void gameAudio.playExclusiveAction(actionId);
    void gameAudio.playReaction("mira", emotion, 1);
  };
  const toggleProcess = () => {
    const next = !process;
    setProcess(next);
    if (!next) {
      void gameAudio.playAction(
        processKind === "vibration"
          ? "act_stop_vibrator"
          : processKind === "electric"
            ? "act_stop_electrostimulation"
            : "act_end_sexual_contact",
      );
      return;
    }
    void gameAudio.playAction(
      processKind === "vibration"
        ? "act_start_vibrator"
        : processKind === "electric"
          ? "act_start_electrostimulation"
          : "act_start_penetration",
    );
    void gameAudio.playReaction("mira", "aroused", 0.72);
  };
  const selectProcessTempo = (tempo: ProcessTempo) => {
    setProcessTempo(tempo);
    if (!process) return;
    void gameAudio.playAction(
      processKind === "vibration"
        ? "act_adjust_vibration"
        : processKind === "electric"
          ? "act_adjust_electrostimulation"
          : tempo === "fast"
            ? "act_increase_friction"
            : tempo === "slow"
              ? "act_decrease_friction"
              : "act_start_penetration",
    );
  };
  const selectProcessKind = (kind: ProcessKind) => {
    setProcessKind(kind);
    if (!process) return;
    void gameAudio.playAction(
      kind === "vibration"
        ? "act_start_vibrator"
        : kind === "electric"
          ? "act_start_electrostimulation"
          : "act_start_penetration",
    );
  };
  const selectedCombination = actionCombinations.find(
    (item) => `${item.pointId}/${item.actionId}` === selectedComboKey,
  );
  const selectedPoint = selectedCombination?.pointId || "feet";
  const pointActions = actionCombinations.filter(
    (item) => item.pointId === selectedPoint,
  );
  const selectedHasPointImage = Boolean(
    selectedCombination &&
    (actionPointAssets as Record<string, string>)[selectedComboKey],
  );
  const genericActionFolder =
    selectedCombination &&
    /(kiss|lick|insertion|penetration)/.test(selectedCombination.actionId)
      ? "intimacy"
      : "contact";
  const activeActionImage = selectedCombination
    ? (actionPointAssets as Record<string, string>)[selectedComboKey] ||
      `/character-images/actions/${genericActionFolder}/${selectedCombination.actionId}.png`
    : familyActionImage[family];
  const activeActionLabel =
    selectedCombination?.actionLabel.toUpperCase() || familyActionLabel[family];
  const activePointLabel =
    pointNames[selectedPoint]?.toUpperCase() || selectedPoint.toUpperCase();
  const activePortraitEmotion: PortraitEmotion =
    result === "overload"
      ? family === "electric" || family === "vibration"
        ? "mixed_overload"
        : "high_negative"
      : result === "rejected"
        ? family === "impact" || family === "sharp" || family === "electric"
          ? "pain"
          : family === "restraint"
            ? "defiant"
            : "distressed"
        : result === "mixed"
          ? family === "soft"
            ? "shy"
            : family === "restraint"
              ? "guarded"
              : family === "impact" || family === "sharp"
                ? "distressed"
                : "mixed"
          : family === "vibration" || family === "pulse"
            ? "aroused"
            : family === "soft" || family === "heat"
              ? "pleasure"
              : family === "restraint"
                ? "submissive"
                : family === "cold"
                  ? "surprise"
                  : "high_positive";
  return (
    <main className="fx-lab campaign-shell" data-theme={theme}>
      <header className="fx-header">
        <div>
          <small>CYBERJACK · VISUAL FX</small>
          <h1>Стенд визуальных эффектов</h1>
        </div>
        <div className="fx-themes">
          {(["industrial", "graphite", "paper", "mist"] as const).map(
            (id, i) => (
              <button
                className={theme === id ? "active" : ""}
                onClick={() => setTheme(id)}
              >
                {["Industrial", "Graphite", "Sage", "Mist"][i]}
              </button>
            ),
          )}
          <a href="/">В игру</a>
          <a href="/concept/sex-machine">Секс-машина</a>
        </div>
      </header>
      <div className="fx-layout">
        <aside className="fx-controls">
          <section>
            <h2>Тип реакции</h2>
            <div className="fx-choice-grid">
              {families.map((id) => (
                <button
                  className={family === id ? "active" : ""}
                  onClick={() => {
                    setFamily(id);
                    setPeak(null);
                    setSelectedComboKey("");
                  }}
                >
                  {familyNames[id]}
                </button>
              ))}
            </div>
          </section>
          <section className="fx-action-catalog">
            <h2>Действия игры · {actionCombinations.length} вариантов</h2>
            <p>239 локальных иллюстраций · 18 общих</p>
            <label>
              <span>ТОЧКА ТЕЛА</span>
              <select
                value={selectedPoint}
                onChange={(event) => {
                  const first = actionCombinations.find(
                    (item) => item.pointId === event.target.value,
                  );
                  if (!first) return;
                  setSelectedComboKey(`${first.pointId}/${first.actionId}`);
                  setFamily(actionFamily(first.actionId));
                  setPeak(null);
                }}
              >
                {actionPoints.map((point) => (
                  <option value={point}>{pointNames[point] || point}</option>
                ))}
              </select>
            </label>
            <label>
              <span>ДЕЙСТВИЕ</span>
              <select
                value={selectedComboKey}
                onChange={(event) => {
                  const next = actionCombinations.find(
                    (item) =>
                      `${item.pointId}/${item.actionId}` === event.target.value,
                  );
                  setSelectedComboKey(event.target.value);
                  if (next) setFamily(actionFamily(next.actionId));
                  setPeak(null);
                }}
              >
                {pointActions.map((item) => (
                  <option value={`${item.pointId}/${item.actionId}`}>
                    {item.actionLabel}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section>
            <h2>Оценка результата</h2>
            <div className="fx-choice-grid results">
              {(["accepted", "mixed", "rejected", "overload"] as Result[]).map(
                (id) => (
                  <button
                    className={result === id ? "active" : ""}
                    onClick={() => setResult(id)}
                  >
                    {resultNames[id]}
                  </button>
                ),
              )}
            </div>
          </section>
          <section className="fx-sliders">
            <label>
              Сила <b>{Math.round(intensity * 100)}%</b>
              <input
                type="range"
                min="0.2"
                max="1"
                step=".05"
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
              />
            </label>
            <label>
              Резкость <b>{Math.round(sharpness * 100)}%</b>
              <input
                type="range"
                min="0"
                max="1"
                step=".05"
                value={sharpness}
                onChange={(e) => setSharpness(Number(e.target.value))}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={rays}
                onChange={(e) => setRays(e.target.checked)}
              />{" "}
              Манга-линии
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={portrait}
                onChange={(e) => setPortrait(e.target.checked)}
              />{" "}
              Портретный отклик
            </label>
          </section>
          <button className="fx-play" onClick={play}>
            ВОСПРОИЗВЕСТИ ЭФФЕКТ
          </button>
          <section>
            <h2>Фоновое состояние</h2>
            <div className="fx-choice-grid">
              {[
                "responsive",
                "panic",
                "overload",
                "subspace",
                "edge-positive",
              ].map((id) => (
                <button
                  className={ambient === id ? "active" : ""}
                  onClick={() => setAmbient(id)}
                >
                  {id}
                </button>
              ))}
            </div>
            <button
              className={
                process ? "active fx-process-toggle" : "fx-process-toggle"
              }
              onClick={toggleProcess}
            >
              {process
                ? "Остановить индикацию процесса"
                : "Показать активный процесс"}
            </button>
            <div className="fx-process-tempo">
              {(["slow", "steady", "fast"] as ProcessTempo[]).map((tempo) => (
                <button
                  className={processTempo === tempo ? "active" : ""}
                  onClick={() => selectProcessTempo(tempo)}
                >
                  {tempo === "slow"
                    ? "МЕДЛЕННО"
                    : tempo === "steady"
                      ? "РОВНО"
                      : "БЫСТРО"}
                </button>
              ))}
            </div>
            <div className="fx-process-kinds">
              {(
                ["friction", "vibration", "pulse", "electric"] as ProcessKind[]
              ).map((kind) => (
                <button
                  className={processKind === kind ? "active" : ""}
                  onClick={() => selectProcessKind(kind)}
                >
                  {kind === "friction"
                    ? "ФРИКЦИИ"
                    : kind === "vibration"
                      ? "ВИБРАЦИЯ"
                      : kind === "pulse"
                        ? "ПУЛЬСАЦИЯ"
                        : "ЭЛЕКТРО"}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h2>Пиковое событие</h2>
            <div className="fx-peaks">
              {(
                ["discharge", "overload", "exhaustion", "breakdown"] as Peak[]
              ).map((id) => (
                <button onClick={() => playPeak(id)}>{peakCopy[id][1]}</button>
              ))}
            </div>
          </section>
        </aside>
        <section
          className={`fx-stage calibration-workbench ambient-${ambient}`}
        >
          <div className="character-stage">
            <div className="calibration-avatar-frame">
              <img
                className="calibration-character-image"
                src="/character-images/calibration-v4/mira/sitting_spread/calibration_set__wrist_cuffs__subspace.png"
              />
            </div>
            {process && (
              <div
                className={`fx-sustained fx-sustained--${processKind} fx-sustained--${processTempo}`}
              >
                <div className="fx-process-window">
                  <img
                    className="fx-process-window__base"
                    src={processActionImage[processKind]}
                  />
                  <div className="fx-process-window__motion" aria-hidden="true">
                    <img src={processActionImage[processKind]} />
                  </div>
                  <div
                    className="fx-process-window__motion fx-process-window__motion--echo"
                    aria-hidden="true"
                  >
                    <img src={processActionImage[processKind]} />
                  </div>
                  {processKind === "electric" && (
                    <svg
                      className="fx-process-electric-branches"
                      viewBox="0 0 420 180"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <g className="fx-electric-branch fx-electric-branch--a">
                        <path d="M6 94 L34 83 L59 91 L86 72 L112 78 L143 65" />
                        <path d="M34 83 L51 57 L77 45 L93 20" />
                        <path d="M59 91 L76 116 L105 126 L126 151" />
                        <path d="M86 72 L104 48 L130 37" />
                        <path d="M112 78 L125 98 L151 108" />
                      </g>
                      <g className="fx-electric-branch fx-electric-branch--b">
                        <path d="M135 66 L165 82 L193 73 L220 94 L247 81 L279 96" />
                        <path d="M165 82 L178 54 L204 34 L216 8" />
                        <path d="M193 73 L207 113 L232 127 L246 160" />
                        <path d="M220 94 L237 61 L262 48" />
                        <path d="M247 81 L261 111 L288 124" />
                      </g>
                      <g className="fx-electric-branch fx-electric-branch--c">
                        <path d="M271 96 L299 77 L326 88 L350 64 L381 72 L414 53" />
                        <path d="M299 77 L313 43 L341 27" />
                        <path d="M326 88 L343 119 L371 128 L396 158" />
                        <path d="M350 64 L365 91 L395 99" />
                        <path d="M381 72 L393 45 L416 31" />
                      </g>
                    </svg>
                  )}
                </div>
                <div className="active-process-visual">
                  <i />
                  <span>
                    <small>ПРОЦЕСС ИДЁТ</small>
                    <strong>
                      {processKind === "friction"
                        ? "Ритмичные фрикции"
                        : processKind === "vibration"
                          ? "Непрерывная вибрация"
                          : processKind === "pulse"
                            ? "Пульсирующее давление"
                            : "Электростимуляция"}
                    </strong>
                  </span>
                  <em>
                    {processTempo === "slow"
                      ? "МЕДЛЕННО"
                      : processTempo === "fast"
                        ? "БЫСТРО"
                        : "РОВНО"}
                  </em>
                </div>
              </div>
            )}
            {!peak && (
              <div
                className={`fx-cinematic fx-${family} fx-result-${result} ${rays ? "" : "fx-clean"} fx-power-${intensity < 0.45 ? "low" : intensity < 0.75 ? "medium" : "high"}`}
                key={`effect-${nonce}`}
                style={
                  {
                    "--fx-power": intensity,
                    "--fx-sharp": sharpness,
                  } as React.CSSProperties
                }
              >
                <div
                  className={`fx-action-cut ${topCropActions.has(selectedComboKey) ? "fx-action-cut--top-crop" : ""} ${bottomCropActions.has(selectedComboKey) ? "fx-action-cut--bottom-crop" : ""} ${selectedComboKey === "feet/pinch" ? "fx-action-cut--feet-pinch" : ""}`}
                >
                  <img src={activeActionImage} />
                  {family === "vibration" && (
                    <>
                      <img
                        className="fx-vibration-echo echo-a"
                        aria-hidden="true"
                        src={activeActionImage}
                      />
                      <img
                        className="fx-vibration-echo echo-b"
                        aria-hidden="true"
                        src={activeActionImage}
                      />
                    </>
                  )}
                </div>
                <div className="fx-context">
                  <small>
                    {activePointLabel}
                    {selectedCombination && !selectedHasPointImage
                      ? " · ОБЩАЯ ИЛЛЮСТРАЦИЯ"
                      : ""}
                  </small>
                  <b>{activeActionLabel}</b>
                </div>
                {portrait && intensity >= 0.68 && (
                  <div className="fx-face-cut">
                    <img
                      src={`/character-images/portraits/mira/${activePortraitEmotion}.png`}
                    />
                    {family === "vibration" && (
                      <img
                        className="fx-face-echo"
                        aria-hidden="true"
                        src={`/character-images/portraits/mira/${activePortraitEmotion}.png`}
                      />
                    )}
                  </div>
                )}
                <div className="fx-resolution">
                  <small>{resultNames[result]}</small>
                  <b>
                    {result === "accepted"
                      ? "ВОЗБУЖДЕНИЕ +4.2"
                      : result === "mixed"
                        ? "УДОВОЛЬСТВИЕ +3 · ДИСКОМФОРТ +2"
                        : result === "rejected"
                          ? "ПРИНЯТИЕ −6.4"
                          : "ПЕРЕГРУЗКА +12"}
                  </b>
                </div>
              </div>
            )}
            {peak && (
              <div
                className={`fx-peak-montage fx-peak-${peak}`}
                key={`peak-${nonce}`}
              >
                <div className="fx-peak-action">
                  <img src={peakActionImage[peak]} />
                </div>
                {peakPortraits[peak].map((emotion, index) => (
                  <div
                    className={`fx-peak-face fx-peak-face--${["primary", "secondary", "tertiary"][index]}`}
                    key={emotion}
                  >
                    <img
                      src={`/character-images/portraits/mira/${emotion}.png`}
                    />
                  </div>
                ))}
                <div className="fx-peak-copy">
                  <small>{peakCopy[peak][0]}</small>
                  <b>{peakCopy[peak][1]}</b>
                  <span>{peakDescription[peak]}</span>
                </div>
              </div>
            )}
            <footer>
              <span>
                СЕМЕЙСТВО · <b>{familyNames[family]}</b>
              </span>
              <span>
                РЕЗУЛЬТАТ · <b>{resultNames[result]}</b>
              </span>
              <span>
                СИЛА · <b>{Math.round(intensity * 100)}%</b>
              </span>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
