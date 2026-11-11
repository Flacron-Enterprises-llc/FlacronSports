import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../models/preferences.dart';
import '../../models/priority.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';
import '../../widgets/event_tile.dart';
import '../../widgets/user_avatar.dart';
import '../scores/event_actions.dart';
import '../scores/feed.dart';
import '../scores/scores_screen.dart';
import '../shell/app_shell.dart';
import 'highlights.dart';

final _homeWatchProvider = FutureProvider.autoDispose<Json>((ref) async => asMap(await api.get('/watch')));

final _homeReportsProvider = FutureProvider.autoDispose<List<Json>>((ref) async {
  final locale = ref.watch(prefsValueProvider).locale;
  final res = asMap(await api.get('/reports', query: {'locale': locale}));
  return asMapList(res['reports']).take(30).toList();
});

bool _adHiddenThisSession = false;

/// The member dashboard (components/dashboard/dashboard-home.tsx).
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  Timer? _timer;
  late String _today;

  @override
  void initState() {
    super.initState();
    _today = Fmt.isoDate(DateTime.now());
    _timer = Timer.periodic(const Duration(seconds: 60), (_) {
      if (!mounted) return;
      final now = Fmt.isoDate(DateTime.now());
      if (now != _today) {
        setState(() => _today = now);
        return;
      }
      if (ref.read(prefsValueProvider).lowData) return;
      final feed = ref.read(dayFeedProvider((date: _today, sport: null))).value;
      if (feed != null && feed.anyLive) ref.invalidate(dayFeedProvider((date: _today, sport: null)));
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(dayFeedProvider((date: _today, sport: null)));
    ref.invalidate(_homeWatchProvider);
    ref.invalidate(_homeReportsProvider);
    ref.invalidate(notificationsProvider);
    unawaited(ref.read(accountProvider.notifier).refresh());
    try {
      await ref.read(dayFeedProvider((date: _today, sport: null)).future);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final prefs = ref.watch(prefsValueProvider);
    final account = ref.watch(accountProvider).value;
    final feedAsync = ref.watch(dayFeedProvider((date: _today, sport: null)));
    final feed = feedAsync.value;
    final events = feed?.events ?? const <SportEvent>[];
    final live = events.where((e) => e.isLive).length;

    final home = prefs.homeFeed;
    final sections = home.order.where((s) => !home.hidden.contains(s)).toList();

    return Scaffold(
      body: RefreshIndicator(
        edgeOffset: 120,
        onRefresh: _refresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            _HomeHeader(liveCount: live, fixtures: events.length, loading: feed == null),
            if (feedAsync.hasError && feed == null)
              SliverToBoxAdapter(child: ErrorView(error: feedAsync.error!, compact: true, onRetry: _refresh))
            else ...[
              const SliverToBoxAdapter(child: _SetupChecklist()),
              SliverToBoxAdapter(child: _QuickActions(onCustomise: () => _openEditor(context, prefs))),
              if (feed == null)
                const SliverToBoxAdapter(child: SkeletonList(count: 5, height: 80))
              else
                for (final s in sections) ..._section(context, s, prefs, events),
              if (feed != null && (feed.state == 'stale' || feed.limited))
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                    child: Text(
                      feed.state == 'stale'
                          ? tr('Scores may be a few minutes behind while we refresh them.', 'Les scores peuvent avoir quelques minutes de retard.')
                          : tr('Some games may be missing from today\'s feed.', "Certains matchs peuvent manquer aujourd'hui."),
                      style: context.text.bodySmall,
                    ),
                  ),
                ),
              if (account?.planInfo.ads == true && !_adHiddenThisSession) SliverToBoxAdapter(child: _HouseAd(onClose: () => setState(() => _adHiddenThisSession = true))),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
                  child: Text(
                    tr('Match reports are written by AI from official data and checked before publishing.',
                        'Les comptes rendus sont rédigés par IA à partir de données officielles et vérifiés avant publication.'),
                    style: context.text.bodySmall,
                  ),
                ),
              ),
            ],
            SliverToBoxAdapter(child: SizedBox(height: navClearance(context))),
          ],
        ),
      ),
    );
  }

  List<Widget> _section(BuildContext context, String key, Preferences prefs, List<SportEvent> events) {
    final c = context.fs;
    switch (key) {
      case 'favorites':
        final mine = followedGames(prefs, events);
        if (!followsAnything(prefs)) {
          return [
            SliverToBoxAdapter(child: SectionHeader(tr('Your teams', 'Vos équipes'), icon: Icons.star_rounded)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: FsCard(
                  child: Row(children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(color: c.accent.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(14)),
                      child: Icon(Icons.star_rounded, color: c.accent),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(tr('Follow teams to see their games here first.', "Suivez des équipes pour voir leurs matchs ici en premier."),
                          style: context.text.bodyMedium),
                    ),
                    TextButton(onPressed: () => context.push('/my-teams'), child: Text(tr('Browse', 'Parcourir'))),
                  ]),
                ),
              ),
            ),
          ];
        }
        return [
          SliverToBoxAdapter(
            child: SectionHeader(tr('Your teams', 'Vos équipes'), icon: Icons.star_rounded, action: tr('All', 'Tout'), onAction: () => context.push('/my-teams')),
          ),
          if (mine.isEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: FsCard(child: Text(tr('No games for your teams today.', "Aucun match de vos équipes aujourd'hui."), style: context.text.bodyMedium)),
              ),
            )
          else
            _eventList(mine.take(8).toList()),
        ];
      case 'live':
        final followedIds = followedGames(prefs, events).map((e) => e.id).toSet();
        final list = _byImportance(events.where((e) => e.isLive && !followedIds.contains(e.id)).toList());
        if (list.isEmpty) return [];
        return [
          SliverToBoxAdapter(
            child: SectionHeader(tr('Live now', 'En direct'), icon: Icons.sensors_rounded, action: tr('All', 'Tout'), onAction: () => context.go('/scores?status=live')),
          ),
          SliverToBoxAdapter(
            child: SizedBox(
              height: 140,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: list.take(6).length,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (_, i) => EventCard(event: list[i]).entrance(i),
              ),
            ),
          ),
        ];
      case 'upcoming':
        final list = _byImportance(events.where((e) => e.isScheduled).toList()).take(6).toList();
        if (list.isEmpty) return [];
        return [
          SliverToBoxAdapter(
            child: SectionHeader(tr('Coming up', 'À venir'), icon: Icons.schedule_rounded, action: tr('All', 'Tout'), onAction: () => context.go('/scores?status=scheduled')),
          ),
          _eventList(list, showCompetition: true),
        ];
      case 'results':
        final list = _byImportance(events.where((e) => e.isFinished).toList()).take(6).toList();
        if (list.isEmpty) return [];
        return [
          SliverToBoxAdapter(
            child: SectionHeader(tr('Results', 'Résultats'), icon: Icons.emoji_events_rounded, action: tr('All', 'Tout'), onAction: () => context.go('/scores?status=finished')),
          ),
          _eventList(list, showCompetition: true),
        ];
      case 'highlights':
        final watch = ref.watch(_homeWatchProvider);
        final items = watch.hasValue ? VideoItem.fromWatch(watch.value!, limit: 4) : <VideoItem>[];
        if (watch.hasValue && items.isEmpty) return [];
        if (watch.hasError) return [];
        return [
          SliverToBoxAdapter(
            child: SectionHeader(tr('Highlights', 'Résumés'), icon: Icons.play_circle_rounded, action: tr('Watch', 'Regarder'), onAction: () => context.go('/watch')),
          ),
          SliverToBoxAdapter(
            child: watch.hasValue
                ? VideoCarousel(items: items)
                : const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: Skeleton(height: 150, radius: 16)),
          ),
        ];
      case 'trending':
        final groups = groupByCompetition(events);
        groups.sort((a, b) {
          final la = a.$5.where((e) => e.isLive).length, lb = b.$5.where((e) => e.isLive).length;
          if (la != lb) return lb.compareTo(la);
          final ma = isMajorCompetition(a.$2), mb = isMajorCompetition(b.$2);
          if (ma != mb) return ma ? -1 : 1;
          final r = competitionRank(a.$2).compareTo(competitionRank(b.$2));
          if (r != 0) return r;
          return b.$5.length.compareTo(a.$5.length);
        });
        final top = groups.take(6).toList();
        if (top.isEmpty) return [];
        return [
          SliverToBoxAdapter(child: SectionHeader(tr('Trending competitions', 'Compétitions tendance'), icon: Icons.local_fire_department_rounded)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 2.3,
                children: [
                  for (var i = 0; i < top.length; i++)
                    Builder(builder: (context) {
                      final g = top[i];
                      final live = g.$5.where((e) => e.isLive).length;
                      return FsCard(
                        padding: const EdgeInsets.all(12),
                        onTap: () => context.go('/scores?q=${Uri.encodeQueryComponent(g.$2)}'),
                        child: Row(children: [
                          Icon(Sport.iconOf(g.$3), size: 20, color: c.accent),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                              Text(g.$2, maxLines: 2, overflow: TextOverflow.ellipsis, style: context.text.labelLarge?.copyWith(fontSize: 13)),
                              const SizedBox(height: 2),
                              Text(
                                live > 0 ? tr('$live live', '$live en direct') : tr('${g.$5.length} games', '${g.$5.length} matchs'),
                                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: live > 0 ? c.live : c.ink3),
                              ),
                            ]),
                          ),
                        ]),
                      ).entrance(i);
                    }),
                ],
              ),
            ),
          ),
        ];
      case 'news':
        final reports = ref.watch(_homeReportsProvider);
        if (reports.hasError) return [];
        final list = reports.value ?? [];
        if (reports.hasValue && list.isEmpty) return [];
        final followed = prefs.favorites.toSet();
        final leagues = prefs.leagues.map((l) => str(l['name'])).toSet();
        bool relevant(Json r) => asStringList(r['participants']).any(followed.contains) || leagues.contains(str(r['competition']));
        final shown = [...list.where(relevant), ...list.where((r) => !relevant(r))].take(4).toList();
        return [
          SliverToBoxAdapter(
            child: SectionHeader(
              shown.any(relevant) ? tr('Relevant news', 'Actus qui vous concernent') : tr('Latest reports', 'Derniers comptes rendus'),
              icon: Icons.article_rounded,
              action: tr('All', 'Tout'),
              onAction: () => context.go('/news'),
            ),
          ),
          if (!reports.hasValue)
            const SliverToBoxAdapter(child: SkeletonList(count: 3, height: 64))
          else
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverList.separated(
                itemCount: shown.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final r = shown[i];
                  final when = Fmt.parse(asString(r['publishedAt']));
                  return FsCard(
                    padding: const EdgeInsets.all(14),
                    onTap: () => context.push('/news/${Uri.encodeComponent(str(r['slug']))}'),
                    child: Row(children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: [c.heroStart, c.heroEnd]),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(Sport.iconOf(str(r['sportId'])), color: Colors.white, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(str(r['title']), maxLines: 2, overflow: TextOverflow.ellipsis, style: context.text.titleSmall),
                          const SizedBox(height: 3),
                          Text([str(r['competition']), if (when != null) Fmt.ago(when)].where((s) => s.isNotEmpty).join(' · '),
                              maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.bodySmall),
                        ]),
                      ),
                    ]),
                  ).entrance(i);
                },
              ),
            ),
        ];
    }
    return [];
  }

  /// Interleaved by sport, major competitions first (importance order on the web).
  List<SportEvent> _byImportance(List<SportEvent> list) {
    list.sort((a, b) {
      final r = competitionRank(a.competitionName).compareTo(competitionRank(b.competitionName));
      if (r != 0) return r;
      return (a.startUTC ?? '').compareTo(b.startUTC ?? '');
    });
    return interleaveBySport(list);
  }

  Widget _eventList(List<SportEvent> list, {bool showCompetition = true}) => SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        sliver: SliverList.separated(
          itemCount: list.length,
          separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (context, i) => GestureDetector(
            onLongPress: () => showEventActions(context, ref, list[i]),
            child: EventTile(event: list[i], showCompetition: showCompetition).entrance(i),
          ),
        ),
      );

  void _openEditor(BuildContext context, Preferences prefs) {
    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      builder: (_) => _HomeFeedEditor(initial: prefs.homeFeed),
    );
  }
}

