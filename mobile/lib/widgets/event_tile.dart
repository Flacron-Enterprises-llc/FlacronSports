import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/i18n.dart';
import '../core/state/providers.dart';
import '../core/theme/app_theme.dart';
import '../models/json.dart';
import '../models/priority.dart';
import '../models/sport.dart';
import 'common.dart';

/// Hides a score until tapped when the member has spoiler mode on.
class SpoilerGuard extends ConsumerStatefulWidget {
  const SpoilerGuard({super.key, required this.child, this.active = true, this.label});
  final Widget child;
  final bool active;
  final String? label;

  @override
  ConsumerState<SpoilerGuard> createState() => _SpoilerGuardState();
}

class _SpoilerGuardState extends ConsumerState<SpoilerGuard> {
  bool _revealed = false;

  @override
  Widget build(BuildContext context) {
    final spoiler = ref.watch(prefsValueProvider).spoilerMode;
    if (!spoiler || !widget.active || _revealed) return widget.child;
    final c = context.fs;
    return GestureDetector(
      onTap: () => setState(() => _revealed = true),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(10), border: Border.all(color: c.line)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.visibility_off_rounded, size: 14, color: c.ink3),
          const SizedBox(width: 5),
          Text(widget.label ?? tr('Reveal', 'Afficher'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.ink2)),
        ]),
      ),
    );
  }
}

/// One match row: time/status column, both sides with crests, and the score.
class EventTile extends ConsumerWidget {
  const EventTile({super.key, required this.event, this.showCompetition = false, this.dense = false, this.onTap});
  final SportEvent event;
  final bool showCompetition;
  final bool dense;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final e = event;
    final prefs = ref.watch(prefsValueProvider);
    final followed = e.participants.any((p) => prefs.isFavorite(p.rawName));
    final statusColor = switch (e.status) {
      'live' => c.live,
      'postponed' || 'interrupted' => c.warning,
      'canceled' || 'abandoned' => c.danger,
      _ => c.ink3,
    };

    final timeColumn = SizedBox(
      width: 58,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (e.isLive)
          Row(children: [const LiveDot(size: 6), const SizedBox(width: 4), Flexible(child: Text(e.timeLabel, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: c.live)))])
        else
          Text(e.timeLabel, maxLines: 2, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: e.isScheduled ? c.ink : statusColor)),
        if (e.isFinished && e.conclusionLabel != null)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: SpoilerGuard(active: true, label: '…', child: Text(_shortConclusion(e.conclusion), style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: c.ink3))),
          ),
      ]),
    );

    Widget body;
    if (e.isDuel) {
      final values = e.rowValues;
      final hs = e.homeScore, as = e.awayScore;
      Widget side(int i) {
        final p = e.participants[i];
        final v = i < values.length ? values[i] : null;
        final lost = e.isFinished && hs != null && as != null && hs != as && ((i == 0 && hs < as) || (i == 1 && as < hs));
        final fav = prefs.isFavorite(p.rawName);
        return Padding(
          padding: EdgeInsets.symmetric(vertical: dense ? 2 : 3),
          child: Row(children: [
            Crest(url: p.badgeUrl, name: p.name, size: dense ? 20 : 22),
            const SizedBox(width: 10),
            Expanded(
              child: Text(p.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 14.5, fontWeight: fav ? FontWeight.w800 : FontWeight.w600, color: lost ? c.ink3 : c.ink)),
            ),
            if (fav) Padding(padding: const EdgeInsets.only(left: 4), child: Icon(Icons.star_rounded, size: 14, color: c.accent)),
            if (v != null)
              SpoilerGuard(
                active: !e.isScheduled,
                label: '•',
                child: Padding(
                  padding: const EdgeInsets.only(left: 10),
                  child: Text(v,
                      style: TextStyle(
                        fontFamily: 'Sora',
                        fontSize: 15.5,
                        fontWeight: FontWeight.w800,
                        color: e.isLive ? c.live : (lost ? c.ink3 : c.ink),
                        fontFeatures: const [FontFeature.tabularFigures()],
                      )),
                ),
              ),
          ]),
        );
      }

      body = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        side(0),
        side(1),
        if (e.isFinished && e.resultNote != null && e.scoreKind != 'team')
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: SpoilerGuard(child: Text(e.resultNote!, maxLines: 2, style: TextStyle(fontSize: 12, color: c.ink3, fontWeight: FontWeight.w500))),
          ),
      ]);
    } else {
      final top = e.classification.take(3).toList();
      body = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(e.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: c.ink)),
        if (e.eventName != null && e.eventName != e.competitionName && !showCompetition)
          Text(e.competitionName, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: c.ink3)),
        if (top.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: SpoilerGuard(
              child: Text(top.map((t) => '${t['position']}. ${t['name']}').join('   '),
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: c.ink2, fontWeight: FontWeight.w600)),
            ),
          )
        else if (e.scoreKind == 'combat')
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: SpoilerGuard(child: Text(SportEvent.combatText(e.score), maxLines: 2, style: TextStyle(fontSize: 12, color: c.ink2))),
          )
        else if (e.participants.isNotEmpty && e.participants.length <= 4)
          Text(e.participants.map((p) => p.name).join(' · '), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: c.ink3)),
      ]);
    }

    return Pressable(
      onTap: onTap ?? () => context.push('/match/${Uri.encodeComponent(e.id)}'),
      scale: 0.985,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 14, vertical: dense ? 10 : 12),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: e.isLive ? c.live.withValues(alpha: 0.35) : (followed ? c.accent.withValues(alpha: 0.35) : c.line)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (showCompetition)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(children: [
                Icon(Sport.iconOf(e.sportId), size: 13, color: c.ink3),
                const SizedBox(width: 6),
                Expanded(child: Text(e.competitionName, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.labelSmall)),
                if (e.isScheduled && e.start != null && !Fmt.sameDay(e.start!, DateTime.now()))
                  Text(Fmt.relativeDay(e.start!), style: context.text.labelSmall),
              ]),
            ),
          Row(crossAxisAlignment: CrossAxisAlignment.center, children: [timeColumn, Expanded(child: body)]),
        ]),
      ),
    );
  }

  static String _shortConclusion(String? c) => switch (c) {
        'extra-time' => tr('AET', 'AP'),
        'overtime' => 'OT',
        'penalties' => tr('Pens', 'TAB'),
        'shootout' => 'SO',
        'awarded' => tr('Awd', 'TV'),
        'walkover' => 'W/O',
        _ => '',
      };
}

