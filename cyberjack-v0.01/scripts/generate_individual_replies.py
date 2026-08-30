#!/usr/bin/env python3
"""
Генератор индивидуальных реплик для повторяющихся физических действий.

Вызывает ollama deepseek-v4-flash:cloud ПО ОДНОЙ ЗОНЕ ЗА РАЗ (20 ячеек на зону),
чтобы модель не схлопывала вариативность между зонами. Собирает реплики в
src/narrative/individualReplies_{category}.ts

Использование:
  python3 scripts/generate_individual_replies.py <category> [--zone <zone>]

Категории: affection, pain, stimulation, intimate, restraint, clinical
Зоны: face, neck, chest, belly, back, arms, legs, genitals, anus, feet
"""

import json
import re
import sys
import urllib.request
import os

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
MODEL = "deepseek-v4-flash:cloud"

ZONES = {
    "face": "лицо",
    "neck": "шея",
    "chest": "грудь",
    "belly": "живот",
    "back": "спина",
    "arms": "руки",
    "legs": "ноги",
    "genitals": "гениталии (вульва/член)",
    "anus": "анус",
    "feet": "ступни",
}

# Характер ощущения каждой зоны — материал для живых фраз БЕЗ анатомических
# названий. Зона должна угадываться по ощущению, а не называться прямо.
ZONE_DETAILS = {
    "face": "тепло у самого лица, чужое дыхание, близость, мягкое касание губ",
    "neck": "мурашки по коже, тёплое дыхание у кожи, дрожь, чувствительность",
    "chest": "сердцебиение, тепло, тяжесть, сбитое дыхание",
    "belly": "дрожь внизу живота, тепло, щекотка, слабость",
    "back": "мурашки вдоль позвоночника, расслабление, тепло, дрожь",
    "arms": "лёгкость, щекотка, мурашки, слабость",
    "legs": "дрожь, слабость в коленях, тепло, мурашки",
    "genitals": "острота, пульсация, влажность, жар, нарастающая волна",
    "anus": "давление, растяжение, глубина, сжатие, заполненность",
    "feet": "щекотка, лёгкость, мурашки, неожиданная чувствительность",
}

ATTITUDES = {
    "high": "доверяет оператору, расположена к нему, хочет этого",
    "midhigh": "начинает доверять, почти спокойна",
    "mid": "насторожена, колеблется, не знает что думать",
    "midlow": "не доверяет, тревожно, хочет отстраниться",
    "low": "боится, ненавидит, испытывает отторжение",
}

CATEGORIES = {
    "affection": "нежность (поглаживание, поцелуй, массаж, ласка) — тепло, забота",
    "pain": "боль (удар, пощёчина, укус, хлыст, щипок) — страдание, сопротивление",
    "stimulation": "стимуляция (вибрация, электро, лёд, перо, щекотка) — острота, дрожь",
    "intimate": "интим (проникновение, оральный, секс) — глубина, близость",
    "restraint": "фиксация (наручники, ошейник, подвес, ремни) — беспомощность, скованность",
    "clinical": "клиника (осмотр, инъекция, пальпация, инструменты) — холод, объективация",
}

TIERS = {
    "t2": "повтор 2-3 раза: персонаж замечает, что действие повторяется",
    "t4": "повтор 4+ раз: персонаж привыкает (если приятно) или устаёт/сдаётся (если неприятно)",
}

GENDERS = {
    "female": "женщина, говорит о себе в женском роде",
    "male": "мужчина, говорит о себе в мужском роде",
}


def build_cells(category, zone=None):
    cells = []
    zones = [zone] if zone else list(ZONES.keys())
    for z in zones:
        for attitude in ATTITUDES:
            for tier in TIERS:
                for gender in GENDERS:
                    cells.append((z, attitude, tier, gender))
    return cells


