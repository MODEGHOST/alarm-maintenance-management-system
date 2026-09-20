import type { MachineStatus, AlarmStatus, MaintenanceStatus, UserRole } from "@/lib/types";

export const MACHINE_STATUS_LABELS: Record<MachineStatus, string> = {
  Running: "กำลังทำงาน",
  Stop: "หยุด",
  Alarm: "มี Alarm",
  Maintenance: "ซ่อมบำรุง",
};

export const WORK_STATUS_LABELS: Record<
  AlarmStatus | MaintenanceStatus,
  string
> = {
  Open: "เปิด",
  "In Progress": "กำลังดำเนินการ",
  Closed: "ปิดแล้ว",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "ผู้ดูแลระบบ",
  technician: "ช่างเทคนิค",
};

export function machineStatusLabel(status: string) {
  return MACHINE_STATUS_LABELS[status as MachineStatus] || status;
}

export function workStatusLabel(status: string) {
  return WORK_STATUS_LABELS[status as AlarmStatus] || status;
}

export function roleLabel(role: string) {
  return ROLE_LABELS[role as UserRole] || role;
}
