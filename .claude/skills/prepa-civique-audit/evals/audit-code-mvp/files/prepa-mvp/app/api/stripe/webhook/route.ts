import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  const event = JSON.parse(await req.text());

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const until = new Date(Date.now() + 30 * 24 * 3600 * 1000);

    await supabase
      .from("users")
      .update({ is_premium: true, premium_until: until.toISOString() })
      .eq("email", session.customer_details.email);
  }

  return NextResponse.json({ received: true });
}
