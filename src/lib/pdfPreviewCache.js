// Keep a few prepared PDFs in memory only. Session and record revision are part
// of the key so account changes and edits cannot reuse an older attachment.
export function createPdfPreviewCache(prepare, { ttl = 120000, limit = 5, maxBytes = 24 * 1024 * 1024, now = Date.now } = {}) {
  const entries = new Map()
  let activeSession
  const load = (session, id, type, revision, input) => {
    if (activeSession !== session) { entries.clear(); activeSession = session }
    for (const [key, entry] of entries) {
      if (entry.settled && entry.expires <= now()) entries.delete(key)
    }
    if (!revision) return prepare(id, type, session, input)
    const key = JSON.stringify([session, id, type, revision])
    const existing = entries.get(key)
    if (existing && (existing.settled || !existing.signal?.aborted) && (!existing.settled || existing.expires > now())) {
      entries.delete(key)
      entries.set(key, existing)
      return existing.promise
    }
    entries.delete(key)
    const entry = { expires: now() + ttl, signal: input?.signal }
    entry.promise = Promise.resolve().then(() => prepare(id, type, session, input)).then(result => {
      entry.settled = true
      // Base64 strings may occupy two bytes per character in browser memory.
      entry.bytes = result.size ?? (result.data?.length || 0) * 2
      entry.expires = now() + ttl
      let bytes = [...entries.values()].reduce((sum, value) => sum + (value.bytes || 0), 0)
      for (const [oldKey, value] of entries) {
        if (bytes <= maxBytes) break
        if (value.settled) { entries.delete(oldKey); bytes -= value.bytes }
      }
      return result
    }).catch(error => {
      if (entries.get(key) === entry) entries.delete(key)
      throw error
    })
    entries.set(key, entry)
    while (entries.size > limit) entries.delete(entries.keys().next().value)
    return entry.promise
  }
  load.clear = () => entries.clear()
  return load
}
