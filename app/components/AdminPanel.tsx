"use client";

import { useEffect, useState } from "react";

type UserRole = "admin" | "unit_user";

interface UserItem {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  unit: string | null;
  created_at: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  target_id: string | null;
  detail: string | null;
  created_at: string;
  user_email: string;
  user_full_name: string;
}

type QueryMode = "chat" | "kajian";
type EvidenceStrength = "kuat" | "sedang" | "lemah";

interface ChatHistoryItem {
  id: string;
  question: string;
  answer: string;
  created_at: string;
  mode: QueryMode;
  evidence_strength: EvidenceStrength | null;
  user_email: string | null;
  user_full_name: string | null;
}

const EVIDENCE_LABEL: Record<EvidenceStrength, string> = {
  kuat: "Kuat",
  sedang: "Sedang",
  lemah: "Lemah",
};

const EVIDENCE_CLASS: Record<EvidenceStrength, string> = {
  kuat: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  sedang: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  lemah: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

const ACTION_LABEL: Record<string, string> = {
  login: "Login",
  query_chat: "Tanya (Chat)",
  query_kajian: "Tanya (Kajian)",
  manual_upload: "Upload manual",
  delete_document: "Hapus dokumen",
  sync_triggered: "Jalankan sinkronisasi",
  create_user: "Buat akun",
};

export default function AdminPanel() {
  const [tab, setTab] = useState<"users" | "chat" | "audit">("users");

  const [users, setUsers] = useState<UserItem[] | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "unit_user" as UserRole,
    unit: "",
  });

  const [logs, setLogs] = useState<AuditLogItem[] | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[] | null>(null);
  const [chatHistoryError, setChatHistoryError] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  async function loadUsers() {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat daftar pengguna");
      setUsers(data.users ?? []);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Gagal memuat daftar pengguna");
    }
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setUsers(data.users ?? []);
      })
      .catch(() => {
        if (!ignore) setUserError("Gagal memuat daftar pengguna");
      });
    fetch("/api/admin/audit-log")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setLogs(data.logs ?? []);
      })
      .catch(() => {
        if (!ignore) setLogError("Gagal memuat log audit");
      });
    fetch("/api/admin/chat-history")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setChatHistory(data.history ?? []);
      })
      .catch(() => {
        if (!ignore) setChatHistoryError("Gagal memuat riwayat chat");
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function handleCreateUser(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setSaving(true);
    setUserError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat akun");
      setShowForm(false);
      setForm({ email: "", password: "", fullName: "", role: "unit_user", unit: "" });
      await loadUsers();
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Gagal membuat akun");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "users"
              ? "border-b-2 border-accent text-accent-text"
              : "text-muted hover:text-foreground"
          }`}
        >
          Kelola Pengguna
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "chat"
              ? "border-b-2 border-accent text-accent-text"
              : "text-muted hover:text-foreground"
          }`}
        >
          Riwayat Chat
        </button>
        <button
          onClick={() => setTab("audit")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "audit"
              ? "border-b-2 border-accent text-accent-text"
              : "text-muted hover:text-foreground"
          }`}
        >
          Log Audit
        </button>
      </div>

      {tab === "users" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              Buat akun untuk staf sekretariat jurnal (Admin) atau unit lain (Pengguna).
            </p>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="press shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              {showForm ? "Batal" : "+ Buat Akun"}
            </button>
          </div>

          {userError && <p className="fade-in text-sm text-red-600 dark:text-red-400">{userError}</p>}

          {showForm && (
            <form
              onSubmit={handleCreateUser}
              className="fade-in flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <input
                required
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <input
                required
                type="text"
                placeholder="Nama lengkap"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <input
                required
                type="password"
                placeholder="Kata sandi (minimal 8 karakter)"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="flex gap-3">
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  <option value="unit_user">Pengguna Unit</option>
                  <option value="admin">Admin</option>
                </select>
                <input
                  type="text"
                  placeholder="Nama unit (opsional)"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="press w-fit rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan Akun"}
              </button>
            </form>
          )}

          {users === null && <p className="text-sm text-muted">Memuat...</p>}
          {users && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nama</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Peran</th>
                    <th className="px-3 py-2 font-medium">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-3 py-2 text-foreground">{u.full_name}</td>
                      <td className="px-3 py-2 text-muted">{u.email}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-text">
                          {u.role === "admin" ? "Admin" : "Pengguna Unit"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted">{u.unit ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "chat" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Riwayat pertanyaan Chat &amp; Kajian dari seluruh pengguna lintas unit (200 terbaru).
          </p>
          {chatHistoryError && (
            <p className="fade-in text-sm text-red-600 dark:text-red-400">{chatHistoryError}</p>
          )}
          {chatHistory === null && <p className="text-sm text-muted">Memuat...</p>}
          {chatHistory && chatHistory.length === 0 && (
            <p className="text-sm text-muted">Belum ada riwayat chat.</p>
          )}
          {chatHistory && chatHistory.length > 0 && (
            <ul className="flex flex-col gap-2">
              {chatHistory.map((item) => {
                const isExpanded = expandedHistoryId === item.id;
                return (
                  <li key={item.id} className="rounded-xl border border-border bg-surface">
                    <button
                      onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                      className="flex w-full items-start justify-between gap-3 p-4 text-left"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <span
                            className={`inline-block transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          >
                            &#9656;
                          </span>
                          <span className="truncate">{item.question}</span>
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span>{item.user_full_name ?? item.user_email ?? "Tidak diketahui"}</span>
                          <span>&middot;</span>
                          <span>{new Date(item.created_at).toLocaleString("id-ID")}</span>
                          {item.mode === "kajian" && (
                            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent-text">
                              Kajian
                            </span>
                          )}
                          {item.evidence_strength && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${EVIDENCE_CLASS[item.evidence_strength]}`}
                            >
                              {EVIDENCE_LABEL[item.evidence_strength]}
                            </span>
                          )}
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="fade-in border-t border-border p-4">
                        <p className="whitespace-pre-wrap rounded-md bg-background p-3 text-sm leading-6 text-foreground">
                          {item.answer}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === "audit" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Aktivitas seluruh pengguna lintas unit (200 terbaru).
          </p>
          {logError && <p className="fade-in text-sm text-red-600 dark:text-red-400">{logError}</p>}
          {logs === null && <p className="text-sm text-muted">Memuat...</p>}
          {logs && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Waktu</th>
                    <th className="px-3 py-2 font-medium">Pengguna</th>
                    <th className="px-3 py-2 font-medium">Aksi</th>
                    <th className="px-3 py-2 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2 text-muted">
                        {new Date(log.created_at).toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2 text-foreground">{log.user_full_name}</td>
                      <td className="px-3 py-2 text-foreground">
                        {ACTION_LABEL[log.action] ?? log.action}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2 text-muted">
                        {log.detail ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
