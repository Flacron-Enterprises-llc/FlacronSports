import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';
import '../../widgets/event_tile.dart';
import '../shell/app_shell.dart';
import 'event_actions.dart';
import 'feed.dart';

typedef _DayKey = ({String date, String? sport});

final dayFeedProvider = FutureProvider.autoDispose.family<DayFeed, _DayKey>((ref, key) {
  final parts = key.date.split('-').map(int.parse).toList();
  return fetchLocalDay(DateTime(parts[0], parts[1], parts[2]), sport: key.sport);
});

const _pageSize = 60;
const _otherStatuses = {'postponed', 'canceled', 'interrupted', 'abandoned', 'unknown'};

/// Scores (app/[locale]/app/scores/page.tsx): a local day of games for every
/// sport, filtered by status, sport, kind, competition and search.
class ScoresScreen extends ConsumerStatefulWidget {
  const ScoresScreen({super.key, this.initialSport, this.initialStatus, this.initialQuery});
  final String? initialSport;
  final String? initialStatus;
  final String? initialQuery;

  @override
  ConsumerState<ScoresScreen> createState() => _ScoresScreenState();
}

class _ScoresScreenState extends ConsumerState<ScoresScreen> {
  late DateTime _day;
  String? _sport;
  bool _africa = false;
  String _status = 'all';
  String? _kind;
  String? _competition;
  final _search = TextEditingController();
  String _q = '';
  int _pages = 1;
  final _collapsed = <String>{};
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _day = DateTime(now.year, now.month, now.day);
    _applyParams();
    _timer = Timer.periodic(const Duration(seconds: 60), (_) => _autoRefresh());
  }

  void _applyParams() {
    final sport = widget.initialSport;
    _sport = Sport.byId(sport) != null ? sport : null;
    final s = widget.initialStatus;
    _status = switch (s) { 'live' => 'live', 'scheduled' || 'upcoming' => 'upcoming', 'finished' => 'finished', 'other' => 'other', _ => 'all' };
    if (widget.initialQuery != null) {
      _search.text = widget.initialQuery!;
      _q = widget.initialQuery!;
    }
  }

  @override
  void didUpdateWidget(covariant ScoresScreen old) {
    super.didUpdateWidget(old);
    if (old.initialSport != widget.initialSport || old.initialStatus != widget.initialStatus || old.initialQuery != widget.initialQuery) {
      setState(() {
        _applyParams();
        _kind = null;
        _competition = null;
        _pages = 1;
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _search.dispose();
    super.dispose();
  }

  _DayKey get _key => (date: Fmt.isoDate(_day), sport: _sport);

  bool get _isToday => Fmt.sameDay(_day, DateTime.now());

  void _autoRefresh() {
    if (!mounted || !_isToday) return;
    if (ref.read(prefsValueProvider).lowData) return;
    final feed = ref.read(dayFeedProvider(_key)).value;
    if (feed != null && feed.anyLive) ref.invalidate(dayFeedProvider(_key));
  }

  void _setDay(DateTime d) => setState(() {
        _day = DateTime(d.year, d.month, d.day);
        _competition = null;
        _pages = 1;
      });

  void _setSport(String? s) => setState(() {
        _sport = s;
        _kind = null;
        _competition = null;
        _pages = 1;
      });

  bool _statusMatch(String status, String tab) => switch (tab) {
        'live' => status == 'live',
        'upcoming' => status == 'scheduled',
        'finished' => status == 'finished',
        'other' => _otherStatuses.contains(status),
        _ => true,
      };

  List<SportEvent> _filtered(DayFeed feed, {bool withStatus = true}) {
    final prefs = ref.read(prefsValueProvider);
    final needle = _q.trim().toLowerCase();
    Iterable<SportEvent> list = feed.events;
    if (_africa) list = list.where(isAfricanEvent);
    if (_competition != null) {
      list = list.where((e) => '${e.sportId}:${e.competitionId ?? e.competitionName}' == _competition);
    }
    if (prefs.scoresFavoritesOnly && followsAnything(prefs)) list = list.where((e) => isFollowed(prefs, e));
    if (_kind != null) list = list.where((e) => kindOf(e) == _kind);
    if (needle.isNotEmpty) {
      list = list.where((e) => [e.competitionName, e.eventName ?? '', ...e.participants.map((p) => p.rawName)].any((t) => t.toLowerCase().contains(needle)));
    }
    if (withStatus) list = list.where((e) => _statusMatch(e.status, _status));
    return list.toList();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _day,
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(Duration(days: _sport != null && Sport.leagueCollected.contains(_sport) ? 240 : 30)),
    );
    if (picked != null) _setDay(picked);
  }

  void _openCompetitionSheet(DayFeed feed) {
    final groups = groupByCompetition(_filtered(feed, withStatus: false));
    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        maxChildSize: 0.92,
        builder: (ctx, scroll) => ListView(controller: scroll, padding: const EdgeInsets.only(bottom: 24), children: [
          Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 8), child: Text(tr('Competitions', 'Compétitions'), style: ctx.text.titleLarge)),
          ListTile(
            leading: const Icon(Icons.all_inclusive_rounded),
            title: Text(tr('All competitions', 'Toutes les compétitions')),
            trailing: _competition == null ? Icon(Icons.check_rounded, color: ctx.fs.accent) : null,
            onTap: () {
              Navigator.pop(ctx);
              setState(() => _competition = null);
            },
          ),
          for (final g in groups)
            ListTile(
              leading: Icon(Sport.iconOf(g.$3)),
              title: Text(g.$2, maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text(tr('${g.$5.length} games', '${g.$5.length} matchs')),
              trailing: _competition == g.$1 ? Icon(Icons.check_rounded, color: ctx.fs.accent) : null,
              onTap: () {
                Navigator.pop(ctx);
                setState(() {
                  _competition = g.$1;
                  _pages = 1;
                });
              },
            ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final prefs = ref.watch(prefsValueProvider);
    final async = ref.watch(dayFeedProvider(_key));
    final feed = async.value;

    final all = feed == null ? <SportEvent>[] : _filtered(feed, withStatus: false);
    int count(String tab) => all.where((e) => _statusMatch(e.status, tab)).length;
    final shown = feed == null ? <SportEvent>[] : _filtered(feed);
    final groups = groupByCompetition(shown);
    final kinds = feed == null || _sport == null ? <(String, int)>[] : kindOptions(_sport, feed.events.where((e) => !_africa || isAfricanEvent(e)).toList());

    // Paging over the grouped order.
    final limit = _pages * _pageSize;
    var used = 0;
    final pageGroups = <(String, String, String, String?, List<SportEvent>)>[];
    for (final g in groups) {
      if (used >= limit) break;
      final take = g.$5.take(limit - used).toList();
      used += take.length;
      pageGroups.add((g.$1, g.$2, g.$3, g.$4, take));
    }
    final hasMore = shown.length > used;

    final noUpcoming = feed != null && _sport != null && !feed.events.any((e) => e.isScheduled);
    final nextList = _kind != null && feed != null && feed.nextByKind[_kind] is List
        ? (feed.nextByKind[_kind] as List).whereType<Map>().map((m) => m.cast<String, dynamic>()).toList()
        : (feed?.nextDates ?? const []);

    return Scaffold(
      body: RefreshIndicator(
        edgeOffset: 200,
        onRefresh: () async {
          ref.invalidate(dayFeedProvider(_key));
          try {
            await ref.read(dayFeedProvider(_key).future);
          } catch (_) {}
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverAppBar(
              pinned: true,
              floating: false,
              expandedHeight: 112,
              toolbarHeight: 56,
              backgroundColor: c.bg,
              flexibleSpace: FlexibleSpaceBar(
                titlePadding: const EdgeInsetsDirectional.only(start: 20, bottom: 14),
                title: Text(tr('Scores', 'Scores'), style: context.text.headlineSmall),
              ),
              actions: [
                IconButton(
                  tooltip: tr('Favorites only', 'Favoris uniquement'),
                  onPressed: () async {
                    if (!followsAnything(prefs)) {
                      toast(context, tr('Follow a team first.', "Suivez d'abord une équipe."));
                      return;
                    }
                    try {
                      await ref.read(prefsProvider.notifier).save({'scoresFavoritesOnly': !prefs.scoresFavoritesOnly});
                    } catch (e) {
                      if (context.mounted) toast(context, errorText(e), error: true);
                    }
                  },
                  icon: Icon(prefs.scoresFavoritesOnly ? Icons.star_rounded : Icons.star_outline_rounded, color: prefs.scoresFavoritesOnly ? c.accent : c.ink2),
                ),
                IconButton(tooltip: tr('Pick a date', 'Choisir une date'), onPressed: _pickDate, icon: Icon(Icons.calendar_month_rounded, color: c.ink2)),
                const SizedBox(width: 6),
              ],
            ),
            SliverPersistentHeader(
              pinned: true,
              delegate: _HeaderDelegate(
                height: 160,
                child: Container(
                  color: c.bg,
                  child: Column(children: [
                    _DateStrip(day: _day, onPick: _setDay),
                    const SizedBox(height: 8),
                    ChipStrip(
                      items: [
                        ('all', tr('All', 'Tous'), Icons.apps_rounded),
                        ('africa', tr('Africa', 'Afrique'), Icons.public_rounded),
                        for (final s in Sport.all) (s.id, s.name, s.icon),
                      ],
                      selected: _africa ? 'africa' : (_sport ?? 'all'),
                      onSelect: (v) {
                        if (v == 'africa') {
                          setState(() {
                            _africa = !_africa;
                            _competition = null;
                            _pages = 1;
                          });
                        } else {
                          setState(() => _africa = false);
                          _setSport(v == 'all' ? null : v);
                        }
                      },
                    ),
                    const SizedBox(height: 8),
                    _StatusTabs(
                      selected: _status,
                      counts: {
                        'all': all.length,
                        'live': count('live'),
                        'upcoming': count('upcoming'),
                        'finished': count('finished'),
                        'other': count('other'),
                      },
                      onSelect: (s) => setState(() {
                        _status = s;
                        _pages = 1;
                      }),
                    ),
                    Divider(height: 1, color: c.line),
                  ]),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Row(children: [
                  Expanded(
                    child: SizedBox(
                      height: 46,
                      child: TextField(
                        controller: _search,
                        textInputAction: TextInputAction.search,
                        onChanged: (v) => setState(() {
                          _q = v;
                          _pages = 1;
                        }),
                        decoration: InputDecoration(
                          hintText: tr('Team, player or competition', 'Équipe, joueur ou compétition'),
                          prefixIcon: const Icon(Icons.search_rounded, size: 20),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                          suffixIcon: _q.isEmpty
                              ? null
                              : IconButton(
                                  icon: const Icon(Icons.close_rounded, size: 18),
                                  onPressed: () => setState(() {
                                    _search.clear();
                                    _q = '';
                                  }),
                                ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Pressable(
                    onTap: feed == null ? null : () => _openCompetitionSheet(feed),
                    child: Container(
                      height: 46,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: _competition != null ? c.accent.withValues(alpha: 0.14) : c.surfaceMuted,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: _competition != null ? c.accent : c.line),
                      ),
                      child: Icon(Icons.tune_rounded, color: _competition != null ? c.accent : c.ink2, size: 20),
                    ),
                  ),
                ]),
              ),
            ),
            if (kinds.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: ChipStrip(
                    items: [
                      ('', tr('All', 'Tous'), null),
                      for (final (k, n) in kinds) (k, n > 0 ? '${kindLabel(k)} · $n' : kindLabel(k), null),
                    ],
                    selected: _kind ?? '',
                    onSelect: (v) => setState(() {
                      _kind = v.isEmpty ? null : v;
                      _pages = 1;
                    }),
                  ),
                ),
              ),
            if (_competition != null || (prefs.scoresFavoritesOnly && followsAnything(prefs)))
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                  child: Wrap(spacing: 8, runSpacing: 8, children: [
                    if (prefs.scoresFavoritesOnly && followsAnything(prefs))
                      InputChip(
                        avatar: Icon(Icons.star_rounded, size: 16, color: c.accent),
                        label: Text(tr('Favorites only', 'Favoris uniquement')),
                        onDeleted: () => ref.read(prefsProvider.notifier).save({'scoresFavoritesOnly': false}).catchError((_) => ref.read(prefsValueProvider)),
                      ),
                    if (_competition != null && feed != null)
                      InputChip(
                        label: Text(groupByCompetition(feed.events).where((g) => g.$1 == _competition).map((g) => g.$2).firstOrNull ?? ''),
                        onDeleted: () => setState(() => _competition = null),
                      ),
                  ]),
                ),
              ),
            if (feed != null && (feed.state == 'stale' || feed.limited))
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: _Notice(
                    icon: Icons.schedule_rounded,
                    text: feed.state == 'stale'
                        ? tr('Scores may be a few minutes behind. We are refreshing them.', 'Les scores peuvent avoir quelques minutes de retard.')
                        : tr('Some games may be missing from this feed.', 'Certains matchs peuvent manquer.'),
                  ),
                ),
              ),
            if (async.hasError && feed == null)
              SliverFillRemaining(hasScrollBody: false, child: ErrorView(error: async.error!, onRetry: () => ref.invalidate(dayFeedProvider(_key))))
            else if (feed == null)
              const SliverToBoxAdapter(child: SkeletonList(count: 8, height: 76))
            else if (feed.state == 'unavailable' && feed.events.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: StateView(
                  icon: Icons.cloud_off_rounded,
                  title: tr('Scores are unavailable right now', 'Scores indisponibles pour le moment'),
                  message: tr('Our data provider is not answering. Try again shortly.', 'Notre fournisseur ne répond pas. Réessayez bientôt.'),
                  action: tr('Retry', 'Réessayer'),
                  onAction: () => ref.invalidate(dayFeedProvider(_key)),
                ),
              )
            else if (shown.isEmpty)
              SliverToBoxAdapter(
                child: Column(children: [
                  StateView.empty(
                    _status == 'live' ? tr('Nothing live right now', 'Rien en direct pour le moment') : tr('No games match', 'Aucun match ne correspond'),
                    message: tr('Try another day, sport or filter.', 'Essayez un autre jour, sport ou filtre.'),
                    icon: Icons.sports_score_rounded,
                    compact: true,
                  ),
                  if (noUpcoming && nextList.isNotEmpty) _NextDates(list: nextList, onPick: _setDay),
                ]),
              )
            else ...[
              if (noUpcoming && nextList.isNotEmpty) SliverToBoxAdapter(child: _NextDates(list: nextList, onPick: _setDay)),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                sliver: SliverList.builder(
                  itemCount: pageGroups.length,
                  itemBuilder: (context, i) {
                    final g = pageGroups[i];
                    final collapsed = _collapsed.contains(g.$1);
                    return _CompetitionGroup(
                      name: g.$2,
                      sportId: g.$3,
                      competitionId: g.$4,
                      events: g.$5,
                      collapsed: collapsed,
                      onToggle: () => setState(() => collapsed ? _collapsed.remove(g.$1) : _collapsed.add(g.$1)),
                    ).entrance(i);
                  },
                ),
              ),
              if (hasMore)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: OutlinedButton.icon(
                      onPressed: () => setState(() => _pages++),
                      icon: const Icon(Icons.expand_more_rounded),
                      label: Text(tr('Show more games (${shown.length - used})', 'Plus de matchs (${shown.length - used})')),
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
}

class _HeaderDelegate extends SliverPersistentHeaderDelegate {
  _HeaderDelegate({required this.child, required this.height});
  final Widget child;
  final double height;

  @override
  double get minExtent => height;
  @override
  double get maxExtent => height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) => SizedBox(height: height, child: child);

  @override
  bool shouldRebuild(covariant _HeaderDelegate old) => true;
}

class _DateStrip extends StatelessWidget {
  const _DateStrip({required this.day, required this.onPick});
  final DateTime day;
  final ValueChanged<DateTime> onPick;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final days = List.generate(7, (i) => DateTime(today.year, today.month, today.day + i - 3));
    final outside = !days.any((d) => Fmt.sameDay(d, day));
    return SizedBox(
      height: 62,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: [
          if (outside) _dayChip(context, day, true, c),
          for (final d in days) _dayChip(context, d, Fmt.sameDay(d, day), c),
        ],
      ),
    );
  }

  Widget _dayChip(BuildContext context, DateTime d, bool active, FsColors c) {
    final isToday = Fmt.sameDay(d, DateTime.now());
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Pressable(
        onTap: () => onPick(d),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 240),
          curve: AppTheme.ease,
          width: 54,
          decoration: BoxDecoration(
            gradient: active ? const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [FsColors.orange, Color(0xFFFF7A3D)]) : null,
            color: active ? null : c.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: active ? Colors.transparent : c.line),
          ),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(isToday ? tr('Today', 'Auj.') : Fmt.dayShort(d),
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: active ? Colors.white70 : c.ink3)),
            const SizedBox(height: 2),
            Text('${d.day}', style: TextStyle(fontFamily: 'Sora', fontSize: 18, fontWeight: FontWeight.w800, color: active ? Colors.white : c.ink)),
          ]),
        ),
      ),
    );
  }
}

