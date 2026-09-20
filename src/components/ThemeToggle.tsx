"use client";

import { Button } from "antd";
import { MoonOutlined, SunOutlined } from "@ant-design/icons";
import { useThemeMode } from "@/components/ThemeProvider";

export function ThemeToggle() {
  const { mode, toggle } = useThemeMode();
  return (
    <Button
      type="default"
      icon={mode === "dark" ? <SunOutlined /> : <MoonOutlined />}
      onClick={toggle}
      aria-label="สลับโหมดมืด/สว่าง"
    >
      {mode === "dark" ? "สว่าง" : "มืด"}
    </Button>
  );
}
