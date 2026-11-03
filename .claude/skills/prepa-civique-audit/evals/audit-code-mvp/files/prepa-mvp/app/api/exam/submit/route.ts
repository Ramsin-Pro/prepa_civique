import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

const PASS_THRESHOLD = 32;

export async function POST(req: Request) {
  // Le score est calculé dans le navigateur à partir des is_correct reçus au démarrage.
  const { userId, path, score } = await req.json();

  await supabase.from("attempts").insert({
    user_id: userId,
    path,
    score,
    passed: score >= PASS_THRESHOLD,
  });

  return NextResponse.json({ ok: true, passed: score >= PASS_THRESHOLD });
}
