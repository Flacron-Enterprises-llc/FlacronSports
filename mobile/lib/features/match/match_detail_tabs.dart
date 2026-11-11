import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';
import '../../widgets/event_tile.dart';
import 'match_data.dart';
import 'match_sections.dart';
import 'match_terms.dart';

/// Shared scroll wrapper for a tab inside the NestedScrollView.
class TabScroll extends StatelessWidget {
  const TabScroll({super.key, required this.children, this.onRefresh});
  final List<Widget> children;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    final list = ListView(
      padding: EdgeInsets.fromLTRB(16, 14, 16, 32 + MediaQuery.paddingOf(context).bottom),
      children: [
        for (var i = 0; i < children.length; i++) Padding(padding: const EdgeInsets.only(bottom: 14), child: children[i].entrance(i)),
      ],
    );
    if (onRefresh == null) return list;
    return RefreshIndicator(onRefresh: onRefresh!, child: list);
  }
}

class _DetailGate extends ConsumerWidget {
  const _DetailGate({required this.id, required this.builder, this.extra = const []});
  final String id;
  final List<Widget> Function(Json detail) builder;
  final List<Widget> extra;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(matchDetailProvider(id));
    Future<void> refresh() async => ref.invalidate(matchDetailProvider(id));
    if (v.hasValue) return TabScroll(onRefresh: refresh, children: builder(v.value!));
    if (v.hasError) {
      if (extra.isNotEmpty) return TabScroll(onRefresh: refresh, children: extra);
      return ErrorView(error: v.error!, onRetry: refresh, compact: true);
    }
    return const SkeletonList(count: 5, height: 56);
  }
}

// ---------------- Timeline ----------------

class TimelineTab extends StatelessWidget {
  const TimelineTab({super.key, required this.event});
  final SportEvent event;

  @override
  Widget build(BuildContext context) {
    final steps = sportSteps(event);
    final extra = steps.isEmpty ? <Widget>[] : [SpoilerGuard(label: tr('Reveal details', 'Afficher les détails'), child: StepsPanel(steps: steps))];
    return _DetailGate(
      id: event.id,
      extra: extra,
      builder: (detail) {
        final items = asMapList(detail['timeline']).where((i) => _label(i) != null).toList();
        if (items.isEmpty && extra.isEmpty) {
          return [StateView.empty(tr('No updates yet', 'Pas encore de mises à jour'), message: sportNote(event.sportId, 'updates'), icon: Icons.checklist_rounded, compact: true)];
        }
        return [
          if (items.isNotEmpty && asBool(detail['timelinePartial']) && event.sportId == 'ice-hockey')
            _Notice(tr('This list is incomplete: the source has published only part of this game.', "Cette liste est incomplète : la source n'a publié qu'une partie de ce match.")),
          if (items.isNotEmpty)
            SpoilerGuard(
              label: tr('Reveal details', 'Afficher les détails'),
              child: Panel(
                title: tr('Live updates', 'Mises à jour'),
                icon: Icons.timeline_rounded,
                child: Column(children: [for (final item in items) _TimelineRow(item: item, label: _label(item)!)]),
              ),
            ),
          ...extra,
        ];
      },
    );
  }

