import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';
import '../../widgets/event_tile.dart';
import '../scores/event_actions.dart';
import '../scores/feed.dart';
import '../team/team_screen.dart' show FormPill;

final _leagueProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) async => asMap(await api.get('/leagues/$id')));
final _standingsProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) async => asMap(await api.get('/standings/$id')));
final _cupsProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) async => asMap(await api.get('/cups/$id')));
final _motorsportProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) async => asMap(await api.get('/motorsport/$id')));

Widget _stateNote(BuildContext context, String state) {
  if (state != 'stale') return const SizedBox.shrink();
  return Padding(
    padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
    child: Text(tr('This may be out of date: the latest update could not be confirmed.', 'Peut-être pas à jour : la dernière mise à jour n\'a pas pu être confirmée.'),
        style: context.text.bodySmall?.copyWith(color: context.fs.warning)),
  );
}

Widget _unavailable(BuildContext context, VoidCallback retry) => StateView(
      icon: Icons.cloud_off_rounded,
      title: tr('Temporarily unavailable', 'Temporairement indisponible'),
      message: tr('Please try again shortly.', 'Réessayez dans un instant.'),
      action: tr('Retry', 'Réessayer'),
      onAction: retry,
    );

Future<void> _refresh(Future<Json> future) async {
  try {
    await future;
  } catch (_) {}
}

// ---------------- League ----------------

/// A league collected per competition (cricket, tennis, combat, motorsport).
class LeagueScreen extends ConsumerWidget {
  const LeagueScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final async = ref.watch(_leagueProvider(id));
    final data = async.value;
    final name = asString(data?['competition']);
    final sportId = asString(data?['sportId']);
    final upcoming = SportEvent.list(data?['upcoming']);
    final recent = SportEvent.list(data?['recent']);
    final prefs = ref.watch(prefsValueProvider);
    final follows = prefs.followsLeague(id);
    final table = sportId != null && name != null && (sportId == 'football' || canHaveTable(sportId, name));

    return Scaffold(
      appBar: AppBar(
        title: Text(name ?? tr('Competition', 'Compétition'), maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          if (name != null && sportId != null)
            IconButton(
              tooltip: follows ? tr('Unfollow', 'Ne plus suivre') : tr('Follow', 'Suivre'),
              onPressed: () async {
                try {
                  await ref.read(prefsProvider.notifier).toggleLeague(id, name, sportId);
                } catch (e) {
                  if (context.mounted) toast(context, errorText(e), error: true);
                }
              },
              icon: Icon(follows ? Icons.star_rounded : Icons.star_outline_rounded, color: follows ? c.accent : null),
            ),
        ],
      ),
      body: async.hasError && data == null
          ? ErrorView(error: async.error!, onRetry: () => ref.invalidate(_leagueProvider(id)))
          : data == null
              ? const SkeletonList()
              : RefreshIndicator(
                  onRefresh: () {
                    ref.invalidate(_leagueProvider(id));
                    return _refresh(ref.read(_leagueProvider(id).future));
                  },
                  child: ListView(
                    padding: const EdgeInsets.only(bottom: 40),
                    children: [
                      if (sportId != null)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                          child: Row(children: [
                            Icon(Sport.iconOf(sportId), size: 16, color: c.ink3),
                            const SizedBox(width: 6),
                            Text(Sport.nameOf(sportId), style: context.text.bodySmall),
                          ]),
                        ),
                      _stateNote(context, str(data['state'])),
                      if (table)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                          child: FsCard(
                            onTap: () => context.push('/standings/$id'),
                            child: Row(children: [
                              Icon(Icons.format_list_numbered_rounded, color: c.accent),
                              const SizedBox(width: 12),
                              Expanded(child: Text(tr('Standings', 'Classement'), style: context.text.titleSmall)),
                              Icon(Icons.chevron_right_rounded, color: c.ink3),
                            ]),
                          ),
                        ),
                      if (str(data['state']) == 'unavailable')
                        _unavailable(context, () => ref.invalidate(_leagueProvider(id)))
                      else if (upcoming.isEmpty && recent.isEmpty)
                        StateView.empty(tr('No games listed for this competition', 'Aucun match listé'), icon: Icons.event_busy_rounded),
                      if (upcoming.isNotEmpty) ...[
                        SectionHeader(tr('Coming up', 'À venir'), icon: Icons.schedule_rounded),
                        for (var i = 0; i < upcoming.length; i++) _eventRow(context, ref, upcoming[i], i),
                      ],
                      if (recent.isNotEmpty) ...[
                        SectionHeader(tr('Results', 'Résultats'), icon: Icons.emoji_events_rounded),
                        for (var i = 0; i < recent.length; i++) _eventRow(context, ref, recent[i], i),
                      ],
                    ],
                  ),
                ),
    );
  }
}

