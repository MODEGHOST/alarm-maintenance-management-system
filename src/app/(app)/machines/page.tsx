"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import type { Machine, MachineStatus, Profile } from "@/lib/types";
import { MACHINE_STATUSES } from "@/lib/types";
import { validateMachineForm } from "@/lib/validations";

const emptyForm = {
  machine_id: "",
  machine_name: "",
  machine_type: "",
  location: "",
  status: "Stop" as MachineStatus,
};

export default function MachinesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterMachine, setFilterMachine] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === "admin";

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

    const { data, error: loadError } = await supabase
      .from("machines")
      .select("*")
      .order("created_at", { ascending: false });

    if (loadError) throw loadError;
    setMachines((data || []) as Machine[]);
  }

  useEffect(() => {
    load()
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load machines"),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return machines.filter((m) => {
      const matchMachine =
        !filterMachine ||
        m.machine_id.toLowerCase().includes(filterMachine.toLowerCase()) ||
        m.machine_name.toLowerCase().includes(filterMachine.toLowerCase());
      const matchStatus = !filterStatus || m.status === filterStatus;
      return matchMachine && matchStatus;
    });
  }, [machines, filterMachine, filterStatus]);

  function startEdit(machine: Machine) {
    setEditingId(machine.id);
    setForm({
      machine_id: machine.machine_id,
      machine_name: machine.machine_name,
      machine_type: machine.machine_type,
      location: machine.location,
      status: machine.status,
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

    if (!isAdmin) {
      setError("Only Admin can create or update machines");
      return;
    }

    const validationError = validateMachineForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    const supabase = createClient();
    const payload = {
      ...form,
      machine_id: form.machine_id.trim(),
      machine_name: form.machine_name.trim(),
      machine_type: form.machine_type.trim(),
      location: form.location.trim(),
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error: updateError } = await supabase
        .from("machines")
        .update(payload)
        .eq("id", editingId);
      if (updateError) {
        setError(
          updateError.message.includes("duplicate")
            ? "Machine ID already exists"
            : updateError.message,
        );
        return;
      }
      setMessage("Machine updated");
    } else {
      const { error: insertError } = await supabase
        .from("machines")
        .insert(payload);
      if (insertError) {
        setError(
          insertError.message.includes("duplicate")
            ? "Machine ID already exists"
            : insertError.message,
        );
        return;
      }
      setMessage("Machine created");
    }

    resetForm();
    await load();
  }

  async function onDelete(id: string) {
    if (!isAdmin) return;
    if (!confirm("Delete this machine?")) return;

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("machines")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage("Machine deleted");
    if (editingId === id) resetForm();
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Machine Master</h2>
        <p className="text-sm text-slate-600">
          Create, view, update, and delete machines
          {!isAdmin && " (Technician: read only)"}
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Search Machine
          </label>
          <input
            value={filterMachine}
            onChange={(e) => setFilterMachine(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Machine ID or Name"
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
            {MACHINE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isAdmin && (
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
        >
          <h3 className="font-semibold">
            {editingId ? "Edit Machine" : "Add Machine"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.machine_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, machine_id: e.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Machine ID *"
            />
            <input
              value={form.machine_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, machine_name: e.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Machine Name *"
            />
            <input
              value={form.machine_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, machine_type: e.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Machine Type *"
            />
            <input
              value={form.location}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Location *"
            />
            <select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as MachineStatus,
                }))
              }
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {MACHINE_STATUSES.map((status) => (
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
      )}

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
              <th className="px-3 py-2">Machine ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Status</th>
              {isAdmin && <th className="px-3 py-2">Actions</th>}
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
                  No machines found
                </td>
              </tr>
            ) : (
              filtered.map((machine) => (
                <tr key={machine.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{machine.machine_id}</td>
                  <td className="px-3 py-2">{machine.machine_name}</td>
                  <td className="px-3 py-2">{machine.machine_type}</td>
                  <td className="px-3 py-2">{machine.location}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={machine.status} kind="machine" />
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(machine)}
                          className="text-slate-700 underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(machine.id)}
                          className="text-red-700 underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
