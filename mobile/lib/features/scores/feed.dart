import '../../core/api/api_client.dart';
import '../../core/i18n.dart';
import '../../models/json.dart';
import '../../models/preferences.dart';
import '../../models/sport.dart';

/// A local day's games, built like the web's Scores page (lib/local-day.ts): the
/// feed files games by UTC date, so the app reads every UTC date the device's
/// day overlaps and keeps the games that start on it locally.
class DayFeed {
  DayFeed({required this.date, required this.events, required this.state, required this.limited, required this.nextDates, required this.nextByKind, this.fetchedAt});
  final String date;
  final List<SportEvent> events;
  final String state;
  final bool limited;
  final List<Json> nextDates;
  final Json nextByKind;
  final String? fetchedAt;

  bool get anyLive => events.any((e) => e.isLive);
}

String _utcIso(DateTime d) => Fmt.isoDate(d.toUtc());

/// The UTC dates a local calendar day overlaps.
List<String> utcDatesFor(DateTime localDay) {
  final start = DateTime(localDay.year, localDay.month, localDay.day);
  final end = DateTime(localDay.year, localDay.month, localDay.day, 23, 59, 59);
  final dates = <String>{_utcIso(start), _utcIso(end)};
  return dates.toList()..sort();
}

/// A game with a time belongs to the day it starts on locally; a date-only game
/// (or a multi-day cricket match) keeps the date it was filed under.
bool onLocalDay(SportEvent e, String date, String filedUnder) {
  final d = e.details;
  final cricketDay = d != null && d['kind'] == 'cricket' && d['matchDay'] != null;
  if (e.startUTC == null || e.dateOnly || cricketDay) return filedUnder == date;
  final s = e.start;
  return s != null && Fmt.isoDate(s) == date;
}

Future<DayFeed> fetchLocalDay(DateTime localDay, {String? sport}) async {
  final date = Fmt.isoDate(localDay);
  final utc = utcDatesFor(localDay);
  final results = await Future.wait(utc.map((u) async {
    try {
      return (u, asMap(await api.get('/matches', query: {'date': u, 'sport': sport, 'pageSize': 3000})));
    } on ApiException catch (e) {
      // A neighbouring UTC date outside the server's window is not an error for the day.
      if (e.status == 400 && u != date && utc.length > 1) return (u, <String, dynamic>{});
      rethrow;
    }
  }));
  final seen = <String>{};
  final events = <SportEvent>[];
  var state = 'ok';
  var limited = false;
  String? fetchedAt;
  List<Json> nextDates = [];
  Json nextByKind = {};
  for (final (filed, j) in results) {
    if (j.isEmpty) continue;
    final s = str(j['state'], 'ok');
    if (s != 'ok' && state == 'ok') state = s;
    limited = limited || asBool(j['limited']);
    fetchedAt ??= asString(j['fetchedAt']);
    if (filed == date || nextDates.isEmpty) {
      final nd = asMapList(j['nextDates']);
      if (nd.isNotEmpty) nextDates = nd;
      final nk = asMap(j['nextByKind']);
      if (nk.isNotEmpty) nextByKind = nk;
    }
    for (final e in SportEvent.list(j['events'])) {
      if (!onLocalDay(e, date, filed)) continue;
      if (seen.add(e.id)) events.add(e);
    }
  }
  events.sort((a, b) => (a.startUTC ?? '').compareTo(b.startUTC ?? ''));
  return DayFeed(date: date, events: events, state: state, limited: limited, nextDates: nextDates, nextByKind: nextByKind, fetchedAt: fetchedAt);
}

// ---- Following (lib/sports/following.ts) ----

List<String> followedNames(Preferences p) => [
      ...p.favorites,
      ...p.players.map((x) => asString(x['team'])).whereType<String>(),
    ];

bool followsEvent(List<String> names, SportEvent e) {
  if (names.isEmpty) return false;
  final entrants = e.scoreKind == 'classification' ? e.classification.map((x) => str(x['name'])) : const <String>[];
  return [...e.participants.map((p) => p.rawName), ...entrants].any((n) => n != 'TBD' && names.contains(n));
}

bool isFollowed(Preferences p, SportEvent e) =>
    followsEvent(followedNames(p), e) || p.leagues.any((l) => str(l['id']) == e.competitionId);