Widget _eventRow(BuildContext context, WidgetRef ref, SportEvent e, int i) => Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: GestureDetector(
        onLongPress: () => showEventActions(context, ref, e),
        child: EventTile(event: e, showCompetition: e.eventName != null).entrance(i),
      ),
    );

// ---------------- Standings ----------------

class _Zone {
  _Zone(this.label, this.places, this.color);
  final String label, places;
  final Color color;
}

List<_Zone> _zones(List<Json> rows, FsColors c) {
  final map = <String, List<int>>{};
  for (final r in rows) {
    final z = asString(r['zone']);
    final rank = asInt(r['rank']);
    if (z != null && z.isNotEmpty && rank != null) map.putIfAbsent(z, () => []).add(rank);
  }
  final up = [c.success, c.info, const Color(0xFF0E7C86), const Color(0xFF7A5AF8), c.warning];
  var n = 0;
  final entries = map.entries.toList()..sort((a, b) => a.value.reduce((x, y) => x < y ? x : y).compareTo(b.value.reduce((x, y) => x < y ? x : y)));
  String ranges(List<int> ranks) {
    final sorted = ranks.toSet().toList()..sort();
    final out = <List<int>>[];
    for (final r in sorted) {
      if (out.isNotEmpty && r == out.last[1] + 1) {
        out.last[1] = r;
      } else {
        out.add([r, r]);
      }
    }
    return out.map((x) => x[0] == x[1] ? '${x[0]}' : '${x[0]}-${x[1]}').join(', ');
  }

  return [
    for (final e in entries)
      _Zone(e.key, ranges(e.value), RegExp('relegation', caseSensitive: false).hasMatch(e.key) ? c.danger : up[n++ % up.length]),
  ];
}

class StandingsScreen extends ConsumerWidget {
  const StandingsScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final async = ref.watch(_standingsProvider(id));
    final data = async.value;
    final rows = asMapList(data?['rows']);
    final league = asString(data?['league']);
    final season = asString(data?['season']);
    final calc = data?['calculated'] is Map ? asMap(data!['calculated']) : null;
    final unit = asString(calc?['unit']);
    final prefs = ref.watch(prefsValueProvider);
    final zones = _zones(rows, c);
    final isCup = cupCompetitions.any((x) => x.$1 == id);

    final (forLabel, againstLabel) = switch (unit) {
      'points' => (tr('PF', 'PP'), tr('PA', 'PC')),
      'goals' => (tr('GF', 'BP'), tr('GA', 'BC')),
      'sets' => (tr('SF', 'SP'), tr('SA', 'SC')),
      'runs' || 'baseball-runs' => (tr('RF', 'PP'), tr('RA', 'PC')),
      _ => (tr('F', 'P'), tr('A', 'C')),
    };

