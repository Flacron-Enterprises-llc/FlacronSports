# Coverage

This records what the live site was actually returning. It is a snapshot, not a promise. Coverage changes with the season and the provider, and no competition or country is guaranteed.

## How this was checked

On 2026-11-06, the live public routes were read for three dates: `/api/matches` for 6, 7 and 8 November 2026, and `/api/watch`. Every date returned a healthy, unlimited feed. For a live view at any time, use the Coverage screen in admin.

Three days around one weekend cannot show the whole calendar. A sport with few events here may simply be between events.

## Scores and fixtures

Source: TheSportsDB, paid key. Counts are for the three days.

| Sport | Events | Competitions | Most frequent competitions seen |
|---|---|---|---|
| Football | 2,468 | 348 | FA Cup, Netherlands Derde Divisie Saturday, Turkish 2 Lig, Welsh Cymru North-South, Scottish Lowland League East, Algerian Ligue 1, American Major League Soccer, Argentinian Primera Division, English League Championship |
| Basketball | 461 | 51 | NCAA Division I Basketball Mens, NBA, NBA G League, Japanese B1 League, Spanish Segunda FEB, French LNB Pro B, Spanish Liga ACB |
| Ice hockey | 274 | 16 | NCAA Division 1 Ice Hockey, American ECHL, NHL, American AHL, Canadian OHL, QMJHL and WHL, Russian KHL |
| American football | 134 | 3 | NCAA Division 1 Football, NFL, CFL |
| Rugby | 48 | 10 | World Rugby Nations Cup, French Top 14, French Pro D2, French Nationale, Nations Championship, English RFU Championship, Rugby League World Cup |
| Baseball | 36 | 4 | Mexican Pacific League, Venezuelan Professional Baseball League, Liga de Béisbol Profesional Roberto Clemente, Korean KBO League |
| Motorsport | 35 | 10 | V8 Supercars, WEC, MotoGP, Formula 1, Super GT, NASCAR Cup, Xfinity and Truck, Moto2, Moto3 |
| Volleyball | 32 | 6 | Turkish, Italian, French, Russian, Polish and Belgian top leagues |
| Combat sports | 8 | 5 | Boxing, UFC, BKFC, Oktagon MMA, ONE |
| Cricket | 1 | 1 | One Day International Series |
| Tennis | 0 | 0 | **Nothing returned on these three dates** |

Football's 348 competitions are mostly regional and lower leagues. Tennis and cricket need rechecking across a longer period before any claim is made about them.

The spec asks for a coverage matrix of sport, competition and season for schedules, live scoring, participants, statistics, standings and video. That has **not** been done. Live scores, lineups, statistics and timelines exist for covered games only, and the provider does not say in advance which games those are. Screens leave out what is missing rather than show zeros.

Which competitions count as "major" (for reports and ordering) is the list in `lib/sports/priority.ts`.

## Video

There are no live streams and no replays. The site has no broadcast rights.

| Source | Sports | Observed on 2026-11-06 |
|---|---|---|
| YouTube highlights, approved official channels only, through YouTube's player | Any listed by the feed | 24 listed, the most the page shows: 23 from the NHL channel and 1 from the NFL channel |
| ScoreBat football clips | Football only | 24 listed: Spain National Cup 9, Netherlands National Cup 6, England League Cup 3, Brazil Serie A 2, Germany National Cup 2, Italy Serie A 1, Portugal League Cup 1 |

## Viewing territories

**Playback by country has not been tested.** FlacronSport does not enforce territory itself. Each provider's own player decides what can play where, and a video can fail in one country and work in another. The spec requires real target-country playback tests, and these remain to be done.

TV listings show where a game airs. They do not mean it can be watched on this site, and a broadcaster's subscription may be needed. Countries seen in the 30 listings on 2026-11-06: United States, Slovenia, Croatia, Spain, United Kingdom, Australia, New Zealand, Denmark, France, Austria, Greece, Bulgaria, Serbia, Canada, Sweden, Norway, Iceland and The Netherlands, plus entries labelled World.

## Open dependencies

- Approved YouTube channel list needs owner or counsel review.
- ScoreBat plan and commercial terms need confirming. On the free tier, clips were limited and at least 7 days old, and the same-day clip check on 2026-11-06 suggests a paid token.
- Whether a paid wall around these embeds is allowed by the providers' terms needs confirming (D-034).
- African competitions were seen, such as Algerian Ligue 1, but no dedicated coverage review has been done.