  static String? _label(Json item) {
    final kind = str(item['kind']);
    if (kind == 'other') return AppLocale.isFr ? null : asString(item['label']);
    final base = timelineKindLabel(kind);
    if (base == null) return null;
    final reason = asMap(item['reason']);
    if (reason.isNotEmpty && !AppLocale.isFr) return '$base · ${reason['text']}';
    if (item['review'] != null) return '${timelineKindLabel('var')}: ${item['review']}';
    if (item['situation'] != null) {
      final sit = switch (str(item['situation'])) {
        'power-play' => tr('Power play', 'Supériorité numérique'),
        'shorthanded' => tr('Shorthanded', 'Infériorité numérique'),
        'empty-net' => tr('Empty net', 'Cage vide'),
        _ => '',
      };
      return '$base · $sit';
    }
    if (item['infraction'] != null && !AppLocale.isFr) return '$base · ${item['infraction']}';
    return base;
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.item, required this.label});
  final Json item;
  final String label;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final kind = str(item['kind']);
    final away = item['side'] == 'away';
    final icon = switch (kind) {
      'yellow' => Container(width: 12, height: 16, decoration: BoxDecoration(color: const Color(0xFFF5C518), borderRadius: BorderRadius.circular(2))),
      'red' => Container(width: 12, height: 16, decoration: BoxDecoration(color: const Color(0xFFD7263D), borderRadius: BorderRadius.circular(2))),
      'substitution' => Icon(Icons.swap_horiz_rounded, size: 18, color: c.ink3),
      'var' => Icon(Icons.tv_rounded, size: 18, color: c.ink3),
      'missed-penalty' || 'infraction' || 'other' => Icon(Icons.flag_rounded, size: 18, color: c.ink3),
      'own-goal' => Icon(Icons.sports_soccer_rounded, size: 18, color: c.danger),
      _ => Icon(Icons.sports_soccer_rounded, size: 18, color: c.accent),
    };
    final minute = asInt(item['minute']);
    final period = asString(item['period']);
    final periodText = period == null ? '' : (period == 'POT' ? 'OT ' : 'P${period.replaceFirst('P', '')} ');
    final secondary = asString(item['secondary']);
    final secondaryText = secondary == null
        ? null
        : kind == 'substitution'
            ? tr('replacing $secondary', 'à la place de $secondary')
            : (kind == 'goal' || kind == 'penalty') ? tr('assist: $secondary', 'passe décisive : $secondary') : secondary;
    final body = Expanded(
      child: Column(crossAxisAlignment: away ? CrossAxisAlignment.end : CrossAxisAlignment.start, children: [
        Text(asString(item['player']) ?? label, textAlign: away ? TextAlign.right : TextAlign.left, style: TextStyle(fontWeight: FontWeight.w700, color: c.ink, fontSize: 14)),
        Text([label, ?secondaryText].join(' · '), textAlign: away ? TextAlign.right : TextAlign.left, style: TextStyle(fontSize: 12, color: c.ink3)),
      ]),
    );
    final chip = Container(
      width: 56,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(999), border: Border.all(color: c.line)),
      child: Text('$periodText${minute == null ? '' : "$minute′"}', style: TextStyle(fontFamily: 'Sora', fontSize: 12, fontWeight: FontWeight.w700, color: c.ink)),
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(children: away
          ? [const Spacer(flex: 1), body, const SizedBox(width: 10), icon, const SizedBox(width: 10), chip]
          : [chip, const SizedBox(width: 10), icon, const SizedBox(width: 10), body, const Spacer(flex: 1)]),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: c.warning.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14), border: Border.all(color: c.warning.withValues(alpha: 0.35))),
      child: Row(children: [Icon(Icons.info_outline_rounded, color: c.warning, size: 18), const SizedBox(width: 10), Expanded(child: Text(text, style: TextStyle(color: c.ink, fontSize: 13)))]),
    );
  }
}

// ---------------- Statistics ----------------

class StatsTab extends StatelessWidget {
  const StatsTab({super.key, required this.event});
  final SportEvent event;

  @override
  Widget build(BuildContext context) {
    final e = event;
    final own = <Widget>[
      if (hasSportStatistics(e)) SpoilerGuard(label: tr('Reveal details', 'Afficher les détails'), child: SportStatistics(event: e)),
    ];
    return _DetailGate(
      id: e.id,
      extra: [
        ...own,
        if (LineScoreTable.available(e, null)) Panel(title: LineScoreTable.caption(e, null), icon: Icons.table_chart_rounded, child: LineScoreTable(event: e)),
      ],
      builder: (detail) {
        final breakdown = e.breakdown ?? (detail['breakdown'] is Map ? asMap(detail['breakdown']) : null);
        final rows = asMapList(detail['stats']).where((r) => statLabel(r) != null).toList();
        final table = LineScoreTable.available(e, breakdown);
        if (own.isEmpty && !table && rows.isEmpty) {
          return [StateView.empty(tr('No statistics yet', 'Pas encore de statistiques'), message: sportNote(e.sportId, 'statistics'), icon: Icons.bar_chart_rounded, compact: true)];
        }
        return [
          ...own,
          if (table)
            SpoilerGuard(
              label: tr('Reveal details', 'Afficher les détails'),
              child: Panel(title: LineScoreTable.caption(e, breakdown), icon: Icons.table_chart_rounded, child: LineScoreTable(event: e, breakdown: breakdown)),
            ),
          if (rows.isNotEmpty)
            SpoilerGuard(
              label: tr('Reveal details', 'Afficher les détails'),
              child: Panel(
                title: tr('Statistics', 'Statistiques'),
                icon: Icons.bar_chart_rounded,
                child: _StatBars(rows: rows, home: e.home?.name ?? '', away: e.away?.name ?? ''),
              ),
            ),
        ];
      },
    );
  }
}