class _StatusTabs extends StatelessWidget {
  const _StatusTabs({required this.selected, required this.counts, required this.onSelect});
  final String selected;
  final Map<String, int> counts;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final tabs = [
      ('all', tr('All', 'Tous')),
      ('live', tr('Live', 'En direct')),
      ('upcoming', tr('Upcoming', 'À venir')),
      ('finished', tr('Finished', 'Terminés')),
      ('other', tr('Other', 'Autres')),
    ];
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: [
          for (final (key, label) in tabs)
            GestureDetector(
              onTap: () => onSelect(key),
              behavior: HitTestBehavior.opaque,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Row(children: [
                    if (key == 'live' && (counts['live'] ?? 0) > 0) ...[const LiveDot(size: 6), const SizedBox(width: 5)],
                    Text(label,
                        style: TextStyle(fontSize: 14, fontWeight: selected == key ? FontWeight.w800 : FontWeight.w600, color: selected == key ? c.ink : c.ink3)),
                    const SizedBox(width: 5),
                    Text('${counts[key] ?? 0}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: selected == key ? c.accent : c.ink3)),
                  ]),
                  const SizedBox(height: 6),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    height: 3,
                    width: selected == key ? 26 : 0,
                    decoration: BoxDecoration(color: c.accent, borderRadius: BorderRadius.circular(3)),
                  ),
                ]),
              ),
            ),
        ],
      ),
    );
  }
}

