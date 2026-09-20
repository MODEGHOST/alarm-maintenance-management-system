"use client";

import Link from "next/link";
import { Alert, Button, Form, Input, Typography } from "antd";
import {
  LockOutlined,
  MailOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/config";

type RegisterValues = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onFinish(values: RegisterValues) {
    setError(null);
    setMessage(null);

    if (!hasSupabaseConfig()) {
      setError("Supabase ยังไม่ได้ตั้งค่า — ใส่ค่าใน .env.local ก่อน");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          data: {
            full_name: values.fullName.trim(),
            role: "technician",
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setMessage("สร้างบัญชีแล้ว — ไปหน้า Login เพื่อเข้าสู่ระบบ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-grid" aria-hidden />
      <div className="auth-glow" aria-hidden />

      <div className="auth-shell auth-enter">
        <aside className="auth-brand">
          <p className="auth-eyebrow">Programming in Automation Systems</p>
          <h1 className="auth-title">
            สมัครเข้า
            <br />
            ระบบควบคุม
          </h1>
          <p className="auth-lead">
            สมัครแล้วได้สิทธิ์ Technician — Admin ตั้งค่าได้ทีหลังใน profiles
          </p>
          <ul className="auth-points">
            <li>ดูเครื่องจักร</li>
            <li>บันทึก Alarm</li>
            <li>อัปเดตงานบำรุงรักษา</li>
          </ul>
        </aside>

        <section className="auth-panel">
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            สมัครใช้งาน
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
            กรอกข้อมูลเพื่อสร้างบัญชีใหม่
          </Typography.Paragraph>

          {error && (
            <Alert
              type="error"
              showIcon
              message={error}
              style={{ marginBottom: 16 }}
            />
          )}
          {message && (
            <Alert
              type="success"
              showIcon
              message={message}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form
            layout="vertical"
            size="large"
            onFinish={onFinish}
            requiredMark={false}
          >
            <Form.Item
              label="ชื่อ-นามสกุล"
              name="fullName"
              rules={[{ required: true, message: "กรุณากรอกชื่อ" }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Your name"
                autoComplete="name"
              />
            </Form.Item>

            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: "กรุณากรอกอีเมล" },
                { type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[
                { required: true, message: "กรุณากรอกรหัสผ่าน" },
                { min: 6, message: "อย่างน้อย 6 ตัวอักษ" },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item
              label="ยืนยัน Password"
              name="confirmPassword"
              dependencies={["password"]}
              rules={[
                { required: true, message: "กรุณายืนยันรหัสผ่าน" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("รหัสผ่านไม่ตรงกัน"));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Repeat password"
                autoComplete="new-password"
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="auth-submit"
            >
              สมัครใช้งาน
            </Button>
          </Form>

          <p className="auth-footer">
            มีบัญชีแล้ว? <Link href="/login">เข้าสู่ระบบ</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