class _StatBars extends StatelessWidget {
  const _StatBars({required this.rows, required this.home, required this.away});
  final List<Json> rows;
  final String home, away;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final homeColor = context.isDark ? c.brand : FsColors.navy;
    const awayColor = FsColors.orange;
    Widget dot(Color color) => Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
    return Column(children: [
      Row(children: [
        dot(homeColor),
        const SizedBox(width: 6),
        Expanded(child: Text(home, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, color: c.ink, fontSize: 13))),
        Expanded(child: Text(away, textAlign: TextAlign.right, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, color: c.ink, fontSize: 13))),
        const SizedBox(width: 6),
        dot(awayColor),
      ]),
      const SizedBox(height: 14),
      for (final row in rows) ...[
        Builder(builder: (context) {
          final h = asString(row['home']), a = asString(row['away']);
          final l = double.tryParse((h ?? '').replaceAll('%', '')), r = double.tryParse((a ?? '').replaceAll('%', ''));
          final share = (l != null && r != null && l + r > 0) ? l / (l + r) : null;
          return Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Column(children: [
              Row(children: [
                Text(h ?? '–', style: TextStyle(fontFamily: 'Sora', fontWeight: (l ?? 0) > (r ?? 0) ? FontWeight.w800 : FontWeight.w500, color: c.ink, fontSize: 14.5)),
                Expanded(child: Text(statLabel(row)!, textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, color: c.ink2))),
                Text(a ?? '–', style: TextStyle(fontFamily: 'Sora', fontWeight: (r ?? 0) > (l ?? 0) ? FontWeight.w800 : FontWeight.w500, color: c.ink, fontSize: 14.5)),
              ]),
              if (share != null) ...[
                const SizedBox(height: 6),
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0.5, end: share),
                  duration: const Duration(milliseconds: 700),
                  curve: AppTheme.ease,
                  builder: (context, v, _) => Row(children: [
                    Expanded(
                      flex: (v * 1000).round().clamp(1, 999),
                      child: Container(height: 7, decoration: BoxDecoration(color: homeColor, borderRadius: BorderRadius.circular(99))),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      flex: ((1 - v) * 1000).round().clamp(1, 999),
                      child: Container(height: 7, decoration: BoxDecoration(color: awayColor, borderRadius: BorderRadius.circular(99))),
                    ),
                  ]),
                ),
              ],
            ]),
          );
        }),
      ],
    ]);
  }
}

// ---------------- Participants ----------------

