import 'package:flutter/material.dart';

import '../core/i18n.dart';
import 'json.dart';

/// The sports the backend serves (lib/sports/types.ts SPORTS).
class Sport {
  const Sport(this.id, this.en, this.fr, this.icon, this.color);
  final String id, en, fr;
  final IconData icon;
  final Color color;

  String get name => tr(en, fr);

  static const all = <Sport>[
    Sport('football', 'Football', 'Football', Icons.sports_soccer_rounded, Color(0xFF1A7F45)),
    Sport('basketball', 'Basketball', 'Basketball', Icons.sports_basketball_rounded, Color(0xFFE5732B)),
    Sport('american-football', 'American football', 'Football américain', Icons.sports_football_rounded, Color(0xFF7A4B2A)),
    Sport('baseball', 'Baseball', 'Baseball', Icons.sports_baseball_rounded, Color(0xFFB4232C)),
    Sport('ice-hockey', 'Ice hockey', 'Hockey sur glace', Icons.sports_hockey_rounded, Color(0xFF1E5BB8)),
    Sport('tennis', 'Tennis', 'Tennis', Icons.sports_tennis_rounded, Color(0xFF8DA800)),
    Sport('cricket', 'Cricket', 'Cricket', Icons.sports_cricket_rounded, Color(0xFF0E7C86)),
    Sport('rugby', 'Rugby', 'Rugby', Icons.sports_rugby_rounded, Color(0xFF5B3FA8)),
    Sport('volleyball', 'Volleyball', 'Volley-ball', Icons.sports_volleyball_rounded, Color(0xFFD9A400)),
    Sport('combat-sports', 'Combat sports', 'Sports de combat', Icons.sports_mma_rounded, Color(0xFFC8102E)),
    Sport('motorsport', 'Motorsport', 'Sport automobile', Icons.sports_motorsports_rounded, Color(0xFF3A4B66)),
  ];

  static Sport? byId(String? id) {
    for (final s in all) {
      if (s.id == id) return s;
    }
    return null;
  }

  static String nameOf(String? id) => byId(id)?.name ?? (id ?? '');
  static IconData iconOf(String? id) => byId(id)?.icon ?? Icons.emoji_events_rounded;

  static const individual = {'tennis', 'combat-sports', 'motorsport'};
  static const leagueCollected = {'cricket', 'tennis', 'combat-sports', 'motorsport'};
}

/// Race series (lib/sports/seasons.ts RACE_SERIES).
const raceSeries = <(String, String)>[
  ('4370', 'Formula 1'), ('4407', 'MotoGP'), ('4413', 'WEC'), ('4371', 'Formula E'), ('4373', 'IndyCar Series'),
  ('4393', 'NASCAR Cup Series'), ('4573', "NASCAR O'Reilly Auto Parts Series"), ('4486', 'Formula 2'), ('4487', 'Formula 3'),
  ('4436', 'Moto2'), ('4437', 'Moto3'), ('4454', 'SBK'), ('4409', 'WRC'), ('4372', 'BTCC'), ('4438', 'DTM'),
  ('4489', 'V8 Supercars'), ('4488', 'IMSA SportsCar Championship'), ('4412', 'Super GT series'),
  ('4410', 'British GT Championship'), ('4447', 'Dakar Rally'),
];

/// Cup competitions (lib/sports/seasons.ts CUP_COMPETITIONS).
const cupCompetitions = <(String, String)>[
  ('4429', 'FIFA World Cup'), ('4480', 'UEFA Champions League'), ('4481', 'UEFA Europa League'), ('4482', 'FA Cup'),
  ('4570', 'EFL Cup'), ('4501', 'Copa Libertadores'), ('4724', 'Copa Sudamericana'), ('4502', 'UEFA European Championships'),
  ('4499', 'Copa America'), ('4565', "FIFA Women's World Cup"), ('4889', "UEFA Women's Champions League"),
  ('4720', 'CAF Champions League'),
];

