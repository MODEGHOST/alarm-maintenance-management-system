"use client";

type Point = { label: string; value: number; color?: string };

export function BarChart({
  title,
  points,
  height = 180,
}: {
  title: string;
  points: Point[];
  height?: number;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));

  return (
    <div className="chart-panel">
      <h4>{title}</h4>
      {points.length === 0 ? (
        <p className="chart-empty">ยังไม่มีข้อมูล</p>
      ) : (
        <div className="bar-chart" style={{ height }}>
          {points.map((p) => (
            <div key={p.label} className="bar-col" title={`${p.label}: ${p.value}`}>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    height: `${(p.value / max) * 100}%`,
                    background: p.color || "var(--chart-bar)",
                  }}
                />
              </div>
              <strong>{p.value}</strong>
              <span>{p.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DonutStat({
  title,
  segments,
}: {
  title: string;
  segments: Point[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const stops = segments.reduce<{ stops: string[]; acc: number }>(
    (state, s) => {
      const start = (state.acc / total) * 100;
      const nextAcc = state.acc + s.value;
      const end = (nextAcc / total) * 100;
      return {
        acc: nextAcc,
        stops: [
          ...state.stops,
          `${s.color || "#64748b"} ${start}% ${end}%`,
        ],
      };
    },
    { stops: [], acc: 0 },
  ).stops;

  return (
    <div className="chart-panel">
      <h4>{title}</h4>
      <div className="donut-wrap">
        <div
          className="donut"
          style={{
            background: `conic-gradient(${stops.join(", ")})`,
          }}
        >
          <div className="donut-hole">
            <strong>{segments.reduce((s, x) => s + x.value, 0)}</strong>
            <span>รายการ</span>
          </div>
        </div>
        <ul className="donut-legend">
          {segments.map((s) => (
            <li key={s.label}>
              <i style={{ background: s.color || "#64748b" }} />
              <span>
                {s.label}: <strong>{s.value}</strong>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
