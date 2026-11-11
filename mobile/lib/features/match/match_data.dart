import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/i18n.dart';
import '../../models/json.dart';
import '../../models/sport.dart';

/// GET /api/matches/{id}.
final matchProvider = FutureProvider.autoDispose.family<SportEvent, String>((ref, id) async {
  final res = asMap(await api.get('/matches/${Uri.encodeComponent(id)}'));
  return SportEvent(asMap(res['event']));
});

/// GET /api/matches/{id}/detail (timeline, stats, lineups). Only valid for tsdb ids.
final matchDetailProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) async {
  if (!RegExp(r'^tsdb-\d{1,12}$').hasMatch(id)) return {'state': 'empty', 'timeline': [], 'stats': [], 'lineups': {'home': [], 'away': []}};
  return asMap(await api.get('/matches/${Uri.encodeComponent(id)}/detail'));
});

/// GET /api/matches/{id}/viewing-options.
final viewingProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) async {
  return asMap(await api.get('/matches/${Uri.encodeComponent(id)}/viewing-options'));
});

/// Race weekend of a motorsport session (GET /api/motorsport/{series}).
final raceScheduleProvider = FutureProvider.autoDispose.family<Json, String>((ref, series) async {
  return asMap(await api.get('/motorsport/$series'));
});

/// A team's recent fixtures, for the form strip (GET /api/teams).
final teamFixturesProvider = FutureProvider.autoDispose.family<Json, (String, String)>((ref, key) async {
  return asMap(await api.get('/teams', query: {'name': key.$1, 'sport': key.$2}));
});

// Sports whose source has no running timeline or team statistics (match page rules).
const noTimeline = {'basketball', 'american-football', 'baseball', 'rugby', 'volleyball', 'cricket', 'tennis', 'combat-sports', 'motorsport'};
const noStatistics = {'ice-hockey', 'american-football', 'baseball', 'rugby', 'volleyball', 'cricket', 'tennis', 'combat-sports', 'motorsport'};
const kickoffSports = {'football', 'american-football', 'rugby'};

/// isStaleUpdate in lib/sports/detail.ts: 5 min for live, 3 h for scheduled/interrupted.
bool isStaleUpdate(SportEvent e) {
  final at = DateTime.tryParse(e.sourceUpdatedAt ?? '');
  if (at == null) return false;
  final age = DateTime.now().toUtc().difference(at.toUtc());
  if (e.isLive) return age > const Duration(minutes: 5);
  return (e.status == 'scheduled' || e.status == 'interrupted') && age > const Duration(hours: 3);
}

// ---------- Predictions (lib/community/predictions.ts, pick-rules.ts) ----------

class ScoreRule {
  const ScoreRule(this.max, this.unit, this.canEndLevel);
  final int max;
  final String unit;
  final bool canEndLevel;
}

const scoreRules = <String, ScoreRule>{
  'football': ScoreRule(30, 'goals', true),
  'ice-hockey': ScoreRule(30, 'goals', true),
  'rugby': ScoreRule(150, 'points', true),
  'american-football': ScoreRule(100, 'points', false),
  'baseball': ScoreRule(50, 'runs', false),
  'volleyball': ScoreRule(3, 'sets', false),
};

final _notARace = RegExp(r'\b(practice|qualifying|sprint|shootout|warm.?up)\b', caseSensitive: false);
final _testCricket = RegExp(r'\btest\b', caseSensitive: false);

String? predictionKind(SportEvent e) {
  final parts = e.participants;
  if (e.participantType == 'team' && parts.length == 2 && scoreRules.containsKey(e.sportId)) return 'score';
  if (e.sportId == 'motorsport') {
    final d = e.details;
    final race = d != null && d['kind'] == 'motorsport' && d['session'] == 'race';
    return e.eventType == 'session' && race && (e.eventName ?? '').isNotEmpty && !_notARace.hasMatch(e.eventName!) ? 'podium' : null;
  }
  if (parts.length != 2 || parts.any((p) => p.rawName == 'TBD')) return null;
  if (e.sportId == 'tennis' || e.sportId == 'combat-sports' || e.sportId == 'basketball') return 'winner';
  if (e.sportId == 'cricket') {
    final d = e.details;
    final format = d != null && d['kind'] == 'cricket' ? asString(d['format']) : null;
    final limited = format != 'test' && format != 'first-class' && !_testCricket.hasMatch(e.competitionName);
    return limited ? 'winner' : null;
  }
  return null;
}

bool predictionOpen(SportEvent e) {
  final start = DateTime.tryParse(e.startUTC ?? '');
  return e.status == 'scheduled' && !e.dateOnly && start != null && DateTime.now().toUtc().isBefore(start.toUtc());
}

String scoreUnitLabel(String unit) => switch (unit) {
      'goals' => tr('Goals', 'Buts'),
      'points' => tr('Points', 'Points'),
      'runs' => tr('Runs', 'Points'),
      'sets' => tr('Sets', 'Sets'),
      _ => unit,
    };

List<String> get podiumPlaces => [tr('1st', '1er'), tr('2nd', '2e'), tr('3rd', '3e')];

/// pickWords in lib/community/pick-words.ts.
String pickWords(Json pick, String? home, String? away) {
  final podium = asStringList(pick['podium']);
  if (podium.isNotEmpty) {
    final places = podiumPlaces;
    return [for (var i = 0; i < podium.length; i++) '${i < places.length ? places[i] : '${i + 1}'}: ${podium[i]}'].join(', ');
  }
  final winner = asString(pick['winner']);
  if (winner != null) return tr('$winner to win', 'Victoire de $winner');
  final score = '${pick['home']} – ${pick['away']}';
  return home != null && away != null ? '$home $score $away' : score;
}
