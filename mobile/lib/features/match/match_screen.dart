import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';
import '../../widgets/event_tile.dart';
import 'chat_panel.dart';
import 'match_actions.dart';
import 'match_data.dart';
import 'match_detail_tabs.dart';
import 'match_sections.dart';
import 'match_terms.dart';
import 'match_watch_tab.dart';
import 'predict_panel.dart';

/// The match centre: hero, actions and the sport's own tabs (app/[locale]/app/match/[id]).
class MatchScreen extends ConsumerStatefulWidget {
  const MatchScreen({super.key, required this.id, this.initialTab});
  final String id;
  final String? initialTab;

  @override
  ConsumerState<MatchScreen> createState() => _MatchScreenState();
}

class _MatchScreenState extends ConsumerState<MatchScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    // Live games refresh in place; low-data mode skips it, as on the web.
    _timer = Timer.periodic(const Duration(seconds: 45), (_) {
      final e = ref.read(matchProvider(widget.id)).value;
      if (e == null || !e.isLive || ref.read(prefsValueProvider).lowData) return;
      ref.invalidate(matchProvider(widget.id));
      ref.invalidate(matchDetailProvider(widget.id));
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final v = ref.watch(matchProvider(widget.id));
    if (v.hasValue) return _MatchView(event: v.value!, initialTab: widget.initialTab);
    return Scaffold(
      appBar: AppBar(title: Text(tr('Match centre', 'Centre du match'))),
      body: v.hasError
          ? ErrorView(error: v.error!, onRetry: () => ref.invalidate(matchProvider(widget.id)))
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(children: [
                const Skeleton(height: 220, radius: 24),
                const SizedBox(height: 16),
                Row(children: List.generate(4, (_) => const Expanded(child: Padding(padding: EdgeInsets.symmetric(horizontal: 4), child: Skeleton(height: 56, radius: 16))))),
                const SizedBox(height: 16),
                const Expanded(child: SkeletonList(count: 4, padding: EdgeInsets.zero)),
              ]),
            ),
    );
  }
}

class _TabSpec {
  const _TabSpec(this.key, this.label, this.icon);
  final String key, label;
  final IconData icon;
}

class _MatchView extends ConsumerStatefulWidget {
  const _MatchView({required this.event, this.initialTab});
  final SportEvent event;
  final String? initialTab;

  @override
  ConsumerState<_MatchView> createState() => _MatchViewState();
}

class _MatchViewState extends ConsumerState<_MatchView> with TickerProviderStateMixin {
  TabController? _tabs;
  List<_TabSpec> _specs = [];

  List<_TabSpec> _buildSpecs(SportEvent e) {
    final steps = sportSteps(e);
    final duelTeams = e.isDuel && e.participantType == 'team';
    return [
      _TabSpec('overview', tr('Overview', 'Aperçu'), Icons.dashboard_rounded),
      if (!noTimeline.contains(e.sportId) || steps.isNotEmpty) _TabSpec('updates', tr('Updates', 'Direct'), Icons.timeline_rounded),
      if (!noStatistics.contains(e.sportId) || hasSportStatistics(e)) _TabSpec('statistics', tr('Stats', 'Stats'), Icons.bar_chart_rounded),
      _TabSpec('participants', duelTeams ? tr('Lineups', 'Compos') : tr('Participants', 'Participants'), Icons.groups_rounded),
      _TabSpec('watch', tr('Watch', 'Regarder'), Icons.play_circle_rounded),
      _TabSpec('chat', tr('Chat', 'Chat'), Icons.forum_rounded),
      if (predictionKind(e) != null) _TabSpec('predict', tr('Predict', 'Pronostic'), Icons.insights_rounded),
    ];
  }