/// A compact card for horizontal carousels (live now, upcoming).
class EventCard extends ConsumerWidget {
  const EventCard({super.key, required this.event, this.width = 250});
  final SportEvent event;
  final double width;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final e = event;
    Widget team(Participant p, String? v) => Row(children: [
          Crest(url: p.badgeUrl, name: p.name, size: 26),
          const SizedBox(width: 10),
          Expanded(child: Text(p.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white))),
          if (v != null)
            SpoilerGuard(
              active: !e.isScheduled,
              label: '•',
              child: Text(v, style: const TextStyle(fontFamily: 'Sora', fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
            ),
        ]);
    final values = e.rowValues;
    return Pressable(
      onTap: () => context.push('/match/${Uri.encodeComponent(e.id)}'),
      child: Container(
        width: width,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: e.isLive ? [const Color(0xFF3A0A14), c.heroStart] : [c.heroStart, c.heroEnd],
          ),
          boxShadow: [BoxShadow(color: FsColors.navy.withValues(alpha: 0.25), blurRadius: 18, offset: const Offset(0, 8), spreadRadius: -8)],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            Icon(Sport.iconOf(e.sportId), size: 14, color: Colors.white70),
            const SizedBox(width: 6),
            Expanded(child: Text(e.competitionName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Colors.white70))),
            const SizedBox(width: 6),
            if (e.isLive)
              Pill(e.clockText.isNotEmpty ? e.clockText : tr('LIVE', 'DIRECT'), live: true, background: Colors.white.withValues(alpha: 0.12))
            else
              Text(e.isScheduled ? (e.kickoffLabel ?? '') : e.statusLabel, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Colors.white)),
          ]),
          const SizedBox(height: 12),
          if (e.isDuel) ...[
            team(e.participants[0], values.isNotEmpty ? values[0] : null),
            const SizedBox(height: 8),
            team(e.participants[1], values.length > 1 ? values[1] : null),
          ] else
            Text(e.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Sora', fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
        ]),
      ),
    );
  }
}

/// Groups events by competition, live first then by name (groupByCompetition).
List<(String key, String name, String sportId, String? competitionId, List<SportEvent> events)> groupByCompetition(List<SportEvent> events) {
  final map = <String, List<SportEvent>>{};
  for (final e in events) {
    final key = '${e.sportId}:${e.competitionId ?? e.competitionName}';
    map.putIfAbsent(key, () => []).add(e);
  }
  final groups = map.entries.map((m) {
    final list = m.value..sort((a, b) {
      final r = a.statusRank.compareTo(b.statusRank);
      if (r != 0) return r;
      return (a.startUTC ?? '').compareTo(b.startUTC ?? '');
    });
    final first = list.first;
    return (m.key, first.competitionName, first.sportId, first.competitionId, list);
  }).toList();
  groups.sort((a, b) {
    final la = a.$5.any((e) => e.isLive), lb = b.$5.any((e) => e.isLive);
    if (la != lb) return la ? -1 : 1;
    final ra = competitionRank(a.$2), rb = competitionRank(b.$2);
    if (ra != rb) return ra.compareTo(rb);
    return a.$2.toLowerCase().compareTo(b.$2.toLowerCase());
  });
  return groups;
}

Json? firstWhere(List<Json> list, bool Function(Json) test) {
  for (final x in list) {
    if (test(x)) return x;
  }
  return null;
}
