"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "antd";
import {
  AlertOutlined,
  AuditOutlined,
  ClusterOutlined,
  DashboardOutlined,
  HistoryOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAlertCounts } from "@/components/AlertProvider";
import { canViewAudit, canViewUsers } from "@/lib/rbac";
import type { Profile } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  badgeKey: null | "openAlarms" | "openMaintenance";
  visible: (profile: Profile) => boolean;
};

const nav: NavItem[] = [
  {
    href: "/dashboard",
    label: "แดชบอร์ด",
    hint: "ภาพรวม + กราฟ",
    icon: <DashboardOutlined />,
    badgeKey: null,
    visible: () => true,
  },
  {
    href: "/machines",
    label: "เครื่องจักร",
    hint: "ทะเบียนเครื่อง",
    icon: <ClusterOutlined />,
    badgeKey: null,
    visible: () => true,
  },
  {
    href: "/history",
    label: "ประวัติเครื่อง",
    hint: "Machine History",
    icon: <HistoryOutlined />,
    badgeKey: null,
    visible: () => true,
  },
  {
    href: "/alarms",
    label: "Alarm",
    hint: "เหตุผิดปกติ",
    icon: <AlertOutlined />,
    badgeKey: "openAlarms",
    visible: () => true,
  },
  {
    href: "/maintenance",
    label: "บำรุงรักษา",
    hint: "งานซ่อม/PM",
    icon: <ToolOutlined />,
    badgeKey: "openMaintenance",
    visible: () => true,
  },
  {
    href: "/users",
    label: "จัดการผู้ใช้",
    hint: "Role & โปรไฟล์",
    icon: <UserOutlined />,
    badgeKey: null,
    visible: (p) => canViewUsers(p),
  },
  {
    href: "/audit",
    label: "Audit Log",
    hint: "บันทึกการใช้งาน",
    icon: <AuditOutlined />,
    badgeKey: null,
    visible: (p) => canViewAudit(p),
  },
];

export function NavLinks({
  profile,
  onNavigate,
}: {
  profile: Profile;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const counts = useAlertCounts();

  return (
    <nav className="sidebar-nav">
      {nav
        .filter((item) => item.visible(profile))
        .map((item) => {
          const active =
            pathname === item.href ||
            (item.href === "/users" && pathname.startsWith("/technicians"));
          const count =
            item.badgeKey === "openAlarms"
              ? counts.openAlarms
              : item.badgeKey === "openMaintenance"
                ? counts.openMaintenance
                : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`sidebar-link ${active ? "is-active" : ""}`}
            >
              <Badge count={count} size="small" offset={[-2, 2]}>
                <span className="sidebar-link-icon">{item.icon}</span>
              </Badge>
              <span className="sidebar-link-text">
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </Link>
          );
        })}
    </nav>
  );
}
