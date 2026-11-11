// Mock data types for the platform (no backend required for MVP demo)

export type UserRole = "READER" | "WRITER" | "PUBLICATION_EDITOR" | "EMPLOYEE" | "REVIEWER" | "PEER_REVIEWER" | "ADMIN"
export type PostStatus =
  | "DRAFT"
  | "PHASE_1_FAILED"
  | "PENDING_EMPLOYEE_REVIEW"
  | "PENDING_PEER_PANEL"
  | "COUNTER_SUBMITTED"
  | "PUBLISHED"
  | "REJECTED"
  | "SCHEDULED"
  | "ARCHIVED"
export type PaywallTier = "FREE" | "METERED" | "SUBSCRIBER" | "PAID"

export interface User {
  id: string
  username: string
  displayName: string
  bio: string
  avatarUrl: string
  headerImageUrl?: string
  websiteUrl?: string
  twitterHandle?: string
  githubHandle?: string
  linkedinHandle?: string
  instagramHandle?: string
  role: UserRole
  isVerifiedHuman: boolean
  followerCount: number
  followingCount: number
  postCount: number
  createdAt: string
}

export interface Post {
  id: string
  title: string
  subtitle?: string
  slug: string
  excerpt: string
  contentHtml: string
  coverImageUrl?: string
  readingTimeMin: number
  wordCount: number
  status: PostStatus
  paywallTier: PaywallTier
  paywallPrice?: number
  publishedAt: string
  tags: Tag[]
  author: User
  clapCount: number
  commentCount: number
  bookmarkCount: number
  viewCount: number
  trustScore: number
}

export interface Tag {
  id: string
  name: string
  slug: string
  postCount?: number
}

export interface Comment {
  id: string
  author: User
  body: string
  createdAt: string
  replies?: Comment[]
}

// ─── Mock Users ───────────────────────────────────────────────────────────────

export const MOCK_USERS: User[] = [
  {
    id: "u1",
    username: "alexchen",
    displayName: "Alex Chen",
    bio: "Has spent a decade building software, the last five years on payment systems for banks you haven’t heard of. Writes about infrastructure and the people who keep it running.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alexchen&backgroundColor=b6e3f4",
    linkedinHandle: "alexchen-payments",
    githubHandle: "alexchen",
    role: "WRITER",
    isVerifiedHuman: true,
    followerCount: 2840,
    followingCount: 312,
    postCount: 47,
    createdAt: "2023-01-15",
  },
  {
    id: "u2",
    username: "priyarao",
    displayName: "Priya Rao",
    bio: "Type designer and teacher in Bengaluru. Writes about naming, colour, and the slow work of keeping design systems honest.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=priyarao&backgroundColor=d1d4f9",
    instagramHandle: "priya.letterforms",
    twitterHandle: "priyarao_type",
    role: "WRITER",
    isVerifiedHuman: true,
    followerCount: 1520,
    followingCount: 201,
    postCount: 31,
    createdAt: "2023-03-22",
  },
  {
    id: "u3",
    username: "marcuswilliams",
    displayName: "Marcus Williams",
    bio: "Reporter covering technology policy and lobbying in Brussels and Washington. Spent six years on the statehouse beat at a regional paper in Ohio.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=marcuswilliams&backgroundColor=c0aede",
    linkedinHandle: "marcus-williams-policy",
    twitterHandle: "marcuswrites",
    role: "WRITER",
    isVerifiedHuman: true,
    followerCount: 5210,
    followingCount: 89,
    postCount: 88,
    createdAt: "2022-11-08",
  },
  {
    id: "u4",
    username: "sarahkim",
    displayName: "Sarah Kim",
    bio: "Glaciologist. Spends part of each year on the ice and the rest of it explaining what the ice records, and what it doesn’t.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarahkim&backgroundColor=ffd5dc",
    instagramHandle: "sarahkim.onice",
    role: "WRITER",
    isVerifiedHuman: true,
    followerCount: 3480,
    followingCount: 445,
    postCount: 62,
    createdAt: "2023-02-10",
  },
  {
    // Prism staff: works the Phase 2 review queue (sign in as noor@… in demo mode)
    id: "u5",
    username: "noorhaddad",
    displayName: "Noor Haddad",
    bio: "Standards editor at Prism. Reads every story in the review queue before it goes live.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=noorhaddad&backgroundColor=c7e8d6",
    linkedinHandle: "noor-haddad-editor",
    role: "EMPLOYEE",
    isVerifiedHuman: true,
    followerCount: 410,
    followingCount: 120,
    postCount: 0,
    createdAt: "2022-06-01",
  },
]

