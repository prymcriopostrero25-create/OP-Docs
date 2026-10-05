import { useCallback, useEffect, useRef, useState } from 'react'

// Keep each resource for this session; fetch it only when its page needs it.
export function usePageData(enabled, fetchData, version = 0) {
  const [state, setState] = useState({ data: null, version: -1, error: '' })
  const request = useRef(null)
  useEffect(() => {
    if (!enabled || state.version === version) return
    let current = true
    if (!request.current || request.current.version !== version || request.current.fetchData !== fetchData) {
      request.current = { version, fetchData, promise: fetchData() }
    }
    request.current.promise.then(data => {
      if (current) setState({ data, version, error: '' })
    }).catch(error => {
      if (current) setState(previous => ({ ...previous, version, error: error.message }))
    })
    return () => { current = false }
  }, [enabled, fetchData, version, state.version])
  const setData = useCallback(update => setState(previous => ({ ...previous, data: typeof update === 'function' ? update(previous.data || []) : update })), [])
  return { data: state.data, setData, loading: enabled && state.version !== version, error: state.version === version ? state.error : '' }
}
