export const LOCALES = ["en", "fr"] as const
export type Locale = (typeof LOCALES)[number]

export function isLocale(value: string | undefined): value is Locale {
  return value === "en" || value === "fr"
}

/** English keeps unprefixed URLs; French lives under /fr. */
export function localePath(locale: Locale, path: string): string {
  if (locale === "en") return path
  return path === "/" ? "/fr" : `/fr${path}`
}

const en = {
  nav: {
    home: "Home", scores: "Scores", watch: "Watch", news: "News", myTeams: "My Teams", pricing: "Pricing",
    signIn: "Sign in", getStarted: "Get started", account: "Account", menu: "Menu", close: "Close menu", primary: "Primary",
    theme: "Switch theme", language: "Français",
  },
  home: {
    eyebrow: "Multi-sport scores, viewing options and match coverage",
    title: "Every game you follow, in one place.",
    lead: "Follow fixtures and results, find where authorized video is available, and keep your favorite teams first. Browse free, no account needed.",
    ctaScores: "See today's scores",
    ctaPricing: "Compare plans",
    today: "Today's fixtures",
    allScores: "All scores",
    featuresTitle: "Built around how fans actually follow sport",
    features: [
      ["Scores you can trust", "Live, upcoming and finished fixtures with the source and last update shown. Missing data stays missing; it is never filled in."],
      ["Honest viewing options", "Watch Live appears only for a playable authorized source. Otherwise you get the official broadcaster or Follow Live."],
      ["Your teams first", "Follow the teams you care about and keep them on this device, no account needed."],
      ["English and French", "The whole interface works in both languages, with kickoff times shown in your own time zone."],
    ],
    plansTitle: "Free to follow. Upgrade for more.",
    plansLead: "Scores and schedules are free on every plan. Paid plans add FlacronSport benefits, not broadcast rights.",
  },
  scores: {
    title: "Scores", lead: "Fixtures for the selected date, shown in your local time.",
    all: "All", live: "Live", upcoming: "Upcoming", finished: "Finished", other: "Other",
    allSports: "All sports", date: "Date", search: "Filter by team or competition",
    empty: "No fixtures match these filters.", comingSoon: "Coverage in validation", apply: "Apply",
  },
  feed: {
    source: "Source", updated: "Checked",
    limited: "Limited preview feed: only a sample of fixtures is shown, and scores may be delayed.",
    stale: "Some sports could not be refreshed, so this list may be incomplete.",
    unavailable: "Scores are temporarily unavailable. Please try again shortly.",
  },
  status: {
    scheduled: "Upcoming", live: "Live", finished: "Finished", postponed: "Postponed", canceled: "Canceled",
    interrupted: "Interrupted", abandoned: "Abandoned", unknown: "Status unconfirmed",
  },
  match: {
    back: "Back to scores", overview: "Overview", kickoff: "Kickoff", venue: "Venue", competition: "Competition",
    viewing: "Viewing options", followLive: "Follow Live",
    noVideo: "No authorized video source is available for this event, so nothing can be played here.",
    notFound: "We could not find this match.", tbd: "Time to be confirmed", noScore: "Score not available",
  },
  watch: {
    title: "Watch", lead: "Authorized video only, checked for your country when you press play.",
    sections: ["Live Now", "Upcoming Broadcasts", "Highlights", "Replays"],
    empty: "Nothing to show yet",
    emptyBody: "No licensed video provider is connected, so no streams, highlights or replays are available. We will not list a game here until it is genuinely playable.",
    disclaimer: "FlacronSport subscriptions do not guarantee universal broadcast access or replace broadcaster subscriptions.",
    cta: "Follow today's scores",
  },
  news: {
    title: "News", lead: "Match previews and recaps grounded in verified data, with sources shown.",
    empty: "No verified reports yet",
    emptyBody: "Articles appear here only once they are built from verified match data with sources attached. Until then we would rather publish nothing than guess.",
    cta: "Go to scores",
  },
  myTeams: {
    title: "My Teams", lead: "Follow teams from today's fixtures. Guest favorites stay on this device.",
    following: "Following", empty: "You are not following anyone yet",
    emptyBody: "Open Scores and tap the star on a team to add it here.",
    limit: "The Free plan includes 5 favorites. Upgrade for unlimited favorites.",
    remove: "Remove", follow: "Follow", unfollow: "Unfollow", browse: "Browse scores",
  },
  pricing: {
    title: "Simple plans for every fan", lead: "No free trial and no broadcast bundle. Cancel any time and keep paid features until your period ends.",
    monthly: "Monthly", annual: "Annual", perMonth: "/month", perYear: "/year",
    billedMonthly: "Renews monthly until canceled.", billedAnnual: "Charged upfront. Renews annually until canceled.",
    tax: "Applicable tax is shown before you pay.", free: "Start free", choose: "Choose", current: "Current plan",
    testBilling: "Test billing: Stripe is in sandbox mode and no real payment is taken.",
    soon: "Coming soon", compare: "Compare plans", benefit: "Benefit", opening: "Opening checkout...",
    disclaimer: "FlacronSport subscriptions do not guarantee universal broadcast access or replace broadcaster subscriptions. Provider restrictions apply equally across plans, and video-provider advertisements may remain on paid plans.",
  },
  footer: {
    product: "Product", company: "Company", legal: "Legal", about: "About", contact: "Contact",
    cookies: "Cookie preferences", tagline: "Live scores. Smart recaps.",
    productOf: "A product of", rights: "All rights reserved.",
    note: "FlacronSport is not affiliated with any league, team or broadcaster. Team and competition names belong to their owners. Predictions and statistics are not betting advice.",
  },
  consent: {
    title: "Your privacy choices",
    body: "We use strictly necessary cookies to sign you in and keep FlacronSport secure. Optional functional, analytics and advertising cookies are used only if you allow them.",
    policy: "Cookies Policy", accept: "Accept all", reject: "Reject non-essential", manage: "Manage preferences",
    prefs: "Cookie preferences", prefsLead: "Choose which optional cookies FlacronSport may use. You can change this at any time from the footer.",
    save: "Save choices", always: "Always on", gpc: "Global Privacy Control detected: non-essential cookies are off for this browser.",
  },
  auth: {
    signInTitle: "Welcome back", signUpTitle: "Create your account", email: "Email", password: "Password", confirm: "Confirm password",
    signIn: "Sign in", signUp: "Create account", google: "Continue with Google", or: "or", forgot: "Forgot password?",
    noAccount: "New to FlacronSport?", hasAccount: "Already have an account?", mismatch: "Passwords do not match",
    resetSent: "If that address has an account, a reset link is on its way.", enterEmail: "Enter your email first",
    agree: "By continuing you agree to the", terms: "Terms of Service", and: "and", privacy: "Privacy Policy",
    failed: "That did not work. Check your details and try again.", planNote: "Selected plan:",
    verifyTitle: "Verify your email", verifyBody: "We sent a link to your inbox. Open it, then come back here.",
    verified: "I have verified", resend: "Resend email", resent: "Verification email sent.", notYet: "Not verified yet. Check your inbox and spam folder.",
    required: "Sign in to continue.",
  },
  account: {
    title: "Your account", plan: "Plan", renews: "Renews on", ends: "Access ends on", cancel: "Cancel at period end",
    undo: "Keep my subscription", manage: "Invoices and payment method", choose: "Choose a plan", signOut: "Sign out",
    pastDue: "Your last payment failed. Update your payment method to keep paid access.",
    canceled: "Your plan will end at the close of the current period.", checkoutCanceled: "Checkout was canceled. You have not been charged.",
    failed: "That did not work. Please try again.", confirmCancel: "Cancel at the end of your paid period?",
  },
  paid: {
    confirming: "Confirming your payment", confirmingBody: "This usually takes a few seconds.",
    done: "Your plan is active", doneBody: "Thanks for subscribing to FlacronSport.",
    delayed: "Still confirming", delayedBody: "We have not received confirmation from Stripe yet. Your plan will update on its own.",
    go: "Go to your account",
  },
  about: {
    title: "About FlacronSport",
    body: [
      "FlacronSport is a multi-sport product from Flacron Enterprises LLC. It brings fixtures, results, authorized viewing options and match coverage together, with your teams first.",
      "We show coverage honestly. A competition appears only after its data has been tested, video is evaluated separately for each event, and we label what we do not know instead of filling the gap.",
    ],
  },
  contact: {
    title: "Contact us", lead: "Questions, billing requests and corrections all reach the same team.",
    email: "Email", address: "Mail", billing: "For billing, include your account email, the transaction date and the amount. Never send full card numbers.",
  },
  legal: { effective: "Effective date", onlyEnglish: "This policy is currently available in English only.", print: "Print", contents: "On this page" },
  common: { notFound: "Page not found", home: "Back to home", error: "Something went wrong", retry: "Try again", offline: "You are offline." },
}

