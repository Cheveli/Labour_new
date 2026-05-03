
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkProjects() {
  const { data, error } = await supabase.from('projects').select('*').limit(5)
  console.log(JSON.stringify(data, null, 2))
}

checkProjects()
