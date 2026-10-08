import './Verification.css'

export default function VerificationLayout({ children }) {
  return <div className="verify-shell">
    <header className="verify-header">
      <a className="verify-brand" href={window.location.pathname}>
        <img src="/jhcsclogo.png" alt="JHCSC seal" />
        <span><strong>J.H. Cerilles State College</strong><small>Office of the President</small></span>
      </a>
      <span className="verify-header-label">Document Management System</span>
    </header>
    <main className="verify-main">
      <div className="verify-heading">
        <p className="verify-eyebrow">
          Official Records
        </p>
        <h1>
          Document Verification
        </h1>
        <p>
          Check a document’s registration with the Office of the President.
        </p>
      </div>
      {children}
      <a className="verify-back" href={window.location.pathname}><span aria-hidden="true">←</span> Return to portal</a>
    </main>
    <footer className="verify-footer"><span>JHCSC · Office of the President</span><span>Public document verification</span></footer>
  </div>
}
