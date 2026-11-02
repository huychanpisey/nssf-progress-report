const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kcqhvsdqscaqvizzuptf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjcWh2c2Rxc2NhcXZpenp1cHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NzAyMjYsImV4cCI6MjEwODU0NjIyNn0.FXfwhCGWqlOmPByVfiut1r4MoaJkkd2Nq5rI9VcrRvQ';

async function run() {
  console.log('Fetching existing rows from nssf_action_plan...');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/nssf_action_plan?select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    const rows = await res.json();
    console.log('Existing action plans in Supabase:', rows.map(r => ({ id: r.id, year: r.year, itemsCount: (r.items || []).length })));

    const plan2026 = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'data/action_plan_2026.json'), 'utf8'));

    const payload = {
      id: 2026,
      year: 2026,
      items: plan2026,
      updated_at: new Date().toISOString()
    };

    console.log('Upserting 2026 plan to Supabase...');
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/nssf_action_plan`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });

    console.log('Upsert status:', upsertRes.status, upsertRes.statusText);
    if (!upsertRes.ok) {
      const err = await upsertRes.text();
      console.error('Upsert error:', err);
    } else {
      console.log('Successfully saved 2026 Action Plan to Supabase!');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
