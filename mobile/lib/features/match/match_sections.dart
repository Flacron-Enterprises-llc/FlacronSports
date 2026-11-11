import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';
import '../../widgets/event_tile.dart';
import 'match_data.dart';
import 'match_terms.dart';

/// A titled card, the mobile counterpart of the web's Panel.
class Panel extends StatelessWidget {
  const Panel({super.key, this.title, this.icon, required this.child, this.trailing, this.padding = const EdgeInsets.all(16)});
  final String? title;
  final IconData? icon;
  final Widget child;
  final Widget? trailing;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return FsCard(
      padding: padding,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (title != null) ...[
          Row(children: [
            if (icon != null) ...[
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(color: c.accent.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(9)),
                child: Icon(icon, size: 17, color: c.accent),
              ),
              const SizedBox(width: 10),
            ],
            Expanded(child: Text(title!, style: context.text.titleMedium?.copyWith(fontWeight: FontWeight.w700))),
            ?trailing,
          ]),
          const SizedBox(height: 12),
        ],
        child,
      ]),
    );
  }
}

class FactList extends StatelessWidget {
  const FactList(this.facts, {super.key});
  final List<Fact> facts;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Column(children: [
      for (var i = 0; i < facts.length; i++)
        Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: c.line.withValues(alpha: 0.7)))),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 120, child: Text(facts[i].$1, style: TextStyle(fontSize: 13, color: c.ink3, fontWeight: FontWeight.w500))),
            Expanded(child: Text(facts[i].$2, style: TextStyle(fontSize: 13.5, color: c.ink, fontWeight: FontWeight.w600))),
          ]),
        ),
    ]);
  }
}

/// Score by period / quarter / inning / set (lineScore in line-score.ts).
class LineScoreTable extends StatelessWidget {
  const LineScoreTable({super.key, required this.event, this.breakdown});
  final SportEvent event;
  final Json? breakdown;

  static bool available(SportEvent e, Json? b) {
    final bd = b ?? e.breakdown;
    if (bd == null || e.participants.length < 2) return false;
    return asMapList(bd['segments']).isNotEmpty || bd['tries'] != null;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final bd = breakdown ?? event.breakdown!;
    final segs = asMapList(bd['segments']);
    final baseball = segs.isNotEmpty && segs.first['kind'] == 'inning';
    final sets = segs.isNotEmpty && segs.first['kind'] == 'set';
    final columns = <String>[for (final s in segs) segmentHeading(s, segs)];
    final home = <String>[];
    final away = <String>[];
    for (var i = 0; i < segs.length; i++) {
      final s = segs[i];
      final skipped = s['kind'] == 'inning' && event.isFinished && s['home'] == null && s['away'] != null && i == segs.length - 1;
      home.add(skipped ? 'X' : (asInt(s['home'])?.toString() ?? '–'));
      away.add(asInt(s['away'])?.toString() ?? '–');
    }
    final totals = <int>{};
    void add(String label, dynamic pair) {
      if (pair == null) return;
      final m = asMap(pair);
      totals.add(columns.length);
      columns.add(label);
      home.add(asInt(m['home'])?.toString() ?? '–');
      away.add(asInt(m['away'])?.toString() ?? '–');
    }

    if (event.scoreKind == 'team') add(baseball ? 'R' : (sets ? tr('Sets', 'Sets') : 'T'), {'home': event.homeScore, 'away': event.awayScore});
    add('H', bd['hits']);
    add('E', bd['errors']);
    add(tr('Tries', 'Essais'), bd['tries']);

    var rows = [(event.participants[0].name, home), (event.participants[1].name, away)];
    if (baseball) rows = rows.reversed.toList();

    Widget cell(String text, {bool head = false, bool total = false}) => Container(
          width: 40,
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(text,
              style: TextStyle(
                fontFamily: head ? 'Inter' : 'Sora',
                fontSize: head ? 11.5 : 14,
                fontWeight: head ? FontWeight.w700 : (total ? FontWeight.w800 : FontWeight.w600),
                color: head ? c.ink3 : (total ? c.ink : c.ink2),
              )),
        );

    return Row(children: [
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const SizedBox(height: 33),
        for (final r in rows)
          SizedBox(
            height: 36,
            width: 110,
            child: Align(alignment: Alignment.centerLeft, child: Text(r.$1, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, color: c.ink, fontSize: 13.5))),
          ),
      ]),
      Expanded(
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [for (var i = 0; i < columns.length; i++) cell(columns[i], head: true)]),
            for (final r in rows)
              Container(
                height: 36,
                decoration: BoxDecoration(border: Border(top: BorderSide(color: c.line.withValues(alpha: 0.7)))),
                child: Row(children: [for (var i = 0; i < r.$2.length; i++) cell(r.$2[i], total: totals.contains(i))]),
              ),
          ]),
        ),
      ),
    ]);
  }

  static String caption(SportEvent e, Json? b) {
    final segs = asMapList((b ?? e.breakdown)?['segments']);
    return segs.isEmpty ? tr('Score by period', 'Score par période') : lineCaption(str(segs.first['kind']));
  }
}

