import type { CheckResponse } from '@contracts/types'
import disclaimers from '@contracts/copy/disclaimers.json'
import { checkFits } from './api/fixtures'
import { Scene } from './components/Lot3D/Scene'

/** The address check result, typed from the shared contracts; filled by src/api/client.ts (6.1). */
export type CheckResult = CheckResponse | null

export default function App() {
  const check = checkFits
  return (
    <main className="app">
      <Scene check={check} designId={check.designs[0].design_id} />
      <header className="app-header">
        <h1>Suplex</h1>
        <p>{disclaimers.screening}</p>
      </header>
    </main>
  )
}
