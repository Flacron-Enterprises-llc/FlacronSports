import { describe, expect, it } from "vitest"
import { ApiError } from "@/lib/api-auth"
import { AVATAR_MAX_BYTES, avatarUrl, isUid, parseAvatarUpload, sniffImage } from "@/lib/me/avatar"

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46])
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")])

const codeOf = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    return error instanceof ApiError ? error.code : "other"
  }
  return null
}

describe("profile photo upload", () => {
  it("recognises images by their own signature", () => {
    expect(sniffImage(jpeg)).toBe("image/jpeg")
    expect(sniffImage(png)).toBe("image/png")
    expect(sniffImage(webp)).toBe("image/webp")
    expect(sniffImage(Buffer.from("<svg onload=alert(1)>"))).toBeNull()
  })

  it("accepts base64 with or without a data URL prefix", () => {
    expect(parseAvatarUpload({ image: jpeg.toString("base64") }).contentType).toBe("image/jpeg")
    expect(parseAvatarUpload({ image: `data:image/png;base64,${png.toString("base64")}` }).contentType).toBe("image/png")
  })

  it("refuses missing, malformed, oversized and non-image uploads", () => {
    expect(codeOf(() => parseAvatarUpload(null))).toBe("invalid_request")
    expect(codeOf(() => parseAvatarUpload({ image: "" }))).toBe("invalid_request")
    expect(codeOf(() => parseAvatarUpload({ image: "not base64!" }))).toBe("invalid_image")
    expect(codeOf(() => parseAvatarUpload({ image: Buffer.from("GIF89a....").toString("base64") }))).toBe("unsupported_image")
    const big = Buffer.concat([jpeg, Buffer.alloc(AVATAR_MAX_BYTES)])
    expect(codeOf(() => parseAvatarUpload({ image: big.toString("base64") }))).toBe("image_too_large")
  })

  it("builds a versioned public address and checks uids", () => {
    expect(avatarUrl("https://flacronsport.com/", "abc123", 42)).toBe("https://flacronsport.com/api/avatar/abc123?v=42")
    expect(isUid("Ab_9-x")).toBe(true)
    expect(isUid("../etc")).toBe(false)
    expect(isUid("")).toBe(false)
  })
})
