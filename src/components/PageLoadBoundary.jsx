import { Component } from 'react'

export default class PageLoadBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="dashboard-content"><div className="page-load-error" role="alert"><h1>Unable to open this page</h1><p>A page component could not load. Reload to get the latest version of the app.</p><button type="button" className="primary-action" onClick={() => window.location.reload()}>Reload page</button></div></main>
    return this.props.children
  }
}
