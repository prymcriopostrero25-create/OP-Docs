import { useCallback, useEffect, useRef, useState } from 'react'

// Keep each resource for this session; fetch it only when its page needs it.
export function usePageData(enabled, fetchData, version = 0, refreshInterval = 0) {
  const [state, setState] = useState({ data: null, version: -1, error: '' })
  const request = useRef(null)
  useEffect(() => {
    if (!enabled || state.version === version) return
    let current = true
    if (!request.current || request.current.version !== version || request.current.fetchData !== fetchData) {
      request.current = { version, fetchData, promise: fetchData(), updates: [], applied: false, started: Date.now() }
    }
    const pending = request.current
    pending.promise.then(data => {
      if (current) {
        const updates = pending.updates
        pending.updates = []
        pending.applied = true
        setState({ data: updates.reduce((value, update) => typeof update === 'function' ? update(value || []) : update, data), version, error: '' })
      }
    }).catch(error => {
      if (current) {
        pending.applied = true
        pending.updates = []
        setState(previous => ({ ...previous, version, error: error.message }))
      }
    })
    return () => { current = false }
  }, [enabled, fetchData, version, state.version])
  useEffect(() => {
    if (!enabled || !refreshInterval) return
    let current = true
    async function refresh() {
      if (document.visibilityState === 'hidden' || !request.current?.applied || Date.now() - request.current.started < refreshInterval) return
      // Background reads may reuse the server's short-lived shared cache.
      // Manual refreshes still bypass it through the loader's version.
      const pending = { version, fetchData, promise: fetchData(false), updates: [], applied: false, started: Date.now() }
      request.current = pending
      try {
        const data = await pending.promise
        if (current && request.current === pending) {
          setState({ data: pending.updates.reduce((value, update) => typeof update === 'function' ? update(value || []) : update, data), version, error: '' })
        }
      } catch (error) {
        if (current && request.current === pending) setState(previous => ({ ...previous, error: error.message }))
      } finally {
        pending.applied = true
        pending.updates = []
      }
    }
    // Stagger sessions so users opening the page together do not all poll at once.
    const timer = window.setInterval(refresh, refreshInterval + Math.floor(Math.random() * refreshInterval / 3))
    void refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      current = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [enabled, fetchData, version, refreshInterval])
  const setData = useCallback(update => {
    if (request.current && !request.current.applied) request.current.updates.push(update)
    setState(previous => ({ ...previous, data: typeof update === 'function' ? update(previous.data || []) : update }))
  }, [])
  return { data: state.data, setData, loading: enabled && state.version !== version, error: state.version === version ? state.error : '' }
}
