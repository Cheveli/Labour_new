import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  
  // Get the public URL for the PDF in the 'receipts' bucket
  const { data: { publicUrl } } = supabase.storage
    .from('receipts')
    .getPublicUrl(`${id}.pdf`)

  // Redirect to the actual Supabase storage URL
  // This hides the Supabase URL from the initially shared link
  if (publicUrl) {
    redirect(publicUrl)
  }

  return new Response('Receipt not found', { status: 404 })
}
