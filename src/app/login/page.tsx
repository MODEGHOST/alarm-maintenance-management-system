"use client";

import Link from "next/link";
import { Alert, Button, Form, Input, Typography } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/config";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onFinish(values: { email: string; password: string }) {
    setError(null);

    if (!hasSupabaseConfig()) {
      setError("Supabase ยังไม่ได้ตั้งค่า — ใส่ค่าใน .env.local ก่อนใช้งาน");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
            Alarm &amp;
            <br />
            Maintenance
          </h1>
          <p className="auth-lead">
            ระบบติดตาม Alarm และงานบำรุงรักษาเครื่องจักรในโรงงาน
          </p>
          <ul className="auth-points">
            <li>ทะเบียนเครื่องจักร</li>
            <li>ติดตาม Alarm</li>
            <li>บันทึกงานบำรุงรักษา</li>
          </ul>
        </aside>

        <section className="auth-panel">
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            เข้าสู่ระบบ
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
            ใช้บัญชี Admin หรือ Technician
          </Typography.Paragraph>

          {!hasSupabaseConfig() && (
            <Alert
              type="warning"
              showIcon
              message="ยังไม่ได้ตั้งค่า Supabase"
              description="สร้างไฟล์ .env.local จาก .env.example แล้วรัน schema.sql"
              style={{ marginBottom: 16 }}
            />
          )}

          {error && (
            <Alert
              type="error"
              showIcon
              message={error}
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
              label="Email"
              name="email"
              rules={[
                { required: true, message: "กรุณากรอกอีเมล" },
                { type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="admin@test.com"
                autoComplete="email"
              />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: "กรุณากรอกรหัสผ่าน" }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="auth-submit"
            >
              เข้าสู่ระบบ
            </Button>
          </Form>

          <p className="auth-footer">
            ยังไม่มีบัญชี? <Link href="/register">สมัครใช้งาน</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
