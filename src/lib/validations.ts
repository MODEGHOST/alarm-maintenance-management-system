export function requireText(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required`;
  return null;
}

export function validateMachineForm(input: {
  machine_id: string;
  machine_name: string;
  machine_type: string;
  location: string;
}): string | null {
  return (
    requireText(input.machine_id, "Machine ID") ||
    requireText(input.machine_name, "Machine Name") ||
    requireText(input.machine_type, "Machine Type") ||
    requireText(input.location, "Location")
  );
}

export function validateAlarmForm(input: {
  machine_uuid: string;
  alarm_code: string;
  alarm_description: string;
}): string | null {
  return (
    requireText(input.machine_uuid, "Machine") ||
    requireText(input.alarm_code, "Alarm Code") ||
    requireText(input.alarm_description, "Alarm Description")
  );
}

export function validateMaintenanceForm(input: {
  machine_uuid: string;
  title: string;
}): string | null {
  return (
    requireText(input.machine_uuid, "Machine") ||
    requireText(input.title, "Title")
  );
}
