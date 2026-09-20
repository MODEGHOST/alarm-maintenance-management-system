import { createClient } from "@/lib/supabase/client";
import type { MachineStatus, MaintenanceStatus } from "@/lib/types";
import { OPEN_MAINTENANCE_STATUSES } from "@/lib/types";

/** ลำดับสถานะงานซ่อมที่อนุญาต */
export const MAINTENANCE_NEXT: Record<MaintenanceStatus, MaintenanceStatus[]> =
  {
    Open: ["Open", "In Progress", "Closed"],
    "In Progress": ["In Progress", "Waiting Part", "Closed"],
    "Waiting Part": ["Waiting Part", "In Progress", "Closed"],
    Closed: ["Closed", "Open"],
  };

export function canTransitionMaintenance(
  from: MaintenanceStatus,
  to: MaintenanceStatus,
) {
  return MAINTENANCE_NEXT[from]?.includes(to) ?? false;
}

async function countOpenMaintenance(machineUuid: string) {
  const supabase = createClient();
  let res = await supabase
    .from("maintenance_records")
    .select("id", { count: "exact", head: true })
    .eq("machine_uuid", machineUuid)
    .in("status", OPEN_MAINTENANCE_STATUSES);

  if (res.error) {
    res = await supabase
      .from("maintenance_records")
      .select("id", { count: "exact", head: true })
      .eq("machine_uuid", machineUuid)
      .neq("status", "Closed");
  }

  return res.count || 0;
}

async function countOpenAlarms(machineUuid: string) {
  const supabase = createClient();
  const { count } = await supabase
    .from("alarms")
    .select("id", { count: "exact", head: true })
    .eq("machine_uuid", machineUuid)
    .neq("status", "Closed");
  return count || 0;
}

/**
 * คำนวณสถานะเครื่องตามงานค้างจริง
 * มีงานซ่อมเปิด → Maintenance
 * ไม่มีงานซ่อม แต่มี Alarm เปิด → Alarm
 * ไม่มีทั้งคู่ → Running
 */