class Participant {
  Participant(this.j);
  final Json j;
  String? get id => asString(j['id']);
  String get rawName => str(j['name'], 'TBD');
  String get name => rawName == 'TBD' ? tr('TBD', 'À déterminer') : rawName;
  String get role => str(j['role']);
  String? get badgeUrl => asString(j['badgeUrl']);
}

/// One fixture, bout or session (SportEvent in lib/sports/types.ts).
class SportEvent {
  SportEvent(this.j);
  factory SportEvent.from(dynamic v) => SportEvent(asMap(v));
  static List<SportEvent> list(dynamic v) => asMapList(v).map(SportEvent.new).toList();

  final Json j;

  String get id => str(j['id']);
  String get sportId => str(j['sportId']);
  String get eventType => str(j['eventType']);
  String get participantType => str(j['participantType']);
  List<Participant> get participants => asMapList(j['participants']).map(Participant.new).toList();
  String? get eventName => asString(j['eventName']);
  Json get competition => asMap(j['competition']);
  String get competitionName => str(competition['name']);
  String? get competitionId => asString(competition['id']);
  String? get competitionCountry => asString(competition['country']);
  DateTime? get start => Fmt.parse(asString(j['scheduledStartUTC']));
  String? get startUTC => asString(j['scheduledStartUTC']);
  bool get dateOnly => asBool(j['dateOnly']);
  String get status => str(j['status'], 'unknown');
  String? get clock => asString(j['clock']);
  String? get conclusion => asString(j['conclusion']);
  Json? get shootout => j['shootout'] is Map ? asMap(j['shootout']) : null;
  Json? get aggregate => j['aggregate'] is Map ? asMap(j['aggregate']) : null;
  Json? get breakdown => j['breakdown'] is Map ? asMap(j['breakdown']) : null;
  Json? get details => j['details'] is Map ? asMap(j['details']) : null;
  String? get providerStatus => asString(j['providerStatus']);
  Json get score => asMap(j['score']);
  String get scoreKind => str(score['kind'], 'none');
  String? get venue => asString(j['venue']);
  String? get thumbnailUrl => asString(j['thumbnailUrl']);
  String? get sourceUpdatedAt => asString(j['sourceUpdatedAt']);

  bool get isLive => status == 'live';
  bool get isFinished => status == 'finished';
  bool get isScheduled => status == 'scheduled';
  bool get hasResult => scoreKind != 'none';

  /// Two sides that are not a classification: rendered as "home v away".
  bool get isDuel => participants.length == 2 && scoreKind != 'classification';

  String get title => isDuel ? participants.map((p) => p.name).join(' / ') : (eventName?.isNotEmpty == true ? eventName! : competitionName);

  Participant? get home => participants.isNotEmpty ? participants.first : null;
  Participant? get away => participants.length > 1 ? participants[1] : null;

  String get clockText {
    final c = clock;
    if (c == null || c.isEmpty) return '';
    return RegExp(r'^\d+(?:\+\d+)?$').hasMatch(c) ? "$c′" : c;
  }

  /// One value per participant row (rowValues in presentation.ts).
  List<String?> get rowValues {
    final s = score;
    switch (scoreKind) {
      case 'team':
        return [asInt(s['home'])?.toString(), asInt(s['away'])?.toString()];
      case 'innings':
        return [_inningsLine(s['homeInnings'], s['home']), _inningsLine(s['awayInnings'], s['away'])];
      case 'sets':
        final lines = asMapList(s['lines']);
        return participants.map((p) {
          final line = lines.where((l) => str(l['name']) == p.rawName).firstOrNull;
          final games = line == null ? <String>[] : (line['games'] as List? ?? []).map((g) => g.toString()).toList();
          return games.isEmpty ? null : games.join(' ');
        }).toList();
      default:
        return participants.map((_) => null).toList();
    }
  }

