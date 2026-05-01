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

async function inspect() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    if (!res.ok) {
      console.error('Failed to fetch schema docs:', res.statusText);
      return;
    }
    const data = await res.json();
    console.log('Available definitions:', Object.keys(data.definitions));
    
    console.log('\nAvailable RPCs (paths):');
    Object.keys(data.paths).filter(p => p.startsWith('/rpc/')).forEach(p => console.log(p));

    // Log columns for each definition
    for (const def in data.definitions) {
      console.log(`\nTable: ${def}`);
      console.log('Columns:', Object.keys(data.definitions[def].properties));
    }
  } catch (err) {
    console.error('Error fetching schema:', err);
  }
}

inspect();
