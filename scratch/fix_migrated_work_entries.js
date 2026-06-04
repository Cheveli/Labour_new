const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Fixing migrated contractor payments notes...");

  // 1. Gopal
  const { data: gopal } = await supabase.from('contractor_payments').select('*').eq('name', 'Gopal').single();
  if (gopal) {
    const notes = {
      description: 'Migrated from Extra Work',
      project_id: '52114420-0c60-4efe-9e76-da03da96db4d', // Default to Narapally
      project_name: 'Narapally labour contract',
      work_entries: [
        { id: 'ew-1', work_name: 'Gophal lifting', amount: 5400, date: '2026-03-08', notes: 'Kamkara lifting', project_id: '52114420-0c60-4efe-9e76-da03da96db4d', project_name: 'Narapally labour contract' },
        { id: 'ew-2', work_name: 'GOPAL', amount: 5400, date: '2026-03-26', notes: 'LIFTING', project_id: '52114420-0c60-4efe-9e76-da03da96db4d', project_name: 'Narapally labour contract' },
        { id: 'ew-3', work_name: 'gopal workers', amount: 9000, date: '2026-05-09', notes: '', project_id: '7475d717-c57d-42fe-81f1-07e860ee7920', project_name: 'Cheveli  Project ' }
      ]
    };
    await supabase.from('contractor_payments').update({ notes: JSON.stringify(notes) }).eq('id', gopal.id);
    console.log("Gopal updated.");
  }

  // 2. JCB Ganesh
  const { data: ganesh } = await supabase.from('contractor_payments').select('*').eq('name', 'JCB Ganesh').single();
  if (ganesh) {
    const notes = {
      description: 'Migrated from Extra Work',
      project_id: '7475d717-c57d-42fe-81f1-07e860ee7920',
      project_name: 'Cheveli  Project ',
      work_entries: [
        { id: 'ew-4', work_name: 'Jcb Ganesh', amount: 16500, date: '2026-05-05', notes: '2 payments', project_id: '7475d717-c57d-42fe-81f1-07e860ee7920', project_name: 'Cheveli  Project ' },
        { id: 'ew-5', work_name: 'JCB Ganesh', amount: 5500, date: '2026-05-13', notes: '', project_id: '7475d717-c57d-42fe-81f1-07e860ee7920', project_name: 'Cheveli  Project ' }
      ]
    };
    await supabase.from('contractor_payments').update({ notes: JSON.stringify(notes) }).eq('id', ganesh.id);
    console.log("JCB Ganesh updated.");
  }

  // 3. Adda Labours
  const { data: adda } = await supabase.from('contractor_payments').select('*').eq('name', 'Adda Labours').single();
  if (adda) {
    const notes = {
      description: 'Migrated from Extra Work',
      project_id: '7475d717-c57d-42fe-81f1-07e860ee7920',
      project_name: 'Cheveli  Project ',
      work_entries: [
        { id: 'ew-6', work_name: 'adda Labours', amount: 4000, date: '2026-05-06', notes: '', project_id: '7475d717-c57d-42fe-81f1-07e860ee7920', project_name: 'Cheveli  Project ' }
      ]
    };
    await supabase.from('contractor_payments').update({ notes: JSON.stringify(notes) }).eq('id', adda.id);
    console.log("Adda Labours updated.");
  }

  console.log("Fix complete.");
}

run();
