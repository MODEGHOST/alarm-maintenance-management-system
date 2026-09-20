"use client";

import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";

type Props = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  allowClear?: boolean;
};

/** เก็บค่าเป็น ISO string (หรือว่าง) แสดงผลแบบไทย วว/ดด/ปปปป ชม:นาที */
export function DateTimeField({
  value,
  onChange,
  placeholder = "วว / ดด / ปปปป -- : --",
  className,
  allowClear = true,
}: Props) {
  const parsed: Dayjs | null = value ? dayjs(value) : null;

  return (
    <DatePicker
      showTime={{ format: "HH:mm" }}
      format="DD/MM/YYYY HH:mm"
      value={parsed && parsed.isValid() ? parsed : null}
      onChange={(date) => {
        onChange(date ? date.toISOString() : "");
      }}
      placeholder={placeholder}
      allowClear={allowClear}
      className={className || "w-full"}
      style={{ width: "100%" }}
    />
  );
}
