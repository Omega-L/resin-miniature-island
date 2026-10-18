import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/** Keeps an optional remote asset (the studio HDR) from taking down the scene. */
export class SilentBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(): void {
    // The procedural lights are a complete fallback; no need to surface this.
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}
