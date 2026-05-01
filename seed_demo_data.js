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

async function populate() {
  console.log('Checking for data...');

  // 1. Ensure Profiles have IDs
  const { data: profiles } = await supabase.from('profiles').select('id');
  if (!profiles || profiles.length === 0) {
    console.log('No profiles found. Cannot proceed.');
    return;
  }
  const userId = profiles[0].id;

  // 2. Ensure APIs exist
  const { data: existingApis } = await supabase.from('apis').select('id');
  if (!existingApis || existingApis.length === 0) {
    console.log('Inserting sample APIs...');
    const { data: newApis, error: apiErr } = await supabase.from('apis').insert([
      { user_id: userId, name: 'Main Production API', base_url: 'https://api.meterflow.app', status: 'active', category: 'infrastructure' },
      { user_id: userId, name: 'Testing Sandbox', base_url: 'https://sandbox.meterflow.app', status: 'active', category: 'testing' }
    ]).select();
    if (apiErr) console.error('API Error:', apiErr.message);
  }

  const { data: allApis } = await supabase.from('apis').select('id');
  const apiId = allApis[0].id;

  // 3. Ensure API Keys exist
  const { data: existingKeys } = await supabase.from('api_keys').select('id');
  if (!existingKeys || existingKeys.length === 0) {
    console.log('Inserting sample API Keys...');
    const { error: keyErr } = await supabase.from('api_keys').insert([
      { api_id: apiId, user_id: userId, name: 'Production Key', key_hash: 'hash_prod', prefix: 'mf_live', status: 'active', environment: 'live' },
      { api_id: apiId, user_id: userId, name: 'Development Key', key_hash: 'hash_dev', prefix: 'mf_test', status: 'active', environment: 'test' }
    ]);
    if (keyErr) console.error('Key Error:', keyErr.message);
  }

  const { data: allKeys } = await supabase.from('api_keys').select('id');
  const keyId = allKeys[0].id;

  // 4. Ensure Usage Logs exist
  const { data: existingLogs } = await supabase.from('usage_logs').select('id').limit(1);
  if (!existingLogs || existingLogs.length === 0) {
    console.log('Inserting sample Usage Logs...');
    const endpoints = ['/users', '/billing', '/apis', '/keys', '/insights'];
    const logs = [];
    for (let i = 0; i < 100; i++) {
      const isError = Math.random() > 0.9;
      logs.push({
        api_id: apiId,
        api_key_id: keyId,
        user_id: userId,
        endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
        method: Math.random() > 0.3 ? 'GET' : 'POST',
        status_code: isError ? (Math.random() > 0.5 ? 400 : 500) : 200,
        latency_ms: Math.floor(Math.random() * 500) + 50,
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    }
    const { error: logErr } = await supabase.from('usage_logs').insert(logs);
    if (logErr) console.error('Log Error:', logErr.message);
  }

  console.log('Data check/population complete.');
}

populate();