export async function resolveMachineStatus(machineUuid: string) {
  const supabase = createClient();
  const maintCount = await countOpenMaintenance(machineUuid);
  const alarmCount = await countOpenAlarms(machineUuid);

  let next: MachineStatus = "Running";
  if (maintCount > 0) next = "Maintenance";
  else if (alarmCount > 0) next = "Alarm";

  await supabase
    .from("machines")
    .update({
      status: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", machineUuid);

  return next;
}

export async function syncMachineAfterAlarmChange(machineUuid: string) {
  return resolveMachineStatus(machineUuid);
}

export async function syncMachineAfterMaintenanceChange(machineUuid: string) {
  return resolveMachineStatus(machineUuid);
}

/** ขั้น 2: เปิดงานซ่อมจาก Alarm ที่ยัง Open เท่านั้น */
export async function createMaintenanceFromAlarm(input: {
  alarmId: string;
  machineUuid: string;
  alarmCode: string;
  alarmDescription: string;
  technicianId: string | null;
}) {
  const supabase = createClient();

  const { data: alarm, error: alarmErr } = await supabase
    .from("alarms")
    .select("id, status")
    .eq("id", input.alarmId)
    .single();

  if (alarmErr) throw alarmErr;
  if (!alarm) throw new Error("ไม่พบ Alarm");
  if (alarm.status !== "Open") {
    throw new Error(
      "เปิดงานซ่อมได้เฉพาะ Alarm สถานะ「เปิด」เท่านั้น — รายการนี้อยู่ระหว่างซ่อมหรือปิดแล้ว",
    );
  }

  const openMaint = await countOpenMaintenance(input.machineUuid);
  if (openMaint > 0) {
    throw new Error(
      "เครื่องนี้มีงานซ่อมค้างอยู่แล้ว — ไปที่เมนูบำรุงรักษาเพื่อดำเนินการต่อ",
    );
  }

  const { data: maintenance, error: maintError } = await supabase
    .from("maintenance_records")
    .insert({
      machine_uuid: input.machineUuid,
      title: `ซ่อมจาก Alarm ${input.alarmCode}`,
      description: `งานซ่อมจาก Alarm: ${input.alarmDescription}`,
      status: "Open",
      technician_id: input.technicianId,
      scheduled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (maintError) throw maintError;

  const { error: updateAlarmError } = await supabase
    .from("alarms")
    .update({
      status: "In Progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.alarmId)
    .eq("status", "Open");

  if (updateAlarmError) throw updateAlarmError;

  await resolveMachineStatus(input.machineUuid);
  return maintenance;
}

/**
 * ปิด Alarm
 * - Open → ปิดโดยไม่ซ่อม (แจ้งผิด / แก้ได้เอง)
 * - In Progress → ต้องปิดงานซ่อมค้างด้วย (ซ่อมเสร็จ)
 */
export async function markAlarmResolved(input: {
  alarmId: string;
  machineUuid: string;
  closeOpenMaintenance?: boolean;
}) {
  const supabase = createClient();

  const { data: alarm, error: alarmErr } = await supabase
    .from("alarms")
    .select("id, status")
    .eq("id", input.alarmId)
    .single();

  if (alarmErr) throw alarmErr;
  if (!alarm) throw new Error("ไม่พบ Alarm");
  if (alarm.status === "Closed") {
    throw new Error("Alarm นี้ปิดอยู่แล้ว");
  }

  if (alarm.status === "In Progress") {
    const openMaint = await countOpenMaintenance(input.machineUuid);
    if (openMaint > 0 && !input.closeOpenMaintenance) {
      throw new Error(
        "Alarm นี้อยู่ระหว่างซ่อม — กรุณาปิดงานที่เมนูบำรุงรักษาให้เสร็จก่อน หรือยืนยันปิดพร้อมงานซ่อม",
      );
    }
  }

  if (input.closeOpenMaintenance) {
    let closeRes = await supabase
      .from("maintenance_records")
      .update({
        status: "Closed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("machine_uuid", input.machineUuid)
      .in("status", OPEN_MAINTENANCE_STATUSES);

    if (closeRes.error) {
      closeRes = await supabase
        .from("maintenance_records")
        .update({
          status: "Closed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("machine_uuid", input.machineUuid)
        .neq("status", "Closed");
    }
  }

  await supabase
    .from("alarms")
    .update({
      status: "Closed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.alarmId);

  return resolveMachineStatus(input.machineUuid);
}

/** ขั้น 3→4: ซ่อมเสร็จ → ปิดงานซ่อม + ปิด Alarm ที่กำลังดำเนินการของเครื่องนี้ */
export async function completeMaintenanceJob(input: {
  maintenanceId: string;
  machineUuid: string;
}) {
  const supabase = createClient();

  const { data: job, error: jobErr } = await supabase
    .from("maintenance_records")
    .select("id, status")
    .eq("id", input.maintenanceId)
    .single();

  if (jobErr) throw jobErr;
  if (!job) throw new Error("ไม่พบงานซ่อม");
  if (job.status === "Closed") {
    throw new Error("งานนี้ปิดอยู่แล้ว");
  }

  const { error: closeJobError } = await supabase
    .from("maintenance_records")
    .update({
      status: "Closed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.maintenanceId);

  if (closeJobError) throw closeJobError;

  // ปิดเฉพาะ Alarm ที่「กำลังดำเนินการ」(ผูกกับงานซ่อม) — คง Alarm 「เปิด」อื่นไว้
  await supabase
    .from("alarms")
    .update({
      status: "Closed",
      updated_at: new Date().toISOString(),
    })
    .eq("machine_uuid", input.machineUuid)
    .eq("status", "In Progress");

  return resolveMachineStatus(input.machineUuid);
}

/** เริ่มลงมือซ่อม: Open → In Progress */
export async function startMaintenanceWork(maintenanceId: string) {
  const supabase = createClient();
  const { data: job, error } = await supabase
    .from("maintenance_records")
    .select("id, status, machine_uuid")
    .eq("id", maintenanceId)
    .single();

  if (error) throw error;
  if (!job) throw new Error("ไม่พบงานซ่อม");
  if (job.status !== "Open" && job.status !== "Waiting Part") {
    throw new Error("เริ่มงานได้เฉพาะสถานะ「เปิด」หรือ「รออะไหล่」");
  }

  const { error: updateError } = await supabase
    .from("maintenance_records")
    .update({
      status: "In Progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", maintenanceId);

  if (updateError) throw updateError;
  await resolveMachineStatus(job.machine_uuid);
}

/** ตั้งรออะไหล่ */
export async function markWaitingPart(maintenanceId: string) {
  const supabase = createClient();
  const { data: job, error } = await supabase
    .from("maintenance_records")
    .select("id, status, machine_uuid")
    .eq("id", maintenanceId)
    .single();

  if (error) throw error;
  if (!job) throw new Error("ไม่พบงานซ่อม");
  if (job.status === "Closed" || job.status === "Open") {
    throw new Error("ตั้งรออะไหล่ได้เมื่องานกำลังดำเนินการอยู่");
  }

  const { error: updateError } = await supabase
    .from("maintenance_records")
    .update({
      status: "Waiting Part",
      updated_at: new Date().toISOString(),
    })
    .eq("id", maintenanceId);

  if (updateError) throw updateError;
  await resolveMachineStatus(job.machine_uuid);
}

/** Admin: คำนวณสถานะเครื่องทุกเครื่องใหม่จาก Alarm/งานซ่อมค้าง */
export async function syncAllMachineStatuses() {
  const supabase = createClient();
  const { data, error } = await supabase.from("machines").select("id");
  if (error) throw error;

  const ids = (data || []).map((m) => m.id as string);
  const results: MachineStatus[] = [];
  for (const id of ids) {
    results.push(await resolveMachineStatus(id));
  }
  return { count: ids.length, results };
}
