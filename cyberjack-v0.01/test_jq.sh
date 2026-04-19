jq -r '.[] | select((.validTargets | type == "array") and (.validTargets | index("general"))) | .id' src/infrastructure/data/presets/actions.json
