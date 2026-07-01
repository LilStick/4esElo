import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EloPoint } from "@4eselo/types";

export function EloChart({ points }: { points: EloPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 text-sm text-zinc-500">
        Pas encore assez de données pour tracer la courbe — elle se remplira au fil des parties.
      </div>
    );
  }

  const data = points.map((p) => ({
    elo: p.elo,
    date: new Date(p.capturedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
  }));

  return (
    <div className="h-64 w-full rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} />
          <YAxis stroke="#71717a" fontSize={12} tickLine={false} domain={["dataMin - 50", "dataMax + 50"]} />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 8,
              color: "#fafafa",
            }}
            labelStyle={{ color: "#a1a1aa" }}
          />
          <Line type="monotone" dataKey="elo" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
