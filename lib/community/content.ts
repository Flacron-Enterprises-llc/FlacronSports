// Shared validation for user-written community content.

import { createHash } from "node:crypto"
import { ApiError } from "@/lib/api-auth"

export const MAX_MESSAGE_LENGTH = 500

export const MATCH_ID = /^tsdb-\d+$/
export const ROOM_ID = /^[a-f0-9]{24}$/
export const MESSAGE_ID = /^\d{13}-[a-f0-9]{8}$/
export const OPAQUE_REF = /^[a-f0-9]{32}$/
export const FORMER_MEMBER = "Former member"

// Brand names only, and each may be spaced or dotted out. Plain words stay allowed:
// a fan can discuss a "strikeout" or say an official stream was good.
const PIRATE_HOSTS = [
  "streameast", "sportsurge", "crackstreams", "vipleague", "vipbox", "hesgoal", "totalsportek", "rojadirecta",
  "buffstreams", "batmanstream", "stream2watch", "sportlemon", "footybite", "firstrowsports", "methstreams", "weakstreams",
].map((host) => new RegExp(`\\b${host.split("").join("[\\s._-]*")}`))
const STREAM_PROTOCOLS = /\b(acestream|sop|rtmp|rtsp):\/\//
const STREAM_FILES = /\.(m3u8?|mpd)\b/
const FREE_STREAM_HOST = /\b[a-z0-9-]*(?:stream|watch|(?:free|gratis|live)[a-z0-9-]*(?:tv|hd|sport|soccer|football|foot|nba|nfl|ufc))[a-z0-9-]*\.[a-z]{2,}/
const FREE_STREAM_WORDS = /\b(free|gratuit|gratis|live|direct|full match|match complet|hd|streams?|streaming)\b/

/** Undoes the usual spelling tricks, such as "hesgoal [dot] com". */
function unmask(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[​-‏⁠﻿]/g, "")
    .toLowerCase()
    .replace(/\s*(\[\s*\.\s*\]|\(\s*\.\s*\)|\[dot\]|\(dot\)|\bdot\b)\s*/g, ".")
}

export function containsPiratedStreamLink(text: string): boolean {
  const unmasked = unmask(text)
  if (PIRATE_HOSTS.some((host) => host.test(unmasked))) return true
  if (STREAM_PROTOCOLS.test(unmasked) || STREAM_FILES.test(unmasked)) return true
  return FREE_STREAM_HOST.test(unmasked) && FREE_STREAM_WORDS.test(unmasked)
}

export function cleanMessage(raw: unknown): string {
  if (typeof raw !== "string") throw new ApiError(400, "invalid_message", "Write a message")
  const text = raw.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim()
  if (!text) throw new ApiError(400, "invalid_message", "Write a message")
  if ([...text].length > MAX_MESSAGE_LENGTH) throw new ApiError(400, "message_too_long", `Messages are limited to ${MAX_MESSAGE_LENGTH} characters`)
  if (containsPiratedStreamLink(text)) {
    throw new ApiError(422, "stream_link_rejected", "Links to unauthorized streams are not allowed")
  }
  return text
}

/**
 * Never falls back to the account email: it would be shown to other users. An email
 * sign-up has no name, so the fallback carries a short hash to tell two such fans apart.
 */
export function displayNameOf(token: Record<string, unknown>): string {
  const name = typeof token.name === "string" ? token.name.trim().slice(0, 40) : ""
  if (name && !name.includes("@")) return name
  return typeof token.uid === "string" ? `Fan ${opaqueRef("display-name", token.uid).slice(0, 4)}` : "Fan"
}

/** Stands in for a uid in API responses. It differs per context, so refs cannot be linked. */
export function opaqueRef(context: string, uid: string): string {
  return createHash("sha256").update(`${context}:${uid}`).digest("hex").slice(0, 32)
}

export function assertId(value: unknown, pattern: RegExp): string {
  if (typeof value !== "string" || !pattern.test(value)) throw new ApiError(404, "not_found", "Not found")
  return value
}
