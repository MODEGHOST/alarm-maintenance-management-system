"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import { EditOutlined } from "@ant-design/icons";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import { PageIntro } from "@/components/PageIntro";
import { writeAuditLog } from "@/lib/audit";
import { exportExcelCsv } from "@/lib/export";
import {
  emptyAdvancedFilter,
  matchesKeyword,
  type AdvancedFilterState,
} from "@/lib/filters";
import { ROLE_LABELS } from "@/lib/labels";
import { canManageTechnicians, isAdmin } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/types";
import { USER_ROLES } from "@/lib/types";
import { validateTechnicianForm } from "@/lib/validations";

export default function TechniciansPage() {
  const [me, setMe] = useState<Profile | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [filters, setFilters] =
    useState<AdvancedFilterState>(emptyAdvancedFilter);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    employee_code: "",
    specialty: "",
    shift: "",
    role: "technician" as UserRole,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canEdit = canManageTechnicians(me) || Boolean(me);

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
      setMe(data as Profile);
    }

    const { data, error: loadError } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    if (loadError) throw loadError;
    setPeople((data || []) as Profile[]);
  }

  useEffect(() => {
    load()
      .catch((err) =>
        setError(err instanceof Error ? err.message : "โหลดข้อมูลช่างไม่สำเร็จ"),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return people.filter((p) => {
      const isTechLike =
        !filters.type ||
        (filters.type === "technician" &&
          (p.role === "technician" || p.role === "admin")) ||
        p.role === filters.type;
      return (
        isTechLike &&
        matchesKeyword(
          `${p.full_name || ""} ${p.email || ""} ${p.employee_code || ""} ${p.specialty || ""} ${p.phone || ""}`,
          filters.keyword,
        ) &&
        (!filters.status || p.role === filters.status) &&
        (!filters.location || p.shift === filters.location)
      );
    });
  }, [people, filters]);

  function openEdit(person: Profile) {
    const ownOnly = !isAdmin(me) && person.id !== me?.id;
    if (ownOnly) {
      message.warning("แก้ไขได้เฉพาะโปรไฟล์ของตัวเอง (หรือเป็น Admin)");
      return;
    }
    setEditing(person);
    setForm({
      full_name: person.full_name || "",
      phone: person.phone || "",
      employee_code: person.employee_code || "",
      specialty: person.specialty || "",
      shift: person.shift || "",
      role: person.role,
    });
    setError(null);
  }

  async function onSave() {
    if (!editing) return;
    setError(null);
    const validationError = validateTechnicianForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload: Partial<Profile> = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      employee_code: form.employee_code.trim() || null,
      specialty: form.specialty.trim() || null,
      shift: form.shift.trim() || null,
    };
    if (isAdmin(me)) {
      payload.role = form.role;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", editing.id);

    setSaving(false);
    if (updateError) {
      setError(
        updateError.message.includes("phone") ||
          updateError.message.includes("column")
          ? "คอลัมน์ข้อมูลช่างยังไม่มี — รัน supabase/bonus_migration.sql"
          : updateError.message,
      );
      return;
    }

    await writeAuditLog({
      profile: me,
      action: "update",
      entityType: "technician",
      entityId: editing.id,
      summary: `อัปเดตข้อมูล ${payload.full_name}`,
    });
    message.success("บันทึกข้อมูลช่างแล้ว");
    setEditing(null);
    await load();
  }

  function onExport() {
    exportExcelCsv(
      `technicians-${new Date().toISOString().slice(0, 10)}`,
      ["ชื่อ", "อีเมล", "Role", "รหัสพนักงาน", "เบอร์", "ความชำนาญ", "กะ"],
      filtered.map((p) => [
        p.full_name || "",
        p.email || "",
        ROLE_LABELS[p.role],
        p.employee_code || "",
        p.phone || "",
        p.specialty || "",
        p.shift || "",
      ]),
    );
    message.success("ส่งออกข้อมูลช่างแล้ว");
  }

  const shiftOptions = useMemo(
    () =>
      [...new Set(people.map((p) => p.shift).filter(Boolean) as string[])].map(
        (s) => ({ value: s, label: s }),
      ),
    [people],
  );

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Technicians"
        title="ข้อมูลช่างเทคนิค"
        description="ดูและอัปเดตโปรไฟล์ช่าง (เบอร์โทร รหัสพนักงาน ความชำนาญ กะงาน) — Admin เปลี่ยน Role ได้"
      />

      {error && !editing && (
        <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} />
      )}

      <AdvancedFilterBar
        value={filters}
        onChange={setFilters}
        keywordPlaceholder="ค้นหาชื่อ / อีเมล / รหัส / ความชำนาญ"
        statusOptions={USER_ROLES.map((r) => ({
          value: r,
          label: ROLE_LABELS[r],
        }))}
        showType
        typeOptions={[
          { value: "technician", label: "ช่าง + Admin" },
          { value: "viewer", label: "Viewer" },
          { value: "admin", label: "Admin" },
        ]}
        showLocation
        locationOptions={shiftOptions}
        onExport={onExport}
      />

      <Card className="ui-card" title={`รายชื่อ (${filtered.length})`}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          pagination={{ pageSize: 8 }}
          scroll={{ x: true }}
          columns={[
            {
              title: "ชื่อ",
              dataIndex: "full_name",
              render: (v: string | null, row: Profile) => (
                <strong>{v || row.email}</strong>
              ),
            },
            { title: "อีเมล", dataIndex: "email" },
            {
              title: "Role",
              dataIndex: "role",
              render: (r: UserRole) => <Tag>{ROLE_LABELS[r]}</Tag>,
            },
            {
              title: "รหัสพนักงาน",
              dataIndex: "employee_code",
              render: (v: string | null) => v || "-",
            },
            {
              title: "เบอร์",
              dataIndex: "phone",
              render: (v: string | null) => v || "-",
            },
            {
              title: "ความชำนาญ",
              dataIndex: "specialty",
              render: (v: string | null) => v || "-",
            },
            {
              title: "กะ",
              dataIndex: "shift",
              render: (v: string | null) => v || "-",
            },
            {
              title: "จัดการ",
              key: "actions",
              render: (_: unknown, row: Profile) =>
                canEdit && (isAdmin(me) || row.id === me?.id) ? (
                  <Button
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => openEdit(row)}
                  >
                    แก้ไข
                  </Button>
                ) : (
                  <Tag>ดูอย่างเดียว</Tag>
                ),
            },
          ]}
        />
      </Card>

      <Modal
        centered
        title="แก้ไขข้อมูลช่าง / ผู้ใช้"
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={onSave}
        confirmLoading={saving}
        okText="บันทึก"
        cancelText="ยกเลิก"
        destroyOnHidden
        width={640}
      >
        {error && (
          <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Form.Item label="ชื่อ-นามสกุล" required style={{ marginBottom: 0 }}>
            <Input
              value={form.full_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, full_name: e.target.value }))
              }
            />
          </Form.Item>
          <Form.Item label="เบอร์โทร" style={{ marginBottom: 0 }}>
            <Input
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              placeholder="08xxxxxxxx"
            />
          </Form.Item>
          <Form.Item label="รหัสพนักงาน" style={{ marginBottom: 0 }}>
            <Input
              value={form.employee_code}
              onChange={(e) =>
                setForm((f) => ({ ...f, employee_code: e.target.value }))
              }
              placeholder="TECH-01"
            />
          </Form.Item>
          <Form.Item label="ความชำนาญ" style={{ marginBottom: 0 }}>
            <Input
              value={form.specialty}
              onChange={(e) =>
                setForm((f) => ({ ...f, specialty: e.target.value }))
              }
              placeholder="เช่น Electrical, Mechanical"
            />
          </Form.Item>
          <Form.Item label="กะงาน" style={{ marginBottom: 0 }}>
            <Input
              value={form.shift}
              onChange={(e) =>
                setForm((f) => ({ ...f, shift: e.target.value }))
              }
              placeholder="เช่น กะเช้า / กะดึก"
            />
          </Form.Item>
          {isAdmin(me) && (
            <Form.Item label="Role" style={{ marginBottom: 0 }}>
              <Select
                value={form.role}
                onChange={(role) => setForm((f) => ({ ...f, role }))}
                options={USER_ROLES.map((r) => ({
                  value: r,
                  label: ROLE_LABELS[r],
                }))}
              />
            </Form.Item>
          )}
        </div>
        <Space style={{ marginTop: 12 }}>
          <Tag>อีเมล: {editing?.email}</Tag>
        </Space>
      </Modal>
    </div>
  );
}