String sectionLabel(String key) => switch (key) {
      'favorites' => tr('Your teams', 'Vos équipes'),
      'live' => tr('Live now', 'En direct'),
      'upcoming' => tr('Coming up', 'À venir'),
      'results' => tr('Results', 'Résultats'),
      'highlights' => tr('Highlights', 'Résumés'),
      'trending' => tr('Trending competitions', 'Compétitions tendance'),
      'news' => tr('News', 'Actus'),
      _ => key,
    };

class _HomeHeader extends ConsumerWidget {
  const _HomeHeader({required this.liveCount, required this.fixtures, required this.loading});
  final int liveCount, fixtures;
  final bool loading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final user = ref.watch(authUserProvider).value ?? FirebaseAuth.instance.currentUser;
    final prefs = ref.watch(prefsValueProvider);
    final account = ref.watch(accountProvider).value;
    final unread = ref.watch(unreadCountProvider);
    final hour = DateTime.now().hour;
    final greeting = hour < 12 ? tr('Good morning', 'Bonjour') : (hour < 18 ? tr('Good afternoon', 'Bon après-midi') : tr('Good evening', 'Bonsoir'));
    final display = user?.displayName?.trim();
    final first = display != null && display.isNotEmpty ? display.split(RegExp(r'\s+')).first : (user?.email?.split('@').first ?? '');
    final top = MediaQuery.paddingOf(context).top;

