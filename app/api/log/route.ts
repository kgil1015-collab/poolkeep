import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { calculateRecommendations } from '@/lib/recommendations'

export const runtime = 'nodejs'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { testInput, poolId, volumeGallons } = await req.json()

  console.log('[/api/log] user:', user.id, 'poolId:', poolId, 'volumeGallons:', volumeGallons)
  console.log('[/api/log] testInput:', JSON.stringify(testInput))

  if (!poolId || !volumeGallons) {
    return NextResponse.json({ error: 'Missing pool info' }, { status: 400 })
  }

  const result = calculateRecommendations(testInput, volumeGallons)
  console.log('[/api/log] health_score:', result.health_score, 'actions:', result.action.length, 'monitors:', result.monitor.length)

  const { error } = await adminClient.from('test_results').insert({
    pool_id: poolId,
    user_id: user.id,
    ...testInput,
    health_score: result.health_score,
    recommendations: result,
  })

  if (error) {
    console.log('[/api/log] insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, health_score: result.health_score })
}
