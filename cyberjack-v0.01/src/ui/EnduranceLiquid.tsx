import { useEffect, useRef } from "react";
import { Chart } from "@antv/g2";

// Heart shape — clean SVG path, symmetric
const HEART_PATH = (cx: number, cy: number, r: number) => {
  const s = r * 0.1;
  const ox = cx;
  const oy = cy - r * 0.15;
  const p: (string | number)[][] = [];
  p.push(["M", ox, oy - 2 * s]);
  p.push(["C", ox - 3 * s, oy - 5 * s, ox - 8 * s, oy - 5 * s, ox - 8 * s, oy - 1 * s]);
  p.push(["C", ox - 8 * s, oy + 3 * s, ox - 4 * s, oy + 5 * s, ox, oy + 8 * s]);
  p.push(["C", ox + 4 * s, oy + 5 * s, ox + 8 * s, oy + 3 * s, ox + 8 * s, oy - 1 * s]);
  p.push(["C", ox + 8 * s, oy - 5 * s, ox + 3 * s, oy - 5 * s, ox, oy - 2 * s]);
  p.push(["Z"]);
  return p;
};

export function EnduranceLiquid({ value }: { value: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = new Chart({
      container: containerRef.current,
      autoFit: true,
    });

    const pct = Math.round(Math.max(0, Math.min(1, value / 100)) * 100);

    chart.options({
      type: "liquid",
      autoFit: true,
      data: Math.max(0, Math.min(1, value / 100)),
      style: {
        shape: HEART_PATH,
        outlineBorder: 2,
        outline: {
          border: 2,
          stroke: "#111",
          strokeOpacity: 1,
        },
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

  return (
    <div style={{ width: "120px", height: "120px", overflow: "hidden", marginLeft: "-20px" }}>
      <div ref={containerRef} style={{ width: "120px", height: "120px" }} />
    </div>
  );
}