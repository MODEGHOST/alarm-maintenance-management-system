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
  SearchOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { DateTimeField } from "@/components/DateTimeField";
import { PageIntro } from "@/components/PageIntro";
import { useAlertCounts } from "@/components/AlertProvider";
import { canManageAlarms } from "@/lib/rbac";
import { WORK_STATUS_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/client";
import type { Alarm, AlarmStatus, Machine, Profile } from "@/lib/types";
import { ALARM_STATUSES } from "@/lib/types";
import { validateAlarmForm } from "@/lib/validations";
import {
  createMaintenanceFromAlarm,
  markAlarmResolved,
  syncMachineAfterAlarmChange,
} from "@/lib/workflow";

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
  const [filterMachine, setFilterMachine] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { refresh: refreshAlerts } = useAlertCounts();

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

  const filtered = useMemo(() => {
    return alarms.filter((alarm) => {
      const machineLabel = `${alarm.machines?.machine_id || ""} ${alarm.machines?.machine_name || ""}`;
      const matchMachine =
        !filterMachine ||
        machineLabel.toLowerCase().includes(filterMachine.toLowerCase()) ||
        alarm.alarm_code.toLowerCase().includes(filterMachine.toLowerCase());
      const matchStatus = !filterStatus || alarm.status === filterStatus;
      return matchMachine && matchStatus;
    });
  }, [alarms, filterMachine, filterStatus]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(alarm: Alarm) {
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

  async function onSubmit() {
    setError(null);
    if (!canManageAlarms(profile)) {
      setError("คุณไม่มีสิทธิ์จัดการ Alarm");
      return;
    }
    const validationError = validateAlarmForm({
      machine_uuid: form.machine_uuid,
      alarm_code: form.alarm_code,
      alarm_description: form.alarm_description,
      cause: form.cause,
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
      status: form.status,
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
        message.success("อัปเดต Alarm แล้ว");
      } else {
        const { error: insertError } = await supabase.from("alarms").insert({
          ...payload,
          created_by: profile?.id || null,
        });
        if (insertError) {
          setError(insertError.message);
          return;
        }
        message.success("บันทึก Alarm แล้ว");
      }

      await syncMachineAfterAlarmChange(form.machine_uuid, form.status);
      closeModal();
      await load();
      await refreshAlerts();
    } finally {
      setSaving(false);
    }
  }

  async function startRepair(alarm: Alarm) {
    try {
      await createMaintenanceFromAlarm({
        alarmId: alarm.id,
        machineUuid: alarm.machine_uuid,
        alarmCode: alarm.alarm_code,
        alarmDescription: alarm.alarm_description,
        technicianId: profile?.id || null,
      });
      message.success("เปิดงานซ่อมแล้ว และอัปเดตสถานะ Alarm/เครื่องจักร");
      await load();
      await refreshAlerts();
      router.push("/maintenance");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "เปิดงานซ่อมไม่สำเร็จ");
    }
  }

  async function resolveAlarm(alarm: Alarm) {
    try {
      const next = await markAlarmResolved({
        alarmId: alarm.id,
        machineUuid: alarm.machine_uuid,
        closeOpenMaintenance: true,
      });
      message.success(
        next === "Running"
          ? "ปิด Alarm แล้ว เครื่องกลับสู่สถานะกำลังทำงาน"
          : `ปิด Alarm แล้ว สถานะเครื่องเป็น ${next}`,
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
      render: (_: unknown, alarm: Alarm) => (
        <Space wrap size={0}>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEdit(alarm)}
          >
            แก้ไข
          </Button>
          {alarm.status !== "Closed" && (
            <>
              <Popconfirm
                title="เปิดงานซ่อมจาก Alarm นี้?"
                description="ระบบจะสร้างงานบำรุงรักษา และตั้งเครื่องเป็นซ่อมบำรุง"
                okText="เปิดงานซ่อม"
                cancelText="ยกเลิก"
                onConfirm={() => startRepair(alarm)}
              >
                <Button type="link" icon={<ToolOutlined />}>
                  เปิดงานซ่อม
                </Button>
              </Popconfirm>
              <Popconfirm
                title="ปิด Alarm และทำให้เครื่องกลับปกติ?"
                description="จะปิด Alarm และปิดงานซ่อมที่ค้างของเครื่องนี้"
                okText="ปิดและกลับปกติ"
                cancelText="ยกเลิก"
                onConfirm={() => resolveAlarm(alarm)}
              >
                <Button type="link" icon={<CheckCircleOutlined />}>
                  ปิด/กลับปกติ
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageIntro
          eyebrow="Alarm Record"
          title="บันทึก Alarm"
          description="ขั้นที่ 1: แจ้งปัญหา → กด 'เปิดงานซ่อม' เพื่อสร้างงานบำรุงรักษา → ซ่อมเสร็จแล้วกด 'ปิด/กลับปกติ' ให้เครื่องกลับมาทำงาน"
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          เพิ่ม Alarm
        </Button>
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

      <Card size="small" className="ui-card">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="ค้นหาเครื่องหรือรหัส Alarm"
            value={filterMachine}
            onChange={(e) => setFilterMachine(e.target.value)}
          />
          <Select
            allowClear
            placeholder="กรองสถานะ"
            value={filterStatus || undefined}
            onChange={(v) => setFilterStatus(v || "")}
            options={ALARM_STATUSES.map((status) => ({
              value: status,
              label: WORK_STATUS_LABELS[status],
            }))}
          />
        </div>
      </Card>

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
          <Form.Item label="สถานะ" style={{ marginBottom: 0 }}>
            <Select
              value={form.status}
              onChange={(status) => setForm((f) => ({ ...f, status }))}
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
