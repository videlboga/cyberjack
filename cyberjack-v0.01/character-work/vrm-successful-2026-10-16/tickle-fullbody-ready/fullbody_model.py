"""Детерминированная модель полноростовой реакции поверх 08_sim/react_model.py.

Научные данные и авторские допущения разделены в tuning/fullbody.json.
Здесь нет bpy: модуль пригоден для Blender, браузерного порта и сценарных тестов.
"""
import importlib.util
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
LEGACY = HERE / 'vendor' if (HERE / 'vendor/react_model.py').exists() else Path('/home/cyberkitty/Projects/tickle-mechanics-refs/08_sim')
SOURCE = LEGACY / 'react_model.py' if LEGACY == HERE / 'vendor' else LEGACY / 'rig/react_model.py'
SPEC = importlib.util.spec_from_file_location('tickle_legacy_reaction', SOURCE)
LEGACY_MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(LEGACY_MODULE)


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def smoothstep(x):
    x = clamp(x)
    return x * x * (3.0 - 2.0 * x)


class FullBodyReaction:
    def __init__(self, seed=7):
        zones = json.loads((LEGACY / 'tuning/zones.json').read_text(encoding='utf-8'))
        tools = json.loads((LEGACY / 'tuning/tools.json').read_text(encoding='utf-8'))
        self.model = LEGACY_MODULE.ReactionModel(zones, tools, seed=seed)
        self.elapsed = 0.0
        self.release_elapsed = 999.0
        self.was_contact = False
        self.last = None

    def step(self, dt, contact=None):
        state = self.model.step(dt, contact)
        active = contact is not None
        if active and not self.was_contact:
            self.elapsed = 0.0
        if active:
            self.elapsed += dt
            self.release_elapsed = 0.0
        else:
            self.release_elapsed += dt
            self.elapsed = 0.0
        self.was_contact = active
        lat = dict(self.model.channel_latency)
        motor_s = lat.get('motor', 40.0) / 1000.0
        face_s = lat.get('face', 300.0) / 1000.0
        breath_s = lat.get('breath', 317.0) / 1000.0
        voice_s = lat.get('voice', 534.0) / 1000.0
        body_s = motor_s * 2.25  # authored: отдельная проксимальная задержка, не измерение

        def gate(seconds, attack):
            if not active:
                return 1.0
            return smoothstep((self.elapsed - seconds) / attack)

        intensity = self.model.intensity
        flinch = 0.0
        if active and self.elapsed >= motor_s:
            flinch = state['perceived'] * math.exp(-(self.elapsed - motor_s) / 0.13)
        local = max(intensity * gate(motor_s, 0.045), flinch * 0.90)
        body = max(intensity * gate(body_s, 0.12), flinch * 0.36 * gate(body_s, 0.06))
        face = intensity * gate(face_s, 0.10)
        breath_env = intensity * gate(breath_s, 0.12)
        voice_env = intensity * gate(voice_s, 0.14)
        phase_t = max(0.0, self.elapsed - voice_s)
        mouth = voice_env * (0.20 + 0.80 * abs(math.sin(2 * math.pi * 3.4 * phase_t)))
        breath_phase = max(0.0, self.elapsed - breath_s)
        breath = breath_env * (0.35 + 0.65 * abs(math.sin(2 * math.pi * 2.6 * breath_phase)))
        if not active:
            release_damp = math.exp(-self.release_elapsed / 0.9)
            local *= release_damp
            body *= release_damp
            face *= release_damp
            breath *= math.exp(-self.release_elapsed / 0.8)
            mouth *= math.exp(-self.release_elapsed / 0.35)
        result = dict(state)
        result.update({
            't_contact': round(self.elapsed, 4),
            'local': clamp(local), 'body': clamp(body), 'face': clamp(face),
            'breath': clamp(breath), 'voice': clamp(voice_env), 'mouth': clamp(mouth),
            'flinch': clamp(flinch),
            'onsets_ms': {'local': round(motor_s * 1000, 1), 'body': round(body_s * 1000, 1),
                          'face': round(face_s * 1000, 1), 'breath': round(breath_s * 1000, 1),
                          'voice': round(voice_s * 1000, 1)},
        })
        self.last = result
        return result


def run_test():
    contact = {'zone': 'arch_medial', 'tool': 'fingers', 'force': 0.66,
               'speed': 1.0, 'area': 0.7, 'source': 'external', 'expectedness': 0.0}
    model = FullBodyReaction(seed=7)
    rows = []
    first = {}
    for i in range(90):
        st = model.step(1 / 30, contact)
        if i % 3 == 0:
            rows.append(st)
        for channel in ('local', 'body', 'face', 'breath', 'voice'):
            if st[channel] > 0.03 and channel not in first:
                first[channel] = round(i / 30, 3)
    for i in range(90):
        st = model.step(1 / 30, None)
    checks = {
        'local_fast': 0 <= first.get('local', 99) <= 0.15,
        'body_separate': 0 <= first.get('body', 99) <= 0.35,
        'face_measured_range': 0.15 <= first.get('face', 99) <= 0.65,
        'voice_after_face': first.get('voice', 0) > first.get('face', 99),
        'release_decays': st['mouth'] < 0.02 and st['breath'] < 0.05,
        'channels_not_synchronized': len({round(v) for v in rows[0]['onsets_ms'].values()}) == 5,
    }
    report = {'pass': all(checks.values()), 'checks': checks, 'first_activation_s': first,
              'initial_onsets_ms': rows[0]['onsets_ms'], 'after_release': {k: st[k] for k in ('mouth', 'breath', 'local', 'body', 'face')},
              'sample': rows[::10]}
    (HERE / 'reports/model_test.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('FULLBODY_MODEL=' + json.dumps(report, ensure_ascii=False))
    if not report['pass']:
        raise SystemExit(1)


if __name__ == '__main__':
    run_test()
