// Balance pendulum — SVG arc with a swinging arm.
// activationBalance: numeric (can be negative).
// The arm swings left (negative) or right (positive) from vertical.
// Max swing ~60° at |balance| = 50.

export function BalanceLabels({ balance, nature, valence }: { balance: number; nature: string; valence?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: "#111", lineHeight: 1.1 }}>
        {balance > 0 ? "+" : ""}{balance}
      </div>
      <div style={{ fontSize: "9px", color: "#555", textAlign: "center", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "visible" }}>
        {nature}{typeof valence === "number" ? ` · ${valence > 0 ? "+" : ""}${Math.round(valence * 100)}` : ""}
      </div>
    </div>
  );
}

export function BalancePendulum({
  balance,
  nature,
  valence,
  showLabels = true,
}: {
  balance: number;
  nature: string;
  valence?: number;
  showLabels?: boolean;
}) {
  // Clamp angle: 50 → 60°, -50 → -60°
  const angle = Math.max(-60, Math.min(60, (balance / 50) * 60));

  // SVG: 100x80 viewBox
  // Pivot at (50, 12), arm length 50
  const pivotX = 50;
  const pivotY = 12;
  const armLen = 48;
  const rad = (angle * Math.PI) / 180;
  const tipX = pivotX + Math.sin(rad) * armLen;
  const tipY = pivotY + Math.cos(rad) * armLen;

  // Bob (circle at tip)
  const bobR = 5;

  // Arc background: -60° to 60°
  const arcStartX = pivotX + Math.sin(-60 * Math.PI / 180) * armLen;
  const arcStartY = pivotY + Math.cos(-60 * Math.PI / 180) * armLen;
  const arcEndX = pivotX + Math.sin(60 * Math.PI / 180) * armLen;
  const arcEndY = pivotY + Math.cos(60 * Math.PI / 180) * armLen;

  // Tick marks at -60, -30, 0, 30, 60
  const ticks = [-60, -30, 0, 30, 60].map((deg) => {
    const tr = (deg * Math.PI) / 180;
    const r1 = armLen + 2;
    const r2 = armLen + 5;
    return {
      x1: pivotX + Math.sin(tr) * r1,
      y1: pivotY + Math.cos(tr) * r1,
      x2: pivotX + Math.sin(tr) * r2,
      y2: pivotY + Math.cos(tr) * r2,
    };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0px", width: "100%", overflow: "visible" }}>
      <svg viewBox="0 0 100 75" preserveAspectRatio="xMidYMid meet" style={{ width: "100px", height: "75px", overflow: "visible" }}>
        {/* Arc background */}
        <path
          d={`M ${arcStartX} ${arcStartY} A ${armLen} ${armLen} 0 0 1 ${arcEndX} ${arcEndY}`}
          fill="none"
          stroke="#999"
          strokeWidth="0.5"
          strokeDasharray="2 2"
        />
        {/* Ticks */}
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#999" strokeWidth="0.5" />
        ))}
        {/* Center line (0°) */}
        <line x1={pivotX} y1={pivotY} x2={pivotX} y2={pivotY + armLen + 4} stroke="#ddd" strokeWidth="0.5" strokeDasharray="1 2" />
        {/* Pivot */}
        <circle cx={pivotX} cy={pivotY} r="1.5" fill="#111" />
        {/* Arm */}
        <line x1={pivotX} y1={pivotY} x2={tipX} y2={tipY} stroke="#111" strokeWidth="1.2" strokeLinecap="round" />
        {/* Bob */}
        <circle cx={tipX} cy={tipY} r={bobR} fill="none" stroke="#111" strokeWidth="1.2" />
      </svg>
      {showLabels && (
        <>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#111", lineHeight: 1.1 }}>
            {balance > 0 ? "+" : ""}{balance}
          </div>
          <div style={{ fontSize: "9px", color: "#555", textAlign: "center", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "visible" }}>
            {nature}{typeof valence === "number" ? ` · ${valence > 0 ? "+" : ""}${Math.round(valence * 100)}` : ""}
          </div>
        </>
      )}
    </div>
  );
}