def build_prompt(category, cells):
    # Все ячейки в батче относятся к одной зоне (по построению).
    zone = cells[0][0]
    lines = []
    lines.append("Ты пишешь реплики персонажа в эротической игре-симуляторе на русском языке.")
    lines.append("")
    lines.append(f"Категория действия: {CATEGORIES[category]}.")
    lines.append(f"Зона тела: {ZONES[zone]}.")
    lines.append(f"Конкретные детали этой зоны, которые можно упомянуть: {ZONE_DETAILS[zone]}.")
    lines.append("")
    lines.append("Для каждой комбинации ниже напиши РОВНО 3 реплики — короткие фразы,")
    lines.append("которые персонаж произносит вслух под воздействием повторяющегося действия.")
    lines.append("")
    lines.append("Требования к каждой реплике:")
    lines.append("- только произносимые слова, от первого лица;")
    lines.append("- без кавычек, звёздочек, ремарок, описаний действий, имён;")
    lines.append("- живая разговорная речь, многоточия и обрывы допустимы;")
    lines.append("- отражает категорию, зону тела, отношение и усталость/привыкание от повтора;")
    lines.append("- 3 реплики в ячейке не повторяются между собой.")
    lines.append("")
    lines.append("КРИТИЧЕСКИ ВАЖНО — естественность речи:")
    lines.append("- НЕ называй части тела анатомически («моя шея», «мой клитор», «моя грудь»,")
    lines.append("  «мои ступни», «моё лицо»). В живой речи люди так не говорят;")
    lines.append("- передавай ощущение через реакцию тела: дрожь, жар, мурашки, слабость,")
    lines.append("  сбитое дыхание, пульс, волну — зона должна УГАДЫВАТЬСЯ, а не называться;")
    lines.append("- допустимы лишь самые общие слова («там», «здесь», «внутри», «кожа»),")
    lines.append("  но не конкретные органы или части тела;")
    lines.append("- фраза должна звучать так, как человек реально говорит в такой момент.")
    lines.append("")
    lines.append("Примеры ЕСТЕСТВЕННЫХ фраз (без анатомии, но с живым ощущением):")
    lines.append("  хорошо: «Опять... по коже мурашки, не могу привыкнуть.»")
    lines.append("  хорошо: «Снова этот жар... я уже жду его.»")
    lines.append("  хорошо: «Не надо... я вся дрожу, хватит.»")
    lines.append("  хорошо: «Ещё... глубже... я уже не выдерживаю.»")
    lines.append("  плохо: «Ты снова трогаешь мою шею.» (анатомия)")
    lines.append("  плохо: «Снова... я не знаю, что думать.» (штамп)")
    lines.append("  плохо: «Опять... мне тревожно.» (штамп)")
    lines.append("")
    lines.append("КРИТИЧЕСКИ ВАЖНО — уникальность:")
    lines.append("- каждая ячейка (отношение × повтор × пол) должна звучать ПО-СВОЕМУ;")
    lines.append("- НЕ начинай каждую фразу с «Снова...» или «Опять...» — варьируй зачин;")
    lines.append("- НЕ используй одну и ту же структуру фразы для разных отношений;")
    lines.append("- «я не знаю, что думать», «мне тревожно», «не надо», «мне всё равно» —")
    lines.append("  запрещённые штампы, заменяй их конкретной реакцией на ЭТУ зону и ЭТО отношение;")
    lines.append("- male и female должны отличаться не только окончанием глагола, но и")
    lines.append("  самим содержанием, интонацией, выбором слов;")
    lines.append("- упоминай характер ощущения зоны (из списка выше), чтобы фразы были живыми.")
    lines.append("")
    lines.append("Верни ТОЛЬКО валидный JSON-объект. Ключ — строка вида")
    lines.append("`{zone}:{attitude}:{tier}:{gender}`, значение — массив из 3 строк.")
    lines.append("")
    lines.append("Комбинации (ключ → зона, отношение, повтор, пол):")
    for z, attitude, tier, gender in cells:
        key = f"{z}:{attitude}:{tier}:{gender}"
        lines.append(f"- {key} → зона «{ZONES[z]}», {ATTITUDES[attitude]}, {TIERS[tier]}, {GENDERS[gender]}")
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
    """Извлекает JSON-объект из ответа модели (может быть обёрнут в ```json)."""
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


