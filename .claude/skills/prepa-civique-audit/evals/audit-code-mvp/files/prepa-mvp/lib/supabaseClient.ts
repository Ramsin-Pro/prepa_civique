import { createClient } from "@supabase/supabase-js";

// Une seule instance partagée par le front et les routes API.
// On utilise la clé service_role pour ne pas être bloqué par les permissions pendant le dev.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);
