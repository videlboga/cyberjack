const computeAutoPositions = (nodes) => {
  if (!nodes.length) return {};
  const count = nodes.length;
  const rings = [];
  let remaining = count;
  let ring = 0;
  while (remaining > 0) {
    const baseCapacity = ring === 0 ? Math.min(count, 6) : 6 + ring * 4;
    const capacity = Math.min(remaining, baseCapacity);
    rings.push(capacity);
    remaining -= capacity;
    ring += 1;
  }
  const baseRadius = 24;
  const radiusStep = 14;
  let ringStart = 0;
  let currentRing = 0;
  return nodes.reduce((acc, node, index) => {
    while (index >= ringStart + (rings[currentRing] || 0)) {
      ringStart += rings[currentRing];
      currentRing += 1;
    }
    const ringSize = rings[currentRing] || count;
    const angle = (index - ringStart) / Math.max(ringSize, 1) * Math.PI * 2;
    const radius = baseRadius + currentRing * radiusStep;
    const leftValue = 50 + Math.cos(angle) * radius;
    const topValue = 50 + Math.sin(angle) * radius * 0.75;
    acc[node.id] = { left: leftValue, top: topValue };
    return acc;
  }, {});
};
console.log(computeAutoPositions([{id:1}, {id:2}, {id:3}]));
console.log(computeAutoPositions(new Array(10).fill(0).map((_,i) => ({id:i}))));