    // Only columns that hold a value somewhere.
    final cols = <(String key, String label, String Function(Json))>[
      ('played', tr('P', 'J'), (r) => asInt(r['played'])?.toString() ?? '–'),
      ('won', tr('W', 'G'), (r) => asInt(r['won'])?.toString() ?? '–'),
      ('drawn', tr('D', 'N'), (r) => asInt(r['drawn'])?.toString() ?? '–'),
      ('lost', tr('L', 'P'), (r) => asInt(r['lost'])?.toString() ?? '–'),
      ('overtimeLosses', tr('OTL', 'DP'), (r) => asInt(r['overtimeLosses'])?.toString() ?? '–'),
      ('winPercent', '%', (r) => asDouble(r['winPercent']) == null ? '–' : (asDouble(r['winPercent'])! * 100).toStringAsFixed(1)),
      ('scoredFor', forLabel, (r) => asInt(r['scoredFor'])?.toString() ?? '–'),
      ('scoredAgainst', againstLabel, (r) => asInt(r['scoredAgainst'])?.toString() ?? '–'),
      ('difference', '+/-', (r) {
        final d = asInt(r['difference']);
        return d == null ? '–' : (d > 0 ? '+$d' : '$d');
      }),
      ('points', tr('Pts', 'Pts'), (r) => asInt(r['points'])?.toString() ?? '–'),
    ].where((col) => rows.any((r) => r[col.$1] != null)).toList();
    final hasForm = rows.any((r) => asString(r['form'])?.isNotEmpty == true);

