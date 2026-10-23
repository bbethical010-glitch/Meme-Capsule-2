import type { PagesFunction } from '../../_shared/pages'
import type { Env } from '../../_shared/d1r2'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader || authHeader !== `Bearer ${env.ADMIN_API_TOKEN}`) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: any

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    meme_id = null,
    storage_path = null,
    image_url = '',
    category_id = null,
    confidence = null,
    reasoning = '',
    model = '',
    tokens_used = 0,
    processing_ms = 0,
    raw_response = '',
    error = null
  } = body

  /*
   * We support BOTH:
   *   1. meme_id
   *   2. storage_path
   *
   * The Python categoriser normally sends storage_path because
   * R2 knows the storage path but does not know the D1 UUID.
   */

  let meme: any = null

  if (meme_id) {
    meme = await env.DB.prepare(
      'SELECT id, image_url, storage_path FROM memes WHERE id = ?'
    )
      .bind(meme_id)
      .first()
  }

  if (!meme && storage_path) {
    meme = await env.DB.prepare(
      'SELECT id, image_url, storage_path FROM memes WHERE storage_path = ?'
    )
      .bind(storage_path)
      .first()
  }

  if (!meme) {
    return Response.json(
      {
        error: 'Meme not found',
        meme_id,
        storage_path
      },
      { status: 404 }
    )
  }

  const resolvedMemeId = meme.id

  const isNsfwFlag = Boolean(
    body.is_nsfw === 1 ||
    body.is_nsfw === true ||
    body.nsfw === 1 ||
    body.nsfw === true ||
    body.is_toxic === true ||
    body.toxicity_flag === true
  )

  if (isNsfwFlag) {
    await env.DB.prepare(`
      UPDATE memes SET
        ai_category       = ?,
        ai_confidence     = ?,
        ai_reasoning      = ?,
        ai_categorised_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        ai_model          = ?,
        is_nsfw           = 1,
        nsfw_flagged_by   = 'ai-judge'
      WHERE id = ?
    `)
      .bind(
        category_id || null,
        confidence,
        reasoning,
        model,
        resolvedMemeId
      )
      .run()
  } else {
    await env.DB.prepare(`
      UPDATE memes SET
        ai_category       = ?,
        ai_confidence     = ?,
        ai_reasoning      = ?,
        ai_categorised_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        ai_model          = ?
      WHERE id = ?
    `)
      .bind(
        category_id || null,
        confidence,
        reasoning,
        model,
        resolvedMemeId
      )
      .run()
  }

  return Response.json({
    success: true,
    meme_id: resolvedMemeId,
    storage_path: meme.storage_path,
    category: category_id,
    confidence,
    is_nsfw: isNsfwFlag ? 1 : 0
  })
}