int followPriority(Preferences p, SportEvent e) {
  final names = followedNames(p);
  for (var i = 0; i < names.length; i++) {
    if (followsEvent([names[i]], e)) return i;
  }
  final li = p.leagues.indexWhere((l) => str(l['id']) == e.competitionId);
  return li == -1 ? 1 << 30 : names.length + li;
}

bool followsAnything(Preferences p) => p.favoriteTotal > 0;

/// Followed games sorted by follow priority, then status, then time.
List<SportEvent> followedGames(Preferences p, List<SportEvent> events) {
  final list = events.where((e) => isFollowed(p, e)).toList();
  list.sort((a, b) {
    final f = followPriority(p, a).compareTo(followPriority(p, b));
    if (f != 0) return f;
    final s = a.statusRank.compareTo(b.statusRank);
    if (s != 0) return s;
    return (a.startUTC ?? '').compareTo(b.startUTC ?? '');
  });
  return list;
}

bool canRemind(SportEvent e) {
  final s = e.start;
  return e.isScheduled && !e.dateOnly && s != null && s.isAfter(DateTime.now());
}

// ---- Kinds (lib/sports/score-filters.ts) ----

const cricketKinds = ['test', 'odi', 't20', 'first-class', 'hundred'];
const _sessionKinds = {
  'race': 'race', 'sprint': 'race', 'qualifying': 'qualifying', 'sprint-qualifying': 'qualifying',
  'practice': 'practice', 'testing': 'practice', 'stage': 'stage',
};

String? kindOf(SportEvent e) {
  final d = e.details;
  if (d == null) return null;
  switch (d['kind']) {
    case 'cricket':
      return asString(d['format']);
    case 'combat':
      return asString(d['discipline']);
    case 'rugby':
      return asString(d['code']);
    case 'tennis':
      final format = asString(d['format']);
      final gender = asString(d['gender']);
      if (format == 'team-tie') return 'team-tie';
      if (gender == 'mixed') return 'mixed';
      if (format == 'doubles') return '${gender ?? 'any'}-doubles';
      return gender;
    case 'motorsport':
      return _sessionKinds[asString(d['session'])];
  }
  return null;
}

List<(String, int)> kindOptions(String? sport, List<SportEvent> events) {
  final counts = <String, int>{};
  for (final e in events) {
    final k = kindOf(e);
    if (k != null) counts[k] = (counts[k] ?? 0) + 1;
  }
  if (sport == 'cricket') return cricketKinds.map((k) => (k, counts[k] ?? 0)).toList();
  if (counts.length <= 1) return [];
  final keys = counts.keys.toList()..sort();
  return keys.map((k) => (k, counts[k]!)).toList();
}

String kindLabel(String k) => switch (k) {
      'test' => tr('Test', 'Test'),
      'odi' => 'ODI',
      't20' => 'T20',
      'first-class' => tr('First-class', 'First-class'),
      'hundred' => tr('The Hundred', 'The Hundred'),
      'race' => tr('Races', 'Courses'),
      'qualifying' => tr('Qualifying', 'Qualifications'),
      'practice' => tr('Practice', 'Essais'),
      'stage' => tr('Stages', 'Étapes'),
      'boxing' => tr('Boxing', 'Boxe'),
      'mma' => 'MMA',
      'kickboxing' => 'Kickboxing',
      'muay-thai' => 'Muay thaï',
      'bare-knuckle' => tr('Bare knuckle', 'Poings nus'),
      'union' => tr('Union', 'XV'),
      'league' => tr('League', 'XIII'),
      'sevens' => tr('Sevens', 'À VII'),
      'team-tie' => tr('Team events', 'Par équipes'),
      'mixed' => tr('Mixed doubles', 'Double mixte'),
      'men' => tr("Men's singles", 'Simple messieurs'),
      'women' => tr("Women's singles", 'Simple dames'),
      'men-doubles' => tr("Men's doubles", 'Double messieurs'),
      'women-doubles' => tr("Women's doubles", 'Double dames'),
      'any-doubles' => tr('Doubles', 'Double'),
      _ => k,
    };

// ---- Africa (lib/sports/africa.ts) ----

