// Picks and names the browser's speech voices for the Listen player

export interface VoiceOption {
  uri: string
  label: string
  voice: SpeechSynthesisVoice
}

const PREFERRED = [
  /google uk english female/i,
  /google uk english male/i,
  /google us english/i,
  /microsoft aria/i,
  /microsoft guy/i,
  /microsoft (jenny|ava|andrew|emma|brian|sonia|ryan|libby)/i,
  /^samantha/i,
  /^daniel/i,
]

const REGION: Record<string, string> = {
  GB: "UK",
  AU: "Australia",
  IN: "India",
  IE: "Ireland",
  ZA: "South Africa",
  CA: "Canada",
  NZ: "New Zealand",
}

function score(v: SpeechSynthesisVoice): number {
  const pref = PREFERRED.findIndex((re) => re.test(v.name))
  return (
    (pref >= 0 ? 100 - pref * 5 : 0) +
    (/natural|neural|online/i.test(v.name) ? 10 : 0) +
    (/google/i.test(v.name) ? 6 : 0) +
    (/en[-_](US|GB)/i.test(v.lang) ? 2 : 0)
  )
}

// "Microsoft Aria Online (Natural) - English (United States)" -> "Aria (Natural)"
// "Google UK English Female" -> "Google UK Female", "Daniel" (en-GB) -> "Daniel (UK)"
function labelFor(v: SpeechSynthesisVoice): string {
  const natural = /natural|neural/i.test(v.name)
  if (/^google/i.test(v.name)) return v.name.replace(/\s*English\s*/i, " ").replace(/\s+/g, " ").trim()
  const base = v.name
    .replace(/^microsoft\s+/i, "")
    .replace(/\s+-\s+.*$/, "")
    .replace(/\((natural|neural)\)/gi, "")
    .replace(/\b(online|desktop|compact|enhanced|premium)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
  const region = REGION[v.lang.split(/[-_]/)[1]?.toUpperCase() ?? ""]
  const tag = natural ? "Natural" : region
  return tag ? `${base || v.name} (${tag})` : base || v.name
}

/** English voices first, best-sounding at the top, with readable names. */
export function curateVoices(all: SpeechSynthesisVoice[]): VoiceOption[] {
  const english = all.filter((v) => /^en/i.test(v.lang))
  const pool = (english.length ? english : all).slice().sort((a, b) => score(b) - score(a))
  const seen = new Map<string, number>()
  return pool.map((voice) => {
    let label = labelFor(voice)
    const n = (seen.get(label) ?? 0) + 1
    seen.set(label, n)
    if (n > 1) label = `${label} ${n}`
    return { uri: voice.voiceURI, label, voice }
  })
}
