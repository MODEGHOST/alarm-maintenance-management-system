export function requireText(value: string, label: string): string | null {
  if (!value.trim()) return `กรุณากรอก${label}`;
  return null;
}

function hasOnlySpaces(value: string) {
  return value.length > 0 && value.trim().length === 0;
}

function containsDangerousInput(value: string) {
  return /<script|<\/script|javascript:|onerror\s*=|onload\s*=/i.test(value);
}

function validateLength(
  value: string,
  label: string,
  min: number,
  max: number,
): string | null {
  const text = value.trim();
  if (text.length < min) return `${label} ต้องมีอย่างน้อย ${min} ตัวอักษ`;
  if (text.length > max) return `${label} ต้องไม่เกิน ${max} ตัวอักษ`;
  return null;
}

export function validateMachineForm(input: {
  machine_id: string;
  machine_name: string;
  machine_type: string;
  location: string;
}): string | null {
  if (hasOnlySpaces(input.machine_id)) return "รหัสเครื่องห้ามเป็นช่องว่างอย่างเดียว";

  return (
    requireText(input.machine_id, "รหัสเครื่อง") ||
    requireText(input.machine_name, "ชื่อเครื่อง") ||
    requireText(input.machine_type, "ประเภทเครื่อง") ||
    requireText(input.location, "ตำแหน่งติดตั้ง") ||
    validateLength(input.machine_id, "รหัสเครื่อง", 3, 20) ||
    validateLength(input.machine_name, "ชื่อเครื่อง", 2, 80) ||
    validateLength(input.machine_type, "ประเภทเครื่อง", 2, 40) ||
    validateLength(input.location, "ตำแหน่งติดตั้ง", 2, 80) ||
    (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(input.machine_id.trim())
      ? "รหัสเครื่องใช้ได้เฉพาะตัวอักษร ตัวเลข และ - _ เท่านั้น"
      : null) ||
    (containsDangerousInput(input.machine_name) ||
    containsDangerousInput(input.machine_type) ||
    containsDangerousInput(input.location)
      ? "พบค่าที่ไม่เหมาะสมในข้อมูลเครื่องจักร"
      : null)
  );
}

export function validateAlarmForm(input: {
  machine_uuid: string;
  alarm_code: string;
  alarm_description: string;
  cause?: string;
}): string | null {
  return (
    requireText(input.machine_uuid, "เครื่องจักร") ||
    requireText(input.alarm_code, "รหัส Alarm") ||
    requireText(input.alarm_description, "รายละเอียด Alarm") ||
    validateLength(input.alarm_code, "รหัส Alarm", 2, 20) ||
    validateLength(input.alarm_description, "รายละเอียด Alarm", 5, 200) ||
    (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(input.alarm_code.trim())
      ? "รหัส Alarm ใช้ได้เฉพาะตัวอักษร ตัวเลข และ - _ เท่านั้น"
      : null) ||
    (input.cause && input.cause.trim()
      ? validateLength(input.cause, "สาเหตุ", 2, 200) ||
        (containsDangerousInput(input.cause)
          ? "พบค่าที่ไม่เหมาะสมในช่องสาเหตุ"
          : null)
      : null) ||
    (containsDangerousInput(input.alarm_description)
      ? "พบค่าที่ไม่เหมาะสมในรายละเอียด Alarm"
      : null)
  );
}

export function validateMaintenanceForm(input: {
  machine_uuid: string;
  title: string;
  description?: string;
}): string | null {
  return (
    requireText(input.machine_uuid, "เครื่องจักร") ||
    requireText(input.title, "หัวข้องาน") ||
    validateLength(input.title, "หัวข้องาน", 3, 100) ||
    (input.description && input.description.trim()
      ? validateLength(input.description, "รายละเอียด", 2, 300) ||
        (containsDangerousInput(input.description)
          ? "พบค่าที่ไม่เหมาะสมในรายละเอียด"
          : null)
      : null) ||
    (containsDangerousInput(input.title)
      ? "พบค่าที่ไม่เหมาะสมในหัวข้องาน"
      : null)
  );
}
