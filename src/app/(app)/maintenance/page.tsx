"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import { DateTimeField } from "@/components/DateTimeField";
import { PageIntro } from "@/components/PageIntro";
import { useAlertCounts } from "@/components/AlertProvider";
import { writeAuditLog } from "@/lib/audit";
import { exportExcelCsv } from "@/lib/export";
import {
  emptyAdvancedFilter,
  inDateRange,
  matchesKeyword,
  type AdvancedFilterState,
} from "@/lib/filters";
import { WORK_STATUS_LABELS } from "@/lib/labels";
import { canManageMaintenance } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/client";
import type {
  Machine,
  MaintenanceRecord,
  MaintenanceStatus,
  Profile,
} from "@/lib/types";
import { MAINTENANCE_STATUSES } from "@/lib/types";
import { validateDateRange, validateMaintenanceForm } from "@/lib/validations";
import { syncMachineAfterMaintenanceChange } from "@/lib/workflow";

const emptyForm = {
  machine_uuid: "",
  title: "",
  description: "",
  status: "Open" as MaintenanceStatus,
  scheduled_at: "",
  technician_id: "",
};

const statusColor: Record<MaintenanceStatus, string> = {
  Open: "error",
  "In Progress": "warning",
  "Waiting Part": "purple",
  Closed: "success",
};

