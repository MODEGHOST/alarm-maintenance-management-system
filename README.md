# Alarm & Maintenance Management System

ระบบจัดการ Alarm และงานบำรุงรักษาสำหรับโรงงาน / Automation Floor

## วัตถุประสงค์

พัฒนา Web Application สำหรับงาน Automation และบำรุงรักษาเครื่องจักร โดยใช้เทคโนโลยีสมัยใหม่ และอนุญาตให้ใช้ AI ช่วยพัฒนาได้ทุกขั้นตอน

## Technology Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Ant Design
- Supabase (Auth + PostgreSQL + RLS)
- GitHub + GitHub Actions (CI)
- Vercel (Deployment)

## ฟังก์ชันหลัก

| โมดูล | ความสามารถ |
|--------|------------|
| Authentication | Login / Logout / Register ด้วย Supabase Auth |
| Role-Based Access | Admin / Technician / **Viewer** (UI + RLS) |
| Machine Master | CRUD เครื่องจักร (Admin เท่านั้น) + ซิงก์สถานะทั้งหมด |
| Alarm Record | Create / Read / Update + เปิดงานซ่อม / ปิดกลับปกติ |
| Maintenance | Create / Read / Update + สถานะ **Waiting Part** + ปิดงานซ่อมเสร็จ |
| Search / Filter | ตัวกรองขั้นสูง + กรองตามช่วงวันที่ |
| Dashboard | สรุปสถานะ + กราฟ Alarm + **คู่มือลำดับขั้น + งานถัดไป** |
| Validation | ห้ามว่าง, ไม่ซ้ำ, รูปแบบ/ความยาว/วันที่, ข้อความเตือน |
| Notification | Badge เมนู + แถบแจ้งเตือนเมื่อมี Alarm เปิด |

## ฟีเจอร์โบนัสที่ทำแล้ว

| โบนัส | รายละเอียด |
|--------|------------|
| Role Viewer | ดูอย่างเดียว ไม่สร้าง/แก้ไข Alarm หรืองานซ่อม |
| กราฟ Alarm | แดชบอร์ด: จำนวน 7 วัน, สัดส่วนสถานะ, เครื่องที่ Alarm บ่อย |
| Machine History | หน้า `/history` ไทม์ไลน์ + ตารางประวัติต่อเครื่อง |
| Filter ขั้นสูง | คำค้น / สถานะ / เครื่อง / ประเภท / ตำแหน่ง / ช่วงวันที่ |
| Export CSV/Excel | ส่งออกจาก Alarm, เครื่อง, งานซ่อม, ประวัติ, ช่าง, Audit |
| Audit Log | หน้า `/audit` บันทึก create/update/delete/workflow |
| Responsive + Dark Mode | Sidebar มือถือ + สลับโหมดมืด/สว่าง |
| Waiting Part | สถานะงานซ่อม “รออะไหล่” |
| ข้อมูล Technician | หน้า `/technicians` (เบอร์, รหัส, ความชำนาญ, กะ, Role) |
| Validation เพิ่มเติม | วันที่, เบอร์โทร, รหัสพนักงาน, ห้ามวันที่อนาคต ฯลฯ |

### สิทธิ์ตาม Role

- **Admin**: จัดการ Machine / Alarm / Maintenance / ช่าง / Audit / Export ได้ทั้งหมด
- **Technician**: ดู Machine, จัดการ Alarm และ Maintenance, ดู Audit / History
- **Viewer**: ดู Dashboard / เครื่อง / Alarm / งานซ่อม / ประวัติ ได้อย่างเดียว

## Database Structure

ตารางหลัก (ดูรายละเอียดใน `supabase/schema.sql`):

- `profiles` — role + ข้อมูลช่าง (phone, employee_code, specialty, shift)
- `machines` — ทะเบียนเครื่องจักร (`machine_id` เป็น unique)
- `alarms` — บันทึก Alarm
- `maintenance_records` — งานบำรุงรักษา (รวม Waiting Part)
- `audit_logs` — บันทึกการใช้งาน

ถ้าเคยรัน schema เก่าแล้ว ให้รันเพิ่ม `supabase/bonus_migration.sql`  
ข้อมูล demo: `supabase/seed_demo.sql`

ความสัมพันธ์:

```
auth.users 1─1 profiles
machines 1─* alarms
machines 1─* maintenance_records
profiles 1─* alarms (created_by)
profiles 1─* maintenance_records (technician_id)
profiles 1─* audit_logs (actor_id)
```

## วิธีติดตั้งและใช้งาน

### 1) Clone และติดตั้ง

```bash
git clone https://github.com/MODEGHOST/alarm-maintenance-management-system.git
cd alarm-maintenance-management-system
npm install
```

