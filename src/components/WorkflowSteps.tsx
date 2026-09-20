"use client";

import { Steps } from "antd";

const ITEMS = [
  { title: "1. แจ้ง Alarm", description: "สถานะเปิด" },
  { title: "2. เปิดงานซ่อม", description: "เครื่องเข้าซ่อม" },
  { title: "3. ดำเนินการซ่อม", description: "กำลังทำ / รออะไหล่" },
  { title: "4. ซ่อมเสร็จ", description: "กลับปกติ" },
];

export function WorkflowSteps({
  current,
}: {
  /** 0=แจ้ง, 1=เปิดงาน, 2=กำลังซ่อม, 3=เสร็จ */
  current: number;
}) {
  return (
    <div className="workflow-steps-wrap">
      <Steps
        size="small"
        current={Math.min(Math.max(current, 0), 3)}
        items={ITEMS}
        responsive
      />
    </div>
  );
}

export function alarmWorkflowStep(status: string): number {
  if (status === "Closed") return 3;
  if (status === "In Progress") return 2;
  return 0;
}

export function maintenanceWorkflowStep(status: string): number {
  if (status === "Closed") return 3;
  if (status === "In Progress" || status === "Waiting Part") return 2;
  if (status === "Open") return 1;
  return 1;
}
