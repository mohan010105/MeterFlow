import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.length > 0 && value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const [usersRes, apisRes, usageRes, revRes] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("apis").select("*", { count: "exact", head: true }),
    supabase.from("usage_logs").select("*", { count: "exact", head: true }),
    supabase.from("invoices").select("total_amount").eq("status", "paid")
  ]);

  console.log('Total Users:', usersRes.count);
  console.log('Total APIs:', apisRes.count);
  console.log('Total Usage Logs:', usageRes.count);
  
  const totalRevenue = (revRes.data || []).reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  console.log('Total Revenue:', totalRevenue);
}

check();
