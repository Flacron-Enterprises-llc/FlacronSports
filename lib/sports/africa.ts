import type { SportEvent } from "./types"

// Names as the sports data writes them, with the common alternatives.
export const AFRICAN_NATIONS = [
  "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cameroon", "Cape Verde", "Central African Republic", "Chad", "Comoros", "Congo", "DR Congo",
  "Djibouti", "Egypt", "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Ivory Coast", "Kenya", "Lesotho",
  "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", "Sao Tome and Principe",
  "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe",
]

const ALSO = ["Cote d'Ivoire", "Côte d'Ivoire", "Democratic Republic of Congo", "Republic of Congo", "Swaziland", "The Gambia"]
const DEMONYMS = [
  "Algerian", "Angolan", "Beninese", "Botswanan", "Burkinabe", "Burundian", "Cameroonian", "Congolese", "Egyptian", "Ethiopian", "Gabonese", "Gambian", "Ghanaian", "Guinean",
  "Ivorian", "Kenyan", "Liberian", "Libyan", "Malawian", "Malian", "Mauritanian", "Moroccan", "Mozambican", "Namibian", "Nigerian", "Rwandan", "Senegalese", "South African",
  "Sudanese", "Tanzanian", "Togolese", "Tunisian", "Ugandan", "Zambian", "Zimbabwean",
]

const COUNTRIES = new Set([...AFRICAN_NATIONS, ...ALSO].map((name) => name.toLowerCase()))
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const names = [...AFRICAN_NATIONS, ...ALSO].sort((a, b) => b.length - a.length).map(escape).join("|")

const CONTINENTAL = /^CAF\b|\bAfrica(?:n)? (?:Cup|Nations|Champions|Football|Games)|\bAFCON\b|\bCOSAFA\b|\bCECAFA\b|\bWAFU\b/i
const DOMESTIC = new RegExp(`^(?:${[...DEMONYMS.map(escape), names].join("|")})(?![\\w-])`, "i")
// The source files a continental competition under one country, so a host country proves nothing.
const OTHER_CONTINENT = /^(?:UEFA|AFC|CONCACAF|CONMEBOL|OFC)\b/i
const NATIONAL_TEAM = new RegExp(`^(?:${names})(?: (?:U-?\\d{2}|Women|Basketball|Rugby|Cricket|Volleyball|Hockey))*$`, "i")

export function isAfricanCompetition(name: string, country?: string | null): boolean {
  if (OTHER_CONTINENT.test(name)) return false
  return CONTINENTAL.test(name) || DOMESTIC.test(name) || COUNTRIES.has((country ?? "").toLowerCase())
}

export const isAfricanNationalTeam = (name: string): boolean => NATIONAL_TEAM.test(name.trim())

export function isAfricanEvent(event: SportEvent): boolean {
  if (isAfricanCompetition(event.competition.name, event.competition.country)) return true
  return event.participantType === "team" && event.participants.some((participant) => isAfricanNationalTeam(participant.name))
}
