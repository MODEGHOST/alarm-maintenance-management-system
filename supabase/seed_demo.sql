-- Demo seed data for Alarm & Maintenance Management System
-- Run AFTER schema.sql (and bonus_migration.sql if upgrading)
-- Safe to re-run: clears demo machines by machine_id prefix DEMO- then re-inserts

-- Remove previous demo rows (cascade alarms/maintenance)
delete from public.machines where machine_id like 'DEMO-%';

insert into public.machines (machine_id, machine_name, machine_type, location, status)
values
  ('DEMO-CNC-01', 'เครื่องกัด CNC Demo A', 'CNC', 'สายผลิต 1', 'Running'),
  ('DEMO-CNC-02', 'เครื่องกลึง CNC Demo B', 'CNC', 'สายผลิต 1', 'Alarm'),
  ('DEMO-RBT-01', 'หุ่นยนต์เชื่อม Demo', 'Robot', 'สายผลิต 2', 'Maintenance'),
  ('DEMO-PMP-01', 'ปั๊มน้ำหล่อเย็น Demo', 'Pump', 'ยูทิลิตี้', 'Stop'),
  ('DEMO-CNV-01', 'สายพานลำเลียง Demo', 'Conveyor', 'สายผลิต 2', 'Running');

-- Open alarm on DEMO-CNC-02 (ขั้นที่ 1 — พร้อมเปิดงานซ่อม)
insert into public.alarms (
  machine_uuid, alarm_code, alarm_description, cause, status, occurred_at
)
select
  m.id,
  'E-201',
  'ตรวจพบอุณหภูมิสปินเดิลสูงผิดปกติ',
  'ระบบหล่อเย็นไหลอ่อน',
  'Open',
  now() - interval '2 hours'
from public.machines m
where m.machine_id = 'DEMO-CNC-02';

-- In-progress alarm + open maintenance on DEMO-RBT-01 (ขั้นที่ 3)
insert into public.alarms (
  machine_uuid, alarm_code, alarm_description, cause, status, occurred_at
)
select
  m.id,
  'E-305',
  'เซอร์โวแกน J3 ผิดตำแหน่ง',
  'รอตรวจสอบเอนโค้ดเดอร์',
  'In Progress',
  now() - interval '1 day'
from public.machines m
where m.machine_id = 'DEMO-RBT-01';

insert into public.maintenance_records (
  machine_uuid, title, description, status, scheduled_at
)
select
  m.id,
  'ซ่อมจาก Alarm E-305',
  'งานซ่อมจาก Alarm: เซอร์โวแกน J3 ผิดตำแหน่ง',
  'In Progress',
  now() - interval '20 hours'
from public.machines m
where m.machine_id = 'DEMO-RBT-01';

-- Closed history on DEMO-CNC-01 (ตัวอย่างประวัติ)
insert into public.alarms (
  machine_uuid, alarm_code, alarm_description, cause, status, occurred_at
)
select
  m.id,
  'E-110',
  'ฟิลเตอร์น้ำหล่อเย็นตัน',
  'ครบรอบบำรุงรักษา',
  'Closed',
  now() - interval '5 days'
from public.machines m
where m.machine_id = 'DEMO-CNC-01';

insert into public.maintenance_records (
  machine_uuid, title, description, status, scheduled_at, completed_at
)
select
  m.id,
  'เปลี่ยนไส้กรองน้ำหล่อเย็นสปินเดิล',
  'PM ตามแผน — เปลี่ยนไส้กรองและทดสอบแรงดัน',
  'Closed',
  now() - interval '5 days',
  now() - interval '4 days'
from public.machines m
where m.machine_id = 'DEMO-CNC-01';

-- Waiting Part example on DEMO-PMP-01
insert into public.maintenance_records (
  machine_uuid, title, description, status, scheduled_at
)
select
  m.id,
  'PM เปลี่ยนซีลปั๊ม',
  'ถอดตรวจสอบแล้ว — รออะไหล่ซีลชุดใหม่',
  'Waiting Part',
  now() - interval '8 hours'
from public.machines m
where m.machine_id = 'DEMO-PMP-01';

update public.machines set status = 'Maintenance', updated_at = now()
where machine_id = 'DEMO-PMP-01';

-- Done. Login แล้วลอง:
-- 1) Alarm DEMO-CNC-02 → กดเปิดงานซ่อม
-- 2) บำรุงรักษา DEMO-RBT-01 → ซ่อมเสร็จ
-- 3) ประวัติเครื่อง DEMO-CNC-01