  static String? _inningsText(dynamic v) {
    final m = v is Map ? asMap(v) : null;
    if (m == null) return null;
    final runs = asInt(m['runs']) ?? 0;
    final wickets = asInt(m['wickets']);
    final score = wickets == null ? '$runs' : '$runs/$wickets';
    return '$score${asBool(m['declared']) ? 'd' : ''}';
  }

  static String? _inningsLine(dynamic list, dynamic total) {
    if (list is List && list.isNotEmpty) return list.map(_inningsText).whereType<String>().join(' & ');
    return _inningsText(total);
  }

  int? get homeScore => scoreKind == 'team' ? asInt(score['home']) : null;
  int? get awayScore => scoreKind == 'team' ? asInt(score['away']) : null;

  /// Sets won by each side, or null.
  (int, int)? get setsWon {
    if (scoreKind != 'sets' || score['retired'] != null || asBool(score['walkover']) || participants.length != 2) return null;
    final lines = asMapList(score['lines']);
    List<int>? games(Participant p) {
      final l = lines.where((x) => str(x['name']) == p.rawName).firstOrNull;
      return l == null ? null : (l['games'] as List? ?? []).map((g) => asInt(g) ?? 0).toList();
    }

    final a = games(participants[0]), b = games(participants[1]);
    if (a == null || b == null || a.isEmpty || a.length != b.length) return null;
    var wa = 0, wb = 0;
    for (var i = 0; i < a.length; i++) {
      if (a[i] > b[i]) wa++;
      if (b[i] > a[i]) wb++;
    }
    return (wa, wb);
  }

  /// The line naming the outcome (resultNote in presentation.ts).
  String? get resultNote {
    final s = score;
    if (scoreKind == 'sets') {
      if (s['retired'] != null) return tr('${s['retired']} retired', '${s['retired']} a abandonné');
      if (asBool(s['walkover']) && s['winner'] != null) return tr('${s['winner']} won by walkover', '${s['winner']} gagne par forfait');
      return s['winner'] != null ? tr('${s['winner']} won', '${s['winner']} gagne') : null;
    }
    if (scoreKind == 'innings') {
      final outcome = asString(s['outcome']);
      if (outcome != null && outcome != 'won') {
        return {
          'drawn': tr('Match drawn', 'Match nul'),
          'tied': tr('Match tied', 'Égalité'),
          'no-result': tr('No result', 'Sans résultat'),
        }[outcome];
      }
      final winner = asString(s['winner']);
      if (winner == null) return null;
      final margin = asMap(s['margin']);
      if (margin.isEmpty) return tr('$winner won', '$winner gagne');
      final value = asInt(margin['value']) ?? 0;
      final unit = str(margin['unit']);
      final unitText = unit == 'runs'
          ? (value == 1 ? tr('run', 'point') : tr('runs', 'points'))
          : (value == 1 ? tr('wicket', 'guichet') : tr('wickets', 'guichets'));
      final won = asBool(s['byInnings'])
          ? tr('$winner won by an innings and $value $unitText', '$winner gagne par une manche et $value $unitText')
          : tr('$winner won by $value $unitText', '$winner gagne par $value $unitText');
      return asString(s['method']) == 'dls' ? '$won (DLS)' : won;
    }
    if (scoreKind == 'combat') return combatText(s);
    return null;
  }

  static String combatMethod(String? m) => switch (m) {
        'unanimous-decision' => tr('Unanimous decision', 'Décision unanime'),
        'split-decision' => tr('Split decision', 'Décision partagée'),
        'majority-decision' => tr('Majority decision', 'Décision majoritaire'),
        'decision' => tr('Decision', 'Décision'),
        'ko' => 'KO',
        'tko' => 'TKO',
        'submission' => tr('Submission', 'Soumission'),
        'disqualification' => tr('Disqualification', 'Disqualification'),
        _ => m ?? '',
      };

