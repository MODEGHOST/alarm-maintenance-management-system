"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { notification } from "antd";
import { createClient } from "@/lib/supabase/client";
import { OPEN_MAINTENANCE_STATUSES } from "@/lib/types";

type AlertCounts = {
  openAlarms: number;
  openMaintenance: number;
  alarmMachines: number;
};

type AlertContextValue = AlertCounts & {
  refresh: () => Promise<void>;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<AlertCounts>({
    openAlarms: 0,
    openMaintenance: 0,
    alarmMachines: 0,
  });
  const [notified, setNotified] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [alarmsRes, maintRes, machinesRes] = await Promise.all([
      supabase
        .from("alarms")
        .select("id", { count: "exact", head: true })
        .neq("status", "Closed"),
      supabase
        .from("maintenance_records")
        .select("id", { count: "exact", head: true })
        .in("status", OPEN_MAINTENANCE_STATUSES),
      supabase
        .from("machines")
        .select("id", { count: "exact", head: true })
        .eq("status", "Alarm"),
    ]);

    setCounts({
      openAlarms: alarmsRes.count || 0,
      openMaintenance: maintRes.count || 0,
      alarmMachines: machinesRes.count || 0,
    });
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
    const timer = setInterval(() => {
      refresh().catch(() => undefined);
    }, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (notified) return;
    if (counts.openAlarms <= 0 && counts.alarmMachines <= 0) return;

    notification.warning({
      key: "open-alarm-alert",
      message: "มี Alarm ที่ต้องดูแล",
      description: `มี Alarm เปิดอยู่ ${counts.openAlarms} รายการ และเครื่องสถานะ Alarm ${counts.alarmMachines} เครื่อง`,
      placement: "topRight",
      duration: 6,
    });
    setNotified(true);
  }, [counts, notified]);

  const value = useMemo(
    () => ({
      ...counts,
      refresh,
    }),
    [counts, refresh],
  );

  return (
    <AlertContext.Provider value={value}>{children}</AlertContext.Provider>
  );
}

export function useAlertCounts() {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    return {
      openAlarms: 0,
      openMaintenance: 0,
      alarmMachines: 0,
      refresh: async () => undefined,
    };
  }
  return ctx;
}
