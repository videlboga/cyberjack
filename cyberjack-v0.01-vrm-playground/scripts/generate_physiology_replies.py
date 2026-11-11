#!/usr/bin/env python3
"""
Генератор расширенных физиологических реплик + реплик по циклам.

Генерирует через ollama deepseek-v4-flash:cloud:
  1. Физиология: {event}:{affect}:{gender} — 25 вариаций на ячейку.
  2. Циклы: {event}:{affect}:{gender}:{cycle} — 5 вариаций на ячейку,
     cycle = c1/c2/c3/c4 (номер волны подхода к пику без разрядки).

Вывод: src/narrative/physiologyReplies.ts

Использование:
  python3 scripts/generate_physiology_replies.py [--event <event>]
"""

import json
import re
import sys
import urllib.request
import os

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
MODEL = "deepseek-v4-flash:cloud"

EVENTS = {
    "discharge": "оргазм — пик прорвался, разрядка, контроль речи почти потерян",
    "breakdown": "нервный срыв — предельное напряжение сорвало контроль, речь распадается",
    "overload": "сенсорная перегрузка — ощущения дошли до предела, но не разрешились",
    "peak": "у самой грани — вот-вот разрядка, но ещё не наступила",
    "edge": "удержание у грани — напряжение держится у пика, не разрешаясь",
}

AFFECTS = {
    "positive": "положительная окраска — хочет этого, приятно, тянется к продолжению",
    "negative": "отрицательная окраска — не хочет, больно, отторжение, хочет прекратить",
    "mixed": "смешанная — одновременно хочет и боится, приятное и неприятное вместе",
    "overload": "перегрузка — слишком много, теряется, не может собраться",
}

GENDERS = {
    "female": "женщина, говорит о себе в женском роде",
    "male": "мужчина, говорит о себе в мужском роде",
}

CYCLES = {
    "c1": "первая волна — только что оказалась на грани, острота новизны",
    "c2": "вторая волна — снова подходит к пику, узнаёт знакомое приближение",
    "c3": "третья волна — начинает уставать или привыкать, тело уже ждёт",
    "c4": "четвёртая и далее волна — устала/привыкла, тело сдаётся или требует разрядки",
}


def build_physiology_cells(event=None):
    cells = []
    events = [event] if event else list(EVENTS.keys())
    for e in events:
        for a in AFFECTS:
            for g in GENDERS:
                cells.append((e, a, g))
    return cells


def build_cycle_cells(event=None):
    cells = []
    events = [event] if event else ['peak', 'edge']
    for e in events:
        for a in AFFECTS:
            for g in GENDERS:
                for c in CYCLES:
                    cells.append((e, a, g, c))
    return cells


def build_physiology_prompt(cells):
    lines = []
    lines.append("Ты пишешь реплики персонажа в эротической игре-симуляторе на русском языке.")
    lines.append("")
    lines.append("Для каждой комбинации ниже напиши РОВНО 25 реплик — короткие фразы,")
    lines.append("которые персонаж произносит вслух в этом физиологическом состоянии.")
    lines.append("")
    lines.append("Требования к каждой реплике:")
    lines.append("- только произносимые слова, от первого лица;")
    lines.append("- без кавычек, звёздочек, ремарок, описаний действий, имён;")
    lines.append("- живая разговорная речь, многоточия и обрывы допустимы;")
    lines.append("- отражает состояние и окраску;")
    lines.append("- 25 реплик в ячейке не повторяются между собой.")
    lines.append("")
    lines.append("КРИТИЧЕСКИ ВАЖНО — естественность и уникальность:")
    lines.append("- НЕ называй части тела анатомически; передавай ощущение через реакцию")
    lines.append("  (дрожь, жар, мурашки, слабость, сбитое дыхание, пульс, волну);")
    lines.append("- НЕ начинай каждую фразу с «Снова...» или «Опять...» — варьируй зачин;")
    lines.append("- «я не знаю, что думать», «мне тревожно», «не надо» — запрещённые штампы;")
    lines.append("- male и female должны отличаться содержанием, а не только окончанием;")
    lines.append("- каждая из 25 реплик должна звучать ПО-СВОЕМУ, без повторов структуры.")
    lines.append("")
    lines.append("Верни ТОЛЬКО валидный JSON-объект. Ключ — строка вида")
    lines.append("`{event}:{affect}:{gender}`, значение — массив из 25 строк.")
    lines.append("")
    lines.append("Комбинации (ключ → состояние, окраска, пол):")
    for e, a, g in cells:
        key = f"{e}:{a}:{g}"
        lines.append(f"- {key} → {EVENTS[e]}, {AFFECTS[a]}, {GENDERS[g]}")
    return "\n".join(lines)