  void _syncTabs() {
    final next = _buildSpecs(widget.event);
    if (_tabs != null && next.map((s) => s.key).join() == _specs.map((s) => s.key).join()) return;
    final previousKey = _tabs == null ? null : _specs[_tabs!.index].key;
    _specs = next;
    final wanted = previousKey ?? (widget.initialTab == 'chat' ? 'chat' : widget.initialTab);
    final index = wanted == null ? 0 : _specs.indexWhere((s) => s.key == wanted);
    _tabs?.dispose();
    _tabs = TabController(length: _specs.length, vsync: this, initialIndex: index < 0 ? 0 : index);
  }

  void goTo(String key) {
    final i = _specs.indexWhere((s) => s.key == key);
    if (i >= 0) _tabs?.animateTo(i);
  }

  @override
  void initState() {
    super.initState();
    _syncTabs();
  }

  @override
  void didUpdateWidget(covariant _MatchView oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncTabs();
  }

  @override
  void dispose() {
    _tabs?.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(matchDetailProvider(widget.event.id));
    ref.invalidate(matchProvider(widget.event.id));
    try {
      await ref.read(matchProvider(widget.event.id).future);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final e = widget.event;
    final c = context.fs;
    return Scaffold(
      body: NestedScrollView(
        headerSliverBuilder: (context, inner) => [
          _HeroAppBar(event: e),
          SliverToBoxAdapter(child: _ActionBar(event: e, onRoom: () => context.push('/rooms?match=${Uri.encodeComponent(e.id)}'))),
          SliverPersistentHeader(
            pinned: true,
            delegate: _TabsHeader(
              color: c.bg,
              line: c.line,
              tabBar: TabBar(
                controller: _tabs,
                isScrollable: true,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                tabs: [
                  for (final s in _specs)
                    Tab(height: 46, child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(s.icon, size: 17), const SizedBox(width: 6), Text(s.label)])),
                ],
              ),
            ),
          ),
        ],
        body: TabBarView(
          controller: _tabs,
          children: [
            for (final s in _specs)
              switch (s.key) {
                'overview' => _Overview(event: e, onRefresh: _refresh, onWatch: () => goTo('watch')),
                'updates' => TimelineTab(event: e),
                'statistics' => StatsTab(event: e),
                'participants' => ParticipantsTab(event: e),
                'watch' => MatchWatchTab(event: e),
                'chat' => ChatPanel(
                    scope: 'match',
                    scopeId: e.id,
                    listPath: '/matches/${Uri.encodeComponent(e.id)}/chat',
                    postPath: '/matches/${Uri.encodeComponent(e.id)}/chat',
                    showPoll: true,
                  ),
                _ => PredictTab(event: e),
              },
          ],
        ),
      ),
    );
  }
}

class _TabsHeader extends SliverPersistentHeaderDelegate {
  _TabsHeader({required this.tabBar, required this.color, required this.line});
  final TabBar tabBar;
  final Color color, line;

  @override
  double get minExtent => 47;
  @override
  double get maxExtent => 47;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) =>
      Container(decoration: BoxDecoration(color: color, border: Border(bottom: BorderSide(color: line))), child: tabBar);

  @override
  bool shouldRebuild(covariant _TabsHeader old) => old.tabBar != tabBar || old.color != color;
}

// ---------------- Hero ----------------

class _HeroAppBar extends ConsumerWidget {
  const _HeroAppBar({required this.event});
  final SportEvent event;

