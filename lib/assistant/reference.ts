// Curated rule summaries for the assistant. Short, neutral and general: competitions
// can vary these rules, which every answer says. Owner review is still required.

export const REFERENCE_REVIEWED_UTC = "2026-11-07T00:00:00.000Z"

export interface ReferenceSource {
  label: string
  url: string
}

const IFAB: ReferenceSource = { label: "IFAB Laws of the Game", url: "https://www.theifab.com/" }
const FIBA: ReferenceSource = { label: "FIBA Official Basketball Rules", url: "https://www.fiba.basketball/" }
const MCC: ReferenceSource = { label: "MCC Laws of Cricket", url: "https://www.lords.org/mcc/the-laws-of-cricket" }
const ICC: ReferenceSource = { label: "ICC Playing Conditions", url: "https://www.icc-cricket.com/" }
const NFL: ReferenceSource = { label: "NFL Rulebook", url: "https://operations.nfl.com/the-rules/" }
const MLB: ReferenceSource = { label: "Official Baseball Rules", url: "https://www.mlb.com/official-information" }
const NHL: ReferenceSource = { label: "NHL Official Rules", url: "https://www.nhl.com/info/rules" }
const ITF: ReferenceSource = { label: "ITF Rules of Tennis", url: "https://www.itftennis.com/" }
const WORLD_RUGBY: ReferenceSource = { label: "World Rugby Laws of the Game", url: "https://www.world.rugby/the-game/laws/home" }
const FIVB: ReferenceSource = { label: "FIVB Official Volleyball Rules", url: "https://www.fivb.com/" }
const ABC: ReferenceSource = { label: "Unified Rules of Mixed Martial Arts", url: "https://www.abcboxing.com/" }
const FIA: ReferenceSource = { label: "FIA Formula 1 Regulations", url: "https://www.fia.com/regulation/category/110" }

export interface ReferenceEntry {
  id: string
  /** Accent-free lowercase phrases, English and French. */
  terms: string[]
  source: ReferenceSource
  en: string
  fr: string
}

/** A term tied to its sport, for a word that means something else in another sport. */
function inSport(words: string[], english: string[], french: string[]): string[] {
  return words.flatMap((word) => [
    ...english.flatMap((sport) => [`${word} in ${sport}`, `${word} are in ${sport}`, `${word} in a ${sport}`, `${sport} ${word}`]),
    ...french.flatMap((sport) => [`${word} au ${sport}`, `${word} en ${sport}`, `${word} de ${sport}`]),
  ])
}

const HOCKEY = [["hockey", "ice hockey", "the nhl"], ["hockey"]]
const BASEBALL = [["baseball", "mlb"], ["baseball"]]
const CRICKET = [["cricket"], ["cricket"]]
const TENNIS = [["tennis"], ["tennis"]]
const RUGBY = [["rugby"], ["rugby"]]
const VOLLEYBALL = [["volleyball", "volley"], ["volley", "volley-ball", "volleyball"]]
const GRIDIRON = [["american football", "the nfl", "nfl"], ["football americain"]]
const RACING = [["f1", "formula 1", "formula one", "motorsport"], ["f1", "formule 1"]]

const sport = (words: string[], [english, french]: string[][]) => inSport(words, english, french)

