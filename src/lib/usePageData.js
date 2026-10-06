import { useCallback, useEffect, useRef, useState } from 'react'

// Keep each resource for this session; fetch it only when its page needs it.
export function usePageData(enabled, fetchData, version = 0) {
  const [state, setState] = useState({ data: null, version: -1, error: '' })
  const request = useRef(null)
  useEffect(() => {
    if (!enabled || state.version === version) return
    let current = true
    if (!request.current || request.current.version !== version || request.current.fetchData !== fetchData) {
      request.current = { version, fetchData, promise: fetchData(), updates: [], applied: false }
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
  const setData = useCallback(update => {
    if (request.current && !request.current.applied) request.current.updates.push(update)
    setState(previous => ({ ...previous, data: typeof update === 'function' ? update(previous.data || []) : update }))
  }, [])
  return { data: state.data, setData, loading: enabled && state.version !== version, error: state.version === version ? state.error : '' }
}
