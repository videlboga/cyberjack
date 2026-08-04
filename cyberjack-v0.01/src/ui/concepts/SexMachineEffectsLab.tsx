import React, { useEffect, useState } from "react";
import { GamePeakEffect, GameSustainedEffect } from "../GameVisualEffects";
import { gameAudio } from "../gameAudio";
import "./SexMachineEffectsLab.css";

type ProcessKind = "friction" | "vibration" | "pulse" | "electric";
const processAction: Record<ProcessKind, string> = {
  friction: "act_start_penetration",
  vibration: "act_start_vibrator",
  pulse: "sustained_sexual_pulse",
  electric: "act_start_electrostimulation",
};
const processNames: Record<ProcessKind, string> = {
  friction: "Фрикции",
  vibration: "Вибрация",
  pulse: "Пульсация",
  electric: "Электростимуляция",
};
const processImage: Record<ProcessKind, string> = {
  friction:
    "/character-images/actions-by-point/vagina/act_start_penetration.png",
  vibration: "/character-images/actions/equipment/act_start_vibrator.png",
  pulse: "/character-images/actions/equipment/vibrator_pulse.png",
  electric:
    "/character-images/actions/equipment/act_start_electrostimulation.png",
};

export function SexMachineEffectsLab() {
  const [running, setRunning] = useState(true);
  const [kind, setKind] = useState<ProcessKind>("friction");
  const [power, setPower] = useState(50);
  const [tempo, setTempo] = useState<"slow" | "steady" | "fast">("steady");
  const [peak, setPeak] = useState(false);
  const [theme, setTheme] = useState<
    "industrial" | "graphite" | "paper" | "mist"
  >("industrial");
  useEffect(() => () => gameAudio.stop(), []);
  const toggle = () => {
    const next = !running;
    setRunning(next);
    void gameAudio.playAction(
      next
        ? processAction[kind]
        : kind === "electric"
          ? "act_stop_electrostimulation"
          : kind === "vibration"
            ? "act_stop_vibrator"
            : "act_end_sexual_contact",
    );
  };
  const changeKind = (next: ProcessKind) => {
    setKind(next);
    if (running) void gameAudio.playAction(processAction[next]);
  };
  const changeTempo = (next: "slow" | "steady" | "fast") => {
    setTempo(next);
    if (running)
      void gameAudio.playAction(
        next === "fast"
          ? "act_increase_friction"
          : next === "slow"
            ? "act_decrease_friction"
            : processAction[kind],
      );
  };
  const triggerPeak = () => {
    setPeak(false);
    requestAnimationFrame(() => setPeak(true));
    void gameAudio.playAction("act_sexual_climax");
    window.setTimeout(() => setPeak(false), 3200);
  };
  const activation = Math.min(100, 34 + power * 0.63),
    capacity = Math.max(0, 92 - power * 0.38),
    readiness = Math.round((activation + capacity) / 2);
  return (
    <main className="sm-lab campaign-shell" data-theme={theme}>
      <header className="sm-lab-header">
        <div>
          <small>CYBERJACK · VISUAL FX + DEVICE UI</small>
          <h1>Стенд секс-машины</h1>
        </div>
        <nav>
          {(["industrial", "graphite", "paper", "mist"] as const).map((id) => (
            <button
              className={theme === id ? "active" : ""}
              onClick={() => setTheme(id)}
            >
              {id}
            </button>
          ))}
          <a href="/concept/effects">Эффекты</a>
          <a href="/">В игру</a>
        </nav>
      </header>
      <section className="sm-lab-layout">
        <div className="sm-subject">
          <header>
            <div>
              <small>СОСТОЯНИЕ АКТИВА</small>
              <strong>Мира · S-AV-01</strong>
            </div>
            <span className={running ? "running" : ""}>
              {running ? "ПРОЦЕСС ИДЁТ" : "ПАУЗА"}
            </span>
          </header>
          <div className="sm-avatar">
            <img
              src={`/character-images/sex-machine/mira__restrained__${peak ? "climax" : power > 75 ? "subspace" : "receptive"}.png`}
              alt="Мира в секс-машине"
            />
            {running && (
              <GameSustainedEffect
                actionId={processAction[kind]}
                label={`${processNames[kind]} · ${tempo}`}
                minutes={3}
              />
            )}
            {peak && (
              <GamePeakEffect
                kind="discharge"
                effectKey={`peak-${Date.now()}`}
                characterSlug="mira"
                actionImage={processImage[kind]}
              />
            )}
          </div>
          <footer>
            <span>
              <small>АКТИВАЦИЯ</small>
              <b>{Math.round(activation)}%</b>
            </span>
            <span>
              <small>РЕСУРС</small>
              <b>{Math.round(capacity)}%</b>
            </span>
            <span>
              <small>ГОТОВНОСТЬ</small>
              <b>{readiness}%</b>
            </span>
          </footer>
        </div>
        <aside className="sm-console">
          <header>
            <div>
              <small>ТЕКУЩИЙ ПРОЦЕСС</small>
              <strong>{processNames[kind]}</strong>
            </div>
            <button className={running ? "pause" : "start"} onClick={toggle}>
              {running ? "ПАУЗА" : "ЗАПУСК"}
            </button>
          </header>
          <section>
            <h2>Тип воздействия</h2>
            <div className="sm-kind-grid">
              {(Object.keys(processNames) as ProcessKind[]).map((id) => (
                <button
                  className={kind === id ? "active" : ""}
                  onClick={() => changeKind(id)}
                >
                  <i />
                  {processNames[id]}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h2>Ритм</h2>
            <div className="sm-tempo">
              {(["slow", "steady", "fast"] as const).map((id) => (
                <button
                  className={tempo === id ? "active" : ""}
                  onClick={() => changeTempo(id)}
                >
                  {id === "slow"
                    ? "МЕДЛЕННО"
                    : id === "steady"
                      ? "РОВНО"
                      : "БЫСТРО"}
                </button>
              ))}
            </div>
          </section>
          <section className="sm-power">
            <header>
              <h2>Мощность</h2>
              <b>{power}%</b>
            </header>
            <input
              type="range"
              min="10"
              max="100"
              step="10"
              value={power}
              onChange={(e) => setPower(Number(e.target.value))}
            />
            <div>
              {Array.from({ length: 10 }, (_, i) => (
                <i className={(i + 1) * 10 <= power ? "active" : ""} />
              ))}
            </div>
          </section>
          <section className="sm-live-readout">
            <small>ТЕКУЩИЙ ОТКЛИК</small>
            <strong>
              {power > 80
                ? "ПРИБЛИЖЕНИЕ К ПОРОГУ"
                : power > 55
                  ? "УСТОЙЧИВОЕ ВОЗБУЖДЕНИЕ"
                  : "АДАПТАЦИЯ К РИТМУ"}
            </strong>
            <p>
              {power > 80
                ? "Ресурс снижается. Разрядка доступна."
                : "Воздействие принимается, процесс стабилен."}
            </p>
          </section>
          <button className="sm-peak" disabled={!running} onClick={triggerPeak}>
            ВЫЗВАТЬ ПИК
          </button>
        </aside>
      </section>
    </main>
  );
}