    return Scaffold(
      appBar: AppBar(title: Text(league ?? tr('Standings', 'Classement'), maxLines: 1, overflow: TextOverflow.ellipsis)),
      body: async.hasError && data == null
          ? ErrorView(error: async.error!, onRetry: () => ref.invalidate(_standingsProvider(id)))
          : data == null
              ? const SkeletonList(count: 10, height: 40)
              : RefreshIndicator(
                  onRefresh: () {
                    ref.invalidate(_standingsProvider(id));
                    return _refresh(ref.read(_standingsProvider(id).future));
                  },
                  child: ListView(
                    padding: const EdgeInsets.only(bottom: 40),
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                        child: Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                          if (season != null) Pill(season, icon: Icons.calendar_today_rounded),
                          if (isCup)
                            ActionChip(
                              avatar: const Icon(Icons.account_tree_rounded, size: 16),
                              label: Text(tr('Knockout rounds', 'Phases finales')),
                              onPressed: () => context.push('/cups?competition=$id'),
                            ),
                        ]),
                      ),
                      if (calc != null)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                          child: FsCard(
                            padding: const EdgeInsets.all(14),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(tr('Calculated table', 'Classement calculé'), style: context.text.titleSmall),
                              const SizedBox(height: 4),
                              Text(
                                tr('Built from ${asInt(calc['games']) ?? 0} results, the latest on ${_date(asString(calc['latestGame']))}.',
                                    'Établi à partir de ${asInt(calc['games']) ?? 0} résultats, le dernier le ${_date(asString(calc['latestGame']))}.'),
                                style: context.text.bodySmall,
                              ),
                              if (unit == 'runs')
                                Text(tr('Cricket tables here count wins and runs, not net run rate.', 'Les classements de cricket comptent victoires et points, pas le net run rate.'),
                                    style: context.text.bodySmall),
                              if (asBool(calc['stale']))
                                Text(tr('Some recent results may be missing.', 'Certains résultats récents peuvent manquer.'), style: context.text.bodySmall?.copyWith(color: c.warning)),
                            ]),
                          ),
                        ),
                      if (str(data['state']) == 'unavailable')
                        _unavailable(context, () => ref.invalidate(_standingsProvider(id)))
                      else if (rows.isEmpty)
                        StateView.empty(tr('No table for this competition yet', 'Pas encore de classement'), icon: Icons.table_rows_outlined)
                      else
                        SpoilerGuard(
                          label: tr('Reveal table', 'Afficher le classement'),
                          child: SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            child: FsCard(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                _tableRow(
                                  context,
                                  rank: '#',
                                  team: tr('Team', 'Équipe'),
                                  values: cols.map((x) => x.$2).toList(),
                                  form: hasForm ? tr('Form', 'Forme') : null,
                                  header: true,
                                ),
                                Divider(height: 1, color: c.line),
                                for (final r in rows)
                                  Builder(builder: (context) {
                                    final team = str(r['team']);
                                    final fav = prefs.isFavorite(team);
                                    final zone = zones.where((z) => z.label == asString(r['zone'])).firstOrNull;
                                    return InkWell(
                                      onTap: () => context.push('/team/${Uri.encodeComponent(team)}'),
                                      child: _tableRow(
                                        context,
                                        rank: asInt(r['rank'])?.toString() ?? '–',
                                        team: team,
                                        values: cols.map((x) => x.$3(r)).toList(),
                                        formString: hasForm ? (asString(r['form']) ?? '') : null,
                                        highlight: fav,
                                        zoneColor: zone?.color,
                                      ),
                                    );
                                  }),
                              ]),
                            ),
                          ),
                        ),
                      if (zones.isNotEmpty) ...[
                        SectionHeader(tr('Zones', 'Zones'), icon: Icons.layers_rounded),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: FsCard(
                            child: Column(children: [
                              for (final z in zones)
                                Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 5),
                                  child: Row(children: [
                                    Container(width: 4, height: 18, decoration: BoxDecoration(color: z.color, borderRadius: BorderRadius.circular(2))),
                                    const SizedBox(width: 10),
                                    SizedBox(width: 56, child: Text(z.places, style: context.text.titleSmall)),
                                    Expanded(child: Text(z.label, style: context.text.bodyMedium)),
                                  ]),
                                ),
                            ]),
                          ),
                        ),
                      ],
                      if (Fmt.parse(asString(data['fetchedAt'])) != null)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                          child: Text(tr('Updated ${Fmt.full(Fmt.parse(asString(data['fetchedAt']))!)}', 'Mis à jour ${Fmt.full(Fmt.parse(asString(data['fetchedAt']))!)}'),
                              style: context.text.bodySmall),
                        ),
                    ],
                  ),
                ),
    );
  }

  static String _date(String? iso) {
    final d = iso == null ? null : DateTime.tryParse(iso);
    return d == null ? '–' : Fmt.dayMonthYear(d);
  }

  Widget _tableRow(BuildContext context,
      {required String rank,
      required String team,
      required List<String> values,
      String? form,
      String? formString,
      bool header = false,
      bool highlight = false,
      Color? zoneColor}) {
    final c = context.fs;
    final style = header
        ? context.text.labelSmall
        : TextStyle(fontSize: 13.5, fontWeight: highlight ? FontWeight.w800 : FontWeight.w600, color: c.ink, fontFeatures: const [FontFeature.tabularFigures()]);
    return Container(
      color: highlight ? c.accent.withValues(alpha: 0.08) : null,
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
      child: Row(children: [
        Container(width: 3, height: 18, color: zoneColor ?? Colors.transparent),
        const SizedBox(width: 6),
        SizedBox(width: 26, child: Text(rank, style: header ? style : TextStyle(color: c.ink3, fontWeight: FontWeight.w700, fontSize: 13))),
        SizedBox(
          width: 150,
          child: Row(children: [
            if (!header) ...[Crest(name: team, size: 20), const SizedBox(width: 8)],
            Expanded(child: Text(team, maxLines: 1, overflow: TextOverflow.ellipsis, style: style)),
          ]),
        ),
        for (var i = 0; i < values.length; i++)
          SizedBox(
            width: 40,
            child: Text(values[i],
                textAlign: TextAlign.right,
                style: i == values.length - 1 && !header ? style?.copyWith(fontWeight: FontWeight.w800) : (header ? style : style?.copyWith(color: c.ink2, fontWeight: FontWeight.w500))),
          ),
        if (form != null || formString != null) ...[
          const SizedBox(width: 12),
          SizedBox(
            width: 140,
            child: header
                ? Text(form ?? '', style: style)
                : Row(children: [
                    for (final ch in formString!.toUpperCase().split('').where((x) => 'WDL'.contains(x)).take(5))
                      Padding(padding: const EdgeInsets.only(right: 3), child: FormPill(ch, size: 22)),
                  ]),
          ),
        ],
      ]),
    );
  }
}

