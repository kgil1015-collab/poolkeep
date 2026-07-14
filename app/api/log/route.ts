import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { calculateRecommendations } from '@/lib/recommendations'

export const runtime = 'nodejs'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const EDIT_LIMIT = 3
const EDIT_WINDOW_MS = 12 * 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { testInput, poolId, volumeGallons, timeZone } = await req.json()

  console.log('[/api/log] user:', user.id, 'poolId:', poolId, 'volumeGallons:', volumeGallons)
  console.log('[/api/log] testInput:', JSON.stringify(testInput))

  if (!poolId || !volumeGallons) {
    return NextResponse.json({ error: 'Missing pool info' }, { status: 400 })
  }

  // Fetch pool type so recommendations can use salt-pool-specific ranges and advice
  const { data: poolRow } = await adminClient
    .from('pools')
    .select('type')
    .eq('id', poolId)
    .single()
  const poolType: string = poolRow?.type ?? 'inground'

  const result = calculateRecommendations(testInput, volumeGallons, poolType)
  console.log('[/api/log] health_score:', result.health_score, 'actions:', result.action.length, 'monitors:', result.monitor.length)

  const { error } = await adminClient.from('test_results').insert({
    pool_id: poolId,
    user_id: user.id,
    ...testInput,
    health_score: result.health_score,
    recommendations: result,
    logged_timezone: typeof timeZone === 'string' ? timeZone : null,
  })

  if (error) {
    console.log('[/api/log] insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, health_score: result.health_score })
}

// Editing is restricted to a pool's single most recent test — old strip readings
// are no longer trustworthy after a few minutes, so this is for fixing a fresh
// misread, not rewriting history. Capped at EDIT_LIMIT edits and EDIT_WINDOW_MS
// after logging, then a new test must be logged instead. Updates the row in
// place (no new insert), so it never touches the free-tier test count.
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { id, testInput, poolId, volumeGallons } = await req.json()

  if (!id || !poolId || !volumeGallons) {
    return NextResponse.json({ error: 'Missing test info' }, { status: 400 })
  }

  const { data: latest } = await adminClient
    .from('test_results')
    .select('id, user_id, created_at, edit_count')
    .eq('pool_id', poolId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!latest || latest.id !== id || latest.user_id !== user.id) {
    return NextResponse.json({ error: 'Only the most recent test can be edited' }, { status: 403 })
  }

  const editCount: number = latest.edit_count ?? 0
  if (editCount >= EDIT_LIMIT) {
    return NextResponse.json({ error: 'This test has reached its edit limit — please log a new test.' }, { status: 403 })
  }
  if (Date.now() - new Date(latest.created_at).getTime() > EDIT_WINDOW_MS) {
    return NextResponse.json({ error: 'This test can no longer be edited — please log a new test.' }, { status: 403 })
  }

  const { data: poolRow } = await adminClient
    .from('pools')
    .select('type')
    .eq('id', poolId)
    .single()
  const poolType: string = poolRow?.type ?? 'inground'

  const result = calculateRecommendations(testInput, volumeGallons, poolType)

  const { error } = await adminClient
    .from('test_results')
    .update({
      ...testInput,
      health_score: result.health_score,
      recommendations: result,
      edit_count: editCount + 1,
    })
    .eq('id', id)

  if (error) {
    console.log('[/api/log] update error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, health_score: result.health_score })
}
