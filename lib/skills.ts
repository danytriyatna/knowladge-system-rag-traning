import { randomUUID } from "node:crypto";
import { db, type SkillRecord } from "./db";

interface DefaultSkill {
  name: string;
  description: string;
  instructions: string;
}

const DEFAULT_SKILLS: DefaultSkill[] = [
  {
    name: "Analisis Tren & Pola",
    description: "Mendeteksi tren, perubahan dari waktu ke waktu, dan pola berulang di dalam data.",
    instructions:
      "Kalau data di konteks memuat angka/nilai dari beberapa periode, kategori, atau titik pembanding, identifikasi arah perubahannya (naik/turun/stabil) dan pola yang berulang. Sebutkan angka spesifiknya, jangan cuma bilang 'terjadi peningkatan' tanpa menyebut datanya.",
  },
  {
    name: "Perbandingan Antar Data/Dokumen",
    description: "Membandingkan angka, kategori, atau temuan antar bagian dokumen maupun antar dokumen berbeda.",
    instructions:
      "Kalau pertanyaan meminta perbandingan (mana yang lebih tinggi/rendah/baik, selisih, dsb), susun perbandingannya secara eksplisit dan jelas — sebutkan nilai dari masing-masing pihak yang dibandingkan beserta selisih atau persentasenya kalau bisa dihitung dari data yang ada.",
  },
  {
    name: "Ringkasan & Kesimpulan Eksekutif",
    description: "Merangkum poin-poin kunci menjadi kesimpulan singkat dan mudah dicerna.",
    instructions:
      "Kalau diminta merangkum atau menyimpulkan, susun poin-poin paling penting secara ringkas dan terstruktur (boleh pakai bullet), fokus pada inti/insight utama, bukan menyalin ulang seluruh detail teks sumber.",
  },
  {
    name: "Deteksi Anomali & Kesenjangan",
    description: "Menyoroti data yang janggal, kurang, tidak konsisten, atau di bawah/di atas target.",
    instructions:
      "Perhatikan kalau ada nilai yang jauh dari target/rata-rata, data yang hilang, atau ketidaksesuaian antar bagian dokumen. Kalau relevan dengan pertanyaan, sebutkan secara spesifik apa yang janggal dan seberapa besar kesenjangannya, berdasarkan angka yang benar-benar ada di konteks.",
  },
  {
    name: "Rekomendasi Berbasis Data",
    description: "Memberi rekomendasi atau tindak lanjut yang berakar pada temuan data, bukan opini bebas.",
    instructions:
      "Kalau diminta rekomendasi/saran, dasarkan sepenuhnya pada temuan/angka yang ada di konteks (misal: kesenjangan yang terdeteksi, tren yang teridentifikasi). Jangan memberi rekomendasi generik yang tidak terkait isi dokumen, dan jangan mengarang data pendukung yang tidak ada.",
  },
];

function seedDefaultSkillsIfEmpty() {
  const { count } = db.prepare("SELECT COUNT(*) as count FROM skills").get() as {
    count: number;
  };
  if (count > 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO skills (id, name, description, instructions, enabled, created_at, updated_at)
     VALUES (@id, @name, @description, @instructions, 1, @created_at, @updated_at)`
  );
  const insertAll = db.transaction((skills: DefaultSkill[]) => {
    for (const skill of skills) {
      insert.run({ id: randomUUID(), ...skill, created_at: now, updated_at: now });
    }
  });
  insertAll(DEFAULT_SKILLS);
}

export function listSkills(): SkillRecord[] {
  seedDefaultSkillsIfEmpty();
  return db.prepare("SELECT * FROM skills ORDER BY created_at ASC").all() as SkillRecord[];
}

export function listEnabledSkills(): SkillRecord[] {
  seedDefaultSkillsIfEmpty();
  return db
    .prepare("SELECT * FROM skills WHERE enabled = 1 ORDER BY created_at ASC")
    .all() as SkillRecord[];
}

export function getSkill(id: string): SkillRecord | undefined {
  return db.prepare("SELECT * FROM skills WHERE id = ?").get(id) as
    | SkillRecord
    | undefined;
}

export function createSkill(input: {
  name: string;
  description: string;
  instructions: string;
}): SkillRecord {
  const now = new Date().toISOString();
  const record: SkillRecord = {
    id: randomUUID(),
    name: input.name,
    description: input.description,
    instructions: input.instructions,
    enabled: 1,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO skills (id, name, description, instructions, enabled, created_at, updated_at)
     VALUES (@id, @name, @description, @instructions, @enabled, @created_at, @updated_at)`
  ).run(record);
  return record;
}

export function updateSkill(
  id: string,
  input: { name: string; description: string; instructions: string; enabled: boolean }
): SkillRecord | undefined {
  const existing = getSkill(id);
  if (!existing) return undefined;

  const updated: SkillRecord = {
    ...existing,
    name: input.name,
    description: input.description,
    instructions: input.instructions,
    enabled: input.enabled ? 1 : 0,
    updated_at: new Date().toISOString(),
  };
  db.prepare(
    `UPDATE skills SET name=@name, description=@description, instructions=@instructions,
     enabled=@enabled, updated_at=@updated_at WHERE id=@id`
  ).run(updated);
  return updated;
}

export function deleteSkill(id: string): void {
  db.prepare("DELETE FROM skills WHERE id = ?").run(id);
}