/// EventResult: one row per side with its value, plus the outcome line.
class ResultPanel extends StatelessWidget {
  const ResultPanel({super.key, required this.event});
  final SportEvent event;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final e = event;
    if (e.scoreKind == 'classification') return ClassificationTable(entries: e.classification.take(10).toList());
    final values = e.rowValues;
    return SpoilerGuard(
      label: tr('Reveal result', 'Afficher le résultat'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (var i = 0; i < e.participants.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(children: [
              Crest(url: e.participants[i].badgeUrl, name: e.participants[i].name, size: 26),
              const SizedBox(width: 10),
              Expanded(child: Text(e.participants[i].name, style: TextStyle(fontWeight: FontWeight.w700, color: c.ink))),
              if (i < values.length && values[i] != null) Text(values[i]!, style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, fontSize: 16, color: c.ink)),
            ]),
          ),
        if (e.resultNote != null) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(color: c.accent.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              Icon(Icons.emoji_events_rounded, size: 18, color: c.accent),
              const SizedBox(width: 8),
              Expanded(child: Text(e.resultNote!, style: TextStyle(fontWeight: FontWeight.w700, color: c.ink))),
            ]),
          ),
        ],
      ]),
    );
  }
}

/// Race classification table.
class ClassificationTable extends StatelessWidget {
  const ClassificationTable({super.key, required this.entries});
  final List<Json> entries;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Column(children: [
      for (final entry in entries)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(children: [
            Container(
              width: 30,
              height: 30,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: switch (asInt(entry['position'])) {
                  1 => const Color(0xFFE8B931),
                  2 => const Color(0xFFB8C2CC),
                  3 => const Color(0xFFCD8B4E),
                  _ => c.surfaceMuted,
                },
                borderRadius: BorderRadius.circular(9),
              ),
              child: Text('${entry['position'] ?? ''}',
                  style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, fontSize: 13, color: (asInt(entry['position']) ?? 9) <= 3 ? FsColors.navyDeep : c.ink2)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Pressable(
                onTap: entry['playerId'] != null ? () => context.push('/player/${entry['playerId']}') : null,
                haptic: false,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(str(entry['name']), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, color: c.ink)),
                  if (entry['team'] != null) Text(str(entry['team']), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: c.ink3)),
                ]),
              ),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              if (entry['time'] != null) Text(str(entry['time']), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: c.ink2)),
              if (entry['points'] != null) Text('${entry['points']} ${tr('pts', 'pts')}', style: TextStyle(fontSize: 11.5, color: c.ink3)),
              if (entry['laps'] != null && entry['time'] == null) Text(tr('${entry['laps']} laps', '${entry['laps']} tours'), style: TextStyle(fontSize: 11.5, color: c.ink3)),
            ]),
          ]),
        ),
    ]);
  }
}

