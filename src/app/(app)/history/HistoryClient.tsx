"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Card,
  Empty,
  Select,
  Spin,
  Table,
  Tag,
  Timeline,
  message,
} from "antd";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import { PageIntro } from "@/components/PageIntro";
import { exportExcelCsv } from "@/lib/export";
import {
  emptyAdvancedFilter,
  inDateRange,
  matchesKeyword,
  type AdvancedFilterState,
} from "@/lib/filters";
import { MACHINE_STATUS_LABELS, WORK_STATUS_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/client";
import type {
  Alarm,
  Machine,
  MachineHistoryItem,
  MaintenanceRecord,
} from "@/lib/types";
import { validateDateRange } from "@/lib/validations";

export default function HistoryClient() {
  const searchParams = useSearchParams();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [selectedId, setSelectedId] = useState(
    searchParams.get("machine") || "",
  );
  const [filters, setFilters] =
    useState<AdvancedFilterState>(emptyAdvancedFilter);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [mRes, aRes, rRes] = await Promise.all([
        supabase.from("machines").select("*").order("machine_id"),
        supabase
          .from("alarms")
          .select("*, machines(machine_id, machine_name)")
          .order("occurred_at", { ascending: false }),
        supabase
          .from("maintenance_records")
          .select(
            "*, machines(machine_id, machine_name), profiles!technician_id(full_name, email)",
          )
          .order("created_at", { ascending: false }),
      ]);
      if (mRes.error) throw mRes.error;
      if (aRes.error) throw aRes.error;
      if (rRes.error) throw rRes.error;
      setMachines((mRes.data || []) as Machine[]);
      setAlarms((aRes.data || []) as Alarm[]);
      setRecords((rRes.data || []) as MaintenanceRecord[]);
      if (!selectedId && mRes.data?.[0]) {
        setSelectedId(mRes.data[0].id);
      }
    }

    load()
      .catch((err) =>
        setError(err instanceof Error ? err.message : "โหลดประวัติไม่สำเร็จ"),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = machines.find((m) => m.id === selectedId) || null;
  const filterError = validateDateRange(filters.dateFrom, filters.dateTo);

  const history = useMemo(() => {
    if (!selectedId || filterError) return [] as MachineHistoryItem[];

    const alarmItems: MachineHistoryItem[] = alarms
      .filter((a) => a.machine_uuid === selectedId)
      .map((a) => ({
        id: `a-${a.id}`,
        kind: "alarm" as const,
        title: `Alarm ${a.alarm_code}`,
        detail: a.alarm_description,
        status: a.status,
        at: a.occurred_at,
      }));

    const maintItems: MachineHistoryItem[] = records
      .filter((r) => r.machine_uuid === selectedId)
      .map((r) => ({
        id: `m-${r.id}`,
        kind: "maintenance" as const,
        title: r.title,
        detail: `${r.description || "-"} · ช่าง: ${r.profiles?.full_name || r.profiles?.email || "-"}`,
        status: r.status,
        at: r.scheduled_at || r.created_at,
      }));

    return [...alarmItems, ...maintItems]
      .filter(
        (item) =>
          matchesKeyword(`${item.title} ${item.detail}`, filters.keyword) &&
          (!filters.status || item.status === filters.status) &&
          (!filters.type || item.kind === filters.type) &&
          inDateRange(item.at, filters.dateFrom, filters.dateTo),
      )
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [alarms, records, selectedId, filters, filterError]);

  function onExport() {
    exportExcelCsv(
      `machine-history-${selected?.machine_id || "all"}`,
      ["ประเภท", "หัวข้อ", "รายละเอียด", "สถานะ", "วันเวลา"],
      history.map((h) => [
        h.kind === "alarm" ? "Alarm" : "บำรุงรักษา",
        h.title,
        h.detail,
        WORK_STATUS_LABELS[h.status as keyof typeof WORK_STATUS_LABELS] ||
          h.status,
        new Date(h.at).toLocaleString("th-TH"),
      ]),
    );
    message.success("ส่งออกประวัติแล้ว");
  }

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Machine History"
        title="ประวัติเครื่องจักร"
        description="ดูไทม์ไลน์ Alarm และงานบำรุงรักษาของแต่ละเครื่อง พร้อมกรองตามช่วงวันที่"
      />

      {error && <Alert type="error" showIcon message={error} />}
      {filterError && <Alert type="warning" showIcon message={filterError} />}

      <Card className="ui-card" size="small">
        <Select
          showSearch
          optionFilterProp="label"
          style={{ minWidth: 280, width: "100%", maxWidth: 420 }}
          placeholder="เลือกเครื่องจักร"
          value={selectedId || undefined}
          onChange={setSelectedId}
          options={machines.map((m) => ({
            value: m.id,
            label: `${m.machine_id} — ${m.machine_name}`,
          }))}
        />
        {selected && (
          <p className="history-meta">
            สถานะปัจจุบัน:{" "}
            <Tag>{MACHINE_STATUS_LABELS[selected.status]}</Tag> ·{" "}
            {selected.machine_type} · {selected.location}
          </p>
        )}
      </Card>

      <AdvancedFilterBar
        value={filters}
        onChange={setFilters}
        keywordPlaceholder="ค้นหาในประวัติ"
        statusOptions={[
          { value: "Open", label: "เปิด" },
          { value: "In Progress", label: "กำลังดำเนินการ" },
          { value: "Waiting Part", label: "รออะไหล่" },
          { value: "Closed", label: "ปิดแล้ว" },
        ]}
        showType
        typeOptions={[
          { value: "alarm", label: "Alarm" },
          { value: "maintenance", label: "บำรุงรักษา" },
        ]}
        onExport={onExport}
      />

      {loading ? (
        <div className="dash-loading">
          <Spin tip="กำลังโหลดประวัติ..." />
        </div>
      ) : !selected ? (
        <Empty description="เลือกเครื่องจักรเพื่อดูประวัติ" />
      ) : (
        <div className="history-grid">
          <Card className="ui-card" title="ไทม์ไลน์">
            {history.length === 0 ? (
              <Empty description="ยังไม่มีประวัติในช่วงที่เลือก" />
            ) : (
              <Timeline
                items={history.slice(0, 30).map((h) => ({
                  color: h.kind === "alarm" ? "red" : "blue",
                  children: (
                    <div>
                      <strong>
                        {h.kind === "alarm" ? "Alarm" : "ซ่อม"} · {h.title}
                      </strong>
                      <div className="history-detail">{h.detail}</div>
                      <small>
                        {new Date(h.at).toLocaleString("th-TH")} ·{" "}
                        {WORK_STATUS_LABELS[
                          h.status as keyof typeof WORK_STATUS_LABELS
                        ] || h.status}
                      </small>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>

          <Card className="ui-card" title={`ตารางประวัติ (${history.length})`}>
            <Table
              rowKey="id"
              size="small"
              dataSource={history}
              pagination={{ pageSize: 8 }}
              scroll={{ x: true }}
              columns={[
                {
                  title: "ประเภท",
                  dataIndex: "kind",
                  render: (k: string) =>
                    k === "alarm" ? (
                      <Tag color="error">Alarm</Tag>
                    ) : (
                      <Tag color="processing">บำรุงรักษา</Tag>
                    ),
                },
                { title: "หัวข้อ", dataIndex: "title" },
                { title: "รายละเอียด", dataIndex: "detail", ellipsis: true },
                {
                  title: "สถานะ",
                  dataIndex: "status",
                  render: (s: string) =>
                    WORK_STATUS_LABELS[s as keyof typeof WORK_STATUS_LABELS] ||
                    s,
                },
                {
                  title: "วันเวลา",
                  dataIndex: "at",
                  render: (v: string) => new Date(v).toLocaleString("th-TH"),
                },
              ]}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