// ---------------- Cups ----------------

String _roundLabel(String k) => switch (k) {
      'round64' => tr('Round of 64', '32es de finale'),
      'round32' => tr('Round of 32', '16es de finale'),
      'round16' => tr('Round of 16', '8es de finale'),
      'quarter' => tr('Quarter-finals', 'Quarts de finale'),
      'semi' => tr('Semi-finals', 'Demi-finales'),
      'third' => tr('Third-place match', 'Match pour la 3e place'),
      'final' => tr('Final', 'Finale'),
      _ => k,
    };

class CupsScreen extends ConsumerStatefulWidget {
  const CupsScreen({super.key, this.competition});
  final String? competition;

  @override
  ConsumerState<CupsScreen> createState() => _CupsScreenState();
}

class _CupsScreenState extends ConsumerState<CupsScreen> {
  late String _id = cupCompetitions.any((x) => x.$1 == widget.competition) ? widget.competition! : cupCompetitions.first.$1;
  int _round = -1;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final async = ref.watch(_cupsProvider(_id));
    final data = async.value;
    final rounds = asMapList(data?['items']);
    final selected = _round < 0 || _round >= rounds.length ? rounds.length - 1 : _round;

    return Scaffold(
      appBar: AppBar(title: Text(tr('Cup rounds', 'Phases finales'))),
      body: Column(children: [
        ChipStrip(
          items: [for (final (id, name) in cupCompetitions) (id, name, Icons.emoji_events_rounded)],
          selected: _id,
          onSelect: (v) => setState(() {
            _id = v;
            _round = -1;
          }),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: async.hasError && data == null
              ? ErrorView(error: async.error!, onRetry: () => ref.invalidate(_cupsProvider(_id)))
              : data == null
                  ? const SkeletonList()
                  : RefreshIndicator(
                      onRefresh: () {
                        ref.invalidate(_cupsProvider(_id));
                        return _refresh(ref.read(_cupsProvider(_id).future));
                      },
                      child: ListView(padding: const EdgeInsets.only(bottom: 40), children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                          child: Text(
                            [asString(data['competition']), asString(data['season'])].whereType<String>().join(' · '),
                            style: context.text.titleMedium,
                          ),
                        ),
                        _stateNote(context, str(data['state'])),
                        if (str(data['state']) == 'unavailable')
                          _unavailable(context, () => ref.invalidate(_cupsProvider(_id)))
                        else if (rounds.isEmpty)
                          StateView.empty(tr('No confirmed rounds yet', 'Aucune phase confirmée'),
                              message: tr('Rounds appear here once every one is confirmed for this competition.', 'Les phases apparaissent une fois confirmées.'),
                              icon: Icons.account_tree_outlined)
                        else ...[
                          const SizedBox(height: 10),
                          SizedBox(
                            height: 40,
                            child: ListView(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              children: [
                                for (var i = 0; i < rounds.length; i++)
                                  Padding(
                                    padding: const EdgeInsets.only(right: 8),
                                    child: ChoiceChip(
                                      label: Text(_roundLabel(str(rounds[i]['key']))),
                                      selected: i == selected,
                                      labelStyle: TextStyle(fontWeight: FontWeight.w700, color: i == selected ? Colors.white : c.ink2),
                                      onSelected: (_) => setState(() => _round = i),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 10, 20, 6),
                            child: Text(tr('Two-legged ties appear as separate games.', 'Les confrontations aller-retour apparaissent en deux matchs.'), style: context.text.bodySmall),
                          ),
                          SpoilerGuard(
                            label: tr('Show rounds', 'Afficher les phases'),
                            child: Column(children: [
                              for (final (i, e) in SportEvent.list(rounds[selected]['games']).indexed)
                                Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 10), child: _CupGame(event: e).entrance(i)),
                            ]),
                          ),
                        ],
                      ]),
                    ),
        ),
      ]),
    );
  }
}

