import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

const PAGES = ["/", "/features", "/features/scores-and-fixtures", "/sports", "/pricing", "/faq", "/about", "/contact", "/community-guidelines", "/eula", "/signin", "/signup", "/fr", "/fr/pricing"]

async function dismissConsent(page: Page) {
  const reject = page.getByRole("button", { name: /Reject non-essential|Refuser/ }).first()
  if (await reject.isVisible().catch(() => false)) await reject.click()
}

for (const path of PAGES) {
  test(`${path} renders without overflow or console errors`, async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
    await expect(page.locator("main")).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    expect(errors).toEqual([])
  })
}

for (const path of ["/", "/pricing", "/features", "/sports", "/faq", "/signin", "/community-guidelines"]) {
  test(`${path} has no serious accessibility violations`, async ({ page }, info) => {
    test.skip(info.project.name !== "chrome", "axe results do not vary by engine")
    await page.goto(path)
    await dismissConsent(page)
    await page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((element) => element.classList.add("is-visible")))
    await page.waitForTimeout(900)
    const { violations } = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()
    const serious = violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    expect(serious.map((violation) => `${violation.id}: ${violation.nodes[0]?.target} ${violation.nodes[0]?.failureSummary?.slice(0, 120)}`)).toEqual([])
  })
}

test("the scroll progress bar follows the page", async ({ page }) => {
  await page.goto("/")
  const scale = () => page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector(".fs-progress") as Element).transform).a)
  expect(await scale()).toBe(0)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(scale).toBeGreaterThan(0.9)
})

test("the footer has the seven company profiles", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator('footer a[aria-label*="Flacron Enterprises on"]')).toHaveCount(7)
})

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/app/scores")
  await expect(page).toHaveURL(/\/signin\?next=/)
})

test("old feature URLs move to the dashboard", async ({ page }) => {
  await page.goto("/scores")
  await expect(page).toHaveURL(/\/signin\?next=/)
})

test("www redirects to the main domain", async ({ request }, info) => {
  test.skip(!/flacronsport\.com/.test(String(info.project.use.baseURL)))
  const response = await request.get("https://www.flacronsport.com/pricing", { maxRedirects: 0 })
  expect(response.status()).toBe(308)
  expect(response.headers().location).toBe("https://flacronsport.com/pricing")
})

test("French pages declare their language", async ({ page }) => {
  await page.goto("/fr")
  await expect(page.locator("html")).toHaveAttribute("lang", "fr")
})

test("marketing shows no internal values", async ({ page }) => {
  for (const path of ["/", "/pricing", "/sports", "/faq"]) {
    await page.goto(path)
    const text = await page.locator("body").innerText()
    expect(text).not.toMatch(/TheSportsDB|Firebase|Amplify|\bECS\b|sandbox|Test billing|In validation/i)
  }
})

test("rejecting cookies sticks across pages", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Reject non-essential" }).first().click()
  await page.goto("/pricing")
  await expect(page.getByRole("button", { name: "Reject non-essential" })).toHaveCount(0)
})

test("keyboard users can skip to content", async ({ page }, info) => {
  test.skip(info.project.name !== "chrome", "keyboard check")
  await page.goto("/")
  await page.keyboard.press("Tab")
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused()
})