class ParticipantsTab extends ConsumerWidget {
  const ParticipantsTab({super.key, required this.event});
  final SportEvent event;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final e = event;
    final d = e.details;
    final teamDuel = e.isDuel && e.participantType == 'team';
    if (teamDuel) {
      return _DetailGate(
        id: e.id,
        builder: (detail) {
          final lineups = asMap(detail['lineups']);
          final home = asMapList(lineups['home']), away = asMapList(lineups['away']);
          if (home.isEmpty && away.isEmpty) {
            return [
              Panel(
                title: tr('Teams', 'Équipes'),
                icon: Icons.groups_rounded,
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text(sportNote(e.sportId, 'lineups'), style: context.text.bodyMedium),
                  const SizedBox(height: 10),
                  for (final p in e.participants.where((p) => p.rawName != 'TBD'))
                    Pressable(
                      onTap: () => context.push('/team/${Uri.encodeComponent(p.rawName)}?sport=${e.sportId}'),
                      child: Container(
                        margin: const EdgeInsets.only(top: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: context.fs.surfaceMuted, borderRadius: BorderRadius.circular(12)),
                        child: Row(children: [Crest(url: p.badgeUrl, name: p.name, size: 24), const SizedBox(width: 10), Expanded(child: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w700)))]),
                      ),
                    ),
                ]),
              ),
            ];
          }
          return [
            _Squad(title: e.home?.name ?? '', players: home, color: context.isDark ? context.fs.brand : FsColors.navy),
            _Squad(title: e.away?.name ?? '', players: away, color: FsColors.orange),
          ];
        },
      );
    }
    final bouts = d != null && d['kind'] == 'combat' ? asMapList(d['bouts']) : <Json>[];
    if (bouts.length > 1) {
      return TabScroll(children: [
        Panel(title: tr('Participants', 'Participants'), icon: Icons.groups_rounded, child: Column(children: [for (final b in bouts) BoutCard(bout: b, showResult: false)])),
      ]);
    }
    final ranks = d != null && d['kind'] == 'tennis' ? (d['ranks'] as List? ?? []).map(asInt).toList() : <int?>[];
    if (ranks.any((r) => r != null)) {
      return TabScroll(children: [
        Panel(
          title: tr('Participants', 'Participants'),
          icon: Icons.groups_rounded,
          child: Column(children: [
            for (var i = 0; i < e.participants.length; i++)
              _EntrantRow(name: e.participants[i].rawName, trailing: i < ranks.length && ranks[i] != null ? Pill(tr('World no. ${ranks[i]}', 'N° ${ranks[i]} mondial')) : null),
          ]),
        ),
      ]);
    }
    final classified = e.scoreKind == 'classification';
    final rows = classified
        ? (e.classification.map((x) => (str(x['name']), asString(x['team']), asString(x['playerId']))).toList()..sort((a, b) => a.$1.compareTo(b.$1)))
        : e.participants.map((p) => (p.rawName, null as String?, null as String?)).toList();
    if (rows.isEmpty) {
      return TabScroll(children: [StateView.empty(tr('No participants listed', 'Aucun participant'), icon: Icons.groups_rounded, compact: true)]);
    }
    final list = Panel(
      title: tr('Participants', 'Participants'),
      icon: Icons.groups_rounded,
      child: Column(children: [for (final r in rows) _EntrantRow(name: r.$1, team: r.$2, playerId: r.$3)]),
    );
    return TabScroll(children: [classified ? SpoilerGuard(label: tr('Reveal result', 'Afficher le résultat'), child: list) : list]);
  }
}

class _EntrantRow extends ConsumerWidget {
  const _EntrantRow({required this.name, this.team, this.playerId, this.trailing});
  final String name;
  final String? team, playerId;
  final Widget? trailing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final fav = ref.watch(prefsValueProvider).isFavorite(name);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        Expanded(
          child: Pressable(
            haptic: false,
            onTap: playerId != null ? () => context.push('/player/$playerId') : null,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: TextStyle(fontWeight: FontWeight.w700, color: c.ink)),
              if (team != null) Text(team!, style: TextStyle(fontSize: 12, color: c.ink3)),
            ]),
          ),
        ),
        if (trailing != null) ...[trailing!, const SizedBox(width: 6)],
        IconButton(
          visualDensity: VisualDensity.compact,
          onPressed: () => ref.read(prefsProvider.notifier).toggleFavorite(name).catchError((Object e) {
            if (context.mounted) toast(context, errorText(e), error: true);
          }),
          icon: Icon(fav ? Icons.star_rounded : Icons.star_border_rounded, color: fav ? c.accent : c.ink3),
        ),
      ]),
    );
  }
}

class _Squad extends StatelessWidget {
  const _Squad({required this.title, required this.players, required this.color});
  final String title;
  final List<Json> players;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final starters = players.where((p) => !asBool(p['substitute'])).toList();
    final bench = players.where((p) => asBool(p['substitute'])).toList();
    Widget row(Json p) {
      final pid = asString(p['playerId']);
      final role = asString(p['role']);
      final group = asString(p['group']);
      return Pressable(
        haptic: false,
        onTap: pid != null ? () => context.push('/player/$pid') : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Row(children: [
            Container(
              width: 30,
              height: 26,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(8)),
              child: Text(asInt(p['number'])?.toString() ?? '', style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, fontSize: 12, color: c.ink)),
            ),
            const SizedBox(width: 10),
            Expanded(child: Text(str(p['name']), style: TextStyle(fontWeight: FontWeight.w600, color: pid != null ? c.ink : c.ink2))),
            if (group != null) Text(positionShort(group), style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: c.ink3)),
            if (role != null) Text(basketballRole(role), style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: c.ink3)),
          ]),
        ),
      );
    }

    return Panel(
      title: title,
      icon: Icons.groups_rounded,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ...starters.map(row),
        if (bench.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.only(top: 10, bottom: 4),
            child: Text(tr('Substitutes', 'Remplaçants'), style: context.text.labelMedium),
          ),
          ...bench.map(row),
        ],
      ]),
    );
  }
}