class _CupGame extends StatelessWidget {
  const _CupGame({required this.event});
  final SportEvent event;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final e = event;
    final so = e.shootout;
    final agg = e.aggregate;
    final values = e.rowValues;
    Widget side(int i) {
      if (i >= e.participants.length) return const SizedBox.shrink();
      final p = e.participants[i];
      final key = i == 0 ? 'home' : 'away';
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [
          Crest(url: p.badgeUrl, name: p.name, size: 24),
          const SizedBox(width: 10),
          Expanded(child: Text(p.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.titleSmall)),
          if (values.length > i && values[i] != null)
            Text(values[i]!, style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, fontSize: 16, color: c.ink)),
          if (so != null) Text(' (${asInt(so[key]) ?? 0})', style: TextStyle(fontWeight: FontWeight.w700, color: c.ink2)),
        ]),
      );
    }

    return FsCard(
      padding: const EdgeInsets.all(14),
      onTap: () => context.push('/match/${Uri.encodeComponent(e.id)}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(
            e.start == null ? tr('Time to be confirmed', 'Horaire à confirmer') : (e.dateOnly ? Fmt.dayMonthYear(e.start!) : Fmt.full(e.start!)),
            style: context.text.bodySmall,
          ),
          const Spacer(),
          if (e.isLive) Pill(e.clockText.isEmpty ? tr('Live', 'Direct') : e.clockText, live: true) else if (!e.isScheduled) Text(e.statusLabel, style: context.text.labelSmall),
        ]),
        const SizedBox(height: 6),
        side(0),
        side(1),
        if (agg != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(tr('Aggregate ${asInt(agg['home']) ?? 0} - ${asInt(agg['away']) ?? 0}', 'Cumul ${asInt(agg['home']) ?? 0} - ${asInt(agg['away']) ?? 0}'),
                style: context.text.labelMedium?.copyWith(color: c.accentText)),
          ),
      ]),
    );
  }
}

// ---------------- Motorsport ----------------

/// A scheduled session that started over two days ago is shown as finished
/// (sessionStatus in lib/sports/seasons.ts).
String sessionStatus(Json s) {
  final status = str(s['status'], 'unknown');
  final start = DateTime.tryParse(str(s['startUTC']));
  if (status == 'scheduled' && start != null && DateTime.now().toUtc().difference(start).inHours > 48) return 'finished';
  return status;
}

class MotorsportScreen extends ConsumerStatefulWidget {
  const MotorsportScreen({super.key, this.series});
  final String? series;

  @override
  ConsumerState<MotorsportScreen> createState() => _MotorsportScreenState();
}

class _MotorsportScreenState extends ConsumerState<MotorsportScreen> {
  late String _id = raceSeries.any((x) => x.$1 == widget.series) ? widget.series! : raceSeries.first.$1;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_motorsportProvider(_id));
    final data = async.value;
    final weekends = asMapList(data?['items']);
    final upcoming = weekends.where((w) => !asBool(w['over'])).toList();
    final earlier = weekends.where((w) => asBool(w['over'])).toList().reversed.toList();

    return Scaffold(
      appBar: AppBar(title: Text(tr('Race schedule', 'Calendrier des courses'))),
      body: Column(children: [
        ChipStrip(
          items: [for (final (id, name) in raceSeries) (id, name, Icons.sports_motorsports_rounded)],
          selected: _id,
          onSelect: (v) => setState(() => _id = v),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: async.hasError && data == null
              ? ErrorView(error: async.error!, onRetry: () => ref.invalidate(_motorsportProvider(_id)))
              : data == null
                  ? const SkeletonList(height: 120)
                  : RefreshIndicator(
                      onRefresh: () {
                        ref.invalidate(_motorsportProvider(_id));
                        return _refresh(ref.read(_motorsportProvider(_id).future));
                      },
                      child: ListView(padding: const EdgeInsets.only(bottom: 40), children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                          child: Text([asString(data['competition']), asString(data['season'])].whereType<String>().join(' · '), style: context.text.titleMedium),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 2, 20, 0),
                          child: Text(tr('Every session of each race weekend, in your time zone.', 'Chaque séance de chaque week-end, à votre heure.'), style: context.text.bodySmall),
                        ),
                        _stateNote(context, str(data['state'])),
                        if (str(data['state']) == 'unavailable')
                          _unavailable(context, () => ref.invalidate(_motorsportProvider(_id)))
                        else if (weekends.isEmpty)
                          StateView.empty(tr('No race weekends listed', 'Aucun week-end de course'), icon: Icons.flag_outlined)
                        else ...[
                          if (upcoming.isNotEmpty) ...[
                            SectionHeader(tr('Coming up', 'À venir'), icon: Icons.flag_rounded),
                            for (var i = 0; i < upcoming.length; i++)
                              Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 12), child: _Weekend(w: upcoming[i], highlight: i == 0).entrance(i)),
                          ],
                          if (earlier.isNotEmpty) ...[
                            SectionHeader(tr('Earlier this season', 'Plus tôt cette saison'), icon: Icons.history_rounded),
                            for (var i = 0; i < earlier.length; i++)
                              Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 12), child: _Weekend(w: earlier[i], highlight: false)),
                          ],
                        ],
                      ]),
                    ),
        ),
      ]),
    );
  }
}

