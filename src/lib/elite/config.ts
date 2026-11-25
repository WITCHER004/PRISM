// Elite tier configuration. Every money, panel and badge threshold lives here.

/**
 * Elite is built but not open to the public yet. While this is false nobody is Elite (no checkout,
 * no Elite reading, earnings or review track) and every upgrade button says "Coming soon".
 * Open it by setting NEXT_PUBLIC_ELITE_OPEN=true and redeploying.
 */
export const ELITE_OPEN = process.env.NEXT_PUBLIC_ELITE_OPEN === "true"

/** Elite subscription price and billing period */
/** Prices and payouts are in Indian rupees (₹) */
export const CURRENCY = "INR"
export const CURRENCY_SYMBOL = "₹"
export const ELITE_PRICE_INR = 12
export const ELITE_PERIOD_DAYS = 30

/** Writer payout rate: rupees per 1,000 monetized views (RPM) */
export const PAYOUT_RPM_INR = 4
export const PAYOUT_PER_VIEW_INR = PAYOUT_RPM_INR / 1000

/** A reader counts once per article in this rolling window */
export const VIEW_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000

/** Smallest balance a writer can withdraw */
export const MIN_PAYOUT_INR = 1
/** Demo mode: how long a requested payout stays "processing" before it shows as paid */
export const DEMO_PAYOUT_SETTLE_MS = 60 * 1000

/** Peer panel: members per paper, and PASS votes needed to publish */
export const PANEL_SIZE = 10
export const PANEL_PASS_THRESHOLD = 7

/** Minimum lengths for reviewer and writer explanations */
export const FAILURE_REASON_MIN = 20
export const COUNTER_REASON_MIN = 30
export const CLOSING_NOTE_MIN = 10
export const TEXT_MAX = 2000

/** Badge milestones */
export const TOP_MONETIZED_VIEWS = 1000
export const HUMAN_VERIFIED_ARTICLES = 3
export const HUMAN_VERIFIED_MAX_AI = 5
