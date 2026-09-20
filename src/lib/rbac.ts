import type { Profile, UserRole } from "@/lib/types";

export function isAdmin(profile: Profile | null | undefined) {
  return profile?.role === "admin";
}

export function isTechnician(profile: Profile | null | undefined) {
  return profile?.role === "technician";
}

export function canManageMachines(profile: Profile | null | undefined) {
  return isAdmin(profile);
}

export function canManageAlarms(_profile: Profile | null | undefined) {
  // Admin และ Technician จัดการ Alarm ได้ตามโจทย์
  return Boolean(_profile);
}

export function canManageMaintenance(_profile: Profile | null | undefined) {
  // Admin และ Technician จัดการงานบำรุงรักษาได้ตามโจทย์
  return Boolean(_profile);
}

export function assertRole(
  profile: Profile | null | undefined,
  allowed: UserRole[],
): string | null {
  if (!profile) return "กรุณาเข้าสู่ระบบก่อน";
  if (!allowed.includes(profile.role)) {
    return "คุณไม่มีสิทธิ์ทำรายการนี้ตาม Role ที่กำหนด";
  }
  return null;
}
