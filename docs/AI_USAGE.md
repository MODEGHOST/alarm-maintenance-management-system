# AI Usage Report

## Tools used

- Cursor AI (Composer) สำหรับวิเคราะห์โจทย์ พัฒนาโค้ด และเอกสาร
- ตามโจทย์อนุญาตให้ใช้ AI ได้ทุกขั้นตอน

## สิ่งที่ AI ช่วย

1. วิเคราะห์ requirement จากไฟล์ PDF
2. ออกแบบ Database Schema และ RLS ตาม Role (Admin / Technician / Viewer)
3. พัฒนา Next.js + Ant Design UI (Login/Register, Sidebar, Dashboard, Modal CRUD)
4. Authentication + Role-Based Access
5. Validation (ว่าง, ไม่ซ้ำ, รูปแบบ, ความยาว, วันที่, เบอร์โทร, XSS-ish)
6. Workflow Alarm → เปิดงานซ่อม → Waiting Part → ปิดกลับปกติ
7. Notification (Badge + แถบแจ้งเตือน)
8. โบนัส: กราฟ Alarm, Machine History, Filter ขั้นสูง + ช่วงวันที่, Export CSV/Excel, Audit Log, Dark Mode / Responsive, ข้อมูล Technician
9. GitHub Actions CI และ README

## สิ่งที่ผู้เรียนตรวจเอง

- รัน `supabase/schema.sql` หรือ `bonus_migration.sql` ให้ครบ
- ความถูกต้องของ CRUD และสิทธิ์ Role (โดยเฉพาะ Viewer)
- ไม่ commit secret / Service Role Key
- ทดสอบ Login ทั้ง Admin / Technician / Viewer
- Deploy Vercel และแนบ Screenshot ตอนส่งงาน

## หมายเหตุ

ระบบหลักครบตาม requirement และเพิ่มฟีเจอร์โบนัสตามรายการใน README