// A question gets the first entry with a matching term, so an entry whose words sit inside
// another's comes first: "penalty box" before "penalty", "safety car" before "a safety".
const ENTRIES: ReferenceEntry[] = [
  {
    id: "hockey-offside",
    terms: sport(["offside", "hors-jeu", "hors jeu"], HOCKEY),
    source: NHL,
    en: "In ice hockey, a team is offside when an attacking player crosses the opposing blue line into the attacking zone ahead of the puck. Play stops for a faceoff outside the zone.",
    fr: "Au hockey sur glace, il y a hors-jeu lorsqu'un attaquant franchit la ligne bleue adverse pour entrer en zone offensive avant le palet. Le jeu s'arrête pour une mise au jeu hors de la zone.",
  },
  {
    id: "hockey-penalty-box",
    terms: ["penalty box", "sin bin in hockey", "banc des penalites", "banc de penalite", "prison au hockey"],
    source: NHL,
    en: "In ice hockey, a penalized player sits in the penalty box for the length of the penalty: usually 2 minutes for a minor and 5 for a major. Their team normally plays a player short for that time.",
    fr: "Au hockey sur glace, un joueur pénalisé reste sur le banc des pénalités pendant la durée de sa pénalité : en général 2 minutes pour une pénalité mineure et 5 pour une majeure. Son équipe joue normalement avec un joueur de moins pendant ce temps.",
  },
  {
    id: "cricket-powerplay",
    terms: sport(["power play", "powerplay"], CRICKET),
    source: ICC,
    en: "In limited-overs cricket, a powerplay is a set of overs in which only a few fielders may stand outside the inner circle. In a T20 it is the first 6 overs, with at most two fielders outside.",
    fr: "Au cricket à nombre d'overs limité, le powerplay est une série d'overs pendant laquelle seuls quelques joueurs de champ peuvent se placer hors du cercle intérieur. En T20, il couvre les 6 premiers overs, avec au plus deux joueurs de champ à l'extérieur.",
  },
  {
    id: "hockey-power-play",
    terms: ["power play", "powerplay", "avantage numerique", "superiorite numerique"],
    source: NHL,
    en: "In ice hockey, a team is on a power play when it has more skaters on the ice because an opponent is serving a penalty. A minor penalty ends early if the team on the power play scores.",
    fr: "Au hockey sur glace, une équipe est en avantage numérique lorsqu'elle compte plus de patineurs sur la glace parce qu'un adversaire purge une pénalité. Une pénalité mineure prend fin dès que l'équipe en avantage numérique marque.",
  },
  {
    id: "hockey-icing",
    terms: ["icing", "degagement interdit", "degagement refuse"],
    source: NHL,
    en: "In ice hockey, icing is called when a team sends the puck from its own side of the center line across the opposing goal line and nobody touches it. The faceoff then moves to the offending team's end. A team playing short-handed may ice the puck.",
    fr: "Au hockey sur glace, il y a dégagement interdit lorsqu'une équipe envoie le palet de son côté de la ligne centrale au-delà de la ligne de but adverse sans que personne ne le touche. La mise au jeu a alors lieu dans la zone de l'équipe fautive. Une équipe en infériorité numérique peut dégager ainsi.",
  },
  {
    id: "baseball-innings",
    terms: ["an inning", "inning", ...sport(["innings", "manche", "manches"], BASEBALL)],
    source: MLB,
    en: "In baseball, a game has nine innings. In each one, both teams bat until they have made three outs, with the home team batting second. A game tied after nine goes to extra innings.",
    fr: "Au baseball, un match compte neuf manches. Dans chacune, les deux équipes frappent jusqu'à trois retraits, l'équipe à domicile passant en second. Un match à égalité après neuf manches se poursuit en manches supplémentaires.",
  },
  {
    id: "baseball-ball",
    terms: sport(["ball", "balle", "a ball", "une balle"], BASEBALL),
    source: MLB,
    en: "In baseball, a ball is a pitch outside the strike zone that the batter does not swing at. Four balls give the batter a walk to first base.",
    fr: "Au baseball, une balle est un lancer hors de la zone de prise auquel le frappeur ne s'attaque pas. Quatre balles lui accordent un but sur balles.",
  },
  {
    id: "cricket-strike-rate",
    terms: ["strike rate", "strike-rate"],
    source: ICC,
    en: "In cricket, a batter's strike rate is their runs per 100 balls faced. A bowler's strike rate is the balls bowled per wicket taken.",
    fr: "Au cricket, le strike rate d'un batteur est son nombre de runs pour 100 balles reçues. Celui d'un lanceur est le nombre de balles lancées par wicket obtenu.",
  },
  {
    id: "baseball-strike",
    terms: ["a strike", "strikes", "strike zone", "strikeout", "zone de prise", ...sport(["strike", "prise"], BASEBALL)],
    source: MLB,
    en: "In baseball, a strike is a pitch in the strike zone that the batter does not hit, a swing that misses, or a foul ball with fewer than two strikes. Three strikes and the batter is out.",
    fr: "Au baseball, une prise est un lancer dans la zone de prise que le frappeur ne frappe pas, un élan manqué, ou une fausse balle avec moins de deux prises. À trois prises, le frappeur est retiré.",
  },
  {
    id: "baseball-home-run",
    terms: ["home run", "home-run", "homer", "coup de circuit", "circuit au baseball"],
    source: MLB,
    en: "In baseball, a home run is a hit that lets the batter round all the bases and score, usually by sending the ball over the outfield fence in fair territory. Any runners on base score too.",
    fr: "Au baseball, un coup de circuit est un coup qui permet au frappeur de faire le tour des buts et de marquer, le plus souvent en envoyant la balle au-delà de la clôture du champ extérieur en territoire des bonnes balles. Les coureurs sur les buts marquent aussi.",
  },
  {
    id: "baseball-balk",
    terms: ["balk", "feinte irreguliere"],
    source: MLB,
    en: "In baseball, a balk is an illegal motion by the pitcher with at least one runner on base, usually one meant to deceive the runner. Every runner moves up one base.",
    fr: "Au baseball, un balk est un geste irrégulier du lanceur alors qu'au moins un coureur est sur les buts, le plus souvent pour le tromper. Chaque coureur avance d'un but.",
  },
  {
    id: "baseball-rbi",
    terms: ["rbi", "rbis", "run batted in", "runs batted in", "point produit", "points produits"],
    source: MLB,
    en: "In baseball, a run batted in, or RBI, is credited to a batter for a run that scores because of their turn at bat. It is generally not credited on an error or a double play.",
    fr: "Au baseball, un point produit, ou RBI, est crédité au frappeur pour un point marqué grâce à sa présence au bâton. Il n'est généralement pas accordé sur une erreur ou un double jeu.",
  },
  {
    id: "volleyball-set",
    terms: sport(["set", "sets", "manche", "manches"], VOLLEYBALL),
    source: FIVB,
    en: "In volleyball, a set is played to 25 points with a two-point lead. A match is won by the first team to three sets, and a deciding fifth set goes to 15.",
    fr: "Au volley-ball, un set se joue en 25 points avec deux points d'écart. Le match revient à la première équipe qui gagne trois sets, et un cinquième set décisif se joue en 15 points.",
  },
  {
    id: "volleyball-rally-scoring",
    terms: ["rally scoring", "rally point", "volleyball scoring", "scoring in volleyball", "score au volley", "score au volley-ball", "comptage des points au volley"],
    source: FIVB,
    en: "In volleyball, every rally scores a point for the team that wins it, whichever side served. The team that wins the rally also serves next.",
    fr: "Au volley-ball, chaque échange rapporte un point à l'équipe qui le gagne, quelle que soit l'équipe au service. L'équipe qui remporte l'échange sert ensuite.",
  },
  {
    id: "volleyball-libero",
    terms: ["libero"],
    source: FIVB,
    en: "In volleyball, the libero is a defensive specialist in a contrasting shirt who replaces back-row players without it counting as a substitution. Under FIVB rules, the libero may not serve, block or attack from above the net.",
    fr: "Au volley-ball, le libéro est un spécialiste de la défense, en maillot de couleur différente, qui remplace les joueurs de la ligne arrière sans que cela compte comme un remplacement. Selon les règles de la FIVB, il ne peut ni servir, ni contrer, ni attaquer au-dessus du filet.",
  },
  {
    id: "volleyball-rotation",
    terms: ["rotation", ...sport(["rotation"], VOLLEYBALL)],
    source: FIVB,
    en: "In volleyball, when a team wins the serve back, its players rotate one position clockwise before serving. Each player must be in the right position when the ball is served.",
    fr: "Au volley-ball, lorsqu'une équipe reprend le service, ses joueurs tournent d'une position dans le sens des aiguilles d'une montre avant de servir. Chacun doit être à sa place au moment du service.",
  },
  {
    id: "motorsport-safety-car",
    terms: ["safety car", "safety-car", "voiture de securite"],
    source: FIA,
    en: "In motor racing, the safety car comes out when there is danger on track. It leads the field at reduced speed and cars may not overtake, which closes the gaps between them.",
    fr: "En sport automobile, la voiture de sécurité entre en piste lorsqu'un danger se présente. Elle mène le peloton à vitesse réduite et les dépassements sont interdits, ce qui resserre les écarts.",
  },
  {
    id: "set-piece",
    terms: ["set piece", "set-piece", "coup de pied arrete", "coups de pied arretes"],
    source: IFAB,
    en: "In football, a set piece is a restart with the ball stationary, such as a corner, free kick or penalty kick. Throw-ins are often counted too.",
    fr: "Au football, un coup de pied arrêté est une reprise du jeu avec le ballon immobile, comme un corner, un coup franc ou un penalty.",
  },
  {
    id: "two-point-conversion",
    terms: ["two-point conversion", "two point conversion", "2-point conversion", "2 point conversion", "conversion a deux points", "transformation a deux points"],
    source: NFL,
    en: "In American football, a team that scores a touchdown may run or pass the ball into the end zone from close range for 2 points, instead of kicking for 1.",
    fr: "Au football américain, une équipe qui marque un touchdown peut porter ou passer le ballon dans la zone d'en-but depuis une courte distance pour 2 points, au lieu de tenter un coup de pied pour 1 point.",
  },
  {
    id: "offside",
    terms: ["offside", "hors-jeu", "hors jeu"],
    source: IFAB,
    en: "In football, a player is in an offside position if, when a teammate plays the ball, they are in the opposing half and closer to the goal line than both the ball and the second-last opponent. Being in that position is an offense only if the player becomes involved in active play.",
    fr: "Au football, un joueur est en position de hors-jeu si, au moment où un coéquipier joue le ballon, il se trouve dans la moitié adverse et plus près de la ligne de but que le ballon et l'avant-dernier adversaire. Cette position n'est sanctionnée que si le joueur prend part au jeu.",
  },
  {
    id: "overtime",
    terms: ["overtime", "basketball overtime", "quarters", "quart-temps", "quart temps", ...inSport(["prolongation", "prolongations"], [], ["basket", "basketball"])],
    source: FIBA,
    en: "In basketball, a game has four quarters of 10 minutes under FIBA rules or 12 minutes in the NBA. If the score is tied at the end, 5-minute overtime periods are played until one team leads.",
    fr: "Au basketball, un match compte quatre quart-temps de 10 minutes selon les règles FIBA ou de 12 minutes en NBA. En cas d'égalité à la fin, des prolongations de 5 minutes sont jouées jusqu'à ce qu'une équipe mène.",
  },
  {
    id: "extra-time",
    terms: ["extra time", "prolongation", "prolongations", "penalty shootout", "tirs au but", "tab"],
    source: IFAB,
    en: "In football, a knockout match that is level after regular time may go to two extra periods of up to 15 minutes each, then kicks from the penalty mark if it is still level. The competition's rules decide which of these apply.",
    fr: "Au football, un match à élimination directe à égalité à la fin du temps réglementaire peut se prolonger par deux périodes d'au plus 15 minutes, puis par des tirs au but si l'égalité persiste. Le règlement de la compétition détermine ce qui s'applique.",
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
    id: "hockey-shootout",
    terms: ["shootout", "shoot-out", "tirs de barrage", "fusillade", ...sport(["overtime", "prolongation"], HOCKEY)],
    source: NHL,
    en: "In the NHL regular season, a game tied after three periods goes to 5 minutes of three-on-three overtime, where the next goal wins. If it stays tied, a shootout follows: players take turns one-on-one against the goalie, three each, then one each until it is settled. The winner gets one extra goal in the final score. Other leagues vary.",
    fr: "En saison régulière de la NHL, un match à égalité après trois périodes se poursuit par 5 minutes de prolongation à trois contre trois, où le premier but l'emporte. Si l'égalité persiste, une séance de tirs de barrage suit : les joueurs affrontent le gardien à tour de rôle, trois par équipe, puis un par équipe jusqu'à la décision. Le vainqueur reçoit un but de plus au score final. D'autres ligues procèdent autrement.",
  },
  {
    id: "cricket-lbw",
    terms: ["lbw", "leg before wicket", "leg before", "leg-before"],
    source: MCC,
    en: "In cricket, LBW means leg before wicket. A batter is out if the ball hits their body or pad first and would have gone on to hit the stumps. The ball must not have pitched outside leg stump, and if it hit the batter outside off stump, they must not have been trying to play a shot.",
    fr: "Au cricket, LBW signifie leg before wicket, ou jambe devant le guichet. Un batteur est éliminé si la balle touche d'abord son corps ou sa jambière et aurait ensuite frappé les piquets. La balle ne doit pas avoir rebondi à l'extérieur du piquet de jambe et, si elle a touché le batteur à l'extérieur du piquet hors-jambe, il ne doit pas avoir tenté de la jouer.",
  },
  {
    id: "cricket-overs",
    terms: ["an over", "overs", "un over", ...sport(["over"], CRICKET)],
    source: MCC,
    en: "In cricket, an over is six legal deliveries bowled from one end. Wides and no-balls do not count toward the six. A bowler may not bowl two overs in a row.",
    fr: "Au cricket, un over est une série de six lancers réguliers depuis une même extrémité. Les wides et les no-balls ne comptent pas dans les six. Un lanceur ne peut pas enchaîner deux overs consécutifs.",
  },
  {
    id: "cricket-wicket",
    terms: ["wicket", "wickets", "guichet", "guichets"],
    source: MCC,
    en: "In cricket, the wicket is the three stumps and two bails at each end of the pitch. The word also means the dismissal of a batter, and a side's innings ends when ten of its eleven batters are out.",
    fr: "Au cricket, le wicket, ou guichet, désigne les trois piquets et les deux témoins à chaque extrémité du terrain. Le mot désigne aussi l'élimination d'un batteur, et la manche d'une équipe prend fin lorsque dix de ses onze batteurs sont éliminés.",
  },
  {
    id: "cricket-innings",
    terms: ["innings", ...sport(["manche", "manches"], CRICKET)],
    source: MCC,
    en: "In cricket, an innings is a side's turn to bat. It ends when ten batters are out, the overs run out, or the captain declares. Each side has one innings in limited-overs cricket and up to two in Tests and other first-class matches.",
    fr: "Au cricket, une manche est le tour de batte d'une équipe. Elle prend fin lorsque dix batteurs sont éliminés, que les overs sont épuisés ou que le capitaine déclare. Chaque équipe a une manche dans les formats à overs limités et jusqu'à deux en Test et dans les autres matchs de première classe.",
  },
  {
    id: "cricket-duck",
    terms: ["a duck", "golden duck", "un duck", ...sport(["duck"], CRICKET)],
    source: ICC,
    en: "In cricket, a duck is a batter's innings ended without scoring a run. A golden duck is getting out to the first ball faced.",
    fr: "Au cricket, un duck désigne un batteur éliminé sans avoir marqué de run. Un golden duck désigne une élimination dès la première balle reçue.",
  },
  {
    id: "cricket-dls",
    terms: ["dls", "duckworth-lewis-stern", "duckworth lewis stern", "duckworth-lewis", "duckworth lewis", "d/l method"],
    source: ICC,
    en: "In limited-overs cricket, the Duckworth-Lewis-Stern method sets a revised target when weather shortens a match. It weighs the overs remaining and the wickets in hand, not just the run rate.",
    fr: "Au cricket à overs limités, la méthode Duckworth-Lewis-Stern fixe un objectif révisé lorsque la météo écourte un match. Elle tient compte des overs restants et des wickets disponibles, et pas seulement du rythme de score.",
  },
  {
    id: "cricket-test",
    terms: ["test cricket", "test match", "test matches", "test-match", "test-matchs", "test matchs", ...sport(["test"], CRICKET)],
    source: ICC,
    en: "A Test is the longest form of cricket, played between national teams over up to five days. Each side can bat twice, and a match that runs out of time is a draw.",
    fr: "Le Test est la forme la plus longue du cricket, disputée entre équipes nationales sur cinq jours au plus. Chaque équipe peut frapper deux fois, et un match qui arrive à son terme sans décision est nul.",
  },
  {
    id: "cricket-odi",
    terms: ["odi", "odis", "one day international", "one-day international", "one day internationals", "one-day internationals"],
    source: ICC,
    en: "A One Day International, or ODI, is an international cricket match of 50 overs a side, usually finished in a day.",
    fr: "Un One Day International, ou ODI, est un match international de cricket de 50 overs par équipe, le plus souvent joué en une journée.",
  },
  {
    id: "cricket-t20",
    terms: ["t20", "t20s", "t20i", "twenty20"],
    source: ICC,
    en: "T20, or Twenty20, is cricket's short format, with 20 overs a side and a match lasting about three hours.",
    fr: "Le T20, ou Twenty20, est le format court du cricket, avec 20 overs par équipe et un match d'environ trois heures.",
  },
  {
    id: "american-football-downs",
    terms: ["downs", "a down", "first down", "fourth down", "premier down", "un down", ...sport(["down"], GRIDIRON)],
    source: NFL,
    en: "In American football, the offense has four downs, or plays, to gain 10 yards. Doing so earns a new set of four. If it fails, the other team takes over, so on fourth down teams often punt or try a field goal. Canadian football has three downs.",
    fr: "Au football américain, l'attaque dispose de quatre tentatives, les downs, pour gagner 10 yards. Si elle y parvient, elle en obtient quatre nouvelles. Sinon, le ballon change de camp : au quatrième down, les équipes dégagent donc souvent au pied ou tentent un field goal. Le football canadien se joue en trois downs.",
  },
  {
    id: "american-football-touchdown",
    terms: ["touchdown", "touchdowns", "td in american football"],
    source: NFL,
    en: "In American football, a touchdown is worth 6 points. A team scores one by carrying the ball into the opposing end zone or catching it there. It then tries for 1 or 2 extra points.",
    fr: "Au football américain, un touchdown vaut 6 points. Une équipe le marque en portant le ballon dans la zone d'en-but adverse ou en l'y attrapant. Elle tente ensuite de marquer 1 ou 2 points supplémentaires.",
  },
  {
    id: "american-football-field-goal",
    terms: ["field goal", "field goals", "coup de pied de placement"],
    source: NFL,
    en: "In American football, a field goal is worth 3 points. A team scores one by kicking the ball from the ground through the uprights during a play from scrimmage.",
    fr: "Au football américain, un field goal vaut 3 points. Une équipe le marque en bottant le ballon, placé au sol, entre les poteaux au cours d'un jeu.",
  },
  {
    id: "american-football-safety",
    terms: ["a safety", "un safety", ...sport(["safety"], GRIDIRON)],
    source: NFL,
    en: "In American football, a safety gives the defense 2 points, most often when a ball carrier is tackled in their own end zone. The team that gave up the safety then kicks the ball away.",
    fr: "Au football américain, un safety rapporte 2 points à la défense, le plus souvent lorsqu'un porteur du ballon est plaqué dans sa propre zone d'en-but. L'équipe qui l'a concédé doit ensuite rendre le ballon par un coup de pied.",
  },
  {
    id: "tennis-deuce",
    terms: ["deuce", "egalite au tennis", "avantage au tennis"],
    source: ITF,
    en: "In tennis, deuce is 40-40 in a game. A player must then win two points in a row to take it: the first is called advantage, and losing the next returns to deuce.",
    fr: "Au tennis, l'égalité est le score de 40-40 dans un jeu. Un joueur doit alors gagner deux points de suite : le premier donne l'avantage, et perdre le suivant ramène à l'égalité.",
  },
  {
    id: "tennis-tie-break",
    terms: ["tie-break", "tie break", "tiebreak", "tiebreaker", "jeu decisif"],
    source: ITF,
    en: "In tennis, a tie-break usually settles a set at 6-6. The first player to 7 points with a two-point lead wins it. At the Grand Slams, a final set at 6-6 goes to a tie-break to 10.",
    fr: "Au tennis, un tie-break, ou jeu décisif, départage le plus souvent un set à 6-6. Le premier joueur à 7 points avec deux points d'écart l'emporte. En Grand Chelem, une dernière manche à 6-6 se joue en un tie-break de 10 points.",
  },
  {
    id: "tennis-set",
    terms: ["a set", "un set", "manche", "manches", ...sport(["set", "sets"], TENNIS)],
    source: ITF,
    en: "In tennis, a set goes to the first player to win 6 games with a two-game lead, or to the winner of a tie-break at 6-6. Matches are usually best of three sets, or best of five for men at the Grand Slams.",
    fr: "Au tennis, un set revient au premier joueur qui gagne 6 jeux avec deux jeux d'écart, ou au vainqueur d'un tie-break à 6-6. Les matchs se jouent le plus souvent au meilleur des trois sets, ou des cinq pour les hommes en Grand Chelem.",
  },
  {
    id: "tennis-ace",
    terms: ["an ace", "aces", "un ace", "des aces", ...sport(["ace", "as"], TENNIS)],
    source: ITF,
    en: "In tennis, an ace is a legal serve that the receiver does not touch. It wins the point for the server.",
    fr: "Au tennis, un ace est un service valable que le relanceur ne touche pas. Le point revient au serveur.",
  },
  {
    id: "tennis-let",
    terms: ["a let", "un let", "let serve", "let call", "balle let", ...sport(["let"], TENNIS)],
    source: ITF,
    en: "In tennis, a let is a serve that touches the net and then lands in the correct service box. It is served again with no penalty. A let can also be called to replay a point after an interruption.",
    fr: "Au tennis, un let est un service qui touche le filet puis retombe dans le bon carré de service. Il est rejoué sans pénalité. Un let peut aussi être annoncé pour rejouer un point après une interruption.",
  },
  {
    id: "rugby-try",
    terms: ["a try", "un essai", "tries in rugby", "essais au rugby", ...sport(["try", "essai"], RUGBY)],
    source: WORLD_RUGBY,
    en: "In rugby, a try is scored by grounding the ball in the opposing in-goal area. It is worth 5 points in rugby union and 4 in rugby league, and the scoring team then attempts a conversion.",
    fr: "Au rugby, un essai est marqué en aplatissant le ballon dans l'en-but adverse. Il vaut 5 points au rugby à XV et 4 points au rugby à XIII, et l'équipe qui marque tente ensuite la transformation.",
  },
  {
    id: "rugby-conversion",
    terms: ["conversion", "conversions", "transformation au rugby", "une transformation"],
    source: WORLD_RUGBY,
    en: "In rugby, a conversion is the kick at goal after a try, taken in line with where the ball was grounded. It is worth 2 points.",
    fr: "Au rugby, la transformation est le coup de pied au but qui suit un essai, tiré dans l'axe de l'endroit où le ballon a été aplati. Elle vaut 2 points.",
  },
  {
    id: "rugby-scrum",
    terms: ["scrum", "scrums", "melee", "melees"],
    source: WORLD_RUGBY,
    en: "In rugby union, a scrum restarts play after a minor offense such as a knock-on. Eight forwards from each side bind together and push, and the ball is fed into the tunnel between them.",
    fr: "Au rugby à XV, la mêlée relance le jeu après une faute mineure comme un en-avant. Les huit avants de chaque équipe se lient et poussent, et le ballon est introduit dans le tunnel entre les deux packs.",
  },
  {
    id: "rugby-ruck",
    terms: ["ruck", "rucks"],
    source: WORLD_RUGBY,
    en: "In rugby union, a ruck forms when players from each side, on their feet and in contact, close around the ball on the ground. They must use their feet to win it, not their hands.",
    fr: "Au rugby à XV, un ruck se forme lorsque des joueurs de chaque équipe, debout et au contact, se regroupent autour du ballon au sol. Ils doivent le gagner avec les pieds, sans les mains.",
  },
  {
    id: "rugby-lineout",
    terms: ["lineout", "lineouts", "line-out", "line out", "lancer en touche", "remise en touche", "alignement au rugby", ...sport(["touche"], RUGBY)],
    source: WORLD_RUGBY,
    en: "In rugby union, a lineout restarts play after the ball goes into touch. The forwards form two lines and a player throws the ball straight down the middle, where teammates can be lifted to catch it.",
    fr: "Au rugby à XV, la touche relance le jeu lorsque le ballon sort en touche. Les avants forment deux lignes et un joueur lance le ballon droit entre elles, où des coéquipiers peuvent être soulevés pour le capter.",
  },
  {
    id: "rugby-drop-goal",
    terms: ["drop goal", "drop-goal", "dropped goal", "le drop", "un drop", ...sport(["drop"], RUGBY)],
    source: WORLD_RUGBY,
    en: "In rugby, a drop goal is kicked through the posts in open play, with the ball touching the ground just before the kick. It is worth 3 points in rugby union and usually 1 in rugby league.",
    fr: "Au rugby, un drop est un coup de pied entre les poteaux en cours de jeu, le ballon touchant le sol juste avant la frappe. Il vaut 3 points au rugby à XV et le plus souvent 1 point au rugby à XIII.",
  },
  {
    id: "combat-tko",
    terms: ["tko", "technical knockout", "technical knock-out", "ko technique", "k-o technique"],
    source: ABC,
    en: "In combat sports, a technical knockout, or TKO, is when the referee, the doctor or a corner stops the fight because a fighter cannot safely continue, without that fighter being counted out.",
    fr: "Dans les sports de combat, un KO technique, ou TKO, survient lorsque l'arbitre, le médecin ou le coin arrête le combat parce qu'un combattant ne peut plus continuer sans danger, sans qu'il ait été compté KO.",
  },
  {
    id: "combat-split-decision",
    terms: ["split decision", "decision partagee"],
    source: ABC,
    en: "In combat sports, a split decision is a fight that goes to the judges, where two score it for one fighter and the third for the other.",
    fr: "Dans les sports de combat, une décision partagée est un combat tranché par les juges, deux donnant la victoire à un combattant et le troisième à l'autre.",
  },
  {
    id: "combat-submission",
    terms: ["submission", "submissions", "soumission", "soumissions"],
    source: ABC,
    en: "In mixed martial arts, a submission is a win that comes when an opponent gives up, by tapping out or saying so, usually because of a choke or a joint lock.",
    fr: "En arts martiaux mixtes, une soumission est une victoire obtenue lorsque l'adversaire abandonne, en tapant ou en le disant, le plus souvent à cause d'un étranglement ou d'une clé.",
  },
  {
    id: "combat-weight-classes",
    terms: ["weight class", "weight classes", "weight division", "weight divisions", "categorie de poids", "categories de poids"],
    source: ABC,
    en: "In combat sports, weight classes group fighters by a maximum weight, checked at a weigh-in before the fight. In the UFC, the men's divisions run from flyweight, at 125 pounds, to heavyweight, at 265.",
    fr: "Dans les sports de combat, les catégories de poids regroupent les combattants selon un poids maximal, vérifié à une pesée avant le combat. À l'UFC, les catégories masculines vont des poids mouches, à 125 livres, aux poids lourds, à 265 livres.",
  },
  {
    id: "motorsport-pole-position",
    terms: ["pole position", "the pole", "la pole", ...sport(["pole"], RACING)],
    source: FIA,
    en: "In motor racing, pole position is the first place on the starting grid. In Formula 1, it goes to the fastest driver in the final part of qualifying.",
    fr: "En sport automobile, la pole position est la première place sur la grille de départ. En Formule 1, elle revient au pilote le plus rapide de la dernière partie des qualifications.",
  },
  {
    id: "motorsport-drs",
    terms: ["drs", "drag reduction system"],
    source: FIA,
    en: "DRS, the drag reduction system, was a moving rear wing flap in Formula 1 that a driver close behind another car could open in set zones for more speed. From 2026, Formula 1 replaced it with active aerodynamics and an overtake mode.",
    fr: "Le DRS, système de réduction de traînée, était un volet mobile de l'aileron arrière en Formule 1, qu'un pilote proche de la voiture de devant pouvait ouvrir dans des zones définies pour gagner en vitesse. Depuis 2026, la Formule 1 l'a remplacé par une aérodynamique active et un mode de dépassement.",
  },
  {
    id: "motorsport-pit-stop",
    terms: ["pit stop", "pit stops", "pit-stop", "pitstop", "pitstops", "arret au stand", "arret aux stands", "arrets aux stands"],
    source: FIA,
    en: "In motor racing, a pit stop is a stop in the pit lane for new tires, repairs or, in series that allow it, fuel. Refueling has been banned in Formula 1 since 2010.",
    fr: "En sport automobile, un arrêt au stand est une halte dans la voie des stands pour changer de pneus, faire des réparations ou, dans les championnats qui l'autorisent, ravitailler. Le ravitaillement est interdit en Formule 1 depuis 2010.",
  },
  {
    id: "motorsport-sprint",
    terms: ["sprint", "sprint race", "course sprint", ...sport(["sprint"], RACING)],
    source: FIA,
    en: "In Formula 1, a sprint is a short race of about 100 kilometers on selected weekends, with no required pit stop. The top eight finishers score points, from 8 down to 1.",
    fr: "En Formule 1, un sprint est une courte course d'environ 100 kilomètres disputée lors de certains week-ends, sans arrêt au stand obligatoire. Les huit premiers marquent des points, de 8 à 1.",
  },
]

// "c'est quoi l'icing" reaches the lookup as one word, since an apostrophe does not split it.
const elided = (term: string) => (/^[aeiouy]/.test(term) ? [term, `l'${term}`] : [term])

export const REFERENCE: ReferenceEntry[] = ENTRIES.map((entry) => ({ ...entry, terms: entry.terms.flatMap(elided) }))
