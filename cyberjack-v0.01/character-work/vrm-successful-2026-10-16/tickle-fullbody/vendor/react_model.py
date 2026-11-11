"""Модель реакции: событие контакта → стимул → привыкание/усталость → выбор клипа и канала.

Чистый Python, без bpy — гоняется и в Blender, и в тестах.

Что учтено по исследовательской записке от 31.10.2026:
  * ContactEvent несёт не только зону и силу, но и площадь контакта, источник, ожидаемость;
  * ожидаемость подавляет восприятие (прямые данные о self-touch suppression [Proelss 2022]),
    коэффициент помечен как гипотеза, потому что перенос на предсказание чужого контакта не измерен;
  * каналы (мотор / мимика / дыхание / вокализация) имеют РАЗНЫЕ латентности с разбросом,
    а не одно общее время; 300 и 500 мс берутся только там, где они измерены;
  * все параметры лежат в tuning/*.json с полем evidence: direct / analogy / hypothesis / authored.

    python3 react_model.py
"""
import json
import math
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
SIM = os.path.dirname(HERE)
TUNING = os.path.join(SIM, "tuning")

DEFAULTS = {
    "adaptation_rate": 0.28,
    "recovery_rate": 0.16,
    "max_reduction": 0.70,
    "rise_rate": 1.6,
    "fall_rate": 0.45,
    "load_threshold": 0.30,
    "endurance_s": 12.0,
    "load_recovery_per_s": 0.07,
    "sustained_gain": 0.35,
    "adapted_at": 0.30,
    "fatigued_at": 0.60,
    "oversensitive_below": 0.10,
    "oversensitive_sens": 0.80,
    "tiers": [[0.0, 0.7], [0.35, 1.0], [0.7, 1.25]],
    "suppression_k": 0.30,
    "area_min": 0.60,
    "area_max": 1.00,
    "expectedness_rise": 1.6,
    "expectedness_decay": 0.9,
    "hover_weight": 0.50,
    "repeat_weight": 0.50,
}

CHANNEL_DEFAULTS = {
    "motor": {"median_ms": 40, "jitter": 0.50},
    "face": {"median_ms": 300, "jitter": 0.25},
    "breath": {"median_ms": 300, "jitter": 0.30},
    "voice": {"median_ms": 500, "jitter": 0.30},
}

OVER_ZONES = {"arch_medial", "toe_pad_1"}


def clip_name(zone, character):
    """зона + характер → имя Action. Реакция различается анатомически, а не только амплитудой."""
    if character in ("rest", "after_release"):
        return "after_release"
    if character == "oversensitive" and zone not in OVER_ZONES:
        character = "adapted"
    return f"{zone}_{character}"


def load_json(path, fallback):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    return fallback


def load_tuning():
    """Собирает плоский словарь из tuning/reaction.json (значения лежат в поле value)."""
    raw = load_json(os.path.join(TUNING, "reaction.json"), {})
    flat = {}
    for key, val in raw.get("model", {}).items():
        if isinstance(val, dict) and "value" in val:
            flat[key] = val["value"]
    area = raw.get("area_response", {}).get("value")
    if area:
        flat["area_min"], flat["area_max"] = area
    if isinstance(raw.get("suppression_k"), dict):
        flat["suppression_k"] = raw["suppression_k"]["value"]
    exp = raw.get("expectedness", {})
    for src, dst in (("rise_per_s", "expectedness_rise"), ("decay_per_s", "expectedness_decay"),
                     ("hover_weight", "hover_weight"), ("repeat_weight", "repeat_weight")):
        if src in exp:
            flat[dst] = exp[src]
    channels = raw.get("channels", {}) or CHANNEL_DEFAULTS
    return flat, channels


