import { useEffect, useRef, useState } from 'react'
import VerifyPage from './VerifyPage'
import { scanDocumentCanvas, scanDocumentPdf } from '../lib/documentQr'
import VerificationLayout from './VerificationLayout'

export default function VerifyScanner({ code }) {
  const [selectedCode, setSelectedCode] = useState(code || '')
  const [camera, setCamera] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uploadedPdf, setUploadedPdf] = useState(null)
  const video = useRef(null)
  const uploadAttempt = useRef(0)
  useEffect(() => () => { uploadAttempt.current++ }, [])
  useEffect(() => {
    if (!camera) return
    let active = true, stream, timer
    const canvas = document.createElement('canvas')
    async function scan() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera scanning requires HTTPS and a supported browser. Upload the PDF instead.')
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (!active) { stream.getTracks().forEach(track => track.stop()); return }
        video.current.srcObject = stream
        await video.current.play()
        async function frame() {
          if (!active) return
          try {
            if (video.current?.videoWidth) {
              const factor = Math.min(1, 1280 / video.current.videoWidth)
              canvas.width = Math.round(video.current.videoWidth * factor)
              canvas.height = Math.round(video.current.videoHeight * factor)
              canvas.getContext('2d', { willReadFrequently: true }).drawImage(video.current, 0, 0, canvas.width, canvas.height)
              const found = await scanDocumentCanvas(canvas)
              if (!active) return
              if (found) { setSelectedCode(found); setCamera(false); setError(''); return }
            }
          } catch (failure) { if (active) setError(failure.message) }
          if (active) timer = setTimeout(frame, 300)
        }
        await frame()
      } catch (failure) {
        if (active) { setError(failure.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access or upload the PDF.' : failure.message); setCamera(false) }
      }
    }
    void scan()
    return () => { active = false; clearTimeout(timer); stream?.getTracks().forEach(track => track.stop()); canvas.width = canvas.height = 0 }
  }, [camera])

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const attempt = ++uploadAttempt.current
    setCamera(false); setBusy(true); setError(''); setSelectedCode(''); setUploadedPdf(null)
    try {
      const found = await scanDocumentPdf(file)
      if (attempt === uploadAttempt.current) { setUploadedPdf(file); setSelectedCode(found) }
    } catch (failure) {
      if (attempt === uploadAttempt.current) setError(failure.message || 'Unable to read this PDF.')
    } finally { if (attempt === uploadAttempt.current) setBusy(false) }
  }

  if (selectedCode) return <VerifyPage key={selectedCode} code={selectedCode} uploadedPdf={uploadedPdf} onReset={() => { setSelectedCode(''); setUploadedPdf(null) }} />
  return <VerificationLayout>
    <section className="verify-card" aria-labelledby="verify-method-title">
      <div className="verify-card-heading"><div><h2 id="verify-method-title">Verify an Official Document</h2><p>Choose how you would like to read the verification QR code.</p></div><span className="verify-public-badge">Public Access</span></div>
      <div className="verify-methods">
        <div className="verify-method">
          <span className="verify-method-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><path d="M7 7h3v3H7zm7 0h3v3h-3zM7 14h3v3H7zm7 0h3v3h-3z"/></svg></span>
          <h3>Scan QR code</h3><p>Use your camera to scan the QR code on the first page of your document.</p>
          <button className="verify-button verify-button-primary" type="button" disabled={busy} onClick={() => { setError(''); setCamera(value => !value) }}>{camera ? 'Stop Camera' : 'Open Camera'}</button>
        </div>
        <div className="verify-method">
          <span className="verify-method-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 15l4-4 4 4m-4-4v7"/></svg></span>
          <h3>Upload PDF</h3><p>Select your document to read its unique verification QR code.</p>
          <label className={`verify-file-button${busy ? ' is-disabled' : ''}`}><input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={upload} /><span>{busy ? 'Reading PDF…' : 'Choose PDF file'}</span></label>
        </div>
      </div>
      {camera && <div className="verify-camera-panel"><video ref={video} autoPlay playsInline muted className="verify-camera" aria-label="QR code camera preview" /><p role="status">Point your camera at the document QR code.</p></div>}
      {busy && <p className="verify-notice" role="status">Checking your PDF…</p>}
      {error && <p className="verify-error" role="alert">{error}</p>}
      <div className="verify-privacy"><span aria-hidden="true">ⓘ</span><p>No sign-in required. Your PDF is read on your device and is not uploaded to the server.</p></div>
    </section>
  </VerificationLayout>
}