  void _openCompetition(BuildContext context) {
    final id = event.competitionId;
    if (id == null || !RegExp(r'^\d{1,8}$').hasMatch(id)) return;
    if (cupCompetitions.any((c) => c.$1 == id)) {
      context.push('/cups?competition=$id');
    } else if (raceSeries.any((r) => r.$1 == id)) {
      context.push('/motorsport?series=$id');
    } else if (Sport.leagueCollected.contains(event.sportId)) {
      context.push('/league/$id');
    } else if (event.participantType == 'team') {
      context.push('/standings/$id');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final e = event;
    final top = MediaQuery.paddingOf(context).top;
    final duel = e.isDuel;
    final expanded = duel ? 312.0 : 268.0;
    final collapsedTitle = duel && e.compactScore != null && !ref.watch(prefsValueProvider).spoilerMode
        ? '${e.home!.name}  ${e.compactScore}  ${e.away!.name}'
        : e.title;
    return SliverAppBar(
      pinned: true,
      stretch: true,
      expandedHeight: expanded,
      backgroundColor: context.fs.heroStart,
      foregroundColor: Colors.white,
      systemOverlayStyle: SystemUiOverlayStyle.light,
      leading: IconButton(icon: const Icon(Icons.arrow_back_rounded), onPressed: () => context.canPop() ? context.pop() : context.go('/scores')),
      flexibleSpace: LayoutBuilder(builder: (context, box) {
        final t = ((box.maxHeight - kToolbarHeight - top) / (expanded - kToolbarHeight)).clamp(0.0, 1.0);
        return Stack(fit: StackFit.expand, children: [
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: e.isLive ? [const Color(0xFF3A0A14), context.fs.heroStart, context.fs.heroEnd] : [context.fs.heroStart, context.fs.heroEnd, FsColors.navyDeep],
              ),
            ),
          ),
          Positioned(
            right: -40,
            top: -30,
            child: Icon(Sport.iconOf(e.sportId), size: 220, color: Colors.white.withValues(alpha: 0.04)),
          ),
          Positioned(
            left: 0,
            right: 0,
            top: top + kToolbarHeight - 6,
            bottom: 0,
            child: Opacity(
              opacity: Curves.easeOut.transform(t),
              child: Transform.translate(offset: Offset(0, (1 - t) * -20), child: _HeroBody(event: e, onCompetition: () => _openCompetition(context))),
            ),
          ),
          Positioned(
            left: 56,
            right: 56,
            top: top,
            height: kToolbarHeight,
            child: IgnorePointer(
              child: Opacity(
                opacity: (1 - t * 2.5).clamp(0.0, 1.0),
                child: Center(
                  child: Text(collapsedTitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, fontSize: 16, color: Colors.white)),
                ),
              ),
            ),
          ),
        ]);
      }),
    );
  }
}

class _HeroBody extends ConsumerWidget {
  const _HeroBody({required this.event, required this.onCompetition});
  final SportEvent event;
  final VoidCallback onCompetition;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final e = event;
    final start = e.start;
    final kick = kickoffSports.contains(e.sportId) ? tr('Kickoff', 'Coup d’envoi') : tr('Start', 'Début');
    final when = start == null
        ? tr('Time to be confirmed', 'Horaire à confirmer')
        : e.dateOnly
            ? '${Fmt.dayMonthYear(start)} · ${tr('Time to be confirmed', 'Horaire à confirmer')}'
            : '$kick · ${Fmt.weekdayLong(start)} · ${Fmt.time(start)}';
    const white70 = TextStyle(color: Colors.white70, fontSize: 12.5, fontWeight: FontWeight.w600);

    Widget status() {
      if (e.isLive) {
        return Pill(e.clockText.isNotEmpty ? '${tr('LIVE', 'DIRECT')} · ${e.clockText}' : tr('LIVE', 'DIRECT'), live: true, background: Colors.white.withValues(alpha: 0.14))
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .shimmer(duration: 1800.ms, color: Colors.white24);
      }
      return Pill(e.statusLabel, color: Colors.white, background: Colors.white.withValues(alpha: 0.14));
    }

