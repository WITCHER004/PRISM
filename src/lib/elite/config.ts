// Elite tier configuration. Every money, panel and badge threshold lives here.

/** Elite subscription price and billing period */
export const ELITE_PRICE_USD = 12
export const ELITE_PERIOD_DAYS = 30

/** Writer payout rate: dollars per 1,000 monetized views (RPM) */
export const PAYOUT_RPM_USD = 4
export const PAYOUT_PER_VIEW_USD = PAYOUT_RPM_USD / 1000

/** A reader counts once per article in this rolling window */
export const VIEW_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000

/** Smallest balance a writer can withdraw */
export const MIN_PAYOUT_USD = 1
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