  static String combatText(Json s) {
    final parts = <String>[tr('${s['winner']} won', '${s['winner']} gagne')];
    if (s['method'] != null) parts.add(combatMethod(asString(s['method'])));
    final round = asInt(s['round']);
    if (round != null) parts.add('${tr('Round', 'Round')} $round${s['time'] != null ? ' (${s['time']})' : ''}');
    return parts.join(', ');
  }

  /// Compact score for list rows, e.g. "2 - 1", "3-1 sets", "245/6".
  String? get compactScore {
    switch (scoreKind) {
      case 'team':
        return '${homeScore ?? 0} - ${awayScore ?? 0}';
      case 'sets':
        final w = setsWon;
        return w == null ? null : '${w.$1} - ${w.$2}';
      default:
        return null;
    }
  }

  /// Top three of a classification.
  List<Json> get classification => asMapList(score['entries']);

  /// The status as members read it (statusText in event-card.tsx).
  String get statusLabel {
    switch (status) {
      case 'live':
        return tr('Live', 'En direct');
      case 'finished':
        return tr('Final', 'Terminé');
      case 'scheduled':
        return tr('Scheduled', 'Prévu');
      case 'postponed':
        return tr('Postponed', 'Reporté');
      case 'canceled':
        return tr('Canceled', 'Annulé');
      case 'interrupted':
        return tr('Interrupted', 'Interrompu');
      case 'abandoned':
        return tr('Abandoned', 'Abandonné');
      default:
        final d = details;
        final days = d != null && d['kind'] == 'cricket' ? asInt(d['scheduledDays']) : null;
        final day = d != null && d['kind'] == 'cricket' ? asInt(d['matchDay']) : null;
        if (days != null && day != null && day >= 1 && day <= days) return tr('Day $day of $days', 'Jour $day sur $days');
        return tr('Awaiting result', 'Résultat attendu');
    }
  }

  String? get conclusionLabel => switch (conclusion) {
        'extra-time' => tr('After extra time', 'Après prolongation'),
        'overtime' => tr('After overtime', 'Après prolongation'),
        'penalties' => tr('After penalties', 'Aux tirs au but'),
        'shootout' => tr('After shootout', 'Aux tirs de barrage'),
        'awarded' => tr('Awarded', 'Sur tapis vert'),
        'walkover' => tr('Walkover', 'Forfait'),
        _ => null,
      };

  /// The time column of a row: kickoff time, a live clock, or the status.
  String get timeLabel {
    if (isLive) return clockText.isNotEmpty ? clockText : tr('Live', 'Direct');
    if (isScheduled) {
      final d = start;
      if (d == null) return tr('TBC', 'À confirmer');
      return dateOnly ? Fmt.dayMonth(d) : Fmt.time(d);
    }
    return statusLabel;
  }

  /// Legacy "important" ranking for sorting by status then time.
  int get statusRank => switch (status) { 'live' => 0, 'interrupted' => 1, 'scheduled' => 2, 'finished' => 3, _ => 4 };

  bool involves(String name) {
    final n = name.toLowerCase();
    return participants.any((p) => p.rawName.toLowerCase() == n);
  }

  String? get kickoffLabel {
    final d = start;
    if (d == null) return null;
    return dateOnly ? Fmt.relativeDay(d) : '${Fmt.relativeDay(d)} · ${Fmt.time(d)}';
  }
}

/// A day's feed (EventFeed).
class EventFeed {
  EventFeed(this.j);
  final Json j;
  String get state => str(j['state'], 'ok');
  List<SportEvent> get events => SportEvent.list(j['events']);
  bool get limited => asBool(j['limited']);
  String? get fetchedAt => asString(j['fetchedAt']);
  int get total => asInt(j['total']) ?? events.length;
  List<Json> get nextDates => asMapList(j['nextDates']);
  Json get nextByKind => asMap(j['nextByKind']);
}
