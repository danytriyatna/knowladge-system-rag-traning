"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Plus, Trash2, Edit3, ChevronRight, AlertCircle } from "lucide-react";

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
      const url = editingId ? `/api/skills/${editingId}` : "/api/skills";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
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

  async function handleToggle(skill: Skill) {
    setSkills(
      (prev) =>
        prev?.map((s) => (s.id === skill.id ? { ...s, enabled: s.enabled ? 0 : 1 } : s)) ?? null
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
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="max-w-2xl">
            <h3 className="text-base font-bold text-[#0B254B]">Kemampuan Asistensi AI (Skills)</h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Kumpulan instruksi penalaran dan ekstraksi ilmiah yang digunakan otomatis oleh AI saat
              merumuskan sintesis kajian maupun rekomendasi kebijakan.
            </p>
          </div>
          <Button onClick={openAddForm} className="gap-2 rounded-xl font-semibold shadow-xs">
            <Plus className="h-4 w-4" />
            Tambah Kemampuan Baru
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <Card className="border-[#C2CEE0] bg-white animate-in fade-in-50">
          <CardContent className="p-6">
            <h4 className="mb-4 text-sm font-bold text-[#0B254B]">
              {editingId ? "Edit Kemampuan AI" : "Form Kemampuan AI Baru"}
            </h4>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#0B254B]">Nama Kemampuan</label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Contoh: Analisis Tren Standar SNI"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#0B254B]">Deskripsi Singkat</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Keterangan singkat peran kemampuan ini"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#0B254B]">Instruksi Penalaran (System Prompt)</label>
                <textarea
                  required
                  rows={4}
                  value={form.instructions}
                  onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                  placeholder="Tuliskan bagaimana model AI harus membedah data dan menarik kesimpulan untuk skill ini..."
                  className="w-full rounded-xl border border-[#D9E1EC] bg-white p-3.5 text-sm text-[#1C1917] outline-none focus:ring-2 focus:ring-[#123B72]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeForm}>
                  Batal
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Menyimpan..." : "Simpan Kemampuan"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {skills === null && <p className="text-sm text-[#64748B]">Memuat daftar kemampuan...</p>}
      {skills && skills.length === 0 && (
        <Card className="p-8 text-center text-sm text-[#64748B]">
          Belum ada kemampuan kustom yang dikonfigurasi.
        </Card>
      )}

      {skills && skills.length > 0 && (
        <div className="flex flex-col gap-3">
          {skills.map((skill) => {
            const isExpanded = expandedId === skill.id;
            return (
              <Card key={skill.id} className="overflow-hidden border-[#D9E1EC]">
                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : skill.id)}
                      className="flex items-center gap-2 text-left font-bold text-[#0B254B] hover:text-[#123B72] cursor-pointer"
                    >
                      <ChevronRight
                        className={`h-4 w-4 text-[#123B72] transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      />
                      <span>{skill.name}</span>
                    </button>
                    <Badge variant={skill.enabled ? "success" : "outline"} className="text-xs">
                      {skill.enabled ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggle(skill)}
                      className="text-xs"
                    >
                      {skill.enabled ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditForm(skill)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit3 className="h-4 w-4 text-[#64748B]" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(skill.id)}
                      className="h-8 w-8 p-0 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {skill.description && (
                  <p className="px-5 pb-3 text-xs text-[#64748B] pl-11">
                    {skill.description}
                  </p>
                )}

                {isExpanded && (
                  <div className="border-t border-[#D9E1EC] bg-[#F8FAFD] p-5 pl-11 text-xs text-[#1C1917] animate-in fade-in-50">
                    <p className="font-semibold text-[#0B254B] mb-1">Instruksi Khusus Model:</p>
                    <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#475569]">
                      {skill.instructions}
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