export type Dictionary = typeof en

const fr: Dictionary = {
  nav: {
    home: "Accueil", scores: "Scores", watch: "Regarder", news: "Actualités", myTeams: "Mes équipes", pricing: "Tarifs",
    signIn: "Se connecter", getStarted: "Commencer", account: "Compte", menu: "Menu", close: "Fermer le menu", primary: "Principale",
    theme: "Changer de thème", language: "English",
  },
  home: {
    eyebrow: "Scores multisports, options de visionnage et couverture des matchs",
    title: "Tous vos matchs, au même endroit.",
    lead: "Suivez les calendriers et les résultats, trouvez où une vidéo autorisée est disponible et gardez vos équipes favorites en tête. Accès libre, sans compte.",
    ctaScores: "Voir les scores du jour",
    ctaPricing: "Comparer les offres",
    today: "Rencontres du jour",
    allScores: "Tous les scores",
    featuresTitle: "Pensé pour la façon dont les fans suivent le sport",
    features: [
      ["Des scores fiables", "Matchs en direct, à venir et terminés, avec la source et la dernière mise à jour. Une donnée manquante reste manquante, jamais inventée."],
      ["Des options de visionnage honnêtes", "« Regarder en direct » n'apparaît que pour une source autorisée et lisible. Sinon, vous avez le diffuseur officiel ou le suivi en direct."],
      ["Vos équipes d'abord", "Suivez vos équipes et gardez-les sur cet appareil, sans compte."],
      ["Anglais et français", "Toute l'interface fonctionne dans les deux langues, avec les horaires affichés dans votre fuseau."],
    ],
    plansTitle: "Gratuit pour suivre. Plus d'avantages en option.",
    plansLead: "Les scores et calendriers sont gratuits dans toutes les offres. Les offres payantes ajoutent des avantages FlacronSport, pas des droits de diffusion.",
  },
  scores: {
    title: "Scores", lead: "Rencontres de la date choisie, affichées à votre heure locale.",
    all: "Tous", live: "En direct", upcoming: "À venir", finished: "Terminés", other: "Autres",
    allSports: "Tous les sports", date: "Date", search: "Filtrer par équipe ou compétition",
    empty: "Aucune rencontre ne correspond à ces filtres.", comingSoon: "Couverture en validation", apply: "Appliquer",
  },
  feed: {
    source: "Source", updated: "Vérifié",
    limited: "Flux d'aperçu limité : seul un échantillon de rencontres est affiché et les scores peuvent être retardés.",
    stale: "Certains sports n'ont pas pu être actualisés : cette liste peut être incomplète.",
    unavailable: "Les scores sont temporairement indisponibles. Réessayez dans quelques instants.",
  },
  status: {
    scheduled: "À venir", live: "En direct", finished: "Terminé", postponed: "Reporté", canceled: "Annulé",
    interrupted: "Interrompu", abandoned: "Abandonné", unknown: "Statut non confirmé",
  },
  match: {
    back: "Retour aux scores", overview: "Aperçu", kickoff: "Coup d'envoi", venue: "Lieu", competition: "Compétition",
    viewing: "Options de visionnage", followLive: "Suivre en direct",
    noVideo: "Aucune source vidéo autorisée n'est disponible pour cet événement : rien ne peut être lu ici.",
    notFound: "Nous n'avons pas trouvé ce match.", tbd: "Horaire à confirmer", noScore: "Score non disponible",
  },
  watch: {
    title: "Regarder", lead: "Vidéo autorisée uniquement, vérifiée pour votre pays au lancement de la lecture.",
    sections: ["En direct", "Diffusions à venir", "Temps forts", "Rediffusions"],
    empty: "Rien à afficher pour le moment",
    emptyBody: "Aucun fournisseur vidéo sous licence n'est connecté : aucun direct, temps fort ou rediffusion n'est disponible. Un match n'apparaîtra ici que s'il peut réellement être lu.",
    disclaimer: "Les abonnements FlacronSport ne garantissent pas un accès universel aux diffusions et ne remplacent pas les abonnements des diffuseurs.",
    cta: "Suivre les scores du jour",
  },
  news: {
    title: "Actualités", lead: "Avant-matchs et résumés fondés sur des données vérifiées, avec leurs sources.",
    empty: "Aucun article vérifié pour le moment",
    emptyBody: "Les articles n'apparaissent ici que s'ils reposent sur des données de match vérifiées et des sources indiquées. D'ici là, nous préférons ne rien publier plutôt que de deviner.",
    cta: "Voir les scores",
  },
  myTeams: {
    title: "Mes équipes", lead: "Suivez des équipes depuis les rencontres du jour. Les favoris invités restent sur cet appareil.",
    following: "Suivies", empty: "Vous ne suivez encore personne",
    emptyBody: "Ouvrez Scores et touchez l'étoile d'une équipe pour l'ajouter ici.",
    limit: "L'offre Free inclut 5 favoris. Passez à une offre payante pour des favoris illimités.",
    remove: "Retirer", follow: "Suivre", unfollow: "Ne plus suivre", browse: "Parcourir les scores",
  },
  pricing: {
    title: "Des offres simples pour chaque fan", lead: "Ni essai gratuit ni bouquet de diffusion. Annulez à tout moment et conservez les avantages jusqu'à la fin de la période.",
    monthly: "Mensuel", annual: "Annuel", perMonth: "/mois", perYear: "/an",
    billedMonthly: "Renouvelé chaque mois jusqu'à annulation.", billedAnnual: "Payé d'avance. Renouvelé chaque année jusqu'à annulation.",
    tax: "Les taxes applicables sont indiquées avant le paiement.", free: "Commencer gratuitement", choose: "Choisir", current: "Offre actuelle",
    testBilling: "Facturation de test : Stripe est en mode sandbox et aucun paiement réel n'est prélevé.",
    soon: "Bientôt", compare: "Comparer les offres", benefit: "Avantage", opening: "Ouverture du paiement...",
    disclaimer: "Les abonnements FlacronSport ne garantissent pas un accès universel aux diffusions et ne remplacent pas les abonnements des diffuseurs. Les restrictions des fournisseurs s'appliquent à toutes les offres, et leurs publicités vidéo peuvent subsister sur les offres payantes.",
  },
  footer: {
    product: "Produit", company: "Entreprise", legal: "Mentions légales", about: "À propos", contact: "Contact",
    cookies: "Préférences de cookies", tagline: "Scores en direct. Résumés intelligents.",
    productOf: "Un produit de", rights: "Tous droits réservés.",
    note: "FlacronSport n'est affilié à aucune ligue, équipe ou chaîne. Les noms d'équipes et de compétitions appartiennent à leurs propriétaires. Les pronostics et statistiques ne sont pas des conseils de paris.",
  },
  consent: {
    title: "Vos choix de confidentialité",
    body: "Nous utilisons des cookies strictement nécessaires pour vous connecter et sécuriser FlacronSport. Les cookies fonctionnels, d'analyse et publicitaires ne sont utilisés qu'avec votre accord.",
    policy: "Politique relative aux cookies", accept: "Tout accepter", reject: "Refuser les cookies non essentiels", manage: "Gérer les préférences",
    prefs: "Préférences de cookies", prefsLead: "Choisissez les cookies facultatifs que FlacronSport peut utiliser. Vous pouvez modifier ce choix à tout moment depuis le pied de page.",
    save: "Enregistrer mes choix", always: "Toujours actifs", gpc: "Global Privacy Control détecté : les cookies non essentiels sont désactivés pour ce navigateur.",
  },
  auth: {
    signInTitle: "Bon retour", signUpTitle: "Créez votre compte", email: "E-mail", password: "Mot de passe", confirm: "Confirmer le mot de passe",
    signIn: "Se connecter", signUp: "Créer un compte", google: "Continuer avec Google", or: "ou", forgot: "Mot de passe oublié ?",
    noAccount: "Nouveau sur FlacronSport ?", hasAccount: "Vous avez déjà un compte ?", mismatch: "Les mots de passe ne correspondent pas",
    resetSent: "Si cette adresse possède un compte, un lien de réinitialisation est en route.", enterEmail: "Saisissez d'abord votre e-mail",
    agree: "En continuant, vous acceptez les", terms: "Conditions d'utilisation", and: "et la", privacy: "Politique de confidentialité",
    failed: "Cela n'a pas fonctionné. Vérifiez vos informations et réessayez.", planNote: "Offre sélectionnée :",
    verifyTitle: "Vérifiez votre e-mail", verifyBody: "Nous avons envoyé un lien dans votre boîte de réception. Ouvrez-le, puis revenez ici.",
    verified: "C'est fait", resend: "Renvoyer l'e-mail", resent: "E-mail de vérification envoyé.", notYet: "Pas encore vérifié. Consultez votre boîte de réception et vos indésirables.",
    required: "Connectez-vous pour continuer.",
  },
  account: {
    title: "Votre compte", plan: "Offre", renews: "Renouvellement le", ends: "Accès jusqu'au", cancel: "Annuler à la fin de la période",
    undo: "Conserver mon abonnement", manage: "Factures et moyen de paiement", choose: "Choisir une offre", signOut: "Se déconnecter",
    pastDue: "Votre dernier paiement a échoué. Mettez à jour votre moyen de paiement pour conserver l'accès.",
    canceled: "Votre offre prendra fin à la clôture de la période en cours.", checkoutCanceled: "Le paiement a été annulé. Vous n'avez pas été débité.",
    failed: "Cela n'a pas fonctionné. Veuillez réessayer.", confirmCancel: "Annuler à la fin de votre période payée ?",
  },
  paid: {
    confirming: "Confirmation du paiement", confirmingBody: "Cela prend généralement quelques secondes.",
    done: "Votre offre est active", doneBody: "Merci de votre abonnement à FlacronSport.",
    delayed: "Confirmation en cours", delayedBody: "Nous n'avons pas encore reçu la confirmation de Stripe. Votre offre sera mise à jour automatiquement.",
    go: "Aller à votre compte",
  },
  about: {
    title: "À propos de FlacronSport",
    body: [
      "FlacronSport est un produit multisport de Flacron Enterprises LLC. Il réunit calendriers, résultats, options de visionnage autorisées et couverture des matchs, avec vos équipes en premier.",
      "Nous présentons la couverture honnêtement. Une compétition n'apparaît qu'une fois ses données testées, la vidéo est évaluée séparément pour chaque événement, et nous indiquons ce que nous ignorons au lieu de combler les vides.",
    ],
  },
  contact: {
    title: "Contactez-nous", lead: "Questions, facturation et corrections parviennent à la même équipe.",
    email: "E-mail", address: "Courrier", billing: "Pour la facturation, indiquez l'e-mail du compte, la date de la transaction et le montant. N'envoyez jamais de numéro de carte complet.",
  },
  legal: { effective: "Date d'effet", onlyEnglish: "Cette politique est actuellement disponible en anglais uniquement.", print: "Imprimer", contents: "Sur cette page" },
  common: { notFound: "Page introuvable", home: "Retour à l'accueil", error: "Une erreur est survenue", retry: "Réessayer", offline: "Vous êtes hors ligne." },
}

const DICTIONARIES: Record<Locale, Dictionary> = { en, fr }

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}
