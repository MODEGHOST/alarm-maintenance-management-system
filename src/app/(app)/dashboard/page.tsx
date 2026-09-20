"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MachineStatus } from "@/lib/types";
import { MACHINE_STATUSES } from "@/lib/types";

type Stats = {
  totalMachines: number;
  byStatus: Record<MachineStatus, number>;
  alarmCount: number;
  maintenanceCount: number;
  openAlarms: number;
  openMaintenance: number;
};

const emptyStats: Stats = {
  totalMachines: 0,
  byStatus: { Running: 0, Stop: 0, Alarm: 0, Maintenance: 0 },
  alarmCount: 0,
  maintenanceCount: 0,
  openAlarms: 0,
  openMaintenance: 0,
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const [machinesRes, alarmsRes, maintenanceRes] = await Promise.all([
          supabase.from("machines").select("status"),
          supabase.from("alarms").select("status"),
          supabase.from("maintenance_records").select("status"),
        ]);

        if (machinesRes.error) throw machinesRes.error;
        if (alarmsRes.error) throw alarmsRes.error;
        if (maintenanceRes.error) throw maintenanceRes.error;

        const byStatus = { ...emptyStats.byStatus };
        for (const row of machinesRes.data || []) {
          const status = row.status as MachineStatus;
          if (status in byStatus) byStatus[status] += 1;
        }

        const alarms = alarmsRes.data || [];
        const maintenance = maintenanceRes.data || [];

        setStats({
          totalMachines: machinesRes.data?.length || 0,
          byStatus,
          alarmCount: alarms.length,
          maintenanceCount: maintenance.length,
          openAlarms: alarms.filter((a) => a.status !== "Closed").length,
          openMaintenance: maintenance.filter((m) => m.status !== "Closed")
            .length,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const cards = [
    { label: "Total Machines", value: stats.totalMachines },
    ...MACHINE_STATUSES.map((status) => ({
      label: status,
      value: stats.byStatus[status],
    })),
    { label: "Total Alarms", value: stats.alarmCount },
    { label: "Open Alarms", value: stats.openAlarms },
    { label: "Total Maintenance", value: stats.maintenanceCount },
    { label: "Open Maintenance", value: stats.openMaintenance },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-slate-600">
          Summary of machines, alarms, and maintenance work
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading dashboard...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
