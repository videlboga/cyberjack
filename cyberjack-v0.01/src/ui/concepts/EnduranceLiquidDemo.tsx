import { EnduranceLiquid } from "../EnduranceLiquid";

// Demo: all overload stages on the liquid heart
const STAGES = [
  { capacity: 80, overload: 0, label: "Спокойствие" },
  { capacity: 70, overload: 5, label: "Лёгкое напряжение" },
  { capacity: 55, overload: 15, label: "Заметная перегрузка" },
  { capacity: 40, overload: 30, label: "Сильная перегрузка" },
  { capacity: 25, overload: 50, label: "Критическая перегрузка" },
  { capacity: 12, overload: 70, label: "Перед срывом" },
  { capacity: 5, overload: 90, label: "Разрушение" },
  { capacity: 50, overload: 0, label: "Восстановление" },
];

export function EnduranceLiquidDemo() {
  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "24px",
      padding: "32px",
      background: "#f8f8f8",
      minHeight: "100vh",
      fontFamily: "monospace",
    }}>
      {STAGES.map((stage, i) => (
        <div key={i} style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          padding: "16px",
          border: "1px solid #ccc",
          background: "#fff",
        }}>
          <EnduranceLiquid value={stage.capacity} overload={stage.overload} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#111" }}>{stage.label}</div>
            <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>
              выносливость {stage.capacity}% · перегрузка {stage.overload}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}