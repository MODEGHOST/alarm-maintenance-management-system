import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export async function writeAuditLog(input: {
  profile?: Profile | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabase = createClient();
    await supabase.from("audit_logs").insert({
      actor_id: input.profile?.id || null,
      actor_email: input.profile?.email || null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      summary: input.summary,
      metadata: input.metadata || null,
    });
  } catch {
    // ไม่ให้ audit พัง flow หลัก
  }
}
