"use client";

import * as React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dimension, SimulationResult } from "@/lib/schemas";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FORK_COLORS = ["#7c3aed", "#06b6d4", "#f59e0b"];

const DIMENSION_TITLES: Record<Dimension, string> = {
  financial: "Financial",
  career: "Career",
  psychological: "Psychological",
  events: "Events",
};

export interface MetricChartProps {
  result: SimulationResult;
}

export function MetricChart({ result }: MetricChartProps) {
  const dimensions = result.plan.dimensions;
  const [activeDim, setActiveDim] = React.useState<Dimension>(
    dimensions[0],
  );

  const maxSteps = Math.max(
    0,
    ...result.timelines.map((t) => t.steps.length),
  );

  const data = React.useMemo(() => {
    const rows: Array<Record<string, number | string>> = [];
    for (let i = 0; i < maxSteps; i++) {
      const row: Record<string, number | string> = { step: i + 1 };
      result.timelines.forEach((tl, idx) => {
        const step = tl.steps.find((s) => s.stepIndex === i) ?? tl.steps[i];
        const v = step?.metrics?.[activeDim];
        if (typeof v === "number") {
          row[`fork${idx}`] = v;
        }
      });
      const label =
        result.timelines[0]?.steps.find((s) => s.stepIndex === i)?.label ??
        result.timelines[0]?.steps[i]?.label;
      if (label) row.label = label;
      rows.push(row);
    }
    return rows;
  }, [result, activeDim, maxSteps]);

  if (dimensions.length === 0 || maxSteps === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle>Metric trajectories</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {dimensions.map((d) => (
              <Button
                key={d}
                type="button"
                size="sm"
                variant={d === activeDim ? "default" : "secondary"}
                onClick={() => setActiveDim(d)}
                className={cn(
                  "capitalize",
                  d === activeDim ? "" : "opacity-80",
                )}
              >
                {DIMENSION_TITLES[d]}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 16, left: -16, bottom: 8 }}
            >
              <CartesianGrid
                stroke="#26262e"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="step"
                stroke="#a1a1aa"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#a1a1aa"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#13131a",
                  border: "1px solid #26262e",
                  borderRadius: 12,
                  color: "#ededed",
                  fontSize: 12,
                }}
                labelFormatter={(v) => `Step ${v}`}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }}
                iconType="line"
              />
              {result.timelines.map((tl, idx) => (
                <Line
                  key={tl.forkId}
                  type="monotone"
                  dataKey={`fork${idx}`}
                  name={tl.forkLabel}
                  stroke={FORK_COLORS[idx % FORK_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{
                    r: 3,
                    fill: FORK_COLORS[idx % FORK_COLORS.length],
                  }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default MetricChart;
