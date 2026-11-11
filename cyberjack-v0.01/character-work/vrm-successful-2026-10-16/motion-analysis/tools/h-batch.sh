#!/usr/bin/env bash
# Пакетная разметка представителей H-семейств (1 150 клипов) по 40 штук.
# Один клип = 2 прогона VLM по одному контактному листу (один ракурс, модель gemma4:31b).
# Результат дописывается в data/clip-semantics-h-batch.jsonl — можно прервать и продолжить.
set -u
cd "$(dirname "$0")/../.." || exit 1
M=motion-analysis
IDS=$M/data/h-representatives-ids.json
OUT=$M/data/clip-semantics-h-batch.jsonl
LOG=/tmp/h_batch.log
CHUNK=${CHUNK:-40}
TOTAL=$(python3 -c "import json;print(len(json.load(open('$IDS'))))")
: > "$LOG"
echo "всего представителей: $TOTAL, чанк $CHUNK" | tee -a "$LOG"

i=0
while [ $i -lt $TOTAL ]; do
  n=$((i + CHUNK))
  python3 - "$IDS" "$i" "$n" /tmp/h-chunk-ids.json <<'PY'
import json, sys
ids = json.load(open(sys.argv[1]))
a, b = int(sys.argv[2]), int(sys.argv[3])
json.dump(ids[a:b], open(sys.argv[4], 'w'))
PY
  node $M/tools/export-h-clips.mjs --ids /tmp/h-chunk-ids.json --limit $CHUNK --out /tmp/h-chunk.json >> "$LOG" 2>&1
  if [ ! -f /tmp/h-chunk.json ]; then echo "чанк $i: экспорт не удался" | tee -a "$LOG"; i=$n; continue; fi
  VLM_MODEL=gemma4:31b node $M/tools/vlm-annotate.mjs --mode h --views single \
      --clips /tmp/h-chunk.json --limit $CHUNK --out /tmp/h-chunk-annot.jsonl >> "$LOG" 2>&1
  if [ -f /tmp/h-chunk-annot.jsonl ]; then
    cat /tmp/h-chunk-annot.jsonl >> "$OUT"
    echo "чанк $i..$n: размечено $(wc -l < /tmp/h-chunk-annot.jsonl), всего $(wc -l < "$OUT")" | tee -a "$LOG"
  else
    echo "чанк $i..$n: разметка не удалась" | tee -a "$LOG"
  fi
  rm -f /tmp/h-chunk.json /tmp/h-chunk-annot.jsonl
  i=$n
done
echo "ГОТОВО: $(wc -l < "$OUT") записей" | tee -a "$LOG"
