// The plan table from section 12 of the spec, in both languages. Prices and limits
// come from plans.ts, so this file cannot disagree with what is enforced.

import { ADDONS, type AddonSku } from "./addons"
import { PLANS, type BillingInterval, type PlanId } from "./plans"
import type { Locale } from "@/lib/i18n"

type Text = Record<Locale, string>

export interface MatrixCell {
  text: Text
}

export interface MatrixRow {
  id: string
  label: Text
  cells: Record<PlanId, MatrixCell>
}

const same = (text: Text): Record<PlanId, MatrixCell> => ({ free: { text }, plus: { text }, premium: { text } })
const requests = (id: PlanId): MatrixCell => ({ text: { en: `${PLANS[id].assistantRequestsPerMonth} requests`, fr: `${PLANS[id].assistantRequestsPerMonth} demandes` } })
const rooms = (id: "plus" | "premium"): number => PLANS[id].privateRooms?.active ?? 0
const seats = (id: "plus" | "premium"): number => PLANS[id].privateRooms?.participantsPerRoom ?? 0

const DIGEST: Text = { en: "Daily digest and basic reports", fr: "Résumé quotidien et comptes rendus de base" }
const UNLIMITED: Text = { en: "Unlimited", fr: "Illimités" }
const REMOVED: Text = { en: "Removed", fr: "Retirées" }
const FULL_REPORTS: Text = { en: "Full personalized reports", fr: "Comptes rendus complets et personnalisés" }
const DEEP_REPORTS: Text = { en: "Full reports and deeper analysis", fr: "Comptes rendus complets et analyse approfondie" }
const BASIC_COMPARE: Text = { en: "Basic comparison", fr: "Comparaison de base" }
const ADVANCED_COMPARE: Text = { en: "Advanced comparison and saved views", fr: "Comparaison avancée et vues enregistrées" }
const ALL_ALERTS: Text = { en: "All supported event alerts", fr: "Toutes les alertes d'événement prises en charge" }

export const PLAN_MATRIX: MatrixRow[] = [
  { id: "scores", label: { en: "Scores and schedules", fr: "Scores et calendriers" }, cells: same({ en: "All enabled sports", fr: "Tous les sports activés" }) },
  { id: "video", label: { en: "Authorized public video", fr: "Vidéo publique autorisée" }, cells: same({ en: "Where available", fr: "Si disponible" }) },
  { id: "favorites", label: { en: "Favorite teams or athletes", fr: "Équipes ou athlètes favoris" }, cells: { free: { text: { en: `${PLANS.free.favoritesLimit} total`, fr: `${PLANS.free.favoritesLimit} au total` } }, plus: { text: UNLIMITED }, premium: { text: UNLIMITED } } },
  {
    id: "alerts",
    label: { en: "Alerts", fr: "Alertes" },
    cells: {
      free: { text: { en: "Start and final result", fr: "Début et résultat final" } },
      plus: { text: ALL_ALERTS },
      premium: { text: { en: "All supported alerts and advanced filters", fr: "Toutes les alertes prises en charge et filtres avancés" } },
    },
  },
  { id: "ads", label: { en: "FlacronSport display ads", fr: "Publicités FlacronSport" }, cells: { free: { text: { en: "Included", fr: "Incluses" } }, plus: { text: REMOVED }, premium: { text: REMOVED } } },
  {
    id: "news",
    label: { en: "News and summaries", fr: "Actualités et résumés" },
    cells: {
      free: { text: DIGEST },
      plus: { text: FULL_REPORTS },
      premium: { text: DEEP_REPORTS },
    },
  },
  { id: "assistant", label: { en: "Sports assistant per month", fr: "Assistant sportif par mois" }, cells: { free: requests("free"), plus: requests("plus"), premium: requests("premium") } },
  {
    id: "rooms",
    label: { en: "Private room creation", fr: "Création de salons privés" },
    cells: {
      free: { text: { en: "Join only", fr: "Rejoindre uniquement" } },
      plus: { text: { en: `${rooms("plus")} active rooms`, fr: `${rooms("plus")} salons actifs` } },
      premium: { text: { en: `${rooms("premium")} active rooms`, fr: `${rooms("premium")} salons actifs` } },
    },
  },
  {
    id: "participants",
    label: { en: "Room participant limit", fr: "Participants par salon" },
    cells: {
      free: { text: { en: "Host plan applies", fr: "Selon l'offre de l'hôte" } },
      plus: { text: { en: `${seats("plus")} per room`, fr: `${seats("plus")} par salon` } },
      premium: { text: { en: `${seats("premium")} per room`, fr: `${seats("premium")} par salon` } },
    },
  },
  {
    id: "comparison",
    label: { en: "Advanced comparison tools", fr: "Outils de comparaison avancés" },
    cells: {
      free: { text: { en: "No", fr: "Non" } },
      plus: { text: BASIC_COMPARE },
      premium: { text: ADVANCED_COMPARE },
    },
  },
]

