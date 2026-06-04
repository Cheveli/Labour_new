const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Checking contractor_payments columns...");
  const { data: cols1, error: err1 } = await supabase.rpc('get_table_columns', { table_name: 'contractor_payments' });
  if (err1) {
    // Fallback: fetch 1 row to see keys
    const { data: row1 } = await supabase.from('contractor_payments').select('*').limit(1);
    console.log("contractor_payments sample row keys:", row1 ? Object.keys(row1[0] || {}) : "No rows");
    if (row1 && row1.length > 0) console.log("Sample:", row1[0]);
  } else {
    console.log("Columns:", cols1);
  }

  console.log("\nChecking extra_work columns...");
  const { data: row2 } = await supabase.from('extra_work').select('*').limit(1);
  console.log("extra_work sample row keys:", row2 ? Object.keys(row2[0] || {}) : "No rows");
  if (row2 && row2.length > 0) console.log("Sample:", row2[0]);
}

run();
