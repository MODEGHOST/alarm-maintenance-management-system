# AI Usage Report

## Tools used

- Cursor AI (Composer) สำหรับวิเคราะห์โจทย์ พัฒนาโค้ด และเอกสาร
- ตามโจทย์อนุญาตให้ใช้ AI ได้ทุกขั้นตอน

## สิ่งที่ AI ช่วย

1. วิเคราะห์ requirement จากไฟล์ PDF
2. ออกแบบ Database Schema และ RLS ตาม Role
3. พัฒนา Next.js + Ant Design UI (Login/Register, Sidebar, Dashboard, Modal CRUD)
4. Authentication + Role-Based Access (Admin / Technician)
5. Validation (ห้ามว่าง, Machine ID ไม่ซ้ำ, รูปแบบ/ความยาว, ข้อความแจ้งเตือน)
6. Workflow Alarm → เปิดงานซ่อม → ปิดกลับปกติ
7. Notification (Badge + แถบแจ้งเตือน)
8. GitHub Actions CI และ README

## สิ่งที่ผู้เรียนตรวจเอง

- ความถูกต้องของ CRUD และสิทธิ์ Role
- ไม่ commit secret / Service Role Key
- ทดสอบ Login ทั้ง Admin และ Technician
- Deploy Vercel และแนบ Screenshot ตอนส่งงาน

## หมายเหตุ

ระบบหลักครบตาม requirement 100 คะแนน  
Bonus ไม่ได้ทำครบทุกข้อ แต่มีฟีเจอร์เสริมบางส่วน เช่น Register, Notification, Sidebar, Workflow เชื่อม Alarm-Maintenance
