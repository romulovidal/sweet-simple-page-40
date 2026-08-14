import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: configs, error: err1 } = await supabase.from('atis_notification_configs').select('id').limit(1);
  console.log('atis_notification_configs:', { count: configs?.length, error: err1?.message });

  const { data: targets, error: err2 } = await supabase.from('atis_notification_targets').select('id').limit(1);
  console.log('atis_notification_targets:', { count: targets?.length, error: err2?.message });
}

check();
