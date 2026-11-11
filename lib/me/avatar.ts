import { ApiError } from "@/lib/api-auth"

/** Profile photos are small: clients resize to at most 512 px before upload. */
export const AVATAR_MAX_BYTES = 400 * 1024
export const AVATAR_COLLECTION = "user_avatars"

export type AvatarType = "image/jpeg" | "image/png" | "image/webp"

export interface StoredAvatar {
  uid: string
  contentType: AvatarType
  data: Buffer
  bytes: number
  updatedAtUTC: string
}

/** The file's own signature decides its type, never the name or the declared type alone. */
export function sniffImage(data: Uint8Array): AvatarType | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg"
  if (data.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => data[i] === byte)) return "image/png"
  if (
    data.length >= 12 &&
    String.fromCharCode(...data.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...data.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp"
  }
  return null
}

/** Validates an upload body `{ image: base64 }` and returns the decoded image. */
export function parseAvatarUpload(body: unknown): { data: Buffer; contentType: AvatarType } {
  const image = body && typeof body === "object" ? (body as { image?: unknown }).image : undefined
  if (typeof image !== "string" || image.length === 0) throw new ApiError(400, "invalid_request", "Choose an image to upload")
  const base64 = image.replace(/^data:image\/[a-z]+;base64,/i, "")
  // Base64 inflates by 4/3; refuse oversized bodies before decoding them.
  if (base64.length > Math.ceil((AVATAR_MAX_BYTES * 4) / 3) + 4) throw new ApiError(413, "image_too_large", "The image is too large. Use one under 400 KB.")
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new ApiError(400, "invalid_image", "The image could not be read")
  const data = Buffer.from(base64, "base64")
  if (data.length === 0) throw new ApiError(400, "invalid_image", "The image could not be read")
  if (data.length > AVATAR_MAX_BYTES) throw new ApiError(413, "image_too_large", "The image is too large. Use one under 400 KB.")
  const contentType = sniffImage(data)
  if (!contentType) throw new ApiError(415, "unsupported_image", "Use a JPEG, PNG or WebP image")
  return { data, contentType }
}

/** Public address of a member's photo. The version busts caches after a change. */
export function avatarUrl(base: string, uid: string, version: number): string {
  return `${base.replace(/\/$/, "")}/api/avatar/${encodeURIComponent(uid)}?v=${version}`
}

/** Firebase uids are 1-128 characters of letters, digits and a few symbols. */
export const isUid = (value: string): boolean => /^[A-Za-z0-9_-]{1,128}$/.test(value)
