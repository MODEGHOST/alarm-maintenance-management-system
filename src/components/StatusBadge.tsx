const machineColors: Record<string, string> = {
  Running: "bg-emerald-100 text-emerald-800",
  Stop: "bg-slate-200 text-slate-700",
  Alarm: "bg-red-100 text-red-800",
  Maintenance: "bg-amber-100 text-amber-800",
};

const workColors: Record<string, string> = {
  Open: "bg-red-100 text-red-800",
  "In Progress": "bg-amber-100 text-amber-800",
  Closed: "bg-emerald-100 text-emerald-800",
};

export function StatusBadge({
  status,
  kind = "work",
}: {
  status: string;
  kind?: "machine" | "work";
}) {
  const map = kind === "machine" ? machineColors : workColors;
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] || "bg-slate-100 text-slate-700"}`}
    >
      {status}
    </span>
  );
}