    Widget stat(IconData icon, String value, String label, VoidCallback? onTap, {bool live = false}) => Expanded(
          child: Pressable(
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(icon, size: 15, color: live ? const Color(0xFFFF6B7F) : Colors.white70),
                  if (live) ...[const SizedBox(width: 4), const LiveDot(size: 5)],
                ]),
                const SizedBox(height: 6),
                loading && (label.isEmpty)
                    ? const SizedBox(height: 22)
                    : Text(value, style: const TextStyle(fontFamily: 'Sora', fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
                Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10.5, color: Colors.white70, fontWeight: FontWeight.w600)),
              ]),
            ),
          ),
        );

    return SliverToBoxAdapter(
      child: Container(
        padding: EdgeInsets.fromLTRB(20, top + 12, 20, 22),
        decoration: BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c.heroStart, c.heroEnd]),
          borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30)),
        ),
        child: Stack(children: [
          Positioned(
            right: -40,
            top: -30,
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [FsColors.orange.withValues(alpha: 0.35), Colors.transparent])),
            ),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Image.asset('assets/brand/fs-mark-reversed.png', height: 24),
              const Spacer(),
              _HeaderIcon(icon: Icons.search_rounded, onTap: () => context.push('/search')),
              const SizedBox(width: 8),
              _HeaderIcon(icon: Icons.notifications_none_rounded, badge: unread, onTap: () => context.push('/notifications')),
              const SizedBox(width: 10),
              Pressable(onTap: () => context.push('/settings/profile'), child: const UserAvatar(size: 38)),
            ]),
            const SizedBox(height: 22),
            Text(Fmt.weekdayLong(DateTime.now()), style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(first.isEmpty ? greeting : '$greeting, $first',
                style: const TextStyle(fontFamily: 'Sora', fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.6)),
            if (account != null) ...[
              const SizedBox(height: 6),
              Row(children: [
                Pill(
                  '${account.planInfo.label}${account.hasDayPass ? tr(' · day pass', ' · pass jour') : ''}',
                  icon: Icons.workspace_premium_rounded,
                  color: Colors.white,
                  background: Colors.white.withValues(alpha: 0.14),
                ),
              ]),
            ],
            const SizedBox(height: 18),
            Row(children: [
              stat(Icons.sensors_rounded, '$liveCount', tr('Live now', 'En direct'), () => context.go('/scores?status=live'), live: liveCount > 0),
              const SizedBox(width: 8),
              stat(Icons.calendar_today_rounded, '$fixtures', tr('Fixtures', 'Matchs'), () => context.go('/scores')),
              const SizedBox(width: 8),
              stat(Icons.star_rounded, '${prefs.favoriteTotal}', tr('Teams', 'Équipes'), () => context.push('/my-teams')),
              const SizedBox(width: 8),
              stat(Icons.auto_awesome_rounded, '${account?.allowance?.remaining ?? 0}', tr('Ask left', 'Questions'), () => context.push('/assistant')),
            ]).animate().fadeIn(duration: 400.ms).slideY(begin: 0.1, end: 0, curve: AppTheme.ease),
          ]),
        ]),
      ),
    );
  }
}

