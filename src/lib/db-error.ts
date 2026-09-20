/** แปลงข้อความ error จาก Supabase ให้เข้าใจง่าย + ชี้ให้รัน migration */
export function formatDbError(
  err: unknown,
  fallback = "เกิดข้อผิดพลาดจากฐานข้อมูล",
): string {
  const raw =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: string }).message)
      : err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : fallback;

  const lower = raw.toLowerCase();

  if (
    lower.includes("audit_logs") ||
    (lower.includes("relation") && lower.includes("does not exist")) ||
    lower.includes("could not find the table")
  ) {
    return `${raw} — รันไฟล์ supabase/bonus_migration.sql ใน Supabase SQL Editor`;
  }

  if (
    lower.includes("phone") ||
    lower.includes("employee_code") ||
    lower.includes("specialty") ||
    lower.includes("shift") ||
    lower.includes("column")
  ) {
    return `${raw} — อาจยังไม่ได้รัน supabase/bonus_migration.sql (เพิ่มคอลัมน์ช่าง / Waiting Part / audit_logs)`;
  }

  if (
    lower.includes("waiting part") ||
    lower.includes("violates check constraint")
  ) {
    return `${raw} — รัน supabase/bonus_migration.sql เพื่อเปิดสถานะ Waiting Part และ Role Viewer`;
  }

  return raw || fallback;
}

export function isMissingRelationError(err: unknown) {
  const msg = formatDbError(err, "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("audit_logs")
  );
}
