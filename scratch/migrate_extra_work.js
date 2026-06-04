const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MIGRATIONS = [
  {
    name: 'Gopal',
    mobile: '',
    work_nature: 'Labour Contractor',
    total_amount: 19800,
    date: '2026-03-08',
    notes: JSON.stringify({
      description: 'Migrated from Extra Work',
      work_entries: [
        { id: 'ew-1', work_name: 'Gophal lifting (Narapally)', amount: 5400, date: '2026-03-08', notes: 'Kamkara lifting' },
        { id: 'ew-2', work_name: 'GOPAL (Narapally)', amount: 5400, date: '2026-03-26', notes: 'LIFTING' },
        { id: 'ew-3', work_name: 'gopal workers (Cheveli)', amount: 9000, date: '2026-05-09', notes: '' }
      ]
    }),
    installments: [],
    total_paid: 0,
    current_receipt: 0
  },
  {
    name: 'JCB Ganesh',
    mobile: '',
    work_nature: 'JCB / Excavation',
    total_amount: 22000,
    date: '2026-05-05',
    notes: JSON.stringify({
      description: 'Migrated from Extra Work',
      work_entries: [
        { id: 'ew-4', work_name: 'Jcb Ganesh (Cheveli)', amount: 16500, date: '2026-05-05', notes: '2 payments' },
        { id: 'ew-5', work_name: 'JCB Ganesh (Cheveli)', amount: 5500, date: '2026-05-13', notes: '' }
      ]
    }),
    installments: [],
    total_paid: 0,
    current_receipt: 0
  },
  {
    name: 'Adda Labours',
    mobile: '',
    work_nature: 'Labour Contractor',
    total_amount: 4000,
    date: '2026-05-06',
    notes: JSON.stringify({
      description: 'Migrated from Extra Work',
      work_entries: [
        { id: 'ew-6', work_name: 'adda Labours (Cheveli)', amount: 4000, date: '2026-05-06', notes: '' }
      ]
    }),
    installments: [],
    total_paid: 0,
    current_receipt: 0
  }
];

async function run() {
  console.log("Starting data migration...");
  for (const item of MIGRATIONS) {
    // Check if already migrated/exists to avoid duplication
    const { data: existing } = await supabase
      .from('contractor_payments')
      .select('id')
      .eq('name', item.name)
      .eq('work_nature', item.work_nature);

    if (existing && existing.length > 0) {
      console.log(`Subcontractor "${item.name}" already exists in contractor_payments, skipping.`);
    } else {
      const { data, error } = await supabase
        .from('contractor_payments')
        .insert([item])
        .select();
      if (error) {
        console.error(`Error migrating "${item.name}":`, error.message);
      } else {
        console.log(`Migrated subcontractor "${item.name}" successfully! ID:`, data[0].id);
      }
    }
  }
  console.log("Migration finished.");
}

run();
