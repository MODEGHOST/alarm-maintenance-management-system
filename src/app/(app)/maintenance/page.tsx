"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import type {
  Machine,
  MaintenanceRecord,
  MaintenanceStatus,
  Profile,
} from "@/lib/types";
import { MAINTENANCE_STATUSES } from "@/lib/types";
import { validateMaintenanceForm } from "@/lib/validations";

const emptyForm = {
  machine_uuid: "",
  title: "",
  description: "",
  status: "Open" as MaintenanceStatus,
  scheduled_at: "",
};

export default function MaintenancePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
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

    const [machinesRes, recordsRes] = await Promise.all([
      supabase.from("machines").select("*").order("machine_id"),
      supabase
        .from("maintenance_records")
        .select("*, machines(machine_id, machine_name), profiles(full_name, email)")
        .order("created_at", { ascending: false }),
    ]);

    if (machinesRes.error) throw machinesRes.error;
    if (recordsRes.error) throw recordsRes.error;

    setMachines((machinesRes.data || []) as Machine[]);
    setRecords((recordsRes.data || []) as MaintenanceRecord[]);
  }

  useEffect(() => {
    load()
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load maintenance",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return records.filter((record) => {
      const machineLabel = `${record.machines?.machine_id || ""} ${record.machines?.machine_name || ""}`;
      const matchMachine =
        !filterMachine ||
        machineLabel.toLowerCase().includes(filterMachine.toLowerCase()) ||
        record.title.toLowerCase().includes(filterMachine.toLowerCase());
      const matchStatus = !filterStatus || record.status === filterStatus;
      return matchMachine && matchStatus;
    });
  }, [records, filterMachine, filterStatus]);

  function startEdit(record: MaintenanceRecord) {
    setEditingId(record.id);
    setForm({
      machine_uuid: record.machine_uuid,
      title: record.title,
      description: record.description || "",
      status: record.status,
      scheduled_at: record.scheduled_at
        ? new Date(record.scheduled_at).toISOString().slice(0, 16)
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

    const validationError = validateMaintenanceForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    const supabase = createClient();
    const payload = {
      machine_uuid: form.machine_uuid,
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      scheduled_at: form.scheduled_at
        ? new Date(form.scheduled_at).toISOString()
        : null,
      technician_id: profile?.id || null,
      completed_at:
        form.status === "Closed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error: updateError } = await supabase
        .from("maintenance_records")
        .update(payload)
        .eq("id", editingId);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setMessage("Maintenance updated");
    } else {
      const { error: insertError } = await supabase
        .from("maintenance_records")
        .insert(payload);
      if (insertError) {
        setError(insertError.message);
        return;
      }
      setMessage("Maintenance created");
    }

    resetForm();
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Maintenance Records</h2>
        <p className="text-sm text-slate-600">
          Create, view, and update maintenance work
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Search Machine / Title
          </label>
          <input
            value={filterMachine}
            onChange={(e) => setFilterMachine(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Machine or Title"
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
            {MAINTENANCE_STATUSES.map((status) => (
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
          {editingId ? "Edit Maintenance" : "Add Maintenance"}
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
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Title *"
          />
          <input
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            className="rounded-md border border-slate-300 px-3 py-2 sm:col-span-2"
            placeholder="Description"
          />
          <input
            type="datetime-local"
            value={form.scheduled_at}
            onChange={(e) =>
              setForm((f) => ({ ...f, scheduled_at: e.target.value }))
            }
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <select
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                status: e.target.value as MaintenanceStatus,
              }))
            }
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {MAINTENANCE_STATUSES.map((status) => (
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
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Technician</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Scheduled</th>
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
                  No maintenance records found
                </td>
              </tr>
            ) : (
              filtered.map((record) => (
                <tr key={record.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    {record.machines?.machine_id || "-"}
                  </td>
                  <td className="px-3 py-2 font-medium">{record.title}</td>
                  <td className="px-3 py-2">
                    {record.profiles?.full_name ||
                      record.profiles?.email ||
                      "-"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="px-3 py-2">
                    {record.scheduled_at
                      ? new Date(record.scheduled_at).toLocaleString()
                      : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => startEdit(record)}
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