const _africanNations = [
  'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroon', 'Cape Verde', 'Central African Republic', 'Chad', 'Comoros', 'Congo', 'DR Congo',
  'Djibouti', 'Egypt', 'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Ivory Coast', 'Kenya', 'Lesotho',
  'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'Sao Tome and Principe',
  'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe',
];
const _also = ["Cote d'Ivoire", "Côte d'Ivoire", 'Democratic Republic of Congo', 'Republic of Congo', 'Swaziland', 'The Gambia'];
const _demonyms = [
  'Algerian', 'Angolan', 'Beninese', 'Botswanan', 'Burkinabe', 'Burundian', 'Cameroonian', 'Congolese', 'Egyptian', 'Ethiopian', 'Gabonese', 'Gambian', 'Ghanaian', 'Guinean',
  'Ivorian', 'Kenyan', 'Liberian', 'Libyan', 'Malawian', 'Malian', 'Mauritanian', 'Moroccan', 'Mozambican', 'Namibian', 'Nigerian', 'Rwandan', 'Senegalese', 'South African',
  'Sudanese', 'Tanzanian', 'Togolese', 'Tunisian', 'Ugandan', 'Zambian', 'Zimbabwean',
];

final _countries = {..._africanNations, ..._also}.map((n) => n.toLowerCase()).toSet();
final _names = ([..._africanNations, ..._also]..sort((a, b) => b.length.compareTo(a.length))).map(RegExp.escape).join('|');
final _continental = RegExp(r"^CAF\b|\bAfrica(?:n)? (?:Cup|Nations|Champions|Football|Games)|\bAFCON\b|\bCOSAFA\b|\bCECAFA\b|\bWAFU\b", caseSensitive: false);
final _domestic = RegExp('^(?:${[..._demonyms.map(RegExp.escape), _names].join('|')})(?![\\w-])', caseSensitive: false);
final _otherContinent = RegExp(r'^(?:UEFA|AFC|CONCACAF|CONMEBOL|OFC)\b', caseSensitive: false);
final _nationalTeam = RegExp('^(?:$_names)(?: (?:U-?\\d{2}|Women|Basketball|Rugby|Cricket|Volleyball|Hockey))*\$', caseSensitive: false);

bool isAfricanCompetition(String name, String? country) {
  if (_otherContinent.hasMatch(name)) return false;
  return _continental.hasMatch(name) || _domestic.hasMatch(name) || _countries.contains((country ?? '').toLowerCase());
}

bool isAfricanEvent(SportEvent e) {
  if (isAfricanCompetition(e.competitionName, e.competitionCountry)) return true;
  return e.participantType == 'team' && e.participants.any((p) => _nationalTeam.hasMatch(p.rawName.trim()));
}

// ---- League links (leaguePath in event-card.tsx) ----

const _tableSports = {'basketball', 'american-football', 'rugby', 'baseball', 'ice-hockey', 'volleyball', 'cricket'};
final _neverATable = RegExp(
  r"^_|(?<!currie )\bcup\b|\bcopa\b|\bcoupe\b|\bsupercup\b|\bsupercopa\b|\bncaa\b|\ball[- ]?stars?\b|\bfriendlies\b|\bseries$|\bclassic\b|\bworld club challenge\b|\bstate of origin\b|\blions tours\b|\bsummer league\b|\bolympics\b|\bcommonwealth games\b|\basian games\b",
  caseSensitive: false,
);

bool canHaveTable(String sportId, String league) => _tableSports.contains(sportId) && !_neverATable.hasMatch(league);

/// The competition's page: a league view for collected sports, a table otherwise.
String? leagueRoute({required String? id, required String sportId, required String name, String participantType = 'team'}) {
  if (id == null || !RegExp(r'^\d{1,8}$').hasMatch(id)) return null;
  if (Sport.leagueCollected.contains(sportId)) return '/league/$id';
  final table = participantType == 'team' && (sportId == 'football' || canHaveTable(sportId, name));
  return table ? '/standings/$id' : null;
}

String? leagueRouteFor(SportEvent e) =>
    leagueRoute(id: e.competitionId, sportId: e.sportId, name: e.competitionName, participantType: e.participantType);

/// Matches grouped by sport, one from each in turn (interleave).
List<SportEvent> interleaveBySport(List<SportEvent> events) {
  final groups = <String, List<SportEvent>>{};
  for (final e in events) {
    groups.putIfAbsent(e.sportId, () => []).add(e);
  }
  final lists = groups.values.toList();
  final longest = lists.fold<int>(0, (m, l) => l.length > m ? l.length : m);
  return [for (var t = 0; t < longest; t++) for (final l in lists) if (t < l.length) l[t]];
}
