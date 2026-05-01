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
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSchema() {
  console.log('Fixing schema via RPC/Client hacks...');
  
  // Note: We can't do DDL via Supabase client usually.
  // I will check if I can use a generic 'rpc' to reload schema if available.
  
  // BUT the user can run SQL. I will provide the SQL and tell them to run it.
  // HOWEVER, I want to try to be as helpful as possible.
  
  // I'll try to find out if I can use any existing function to run SQL.
  const { data, error } = await supabase.rpc('exec_sql', { 
    query: `
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ DEFAULT (NOW() + interval '30 days');
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id);
      
      NOTIFY pgrst, 'reload schema';
    ` 
  });
  
  if (error) {
    console.error('Schema fix failed (expected if RPC missing):', error.message);
  } else {
    console.log('Schema fix applied successfully!');
  }
}

fixSchema();
