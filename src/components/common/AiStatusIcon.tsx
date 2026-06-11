import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import type { ReactElement } from 'react'

import type { GenerationRequestStatus } from '@/services/contracts'

import styles from './AiStatusIcon.module.css'

type AiStatusIconProps = {
  status: GenerationRequestStatus
  className?: string
}

export function AiStatusIcon({ status, className }: AiStatusIconProps): ReactElement {
  if (status === 'completed') {
    return <CheckCircle2 className={className} aria-hidden="true" />
  }

  if (status === 'failed') {
    return <XCircle className={className} aria-hidden="true" />
  }

  return <Loader2 className={`${className ?? ''} ${styles.spinning}`.trim()} aria-hidden="true" />
}