/// Results that do not fit "home v away": scorecard, race tables, rubbers, bouts.
class SportStatistics extends StatelessWidget {
  const SportStatistics({super.key, required this.event});
  final SportEvent event;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final e = event;
    final s = e.score;
    final d = e.details;
    final facts = resultFacts(e);
    final children = <Widget>[];
    if (e.scoreKind == 'innings') {
      final sides = [
        (e.participants.isNotEmpty ? e.participants[0].name : '', s['homeInnings'], s['home']),
        (e.participants.length > 1 ? e.participants[1].name : '', s['awayInnings'], s['away']),
      ];
      for (final (name, list, total) in sides) {
        final innings = asMapList(list).isNotEmpty ? asMapList(list) : (total is Map ? [asMap(total)] : <Json>[]);
        if (innings.isEmpty) continue;
        children.add(Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, style: TextStyle(fontWeight: FontWeight.w800, color: c.ink)),
            for (var i = 0; i < innings.length; i++)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Row(children: [
                  Text(innings.length > 1 ? tr('Innings ${i + 1}', 'Manche ${i + 1}') : tr('Innings', 'Manche'), style: TextStyle(fontSize: 12.5, color: c.ink3)),
                  const Spacer(),
                  Text(
                    '${asInt(innings[i]['runs']) ?? 0}${innings[i]['wickets'] != null ? '/${innings[i]['wickets']}' : ''}${asBool(innings[i]['declared']) ? 'd' : ''}'
                    '${innings[i]['overs'] != null ? '  (${innings[i]['overs']} ov)' : ''}',
                    style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, color: c.ink),
                  ),
                ]),
              ),
          ]),
        ));
      }
    }
    if (e.scoreKind == 'classification') {
      children.add(ClassificationTable(entries: e.classification));
      for (final group in asMapList(s['classes'])) {
        children.add(Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(str(group['name']), style: TextStyle(fontWeight: FontWeight.w800, color: c.ink)),
            ClassificationTable(entries: asMapList(group['entries'])),
          ]),
        ));
      }
    }
    if (d != null && d['kind'] == 'tennis') {
      for (final r in asMapList(d['rubbers'])) {
        final games = (r['games'] as List? ?? []).map((g) => (g as List).map((x) => asInt(x) ?? 0).toList()).toList();
        final tbs = (r['tiebreaks'] as List? ?? []).map(asInt).toList();
        children.add(Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(children: [
            Expanded(child: Text('${r['winner']} ${tr('beat', 'bat')} ${r['loser']}', style: TextStyle(color: c.ink, fontWeight: FontWeight.w600))),
            Text([for (var i = 0; i < games.length; i++) setScore(games[i], i < tbs.length ? tbs[i] : null)].join(' '), style: TextStyle(fontFamily: 'Sora', color: c.ink2, fontWeight: FontWeight.w700)),
          ]),
        ));
      }
    }
    if (d != null && d['kind'] == 'combat') {
      for (final bout in asMapList(d['bouts'])) {
        children.add(BoutCard(bout: bout));
      }
    }
    if (facts.isNotEmpty) children.add(Padding(padding: const EdgeInsets.only(top: 8), child: FactList(facts)));
    final out = asMapList(s['out']);
    if (e.scoreKind == 'classification' && out.isNotEmpty) {
      children.add(Padding(
        padding: const EdgeInsets.only(top: 14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr('Not classified', 'Non classés'), style: TextStyle(fontWeight: FontWeight.w800, color: c.ink)),
          for (final o in out)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(children: [
                Expanded(child: Text('${o['name']}${o['team'] != null ? ' · ${o['team']}' : ''}', style: TextStyle(color: c.ink2))),
                if (o['status'] != null) Pill(str(o['status'])),
              ]),
            ),
        ]),
      ));
    }
    final standings = asMapList(s['standings']);
    if (e.scoreKind == 'classification' && standings.isNotEmpty) {
      children.add(Padding(
        padding: const EdgeInsets.only(top: 14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr('Championship', 'Championnat'), style: TextStyle(fontWeight: FontWeight.w800, color: c.ink)),
          for (final row in standings)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(children: [
                SizedBox(width: 28, child: Text('${row['position']}', style: TextStyle(fontWeight: FontWeight.w800, color: c.ink3))),
                Expanded(child: Text('${row['name']}${row['team'] != null ? ' · ${row['team']}' : ''}', style: TextStyle(color: c.ink))),
                Text('${row['points']} ${tr('pts', 'pts')}', style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, color: c.ink)),
              ]),
            ),
        ]),
      ));
    }
    return Panel(title: tr('Result', 'Résultat'), icon: Icons.military_tech_rounded, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children));
  }
}

class BoutCard extends StatelessWidget {
  const BoutCard({super.key, required this.bout, this.showResult = true});
  final Json bout;
  final bool showResult;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final about = [
      if (bout['section'] != null) bout['section'] == 'main' ? tr('Main card', 'Carte principale') : tr('Prelims', 'Préliminaires'),
      asString(bout['weightClass']),
      if (bout['scheduledRounds'] != null) tr('${bout['scheduledRounds']} rounds', '${bout['scheduledRounds']} rounds'),
      asString(bout['title']) ?? (asBool(bout['titleFight']) ? tr('Title fight', 'Combat pour le titre') : null),
    ].whereType<String>().join(' · ');
    final line = showResult ? boutLine(bout) : null;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: c.line)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (about.isNotEmpty) Text(about, style: TextStyle(fontSize: 11.5, color: c.ink3, fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text(asStringList(bout['names']).join('  vs  '), style: TextStyle(fontWeight: FontWeight.w700, color: c.ink)),
        if (line != null) ...[const SizedBox(height: 4), Text(line, style: TextStyle(fontSize: 12.5, color: c.ink2))],
        if (showResult && bout['outcome'] != null)
          Text(bout['outcome'] == 'draw' ? tr('Draw', 'Match nul') : tr('No contest', 'Sans décision'), style: TextStyle(fontSize: 12.5, color: c.ink2)),
      ]),
    );
  }
}

/// A list of confirmed steps for sports with no running feed (SportUpdates).
class StepsPanel extends StatelessWidget {
  const StepsPanel({super.key, required this.steps});
  final List<String> steps;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Panel(
      title: tr('Live updates', 'Mises à jour'),
      icon: Icons.checklist_rounded,
      child: Column(children: [
        for (final step in steps)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(margin: const EdgeInsets.only(top: 5), width: 9, height: 9, decoration: BoxDecoration(color: c.brand, shape: BoxShape.circle)),
              const SizedBox(width: 12),
              Expanded(child: Text(step, style: TextStyle(color: c.ink, fontSize: 14))),
            ]),
          ),
      ]),
    );
  }
}