### 2) ตั้งค่า Supabase

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com)
2. เปิด SQL Editor แล้วรันตามลำดับ:
   - `supabase/schema.sql`
   - ถ้ารัน schema เก่าไปแล้ว → `supabase/bonus_migration.sql`
   - (แนะนำ) `supabase/seed_demo.sql` สำหรับข้อมูลสาธิต
3. ปิด Confirm email ที่ Authentication → Providers → Email (เพื่อเทสง่าย)
4. คัดลอก Project URL และ anon/publishable key

### 3) Environment Variables

คัดลอก `.env.example` เป็น `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

**ห้าม** ใส่ Service Role Key ในฝั่ง client และห้าม commit ลง GitHub

### 4) รันระบบ

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

### บัญชีทดสอบ

| Role | Email | Password |
|------|--------|----------|
| Admin | admin@test.com | Test123456 |
| Technician | tech@test.com | Test123456 |

หรือสมัครใหม่ที่หน้า Register (เลือก Technician หรือ Viewer) แล้วตั้ง `profiles.role = admin` ใน Supabase ถ้าต้องการ

## Workflow การทำงาน (ลำดับขั้นบังคับ)

1. เกิดปัญหา → บันทึกที่เมนู **Alarm** (สถานะ「เปิด」)
2. กด **เปิดงานซ่อม** → สร้างงานใน **บำรุงรักษา** + เครื่องเป็น「ซ่อมบำรุง」
3. ที่บำรุงรักษา: **เริ่มซ่อม** → (ถ้าขาดอะไหล่กด **รออะไหล่**) → **ซ่อมเสร็จ**
4. ระบบปิดงาน/Alarm และคืนสถานะเครื่องเป็น **กำลังทำงาน** เมื่อไม่มีงานค้าง

แดชบอร์ดจะบอก「งานถัดไปที่ต้องทำ」อัตโนมัติ

## สคริปต์ทดสอบ 5 นาที (ก่อนส่งงาน)

1. Login เป็น Admin → ดูแดชบอร์ดมีลำดับขั้น + งานถัดไป
2. ไป **Alarm** → สร้าง Alarm ใหม่ (หรือใช้ `DEMO-CNC-02` จาก seed) → กด **เปิดงานซ่อม**
3. ไป **บำรุงรักษา** → กด **เริ่มซ่อม** → กด **ซ่อมเสร็จ**
4. ไป **เครื่องจักร** → สถานะเครื่องกลับ「กำลังทำงาน」(หรือกด **ซิงก์สถานะทั้งหมด**)
5. Login เป็น Viewer → ตรวจว่าเพิ่ม/แก้ไข Alarm ไม่ได้
6. ลอง Export CSV และดู **Audit Log** / **ประวัติเครื่อง**

## เช็คลิสต์ส่งงาน

- [ ] รัน `schema.sql` (+ `bonus_migration.sql` ถ้าจำเป็น) และ `seed_demo.sql`
- [ ] ทดสอบครบ 3 Role: Admin / Technician / Viewer
- [ ] ทดสอบ workflow จบวงจรตามสคริปต์ 5 นาที
- [ ] `npm run lint` และ `npm run build` ผ่าน
- [ ] GitHub Actions CI เขียว
- [ ] Deploy Vercel แล้วใส่ URL ด้านล่าง
- [ ] แคปหน้าจอ: Login, Dashboard, Alarm, Maintenance, Role/สิทธิ์
- [ ] อัปเดต `docs/AI_USAGE.md` ให้ตรงกับงานจริง

## GitHub Actions (CI)

ไฟล์: `.github/workflows/ci.yml`

เมื่อ push / pull request ไปที่ `main` จะรัน:

1. Install Dependencies (`npm ci`)
2. Lint (`npm run lint`)
3. Build Project (`npm run build`)

## Vercel Deployment

1. Import repository นี้ใน Vercel
2. ใส่ Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy

**Vercel URL:** _(ใส่หลัง deploy)_  
`https://YOUR-PROJECT.vercel.app`

## ลิงก์โปรเจกต์

- **GitHub:** https://github.com/MODEGHOST/alarm-maintenance-management-system
- **Vercel:** _(pending)_
- **Schema:** `supabase/schema.sql`
- **Migration โบนัส:** `supabase/bonus_migration.sql`
- **Seed demo:** `supabase/seed_demo.sql`

## การใช้ AI ในการพัฒนา

ใช้ Cursor AI ช่วยวิเคราะห์โจทย์ ออกแบบฐานข้อมูล เขียนโค้ด UI/UX, SQL, CI, README และแก้ bug  
ผู้พัฒนาเป็นผู้รับผิดชอบความถูกต้อง ความปลอดภัย และการทดสอบก่อนส่ง

รายละเอียดเพิ่มเติม: `docs/AI_USAGE.md`
