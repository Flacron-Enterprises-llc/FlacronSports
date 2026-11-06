import { notFound } from "next/navigation"

/** Sends unknown URLs through the branded, localized not-found page. */
export default function Page() {
  notFound()
}
