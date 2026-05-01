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

async function run() {
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
  console.log('PROFILES:', profiles);
  
  const { data: authUsers, error: aError } = await supabase.auth.admin.listUsers();
  if (aError) {
    console.error('AUTH USERS ERROR:', aError.message);
  } else {
    console.log('AUTH USERS:', authUsers.users.map(u => ({ id: u.id, email: u.email })));
  }
}

run();
