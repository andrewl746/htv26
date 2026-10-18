import { Component, type ReactNode } from 'react'

/**
 * Catches a crash in the 3D scene or a map (a lost WebGL context, a driver that refuses a shader)
 * so the rest of the app stays up: the search, the panel and the plan view (MASTERSPEC 6.7).
 */
export class GraphicsBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[suplex] graphics failed, carrying on without them', error)
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
