import { describe, expect, it } from "vitest"
import { authErrorField, authErrorKey, isEmail, passwordAccepted, safeNext } from "@/lib/auth-rules"

describe("authErrorKey", () => {
  it.each([
    ["auth/wrong-password", "wrongPassword"],
    ["auth/invalid-credential", "wrongPassword"],
    ["auth/user-not-found", "wrongPassword"],
    ["auth/email-already-in-use", "emailInUse"],
    ["auth/weak-password", "weakPassword"],
    ["auth/too-many-requests", "tooManyAttempts"],
    ["auth/network-request-failed", "network"],
    ["auth/expired-action-code", "expiredLink"],
    ["auth/popup-closed-by-user", "cancelled"],
  ])("maps %s to %s", (code, key) => {
    expect(authErrorKey({ code })).toBe(key)
  })

  it("falls back for anything unknown", () => {
    for (const cause of [undefined, null, "boom", new Error("boom"), { code: 42 }, { code: "auth/internal-error" }, { code: "constructor" }]) {
      expect(authErrorKey(cause)).toBe("failed")
    }
  })

  it("does not tell a wrong password from an unknown account", () => {
    expect(authErrorKey({ code: "auth/user-not-found" })).toBe(authErrorKey({ code: "auth/wrong-password" }))
    expect(authErrorField("wrongPassword")).toBeNull()
  })

  it("ties field problems to their field", () => {
    expect(authErrorField("emailInUse")).toBe("email")
    expect(authErrorField("weakPassword")).toBe("password")
    expect(authErrorField("tooManyAttempts")).toBeNull()
  })
})

describe("auth form rules", () => {
  it("checks email and password shape", () => {
    expect(isEmail(" fan@example.com ")).toBe(true)
    expect(isEmail("fan@example")).toBe(false)
    expect(passwordAccepted("short1")).toBe(false)
    expect(passwordAccepted("onlyletters")).toBe(false)
    expect(passwordAccepted("letters-and-1")).toBe(true)
  })

  it("keeps next inside the dashboard", () => {
    expect(safeNext("/app")).toBe("/app")
    expect(safeNext("/app/scores?sport=nba")).toBe("/app/scores?sport=nba")
    for (const next of [null, "", "/", "/pricing", "/apple", "/app.evil.com", "//evil.com/app", "https://evil.com/app"]) {
      expect(safeNext(next)).toBeNull()
    }
  })
})
