"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Card, Table, Tag, message } from "antd";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import { PageIntro } from "@/components/PageIntro";
import { exportExcelCsv } from "@/lib/export";
import {
  emptyAdvancedFilter,
  inDateRange,
  matchesKeyword,
  type AdvancedFilterState,
} from "@/lib/filters";
import { formatDbError, isMissingRelationError } from "@/lib/db-error";
import { canViewAudit } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/client";
import type { AuditLog, Profile } from "@/lib/types";
import { validateDateRange } from "@/lib/validations";

export default function AuditPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] =
    useState<AdvancedFilterState>(emptyAdvancedFilter);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(data as Profile);
      }

      const { data, error: loadError } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (loadError) {
        if (isMissingRelationError(loadError)) {
          setLogs([]);
          setError(
            "ยังไม่มีตาราง audit_logs — เปิด Supabase SQL Editor แล้วรันไฟล์ supabase/bonus_migration.sql จากนั้นรีเฟรชหน้านี้",
          );
          return;
        }
        throw loadError;
      }
      setLogs((data || []) as AuditLog[]);
    }

    load()
      .catch((err) => setError(formatDbError(err, "โหลด Audit ไม่สำเร็จ")))
      .finally(() => setLoading(false));
  }, []);

  const allowed = canViewAudit(profile);
  const filterError = validateDateRange(filters.dateFrom, filters.dateTo);

  const filtered = useMemo(() => {
    if (filterError) return [];
    return logs.filter(
      (log) =>
        matchesKeyword(
          `${log.action} ${log.entity_type} ${log.summary} ${log.actor_email || ""}`,
          filters.keyword,
        ) &&
        (!filters.type || log.entity_type === filters.type) &&
        (!filters.status || log.action === filters.status) &&
        inDateRange(log.created_at, filters.dateFrom, filters.dateTo),
    );
  }, [logs, filters, filterError]);

  function onExport() {
    exportExcelCsv(
      `audit-${new Date().toISOString().slice(0, 10)}`,
      ["เวลา", "ผู้ใช้", "การกระทำ", "ประเภท", "สรุป"],
      filtered.map((l) => [
        new Date(l.created_at).toLocaleString("th-TH"),
        l.actor_email || "",
        l.action,
        l.entity_type,
        l.summary,
      ]),
    );
    message.success("ส่งออก Audit Log แล้ว");
  }

  if (!loading && profile && !allowed) {
    return (
      <Alert
        type="warning"
        showIcon
        message="เฉพาะ Admin และ Technician ที่ดู Audit Log ได้"
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Audit Log"
        title="บันทึกการใช้งาน"
        description="ติดตามใครสร้าง/แก้ไข/ปิดงานอะไร เมื่อไหร่ เพื่อความโปร่งใส"
      />

      {error && (
        <Alert
          type={error.includes("bonus_migration") ? "warning" : "error"}
          showIcon
          message={error}
        />
      )}
      {filterError && <Alert type="warning" showIcon message={filterError} />}

      <AdvancedFilterBar
        value={filters}
        onChange={setFilters}
        keywordPlaceholder="ค้นหาผู้ใช้ / สรุป / การกระทำ"
        statusOptions={[
          { value: "create", label: "create" },
          { value: "update", label: "update" },
          { value: "delete", label: "delete" },
          { value: "workflow", label: "workflow" },
        ]}
        showType
        typeOptions={[
          { value: "machine", label: "machine" },
          { value: "alarm", label: "alarm" },
          { value: "maintenance", label: "maintenance" },
          { value: "technician", label: "technician" },
        ]}
        onExport={onExport}
      />

      <Card className="ui-card" title={`รายการ (${filtered.length})`}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          pagination={{ pageSize: 10 }}
          scroll={{ x: true }}
          columns={[
            {
              title: "เวลา",
              dataIndex: "created_at",
              render: (v: string) => new Date(v).toLocaleString("th-TH"),
            },
            {
              title: "ผู้ใช้",
              dataIndex: "actor_email",
              render: (v: string | null) => v || "-",
            },
            {
              title: "การกระทำ",
              dataIndex: "action",
              render: (v: string) => <Tag>{v}</Tag>,
            },
            { title: "ประเภท", dataIndex: "entity_type" },
            { title: "สรุป", dataIndex: "summary" },
          ]}
        />
      </Card>
    </div>
  );
}
