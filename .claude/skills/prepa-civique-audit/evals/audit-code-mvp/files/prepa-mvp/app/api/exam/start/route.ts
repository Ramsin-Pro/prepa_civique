import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

const QUESTION_COUNT = 40;
const DURATION_SECONDS = 45 * 60;

export async function POST(req: Request) {
  const { path } = await req.json();

  const { data: questions } = await supabase
    .from("questions")
    .select("id, statement, answers(id, text, is_correct)")
    .eq("path", path)
    .limit(QUESTION_COUNT);

  return NextResponse.json({ questions, duration: DURATION_SECONDS });
}
