import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../models/json.dart';

/// A published report (lib/content/reports.ts Report).
class Report {
  Report(this.j);
  final Json j;

  String get id => str(j['id']);
  String get slug => str(j['slug']);
  String get matchId => str(j['matchId']);
  String get sportId => str(j['sportId']);
  String get type => str(j['type']);
  String get title => str(j['title']);
  String get body => str(j['body']);
  List<String> get participants => asStringList(j['participants']);
  String get competition => str(j['competition']);
  String? get correctionNote => asString(j['correctionNote']);
  String? get publishedAt => asString(j['publishedAt']);
  String? get updatedAt => asString(j['updatedAt']);
  DateTime? get published => Fmt.parse(publishedAt);
  DateTime? get updated => Fmt.parse(updatedAt);
}

String reportTypeLabel(String type) => switch (type) {
      'result' => tr('Result', 'Résultat'),
      'recap' => tr('Recap', 'Compte rendu'),
      'preview' => tr('Preview', 'Avant-match'),
      'roundup' => tr('Daily roundup', 'Le point du jour'),
      _ => type,
    };

const reportTypes = ['preview', 'result', 'recap', 'roundup'];

/// filterReports in lib/content/news.ts.
List<Report> filterReports(List<Report> reports, {String? team, String? competition, String? type, String? q}) {
  final needle = q?.trim().toLowerCase() ?? '';
  return reports.where((r) {
    if (team != null && team.isNotEmpty && !r.participants.contains(team)) return false;
    if (competition != null && competition.isNotEmpty && r.competition != competition) return false;
    if (type != null && type.isNotEmpty && r.type != type) return false;
    if (needle.isNotEmpty && ![r.title, r.competition, ...r.participants].any((t) => t.toLowerCase().contains(needle))) return false;
    return true;
  }).toList();
}

/// reportTeams: names from single-game reports, sorted.
List<String> reportTeams(List<Report> reports) {
  final names = <String>{};
  for (final r in reports) {
    if (r.type != 'roundup') names.addAll(r.participants.where((p) => p.isNotEmpty));
  }
  return names.toList()..sort((a, b) => a.compareTo(b));
}

/// reportCompetitions: busiest first.
List<String> reportCompetitions(List<Report> reports) {
  final counts = <String, int>{};
  for (final r in reports) {
    if (r.competition.isNotEmpty) counts[r.competition] = (counts[r.competition] ?? 0) + 1;
  }
  final list = counts.entries.toList()
    ..sort((a, b) {
      final c = b.value.compareTo(a.value);
      return c != 0 ? c : a.key.compareTo(b.key);
    });
  return list.map((e) => e.key).toList();
}

const newsPageSize = 12;

/// The news feed for one sport ('' = all sports).
final newsFeedProvider = FutureProvider.autoDispose.family<({String state, List<Report> reports}), String>((ref, sport) async {
  ref.watch(authUserProvider);
  final res = asMap(await api.get('/reports', query: {'locale': AppLocale.code, 'feed': 'news', 'sport': sport.isEmpty ? null : sport}));
  return (state: str(res['state'], 'ok'), reports: asMapList(res['reports']).map(Report.new).toList());
});

/// Reports about the member's teams (Plus/Premium). Null when not allowed.
final forYouProvider = FutureProvider.autoDispose<Json?>((ref) async {
  final account = ref.watch(accountProvider).value;
  if (account == null || !account.plusFeatures) return null;
  try {
    return asMap(await api.get('/reports/mine', query: {'locale': AppLocale.code}));
  } on ApiException catch (e) {
    if (e.status == 403 || e.status == 402) return null;
    rethrow;
  }
});

final savedReportsProvider = FutureProvider.autoDispose<List<Json>>((ref) async {
  ref.watch(authUserProvider);
  final res = asMap(await api.get('/me/saved-reports', query: {'locale': AppLocale.code}));
  return asMapList(res['reports']);
});

/// Slugs the member has saved, kept in memory so bookmark buttons stay in step.
final savedSlugsProvider = NotifierProvider<SavedSlugs, Set<String>>(SavedSlugs.new);

class SavedSlugs extends Notifier<Set<String>> {
  bool _loaded = false;

  @override
  Set<String> build() {
    ref.watch(authUserProvider);
    _loaded = false;
    _load();
    return <String>{};
  }

  Future<void> _load() async {
    try {
      final res = asMap(await api.get('/me/saved-reports', query: {'locale': AppLocale.code}));
      if (_loaded) return;
      _loaded = true;
      state = asMapList(res['reports']).map((r) => str(r['slug'])).toSet();
    } catch (e) {
      debugPrint('saved reports: $e');
    }
  }

  /// Returns true when the report is now saved.
  Future<bool> toggle(String slug) async {
    final saved = state.contains(slug);
    state = saved ? ({...state}..remove(slug)) : {...state, slug};
    try {
      if (saved) {
        await api.delete('/me/saved-reports', body: {'slug': slug});
      } else {
        await api.post('/me/saved-reports', body: {'slug': slug});
      }
      ref.invalidate(savedReportsProvider);
      return !saved;
    } catch (e) {
      state = saved ? {...state, slug} : ({...state}..remove(slug));
      rethrow;
    }
  }
}
