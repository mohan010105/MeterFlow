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

const tables = [
  'apis',
  'api_keys',
  'usage_events',
  'usage_logs',
  'profiles',
  'plans',
  'subscriptions',
  'invoices',
  'payments',
  'webhook_events'
];

async function inspect() {
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table ${table} check: error - ${error.message}`);
    } else {
      console.log(`Table ${table} check: exists! Rows: ${data.length}`);
      if (data.length > 0) {
        console.log(`Columns in ${table}:`, Object.keys(data[0]));
      }
    }
  }
}

inspect();
