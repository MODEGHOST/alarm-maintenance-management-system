"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  ToolOutlined,
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
import { canManageAlarms } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/client";
import type { Alarm, AlarmStatus, Machine, Profile } from "@/lib/types";
import { ALARM_STATUSES } from "@/lib/types";
import { validateAlarmForm, validateDateRange } from "@/lib/validations";
import {
  createMaintenanceFromAlarm,
  markAlarmResolved,
  syncMachineAfterAlarmChange,
} from "@/lib/workflow";
import { WorkflowSteps } from "@/components/WorkflowSteps";

const emptyForm = {
  machine_uuid: "",
  alarm_code: "",
  alarm_description: "",
  cause: "",
  status: "Open" as AlarmStatus,
  occurred_at: "",
};

const statusColor: Record<AlarmStatus, string> = {
  Open: "error",
  "In Progress": "warning",
  Closed: "success",
};

export default function AlarmsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState<AdvancedFilterState>(emptyAdvancedFilter);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { refresh: refreshAlerts } = useAlertCounts();
  const canEdit = canManageAlarms(profile);

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

    const [machinesRes, alarmsRes] = await Promise.all([
      supabase.from("machines").select("*").order("machine_id"),
      supabase
        .from("alarms")
        .select("*, machines(machine_id, machine_name)")
        .order("occurred_at", { ascending: false }),
    ]);

    if (machinesRes.error) throw machinesRes.error;
    if (alarmsRes.error) throw alarmsRes.error;

    setMachines((machinesRes.data || []) as Machine[]);
    setAlarms((alarmsRes.data || []) as Alarm[]);
  }

  useEffect(() => {
    load()
      .catch((err) =>
        setError(err instanceof Error ? err.message : "โหลด Alarm ไม่สำเร็จ"),
      )
      .finally(() => setLoading(false));
  }, []);

  const filterError = validateDateRange(filters.dateFrom, filters.dateTo);

  const filtered = useMemo(() => {
    if (filterError) return [];
    return alarms.filter((alarm) => {
      const machineLabel = `${alarm.machines?.machine_id || ""} ${alarm.machines?.machine_name || ""}`;
      return (
        matchesKeyword(
          `${machineLabel} ${alarm.alarm_code} ${alarm.alarm_description} ${alarm.cause || ""}`,
          filters.keyword,
        ) &&
        (!filters.status || alarm.status === filters.status) &&
        (!filters.machineId || alarm.machine_uuid === filters.machineId) &&
        inDateRange(alarm.occurred_at, filters.dateFrom, filters.dateTo)
      );
    });
  }, [alarms, filters, filterError]);

  function openCreate() {
    if (!canEdit) {
      message.warning("Viewer ดูได้อย่างเดียว ไม่สามารถเพิ่ม Alarm ได้");
      return;
    }
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(alarm: Alarm) {
    if (!canEdit) {
      message.warning("Viewer ดูได้อย่างเดียว");
      return;
    }
    setEditingId(alarm.id);
    setForm({
      machine_uuid: alarm.machine_uuid,
      alarm_code: alarm.alarm_code,
      alarm_description: alarm.alarm_description,
      cause: alarm.cause || "",
      status: alarm.status,
      occurred_at: alarm.occurred_at || "",
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
      `alarms-${new Date().toISOString().slice(0, 10)}`,
      ["เครื่อง", "รหัส", "รายละเอียด", "สาเหตุ", "วันเวลา", "สถานะ"],
      filtered.map((a) => [
        a.machines?.machine_id || "",
        a.alarm_code,
        a.alarm_description,
        a.cause || "",
        new Date(a.occurred_at).toLocaleString("th-TH"),
        WORK_STATUS_LABELS[a.status],
      ]),
    );
    message.success("ส่งออก CSV/Excel แล้ว");
  }

  async function onSubmit() {
    setError(null);
    if (!canEdit) {
      setError("คุณไม่มีสิทธิ์จัดการ Alarm");
      return;
    }
    const validationError = validateAlarmForm({
      machine_uuid: form.machine_uuid,
      alarm_code: form.alarm_code,
      alarm_description: form.alarm_description,
      cause: form.cause,
      occurred_at: form.occurred_at,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = {
      machine_uuid: form.machine_uuid,
      alarm_code: form.alarm_code.trim(),
      alarm_description: form.alarm_description.trim(),
      cause: form.cause.trim() || null,
      // สถานะเปลี่ยนได้เฉพาะผ่านปุ่ม workflow — แก้ไขฟอร์มไม่แตะ status
      status: (editingId
        ? alarms.find((a) => a.id === editingId)?.status || form.status
        : "Open") as AlarmStatus,
      occurred_at: form.occurred_at
        ? new Date(form.occurred_at).toISOString()
        : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from("alarms")
          .update(payload)
          .eq("id", editingId);
        if (updateError) {
          setError(updateError.message);
          return;
        }
        await writeAuditLog({
          profile,
          action: "update",
          entityType: "alarm",
          entityId: editingId,
          summary: `อัปเดต Alarm ${payload.alarm_code}`,
        });
        message.success("อัปเดต Alarm แล้ว");
      } else {
        const { data, error: insertError } = await supabase
          .from("alarms")
          .insert({
            ...payload,
            created_by: profile?.id || null,
          })
          .select("id")
          .single();
        if (insertError) {
          setError(insertError.message);
          return;
        }
        await writeAuditLog({
          profile,
          action: "create",
          entityType: "alarm",
          entityId: data?.id,
          summary: `สร้าง Alarm ${payload.alarm_code}`,
        });
        message.success("บันทึก Alarm แล้ว");
      }

      await syncMachineAfterAlarmChange(form.machine_uuid);
      closeModal();
      await load();
      await refreshAlerts();
    } finally {
      setSaving(false);
    }
  }

  async function startRepair(alarm: Alarm) {
    if (!canEdit) return;
    if (alarm.status !== "Open") {
      message.warning("เปิดงานซ่อมได้เฉพาะ Alarm สถานะ「เปิด」");
      return;
    }
    try {
      await createMaintenanceFromAlarm({
        alarmId: alarm.id,
        machineUuid: alarm.machine_uuid,
        alarmCode: alarm.alarm_code,
        alarmDescription: alarm.alarm_description,
        technicianId: profile?.id || null,
      });
      await writeAuditLog({
        profile,
        action: "workflow",
        entityType: "alarm",
        entityId: alarm.id,
        summary: `เปิดงานซ่อมจาก Alarm ${alarm.alarm_code}`,
      });
      message.success("ขั้นที่ 2 สำเร็จ: เปิดงานซ่อมแล้ว — ไปดำเนินการที่เมนูบำรุงรักษา");
      await load();
      await refreshAlerts();
      router.push("/maintenance");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "เปิดงานซ่อมไม่สำเร็จ");
    }
  }

  async function resolveAlarm(alarm: Alarm) {
    if (!canEdit) return;
    try {
      const closeMaint = alarm.status === "In Progress";
      const next = await markAlarmResolved({
        alarmId: alarm.id,
        machineUuid: alarm.machine_uuid,
        closeOpenMaintenance: closeMaint,
      });
      await writeAuditLog({
        profile,
        action: "workflow",
        entityType: "alarm",
        entityId: alarm.id,
        summary:
          alarm.status === "Open"
            ? `ปิด Alarm ${alarm.alarm_code} (ไม่เปิดงานซ่อม)`
            : `ปิด Alarm ${alarm.alarm_code} พร้อมงานซ่อม`,
      });
      message.success(
        next === "Running"
          ? "ขั้นที่ 4 สำเร็จ: เครื่องกลับสู่สถานะกำลังทำงาน"
          : `ปิดแล้ว — สถานะเครื่องเป็น ${next} (ยังมีงาน/Alarm อื่นค้าง)`,
      );
      await load();
      await refreshAlerts();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "ปิด Alarm ไม่สำเร็จ");
    }
  }

  const columns = [
    {
      title: "เครื่องจักร",
      key: "machine",
      render: (_: unknown, alarm: Alarm) =>
        `${alarm.machines?.machine_id || "-"} ${
          alarm.machines?.machine_name ? `(${alarm.machines.machine_name})` : ""
        }`,
    },
    {
      title: "รหัส",
      dataIndex: "alarm_code",
      key: "alarm_code",
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: "รายละเอียด",
      dataIndex: "alarm_description",
      key: "alarm_description",
    },
    {
      title: "วันเวลา",
      dataIndex: "occurred_at",
      key: "occurred_at",
      render: (v: string) => new Date(v).toLocaleString("th-TH"),
    },
    {
      title: "สถานะ",
      dataIndex: "status",
      key: "status",
      render: (status: AlarmStatus) => (
        <Tag color={statusColor[status]}>{WORK_STATUS_LABELS[status]}</Tag>
      ),
    },
    {
      title: "จัดการ",
      key: "actions",
      width: 280,
      render: (_: unknown, alarm: Alarm) =>
        !canEdit ? (
          <Tag>ดูอย่างเดียว</Tag>
        ) : (
          <Space wrap size={0}>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => openEdit(alarm)}
            >
              แก้ไข
            </Button>
            {alarm.status === "Open" && (
              <>
                <Popconfirm
                  title="ขั้นที่ 2: เปิดงานซ่อม?"
                  description="จะสร้างงานบำรุงรักษา และตั้งเครื่องเป็น「ซ่อมบำรุง」"
                  okText="เปิดงานซ่อม"
                  cancelText="ยกเลิก"
                  onConfirm={() => startRepair(alarm)}
                >
                  <Button type="link" icon={<ToolOutlined />}>
                    เปิดงานซ่อม
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title="ปิด Alarm โดยไม่ซ่อม?"
                  description="ใช้เมื่อแจ้งผิด หรือปัญหาหายเอง — จะไม่สร้างงานซ่อม"
                  okText="ปิด Alarm"
                  cancelText="ยกเลิก"
                  onConfirm={() => resolveAlarm(alarm)}
                >
                  <Button type="link" icon={<CheckCircleOutlined />}>
                    ปิดโดยไม่ซ่อม
                  </Button>
                </Popconfirm>
              </>
            )}
            {alarm.status === "In Progress" && (
              <>
                <Button
                  type="link"
                  icon={<ToolOutlined />}
                  onClick={() => router.push("/maintenance")}
                >
                  ไปงานซ่อม (ขั้น 3)
                </Button>
                <Popconfirm
                  title="ขั้นที่ 4: ซ่อมเสร็จและกลับปกติ?"
                  description="จะปิด Alarm และปิดงานซ่อมที่ค้างของเครื่องนี้"
                  okText="ซ่อมเสร็จ"
                  cancelText="ยกเลิก"
                  onConfirm={() => resolveAlarm(alarm)}
                >
                  <Button type="link" icon={<CheckCircleOutlined />}>
                    ซ่อมเสร็จ/กลับปกติ
                  </Button>
                </Popconfirm>
              </>
            )}
          </Space>
        ),
    },
  ];

  return (
    <div className="page-stack">
      <div className="page-head">
        <PageIntro
          eyebrow="Alarm Record"
          title="บันทึก Alarm"
          description="ทำงานเป็นลำดับ: แจ้ง Alarm → เปิดงานซ่อม → ซ่อมที่เมนูบำรุงรักษา → ซ่อมเสร็จกลับปกติ"
        />
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            เพิ่ม Alarm
          </Button>
        )}
      </div>

      <WorkflowSteps current={0} />

      {error && !modalOpen && (
        <Alert
          type="error"
          showIcon
          message={error}
          closable
          onClose={() => setError(null)}
        />
      )}
      {filterError && (
        <Alert type="warning" showIcon message={filterError} />
      )}

      <AdvancedFilterBar
        value={filters}
        onChange={setFilters}
        keywordPlaceholder="ค้นหารหัส / รายละเอียด / เครื่อง"
        statusOptions={ALARM_STATUSES.map((status) => ({
          value: status,
          label: WORK_STATUS_LABELS[status],
        }))}
        machineOptions={machines.map((m) => ({
          value: m.id,
          label: `${m.machine_id} — ${m.machine_name}`,
        }))}
        onExport={onExport}
      />

      <Card className="ui-card" title={`รายการ Alarm (${filtered.length})`}>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          scroll={{ x: true }}
          locale={{ emptyText: "ยังไม่มีรายการ Alarm" }}
        />
      </Card>

      <Modal
        centered
        title={editingId ? "แก้ไข Alarm" : "เพิ่ม Alarm ใหม่"}
        open={modalOpen}
        onCancel={closeModal}
        onOk={onSubmit}
        okText={editingId ? "บันทึก" : "เพิ่ม Alarm"}
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
              placeholder="เลือกเครื่อง"
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
          <Form.Item label="รหัส Alarm" required style={{ marginBottom: 0 }}>
            <Input
              value={form.alarm_code}
              onChange={(e) =>
                setForm((f) => ({ ...f, alarm_code: e.target.value }))
              }
              placeholder="เช่น E-102"
            />
          </Form.Item>
          <Form.Item
            label="รายละเอียด"
            required
            style={{ marginBottom: 0 }}
            className="sm:col-span-2"
          >
            <Input
              value={form.alarm_description}
              onChange={(e) =>
                setForm((f) => ({ ...f, alarm_description: e.target.value }))
              }
              placeholder="อธิบายอาการที่พบ"
            />
          </Form.Item>
          <Form.Item label="สาเหตุ" style={{ marginBottom: 0 }}>
            <Input
              value={form.cause}
              onChange={(e) =>
                setForm((f) => ({ ...f, cause: e.target.value }))
              }
              placeholder="สาเหตุ (ถ้าทราบ)"
            />
          </Form.Item>
          <Form.Item label="วันเวลาเกิด" style={{ marginBottom: 0 }}>
            <DateTimeField
              value={form.occurred_at}
              onChange={(occurred_at) =>
                setForm((f) => ({ ...f, occurred_at }))
              }
            />
          </Form.Item>
          <Form.Item
            label="สถานะ"
            style={{ marginBottom: 0 }}
            extra="เปลี่ยนสถานะด้วยปุ่ม workflow เท่านั้น (เปิดงานซ่อม / ซ่อมเสร็จ)"
          >
            <Select
              value={editingId ? form.status : "Open"}
              disabled
              options={ALARM_STATUSES.map((status) => ({
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
