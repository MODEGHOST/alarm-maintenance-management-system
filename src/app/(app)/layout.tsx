import { AppShell, ProfileMissingPanel } from "@/components/AppShell";
import { getCurrentProfile } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabaseConfig()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return <ProfileMissingPanel email={user.email} />;
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
