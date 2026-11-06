"use client"

import { useEffect, useRef, useState } from "react"
import { Square, Volume2 } from "lucide-react"
import { btn } from "@/components/site/states"
import { speechChunks, speechLang } from "@/lib/speech"
import { useLocale } from "@/lib/use-locale"

/**
 * Reads a FlacronSport report aloud with the browser's own voice: nothing is sent to a
 * server. Sits inside the spoiler guard, so it only exists once the report is revealed.
 */
export function ReportAudio({ text }: { text: string }) {
  const { locale, t } = useLocale()
  const [supported, setSupported] = useState(false)
  const [playing, setPlaying] = useState(false)
  // Cancelling fires each queued piece's end event, so an old run must not touch the new one.
  const run = useRef(0)

  useEffect(() => {
    setSupported("speechSynthesis" in window && "SpeechSynthesisUtterance" in window)
  }, [])

  useEffect(() => {
    return () => {
      run.current += 1
      if ("speechSynthesis" in window) window.speechSynthesis.cancel()
    }
  }, [])

  if (!supported) return null

  const stop = () => {
    run.current += 1
    window.speechSynthesis.cancel()
    setPlaying(false)
  }

  const play = () => {
    stop()
    const current = run.current
    const chunks = speechChunks(text)
    const lang = speechLang(locale)
    const finish = () => {
      if (run.current === current) setPlaying(false)
    }
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk)
      utterance.lang = lang
      utterance.onerror = finish
      if (index === chunks.length - 1) utterance.onend = finish
      window.speechSynthesis.speak(utterance)
    })
    setPlaying(chunks.length > 0)
  }

  return (
    <div className="mb-4">
      {playing
        ? <button type="button" onClick={stop} className={btn("outline", "sm")}><Square aria-hidden className="size-3.5" /> {t.reports.stopListening}</button>
        : <button type="button" onClick={play} className={btn("outline", "sm")}><Volume2 aria-hidden className="size-4" /> {t.reports.listen}</button>}
    </div>
  )
}
