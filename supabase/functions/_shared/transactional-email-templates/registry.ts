/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as adminNotification } from './admin-notification.tsx'
import { template as newBlogPost } from './new-blog-post.tsx'
import { template as adOutreach } from './ad-outreach.tsx'
import { template as adSubmissionConfirmation } from './ad-submission-confirmation.tsx'
import { template as subscriptionCanceled } from './subscription-canceled.tsx'
import { template as inviteMusicians } from './invite-musicians.tsx'
import { template as coffeeTipThanks } from './coffee-tip-thanks.tsx'
import { template as coffeeTipReceived } from './coffee-tip-received.tsx'
import { template as paymentFailed } from './payment-failed.tsx'
import { template as subscriptionReceipt } from './subscription-receipt.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'admin-notification': adminNotification,
  'new-blog-post': newBlogPost,
  'ad-outreach': adOutreach,
  'ad-submission-confirmation': adSubmissionConfirmation,
  'subscription-canceled': subscriptionCanceled,
  'invite-musicians': inviteMusicians,
  'coffee-tip-thanks': coffeeTipThanks,
  'coffee-tip-received': coffeeTipReceived,
  'payment-failed': paymentFailed,
  'subscription-receipt': subscriptionReceipt,
}
