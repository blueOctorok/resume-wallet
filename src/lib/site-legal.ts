/**
 * Public legal + A2P footer facts. Carriers scrape these pages during 10DLC review.
 * Keep SMS sentences here so Privacy and Terms cannot drift.
 */
export const SITE_LEGAL = {
  brand: 'Provven',
  url: 'https://provven.com',
  contactEmail: 'support@provven.com',
  /** Carriers like a street address in the footer. Set when you have one. */
  mailingAddress: null as string | null,
} as const

export const SMS_USE_CASE = 'SMS related to your application and the application process'

/** Checkbox / verbal-script language Danny will file with the carriers. */
export const SMS_CONSENT_LANGUAGE = `By providing your phone number, you agree to receive ${SMS_USE_CASE} from ${SITE_LEGAL.brand}. Message frequency may vary. Standard Message and Data Rates may apply. Reply STOP to opt out. Reply HELP for help. We will not sell or share mobile information with third parties for promotional or marketing purposes.`

/** Preferred TCR “we don’t sell mobile info” clause. */
export const SMS_NO_SELL_PREFERRED =
  'We will not share or sell your mobile information or opt-in to an SMS campaign with any third party for purposes unrelated to providing you with the services of that campaign. We may share your Personal Data, including your SMS opt-in or consent status, with third parties that help us provide our messaging services, including but not limited to platform providers, phone companies, and any other vendors who assist us in the delivery of text messages.'
