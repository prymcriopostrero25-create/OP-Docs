export function createAccountLoader(request, lifetime = 60000) {
  const entries = new Map()
  return {
    load(token, refresh = false) {
      const existing = entries.get(token)
      if (existing?.pending || (!refresh && existing?.expires > Date.now())) return existing.promise
      const entry = { pending: true, expires: 0 }
      entry.promise = Promise.resolve().then(() => request(token)).then(users => {
        entry.pending = false
        entry.expires = Date.now() + lifetime
        return users
      }).catch(error => {
        if (entries.get(token) === entry) entries.delete(token)
        throw error
      })
      entries.set(token, entry)
      return entry.promise
    },
    invalidate(token) { entries.delete(token) },
  }
}
