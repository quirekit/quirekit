import { installDocConversionWorker } from './runtime'
import type { ConversionWorkerScope } from './types'

installDocConversionWorker(globalThis as unknown as ConversionWorkerScope)