def normalize(contact):
    """Принимает и кортеж (зона, инструмент, сила-уровень, скорость), и полный ContactEvent."""
    if contact is None:
        return None
    if isinstance(contact, dict):
        c = dict(contact)
        c.setdefault("tool", "fingers")
        c.setdefault("force", 0.66)
        c.setdefault("speed", 1.0)
        c.setdefault("area", 0.7)
        c.setdefault("source", "finger")
        c.setdefault("hover", 0.0)
        c.setdefault("expectedness", None)
        return c
    zone, tool, power, speed = contact
    return {"zone": zone, "tool": tool, "force": min(1.0, power / 3.0), "speed": speed,
            "area": 0.7, "source": "finger", "hover": 0.0, "expectedness": None}


class ReactionModel:
    def __init__(self, zones, tools, tuning=None, seed=7):
        self.zones = dict(zones["zones"])
        self.zones.setdefault("intertoe", {"family": "INTERTOE", "sensitivity": 0.78,
                                           "faces": zones.get("intertoe_faces_per_toe"),
                                           "area_cm2": None})
        self.tools = tools
        flat, self.channels_cfg = load_tuning()
        self.t = dict(DEFAULTS)
        self.t.update(flat)
        if tuning:
            self.t.update(tuning)
        self.rng = random.Random(seed)

        self.adaptation = {z: 0.0 for z in self.zones}
        self.load = 0.0
        self.intensity = 0.0
        self.stimulus = 0.0
        self.delivered = 0.0
        self.perceived = 0.0
        self.expectedness = 0.0
        self.hover = 0.0
        self.active_zone = None
        self.contact_s = 0.0
        self.prev_zone = None
        self.gap_s = 0.0
        self.repeats = 0
        self.channel_latency = {}

    # --- восприятие -------------------------------------------------------
    def zone_sens(self, zone):
        return self.zones.get(zone, {}).get("sensitivity", 0.75)

    def family(self, zone):
        return self.zones.get(zone, {}).get("family", "INTERTOE" if zone == "intertoe" else "SOLE")

    def tool_effectiveness(self, tool_id, force):
        levels = self.tools[tool_id]["effectiveness"]
        pos = max(0.0, min(1.0, force)) * (len(levels) - 1)
        lo = int(math.floor(pos))
        hi = min(lo + 1, len(levels) - 1)
        return levels[lo] + (levels[hi] - levels[lo]) * (pos - lo)

    def area_factor(self, area):
        a = max(0.0, min(1.0, area))
        return self.t["area_min"] + (self.t["area_max"] - self.t["area_min"]) * a

    def stimulus_for(self, zone, tool_id, force, speed, contact_s, area=0.7):
        tool = self.tools[tool_id]
        eff = self.tool_effectiveness(tool_id, force)
        act = tool["activity_at_1mspeed"] * (max(speed, 0.05) ** tool["activity_exponent"])
        ramp = min(1.0, contact_s / max(tool["contact_ramp_s"], 1e-3))
        raw = self.zone_sens(zone) * eff * act * ramp * self.area_factor(area)
        return max(0.0, min(1.0, raw))

    # --- ожидание --------------------------------------------------------
    def _update_expectedness(self, c, dt):
        if c is None:
            self.expectedness = max(0.0, self.expectedness - self.t["expectedness_decay"] * dt)
            self.gap_s += dt
            return
        if c.get("expectedness") is not None:
            self.expectedness = max(0.0, min(1.0, c["expectedness"]))
            return
        target = (self.t["hover_weight"] * max(0.0, min(1.0, c.get("hover", 0.0)))
                  + self.t["repeat_weight"] * min(1.0, self.repeats / 3.0))
        rate = self.t["expectedness_rise"] if target > self.expectedness else self.t["expectedness_decay"]
        self.expectedness += (target - self.expectedness) * min(1.0, rate * dt)

    # --- каналы ----------------------------------------------------------
    def _draw_channels(self):
        out = {}
        for name, cfg in self.channels_cfg.items():
            med = cfg.get("median_ms", 300) / 1000.0
            jit = cfg.get("jitter", 0.3)
            val = med * math.exp(self.rng.gauss(0.0, jit))
            out[name] = round(max(0.2 * med, min(3.0 * med, val)) * 1000.0, 1)
        self.channel_latency = out
        return out

    # --- шаг --------------------------------------------------------------
    def step(self, dt, contact=None):
        c = normalize(contact)
        starting = c is not None and self.active_zone is None

        if c is not None:
            if starting:
                self.contact_s = 0.0
                if c["zone"] == self.prev_zone and self.gap_s < 0.8:
                    self.repeats += 1
                else:
                    self.repeats = 0
                self._draw_channels()
                self.prev_zone = c["zone"]
            self.contact_s += dt
            self.active_zone = c["zone"]
            self.gap_s = 0.0
        else:
            if self.active_zone is not None:
                self.prev_zone = self.active_zone
                self.gap_s = 0.0
            self.contact_s = 0.0
            self.active_zone = None

        self._update_expectedness(c, dt)

        if c is not None:
            delivered = self.stimulus_for(c["zone"], c["tool"], c["force"], c["speed"],
                                          self.contact_s, c["area"])
        else:
            delivered = 0.0
        self.delivered = delivered

        adapt = self.adaptation.get(self.active_zone, 0.0) if self.active_zone else 0.0
        after_adapt = delivered * (1.0 - adapt * self.t["max_reduction"])
        # подавление ожиданием: прямой эффект измерен для своего прикосновения, перенос — гипотеза
        self.perceived = after_adapt * (1.0 - self.t["suppression_k"] * self.expectedness)

        for z in self.adaptation:
            if z == self.active_zone and after_adapt > 0.001:
                self.adaptation[z] = min(1.0, self.adaptation[z] + self.t["adaptation_rate"] * after_adapt * dt)
            else:
                self.adaptation[z] = max(0.0, self.adaptation[z] - self.t["recovery_rate"] * dt)

        if delivered > self.t["load_threshold"]:
            inc = (delivered - self.t["load_threshold"]) / (1.0 - self.t["load_threshold"]) / self.t["endurance_s"]
            self.load = min(1.0, self.load + inc * dt)
        else:
            self.load = max(0.0, self.load - self.t["load_recovery_per_s"] * dt)

        stim = self.perceived * (1.0 + self.load * self.t["sustained_gain"])
        self.stimulus = max(0.0, min(1.0, stim))

        rate = self.t["rise_rate"] if self.stimulus > self.intensity else self.t["fall_rate"]
        self.intensity += (self.stimulus - self.intensity) * (1.0 - math.exp(-rate * dt))
        return self.state()

    # --- выбор клипа ------------------------------------------------------
    def character(self):
        if not self.active_zone:
            return "after_release" if self.intensity > 0.05 else "rest"
        if self.load >= self.t["fatigued_at"]:
            return "fatigued"
        if self.adaptation.get(self.active_zone, 0.0) >= self.t["adapted_at"]:
            return "adapted"
        if (self.adaptation.get(self.active_zone, 0.0) < self.t["oversensitive_below"]
                and self.zone_sens(self.active_zone) >= self.t["oversensitive_sens"]):
            return "oversensitive"
        return "fresh"

    def tier(self):
        mult = 1.0
        for thresh, m in self.t["tiers"]:
            if self.stimulus >= thresh:
                mult = m
        return mult

    def state(self):
        base = {"stimulus": round(self.stimulus, 3),
                "delivered": round(self.delivered, 3),
                "perceived": round(self.perceived, 3),
                "expectedness": round(self.expectedness, 3),
                "channels_ms": self.channel_latency,
                "load": round(self.load, 3)}
        if not self.active_zone:
            base.update({"clip": "after_release",
                         "character": "rest" if self.intensity < 0.05 else "after_release",
                         "family": None,
                         "adaptation": round(max(self.adaptation.values(), default=0.0), 3),
                         "tier": 1.0})
            return base
        ch = self.character()
        base.update({"clip": clip_name(self.active_zone, ch), "character": ch,
                     "family": self.family(self.active_zone),
                     "adaptation": round(self.adaptation.get(self.active_zone, 0.0), 3),
                     "tier": self.tier()})
        return base