/** Sample writers (excludes Prism staff accounts) */
export const SAMPLE_WRITERS = MOCK_USERS.filter((u) => u.role === "WRITER")

// ─── Peer panel ───────────────────────────────────────────────────────────────
// Ten outside specialists who vote PASS / FAIL on Elite peer-panel submissions.
// Kept out of MOCK_USERS so they don't appear in writer lists, the sitemap or the feed.

const peer = (n: number, username: string, displayName: string, field: string, bg: string): User => ({
  id: `pr${n}`,
  username,
  displayName,
  bio: `Peer panel reviewer · ${field}.`,
  avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}&backgroundColor=${bg}`,
  role: "PEER_REVIEWER",
  isVerifiedHuman: true,
  followerCount: 0,
  followingCount: 0,
  postCount: 0,
  createdAt: "2024-01-10",
})

export const PEER_REVIEWERS: User[] = [
  peer(1, "drlenaholt", "Dr. Lena Holt", "distributed systems", "dbeafe"),
  peer(2, "ravimenon", "Ravi Menon", "applied statistics", "e0e7ff"),
  peer(3, "ameliaduarte", "Amelia Duarte", "climate science", "d1fae5"),
  peer(4, "kofimensah", "Kofi Mensah", "public policy", "e2e8f0"),
  peer(5, "yukisato", "Yuki Sato", "human–computer interaction", "ede9fe"),
  peer(6, "jonasweber", "Jonas Weber", "security engineering", "dbeafe"),
  peer(7, "fatimazahra", "Fatima Zahra", "linguistics", "e0e7ff"),
  peer(8, "danielokafor", "Daniel Okafor", "economics", "d1fae5"),
  peer(9, "sofiarossi", "Sofia Rossi", "design research", "ede9fe"),
  peer(10, "marktran", "Mark Tran", "data journalism", "e2e8f0"),
]

/** Every account in the demo: writers, staff and the peer panel */
export const ALL_ACCOUNTS: User[] = [...MOCK_USERS, ...PEER_REVIEWERS]

export function findAccount(username: string | null | undefined): User | undefined {
  return username ? ALL_ACCOUNTS.find((u) => u.username === username) : undefined
}

// ─── Mock Tags ────────────────────────────────────────────────────────────────

export const MOCK_TAGS: Tag[] = [
  { id: "t1", name: "Infrastructure", slug: "infrastructure", postCount: 184 },
  { id: "t2", name: "Policy", slug: "policy", postCount: 96 },
  { id: "t3", name: "Design", slug: "design", postCount: 142 },
  { id: "t4", name: "Science", slug: "science", postCount: 121 },
  { id: "t5", name: "Reporting", slug: "reporting", postCount: 77 },
  { id: "t6", name: "Philosophy", slug: "philosophy", postCount: 88 },
  { id: "t7", name: "Climate", slug: "climate", postCount: 64 },
  { id: "t8", name: "Craft", slug: "craft", postCount: 59 },
  { id: "t9", name: "Programming", slug: "programming", postCount: 203 },
  { id: "t10", name: "Culture", slug: "culture", postCount: 91 },
]

// ─── Mock Posts ───────────────────────────────────────────────────────────────

export const MOCK_POSTS: Post[] = [
  {
    id: "p1",
    title: "Two-phase commit, and other promises we can’t keep",
    subtitle: "Notes from five years of moving money between systems that disagree with each other.",
    slug: "hidden-cost-distributed-transactions",
    excerpt: "Distributed transactions look solved on a whiteboard. In production they’re a negotiation between correctness, latency and what the business can tolerate while two ledgers briefly disagree. This is what that negotiation has looked like on the teams I’ve worked with.",
    readingTimeMin: 14,
    wordCount: 3340,
    status: "PUBLISHED",
    paywallTier: "FREE",
    publishedAt: "2024-11-01T08:00:00Z",
    tags: [MOCK_TAGS[0], MOCK_TAGS[8]],
    author: MOCK_USERS[0],
    clapCount: 4821,
    commentCount: 142,
    bookmarkCount: 1203,
    viewCount: 89400,
    trustScore: 96,
    contentHtml: `
      <p>After five years building payment infrastructure at scale, I've watched dozens of engineering teams make the same catastrophic assumption: that distributed transactions are a solved problem. They're not.</p>
      <h2>The Illusion of Atomicity</h2>
      <p>When you add your first microservice, everything feels clean. You have clear boundaries. The fallacy begins when you need to update two things at once across those boundaries.</p>
      <p>The classic example: deducting money from Account A and crediting Account B. In a monolith with a single database, this is trivially atomic. Add a network boundary and you've just entered a world of hurt that no amount of engineering heroism can fully tame.</p>
      <h2>Two-Phase Commit: The Devil You Know</h2>
      <p>2PC works like this: a coordinator asks all participants "can you commit?" and waits for unanimous yes before sending "commit now." The problem isn't the happy path—it's the failure modes. What happens if the coordinator crashes between phase one and phase two? You have participants locked, resources held, and no way to know what to do next. This is called the <em>blocking problem</em>, and it's fundamental to 2PC, not fixable with better implementation.</p>
      <blockquote>The fundamental insight I want to share: eventual consistency isn't a technical compromise. It's a business requirement. Every business I've worked with can tolerate 200ms of inconsistency between systems. None can tolerate transactions that hold locks indefinitely.</blockquote>
      <h2>The Saga Pattern: Choreography vs. Orchestration</h2>
      <p>Sagas break long-running transactions into sequences of local transactions, each publishing an event or message to trigger the next step. Crucially, each step has a compensating transaction—the "undo" operation you run if a later step fails.</p>
      <p>You can implement sagas two ways. With <strong>choreography</strong>, each service publishes events and listens to events from others. There's no central coordinator. This is simpler for small flows but gets chaotic as complexity grows—you end up with distributed spaghetti that's nearly impossible to trace. With <strong>orchestration</strong>, a central saga orchestrator tells each participant what to do and tracks state. It's more complex upfront but dramatically easier to debug and monitor.</p>
      <h2>What I Actually Use in Production</h2>
      <p>At the payments company where I spent the longest, we landed on a pragmatic blend: orchestrated sagas for complex multi-step flows (like our payout pipeline), and event-driven choreography for simpler, fire-and-forget notifications. The key insight is treating each as a deliberate architectural choice, not a default.</p>
      <p>The infrastructure that makes this work: idempotency keys on every mutation, dead-letter queues with human-readable failure payloads, and a saga state machine persisted in Postgres (not in-memory, ever).</p>
    `,
  },
  {
    id: "p2",
    title: "A naming system for colour, after three failed attempts",
    subtitle: "Why our design tokens kept drifting away from the code, and the dull structure that finally held.",
    slug: "design-tokens-semantic-layer-figma-code",
    excerpt: "Every design system I’ve worked on has eventually grown forty-seven slightly different greys. The fix wasn’t a better palette. It was agreeing on what the names mean before arguing about the values.",
    coverImageUrl: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200&q=80",
    readingTimeMin: 9,
    wordCount: 2140,
    status: "PUBLISHED",
    paywallTier: "FREE",
    publishedAt: "2024-10-28T10:30:00Z",
    tags: [MOCK_TAGS[2], MOCK_TAGS[7]],
    author: MOCK_USERS[1],
    clapCount: 2934,
    commentCount: 87,
    bookmarkCount: 891,
    viewCount: 54200,
    trustScore: 92,
    contentHtml: `
      <p>Design systems fail at the handoff. Designers export a color palette, developers implement it slightly differently, and six months later you have 47 slightly different grays in production.</p>
      <h2>Primitive Tokens vs. Semantic Tokens</h2>
      <p>Most teams stop at primitive tokens: <code>--blue-500: #3b82f6</code>. This is the foundation but not the structure. <strong>Semantic tokens</strong> map meaning to primitives: <code>--color-action-primary: var(--blue-500)</code>. The semantic token carries intent; the primitive carries the value.</p>
      <p>Why does this matter? When you rebrand (and you will rebrand), semantic tokens let you change <code>--blue-500</code> once and have it propagate everywhere correctly. Without semantics, you're hunting through thousands of hardcoded values.</p>
      <h2>The Three-Layer Model</h2>
      <p>The model we landed on has three layers:</p>
      <ol>
        <li><strong>Global (Primitives)</strong>: Raw values. Every possible color, space, and type size the brand allows. These never appear directly in components.</li>
        <li><strong>Alias (Semantic)</strong>: Named by role. <code>surface-primary</code>, <code>text-muted</code>, <code>border-interactive</code>. These reference globals and can be themed (light/dark).</li>
        <li><strong>Component</strong>: Scoped overrides. A button's specific token that references the alias layer. Rarely needed.</li>
      </ol>
      <h2>Figma Variables + Style Dictionary</h2>
      <p>The breakthrough for our team was adopting Figma Variables for the design side and Style Dictionary for the code side, with a single JSON source of truth synced between them via a custom GitHub Action. Designers work in Figma, push a change, and within minutes a PR is opened with the updated CSS custom properties, Tailwind config, and TypeScript type definitions.</p>
    `,
  },
  {
    id: "p3",
    title: "The lobbyists in the drafting room",
    subtitle: "Eighteen months of disclosures, meeting calendars and interviews show how the largest AI labs shaped Europe’s new rules.",
    slug: "regulatory-capture-ai-big-tech-rules",
    excerpt: "I read 340 pages of lobbying disclosures, compared successive drafts of the legislation line by line, and spoke to twenty-three current and former officials. The pattern is consistent: the definitions that matter most were written with industry in the room.",
    readingTimeMin: 22,
    wordCount: 5240,
    status: "PUBLISHED",
    paywallTier: "METERED",
    publishedAt: "2024-10-25T09:00:00Z",
    tags: [MOCK_TAGS[4], MOCK_TAGS[1]],
    author: MOCK_USERS[2],
    clapCount: 8102,
    commentCount: 312,
    bookmarkCount: 2140,
    viewCount: 143000,
    trustScore: 98,
    contentHtml: `
      <p>In the twelve months since the EU AI Act passed, I've obtained 340 pages of lobbying disclosures, interviewed 23 current and former regulators, and mapped the flow of 'technical expertise' from corporate AI labs into the policy process.</p>
      <h2>The 'Technical Capacity' Loophole</h2>
      <p>Every major AI regulation effort in the US and EU has grappled with the same problem: governments don't have the technical staff to evaluate AI systems independently. This creates a dependency on industry expertise that's nearly impossible to escape.</p>
      <p>What I found in the disclosure documents is that this dependency is actively cultivated, not merely tolerated. Three of the largest AI companies have funded 'policy fellowships' that place their alumni directly in regulatory bodies—with a 12-month cooling-off period that critics say is insufficient.</p>
      <blockquote>"The revolving door problem in AI policy isn't new, but the velocity is unprecedented. We're talking about people who write the safety benchmarks, then go regulate based on those same benchmarks, then return to the labs that set those benchmarks." — Former FTC staffer, speaking anonymously</blockquote>
      <h2>The Compliance-as-Moat Strategy</h2>
      <p>The pattern becomes clear when you read the proposed regulations alongside the lobbying asks. Smaller AI companies and open-source projects have repeatedly flagged that compliance requirements—detailed risk assessments, third-party audits, incident reporting infrastructure—are calibrated in a way that large incumbents can absorb but startups cannot.</p>
    `,
  },
  {
    id: "p4",
    title: "What the ice remembers",
    subtitle: "Two weeks with the Dome C cores, and what 800,000 years of trapped air can and can’t tell us about the next thirty.",
    slug: "arctic-ice-core-climate-models-reality",
    excerpt: "The air bubbles sealed in Antarctic ice are the most direct record we have of the planet’s past atmosphere. Reading them is slow, careful work, and the results are more alarming and more nuanced than the headlines that follow them.",
    coverImageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80",
    readingTimeMin: 17,
    wordCount: 4050,
    status: "PUBLISHED",
    paywallTier: "FREE",
    publishedAt: "2024-10-22T11:00:00Z",
    tags: [MOCK_TAGS[3], MOCK_TAGS[6]],
    author: MOCK_USERS[3],
    clapCount: 5678,
    commentCount: 203,
    bookmarkCount: 1567,
    viewCount: 98100,
    trustScore: 99,
    contentHtml: `
      <p>I spent two weeks at the British Antarctic Survey reviewing the EPICA Dome C dataset—800,000 years of climate history locked in Antarctic ice. The data is both more alarming and more nuanced than the headlines suggest.</p>
      <h2>How Ice Cores Work</h2>
      <p>When snow falls and compresses into ice over millennia, it traps tiny air bubbles—time capsules containing the actual atmosphere of the past. By drilling cores and analyzing these bubbles, we can measure ancient CO₂, methane, and other greenhouse gas concentrations with extraordinary precision.</p>
      <p>The EPICA Dome C core goes back 800,000 years and eight full glacial cycles. It's the longest continuous climate record we have, and it tells a clear story: for 800 millennia, atmospheric CO₂ oscillated between roughly 180 ppm (glacial maximums) and 280 ppm (interglacial peaks). Until about 1850.</p>
      <h2>The Vertical Red Line</h2>
      <p>If you plot 800,000 years of CO₂ concentration and extend to the present day, you see a gentle oscillation—and then, at the far right of the chart, a vertical red line that shoots to 421 ppm in roughly 150 years. No gradual transition. No analogous period in the record. Just a cliff.</p>
      <blockquote>The speed of current change is the most scientifically significant aspect of our situation, and it's consistently underemphasized in public discourse. The climate has changed dramatically in the past. It has never changed this fast. The difference matters enormously for ecosystem adaptation.</blockquote>
      <h2>What the Models Get Wrong</h2>
      <p>This is where my analysis gets more complex. Current IPCC models, I believe, systematically underestimate ice sheet instability under rapid forcing scenarios. The models were calibrated against gradual change; we're in a regime with no paleoclimate analog.</p>
    `,
  },
  {
    id: "p5",
    title: "Against the feed",
    subtitle: "A recommendation system is a decision about what a product is for, not an engineering problem waiting for a better model.",
    slug: "rethinking-feed-algorithmic-discovery-product-problem",
    excerpt: "Every platform eventually has the same meeting: the feed feels worse and nobody can say why. The answer usually isn’t in the model. It’s in what the system was asked to optimise in the first place.",
    readingTimeMin: 11,
    wordCount: 2620,
    status: "PUBLISHED",
    paywallTier: "FREE",
    publishedAt: "2024-10-19T14:00:00Z",
    tags: [MOCK_TAGS[9], MOCK_TAGS[5]],
    author: MOCK_USERS[1],
    clapCount: 3445,
    commentCount: 119,
    bookmarkCount: 1032,
    viewCount: 67800,
    trustScore: 94,
    contentHtml: `
      <p>Every major platform has the same conversation: 'our algorithm isn't working.' They build ML teams, run A/B tests, tune engagement signals. And yet the feed keeps feeling worse.</p>
      <h2>The Metric Trap</h2>
      <p>The problem isn't the algorithm. It's the objective function. When you optimize for clicks, time-on-site, or scroll velocity, you're optimizing for the nervous system's response to novelty and outrage—not for value delivered to the user.</p>
      <p>The best feeds I've studied—Hacker News, early Twitter, curated newsletters—don't optimize for engagement metrics at all. They optimize for <em>regret minimization</em>: readers who look back and feel their time was well spent. This is vastly harder to measure but vastly more aligned with actual user value.</p>
      <h2>Social Graphs vs. Interest Graphs</h2>
      <p>Most feeds conflate two fundamentally different signals: your social graph (who you follow) and your interest graph (what you actually care about). They're correlated but not identical. I follow people I respect professionally who write about topics I'm not interested in. A good feed distinguishes between them.</p>
    `,
  },
  {
    id: "p6",
    title: "Software that outlives its authors",
    subtitle: "What I’ve learned maintaining systems older than some of my colleagues.",
    slug: "building-software-that-lasts-20-years",
    excerpt: "The code that’s hardest to delete is the code written without any thought of deleting it. After years with production systems, I think longevity comes down to the decisions you choose not to make.",
    readingTimeMin: 13,
    wordCount: 3100,
    status: "PUBLISHED",
    paywallTier: "FREE",
    publishedAt: "2024-10-15T07:00:00Z",
    tags: [MOCK_TAGS[8], MOCK_TAGS[7]],
    author: MOCK_USERS[0],
    clapCount: 6234,
    commentCount: 278,
    bookmarkCount: 2891,
    viewCount: 112000,
    trustScore: 97,
    contentHtml: `
      <p>The software that's hardest to delete is the software built without thought of deletion. After 20 years of building and maintaining production systems, I've come to believe that longevity is mostly about discipline in the decisions you don't make.</p>
      <h2>Boring Technology Wins</h2>
      <p>The best production systems I've worked with are boring in exactly the right ways. Postgres, not a distributed NoSQL database. HTTP, not a proprietary RPC. JSON, not a binary protocol (until you measure and prove you need it). The maintenance cost of clever technology compounds over years in ways that are invisible at adoption time.</p>
      <h2>The Chesterton's Fence Rule</h2>
      <p>Chesterton observed that before removing a fence, you should understand why it was built. In software: before removing a check, a constraint, or an abstraction that seems unnecessary, understand why it exists. The most expensive production incidents I've witnessed came from removing "unnecessary" defensive code that was actually load-bearing.</p>
      <blockquote>Write code for the engineer who has to debug it at 3am with no context. That engineer is you, six months from now, with a pager going off.</blockquote>
    `,
  },
]

// ─── Mock Comments ────────────────────────────────────────────────────────────

export const MOCK_COMMENTS: Comment[] = [
  {
    id: "c1",
    author: MOCK_USERS[1],
    body: "This is exactly the kind of analysis that's missing from most distributed systems writing. The point about business requirements driving consistency models hit hard — I've been in so many meetings where this gets treated as a purely technical decision.",
    createdAt: "2024-11-01T12:00:00Z",
    replies: [
      {
        id: "c1r1",
        author: MOCK_USERS[0],
        body: "Thanks Priya — the business alignment piece is something I wish I'd understood earlier in my career. The best architecture decision I ever made was asking a product manager 'what's the actual cost to the business if these two systems are out of sync for 5 seconds?' The answer completely changed what we built.",
        createdAt: "2024-11-01T13:30:00Z",
      }
    ]
  },
  {
    id: "c2",
    author: MOCK_USERS[3],
    body: "The section on saga orchestration vs choreography is the clearest explanation I've read. One thing I'd add: the debugging story for orchestrated sagas is dramatically better in practice. When something goes wrong in a choreographed saga at 2am, finding the root cause across 8 services is brutal.",
    createdAt: "2024-11-01T14:45:00Z",
    replies: []
  },
  {
    id: "c3",
    author: MOCK_USERS[2],
    body: "I’ve covered infrastructure for eight years and this matches what engineers at several large payment companies have told me off the record. The gap between what engineering blogs publish and what actually runs in production is enormous.",
    createdAt: "2024-11-01T16:00:00Z",
    replies: []
  },
]

