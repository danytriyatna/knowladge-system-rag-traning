import { NextResponse } from "next/server";
import { getSkill, updateSkill, deleteSkill } from "@/lib/skills";
import { requireAdmin, AuthError } from "@/lib/auth";

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/skills/[id]">
) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await ctx.params;
  const existing = getSkill(id);
  if (!existing) {
    return NextResponse.json({ error: "Skill tidak ditemukan" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const instructions =
    typeof body?.instructions === "string" ? body.instructions.trim() : "";
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : Boolean(existing.enabled);

  if (!name || !instructions) {
    return NextResponse.json(
      { error: "Nama dan instruksi skill tidak boleh kosong" },
      { status: 400 }
    );
  }

  const skill = updateSkill(id, { name, description, instructions, enabled });
  return NextResponse.json({ skill });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/skills/[id]">
) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await ctx.params;
  deleteSkill(id);
  return NextResponse.json({ ok: true });
}