/** "What every user can access" in section 12. */
export const EVERY_PLAN: Text[] = [
  { en: "English and French", fr: "Anglais et français" },
  { en: "Basic accessibility controls", fr: "Réglages d'accessibilité de base" },
  { en: "Supported public scores", fr: "Scores publics pris en charge" },
  { en: "Public community participation after sign-in", fr: "Participation à la communauté publique après connexion" },
  { en: "Free predictions", fr: "Pronostics gratuits" },
  { en: "Spoiler protection", fr: "Protection anti-spoiler" },
  { en: "Available public highlights", fr: "Résumés vidéo publics disponibles" },
]

const PLUS_ROOMS: Text = { en: `${rooms("plus")} active private rooms, ${seats("plus")} people each`, fr: `${rooms("plus")} salons privés actifs, ${seats("plus")} personnes chacun` }
const PREMIUM_ROOMS: Text = { en: `${rooms("premium")} active private rooms, ${seats("premium")} people each`, fr: `${rooms("premium")} salons privés actifs, ${seats("premium")} personnes chacun` }
const assistantLine = (id: PlanId): Text => ({ en: `${PLANS[id].assistantRequestsPerMonth} assistant requests a month`, fr: `${PLANS[id].assistantRequestsPerMonth} demandes à l'assistant par mois` })

export const PLAN_HIGHLIGHTS: Record<PlanId, Text[]> = {
  free: [
    { en: "Scores and schedules for all enabled sports", fr: "Scores et calendriers de tous les sports activés" },
    { en: `${PLANS.free.favoritesLimit} favorite teams or athletes`, fr: `${PLANS.free.favoritesLimit} équipes ou athlètes favoris` },
    { en: "Start and final result alerts", fr: "Alertes de début et de résultat final" },
    DIGEST,
    assistantLine("free"),
    { en: "Join private rooms", fr: "Rejoindre des salons privés" },
  ],
  plus: [
    { en: "Everything in Free", fr: "Tout le contenu de Free" },
    { en: "Unlimited favorites", fr: "Favoris illimités" },
    ALL_ALERTS,
    { en: "No FlacronSport display ads", fr: "Sans publicité FlacronSport" },
    FULL_REPORTS,
    assistantLine("plus"),
    PLUS_ROOMS,
    BASIC_COMPARE,
  ],
  premium: [
    { en: "Everything in Plus", fr: "Tout le contenu de Plus" },
    { en: "Advanced alert filters", fr: "Filtres d'alertes avancés" },
    DEEP_REPORTS,
    assistantLine("premium"),
    PREMIUM_ROOMS,
    ADVANCED_COMPARE,
  ],
}

/** Whole percent saved by paying yearly, or null for the free plan. */
export function annualSavingPercent(id: PlanId): number | null {
  const { monthlyPriceUsd, annualPriceUsd } = PLANS[id]
  return monthlyPriceUsd === 0 ? null : Math.round((1 - annualPriceUsd / (monthlyPriceUsd * 12)) * 100)
}

export const priceFor = (id: PlanId, interval: BillingInterval): number => (interval === "monthly" ? PLANS[id].monthlyPriceUsd : PLANS[id].annualPriceUsd)

export const ADDON_ORDER: AddonSku[] = ["assistant_100", "day_pass", "room_pass", "export_pack"]
export const addonPrice = (sku: AddonSku): number => ADDONS[sku].priceUsd
