"use client";

import Link from "next/link";
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
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import { PageIntro } from "@/components/PageIntro";
import { writeAuditLog } from "@/lib/audit";
import { exportExcelCsv } from "@/lib/export";
import {
  emptyAdvancedFilter,
  matchesKeyword,
  type AdvancedFilterState,
} from "@/lib/filters";
import { MACHINE_STATUS_LABELS } from "@/lib/labels";
import { canManageMachines } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/client";
import type { Machine, MachineStatus, Profile } from "@/lib/types";
import { MACHINE_STATUSES } from "@/lib/types";
import { validateMachineForm } from "@/lib/validations";

const emptyForm = {
  machine_id: "",
  machine_name: "",
  machine_type: "",
  location: "",
  status: "Stop" as MachineStatus,
};

const statusColor: Record<MachineStatus, string> = {
  Running: "success",
  Stop: "default",
  Alarm: "error",
  Maintenance: "warning",
};

export default function MachinesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] =
    useState<AdvancedFilterState>(emptyAdvancedFilter);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = canManageMachines(profile);

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

    const { data, error: loadError } = await supabase
      .from("machines")
      .select("*")
      .order("created_at", { ascending: false });

    if (loadError) throw loadError;
    setMachines((data || []) as Machine[]);
  }

  useEffect(() => {
    load()
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "โหลดข้อมูลเครื่องจักรไม่สำเร็จ",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const typeOptions = useMemo(
    () =>
      [...new Set(machines.map((m) => m.machine_type))].map((t) => ({
        value: t,
        label: t,
      })),
    [machines],
  );

  const locationOptions = useMemo(
    () =>
      [...new Set(machines.map((m) => m.location))].map((l) => ({
        value: l,
        label: l,
      })),
    [machines],
  );

  const filtered = useMemo(() => {
    return machines.filter((m) => {
      return (
        matchesKeyword(
          `${m.machine_id} ${m.machine_name} ${m.machine_type} ${m.location}`,
          filters.keyword,
        ) &&
        (!filters.status || m.status === filters.status) &&
        (!filters.type || m.machine_type === filters.type) &&
        (!filters.location || m.location === filters.location) &&
        (!filters.machineId || m.id === filters.machineId)
      );
    });
  }, [machines, filters]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(machine: Machine) {
    setEditingId(machine.id);
    setForm({
      machine_id: machine.machine_id,
      machine_name: machine.machine_name,
      machine_type: machine.machine_type,
      location: machine.location,
      status: machine.status,
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
      `machines-${new Date().toISOString().slice(0, 10)}`,
      ["รหัส", "ชื่อ", "ประเภท", "ตำแหน่ง", "สถานะ"],
      filtered.map((m) => [
        m.machine_id,
        m.machine_name,
        m.machine_type,
        m.location,
        MACHINE_STATUS_LABELS[m.status],
      ]),
    );
    message.success("ส่งออก CSV/Excel แล้ว");
  }

  async function onSubmit() {
    setError(null);

    if (!isAdmin) {
      setError("เฉพาะผู้ดูแลระบบเท่านั้นที่เพิ่มหรือแก้ไขเครื่องจักรได้");
      return;
    }

    const validationError = validateMachineForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    const duplicate = machines.some(
      (m) =>
        m.machine_id.toLowerCase() === form.machine_id.trim().toLowerCase() &&
        m.id !== editingId,
    );
    if (duplicate) {
      setError("รหัสเครื่องนี้มีอยู่แล้ว");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = {
      ...form,
      machine_id: form.machine_id.trim(),
      machine_name: form.machine_name.trim(),
      machine_type: form.machine_type.trim(),
      location: form.location.trim(),
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from("machines")
          .update(payload)
          .eq("id", editingId);
        if (updateError) {
          setError(
            updateError.message.includes("duplicate")
              ? "รหัสเครื่องนี้มีอยู่แล้ว"
              : updateError.message,
          );
          return;
        }
        await writeAuditLog({
          profile,
          action: "update",
          entityType: "machine",
          entityId: editingId,
          summary: `อัปเดตเครื่อง ${payload.machine_id}`,
        });
        message.success("อัปเดตเครื่องจักรแล้ว");
      } else {
        const { data, error: insertError } = await supabase
          .from("machines")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) {
          setError(
            insertError.message.includes("duplicate")
              ? "รหัสเครื่องนี้มีอยู่แล้ว"
              : insertError.message,
          );
          return;
        }
        await writeAuditLog({
          profile,
          action: "create",
          entityType: "machine",
          entityId: data?.id,
          summary: `เพิ่มเครื่อง ${payload.machine_id}`,
        });
        message.success("เพิ่มเครื่องจักรแล้ว");
      }

      closeModal();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!isAdmin) return;
    const machine = machines.find((m) => m.id === id);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("machines")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await writeAuditLog({
      profile,
      action: "delete",
      entityType: "machine",
      entityId: id,
      summary: `ลบเครื่อง ${machine?.machine_id || id}`,
    });
    message.success("ลบเครื่องจักรแล้ว");
    if (editingId === id) closeModal();
    await load();
  }

  const columns = [
    {
      title: "รหัสเครื่อง",
      dataIndex: "machine_id",
      key: "machine_id",
      render: (v: string) => <strong>{v}</strong>,
    },
    { title: "ชื่อ", dataIndex: "machine_name", key: "machine_name" },
    { title: "ประเภท", dataIndex: "machine_type", key: "machine_type" },
    { title: "ตำแหน่ง", dataIndex: "location", key: "location" },
    {
      title: "สถานะ",
      dataIndex: "status",
      key: "status",
      render: (status: MachineStatus) => (
        <Tag color={statusColor[status]}>{MACHINE_STATUS_LABELS[status]}</Tag>
      ),
    },
    {
      title: "จัดการ",
      key: "actions",
      render: (_: unknown, machine: Machine) => (
        <Space wrap>
          <Link href={`/history?machine=${machine.id}`}>
            <Button type="link" icon={<HistoryOutlined />}>
              ประวัติ
            </Button>
          </Link>
          {isAdmin && (
            <>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => openEdit(machine)}
              >
                แก้ไข
              </Button>
              <Popconfirm
                title="ลบเครื่องจักรนี้?"
                description="ข้อมูล Alarm/งานที่ผูกกับเครื่องนี้อาจถูกลบตาม"
                okText="ลบ"
                cancelText="ยกเลิก"
                okButtonProps={{ danger: true }}
                onConfirm={() => onDelete(machine.id)}
              >
                <Button type="link" danger icon={<DeleteOutlined />}>
                  ลบ
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
          eyebrow="Machine Master"
          title="ทะเบียนเครื่องจักร"
          description={
            isAdmin
              ? "เพิ่ม ดู แก้ไข และลบเครื่องในโรงงาน — เป็นฐานข้อมูลหลักก่อนบันทึก Alarm หรืองานซ่อม"
              : "ดูรายการเครื่องจักรและสถานะปัจจุบัน (Technician/Viewer ดูได้อย่างเดียว)"
          }
        />
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            เพิ่มเครื่องจักร
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

      <AdvancedFilterBar
        value={filters}
        onChange={setFilters}
        keywordPlaceholder="ค้นหารหัสหรือชื่อเครื่อง"
        statusOptions={MACHINE_STATUSES.map((status) => ({
          value: status,
          label: MACHINE_STATUS_LABELS[status],
        }))}
        machineOptions={machines.map((m) => ({
          value: m.id,
          label: `${m.machine_id} — ${m.machine_name}`,
        }))}
        showType
        showLocation
        typeOptions={typeOptions}
        locationOptions={locationOptions}
        onExport={onExport}
      />

      <Card
        className="ui-card"
        title={`รายการเครื่องจักร (${filtered.length})`}
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          scroll={{ x: true }}
          locale={{ emptyText: "ยังไม่มีเครื่องจักร" }}
        />
      </Card>

      <Modal
        centered
        title={editingId ? "แก้ไขเครื่องจักร" : "เพิ่มเครื่องจักรใหม่"}
        open={modalOpen}
        onCancel={closeModal}
        onOk={onSubmit}
        okText={editingId ? "บันทึก" : "เพิ่มเครื่องจักร"}
        cancelText="ยกเลิก"
        confirmLoading={saving}
        destroyOnHidden
        width={640}
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
          <Form.Item label="รหัสเครื่อง" required style={{ marginBottom: 0 }}>
            <Input
              value={form.machine_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, machine_id: e.target.value }))
              }
              placeholder="เช่น CNC-001"
            />
          </Form.Item>
          <Form.Item label="ชื่อเครื่อง" required style={{ marginBottom: 0 }}>
            <Input
              value={form.machine_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, machine_name: e.target.value }))
              }
              placeholder="เช่น CNC Milling A1"
            />
          </Form.Item>
          <Form.Item label="ประเภท" required style={{ marginBottom: 0 }}>
            <Input
              value={form.machine_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, machine_type: e.target.value }))
              }
              placeholder="เช่น CNC, Robot"
            />
          </Form.Item>
          <Form.Item label="ตำแหน่งติดตั้ง" required style={{ marginBottom: 0 }}>
            <Input
              value={form.location}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
              placeholder="เช่น Line 1"
            />
          </Form.Item>
          <Form.Item label="สถานะ" style={{ marginBottom: 0 }}>
            <Select
              value={form.status}
              onChange={(status) => setForm((f) => ({ ...f, status }))}
              options={MACHINE_STATUSES.map((status) => ({
                value: status,
                label: MACHINE_STATUS_LABELS[status],
              }))}
            />
          </Form.Item>
        </div>
      </Modal>
    </div>
  );
}
