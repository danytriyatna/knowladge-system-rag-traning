import { NextResponse } from "next/server";
import { listSkills, createSkill } from "@/lib/skills";
import { requireAdmin, AuthError } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
  return NextResponse.json({ skills: await listSkills() });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const instructions =
    typeof body?.instructions === "string" ? body.instructions.trim() : "";

  if (!name || !instructions) {
    return NextResponse.json(
      { error: "Nama dan instruksi skill tidak boleh kosong" },
      { status: 400 }
    );
  }

  const skill = await createSkill({ name, description, instructions });
  return NextResponse.json({ skill }, { status: 201 });
}
