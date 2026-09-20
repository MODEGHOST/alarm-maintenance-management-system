import { redirect } from "next/navigation";

/** เมนูเดิม /technicians → ย้ายไปจัดการผู้ใช้ */
export default function TechniciansRedirectPage() {
  redirect("/users");
}
