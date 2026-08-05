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
  // intensity 0..1 — how long the crack extends
  const len = intensity;
  const x2 = seed.x + seed.dx * len;
  const y2 = seed.y + seed.dy * len;
  // Jagged midpoint offset
  const mx = (seed.x + x2) / 2 + (seed.dx > 0 ? -1.5 : seed.dx < 0 ? 1.5 : 0) * len;
  const my = (seed.y + y2) / 2 + 1.5 * len;
  return `M ${seed.x} ${seed.y} L ${mx} ${my} L ${x2} ${y2}`;
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
  const visibleCracks = CRACK_SEEDS.map((seed, i) => {
    // Stagger: crack i appears at overloadNorm >= i / CRACK_SEEDS.length
    const threshold = i / CRACK_SEEDS.length;
    if (overloadNorm <= threshold) return null;
    // Length grows from 0.3 to 1.0 within its visibility window
    const local = Math.min(1, (overloadNorm - threshold) / (1 - threshold) * 0.7 + 0.3);
    return crackPath(seed, local);
  }).filter(Boolean) as string[];

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
              key={i}
              d={d}
              fill="none"
              stroke="#111"
              strokeWidth={overload >= 40 ? 1.5 : 1}
              strokeLinecap="round"
              opacity={Math.min(1, overloadNorm * 1.5)}
            />
          ))}
        </svg>
      )}
    </div>
  );
}