import { DocReadError, requireDoc } from '../errors'
import { inspectDoc } from '../inspection'
import type { DocWorkerScope } from './types'

/**
 * Installs a source-inspection handler in a dedicated module Worker.
 * @param scope - Worker message port, owned for the lifetime of this task.
 */
export function installDocWorker(scope: DocWorkerScope): void {
  scope.onmessage = (event) => {
    try {
      const request = event.data
      requireDoc(request?.version === 1 && request.type === 'inspect-doc', 'invalid-input', 'Invalid DOC worker request')
      const result = inspectDoc(request.input, request.options)
      scope.postMessage({ version: 1, type: 'result', result })
    } catch (error) {
      scope.postMessage({ version: 1, type: 'error',
        code: error instanceof DocReadError ? error.code : 'worker-failed',
        message: error instanceof Error ? error.message : 'DOC inspection failed' })
    }
  }
}
