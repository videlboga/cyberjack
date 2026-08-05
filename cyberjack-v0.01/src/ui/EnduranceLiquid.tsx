import { useEffect, useRef } from "react";
import { Chart } from "@antv/g2";

// Heart shape — SVG path string, symmetric
const HEART_PATH = (cx: number, cy: number, r: number) => {
  const s = r * 0.1;
  const ox = cx;
  const oy = cy - r * 0.15;
  return [
    `M ${ox} ${oy - 2 * s}`,
    `C ${ox - 3 * s} ${oy - 5 * s}, ${ox - 8 * s} ${oy - 5 * s}, ${ox - 8 * s} ${oy - 1 * s}`,
    `C ${ox - 8 * s} ${oy + 3 * s}, ${ox - 4 * s} ${oy + 5 * s}, ${ox} ${oy + 8 * s}`,
    `C ${ox + 4 * s} ${oy + 5 * s}, ${ox + 8 * s} ${oy + 3 * s}, ${ox + 8 * s} ${oy - 1 * s}`,
    `C ${ox + 8 * s} ${oy - 5 * s}, ${ox + 3 * s} ${oy - 5 * s}, ${ox} ${oy - 2 * s}`,
    `Z`,
  ].join(' ');
};

// Crack positions on the heart — coordinates match G2 heart path.
// Heart occupies approximately x:12..108, y:39..99 on a 120x120 canvas.
// Center at (60, 69), s=6 (r*0.1), oy=51 (cy - r*0.15).
const CRACK_SEEDS = [
  // top-left lobe (heart top ~y=39)
  { x: 42, y: 40, dx: 6, dy: 10 },
  { x: 28, y: 50, dx: 10, dy: 4 },
  // top-right lobe
  { x: 78, y: 40, dx: -6, dy: 10 },
  { x: 92, y: 50, dx: -10, dy: 4 },
  // center dip (between lobes)
  { x: 60, y: 44, dx: 0, dy: 8 },
  // lower left
  { x: 42, y: 68, dx: 8, dy: 8 },
  // lower right
  { x: 78, y: 68, dx: -8, dy: 8 },
  // tip
  { x: 60, y: 88, dx: 0, dy: -4 },
];

function crackPath(seed: typeof CRACK_SEEDS[0], intensity: number): string {
  // intensity 0..1 — how far the crack extends from the edge inward.
  // Build a jagged zigzag with 3-4 segments for a crack-like appearance.
  const len = intensity;
  const dx = seed.dx * len;
  const dy = seed.dy * len;
  // Start point (on the heart outline)
  const x0 = seed.x;
  const y0 = seed.y;
  // End point
  const x3 = x0 + dx;
  const y3 = y0 + dy;
  // Two intermediate points with perpendicular jitter for jaggedness
  // Perpendicular to (dx,dy) is (-dy,dx) normalized
  const plen = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / plen;
  const py = dx / plen;
  // Jitter amounts — alternate sides for zigzag
  const j1 = plen * 0.18;
  const j2 = plen * 0.12;
  const x1 = x0 + dx * 0.33 + px * j1;
  const y1 = y0 + dy * 0.33 + py * j1;
  const x2 = x0 + dx * 0.66 - px * j2;
  const y2 = y0 + dy * 0.66 - py * j2;
  return `M ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3}`;
}

// Branch off the main crack for a more fractured look
function crackBranch(seed: typeof CRACK_SEEDS[0], intensity: number): string | null {
  if (intensity < 0.5) return null;
  // Small branch at 60% along the main crack
  const len = intensity;
  const bx = seed.x + seed.dx * len * 0.6;
  const by = seed.y + seed.dy * len * 0.6;
  const plen = Math.sqrt(seed.dx * seed.dx + seed.dy * seed.dy) * len || 1;
  const px = -seed.dy / Math.sqrt(seed.dx * seed.dx + seed.dy * seed.dy);
  const py = seed.dx / Math.sqrt(seed.dx * seed.dx + seed.dy * seed.dy);
  const bx2 = bx + px * plen * 0.2 + seed.dx * 0.1;
  const by2 = by + py * plen * 0.2 + seed.dy * 0.1;
  return `M ${bx} ${by} L ${bx2} ${by2}`;
}

export function EnduranceLiquid({ value, overload = 0 }: { value: number; overload?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = new Chart({
      container: containerRef.current,
      autoFit: true,
    });

    const pct = Math.round(Math.max(0, Math.min(1, value / 100)) * 100);

    // G2 liquid measures fill level by the bounding box height, not by the
    // shape's area. A heart is wider at the top and narrows to a point at the
    // bottom, so the same percentage of box height fills noticeably less of
    // the visible heart. Compensate by mapping the displayed percentage
    // through a mild curve that lifts the water level to better match the
    // perceived fill.
    const rawRatio = Math.max(0, Math.min(1, value / 100));
    // Heart is wide at top, narrow at bottom. G2 fills by bounding box height.
    // Use a steeper curve so low/mid values lift visibly while 100% stays 100%.
    const visualRatio = Math.pow(rawRatio, 0.58);

    chart.options({
      type: "liquid",
      autoFit: true,
      data: visualRatio,
      style: {
        shape: HEART_PATH,
        outlineBorder: 2,
        outlineStroke: "#111",
        outlineStrokeOpacity: 1,
        outlineDistance: 0,
        waveLength: 64,
        // Liquid fill — soft red
        fill: "#c44545",
        // Show percentage text inside heart — black, bold, centered
        textText: `${pct}%`,
        textFontSize: 16,
        textFill: "#111",
        textFillOpacity: 1,
        textFontWeight: 700,
        textStroke: "rgba(0,0,0,0)",
        textStrokeOpacity: 0,
        textOpacity: 1,
      },
    } as any);

    chart.render();

    chartRef.current = chart;

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [value]);

  // Cracks: show when overload >= 10, scale up to full at overload >= 80.
  // Each crack has a threshold — they appear progressively, not all at once.
  const overloadNorm = Math.max(0, Math.min(1, (overload - 10) / 70));
  const visibleCracks: string[] = [];
  const visibleBranches: string[] = [];
  CRACK_SEEDS.forEach((seed, i) => {
    const threshold = i / CRACK_SEEDS.length;
    if (overloadNorm <= threshold) return;
    const local = Math.min(1, (overloadNorm - threshold) / (1 - threshold) * 0.7 + 0.3);
    visibleCracks.push(crackPath(seed, local));
    const branch = crackBranch(seed, local);
    if (branch) visibleBranches.push(branch);
  });

  return (
    <div style={{ width: "120px", height: "120px", overflow: "hidden", marginLeft: "-20px", position: "relative" }}>
      <div ref={containerRef} style={{ width: "120px", height: "120px" }} />
      {visibleCracks.length > 0 && (
        <svg
          viewBox="0 0 120 120"
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "120px",
            height: "120px",
            pointerEvents: "none",
          }}
        >
          {visibleCracks.map((d, i) => (
            <path
              key={`c${i}`}
              d={d}
              fill="none"
              stroke="#111"
              strokeWidth={overload >= 40 ? 1.2 : 0.8}
              strokeLinecap="round"
              opacity={Math.min(1, overloadNorm * 1.5)}
            />
          ))}
          {visibleBranches.map((d, i) => (
            <path
              key={`b${i}`}
              d={d}
              fill="none"
              stroke="#111"
              strokeWidth={overload >= 40 ? 0.8 : 0.6}
              strokeLinecap="round"
              opacity={Math.min(0.8, overloadNorm * 1.2)}
            />
          ))}
        </svg>
      )}
    </div>
  );
}