class _HeaderIcon extends StatelessWidget {
  const _HeaderIcon({required this.icon, required this.onTap, this.badge = 0});
  final IconData icon;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onTap,
      child: Stack(clipBehavior: Clip.none, children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.12), shape: BoxShape.circle),
          child: Icon(icon, color: Colors.white, size: 20),
        ),
        if (badge > 0)
          Positioned(
            right: -2,
            top: -2,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              constraints: const BoxConstraints(minWidth: 18),
              decoration: BoxDecoration(color: FsColors.orange, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.white, width: 1.5)),
              child: Text(badge > 9 ? '9+' : '$badge', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
            ).animate().scale(curve: Curves.easeOutBack),
          ),
      ]),
    );
  }
}

class _SetupChecklist extends ConsumerStatefulWidget {
  const _SetupChecklist();

  @override
  ConsumerState<_SetupChecklist> createState() => _SetupChecklistState();
}

class _SetupChecklistState extends ConsumerState<_SetupChecklist> {
  bool _hidden = LocalStore.setupHidden;

  bool _alertsChanged(Preferences p) {
    final a = p.alerts;
    final types = asStringList(a['types']);
    return asBool(a['muted']) ||
        asBool(a['email']) ||
        a['quietStart'] != null ||
        a['quietEnd'] != null ||
        types.length != 2 ||
        !types.contains('start') ||
        !types.contains('final');
  }

