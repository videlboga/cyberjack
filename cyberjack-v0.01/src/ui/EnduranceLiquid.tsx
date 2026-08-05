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

  // Overload glow: orange radial halo behind the heart, grows with overload.
  // 0 overload = no glow, 80+ = max radius and intensity.
  const overloadNorm = Math.max(0, Math.min(1, overload / 80));
  // Glow size scales with overload — larger overload = wider halo
  const glowSize = 40 + overloadNorm * 160; // 40% .. 200% of div
  const glowOpacity = overloadNorm * 0.6;
  // Multi-stop gradient for smooth dissipation from center outward
  const glowStops = [
    `rgba(232,122,40,${glowOpacity}) 0%`,
    `rgba(232,122,40,${glowOpacity * 0.5}) 30%`,
    `rgba(232,122,40,${glowOpacity * 0.2}) 60%`,
    `rgba(232,122,40,0) 100%`,
  ].join(', ');

  return (
    <div
      style={{
        width: "120px",
        height: "120px",
        overflow: "visible",
        marginLeft: "-20px",
        marginTop: "-45px",
        position: "relative",
      }}
    >
      {overload > 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "300px",
            height: "300px",
            transform: "translate(-50%, -50%)",
            borderRadius: "0%",
            background: `radial-gradient(circle ${glowSize}%, ${glowStops})`,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}
      <div ref={containerRef} style={{ width: "120px", height: "120px", position: "relative", zIndex: 1 }} />
    </div>
  );
}