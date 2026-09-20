"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import type { Alarm, AlarmStatus, Machine, Profile } from "@/lib/types";
import { ALARM_STATUSES } from "@/lib/types";
import { validateAlarmForm } from "@/lib/validations";

const emptyForm = {
  machine_uuid: "",
  alarm_code: "",
  alarm_description: "",
  cause: "",
  status: "Open" as AlarmStatus,
  occurred_at: "",
};

export default function AlarmsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterMachine, setFilterMachine] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(profileData as Profile);
    }

    const [machinesRes, alarmsRes] = await Promise.all([
      supabase.from("machines").select("*").order("machine_id"),
      supabase
        .from("alarms")
        .select("*, machines(machine_id, machine_name)")
        .order("occurred_at", { ascending: false }),
    ]);

    if (machinesRes.error) throw machinesRes.error;
    if (alarmsRes.error) throw alarmsRes.error;

    setMachines((machinesRes.data || []) as Machine[]);
    setAlarms((alarmsRes.data || []) as Alarm[]);
  }

  useEffect(() => {
    load()
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load alarms"),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return alarms.filter((alarm) => {
      const machineLabel = `${alarm.machines?.machine_id || ""} ${alarm.machines?.machine_name || ""}`;
      const matchMachine =
        !filterMachine ||
        machineLabel.toLowerCase().includes(filterMachine.toLowerCase()) ||
        alarm.alarm_code.toLowerCase().includes(filterMachine.toLowerCase());
      const matchStatus = !filterStatus || alarm.status === filterStatus;
      return matchMachine && matchStatus;
    });
  }, [alarms, filterMachine, filterStatus]);

  function startEdit(alarm: Alarm) {
    setEditingId(alarm.id);
    setForm({
      machine_uuid: alarm.machine_uuid,
      alarm_code: alarm.alarm_code,
      alarm_description: alarm.alarm_description,
      cause: alarm.cause || "",
      status: alarm.status,
      occurred_at: alarm.occurred_at
        ? new Date(alarm.occurred_at).toISOString().slice(0, 16)
        : "",
    });
    setError(null);
    setMessage(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const validationError = validateAlarmForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    const supabase = createClient();
    const payload = {
      machine_uuid: form.machine_uuid,
      alarm_code: form.alarm_code.trim(),
      alarm_description: form.alarm_description.trim(),
      cause: form.cause.trim() || null,
      status: form.status,
      occurred_at: form.occurred_at
        ? new Date(form.occurred_at).toISOString()
        : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: profile?.id || null,
    };

    if (editingId) {
      const { error: updateError } = await supabase
        .from("alarms")
        .update(payload)
        .eq("id", editingId);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setMessage("Alarm updated");
    } else {
      const { error: insertError } = await supabase.from("alarms").insert(payload);
      if (insertError) {
        setError(insertError.message);
        return;
      }
      setMessage("Alarm created");
    }

    resetForm();
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Alarm Records</h2>
        <p className="text-sm text-slate-600">
          Create, view, and update alarm records
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Search Machine / Alarm Code
          </label>
          <input
            value={filterMachine}
            onChange={(e) => setFilterMachine(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Machine or Alarm Code"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Filter Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">All</option>
            {ALARM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <h3 className="font-semibold">
          {editingId ? "Edit Alarm" : "Add Alarm"}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={form.machine_uuid}
            onChange={(e) =>
              setForm((f) => ({ ...f, machine_uuid: e.target.value }))
            }
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Select Machine *</option>
            {machines.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machine.machine_id} — {machine.machine_name}
              </option>
            ))}
          </select>
          <input
            value={form.alarm_code}
            onChange={(e) =>
              setForm((f) => ({ ...f, alarm_code: e.target.value }))
            }
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Alarm Code *"
          />
          <input
            value={form.alarm_description}
            onChange={(e) =>
              setForm((f) => ({ ...f, alarm_description: e.target.value }))
            }
            className="rounded-md border border-slate-300 px-3 py-2 sm:col-span-2"
            placeholder="Alarm Description *"
          />
          <input
            value={form.cause}
            onChange={(e) => setForm((f) => ({ ...f, cause: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Cause"
          />
          <input
            type="datetime-local"
            value={form.occurred_at}
            onChange={(e) =>
              setForm((f) => ({ ...f, occurred_at: e.target.value }))
            }
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <select
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                status: e.target.value as AlarmStatus,
              }))
            }
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {ALARM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
          >
            {editingId ? "Update" : "Create"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-slate-300 px-4 py-2"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Machine</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Date/Time</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={6}>
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={6}>
                  No alarms found
                </td>
              </tr>
            ) : (
              filtered.map((alarm) => (
                <tr key={alarm.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    {alarm.machines?.machine_id || "-"}{" "}
                    {alarm.machines?.machine_name
                      ? `(${alarm.machines.machine_name})`
                      : ""}
                  </td>
                  <td className="px-3 py-2 font-medium">{alarm.alarm_code}</td>
                  <td className="px-3 py-2">{alarm.alarm_description}</td>
                  <td className="px-3 py-2">
                    {new Date(alarm.occurred_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={alarm.status} />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => startEdit(alarm)}
                      className="text-slate-700 underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