  @override
  Widget build(BuildContext context) {
    if (_hidden) return const SizedBox.shrink();
    final prefs = ref.watch(prefsValueProvider);
    if (!ref.watch(prefsProvider).hasValue) return const SizedBox.shrink();
    final c = context.fs;
    final steps = [
      (prefs.favorites.isNotEmpty, Icons.star_rounded, tr('Follow a team', 'Suivez une équipe'), () => context.push('/my-teams')),
      (_alertsChanged(prefs), Icons.notifications_active_rounded, tr('Choose your alerts', 'Choisissez vos alertes'), () => context.push('/settings?section=alerts')),
      (
        prefs.spoilerMode || LocalStore.spoilerDecided,
        Icons.visibility_off_rounded,
        tr('Decide on spoiler mode', 'Décidez du mode anti-spoiler'),
        () {
          LocalStore.setSpoilerDecided();
          context.push('/settings?section=general');
        }
      ),
    ];
    final done = steps.where((s) => s.$1).length;
    if (done == steps.length) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
      child: FsCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(tr('Get set up', 'Bien démarrer'), style: context.text.titleMedium?.copyWith(fontWeight: FontWeight.w800))),
            Text('$done/${steps.length}', style: TextStyle(fontWeight: FontWeight.w800, color: c.accent)),
            IconButton(
              visualDensity: VisualDensity.compact,
              tooltip: tr('Hide', 'Masquer'),
              onPressed: () {
                LocalStore.setSetupHidden();
                setState(() => _hidden = true);
              },
              icon: Icon(Icons.close_rounded, size: 18, color: c.ink3),
            ),
          ]),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(value: done / steps.length, minHeight: 5),
          ),
          const SizedBox(height: 10),
          for (final s in steps)
            InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: s.$1 ? null : s.$4,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(children: [
                  Icon(s.$1 ? Icons.check_circle_rounded : s.$2, size: 22, color: s.$1 ? c.success : c.ink2),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(s.$3,
                        style: TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w600,
                          color: s.$1 ? c.ink3 : c.ink,
                          decoration: s.$1 ? TextDecoration.lineThrough : null,
                        )),
                  ),
                  if (!s.$1) Icon(Icons.chevron_right_rounded, color: c.ink3),
                ]),
              ),
            ),
        ]),
      ).animate().fadeIn(duration: 350.ms),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.onCustomise});
  final VoidCallback onCustomise;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final items = [
      (Icons.sensors_rounded, tr('Live', 'Direct'), () => context.go('/scores?status=live')),
      (Icons.star_rounded, tr('My teams', 'Mes équipes'), () => context.push('/my-teams')),
      (Icons.grid_view_rounded, tr('Board', 'Tableau'), () => context.push('/board')),
      (Icons.auto_awesome_rounded, tr('Ask', 'Demander'), () => context.push('/assistant')),
      (Icons.play_circle_rounded, tr('Watch', 'Regarder'), () => context.go('/watch')),
      (Icons.tune_rounded, tr('Customise', 'Personnaliser'), onCustomise),
    ];
    return SizedBox(
      height: 96,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
        scrollDirection: Axis.horizontal,
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 14),
        itemBuilder: (context, i) {
          final (icon, label, onTap) = items[i];
          return Pressable(
            onTap: onTap,
            child: SizedBox(
              width: 62,
              child: Column(children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: i == 0 ? c.live.withValues(alpha: 0.12) : c.surface,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: c.line),
                  ),
                  child: Icon(icon, color: i == 0 ? c.live : (i == items.length - 1 ? c.ink2 : c.accent), size: 23),
                ),
                const SizedBox(height: 6),
                Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: c.ink2)),
              ]),
            ),
          ).entrance(i, baseMs: 30);
        },
      ),
    );
  }
}

