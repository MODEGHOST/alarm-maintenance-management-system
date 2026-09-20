"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "antd";
import {
  AlertOutlined,
  DashboardOutlined,
  ToolOutlined,
  ClusterOutlined,
} from "@ant-design/icons";
import { useAlertCounts } from "@/components/AlertProvider";

const nav = [
  {
    href: "/dashboard",
    label: "แดชบอร์ด",
    hint: "ภาพรวมสถานะ",
    icon: <DashboardOutlined />,
    badgeKey: null as null | "openAlarms" | "openMaintenance",
  },
  {
    href: "/machines",
    label: "เครื่องจักร",
    hint: "ทะเบียนเครื่อง",
    icon: <ClusterOutlined />,
    badgeKey: null as null | "openAlarms" | "openMaintenance",
  },
  {
    href: "/alarms",
    label: "Alarm",
    hint: "เหตุผิดปกติ",
    icon: <AlertOutlined />,
    badgeKey: "openAlarms" as const,
  },
  {
    href: "/maintenance",
    label: "บำรุงรักษา",
    hint: "งานซ่อม/PM",
    icon: <ToolOutlined />,
    badgeKey: "openMaintenance" as const,
  },
];

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const counts = useAlertCounts();

  return (
    <nav className="sidebar-nav">
      {nav.map((item) => {
        const active = pathname === item.href;
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
