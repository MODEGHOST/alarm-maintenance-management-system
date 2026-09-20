import type { Profile, UserRole } from "@/lib/types";

export function isAdmin(profile: Profile | null | undefined) {
  return profile?.role === "admin";
}

export function isTechnician(profile: Profile | null | undefined) {
  return profile?.role === "technician";
}

export function isViewer(profile: Profile | null | undefined) {
  return profile?.role === "viewer";
}

export function isStaff(profile: Profile | null | undefined) {
  return isAdmin(profile) || isTechnician(profile);
}

export function canManageMachines(profile: Profile | null | undefined) {
  return isAdmin(profile);
}

export function canManageAlarms(profile: Profile | null | undefined) {
  return isStaff(profile);
}

export function canManageMaintenance(profile: Profile | null | undefined) {
  return isStaff(profile);
}

export function canManageTechnicians(profile: Profile | null | undefined) {
  return isAdmin(profile);
}

export function canExportData(profile: Profile | null | undefined) {
  return Boolean(profile);
}

export function canViewAudit(profile: Profile | null | undefined) {
  return isAdmin(profile) || isTechnician(profile);
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