class _CompetitionGroup extends ConsumerWidget {
  const _CompetitionGroup({required this.name, required this.sportId, required this.competitionId, required this.events, required this.collapsed, required this.onToggle});
  final String name, sportId;
  final String? competitionId;
  final List<SportEvent> events;
  final bool collapsed;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final prefs = ref.watch(prefsValueProvider);
    final follows = prefs.followsLeague(competitionId);
    final route = events.isEmpty ? null : leagueRouteFor(events.first);
    final live = events.where((e) => e.isLive).length;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(9)),
            child: Icon(Sport.iconOf(sportId), size: 16, color: c.ink2),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: GestureDetector(
              onTap: route == null ? onToggle : () => context.push(route),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                Text(
                  [
                    Sport.nameOf(sportId),
                    if (events.first.competitionCountry != null && events.first.competitionCountry!.isNotEmpty) events.first.competitionCountry!,
                    if (live > 0) tr('$live live', '$live en direct'),
                  ].join(' · '),
                  style: TextStyle(fontSize: 11.5, color: live > 0 ? c.live : c.ink3, fontWeight: FontWeight.w600),
                ),
              ]),
            ),
          ),
          if (competitionId != null)
            IconButton(
              visualDensity: VisualDensity.compact,
              tooltip: follows ? tr('Unfollow', 'Ne plus suivre') : tr('Follow', 'Suivre'),
              onPressed: () async {
                try {
                  await ref.read(prefsProvider.notifier).toggleLeague(competitionId!, name, sportId);
                } catch (e) {
                  if (context.mounted) toast(context, errorText(e), error: true);
                }
              },
              icon: Icon(follows ? Icons.star_rounded : Icons.star_outline_rounded, color: follows ? c.accent : c.ink3, size: 22),
            ),
          IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: onToggle,
            icon: AnimatedRotation(
              turns: collapsed ? -0.25 : 0,
              duration: const Duration(milliseconds: 200),
              child: Icon(Icons.expand_more_rounded, color: c.ink3),
            ),
          ),
        ]),
        AnimatedSize(
          duration: const Duration(milliseconds: 260),
          curve: AppTheme.ease,
          alignment: Alignment.topCenter,
          child: collapsed
              ? const SizedBox(width: double.infinity)
              : Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Column(children: [
                    for (final e in events)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: GestureDetector(onLongPress: () => showEventActions(context, ref, e), child: EventTile(event: e)),
                      ),
                  ]),
                ),
        ),
      ]),
    );
  }
}

class _NextDates extends StatelessWidget {
  const _NextDates({required this.list, required this.onPick});
  final List<Map<String, dynamic>> list;
  final ValueChanged<DateTime> onPick;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      child: FsCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(Icons.event_available_rounded, color: c.accent, size: 20),
            const SizedBox(width: 8),
            Text(tr('Next games', 'Prochains matchs'), style: context.text.titleSmall),
          ]),
          const SizedBox(height: 10),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final n in list)
              Builder(builder: (context) {
                final date = DateTime.tryParse('${n['date']}T12:00:00');
                if (date == null) return const SizedBox.shrink();
                final games = n['games'];
                return ActionChip(
                  label: Text('${Fmt.dayShort(date)} ${Fmt.dayMonth(date)} · $games'),
                  onPressed: () => onPick(date),
                );
              }),
          ]),
        ]),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: c.warning.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(14), border: Border.all(color: c.warning.withValues(alpha: 0.3))),
      child: Row(children: [
        Icon(icon, size: 18, color: c.warning),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: c.ink2))),
      ]),
    );
  }
}
