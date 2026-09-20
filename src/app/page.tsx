import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/config";

export default async function HomePage() {
  if (!hasSupabaseConfig()) {
    redirect("/login");
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    redirect(user ? "/dashboard" : "/login");
  } catch {
    redirect("/login");
  }
}
