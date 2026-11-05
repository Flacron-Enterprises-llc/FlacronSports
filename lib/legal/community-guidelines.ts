// Community Guidelines. Drawn only from Terms 3.7, 3.8, 3.9 and Privacy 2.5, 2.9,
// 2.11, plus how the product behaves. A wording change to the rules means a new
// date here, which is also the version stored with each acceptance.

import type { Locale } from "@/lib/i18n"
import type { PolicySection } from "./content"

export const GUIDELINES_DATE = "2026-11-05"
export const APPEALS_EMAIL = "contact@flacronenterprises.com"

interface Guidelines {
  title: string
  description: string
  lead: string
  related: { before: string; terms: string; and: string; privacy: string }
  sections: PolicySection[]
}

export const COMMUNITY_GUIDELINES: Record<Locale, Guidelines> = {
  en: {
    title: "Community Guidelines",
    description: "What is allowed in FlacronSport match chat, private rooms and predictions, how reports and moderation work, and how long community content is kept.",
    lead: "How to take part in match chat, reactions, polls, private rooms and predictions, and what happens when something goes wrong.",
    related: { before: "These guidelines bring together the community sections of our", terms: "Terms of Service", and: "and", privacy: "Privacy Policy" },
    sections: [
      { id: "welcome", title: "What is welcome", blocks: ["Community features are intended for lawful sports discussion and fan interaction.", { list: [
        "Talking about matches, teams and athletes with other fans.",
        "Reacting to messages and voting in match polls.",
        "Inviting people you choose to a private room around a match.",
        "Playing predictions for points.",
      ] }] },
      { id: "age", title: "Who can take part", blocks: ["Before your first post, room or prediction, you confirm that you are at least 13 and accept these guidelines. FlacronSport is not directed to children under 13 in the United States. Community and account features may be restricted by age. If we learn that prohibited child data was collected, we will take appropriate steps to delete or restrict it."] },
      { id: "not-allowed", title: "What is not allowed", blocks: ["You must not:", { list: [
        "Harass, threaten, stalk or dox anyone.",
        "Impersonate anyone.",
        "Discriminate against or exploit others.",
        "Spam or defraud others.",
        "Encourage violence against others.",
        "Post pirated streams or illegal download links.",
        "Post malicious code.",
        "Post content that infringes intellectual-property rights.",
      ] }] },
      { id: "rooms", title: "Private rooms", blocks: ["A private room shares conversation and match context. It shows shared chat only, never video, and it does not rebroadcast the host's video. Every participant must independently satisfy any viewing entitlement or geographic restriction.", "Invitation links may be revoked and participant limits apply. Room creators may be responsible for managing the people they invite, subject to Flacron moderation.", "Private room content is limited to authorized room participants, but it may still be reported, reviewed for moderation, retained for safety, or disclosed when legally required."] },
      { id: "predictions", title: "Predictions", blocks: ["Predictions are entertainment-only and points-based, with no deposits, wagers, cash prizes, purchased chances or cash-out. FlacronSport is not a sportsbook, gambling operator or betting service."] },
      { id: "visibility", title: "What others can see", blocks: ["Public chat messages, reactions, usernames and certain profile information may be visible to other users. Do not post information you do not want other permitted participants to see."] },
      { id: "reports", title: "Reports and blocking", blocks: ["Use Report under a message to send it to the moderators. Use Block to stop seeing a person's messages. You can unblock them at any time from the Blocked people list under the chat. Reporting and blocking are available on every plan."] },
      { id: "moderation", title: "Moderation and sanctions", blocks: ["Flacron may remove content and mute, suspend or ban accounts based on moderation rules and safety needs. Moderators can also lock a chat or a room, and they record a reason for each action.", { list: [
        "A mute stops you posting messages.",
        "A suspension stops all community participation.",
        "A ban ends your access to community features.",
      ] }] },
      { id: "appeals", title: "Appeals", blocks: [`If you think a moderation decision was wrong, email ${APPEALS_EMAIL} from your account email address and tell us which match or room it concerns.`] },
      { id: "retention", title: "Retention and account deletion", blocks: ["Messages are kept while the room or match chat exists. Removed messages and enforcement records are kept for safety, and may be retained longer where necessary, as the Privacy Policy allows.", "If you delete your account, your name on your messages is replaced with \"Former member\" and the text is removed unless moderation still needs it. Your predictions, room memberships and blocks are deleted."] },
    ],
  },
  fr: {
    title: "Règles de la communauté",
    description: "Ce qui est autorisé dans les discussions de match, les salons privés et les pronostics FlacronSport, le fonctionnement des signalements et de la modération, et la durée de conservation des contenus.",
    lead: "Comment participer aux discussions, réactions, sondages, salons privés et pronostics, et ce qui se passe en cas de problème.",
    related: { before: "Ces règles réunissent les sections consacrées à la communauté de nos", terms: "Conditions d'utilisation", and: "et de notre", privacy: "Politique de confidentialité" },
    sections: [
      { id: "welcome", title: "Ce qui est bienvenu", blocks: ["Les fonctions communautaires sont destinées aux échanges licites autour du sport et entre fans.", { list: [
        "Parler des matchs, des équipes et des athlètes avec d'autres fans.",
        "Réagir aux messages et voter dans les sondages de match.",
        "Inviter les personnes de votre choix dans un salon privé autour d'un match.",
        "Jouer aux pronostics pour gagner des points.",
      ] }] },
      { id: "age", title: "Qui peut participer", blocks: ["Avant votre première publication, votre premier salon ou votre premier pronostic, vous confirmez avoir au moins 13 ans et accepter ces règles. FlacronSport ne s'adresse pas aux enfants de moins de 13 ans aux États-Unis. Les fonctions communautaires et de compte peuvent être limitées selon l'âge. Si nous apprenons que des données d'enfant interdites ont été collectées, nous prendrons les mesures appropriées pour les supprimer ou en restreindre l'usage."] },
      { id: "not-allowed", title: "Ce qui est interdit", blocks: ["Vous ne devez pas :", { list: [
        "Harceler, menacer, traquer ou divulguer les données personnelles de quiconque.",
        "Vous faire passer pour quelqu'un d'autre.",
        "Discriminer ou exploiter autrui.",
        "Envoyer du spam ou escroquer autrui.",
        "Encourager la violence contre autrui.",
        "Publier des flux piratés ou des liens de téléchargement illégaux.",
        "Publier du code malveillant.",
        "Publier des contenus qui portent atteinte à des droits de propriété intellectuelle.",
      ] }] },
      { id: "rooms", title: "Salons privés", blocks: ["Un salon privé partage la conversation et le contexte du match. Il affiche uniquement une discussion commune, jamais de vidéo, et ne rediffuse pas la vidéo de l'hôte. Chaque participant doit remplir de lui-même toute condition de droit de visionnage ou de restriction géographique.", "Les liens d'invitation peuvent être révoqués et des limites de participants s'appliquent. Les créateurs de salon peuvent être responsables de la gestion des personnes invitées, sous réserve de la modération de Flacron.", "Le contenu des salons privés est réservé aux participants autorisés, mais il peut tout de même être signalé, examiné par la modération, conservé pour des raisons de sécurité ou divulgué lorsque la loi l'exige."] },
      { id: "predictions", title: "Pronostics", blocks: ["Les pronostics sont un divertissement à points, sans dépôt, mise, lot en argent, chance achetée ni retrait d'argent. FlacronSport n'est ni un bookmaker, ni un opérateur de jeux d'argent, ni un service de paris."] },
      { id: "visibility", title: "Ce que les autres peuvent voir", blocks: ["Les messages publics, les réactions, les noms d'utilisateur et certaines informations de profil peuvent être visibles par les autres utilisateurs. Ne publiez pas d'informations que vous ne voulez pas montrer aux autres participants autorisés."] },
      { id: "reports", title: "Signalements et blocage", blocks: ["Utilisez Signaler sous un message pour le transmettre aux modérateurs. Utilisez Bloquer pour ne plus voir les messages d'une personne. Vous pouvez la débloquer à tout moment depuis la liste Personnes bloquées, sous la discussion. Le signalement et le blocage sont disponibles dans toutes les offres."] },
      { id: "moderation", title: "Modération et sanctions", blocks: ["Flacron peut retirer des contenus et rendre muets, suspendre ou bannir des comptes selon les règles de modération et les besoins de sécurité. Les modérateurs peuvent aussi verrouiller une discussion ou un salon, et ils consignent un motif pour chaque action.", { list: [
        "Un compte rendu muet ne peut plus publier de messages.",
        "Une suspension interrompt toute participation à la communauté.",
        "Un bannissement met fin à l'accès aux fonctions communautaires.",
      ] }] },
      { id: "appeals", title: "Contestations", blocks: [`Si vous pensez qu'une décision de modération est erronée, écrivez à ${APPEALS_EMAIL} depuis l'adresse e-mail de votre compte en indiquant le match ou le salon concerné.`] },
      { id: "retention", title: "Conservation et suppression du compte", blocks: ["Les messages sont conservés tant que le salon ou la discussion du match existe. Les messages retirés et les dossiers de sanctions sont conservés pour des raisons de sécurité, et peuvent l'être plus longtemps si nécessaire, comme le permet la Politique de confidentialité.", "Si vous supprimez votre compte, votre nom sur vos messages est remplacé par « Ancien membre » et le texte est retiré, sauf si la modération en a encore besoin. Vos pronostics, adhésions à des salons et blocages sont supprimés."] },
    ],
  },
}