class _Weekend extends StatelessWidget {
  const _Weekend({required this.w, required this.highlight});
  final Json w;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final sessions = asMapList(w['sessions']);
    final round = asInt(w['round']);
    final fg = highlight ? Colors.white : c.ink;
    final sub = highlight ? Colors.white70 : c.ink3;
    return FsCard(
      padding: const EdgeInsets.all(16),
      gradient: highlight ? LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c.heroStart, c.heroEnd]) : null,
      border: !highlight,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          if (round != null) Pill(tr('Round $round', 'Manche $round'), color: highlight ? Colors.white : null, background: highlight ? Colors.white.withValues(alpha: 0.15) : null),
          const Spacer(),
          if (asString(w['country']) != null) Text(str(w['country']), style: TextStyle(color: sub, fontSize: 12, fontWeight: FontWeight.w600)),
        ]),
        const SizedBox(height: 8),
        Text(str(w['name']), style: TextStyle(fontFamily: 'Sora', fontSize: 17, fontWeight: FontWeight.w800, color: fg)),
        if (asString(w['venue']) != null) Text(str(w['venue']), style: TextStyle(color: sub, fontSize: 13)),
        const SizedBox(height: 10),
        for (final s in sessions)
          InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: () => context.push('/match/${Uri.encodeComponent(str(s['id']))}'),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 7),
              child: Row(children: [
                Builder(builder: (context) {
                  final st = sessionStatus(s);
                  final color = st == 'live' ? c.live : (st == 'finished' ? c.success : sub);
                  return Icon(st == 'finished' ? Icons.check_circle_rounded : (st == 'live' ? Icons.radio_button_checked_rounded : Icons.circle_outlined), size: 16, color: color);
                }),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(asString(s['name']) ?? tr('Race', 'Course'),
                      style: TextStyle(fontWeight: asString(s['name']) == null ? FontWeight.w800 : FontWeight.w600, color: fg, fontSize: 14)),
                ),
                Text(
                  Fmt.parse(asString(s['startUTC'])) == null
                      ? tr('Time TBC', 'Horaire à confirmer')
                      : (asBool(s['dateOnly']) ? Fmt.dayMonth(Fmt.parse(asString(s['startUTC']))!) : '${Fmt.dayShort(Fmt.parse(asString(s['startUTC']))!)} ${Fmt.time(Fmt.parse(asString(s['startUTC']))!)}'),
                  style: TextStyle(color: sub, fontSize: 12.5, fontWeight: FontWeight.w600),
                ),
                Icon(Icons.chevron_right_rounded, size: 18, color: sub),
              ]),
            ),
          ),
      ]),
    );
  }
}