def build_cycle_prompt(cells):
    lines = []
    lines.append("Ты пишешь реплики персонажа в эротической игре-симуляторе на русском языке.")
    lines.append("")
    lines.append("Персонаж удерживается у грани (пика). Каждая новая «волна» — это подход")
    lines.append("к пику без разрядки. Реплики должны МЕНЯТЬСЯ от волны к волне:")
    lines.append("первая волна — острота новизны, четвёртая — усталость/привыкание/сдача.")
    lines.append("")
    lines.append("Для каждой комбинации ниже напиши РОВНО 5 реплик.")
    lines.append("")
    lines.append("Требования к каждой реплике:")
    lines.append("- только произносимые слова, от первого лица;")
    lines.append("- без кавычек, звёздочек, ремарок, описаний действий, имён;")
    lines.append("- живая разговорная речь, многоточия и обрывы допустимы;")
    lines.append("- отражает состояние, окраску И номер волны (цикл);")
    lines.append("- 5 реплик в ячейке не повторяются между собой.")
    lines.append("")
    lines.append("КРИТИЧЕСКИ ВАЖНО — естественность и уникальность:")
    lines.append("- НЕ называй части тела анатомически; передавай ощущение через реакцию;")
    lines.append("- НЕ начинай каждую фразу с «Снова...» или «Опять...»;")
    lines.append("- «я не знаю, что думать», «мне тревожно» — запрещённые штампы;")
    lines.append("- male и female должны отличаться содержанием;")
    lines.append("- реплики разных циклов должны заметно отличаться (c1 ≠ c4).")
    lines.append("")
    lines.append("Верни ТОЛЬКО валидный JSON-объект. Ключ — строка вида")
    lines.append("`{event}:{affect}:{gender}:{cycle}`, значение — массив из 5 строк.")
    lines.append("")
    lines.append("Комбинации (ключ → состояние, окраска, пол, цикл):")
    for e, a, g, c in cells:
        key = f"{e}:{a}:{g}:{c}"
        lines.append(f"- {key} → {EVENTS[e]}, {AFFECTS[a]}, {GENDERS[g]}, {CYCLES[c]}")
    return "\n".join(lines)


def call_ollama(prompt):
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0.9},
    }).encode("utf-8")
    req = urllib.request.Request(OLLAMA_URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["message"]["content"]


def extract_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object found")
    return json.loads(text[start:end + 1])


def load_existing():
    out_path = os.path.join(os.path.dirname(__file__), "..", "src", "narrative", "physiologyReplies.ts")
    out_path = os.path.abspath(out_path)
    if not os.path.exists(out_path):
        return {}
    with open(out_path, encoding="utf-8") as f:
        text = f.read()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        return {}
    body = text[start:end + 1]
    body = re.sub(r",\s*([}\]])", r"\1", body)
    try:
        return json.loads(body)
    except Exception:
        return {}


def write_ts(result):
    out_path = os.path.join(os.path.dirname(__file__), "..", "src", "narrative", "physiologyReplies.ts")
    out_path = os.path.abspath(out_path)
    lines = []
    lines.append("// Автогенерировано: расширенные физиологические реплики + реплики по циклам.")
    lines.append("// Ключ физиологии: {event}:{affect}:{gender} (25 вариаций).")
    lines.append("// Ключ цикла: {event}:{affect}:{gender}:{cycle} (5 вариаций, cycle=c1..c4).")
    lines.append("")
    lines.append("export const PHYSIOLOGY_REPLIES: Record<string, string[]> = {")
    for key in sorted(result.keys()):
        vals = result[key]
        lines.append(f"  {json.dumps(key)}: [")
        for v in vals:
            lines.append(f"    {json.dumps(v, ensure_ascii=False)},")
        lines.append("  ],")
    lines.append("};")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return out_path


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    event = None
    if "--event" in sys.argv:
        event = sys.argv[sys.argv.index("--event") + 1]
    if event and event not in EVENTS:
        print(f"unknown event: {event}", file=sys.stderr)
        sys.exit(1)

    result = load_existing()
    if result:
        print(f"resume: уже готово {len(result)} ячеек")

    # 1. Физиология (25 вариаций на ячейку)
    phys_cells = build_physiology_cells(event)
    for e, a, g in phys_cells:
        key = f"{e}:{a}:{g}"
        if key in result and len(result[key]) >= 25:
            continue
        print(f"физиология {key}...", flush=True)
        prompt = build_physiology_prompt([(e, a, g)])
        for attempt in range(3):
            try:
                raw = call_ollama(prompt)
                parsed = extract_json(raw)
                if key not in parsed:
                    raise ValueError(f"missing key {key}")
                vals = parsed[key]
                if not isinstance(vals, list) or len(vals) < 20:
                    raise ValueError(f"key {key} has {len(vals) if isinstance(vals, list) else 'non-list'} values")
                if not all(isinstance(v, str) and v.strip() for v in vals):
                    raise ValueError(f"key {key} has empty values")
                result[key] = vals
                write_ts(result)
                break
            except Exception as ex:
                print(f"  попытка {attempt + 1} не удалась: {ex}", flush=True)
                if attempt == 2:
                    print(f"  ЯЧЕЙКА {key} ПРОВАЛЕНА (пропускаю)", file=sys.stderr)

    # 2. Циклы (5 вариаций на ячейку)
    cycle_cells = build_cycle_cells(event)
    for e, a, g, c in cycle_cells:
        key = f"{e}:{a}:{g}:{c}"
        if key in result and len(result[key]) >= 5:
            continue
        print(f"цикл {key}...", flush=True)
        prompt = build_cycle_prompt([(e, a, g, c)])
        for attempt in range(3):
            try:
                raw = call_ollama(prompt)
                parsed = extract_json(raw)
                if key not in parsed:
                    raise ValueError(f"missing key {key}")
                vals = parsed[key]
                if not isinstance(vals, list) or len(vals) != 5:
                    raise ValueError(f"key {key} has {len(vals) if isinstance(vals, list) else 'non-list'} values")
                if not all(isinstance(v, str) and v.strip() for v in vals):
                    raise ValueError(f"key {key} has empty values")
                result[key] = vals
                write_ts(result)
                break
            except Exception as ex:
                print(f"  попытка {attempt + 1} не удалась: {ex}", flush=True)
                if attempt == 2:
                    print(f"  ЯЧЕЙКА {key} ПРОВАЛЕНА (пропускаю)", file=sys.stderr)

    out_path = write_ts(result)
    print(f"Готово: {len(result)} ячеек → {out_path}")


if __name__ == "__main__":
    main()
