export type UserRole = "admin" | "technician";

export type MachineStatus = "Running" | "Stop" | "Alarm" | "Maintenance";
export type AlarmStatus = "Open" | "In Progress" | "Closed";
export type MaintenanceStatus = "Open" | "In Progress" | "Closed";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
};

export type Machine = {
  id: string;
  machine_id: string;
  machine_name: string;
  machine_type: string;
  location: string;
  status: MachineStatus;
  created_at: string;
  updated_at: string;
};

export type Alarm = {
  id: string;
  machine_uuid: string;
  alarm_code: string;
  alarm_description: string;
  occurred_at: string;
  cause: string | null;
  status: AlarmStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  machines?: Pick<Machine, "machine_id" | "machine_name"> | null;
};

export type MaintenanceRecord = {
  id: string;
  machine_uuid: string;
  title: string;
  description: string | null;
  technician_id: string | null;
  status: MaintenanceStatus;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  machines?: Pick<Machine, "machine_id" | "machine_name"> | null;
  profiles?: Pick<Profile, "full_name" | "email"> | null;
};

export const MACHINE_STATUSES: MachineStatus[] = [
  "Running",
  "Stop",
  "Alarm",
  "Maintenance",
];

export const ALARM_STATUSES: AlarmStatus[] = ["Open", "In Progress", "Closed"];

export const MAINTENANCE_STATUSES: MaintenanceStatus[] = [
  "Open",
  "In Progress",
  "Closed",
];
