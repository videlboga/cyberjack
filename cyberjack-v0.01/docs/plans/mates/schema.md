# Mate points schema (`cj-mate-points/1`)

Один shard на группу компонентов. Родитель сливает shards в
`component-mates.json`, каталог и viewer.

Каждый shard:

```json
{
  "format": "cj-mate-points/1",
  "group": "structure-surface",
  "components": {
    "<component_id>": {
      "class": "STRUCTURE",
      "mates": [
        {
          "id": "mount_out",
          "role": "output",
          "kind": "bolt_pattern",
          "standard": "M12",
          "gender": "female",
          "position_m": [0.0, 0.24, 0.0],
          "normal": [0.0, 1.0, 0.0],
          "axis": [0.0, 1.0, 0.0],
          "size_m": 0.04,
          "count": 4,
          "pitch_m": 0.6,
          "load_n": 1471.0,
          "source": "node:structure_base__mount_out / bbox top face",
          "confidence": "high",
          "note": "верхняя плита, 4 отверстия"
        }
      ]
    }
  }
}
```

## Rules

- Coordinates are **glTF/three.js local model coordinates**, metres, Y-up,
  relative to the GLB root. No Blender Z-up.
- `position_m` is the actual mating point (flange centre, hole-pattern
  centre, bayonet shoulder, clamp centre, deck surface centre), not the
  component bbox centre.
- `normal` points out of the mating surface. `axis` is the insertion /
  rotation axis.
- `kind`: `bolt_pattern|flange|bayonet|dock|rail|clamp|surface|hose|cable|pivot|mount`.
- `role`: `input|output|support|mount|fluid|signal|power`.
- Use `component-contracts.json` port ids/standards first. If geometry has
  no named port node, derive from the nearest bbox face and set
  `confidence: "medium"` or `"low"`, with the exact node/vertex method.
- Each component should have at least one mechanically useful point if it
  has a mechanical interface. Components with only a resting surface get a
  `surface`/`support` point.
- No invented coordinates: `source` must name the GLB node or bbox face.
- Do not edit GLBs, `component-catalog.json`, `component-contracts.json`,
  `components-viewer.js` or other shards.
