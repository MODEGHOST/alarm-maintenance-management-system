"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Tag } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { logout } from "@/app/actions/auth";
import { AlertProvider, useAlertCounts } from "@/components/AlertProvider";
import { NavLinks } from "@/components/NavLinks";
import { ThemeToggle } from "@/components/ThemeToggle";
import { roleLabel } from "@/lib/labels";
import type { Profile } from "@/lib/types";

function AppShellInner({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { openAlarms, alarmMachines } = useAlertCounts();

  return (
    <div className={`app-layout ${open ? "sidebar-open" : ""}`}>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="app-mark" aria-hidden>
            AM
          </div>
          <div>
            <p className="app-kicker">Automation Floor</p>
            <strong className="sidebar-title">Alarm & บำรุงรักษา</strong>
          </div>
        </div>

        <p className="sidebar-section">เมนูหลัก</p>
        <NavLinks onNavigate={() => setOpen(false)} />

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <strong>{profile.full_name || profile.email}</strong>
            <span>{roleLabel(profile.role)}</span>
          </div>
          <form action={logout}>
            <Button htmlType="submit" block>
              ออกจากระบบ
            </Button>
          </form>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="ปิดเมนู"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="app-content">
        <header className="app-topbar">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-label="เปิด/ปิดเมนู"
          >
            {open ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
          </button>
          <div>
            <h1 className="app-product">ระบบจัดการ Alarm & บำรุงรักษา</h1>
            <p className="app-purpose">
              ติดตามสถานะเครื่องจักร บันทึก Alarm และวางแผนงานซ่อมบำรุง
            </p>
          </div>
          <div className="app-user app-user-desktop">
            <ThemeToggle />
            <div className="app-user-meta">
              <strong>{profile.full_name || profile.email}</strong>
              <span>
                <Tag style={{ marginInlineEnd: 0 }}>{roleLabel(profile.role)}</Tag>
              </span>
            </div>
          </div>
          <div className="app-user-mobile-actions">
            <ThemeToggle />
          </div>
        </header>

        {openAlarms > 0 && (
          <div className="app-alert-strip">
            <Alert
              type="warning"
              showIcon
              banner
              message={`แจ้งเตือน: มี Alarm เปิดอยู่ ${openAlarms} รายการ (เครื่องสถานะ Alarm ${alarmMachines} เครื่อง)`}
              action={
                <Link href="/alarms">
                  <Button size="small" type="primary" danger>
                    ดู Alarm
                  </Button>
                </Link>
              }
            />
          </div>
        )}

        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <AlertProvider>
      <AppShellInner profile={profile}>{children}</AppShellInner>
    </AlertProvider>
  );
}

export function ProfileMissingPanel({ email }: { email?: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-lg rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">ไม่พบโปรไฟล์ผู้ใช้</h1>
        <p className="mt-2 text-sm text-slate-600">
          เข้าสู่ระบบด้วย {email || "ไม่ทราบอีเมล"} แต่ยังไม่มีข้อมูลในตาราง{" "}
          <code>profiles</code> กรุณารัน <code>supabase/schema.sql</code>{" "}
          แล้วตั้งค่า role เป็น <code>admin</code>, <code>technician</code> หรือ{" "}
          <code>viewer</code>
        </p>
        <form action={logout} className="mt-4">
          <Button type="primary" htmlType="submit">
            ออกจากระบบ
          </Button>
        </form>
        <p className="mt-3 text-sm">
          <Link href="/login" className="underline">
            กลับหน้าเข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}
