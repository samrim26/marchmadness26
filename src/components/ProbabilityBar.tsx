interface Props {
  value: number; // 0-1
  color?: "blue" | "emerald" | "yellow" | "slate";
  showLabel?: boolean;
}

const COLOR_MAP = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  yellow: "bg-yellow-500",
  slate: "bg-slate-600",
};

export function ProbabilityBar({
  value,
  color = "blue",
  showLabel = true,
}: Props) {
  const pct = Math.round(value * 1000) / 10; // one decimal
  const barWidth = Math.max(0, Math.min(100, value * 100));

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 flex-none rounded-full bg-slate-800">
        <div
          className={`h-1.5 rounded-full ${COLOR_MAP[color]} transition-all`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm tabular-nums text-slate-300">
          {pct.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
