import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (data) return data as Profile;

  // Avoid auth↔login redirect loop when profile row is missing
  if (error) return null;

  const fallback: Partial<Profile> = {
    id: user.id,
    email: user.email ?? null,
    full_name:
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split("@")[0] ||
      "User",
    role: "technician",
  };

  const { data: created } = await supabase
    .from("profiles")
    .upsert(fallback)
    .select("*")
    .maybeSingle();

  return (created as Profile | null) ?? null;
}