export default function MaintenancePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] =
    useState<AdvancedFilterState>(emptyAdvancedFilter);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { refresh: refreshAlerts } = useAlertCounts();
  const canEdit = canManageMaintenance(profile);

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(profileData as Profile);
    }

    const [machinesRes, recordsRes, techRes] = await Promise.all([
      supabase.from("machines").select("*").order("machine_id"),
      supabase
        .from("maintenance_records")
        .select(
          "*, machines(machine_id, machine_name), profiles!technician_id(full_name, email, phone, employee_code, specialty)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("*")
        .in("role", ["technician", "admin"])
        .order("full_name"),
    ]);

    if (machinesRes.error) throw machinesRes.error;
    if (recordsRes.error) throw recordsRes.error;
    if (techRes.error) throw techRes.error;

    setMachines((machinesRes.data || []) as Machine[]);
    setRecords((recordsRes.data || []) as MaintenanceRecord[]);
    setTechnicians((techRes.data || []) as Profile[]);
  }

  useEffect(() => {
    load()
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "โหลดงานบำรุงรักษาไม่สำเร็จ",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const filterError = validateDateRange(filters.dateFrom, filters.dateTo);

  const filtered = useMemo(() => {
    if (filterError) return [];
    return records.filter((record) => {
      const machineLabel = `${record.machines?.machine_id || ""} ${record.machines?.machine_name || ""}`;
      const techLabel = `${record.profiles?.full_name || ""} ${record.profiles?.email || ""}`;
      return (
        matchesKeyword(
          `${machineLabel} ${record.title} ${record.description || ""} ${techLabel}`,
          filters.keyword,
        ) &&
        (!filters.status || record.status === filters.status) &&
        (!filters.machineId || record.machine_uuid === filters.machineId) &&
        inDateRange(
          record.scheduled_at || record.created_at,
          filters.dateFrom,
          filters.dateTo,
        )
      );
    });
  }, [records, filters, filterError]);

  function openCreate() {
    if (!canEdit) {
      message.warning("Viewer ดูได้อย่างเดียว");
      return;
    }
    setEditingId(null);
    setForm({ ...emptyForm, technician_id: profile?.id || "" });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(record: MaintenanceRecord) {
    if (!canEdit) {
      message.warning("Viewer ดูได้อย่างเดียว");
      return;
    }
    setEditingId(record.id);
    setForm({
      machine_uuid: record.machine_uuid,
      title: record.title,
      description: record.description || "",
      status: record.status,
      scheduled_at: record.scheduled_at || "",
      technician_id: record.technician_id || "",
    });
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function onExport() {
    exportExcelCsv(
      `maintenance-${new Date().toISOString().slice(0, 10)}`,
      ["เครื่อง", "หัวข้อ", "ช่าง", "สถานะ", "นัดหมาย", "รายละเอียด"],
      filtered.map((r) => [
        r.machines?.machine_id || "",
        r.title,
        r.profiles?.full_name || r.profiles?.email || "",
        WORK_STATUS_LABELS[r.status],
        r.scheduled_at ? new Date(r.scheduled_at).toLocaleString("th-TH") : "",
        r.description || "",
      ]),
    );
    message.success("ส่งออก CSV/Excel แล้ว");
  }

  async function onSubmit() {
    setError(null);
    if (!canEdit) {
      setError("คุณไม่มีสิทธิ์จัดการงานบำรุงรักษา");
      return;
    }
    const validationError = validateMaintenanceForm({
      machine_uuid: form.machine_uuid,
      title: form.title,
      description: form.description,
      scheduled_at: form.scheduled_at,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = {
      machine_uuid: form.machine_uuid,
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      technician_id: form.technician_id || profile?.id || null,
      scheduled_at: form.scheduled_at
        ? new Date(form.scheduled_at).toISOString()
        : null,
      completed_at: form.status === "Closed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from("maintenance_records")
          .update(payload)
          .eq("id", editingId);
        if (updateError) {
          setError(updateError.message);
          return;
        }
        await writeAuditLog({
          profile,
          action: "update",
          entityType: "maintenance",
          entityId: editingId,
          summary: `อัปเดตงานซ่อม ${payload.title} (${payload.status})`,
        });
        message.success("อัปเดตงานบำรุงรักษาแล้ว");
      } else {
        const { data, error: insertError } = await supabase
          .from("maintenance_records")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) {
          setError(insertError.message);
          return;
        }
        await writeAuditLog({
          profile,
          action: "create",
          entityType: "maintenance",
          entityId: data?.id,
          summary: `สร้างงานซ่อม ${payload.title}`,
        });
        message.success("เพิ่มงานบำรุงรักษาแล้ว");
      }

      await syncMachineAfterMaintenanceChange(form.machine_uuid, form.status);
      closeModal();
      await load();
      await refreshAlerts();
    } finally {
      setSaving(false);
    }
  }

  async function completeJob(record: MaintenanceRecord) {
    if (!canEdit) return;
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("maintenance_records")
      .update({
        status: "Closed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id);
    if (updateError) {
      message.error(updateError.message);
      return;
    }
    await syncMachineAfterMaintenanceChange(record.machine_uuid, "Closed");
    await writeAuditLog({
      profile,
      action: "workflow",
      entityType: "maintenance",
      entityId: record.id,
      summary: `ปิดงานซ่อม ${record.title}`,
    });
    message.success("ซ่อมเสร็จแล้ว");
    await load();
    await refreshAlerts();
  }

  const columns = [
    {
      title: "เครื่อง",
      key: "machine",
      render: (_: unknown, row: MaintenanceRecord) =>
        row.machines?.machine_id || "-",
    },
    { title: "หัวข้อ", dataIndex: "title", key: "title" },
    {
      title: "ช่าง",
      key: "tech",
      render: (_: unknown, row: MaintenanceRecord) =>
        row.profiles?.full_name || row.profiles?.email || "-",
    },
    {
      title: "สถานะ",
      dataIndex: "status",
      key: "status",
      render: (status: MaintenanceStatus) => (
        <Tag color={statusColor[status]}>{WORK_STATUS_LABELS[status]}</Tag>
      ),
    },
    {
      title: "นัดหมาย",
      dataIndex: "scheduled_at",
      key: "scheduled_at",
      render: (v: string | null) =>
        v ? new Date(v).toLocaleString("th-TH") : "-",
    },
    {
      title: "จัดการ",
      key: "actions",
      width: 220,
      render: (_: unknown, row: MaintenanceRecord) =>
        !canEdit ? (
          <Tag>ดูอย่างเดียว</Tag>
        ) : (
          <Space wrap size={0}>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => openEdit(row)}
            >
              แก้ไข
            </Button>
            {row.status !== "Closed" && (
              <Popconfirm
                title="ปิดงานซ่อมนี้?"
                okText="ซ่อมเสร็จ"
                cancelText="ยกเลิก"
                onConfirm={() => completeJob(row)}
              >
                <Button type="link" icon={<CheckCircleOutlined />}>
                  ซ่อมเสร็จ
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageIntro
          eyebrow="Maintenance"
          title="งานบำรุงรักษา"
          description="จัดการงานซ่อม/PM รวมสถานะรออะไหล่ (Waiting Part) และมอบหมายช่าง"
        />
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            เพิ่มงานซ่อม
          </Button>
        )}
      </div>

      {error && !modalOpen && (
        <Alert
          type="error"
          showIcon
          message={error}
          closable
          onClose={() => setError(null)}
        />
      )}
      {filterError && <Alert type="warning" showIcon message={filterError} />}

      <AdvancedFilterBar
        value={filters}
        onChange={setFilters}
        keywordPlaceholder="ค้นหาหัวข้อ / เครื่อง / ช่าง"
        statusOptions={MAINTENANCE_STATUSES.map((status) => ({
          value: status,
          label: WORK_STATUS_LABELS[status],
        }))}
        machineOptions={machines.map((m) => ({
          value: m.id,
          label: `${m.machine_id} — ${m.machine_name}`,
        }))}
        onExport={onExport}
      />

      <Card className="ui-card" title={`รายการงาน (${filtered.length})`}>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          scroll={{ x: true }}
          locale={{ emptyText: "ยังไม่มีงานบำรุงรักษา" }}
        />
      </Card>

      <Modal
        centered
        title={editingId ? "แก้ไขงานบำรุงรักษา" : "เพิ่มงานบำรุงรักษา"}
        open={modalOpen}
        onCancel={closeModal}
        onOk={onSubmit}
        okText="บันทึก"
        cancelText="ยกเลิก"
        confirmLoading={saving}
        destroyOnHidden
        width={680}
      >
        {error && (
          <Alert
            type="error"
            showIcon
            message={error}
            style={{ marginBottom: 16 }}
          />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Form.Item label="เครื่องจักร" required style={{ marginBottom: 0 }}>
            <Select
              showSearch
              optionFilterProp="label"
              value={form.machine_uuid || undefined}
              onChange={(machine_uuid) =>
                setForm((f) => ({ ...f, machine_uuid }))
              }
              options={machines.map((m) => ({
                value: m.id,
                label: `${m.machine_id} — ${m.machine_name}`,
              }))}
            />
          </Form.Item>
          <Form.Item label="ช่างผู้รับผิดชอบ" style={{ marginBottom: 0 }}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              value={form.technician_id || undefined}
              onChange={(technician_id) =>
                setForm((f) => ({ ...f, technician_id: technician_id || "" }))
              }
              options={technicians.map((t) => ({
                value: t.id,
                label: `${t.full_name || t.email} (${t.employee_code || "ไม่มีรหัส"})`,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="หัวข้องาน"
            required
            style={{ marginBottom: 0 }}
            className="sm:col-span-2"
          >
            <Input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </Form.Item>
          <Form.Item
            label="รายละเอียด"
            style={{ marginBottom: 0 }}
            className="sm:col-span-2"
          >
            <Input.TextArea
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </Form.Item>
          <Form.Item label="วันเวลานัดหมาย" style={{ marginBottom: 0 }}>
            <DateTimeField
              value={form.scheduled_at}
              onChange={(scheduled_at) =>
                setForm((f) => ({ ...f, scheduled_at }))
              }
            />
          </Form.Item>
          <Form.Item label="สถานะ" style={{ marginBottom: 0 }}>
            <Select
              value={form.status}
              onChange={(status) => setForm((f) => ({ ...f, status }))}
              options={MAINTENANCE_STATUSES.map((status) => ({
                value: status,
                label: WORK_STATUS_LABELS[status],
              }))}
            />
          </Form.Item>
        </div>
      </Modal>
    </div>
  );
}
