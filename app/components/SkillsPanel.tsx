"use client";

import { useEffect, useState } from "react";

interface Skill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface SkillFormState {
  name: string;
  description: string;
  instructions: string;
}

const EMPTY_FORM: SkillFormState = { name: "", description: "", instructions: "" };

export default function SkillsPanel() {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SkillFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function loadSkills() {
    try {
      const res = await fetch("/api/skills");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat skill");
      setSkills(data.skills ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat skill");
    }
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/skills")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setSkills(data.skills ?? []);
      })
      .catch(() => {
        if (!ignore) setError("Gagal memuat skill");
      });
    return () => {
      ignore = true;
    };
  }, []);

  function openAddForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(skill: Skill) {
    setEditingId(skill.id);
    setForm({
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!form.name.trim() || !form.instructions.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const existing = editingId ? skills?.find((s) => s.id === editingId) : undefined;
      const res = await fetch(
        editingId ? `/api/skills/${editingId}` : "/api/skills",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editingId
              ? { ...form, enabled: existing ? Boolean(existing.enabled) : true }
              : form
          ),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan skill");
      closeForm();
      await loadSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan skill");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled(skill: Skill) {
    setSkills(
      (prev) =>
        prev?.map((s) =>
          s.id === skill.id ? { ...s, enabled: s.enabled ? 0 : 1 } : s
        ) ?? null
    );
    try {
      const res = await fetch(`/api/skills/${skill.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: skill.name,
          description: skill.description,
          instructions: skill.instructions,
          enabled: !skill.enabled,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      await loadSkills();
      setError("Gagal mengubah status skill");
    }
  }

  async function handleDelete(skillId: string) {
    const removed = skills?.find((s) => s.id === skillId);
    setSkills((prev) => prev?.filter((s) => s.id !== skillId) ?? null);
    try {
      const res = await fetch(`/api/skills/${skillId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      if (removed) await loadSkills();
      setError("Gagal menghapus skill");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-zinc-500">
          Kumpulan kemampuan analisis data &amp; pengambilan kesimpulan yang otomatis
          dipakai Chat AI setiap menjawab pertanyaan (skill yang nonaktif tidak dipakai).
        </p>
        <button
          onClick={openAddForm}
          className="shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          + Tambah Skill
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h3 className="text-sm font-medium text-black dark:text-zinc-50">
            {editingId ? "Edit Skill" : "Skill Baru"}
          </h3>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nama skill, mis. Analisis Tren & Pola"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          />
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Deskripsi singkat (opsional)"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          />
          <textarea
            value={form.instructions}
            onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
            placeholder="Instruksi lengkap: bagaimana AI harus menganalisis data / menarik kesimpulan untuk skill ini"
            rows={4}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-full border border-zinc-200 px-5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {skills === null && <p className="text-sm text-zinc-500">Memuat skill...</p>}
      {skills && skills.length === 0 && (
        <p className="text-sm text-zinc-500">Belum ada skill.</p>
      )}

      <ul className="flex flex-col gap-2">
        {skills?.map((skill) => {
          const isExpanded = expandedId === skill.id;
          return (
            <li
              key={skill.id}
              className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : skill.id)}
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-medium text-black dark:text-zinc-50">
                    <span
                      className={`inline-block transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    >
                      &#9656;
                    </span>
                    {skill.name}
                  </span>
                  {skill.description && (
                    <span className="text-xs text-zinc-500">{skill.description}</span>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                    skill.enabled
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500"
                  }`}
                >
                  {skill.enabled ? "Aktif" : "Nonaktif"}
                </span>
              </button>

              {isExpanded && (
                <div className="flex flex-col gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
                  <p className="whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    {skill.instructions}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleToggleEnabled(skill)}
                      className="rounded-full border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      {skill.enabled ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button
                      onClick={() => openEditForm(skill)}
                      className="rounded-full border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(skill.id)}
                      className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