    final header = Pressable(
      onTap: onCompetition,
      haptic: false,
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(Sport.iconOf(e.sportId), size: 15, color: Colors.white70),
        const SizedBox(width: 6),
        Flexible(child: Text(e.competitionName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700))),
        const Icon(Icons.chevron_right_rounded, size: 16, color: Colors.white54),
      ]),
    );

    if (!e.isDuel) {
      final podium = e.classification.take(3).toList();
      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          header,
          const SizedBox(height: 10),
          Text(e.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Sora', fontSize: 24, fontWeight: FontWeight.w800, color: Colors.white, height: 1.15)),
          const SizedBox(height: 10),
          status(),
          const Spacer(),
          if (podium.isNotEmpty)
            SpoilerGuard(
              label: tr('Reveal result', 'Afficher le résultat'),
              child: Row(children: [
                for (final p in podium)
                  Expanded(
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('P${p['position']}', style: const TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, color: FsColors.orange)),
                        Text(str(p['name']), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                      ]),
                    ),
                  ),
              ]),
            )
          else if (e.scoreKind == 'combat')
            SpoilerGuard(child: Text(SportEvent.combatText(e.score), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)))
          else
            Text(when, style: white70),
          if (e.venue != null) ...[const SizedBox(height: 8), Text(e.venue!, maxLines: 1, overflow: TextOverflow.ellipsis, style: white70)],
        ]),
      );
    }

    final values = e.rowValues;
    final hasScore = !e.isScheduled && values.any((v) => v != null);
    Widget side(Participant p) {
      final teams = e.participantType == 'team' && p.rawName != 'TBD';
      return Expanded(
        child: Pressable(
          onTap: teams ? () => context.push('/team/${Uri.encodeComponent(p.rawName)}?sport=${e.sportId}') : null,
          child: Column(children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.08), shape: BoxShape.circle),
              child: Crest(url: p.badgeUrl, name: p.name, size: 54),
            ).animate().scale(begin: const Offset(0.85, 0.85), duration: 500.ms, curve: Curves.easeOutBack),
            const SizedBox(height: 10),
            Text(p.name, maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14, height: 1.2)),
          ]),
        ),
      );
    }

    final scoreText = e.scoreKind == 'team' || e.scoreKind == 'sets'
        ? (e.compactScore ?? '')
        : values.map((v) => v ?? '–').join('\n');

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Column(children: [
        header,
        const SizedBox(height: 14),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          side(e.participants[0]),
          SizedBox(
            width: 128,
            child: Column(children: [
              const SizedBox(height: 18),
              if (hasScore)
                SpoilerGuard(
                  label: tr('Reveal score', 'Afficher le score'),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 350),
                    transitionBuilder: (child, a) => ScaleTransition(scale: a, child: FadeTransition(opacity: a, child: child)),
                    child: Text(
                      scoreText,
                      key: ValueKey(scoreText),
                      textAlign: TextAlign.center,
                      style: TextStyle(fontFamily: 'Sora', fontSize: e.scoreKind == 'innings' ? 17 : 38, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -1, height: 1.15),
                    ),
                  ),
                )
              else
                Text(
                  start == null || e.dateOnly ? 'vs' : Fmt.time(start),
                  style: const TextStyle(fontFamily: 'Sora', fontSize: 30, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.5),
                ),
              const SizedBox(height: 8),
              status(),
              if (e.isFinished && e.conclusionLabel != null)
                Padding(padding: const EdgeInsets.only(top: 6), child: SpoilerGuard(label: '…', child: Text(e.conclusionLabel!, textAlign: TextAlign.center, style: white70))),
              if (e.shootout != null)
                SpoilerGuard(label: '…', child: Text('(${e.shootout!['home']} - ${e.shootout!['away']} ${tr('pens', 'tab')})', style: white70)),
              if (e.aggregate != null)
                SpoilerGuard(label: '…', child: Text('${tr('Agg.', 'Cumul')} ${e.aggregate!['home']} - ${e.aggregate!['away']}', style: white70)),
            ]),
          ),
          side(e.participants[1]),
        ]),
        const Spacer(),
        Text(when, textAlign: TextAlign.center, style: white70),
        if (e.venue != null) Text(e.venue!, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white54, fontSize: 12)),
      ]),
    );
  }
}

// ---------------- Action bar ----------------

class _ActionBar extends ConsumerWidget {
  const _ActionBar({required this.event, required this.onRoom});
  final SportEvent event;
  final VoidCallback onRoom;

