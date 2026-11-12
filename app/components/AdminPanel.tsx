"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, MessageSquare, ShieldCheck, UserPlus, ChevronRight, AlertCircle } from "lucide-react";

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

const EVIDENCE_CONFIG: Record<EvidenceStrength, { label: string; variant: "success" | "warning" | "destructive" }> = {
  kuat: { label: "Kuat", variant: "success" },
  sedang: { label: "Sedang", variant: "warning" },
  lemah: { label: "Lemah", variant: "destructive" },
};

export default function AdminPanel() {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState<UserItem[] | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[] | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[] | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [chatHistoryError, setChatHistoryError] = useState<string | null>(null);

  // Form tambah user
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "unit_user" as UserRole,
    unit: "",
  });
  const [saving, setSaving] = useState(false);

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
    <div className="flex flex-col gap-6">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="h-12 w-full justify-start rounded-2xl bg-[#EEF4FC] p-1.5 sm:w-auto">
          <TabsTrigger value="users" className="gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
            <Users className="h-4 w-4" />
            Kelola Pengguna
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
            <MessageSquare className="h-4 w-4" />
            Riwayat Tanya JP
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4" />
            Log Audit Sistem
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Pengguna */}
        <TabsContent value="users" className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[#64748B]">
              Kelola akun staf redaksi jurnal (Admin) atau peneliti &amp; perekayasa unit (Pengguna Unit).
            </p>
            <Button
              onClick={() => setShowForm((v) => !v)}
              variant={showForm ? "outline" : "default"}
              className="gap-2 rounded-xl"
            >
              <UserPlus className="h-4 w-4" />
              {showForm ? "Batal" : "Buat Akun Baru"}
            </Button>
          </div>

          {userError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{userError}</span>
            </div>
          )}

          {showForm && (
            <Card className="border-[#C2CEE0] bg-white animate-in fade-in-50">
              <CardContent className="p-6">
                <h4 className="mb-4 text-sm font-bold text-[#0B254B]">Form Akun Baru</h4>
                <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[#0B254B]">Email</label>
                      <Input
                        required
                        type="email"
                        placeholder="nama@pu.go.id"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[#0B254B]">Nama Lengkap</label>
                      <Input
                        required
                        type="text"
                        placeholder="Nama dan gelar"
                        value={form.fullName}
                        onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-[#0B254B]">Kata Sandi</label>
                      <Input
                        required
                        type="password"
                        placeholder="Minimal 8 karakter"
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-[#0B254B]">Peran</label>
                        <select
                          value={form.role}
                          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                          className="h-10 rounded-xl border border-[#D9E1EC] bg-white px-3 text-sm text-[#1C1917] outline-none focus:ring-2 focus:ring-[#123B72]"
                        >
                          <option value="unit_user">Pengguna Unit</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-[#0B254B]">Unit Kerja</label>
                        <Input
                          type="text"
                          placeholder="Puskim / Balai"
                          value={form.unit}
                          onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                    >
                      Batal
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Menyimpan..." : "Simpan Akun"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {users === null && <p className="text-sm text-[#64748B]">Memuat data pengguna...</p>}
          {users && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Pengguna</TableHead>
                  <TableHead>Email Akun</TableHead>
                  <TableHead>Peran Akses</TableHead>
                  <TableHead>Unit Kerja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-semibold text-[#0B254B]">{u.full_name}</TableCell>
                    <TableCell className="text-[#64748B]">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                        {u.role === "admin" ? "Administrator" : "Pengguna Unit"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#64748B]">{u.unit ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* Tab 2: Riwayat Chat */}
        <TabsContent value="chat" className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-[#64748B]">
            Riwayat interaksi tanya jawab dan asistensi kajian ilmiah dari seluruh pengguna (200 terbaru).
          </p>
          {chatHistoryError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{chatHistoryError}</span>
            </div>
          )}
          {chatHistory === null && <p className="text-sm text-[#64748B]">Memuat riwayat chat...</p>}
          {chatHistory && chatHistory.length === 0 && (
            <p className="text-sm text-[#64748B]">Belum ada riwayat percakapan.</p>
          )}
          {chatHistory && chatHistory.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {chatHistory.map((item) => {
                const isExpanded = expandedHistoryId === item.id;
                return (
                  <Card key={item.id} className="border-[#D9E1EC] overflow-hidden">
                    <button
                      onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                      className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-[#EEF4FC]/40 cursor-pointer"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="flex items-center gap-2 text-sm font-semibold text-[#0B254B]">
                          <ChevronRight
                            className={`h-4 w-4 shrink-0 text-[#123B72] transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          />
                          <span className="truncate">{item.question}</span>
                        </span>
                        <span className="flex flex-wrap items-center gap-2 pl-6 text-xs text-[#64748B]">
                          <span>{item.user_full_name ?? item.user_email ?? "Anonim"}</span>
                          <span>&bull;</span>
                          <span>{new Date(item.created_at).toLocaleString("id-ID")}</span>
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {item.evidence_strength && (
                          <Badge variant={EVIDENCE_CONFIG[item.evidence_strength].variant}>
                            Bukti {EVIDENCE_CONFIG[item.evidence_strength].label}
                          </Badge>
                        )}
                        <Badge variant="outline" className="uppercase text-[10px]">
                          {item.mode}
                        </Badge>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-[#D9E1EC] bg-[#F8FAFD] p-5 text-sm leading-relaxed text-[#1C1917] animate-in fade-in-50">
                        <p className="whitespace-pre-wrap">{item.answer}</p>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Log Audit */}
        <TabsContent value="audit" className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-[#64748B]">
            Jejak aktivitas keamanan dan pengubahan sistem yang tersimpan permanen di basis data.
          </p>
          {logError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{logError}</span>
            </div>
          )}
          {logs === null && <p className="text-sm text-[#64748B]">Memuat log audit...</p>}
          {logs && logs.length === 0 && (
            <p className="text-sm text-[#64748B]">Belum ada catatan log audit.</p>
          )}
          {logs && logs.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Pengguna</TableHead>
                  <TableHead>Aktivitas</TableHead>
                  <TableHead>Target ID</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap text-[#64748B]">
                      {new Date(log.created_at).toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="font-semibold text-[#0B254B]">
                      {log.user_full_name || log.user_email || "Sistem"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs text-[#123B72]">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[#64748B]">
                      {log.target_id ? log.target_id.slice(0, 8) + "..." : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-[#64748B]">
                      {log.detail ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
