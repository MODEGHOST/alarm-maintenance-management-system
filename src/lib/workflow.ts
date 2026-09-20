import { createClient } from "@/lib/supabase/client";
import type { AlarmStatus, MachineStatus } from "@/lib/types";

async function resolveMachineStatus(machineUuid: string) {
  const supabase = createClient();

  const { count: alarmCount } = await supabase
    .from("alarms")
    .select("id", { count: "exact", head: true })
    .eq("machine_uuid", machineUuid)
    .neq("status", "Closed");

  const { count: maintCount } = await supabase
    .from("maintenance_records")
    .select("id", { count: "exact", head: true })
    .eq("machine_uuid", machineUuid)
    .neq("status", "Closed");

  let next: MachineStatus = "Running";
  if ((alarmCount || 0) > 0) next = "Alarm";
  else if ((maintCount || 0) > 0) next = "Maintenance";

  await supabase
    .from("machines")
    .update({
      status: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", machineUuid);

  return next;
}

export async function syncMachineAfterAlarmChange(
  machineUuid: string,
  alarmStatus: AlarmStatus,
) {
  const supabase = createClient();

  if (alarmStatus === "Open" || alarmStatus === "In Progress") {
    await supabase
      .from("machines")
      .update({
        status: "Alarm" as MachineStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", machineUuid);
    return;
  }

  await resolveMachineStatus(machineUuid);
}

export async function syncMachineAfterMaintenanceChange(
  machineUuid: string,
  maintenanceStatus: string,
) {
  const supabase = createClient();

  if (maintenanceStatus === "Open" || maintenanceStatus === "In Progress") {
    await supabase
      .from("machines")
      .update({
        status: "Maintenance" as MachineStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", machineUuid);
    return;
  }

  await resolveMachineStatus(machineUuid);
}

export async function createMaintenanceFromAlarm(input: {
  alarmId: string;
  machineUuid: string;
  alarmCode: string;
  alarmDescription: string;
  technicianId: string | null;
}) {
  const supabase = createClient();

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

  await supabase
    .from("alarms")
    .update({
      status: "In Progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.alarmId);

  await supabase
    .from("machines")
    .update({
      status: "Maintenance",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.machineUuid);

  return maintenance;
}

export async function markAlarmResolved(input: {
  alarmId: string;
  machineUuid: string;
  closeOpenMaintenance?: boolean;
}) {
  const supabase = createClient();

  await supabase
    .from("alarms")
    .update({
      status: "Closed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.alarmId);

  if (input.closeOpenMaintenance) {
    await supabase
      .from("maintenance_records")
      .update({
        status: "Closed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("machine_uuid", input.machineUuid)
      .neq("status", "Closed");
  }

  return resolveMachineStatus(input.machineUuid);
}
