// Curated rule summaries for the assistant. Short, neutral and general: competitions
// can vary these rules, which every answer says. Owner review is still required.

export const REFERENCE_REVIEWED_UTC = "2026-11-05T00:00:00.000Z"

export interface ReferenceSource {
  label: string
  url: string
}

const IFAB: ReferenceSource = { label: "IFAB Laws of the Game", url: "https://www.theifab.com/" }
const FIBA: ReferenceSource = { label: "FIBA Official Basketball Rules", url: "https://www.fiba.basketball/" }

export interface ReferenceEntry {
  id: string
  /** Accent-free lowercase phrases, English and French. */
  terms: string[]
  source: ReferenceSource
  en: string
  fr: string
}

export const REFERENCE: ReferenceEntry[] = [
  {
    id: "offside",
    terms: ["offside", "hors-jeu", "hors jeu"],
    source: IFAB,
    en: "In football, a player is in an offside position if, when a teammate plays the ball, they are in the opposing half and closer to the goal line than both the ball and the second-last opponent. Being in that position is an offense only if the player becomes involved in active play.",
    fr: "Au football, un joueur est en position de hors-jeu si, au moment où un coéquipier joue le ballon, il se trouve dans la moitié adverse et plus près de la ligne de but que le ballon et l'avant-dernier adversaire. Cette position n'est sanctionnée que si le joueur prend part au jeu.",
  },
  {
    id: "penalty",
    terms: ["penalty kick", "penalty", "penalite", "coup de pied de reparation"],
    source: IFAB,
    en: "In football, a penalty kick is awarded when a player commits a direct free kick offense inside their own penalty area. It is taken from the penalty mark, 11 meters from goal, with only the goalkeeper defending.",
    fr: "Au football, un penalty est accordé lorsqu'un joueur commet une faute passible de coup franc direct dans sa propre surface de réparation. Il est tiré depuis le point de penalty, à 11 mètres du but, face au seul gardien.",
  },
  {
    id: "cards",
    terms: ["yellow card", "red card", "carton jaune", "carton rouge", "cartons", "cards"],
    source: IFAB,
    en: "In football, a yellow card is a caution. A second yellow card in the same match, or a straight red card, sends the player off, and the team continues with one player fewer.",
    fr: "Au football, le carton jaune est un avertissement. Un second carton jaune dans le même match, ou un carton rouge direct, entraîne l'expulsion du joueur, et l'équipe continue avec un joueur de moins.",
  },
  {
    id: "extra-time",
    terms: ["extra time", "prolongation", "prolongations", "penalty shootout", "tirs au but", "tab"],
    source: IFAB,
    en: "In football, a knockout match that is level after regular time may go to two extra periods of up to 15 minutes each, then kicks from the penalty mark if it is still level. The competition's rules decide which of these apply.",
    fr: "Au football, un match à élimination directe à égalité à la fin du temps réglementaire peut se prolonger par deux périodes d'au plus 15 minutes, puis par des tirs au but si l'égalité persiste. Le règlement de la compétition détermine ce qui s'applique.",
  },
  {
    id: "var",
    terms: ["var", "video assistant referee", "assistance video", "arbitrage video"],
    source: IFAB,
    en: "In football, the video assistant referee can recommend a review for clear and obvious errors or serious missed incidents involving goals, penalty decisions, direct red cards and mistaken identity. The referee makes the final decision.",
    fr: "Au football, l'assistance vidéo à l'arbitrage peut recommander un visionnage en cas d'erreur manifeste ou d'incident grave non vu concernant un but, un penalty, un carton rouge direct ou une erreur d'identité. La décision finale revient à l'arbitre.",
  },
  {
    id: "shot-clock",
    terms: ["shot clock", "24 seconds", "24 secondes", "horloge des tirs"],
    source: FIBA,
    en: "In basketball, a team has 24 seconds to attempt a shot that reaches the rim. The clock resets after a shot hits the rim or possession changes, and it can reset to 14 seconds in some situations, such as an offensive rebound.",
    fr: "Au basketball, une équipe dispose de 24 secondes pour tenter un tir qui touche l'arceau. Le chronomètre repart après un tir touchant l'arceau ou un changement de possession, et peut repartir à 14 secondes dans certains cas, comme un rebond offensif.",
  },
  {
    id: "scoring",
    terms: ["three-pointer", "three pointer", "three point", "free throw", "lancer franc", "lancers francs", "panier a trois points", "trois points"],
    source: FIBA,
    en: "In basketball, a field goal is worth 2 points, or 3 points from behind the three-point line. A free throw is worth 1 point.",
    fr: "Au basketball, un panier vaut 2 points, ou 3 points s'il est marqué derrière la ligne à trois points. Un lancer franc vaut 1 point.",
  },
  {
    id: "traveling",
    terms: ["traveling", "travelling", "marcher"],
    source: FIBA,
    en: "In basketball, traveling is moving a foot illegally while holding the ball, such as taking too many steps or lifting the pivot foot before dribbling. The ball goes to the opposing team.",
    fr: "Au basketball, le marcher consiste à déplacer un pied irrégulièrement en tenant le ballon, par exemple en faisant trop de pas ou en levant le pied de pivot avant de dribbler. Le ballon revient à l'équipe adverse.",
  },
  {
    id: "fouls",
    terms: ["foul out", "fouled out", "personal foul", "faute personnelle", "fautes personnelles"],
    source: FIBA,
    en: "In basketball, a player must leave the game after 5 personal fouls under FIBA rules, or 6 in the NBA.",
    fr: "Au basketball, un joueur doit quitter le match après 5 fautes personnelles selon les règles FIBA, ou 6 en NBA.",
  },
  {
    id: "overtime",
    terms: ["overtime", "basketball overtime", "quarters", "quart-temps", "quart temps"],
    source: FIBA,
    en: "In basketball, a game has four quarters of 10 minutes under FIBA rules or 12 minutes in the NBA. If the score is tied at the end, 5-minute overtime periods are played until one team leads.",
    fr: "Au basketball, un match compte quatre quart-temps de 10 minutes selon les règles FIBA ou de 12 minutes en NBA. En cas d'égalité à la fin, des prolongations de 5 minutes sont jouées jusqu'à ce qu'une équipe mène.",
  },
]