  Future<void> _run(BuildContext context, Future<void> Function() action, String done) async {
    HapticFeedback.selectionClick();
    try {
      await action();
      if (context.mounted) toast(context, done);
    } catch (e) {
      if (context.mounted) toast(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final e = event;
    final prefs = ref.watch(prefsValueProvider);
    final notifier = ref.read(prefsProvider.notifier);
    final names = e.participants.where((p) => p.rawName != 'TBD').map((p) => p.rawName).toList();
    final followsAll = names.isNotEmpty && names.every(prefs.isFavorite);
    final reminder = prefs.hasReminder(e.id);
    final pinned = prefs.isPinned(e.id);

    Future<void> follow() async {
      if (names.length <= 1 || !e.isDuel) {
        if (names.isEmpty) return;
        await _run(context, () => notifier.toggleFavorite(names.first), prefs.isFavorite(names.first) ? tr('Removed from favorites', 'Retiré des favoris') : tr('Added to favorites', 'Ajouté aux favoris'));
        return;
      }
      await showModalBottomSheet<void>(
        context: context,
        builder: (sheet) => Consumer(builder: (context, ref, _) {
          final p = ref.watch(prefsValueProvider);
          return SafeArea(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(tr('Follow', 'Suivre'), style: context.text.titleLarge),
              const SizedBox(height: 8),
              for (final part in e.participants.where((x) => x.rawName != 'TBD'))
                ListTile(
                  leading: Crest(url: part.badgeUrl, name: part.name, size: 30),
                  title: Text(part.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                  trailing: Icon(p.isFavorite(part.rawName) ? Icons.star_rounded : Icons.star_border_rounded, color: p.isFavorite(part.rawName) ? context.fs.accent : context.fs.ink3),
                  onTap: () => ref.read(prefsProvider.notifier).toggleFavorite(part.rawName).catchError((Object err) {
                    if (context.mounted) toast(context, errorText(err), error: true);
                  }),
                ),
              const SizedBox(height: 12),
            ]),
          );
        }),
      );
    }

    final actions = <(IconData, String, bool, VoidCallback)>[
      (followsAll ? Icons.star_rounded : Icons.star_border_rounded, tr('Follow', 'Suivre'), followsAll, follow),
      if (e.isScheduled)
        (
          reminder ? Icons.notifications_active_rounded : Icons.notifications_none_rounded,
          tr('Remind', 'Rappel'),
          reminder,
          () => _run(context, () => notifier.toggleReminder(e.id, e.title, e.startUTC), reminder ? tr('Reminder removed', 'Rappel supprimé') : tr('Reminder set', 'Rappel activé')),
        ),
      (
        pinned ? Icons.push_pin_rounded : Icons.push_pin_outlined,
        tr('Board', 'Tableau'),
        pinned,
        () => _run(context, () => notifier.togglePin(e.id), pinned ? tr('Removed from your board', 'Retiré du tableau') : tr('Pinned to your board', 'Épinglé au tableau')),
      ),
      (Icons.ios_share_rounded, tr('Share', 'Partager'), false, () => showShareSheet(context, matchId: e.id, hasResult: e.hasResult)),
      (Icons.picture_as_pdf_rounded, 'PDF', false, () => exportPdf(context, path: '/exports', body: {'matchId': e.id}, fileName: 'flacronsport-${e.id}.pdf')),
      (Icons.groups_2_rounded, tr('Room', 'Salon'), false, onRoom),
    ];

    final c = context.fs;
    return SizedBox(
      height: 92,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
        itemCount: actions.length,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (context, i) {
          final (icon, label, active, onTap) = actions[i];
          return Pressable(
            onTap: onTap,
            child: SizedBox(
              width: 62,
              child: Column(children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: active ? c.accent.withValues(alpha: 0.16) : c.surface,
                    border: Border.all(color: active ? c.accent : c.line),
                  ),
                  child: Icon(icon, size: 21, color: active ? c.accent : c.ink2),
                ),
                const SizedBox(height: 5),
                Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: c.ink2)),
              ]),
            ),
          ).entrance(i, baseMs: 30);
        },
      ),
    );
  }
}

