import { installDocWorker } from './runtime'
import type { DocWorkerScope } from './types'

installDocWorker(globalThis as unknown as DocWorkerScope)
