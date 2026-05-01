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
  const userId = '686f3f27-1268-44aa-a831-b2ec6b259996';
  const email = 'mohanrajit05@gmail.com';
  
  // 1. Insert profile
  const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (!existingProfile) {
    const { error: insertError } = await supabase.from('profiles').insert({
      id: userId,
      email: email,
      name: 'Mohan Raj',
      role: 'admin',
      plan: 'Pro'
    });
    if (insertError) {
      console.error('Insert profile error:', insertError.message);
    } else {
      console.log('Inserted profile for admin.');
    }
  } else {
    console.log('Profile already exists.');
  }

  // 2. Update password
  const { error: passError } = await supabase.auth.admin.updateUserById(userId, {
    password: 'password123'
  });
  if (passError) {
    console.error('Update password error:', passError.message);
  } else {
    console.log('Updated password to password123 for', email);
  }
}

run();