class _HomeFeedEditor extends ConsumerStatefulWidget {
  const _HomeFeedEditor({required this.initial});
  final ({List<String> order, List<String> hidden}) initial;

  @override
  ConsumerState<_HomeFeedEditor> createState() => _HomeFeedEditorState();
}

class _HomeFeedEditorState extends ConsumerState<_HomeFeedEditor> {
  late List<String> _order = [...widget.initial.order];
  late final Set<String> _hidden = {...widget.initial.hidden};
  bool _saving = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(prefsProvider.notifier).save({
        'homeFeed': {'order': _order, 'hidden': _hidden.toList()},
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        toast(context, errorText(e), error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(tr('Customise your home', "Personnalisez l'accueil"), style: context.text.titleLarge),
          const SizedBox(height: 4),
          Text(tr('Drag to reorder. Switch off what you don\'t need.', 'Glissez pour réordonner. Masquez ce dont vous n\'avez pas besoin.'),
              style: context.text.bodySmall),
          const SizedBox(height: 12),
          Flexible(
            child: ReorderableListView(
              shrinkWrap: true,
              buildDefaultDragHandles: false,
              onReorderItem: (from, to) => setState(() {
                final item = _order.removeAt(from);
                _order.insert(to, item);
              }),
              children: [
                for (var i = 0; i < _order.length; i++)
                  Container(
                    key: ValueKey(_order[i]),
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(14)),
                    child: ListTile(
                      leading: ReorderableDragStartListener(index: i, child: Icon(Icons.drag_indicator_rounded, color: c.ink3)),
                      title: Text(sectionLabel(_order[i]),
                          style: TextStyle(fontWeight: FontWeight.w600, color: _hidden.contains(_order[i]) ? c.ink3 : c.ink)),
                      trailing: Switch(
                        value: !_hidden.contains(_order[i]),
                        onChanged: (v) => setState(() => v ? _hidden.remove(_order[i]) : _hidden.add(_order[i])),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(children: [
            TextButton(
              onPressed: () => setState(() {
                _order = [...homeSections];
                _hidden.clear();
              }),
              child: Text(tr('Reset', 'Réinitialiser')),
            ),
            const Spacer(),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(tr('Save', 'Enregistrer')),
            ),
          ]),
        ]),
      ),
    );
  }
}

class _HouseAd extends StatelessWidget {
  const _HouseAd({required this.onClose});
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final items = [
      (tr('Compare any two teams.', 'Comparez deux équipes.'), tr('Form, scoring and head to head on Plus and Premium.', 'Forme, buts et confrontations directes avec Plus et Premium.')),
      (tr('Never miss a goal.', 'Ne manquez aucun but.'),
          tr('Plus sends score, half-time, lineup and highlight alerts.', 'Plus envoie les alertes de score, de mi-temps, de composition et de résumé vidéo.')),
      (tr('Remove these ads.', 'Retirez ces publicités.'), tr('Plus and Premium have no FlacronSport display ads.', "Plus et Premium n'affichent aucune publicité FlacronSport.")),
    ];
    final (title, body) = items[(DateTime.now().millisecondsSinceEpoch ~/ 86400000) % items.length];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
        decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(16), border: Border.all(color: c.line)),
        child: Row(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(6)),
            child: Text(tr('AD', 'PUB'), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: c.ink3)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text.rich(TextSpan(children: [
              TextSpan(text: '$title ', style: TextStyle(fontWeight: FontWeight.w700, color: c.ink)),
              TextSpan(text: body),
            ]), style: TextStyle(fontSize: 13, color: c.ink2)),
          ),
          TextButton(onPressed: () => context.push('/billing'), child: Text(tr('See plans', 'Voir les offres'))),
          IconButton(visualDensity: VisualDensity.compact, onPressed: onClose, icon: Icon(Icons.close_rounded, size: 18, color: c.ink3)),
        ]),
      ),
    );
  }
}