def run_scenario(model, script, dt=1.0 / 30.0, log_every=0.5):
    log = []
    t = 0.0
    next_log = 0.0
    for dur, contact in script:
        end = t + dur
        while t < end - 1e-9:
            st = model.step(dt, contact)
            t += dt
            if t >= next_log:
                log.append({"t": round(t, 2), **st})
                next_log += log_every
    return log


def main():
    zones = load_json(os.path.join(TUNING, "zones.json"), {"zones": {}})
    tools = load_json(os.path.join(TUNING, "tools.json"), {})

    fingers = ("arch_medial", "fingers", 2, 1.0)
    heel = ("heel", "fingers", 2, 1.0)
    ball = ("ball", "fingers", 2, 1.0)

    m1 = ReactionModel(zones, tools)
    base_arch = m1.stimulus_for("arch_medial", "fingers", 0.66, 1.0, 1.0)
    base_heel = m1.stimulus_for("heel", "fingers", 0.66, 1.0, 1.0)
    log_a = run_scenario(m1, [(10.0, fingers)])
    st_switch = m1.step(1.0 / 30.0, heel)

    m2 = ReactionModel(zones, tools)
    log_b = run_scenario(m2, [(20.0, ball), (15.0, None)])

    # ожидание: один и тот же контакт, но предсказуемый и непредсказуемый
    m3 = ReactionModel(zones, tools)
    unpredictable = m3.step(1.0 / 30.0, {**normalize(fingers), "expectedness": 0.0})
    m4 = ReactionModel(zones, tools)
    predictable = m4.step(1.0 / 30.0, {**normalize(fingers), "expectedness": 0.9})

    print(f"свежий отклик свода: {base_arch:.3f} | через 10 с удержания: "
          f"{log_a[-1]['perceived']:.3f} ({log_a[-1]['perceived'] / max(base_arch, 1e-6) * 100:.0f} % от свежего)")
    print(f"переключение на пятку: delivered {st_switch['delivered']:.3f} "
          f"({st_switch['delivered'] / max(base_heel, 1e-6) * 100:.0f} % её свежего), "
          f"с усталостью {st_switch['stimulus']:.3f}")
    print(f"усталость: пик {max(r['load'] for r in log_b):.3f}, через 15 с после отпускания "
          f"{log_b[-1]['load']:.3f}")
    print(f"предсказуемый контакт: perceived {predictable['perceived']:.3f} против "
          f"{unpredictable['perceived']:.3f} непредсказуемого "
          f"(−{(1 - predictable['perceived'] / max(unpredictable['perceived'], 1e-6)) * 100:.0f} %)")
    print("латентности каналов, мс:", unpredictable["channels_ms"])

    ok1 = log_a[-1]["perceived"] <= 0.32 * base_arch
    ok2 = st_switch["delivered"] >= 0.80 * base_heel
    ok3 = max(r["load"] for r in log_b) >= 0.70 and log_b[-1]["load"] < 0.20
    ok4 = predictable["perceived"] < unpredictable["perceived"] * 0.95
    ok5 = len({round(v) for v in unpredictable["channels_ms"].values()}) >= 3   # каналы не синхронны
    print("КРИТЕРИИ:", "PASS" if all([ok1, ok2, ok3, ok4, ok5]) else "FAIL",
          f"(привыкание {ok1}, переключение {ok2}, усталость {ok3}, ожидание {ok4}, каналы {ok5})")

    with open(os.path.join(SIM, "session_log.json"), "w", encoding="utf-8") as fh:
        json.dump({"hold_10s": log_a, "hold_20s_then_release": log_b,
                   "expectedness_ab": {"predictable": predictable, "unpredictable": unpredictable}},
                  fh, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