// ---------------- Overview ----------------

class _Overview extends ConsumerWidget {
  const _Overview({required this.event, required this.onRefresh, required this.onWatch});
  final SportEvent event;
  final Future<void> Function() onRefresh;
  final VoidCallback onWatch;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final e = event;
    final c = context.fs;
    final start = e.start;
    final stale = isStaleUpdate(e);
    final summary = e.details?['kind'] == 'football' ? asString(e.details!['summary']) : null;
    final teamDuel = e.isDuel && e.participantType == 'team';
    final facts = <Fact>[
      (
        kickoffSports.contains(e.sportId) ? tr('Kickoff', 'Coup d’envoi') : tr('Start', 'Début'),
        start == null ? tr('Time to be confirmed', 'Horaire à confirmer') : (e.dateOnly ? '${Fmt.dayMonthYear(start)}. ${tr('Time to be confirmed', 'Horaire à confirmer')}' : Fmt.full(start)),
      ),
      (tr('Competition', 'Compétition'), e.competitionName),
      if (e.venue != null) (tr('Venue', 'Lieu'), e.venue!),
      ...sportFacts(e),
    ];
    final updated = Fmt.parse(e.sourceUpdatedAt);

    return TabScroll(
      onRefresh: onRefresh,
      children: [
        if (stale)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: c.warning.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14), border: Border.all(color: c.warning.withValues(alpha: 0.35))),
            child: Row(children: [
              Icon(Icons.schedule_rounded, color: c.warning, size: 18),
              const SizedBox(width: 10),
              Expanded(child: Text(tr('This information may be out of date. The source has not updated it recently.', "Ces informations peuvent être dépassées : la source ne les a pas mises à jour récemment."), style: TextStyle(color: c.ink, fontSize: 13))),
            ]),
          ),
        if (e.scoreKind != 'none' && e.scoreKind != 'team') Panel(title: tr('Result', 'Résultat'), icon: Icons.emoji_events_rounded, child: ResultPanel(event: e)),
        if (LineScoreTable.available(e, null))
          Panel(title: LineScoreTable.caption(e, null), icon: Icons.table_chart_rounded, child: SpoilerGuard(label: tr('Reveal score', 'Afficher le score'), child: LineScoreTable(event: e))),
        if (AppLocale.code == 'en' && summary != null && summary.isNotEmpty)
          Panel(title: 'Match summary', icon: Icons.auto_awesome_rounded, child: SpoilerGuard(child: Text(summary, style: context.text.bodyLarge?.copyWith(height: 1.5)))),
        if (teamDuel) TeamFormPanel(event: e),
        Pressable(
          onTap: onWatch,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              gradient: LinearGradient(colors: [FsColors.orange.withValues(alpha: 0.95), const Color(0xFFFF7A3D)]),
            ),
            child: Row(children: [
              const Icon(Icons.play_circle_fill_rounded, color: Colors.white, size: 30),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(tr('Where to watch', 'Où regarder'), style: const TextStyle(fontFamily: 'Sora', color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                  Text(tr('Highlights, live streams and TV listings', 'Résumés, flux en direct et diffusions TV'), style: const TextStyle(color: Colors.white70, fontSize: 12.5)),
                ]),
              ),
              const Icon(Icons.chevron_right_rounded, color: Colors.white),
            ]),
          ),
        ),
        if (!e.isDuel && e.scoreKind == 'none' && e.participants.isEmpty)
          Text(tr('Participants have not been announced yet.', "Les participants n'ont pas encore été annoncés."), style: context.text.bodyMedium),
        Panel(title: tr('Facts', 'Infos'), icon: Icons.info_outline_rounded, child: FactList(facts)),
        WeekendSessionsPanel(event: e),
        if (updated != null)
          Center(child: Text('${tr('Last update', 'Dernière mise à jour')}: ${Fmt.full(updated)}', style: context.text.bodySmall)),
      ],
    );
  }
}