/// Recent form of both teams (MatchForm), from /api/teams.
class TeamFormPanel extends ConsumerWidget {
  const TeamFormPanel({super.key, required this.event});
  final SportEvent event;

  static List<String> formOf(List<SportEvent> recent, String name, SportEvent current) {
    final out = <String>[];
    final sorted = recent.where((e) => e.id != current.id && e.isFinished && e.scoreKind == 'team').toList()
      ..sort((a, b) => (b.startUTC ?? '').compareTo(a.startUTC ?? ''));
    for (final e in sorted) {
      final idx = e.participants.indexWhere((p) => p.rawName.toLowerCase() == name.toLowerCase());
      if (idx < 0 || idx > 1) continue;
      final mine = idx == 0 ? e.homeScore : e.awayScore;
      final theirs = idx == 0 ? e.awayScore : e.homeScore;
      if (mine == null || theirs == null) continue;
      out.add(mine > theirs ? 'W' : (mine == theirs ? 'D' : 'L'));
      if (out.length == 5) break;
    }
    return out;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final rows = <(String, List<String>)>[];
    var loading = false;
    for (final p in event.participants.take(2)) {
      final v = ref.watch(teamFixturesProvider((p.rawName, event.sportId)));
      if (v.isLoading && !v.hasValue) loading = true;
      final recent = SportEvent.list(asMap(v.value)['recent']);
      final form = formOf(recent, p.rawName, event);
      if (form.isNotEmpty) rows.add((p.name, form));
    }
    if (loading && rows.isEmpty) return const Skeleton(height: 90, radius: 18);
    if (rows.isEmpty) return const SizedBox.shrink();
    Color tone(String r) => switch (r) { 'W' => c.success, 'L' => c.danger, _ => c.ink3 };
    String letter(String r) => switch (r) { 'W' => tr('W', 'V'), 'L' => tr('L', 'D'), _ => tr('D', 'N') };
    return Panel(
      title: tr('Form', 'Forme'),
      icon: Icons.trending_up_rounded,
      child: SpoilerGuard(
        label: tr('Reveal results', 'Afficher les résultats'),
        child: Column(children: [
          for (final (name, form) in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(children: [
                Expanded(child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w600, color: c.ink))),
                for (final r in form)
                  Container(
                    margin: const EdgeInsets.only(left: 4),
                    width: 26,
                    height: 26,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: tone(r).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
                    child: Text(letter(r), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: tone(r))),
                  ),
              ]),
            ),
        ]),
      ),
    );
  }
}

/// The rest of a race weekend (WeekendSessions).
class WeekendSessionsPanel extends ConsumerWidget {
  const WeekendSessionsPanel({super.key, required this.event});
  final SportEvent event;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = event.details;
    final series = event.competitionId;
    final round = d == null ? null : asInt(d['round']);
    if (d == null || d['kind'] != 'motorsport' || round == null || series == null || !raceSeries.any((r) => r.$1 == series)) return const SizedBox.shrink();
    final schedule = ref.watch(raceScheduleProvider(series)).value;
    if (schedule == null) return const SizedBox.shrink();
    final weekend = asMapList(schedule['items']).where((w) => asInt(w['round']) == round).firstOrNull;
    if (weekend == null) return const SizedBox.shrink();
    final sessions = asMapList(weekend['sessions']).where((s) => str(s['id']) != event.id).toList();
    if (sessions.isEmpty) return const SizedBox.shrink();
    final c = context.fs;
    return Panel(
      title: tr('Weekend sessions', 'Séances du week-end'),
      icon: Icons.flag_rounded,
      child: Column(children: [
        for (final s in sessions)
          Pressable(
            onTap: () => context.push('/match/${s['id']}'),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(children: [
                Expanded(child: Text(asString(s['name']) ?? tr('Race', 'Course'), style: TextStyle(fontWeight: FontWeight.w600, color: c.ink))),
                Text(_sessionStatus(s), style: TextStyle(fontSize: 12, color: c.ink3)),
                Icon(Icons.chevron_right_rounded, color: c.ink3, size: 18),
              ]),
            ),
          ),
      ]),
    );
  }

  /// sessionStatus: a scheduled session that began more than 2 days ago is over.
  static String _sessionStatus(Json s) {
    var status = str(s['status'], 'scheduled');
    final start = DateTime.tryParse(str(s['startUTC']));
    if (status == 'scheduled' && start != null && DateTime.now().toUtc().difference(start.toUtc()) > const Duration(days: 2)) status = 'finished';
    return SportEvent({'status': status}).statusLabel;
  }
}
