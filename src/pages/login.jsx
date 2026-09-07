import { useState } from 'react'
import '../App.css'
import { authenticateUser } from '../lib/appsScriptApi'

const INSTITUTIONAL_EMAIL_PATTERN = /^[^\s@]+@jhcsc\.edu\.ph$/i

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')

    if (!email.trim() || !password) {
      setStatus('error')
      setMessage('Enter your work email and password.')
      return
    }

    if (!INSTITUTIONAL_EMAIL_PATTERN.test(email.trim())) {
      setStatus('error')
      setMessage('Use your institutional email ending in @jhcsc.edu.ph.')
      return
    }

    setStatus('loading')

    try {
      const account = await authenticateUser(email.trim(), password)
      setStatus('success')
      onLogin(account)
    } catch (error) {
      setStatus('error')
      setMessage(error.message || 'Unable to sign in. Please try again.')
    }
  }

  return (
    <main className="portal">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Office of the School President home">
          <img className="wordmark-logo" src="/jhcsclogo.png" alt="" />
          <span className="wordmark-copy">
            <strong>J.H. Cerilles State College</strong>
            <small>Office of the President</small>
          </span>
        </a>
        <div className="topbar-meta">
          <span className="system-status"><i /> All systems operational</span>
          <span className="division">Document management portal</span>
        </div>
      </header>

      <section className="portal-body">
        <div className="intro">
          <p className="section-label"><span /> Official records workspace</p>
          <h1>Governance,<br /><em>made seamless.</em></h1>
          <p className="intro-copy">
            Create, archive, and monitor official documents through one secure workspace for the Office of the School President.
          </p>
          <ul className="capabilities" aria-label="Portal capabilities">
            <li><span aria-hidden="true">01</span><div><strong>Create</strong><small>Prepare and register official documents</small></div></li>
            <li><span aria-hidden="true">02</span><div><strong>Archive</strong><small>Organize records for secure retrieval</small></div></li>
            <li><span aria-hidden="true">03</span><div><strong>Monitor</strong><small>Track document status and movement</small></div></li>
          </ul>
          <div className="trust-line">
            <span className="shield" aria-hidden="true">✓</span>
            <p><strong>Controlled records access</strong><br />Authorized office personnel only.</p>
          </div>
        </div>

        <div className="login-panel">
          <div className="panel-glow" aria-hidden="true" />
          <div className="login-card">
            <div className="card-topline">
              <span>Secure employee access</span>
              <span className="restricted"><i /> Restricted</span>
            </div>

            <div className="card-heading">
              <div className="mini-seal"><img src="/jhcsclogo.png" alt="" /></div>
              <div>
                <h2>Welcome back</h2>
                <p>Sign in to your institutional workspace.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="email">Work email</label>
                <input id="email" name="email" type="email" autoComplete="username"
                  placeholder="you@jhcsc.edu.ph" pattern="[^\s@]+@jhcsc\.edu\.ph$"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-describedby={message ? 'form-message' : undefined} />
              </div>

              <div className="field">
                <div className="label-row">
                  <label htmlFor="password">Password</label>
                  <a href="mailto:it@school.edu?subject=Password%20reset">Reset password</a>
                </div>
                <div className="password-field">
                  <input id="password" name="password"
                    type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                    placeholder="Enter your password" value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-describedby={message ? 'form-message' : undefined} />
                  <button className="visibility-button" type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}>
                    <span className={showPassword ? 'eye eye-open' : 'eye'} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {message && <p id="form-message" className="form-message" role="alert">{message}</p>}

              <button className="submit-button" type="submit" disabled={status === 'loading'}>
                {status === 'loading' && <span className="spinner" aria-hidden="true" />}
                {status === 'loading' ? 'Verifying account...' : 'Access document portal'}
                {status !== 'loading' && <span className="button-arrow" aria-hidden="true">→</span>}
              </button>
            </form>

            <p className="support-note">
              Sign in with your authorized institutional account.
            </p>
          </div>
          <div className="security-strip">
            <span><i className="lock-icon" /> 256-bit encrypted session</span>
            <span>JHCSC · OP-DMS</span>
          </div>
        </div>
      </section>

      <footer className="portal-footer">
        <span>© 2026 Office of the President</span>
        <nav aria-label="Legal">
          <a href="mailto:security@school.edu">Security</a>
          <span>Acceptable use</span>
          <span>Privacy</span>
        </nav>
      </footer>
    </main>
  )
}