def load_existing(category):
    """Читает уже сгенерированные ячейки из существующего TS-файла (для resume)."""
    out_path = os.path.join(os.path.dirname(__file__), "..", "src", "narrative", f"individualReplies_{category}.ts")
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


def write_ts(category, result):
    out_path = os.path.join(os.path.dirname(__file__), "..", "src", "narrative", f"individualReplies_{category}.ts")
    out_path = os.path.abspath(out_path)
    lines = []
    lines.append("// Автогенерировано: индивидуальные реплики для повторяющихся действий.")
    lines.append(f"// Категория: {category} ({CATEGORIES[category]})")
    lines.append("")
    lines.append("export const INDIVIDUAL_REPLIES: Record<string, string[]> = {")
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
    zone = None
    if "--zone" in sys.argv:
        zi = sys.argv.index("--zone")
        zone = sys.argv[zi + 1]
    if len(args) != 1:
        print("usage: generate_individual_replies.py <category> [--zone <zone>]", file=sys.stderr)
        sys.exit(1)
    category = args[0]
    if category not in CATEGORIES:
        print(f"unknown category: {category}", file=sys.stderr)
        sys.exit(1)
    if zone and zone not in ZONES:
        print(f"unknown zone: {zone}", file=sys.stderr)
        sys.exit(1)

    cells = build_cells(category, zone)
    print(f"Категория {category}: {len(cells)} ячеек, {len(cells) * 3} реплик")

    # Resume: подхватываем уже готовые ячейки.
    result = load_existing(category)
    if result:
        print(f"  resume: уже готово {len(result)} ячеек")

    zones = [zone] if zone else list(ZONES.keys())
    for z in zones:
        zone_cells = [c for c in cells if c[0] == z]
        # Пропускаем уже готовые ключи этой зоны.
        pending = [c for c in zone_cells if f"{c[0]}:{c[1]}:{c[2]}:{c[3]}" not in result]
        if not pending:
            print(f"  зона {z}: уже готова, пропуск", flush=True)
            continue
        print(f"  зона {z}: {len(pending)} ячеек...", flush=True)
        # Батч по 10 ячеек (пол-зоны) — меньше промпт, меньше шанс зависания.
        for i in range(0, len(pending), 10):
            batch = pending[i:i + 10]
            prompt = build_prompt(category, batch)
            ok = False
            for attempt in range(3):
                try:
                    raw = call_ollama(prompt)
                    parsed = extract_json(raw)
                    for zz, attitude, tier, gender in batch:
                        key = f"{zz}:{attitude}:{tier}:{gender}"
                        if key not in parsed:
                            raise ValueError(f"missing key {key}")
                        vals = parsed[key]
                        if not isinstance(vals, list) or len(vals) != 3:
                            raise ValueError(f"key {key} has {len(vals) if isinstance(vals, list) else 'non-list'} values")
                        if not all(isinstance(v, str) and v.strip() for v in vals):
                            raise ValueError(f"key {key} has empty values")
                    result.update(parsed)
                    ok = True
                    break
                except Exception as e:
                    print(f"    попытка {attempt + 1} не удалась: {e}", flush=True)
                    if attempt == 2:
                        print(f"    БАТЧ ПРОВАЛЕН после 3 попыток (пропускаю, продолжу дальше)", file=sys.stderr)
            # Сохраняем прогресс после каждого батча.
            write_ts(category, result)

    out_path = write_ts(category, result)
    print(f"Готово: {len(result)} ячеек → {out_path}")


if __name__ == "__main__":
    main()
