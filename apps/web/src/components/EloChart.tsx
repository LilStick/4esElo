import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EloPoint } from "@4eselo/types";

export function EloChart({ points }: { points: EloPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-ink-dim">
        Pas encore assez de données pour tracer la courbe — elle se remplira au fil des parties.
      </div>
    );
  }

  const data = points.map((p) => ({
    elo: p.elo,
    date: new Date(p.capturedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="elo-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5E8BFF" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#5E8BFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="date" stroke="#565b6e" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#565b6e"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={["dataMin - 50", "dataMax + 50"]}
          />
          <Tooltip
            contentStyle={{
              background: "#11141b",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              color: "#f4f6fa",
              fontSize: 13,
            }}
            labelStyle={{ color: "#8b90a0" }}
            cursor={{ stroke: "rgba(255,255,255,0.14)" }}
          />
          <Area
            type="monotone"
            dataKey="elo"
            stroke="#5E8BFF"
            strokeWidth={2.5}
            fill="url(#elo-fill)"
            dot={false}
            activeDot={{ r: 4, fill: "#86A6FF", stroke: "#060709", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
