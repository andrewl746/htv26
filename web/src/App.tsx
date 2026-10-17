import type { CheckResponse } from '@contracts/types'

// TODO: render the screening disclaimer ("screening" in contracts/copy/disclaimers.json) under the
// heading once that file exists; user-facing strings come from contracts/copy, never from code.

/** The address check result, typed from the shared contracts; filled by src/api/client.ts (6.1). */
export type CheckResult = CheckResponse | null

export default function App() {
  return (
    <main>
      <h1>Suplex</h1>
    </main>
  )
}
