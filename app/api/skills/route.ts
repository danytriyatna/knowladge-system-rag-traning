import { NextResponse } from "next/server";
import { listSkills, createSkill } from "@/lib/skills";

export async function GET() {
  return NextResponse.json({ skills: listSkills() });
}

export async function POST(request: Request) {
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

  const skill = createSkill({ name, description, instructions });
  return NextResponse.json({ skill }, { status: 201 });
}
