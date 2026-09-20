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
  SearchOutlined,
} from "@ant-design/icons";
import { DateTimeField } from "@/components/DateTimeField";
import { PageIntro } from "@/components/PageIntro";
import { useAlertCounts } from "@/components/AlertProvider";
import { canManageMaintenance } from "@/lib/rbac";
import { WORK_STATUS_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/client";
import type {
  Machine,
  MaintenanceRecord,
  MaintenanceStatus,
  Profile,
} from "@/lib/types";
import { MAINTENANCE_STATUSES } from "@/lib/types";
import { validateMaintenanceForm } from "@/lib/validations";
import { syncMachineAfterMaintenanceChange } from "@/lib/workflow";

const emptyForm = {
  machine_uuid: "",
  title: "",
  description: "",
  status: "Open" as MaintenanceStatus,
  scheduled_at: "",
};

const statusColor: Record<MaintenanceStatus, string> = {
  Open: "error",
  "In Progress": "warning",
  Closed: "success",
};

export default function MaintenancePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
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

    const [machinesRes, recordsRes] = await Promise.all([
      supabase.from("machines").select("*").order("machine_id"),
      supabase
        .from("maintenance_records")
        .select(
          "*, machines(machine_id, machine_name), profiles!technician_id(full_name, email)",
        )
        .order("created_at", { ascending: false }),
    ]);

    if (machinesRes.error) throw machinesRes.error;
    if (recordsRes.error) throw recordsRes.error;

    setMachines((machinesRes.data || []) as Machine[]);
    setRecords((recordsRes.data || []) as MaintenanceRecord[]);
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

  const filtered = useMemo(() => {
    return records.filter((record) => {
      const machineLabel = `${record.machines?.machine_id || ""} ${record.machines?.machine_name || ""}`;
      const matchMachine =
        !filterMachine ||
        machineLabel.toLowerCase().includes(filterMachine.toLowerCase()) ||
        record.title.toLowerCase().includes(filterMachine.toLowerCase());
      const matchStatus = !filterStatus || record.status === filterStatus;
      return matchMachine && matchStatus;
    });
  }, [records, filterMachine, filterStatus]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(record: MaintenanceRecord) {
    setEditingId(record.id);
    setForm({
      machine_uuid: record.machine_uuid,
      title: record.title,
      description: record.description || "",
      status: record.status,
      scheduled_at: record.scheduled_at || "",
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
    if (!canManageMaintenance(profile)) {
      setError("คุณไม่มีสิทธิ์จัดการงานบำรุงรักษา");
      return;
    }
    const validationError = validateMaintenanceForm({
      machine_uuid: form.machine_uuid,
      title: form.title,
      description: form.description,
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
        message.success("อัปเดตงานบำรุงรักษาแล้ว");
      } else {
        const { error: insertError } = await supabase
          .from("maintenance_records")
          .insert({
            ...payload,
            technician_id: profile?.id || null,
          });
        if (insertError) {
          setError(insertError.message);
          return;
        }
        message.success("เพิ่มงานบำรุงรักษาแล้ว");
      }

      await syncMachineAfterMaintenanceChange(form.machine_uuid, form.status);

      // If closed, also close open alarms on same machine
      if (form.status === "Closed") {
        await supabase
          .from("alarms")
          .update({
            status: "Closed",
            updated_at: new Date().toISOString(),
          })
          .eq("machine_uuid", form.machine_uuid)
          .neq("status", "Closed");
        await syncMachineAfterMaintenanceChange(form.machine_uuid, "Closed");
      }

      closeModal();
      await load();
      await refreshAlerts();
    } finally {
      setSaving(false);
    }
  }

  async function completeJob(record: MaintenanceRecord) {
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

    await supabase
      .from("alarms")
      .update({
        status: "Closed",
        updated_at: new Date().toISOString(),
      })
      .eq("machine_uuid", record.machine_uuid)
      .neq("status", "Closed");

    await syncMachineAfterMaintenanceChange(record.machine_uuid, "Closed");
    message.success("ปิดงานซ่อมแล้ว และพยายามคืนสถานะเครื่องให้ปกติ");
    await load();
    await refreshAlerts();
  }

  const columns = [
    {
      title: "เครื่องจักร",
      key: "machine",
      render: (_: unknown, record: MaintenanceRecord) =>
        record.machines?.machine_id || "-",
    },
    {
      title: "หัวข้อ",
      dataIndex: "title",
      key: "title",
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: "ช่างเทคนิค",
      key: "tech",
      render: (_: unknown, record: MaintenanceRecord) =>
        record.profiles?.full_name || record.profiles?.email || "-",
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
      title: "กำหนดเวลา",
      dataIndex: "scheduled_at",
      key: "scheduled_at",
      render: (v: string | null) =>
        v ? new Date(v).toLocaleString("th-TH") : "-",
    },
    {
      title: "จัดการ",
      key: "actions",
      width: 220,
      render: (_: unknown, record: MaintenanceRecord) => (
        <Space wrap size={0}>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            แก้ไข
          </Button>
          {record.status !== "Closed" && (
            <Popconfirm
              title="ปิดงานซ่อมและคืนเครื่องให้ปกติ?"
              description="จะปิดงานนี้ และปิด Alarm ที่ค้างของเครื่องเดียวกัน"
              okText="ปิดงาน"
              cancelText="ยกเลิก"
              onConfirm={() => completeJob(record)}
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
          eyebrow="Maintenance Record"
          title="งานบำรุงรักษา"
          description="ขั้นที่ 2: รับงานซ่อมจาก Alarm หรือเปิดงานเอง → ซ่อมเสร็จกด 'ซ่อมเสร็จ' เพื่อปิดงานและคืนเครื่องให้ปกติ"
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          เปิดงานบำรุงรักษา
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
            placeholder="ค้นหาเครื่องหรือหัวข้องาน"
            value={filterMachine}
            onChange={(e) => setFilterMachine(e.target.value)}
          />
          <Select
            allowClear
            placeholder="กรองสถานะ"
            value={filterStatus || undefined}
            onChange={(v) => setFilterStatus(v || "")}
            options={MAINTENANCE_STATUSES.map((status) => ({
              value: status,
              label: WORK_STATUS_LABELS[status],
            }))}
          />
        </div>
      </Card>

      <Card
        className="ui-card"
        title={`รายการงานบำรุงรักษา (${filtered.length})`}
      >
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
        title={editingId ? "แก้ไขงานบำรุงรักษา" : "เปิดงานบำรุงรักษาใหม่"}
        open={modalOpen}
        onCancel={closeModal}
        onOk={onSubmit}
        okText={editingId ? "บันทึก" : "เปิดงาน"}
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
          <Form.Item label="หัวข้องาน" required style={{ marginBottom: 0 }}>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="เช่น เปลี่ยนไส้กรอง"
            />
          </Form.Item>
          <Form.Item
            label="รายละเอียด"
            style={{ marginBottom: 0 }}
            className="sm:col-span-2"
          >
            <Input.TextArea
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="รายละเอียดงาน"
            />
          </Form.Item>
          <Form.Item label="กำหนดเวลา" style={{ marginBottom: 0 }}>
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
