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
| Role-Based Access | Admin และ Technician (คุมสิทธิ์ทั้งฝั่ง UI และ Supabase RLS) |
| Machine Master | CRUD เครื่องจักร (Admin เท่านั้น) |
| Alarm Record | Create / Read / Update + เปิดงานซ่อม / ปิดกลับปกติ |
| Maintenance | Create / Read / Update + ปิดงานซ่อมเสร็จ |
| Search / Filter | ค้นหาและกรองอย่างน้อย 2 เงื่อนไข |
| Dashboard | สรุปสถานะ + แสดงชื่อเครื่องที่ติด Alarm / กำลังซ่อม |
| Validation | ห้ามว่าง, Machine ID ไม่ซ้ำ, ตรวจรูปแบบ/ความยาว, แสดงข้อความเตือน |
| Notification | Badge เมนู + แถบแจ้งเตือนเมื่อมี Alarm เปิด |

### สิทธิ์ตาม Role

- **Admin**: จัดการ Machine / Alarm / Maintenance / ดู Dashboard ได้ทั้งหมด
- **Technician**: ดู Machine, จัดการ Alarm และ Maintenance, ดู Dashboard ได้ (แก้/ลบ Machine ไม่ได้)

## Database Structure

ตารางหลัก (ดูรายละเอียดใน `supabase/schema.sql`):

- `profiles` — ผูกกับ `auth.users`, เก็บ `role`
- `machines` — ทะเบียนเครื่องจักร (`machine_id` เป็น unique)
- `alarms` — บันทึก Alarm
- `maintenance_records` — งานบำรุงรักษา

ความสัมพันธ์:

```
auth.users 1─1 profiles
machines 1─* alarms
machines 1─* maintenance_records
profiles 1─* alarms (created_by)
profiles 1─* maintenance_records (technician_id)
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
2. เปิด SQL Editor แล้วรันไฟล์ `supabase/schema.sql`
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

### บัญชีทดสอบ (ถ้ามีในโปรเจกต์ของคุณ)

| Role | Email | Password |
|------|--------|----------|
| Admin | admin@test.com | Test123456 |
| Technician | tech@test.com | Test123456 |

หรือสมัครใหม่ที่หน้า Register (ได้ role technician อัตโนมัติ) แล้วไปตั้ง `profiles.role = admin` ใน Supabase ถ้าต้องการ

## Workflow การทำงาน

1. เกิดปัญหา → บันทึกที่เมนู **Alarm**
2. กด **เปิดงานซ่อม** → สร้างงานใน **บำรุงรักษา** อัตโนมัติ
3. ซ่อมเสร็จ → กด **ซ่อมเสร็จ** หรือ **ปิด/กลับปกติ**
4. ระบบปิดงาน/Alarm และคืนสถานะเครื่องเป็น **กำลังทำงาน** เมื่อไม่มีงานค้าง

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

## การใช้ AI ในการพัฒนา

ใช้ Cursor AI ช่วยวิเคราะห์โจทย์ ออกแบบฐานข้อมูล เขียนโค้ด UI/UX, SQL, CI, README และแก้ bug  
ผู้พัฒนาเป็นผู้รับผิดชอบความถูกต้อง ความปลอดภัย และการทดสอบก่อนส่ง

รายละเอียดเพิ่มเติม: `docs/AI_USAGE.md`
