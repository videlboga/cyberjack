import { EnduranceLiquid } from "../EnduranceLiquid";
import { BalancePendulum } from "../BalancePendulum";

// Demo: all overload stages on the liquid heart + balance pendulum states
const STAGES = [
  { capacity: 80, overload: 0, balance: 0, valence: 0, label: "Спокойствие" },
  { capacity: 70, overload: 5, balance: 10, valence: 0.2, label: "Лёгкое напряжение" },
  { capacity: 55, overload: 15, balance: 25, valence: 0.4, label: "Заметная перегрузка" },
  { capacity: 40, overload: 30, balance: -15, valence: -0.3, label: "Сильная перегрузка" },
  { capacity: 25, overload: 50, balance: -35, valence: -0.5, label: "Критическая перегрузка" },
  { capacity: 12, overload: 70, balance: -50, valence: -0.8, label: "Перед срывом" },
  { capacity: 5, overload: 90, balance: -45, valence: -0.9, label: "Разрушение" },
  { capacity: 50, overload: 0, balance: 5, valence: 0.1, label: "Восстановление" },
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
          <BalancePendulum balance={stage.balance} nature="смешанная" valence={stage.valence} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#111" }}>{stage.label}</div>
            <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>
              вын. {stage.capacity}% · перег. {stage.overload} · бал. {stage.balance > 0 ? "+" : ""}{stage.balance}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}