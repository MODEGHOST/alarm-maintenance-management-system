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
import { EditOutlined, UserOutlined } from "@ant-design/icons";
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
import { canManageUsers, canViewUsers, isAdmin } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/types";
import { USER_ROLES } from "@/lib/types";
import { validateTechnicianForm } from "@/lib/validations";

export default function UsersPage() {
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

  const admin = isAdmin(me);
  const allowed = canViewUsers(me);

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
        setError(err instanceof Error ? err.message : "โหลดผู้ใช้ไม่สำเร็จ"),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return people.filter((p) => {
      return (
        matchesKeyword(
          `${p.full_name || ""} ${p.email || ""} ${p.employee_code || ""} ${p.specialty || ""} ${p.phone || ""} ${p.role}`,
          filters.keyword,
        ) &&
        (!filters.status || p.role === filters.status) &&
        (!filters.type || p.role === filters.type) &&
        (!filters.location || p.shift === filters.location)
      );
    });
  }, [people, filters]);

  function openEdit(person: Profile) {
    if (!admin && person.id !== me?.id) {
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

    if (admin && editing.id === me?.id && form.role !== "admin") {
      setError("ไม่สามารถลด Role ของบัญชี Admin ที่กำลังใช้งานเองได้");
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
    if (admin) {
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
          ? "คอลัมน์ข้อมูลผู้ใช้ยังไม่มี — รัน supabase/bonus_migration.sql"
          : updateError.message,
      );
      return;
    }

    await writeAuditLog({
      profile: me,
      action: "update",
      entityType: "user",
      entityId: editing.id,
      summary: `อัปเดตผู้ใช้ ${payload.full_name}${admin ? ` (role=${payload.role})` : ""}`,
    });
    message.success("บันทึกข้อมูลผู้ใช้แล้ว");
    setEditing(null);
    await load();
  }

  function onExport() {
    exportExcelCsv(
      `users-${new Date().toISOString().slice(0, 10)}`,
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
    message.success("ส่งออกข้อมูลผู้ใช้แล้ว");
  }

  const shiftOptions = useMemo(
    () =>
      [...new Set(people.map((p) => p.shift).filter(Boolean) as string[])].map(
        (s) => ({ value: s, label: s }),
      ),
    [people],
  );

  if (!loading && me && !allowed) {
    return (
      <Alert
        type="warning"
        showIcon
        message="เฉพาะ Admin และ Technician ที่เข้าเมนูจัดการผู้ใช้ได้"
        description="Viewer ดูข้อมูลโรงงานได้อย่างเดียว ไม่จัดการบัญชีผู้ใช้"
      />
    );
  }

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="User Management"
        title="จัดการผู้ใช้"
        description={
          admin
            ? "Admin ดูผู้ใช้ทั้งหมด แก้โปรไฟล์ และกำหนด Role (Admin / Technician / Viewer)"
            : "ดูรายชื่อผู้ใช้ในระบบ และแก้ไขโปรไฟล์ของตัวเองได้"
        }
      />

      {admin && (
        <Alert
          type="info"
          showIcon
          icon={<UserOutlined />}
          message="สิทธิ์การจัดการ"
          description="เปลี่ยน Role ได้เฉพาะ Admin — บัญชีที่สมัครใหม่จะเป็น Technician หรือ Viewer ตามที่เลือกตอน Register"
        />
      )}

      {error && !editing && (
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
        keywordPlaceholder="ค้นหาชื่อ / อีเมล / รหัส / Role"
        statusOptions={USER_ROLES.map((r) => ({
          value: r,
          label: ROLE_LABELS[r],
        }))}
        showType
        typeOptions={USER_ROLES.map((r) => ({
          value: r,
          label: ROLE_LABELS[r],
        }))}
        showLocation
        locationOptions={shiftOptions}
        onExport={canManageUsers(me) || Boolean(me) ? onExport : undefined}
        exportLabel="Export ผู้ใช้"
      />

      <Card className="ui-card" title={`ผู้ใช้ทั้งหมด (${filtered.length})`}>
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
                <span>
                  <strong>{v || row.email}</strong>
                  {row.id === me?.id ? (
                    <Tag style={{ marginLeft: 8 }}>คุณ</Tag>
                  ) : null}
                </span>
              ),
            },
            { title: "อีเมล", dataIndex: "email" },
            {
              title: "Role",
              dataIndex: "role",
              render: (r: UserRole) => (
                <Tag color={r === "admin" ? "magenta" : r === "technician" ? "blue" : "default"}>
                  {ROLE_LABELS[r]}
                </Tag>
              ),
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
                admin || row.id === me?.id ? (
                  <Button
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => openEdit(row)}
                  >
                    {admin ? "แก้ไข / เปลี่ยน Role" : "แก้ไขโปรไฟล์"}
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
        title={admin ? "แก้ไขผู้ใช้ / กำหนด Role" : "แก้ไขโปรไฟล์ของฉัน"}
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
          <Alert
            type="error"
            showIcon
            message={error}
            style={{ marginBottom: 16 }}
          />
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
          {admin && (
            <Form.Item
              label="Role"
              style={{ marginBottom: 0 }}
              extra="กำหนดสิทธิ์การใช้งานระบบ"
            >
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
