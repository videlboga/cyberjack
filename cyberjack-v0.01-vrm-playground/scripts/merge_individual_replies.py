#!/usr/bin/env python3
"""Мержит individualReplies_{category}.ts в единый individualReplies.ts.

Ключи в исходных файлах: `{zone}:{attitude}:{tier}:{gender}`.
В итоговом файле: `{category}:{zone}:{attitude}:{tier}:{gender}`.
"""
import json
import os
import re

SRC_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "narrative")
CATEGORIES = ["affection", "pain", "stimulation", "intimate", "restraint", "clinical"]

merged = {}
total_cells = 0
total_replies = 0

for cat in CATEGORIES:
    path = os.path.join(SRC_DIR, f"individualReplies_{cat}.ts")
    with open(path, encoding="utf-8") as f:
        text = f.read()
    # Извлечь JSON-объект между первой { и последней }, убрать trailing commas.
    start = text.find("{")
    end = text.rfind("}")
    body = text[start:end + 1]
    body = re.sub(r",\s*([}\]])", r"\1", body)
    obj = json.loads(body)
    for key, vals in obj.items():
        new_key = f"{cat}:{key}"
        if new_key in merged:
            raise ValueError(f"duplicate key {new_key}")
        merged[new_key] = vals
        total_cells += 1
        total_replies += len(vals)

# Записать итоговый файл
out_path = os.path.join(SRC_DIR, "individualReplies.ts")
lines = []
lines.append("// Автогенерировано: индивидуальные реплики для повторяющихся действий.")
lines.append("// Ключ: {category}:{zone}:{attitude}:{tier}:{gender}.")
lines.append("// 6 категорий × 10 зон × 5 отношений × 2 повтора × 2 пола = 1200 ячеек × 3 = 3600 реплик.")
lines.append("")
lines.append("export const INDIVIDUAL_REPLIES: Record<string, string[]> = {")
for key in sorted(merged.keys()):
    vals = merged[key]
    lines.append(f"  {json.dumps(key)}: [")
    for v in vals:
        lines.append(f"    {json.dumps(v, ensure_ascii=False)},")
    lines.append("  ],")
lines.append("};")
with open(out_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print(f"Готово: {total_cells} ячеек, {total_replies} реплик → {out_path}")
