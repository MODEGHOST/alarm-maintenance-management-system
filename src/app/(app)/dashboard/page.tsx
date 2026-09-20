"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Spin, Table, Tag } from "antd";
import {
  AlertOutlined,
  CheckCircleOutlined,
  ClusterOutlined,
  PauseCircleOutlined,
  ToolOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { BarChart, DonutStat } from "@/components/Charts";
import { createClient } from "@/lib/supabase/client";
import { MACHINE_STATUS_LABELS, WORK_STATUS_LABELS } from "@/lib/labels";
import type { Alarm, Machine, MachineStatus, MaintenanceRecord } from "@/lib/types";
import { OPEN_MAINTENANCE_STATUSES } from "@/lib/types";

type Stats = {
  totalMachines: number;
  byStatus: Record<MachineStatus, number>;
  openAlarms: number;
  openMaintenance: number;
};

const emptyStats: Stats = {
  totalMachines: 0,
  byStatus: { Running: 0, Stop: 0, Alarm: 0, Maintenance: 0 },
  openAlarms: 0,
  openMaintenance: 0,
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [alarmMachines, setAlarmMachines] = useState<Machine[]>([]);
  const [maintMachines, setMaintMachines] = useState<Machine[]>([]);
  const [openAlarmRows, setOpenAlarmRows] = useState<Alarm[]>([]);
  const [openMaintRows, setOpenMaintRows] = useState<MaintenanceRecord[]>([]);
  const [allAlarms, setAllAlarms] = useState<Alarm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const [machinesRes, openAlarmsRes, maintenanceRes, allAlarmsRes] =
          await Promise.all([
            supabase.from("machines").select("*").order("machine_id"),
            supabase
              .from("alarms")
              .select("*, machines(machine_id, machine_name)")
              .neq("status", "Closed")
              .order("occurred_at", { ascending: false }),
            supabase
              .from("maintenance_records")
              .select(
                "*, machines(machine_id, machine_name), profiles!technician_id(full_name, email)",
              )
              .in("status", OPEN_MAINTENANCE_STATUSES)
              .order("created_at", { ascending: false }),
            supabase
              .from("alarms")
              .select("*, machines(machine_id, machine_name)")
              .order("occurred_at", { ascending: false })
              .limit(500),
          ]);

        if (machinesRes.error) throw machinesRes.error;
        if (openAlarmsRes.error) throw openAlarmsRes.error;
        if (maintenanceRes.error) throw maintenanceRes.error;
        if (allAlarmsRes.error) throw allAlarmsRes.error;

        const machines = (machinesRes.data || []) as Machine[];
        const byStatus = { ...emptyStats.byStatus };
        for (const row of machines) {
          if (row.status in byStatus) byStatus[row.status] += 1;
        }

        const openAlarms = (openAlarmsRes.data || []) as Alarm[];
        const openMaint = (maintenanceRes.data || []) as MaintenanceRecord[];
        const alarms = (allAlarmsRes.data || []) as Alarm[];

        setStats({
          totalMachines: machines.length,
          byStatus,
          openAlarms: openAlarms.length,
          openMaintenance: openMaint.length,
        });
        setAlarmMachines(machines.filter((m) => m.status === "Alarm"));
        setMaintMachines(machines.filter((m) => m.status === "Maintenance"));
        setOpenAlarmRows(openAlarms);
        setOpenMaintRows(openMaint);
        setAllAlarms(alarms);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "โหลดแดชบอร์ดไม่สำเร็จ",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const alarmByDay = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "short",
      });
      map.set(key, 0);
    }
    for (const alarm of allAlarms) {
      const d = new Date(alarm.occurred_at);
      const key = d.toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "short",
      });
      if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].map(([label, value]) => ({
      label,
      value,
      color: "#0284c7",
    }));
  }, [allAlarms]);

  const alarmByStatus = useMemo(() => {
    const counts = { Open: 0, "In Progress": 0, Closed: 0 };
    for (const a of allAlarms) {
      if (a.status in counts) counts[a.status] += 1;
    }
    return [
      { label: "เปิด", value: counts.Open, color: "#dc2626" },
      { label: "กำลังทำ", value: counts["In Progress"], color: "#ea580c" },
      { label: "ปิดแล้ว", value: counts.Closed, color: "#059669" },
    ];
  }, [allAlarms]);

  const alarmByMachine = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of allAlarms) {
      const label = a.machines?.machine_id || "ไม่ระบุ";
      map.set(label, (map.get(label) || 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value, color: "#0c4a6e" }));
  }, [allAlarms]);

  const runningPct =
    stats.totalMachines === 0
      ? 0
      : Math.round((stats.byStatus.Running / stats.totalMachines) * 100);

  const healthTone =
    stats.openAlarms > 0 || stats.byStatus.Alarm > 0
      ? "danger"
      : stats.byStatus.Maintenance > 0 || stats.openMaintenance > 0
        ? "warn"
        : "ok";

  const healthText =
    healthTone === "danger"
      ? "มีเครื่องติด Alarm ต้องดูด่วน"
      : healthTone === "warn"
        ? "มีเครื่องอยู่ระหว่างบำรุงรักษา"
        : "สายการผลิตโดยรวมปกติ";

  return (
    <div className="dash">
      <section className={`dash-hero tone-${healthTone}`}>
        <div>
          <p className="dash-kicker">ศูนย์ควบคุมโรงงาน</p>
          <h2>เครื่องไหนมีปัญหา ดูได้ทันทีที่นี่</h2>
          <p>
            แดชบอร์ดสรุปสถานะ พร้อมกราฟวิเคราะห์จำนวน Alarm และรายชื่อเครื่องที่ต้องดูแล
          </p>
        </div>
        <div className="dash-hero-status">
          <span className="dash-health-label">สถานะภาพรวม</span>
          <strong>{healthText}</strong>
          <small>
            ทำงาน {stats.byStatus.Running}/{stats.totalMachines} · Alarm เปิด{" "}
            {stats.openAlarms} · งานซ่อมเปิด {stats.openMaintenance}
          </small>
        </div>
      </section>

      {error && (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      )}

      {loading ? (
        <div className="dash-loading">
          <Spin tip="กำลังโหลดข้อมูลโรงงาน..." />
        </div>
      ) : (
        <>
          <section className="dash-charts">
            <BarChart title="จำนวน Alarm 7 วันล่าสุด" points={alarmByDay} />
            <DonutStat title="สัดส่วนสถานะ Alarm" segments={alarmByStatus} />
            <BarChart title="เครื่องที่ Alarm บ่อย" points={alarmByMachine} />
          </section>

          <section className="dash-attention">
            <article className="attention-panel attention-alarm">
              <div className="attention-head">
                <div>
                  <WarningOutlined />
                  <h3>เครื่องที่ติด Alarm ตอนนี้</h3>
                </div>
                <Tag color="error">{alarmMachines.length} เครื่อง</Tag>
              </div>
              {alarmMachines.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="ไม่มีเครื่องสถานะ Alarm"
                />
              ) : (
                <ul className="attention-list">
                  {alarmMachines.map((m) => (
                    <li key={m.id}>
                      <div>
                        <strong>{m.machine_id}</strong>
                        <span>
                          {m.machine_name} · {m.location}
                        </span>
                      </div>
                      <Tag color="error">{MACHINE_STATUS_LABELS.Alarm}</Tag>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/alarms">
                <Button type="primary" danger block>
                  ไปจัดการ Alarm
                </Button>
              </Link>
            </article>

            <article className="attention-panel attention-maint">
              <div className="attention-head">
                <div>
                  <ToolOutlined />
                  <h3>เครื่องที่กำลังบำรุงรักษา</h3>
                </div>
                <Tag color="warning">{maintMachines.length} เครื่อง</Tag>
              </div>
              {maintMachines.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="ไม่มีเครื่องสถานะซ่อมบำรุง"
                />
              ) : (
                <ul className="attention-list">
                  {maintMachines.map((m) => (
                    <li key={m.id}>
                      <div>
                        <strong>{m.machine_id}</strong>
                        <span>
                          {m.machine_name} · {m.location}
                        </span>
                      </div>
                      <Tag color="warning">
                        {MACHINE_STATUS_LABELS.Maintenance}
                      </Tag>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/maintenance">
                <Button type="primary" block>
                  ไปงานบำรุงรักษา
                </Button>
              </Link>
            </article>
          </section>

          <section className="dash-section">
            <div className="dash-section-head">
              <h3>รายการ Alarm ที่ยังเปิด</h3>
              <Link href="/alarms">
                <Button type="link">ดูทั้งหมด</Button>
              </Link>
            </div>
            <Table
              rowKey="id"
              size="middle"
              pagination={false}
              locale={{ emptyText: "ไม่มี Alarm ค้าง" }}
              dataSource={openAlarmRows.slice(0, 5)}
              columns={[
                {
                  title: "เครื่อง",
                  key: "machine",
                  render: (_: unknown, row: Alarm) => (
                    <strong>
                      {row.machines?.machine_id || "-"}{" "}
                      {row.machines?.machine_name
                        ? `(${row.machines.machine_name})`
                        : ""}
                    </strong>
                  ),
                },
                { title: "รหัส", dataIndex: "alarm_code" },
                {
                  title: "รายละเอียด",
                  dataIndex: "alarm_description",
                  ellipsis: true,
                },
                {
                  title: "สถานะ",
                  dataIndex: "status",
                  render: (s: Alarm["status"]) => (
                    <Tag color={s === "Open" ? "error" : "warning"}>
                      {WORK_STATUS_LABELS[s]}
                    </Tag>
                  ),
                },
              ]}
            />
          </section>

          <section className="dash-section">
            <div className="dash-section-head">
              <h3>งานบำรุงรักษาที่ยังเปิด</h3>
              <Link href="/maintenance">
                <Button type="link">ดูทั้งหมด</Button>
              </Link>
            </div>
            <Table
              rowKey="id"
              size="middle"
              pagination={false}
              locale={{ emptyText: "ไม่มีงานบำรุงรักษาค้าง" }}
              dataSource={openMaintRows.slice(0, 5)}
              columns={[
                {
                  title: "เครื่อง",
                  key: "machine",
                  render: (_: unknown, row: MaintenanceRecord) => (
                    <strong>{row.machines?.machine_id || "-"}</strong>
                  ),
                },
                { title: "หัวข้อ", dataIndex: "title" },
                {
                  title: "ช่าง",
                  key: "tech",
                  render: (_: unknown, row: MaintenanceRecord) =>
                    row.profiles?.full_name || row.profiles?.email || "-",
                },
                {
                  title: "สถานะ",
                  dataIndex: "status",
                  render: (s: MaintenanceRecord["status"]) => (
                    <Tag
                      color={
                        s === "Open"
                          ? "error"
                          : s === "Waiting Part"
                            ? "purple"
                            : "warning"
                      }
                    >
                      {WORK_STATUS_LABELS[s]}
                    </Tag>
                  ),
                },
              ]}
            />
          </section>

          <section className="dash-section">
            <div className="dash-section-head">
              <h3>สรุปสถานะเครื่องทั้งหมด</h3>
              <Link href="/machines">
                <Button type="link">ไปหน้าเครื่องจักร</Button>
              </Link>
            </div>
            <div className="dash-metrics">
              <article className="metric metric-total">
                <ClusterOutlined className="metric-icon" />
                <div>
                  <p>เครื่องทั้งหมด</p>
                  <strong>{stats.totalMachines}</strong>
                </div>
              </article>
              <article className="metric metric-run">
                <CheckCircleOutlined className="metric-icon" />
                <div>
                  <p>กำลังทำงาน</p>
                  <strong>{stats.byStatus.Running}</strong>
                </div>
              </article>
              <article className="metric metric-stop">
                <PauseCircleOutlined className="metric-icon" />
                <div>
                  <p>หยุด</p>
                  <strong>{stats.byStatus.Stop}</strong>
                </div>
              </article>
              <article className="metric metric-alarm">
                <AlertOutlined className="metric-icon" />
                <div>
                  <p>มี Alarm</p>
                  <strong>{stats.byStatus.Alarm}</strong>
                </div>
              </article>
              <article className="metric metric-maint">
                <ToolOutlined className="metric-icon" />
                <div>
                  <p>ซ่อมบำรุง</p>
                  <strong>{stats.byStatus.Maintenance}</strong>
                </div>
              </article>
            </div>
            <div className="dash-progress">
              <div className="dash-progress-label">
                <span>สัดส่วนเครื่องที่ยังทำงาน</span>
                <strong>{runningPct}%</strong>
              </div>
              <div className="dash-bar">
                <span style={{ width: `${runningPct}%` }} />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
