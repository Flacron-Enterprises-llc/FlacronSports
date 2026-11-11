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
import '../home/highlights.dart';
import '../scores/event_actions.dart';

typedef _TeamKey = ({String name, String? sport});

final _teamProvider = FutureProvider.autoDispose.family<Json, _TeamKey>((ref, k) async => asMap(await api.get('/teams', query: {'name': k.name, 'sport': k.sport})));

final _standingsProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) async => asMap(await api.get('/standings/$id')));

final _teamWatchProvider = FutureProvider.autoDispose.family<Json, _TeamKey>((ref, k) async => asMap(await api.get('/watch', query: {'sport': k.sport, 'team': k.name})));

final _teamReportsProvider = FutureProvider.autoDispose.family<List<Json>, String>((ref, team) async {
  final locale = ref.watch(prefsValueProvider).locale;
  final res = asMap(await api.get('/reports', query: {'locale': locale}));
  final lower = team.toLowerCase();
  return asMapList(res['reports']).where((r) => asStringList(r['participants']).any((p) => p.toLowerCase() == lower)).take(4).toList();
});

/// W / D / L for [team] in a finished game, or null when it cannot be told.
String? resultFor(SportEvent e, String team) {
  if (!e.isFinished) return null;
  final lower = team.toLowerCase();
  final idx = e.participants.indexWhere((p) => p.rawName.toLowerCase() == lower);
  if (idx < 0 || e.participants.length != 2) return null;
  switch (e.scoreKind) {
    case 'team':
      final h = e.homeScore, a = e.awayScore;
      if (h == null || a == null) return null;
      final mine = idx == 0 ? h : a, theirs = idx == 0 ? a : h;
      if (mine == theirs) {
        final so = e.shootout;
        if (so != null) {
          final sm = asInt(so[idx == 0 ? 'home' : 'away']) ?? 0, st = asInt(so[idx == 0 ? 'away' : 'home']) ?? 0;
          if (sm != st) return sm > st ? 'W' : 'L';
        }
        return 'D';
      }
      return mine > theirs ? 'W' : 'L';
    case 'sets':
      final w = e.setsWon;
      final winner = asString(e.score['winner']);
      if (winner != null) return winner.toLowerCase() == lower ? 'W' : 'L';
      if (w == null) return null;
      final mine = idx == 0 ? w.$1 : w.$2, theirs = idx == 0 ? w.$2 : w.$1;
      return mine == theirs ? null : (mine > theirs ? 'W' : 'L');
    case 'innings':
      final outcome = asString(e.score['outcome']);
      if (outcome == 'drawn' || outcome == 'tied') return 'D';
      final winner = asString(e.score['winner']);
      if (winner == null) return null;
      return winner.toLowerCase() == lower ? 'W' : 'L';
    case 'combat':
      final winner = asString(e.score['winner']);
      if (winner == null) return null;
      return winner.toLowerCase() == lower ? 'W' : 'L';
  }
  return null;
}

class FormPill extends StatelessWidget {
  const FormPill(this.result, {super.key, this.onTap, this.size = 34});
  final String result;
  final VoidCallback? onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final color = switch (result) { 'W' => c.success, 'L' => c.danger, _ => c.ink3 };
    final label = switch (result) { 'W' => tr('W', 'V'), 'L' => tr('L', 'D'), _ => tr('D', 'N') };
    return Pressable(
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10), border: Border.all(color: color.withValues(alpha: 0.4))),
        child: Text(label, style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, color: color, fontSize: size * 0.4)),
      ),
    );
  }
}

/// A team page (app/[locale]/app/team/[name]/page.tsx).
class TeamScreen extends ConsumerWidget {
  const TeamScreen({super.key, required this.name, this.sport});
  final String name;
  final String? sport;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = (name: name, sport: Sport.byId(sport) != null ? sport : null);
    final async = ref.watch(_teamProvider(key));
    return Scaffold(
      body: async.when(
        loading: () => Scaffold(appBar: AppBar(title: Text(name)), body: const SkeletonList()),
        error: (e, _) => Scaffold(appBar: AppBar(title: Text(name)), body: ErrorView(error: e, onRetry: () => ref.invalidate(_teamProvider(key)))),
        data: (data) => _TeamBody(data: data, requested: name, teamKey: key),
      ),
    );
  }
}

class _TeamBody extends ConsumerWidget {
  const _TeamBody({required this.data, required this.requested, required this.teamKey});
  final Json data;
  final String requested;
  final _TeamKey teamKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final team = data['team'] is Map ? asMap(data['team']) : null;
    final feed = asMap(data['feed']);
    final upcoming = SportEvent.list(data['upcoming']);
    final recent = SportEvent.list(data['recent']);
    final name = team == null ? requested : str(team['name'], requested);
    final sportId = team == null ? teamKey.sport : asString(team['sportId']);
    final league = team?['league'] is Map ? asMap(team!['league']) : null;
    final prefs = ref.watch(prefsValueProvider);
    final fav = prefs.isFavorite(name);

    final badge = [...upcoming, ...recent].expand((e) => e.participants).where((p) => p.rawName.toLowerCase() == name.toLowerCase()).map((p) => p.badgeUrl).whereType<String>().firstOrNull;

    final form = recent.map((e) => (e, resultFor(e, name))).where((x) => x.$2 != null).take(5).toList();
    final next = upcoming.where((e) => !e.isFinished).firstOrNull;
    final watchKey = (name: name, sport: sportId);

    if (team == null) {
      return CustomScrollView(slivers: [
        SliverAppBar(pinned: true, title: Text(requested)),
        SliverFillRemaining(
          hasScrollBody: false,
          child: str(feed['state']) == 'unavailable'
              ? StateView(
                  icon: Icons.cloud_off_rounded,
                  title: tr('Team data is unavailable right now', 'Données indisponibles pour le moment'),
                  action: tr('Retry', 'Réessayer'),
                  onAction: () => ref.invalidate(_teamProvider(teamKey)),
                )
              : StateView.empty(tr('We could not find this team', 'Équipe introuvable'),
                  message: tr('Check the name or search for it.', 'Vérifiez le nom ou recherchez-la.'),
                  icon: Icons.search_off_rounded,
                  action: tr('Search', 'Rechercher'),
                  onAction: () => context.push('/search?q=${Uri.encodeQueryComponent(requested)}')),
        ),
      ]);
    }

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(_teamProvider(teamKey));
        if (league != null) ref.invalidate(_standingsProvider(str(league['id'])));
        try {
          await ref.read(_teamProvider(teamKey).future);
        } catch (_) {}
      },
      child: CustomScrollView(slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: 230,
          backgroundColor: c.heroStart,
          foregroundColor: Colors.white,
          iconTheme: const IconThemeData(color: Colors.white),
          actions: [
            IconButton(
              tooltip: tr('Compare', 'Comparer'),
              onPressed: () => context.push('/compare'),
              icon: const Icon(Icons.compare_arrows_rounded, color: Colors.white),
            ),
            IconButton(
              tooltip: fav ? tr('Unfollow', 'Ne plus suivre') : tr('Follow', 'Suivre'),
              onPressed: () async {
                try {
                  await ref.read(prefsProvider.notifier).toggleFavorite(name);
                  if (context.mounted) toast(context, fav ? tr('Removed from your teams', 'Retiré de vos équipes') : tr('Added to your teams', 'Ajouté à vos équipes'));
                } catch (e) {
                  if (context.mounted) toast(context, errorText(e), error: true);
                }
              },
              icon: Icon(fav ? Icons.star_rounded : Icons.star_outline_rounded, color: fav ? FsColors.orange : Colors.white),
            ),
          ],
          flexibleSpace: FlexibleSpaceBar(
            collapseMode: CollapseMode.parallax,
            titlePadding: const EdgeInsetsDirectional.only(start: 56, bottom: 14, end: 100),
            title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, color: Colors.white, fontSize: 18)),
            background: Container(
              decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c.heroStart, c.heroEnd])),
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 50, 20, 48),
                  child: Row(children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.1), shape: BoxShape.circle),
                      child: Crest(url: badge, name: name, size: 70),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                        Row(children: [
                          Icon(Sport.iconOf(sportId), color: Colors.white70, size: 16),
                          const SizedBox(width: 6),
                          Text(Sport.nameOf(sportId), style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w600)),
                        ]),
                        if (league != null) ...[
                          const SizedBox(height: 4),
                          Text(str(league['name']), maxLines: 2, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                        ],
                      ]),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
        if (str(feed['state']) == 'stale')
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Text(tr('Data may be a few minutes behind.', 'Les données peuvent avoir quelques minutes de retard.'), style: context.text.bodySmall),
            ),
          ),
        if (form.isNotEmpty) ...[
          SliverToBoxAdapter(child: SectionHeader(tr('Form', 'Forme'), icon: Icons.show_chart_rounded)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: SpoilerGuard(
                label: tr('Reveal form', 'Afficher la forme'),
                child: Row(children: [
                  for (final (e, r) in form)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FormPill(r!, onTap: () => context.push('/match/${Uri.encodeComponent(e.id)}')),
                    ),
                  const SizedBox(width: 4),
                  Text(tr('Last ${form.length}', '${form.length} derniers'), style: context.text.bodySmall),
                ]),
              ),
            ),
          ),
        ],
        if (next != null) ...[
          SliverToBoxAdapter(child: SectionHeader(tr('Next game', 'Prochain match'), icon: Icons.event_rounded)),
          SliverToBoxAdapter(
            child: Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: EventCard(event: next, width: double.infinity)),
          ),
        ],
        if (league != null) SliverToBoxAdapter(child: _MiniTable(leagueId: str(league['id']), leagueName: str(league['name']), team: name)),
        if (upcoming.isNotEmpty) ...[
          SliverToBoxAdapter(child: SectionHeader(tr('Upcoming', 'À venir'), icon: Icons.schedule_rounded)),
          _list(upcoming),
        ],
        if (recent.isNotEmpty) ...[
          SliverToBoxAdapter(child: SectionHeader(tr('Recent', 'Récents'), icon: Icons.history_rounded)),
          _list(recent),
        ],
        if (upcoming.isEmpty && recent.isEmpty)
          SliverToBoxAdapter(child: StateView.empty(tr('No games listed', 'Aucun match listé'), icon: Icons.event_busy_rounded, compact: true)),
        SliverToBoxAdapter(child: _TeamVideos(watchKey: watchKey)),
        SliverToBoxAdapter(child: _TeamReports(team: name)),
        const SliverToBoxAdapter(child: SizedBox(height: 40)),
      ]),
    );
  }

  Widget _list(List<SportEvent> list) => SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        sliver: SliverList.separated(
          itemCount: list.length,
          separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (context, i) => Consumer(
            builder: (context, ref, _) => GestureDetector(
              onLongPress: () => showEventActions(context, ref, list[i]),
              child: EventTile(event: list[i], showCompetition: true).entrance(i),
            ),
          ),
        ),
      );
}

class _MiniTable extends ConsumerWidget {
  const _MiniTable({required this.leagueId, required this.leagueName, required this.team});
  final String leagueId, leagueName, team;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final async = ref.watch(_standingsProvider(leagueId));
    final s = async.value;
    if (s == null || str(s['state']) != 'ok') return const SizedBox.shrink();
    final rows = asMapList(s['rows']);
    final idx = rows.indexWhere((r) => str(r['team']).toLowerCase() == team.toLowerCase());
    if (idx < 0) return const SizedBox.shrink();
    final from = (idx - 2).clamp(0, rows.length);
    final to = (idx + 3).clamp(0, rows.length);
    final around = rows.sublist(from, to);
    final calculated = s['calculated'] is Map;
    final hockey = around.any((r) => r['overtimeLosses'] != null);

    String value(Json r) {
      if (!calculated) return asInt(r['points'])?.toString() ?? '–';
      final parts = [
        asInt(r['won'])?.toString() ?? '–',
        if ((asInt(r['drawn']) ?? 0) > 0) '${asInt(r['drawn'])}',
        asInt(r['lost'])?.toString() ?? '–',
        if (r['overtimeLosses'] != null) '${asInt(r['overtimeLosses'])}',
      ];
      return parts.join('-');
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionHeader(leagueName, icon: Icons.format_list_numbered_rounded, action: tr('Full table', 'Classement'), onAction: () => context.push('/standings/$leagueId')),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: SpoilerGuard(
          label: tr('Reveal table', 'Afficher le classement'),
          child: FsCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Column(children: [
              Row(children: [
                SizedBox(width: 30, child: Text('#', style: context.text.labelSmall)),
                Expanded(child: Text(tr('Team', 'Équipe'), style: context.text.labelSmall)),
                SizedBox(width: 36, child: Text(tr('P', 'J'), textAlign: TextAlign.right, style: context.text.labelSmall)),
                SizedBox(
                  width: 70,
                  child: Text(calculated ? (hockey ? tr('W-L-OTL', 'V-D-DP') : tr('W-D-L', 'V-N-D')) : tr('Pts', 'Pts'), textAlign: TextAlign.right, style: context.text.labelSmall),
                ),
              ]),
              const SizedBox(height: 4),
              for (final r in around)
                Builder(builder: (context) {
                  final own = str(r['team']).toLowerCase() == team.toLowerCase();
                  return Container(
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                    decoration: BoxDecoration(color: own ? c.accent.withValues(alpha: 0.1) : null, borderRadius: BorderRadius.circular(8)),
                    child: Row(children: [
                      SizedBox(width: 26, child: Text(asInt(r['rank'])?.toString() ?? '–', style: TextStyle(color: c.ink3, fontWeight: FontWeight.w700))),
                      Expanded(child: Text(str(r['team']), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: own ? FontWeight.w800 : FontWeight.w600, color: c.ink))),
                      SizedBox(width: 36, child: Text(asInt(r['played'])?.toString() ?? '–', textAlign: TextAlign.right, style: TextStyle(color: c.ink2))),
                      SizedBox(width: 70, child: Text(value(r), textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.w800, color: c.ink))),
                    ]),
                  );
                }),
              if (calculated)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(tr('Calculated from results.', 'Calculé à partir des résultats.'), style: context.text.bodySmall),
                ),
            ]),
          ),
        ),
      ),
    ]);
  }
}

class _TeamVideos extends ConsumerWidget {
  const _TeamVideos({required this.watchKey});
  final _TeamKey watchKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final watch = ref.watch(_teamWatchProvider(watchKey)).value;
    if (watch == null) return const SizedBox.shrink();
    final items = VideoItem.fromWatch(watch, limit: 6);
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionHeader(tr('Videos', 'Vidéos'), icon: Icons.play_circle_rounded),
      VideoCarousel(items: items),
    ]);
  }
}

class _TeamReports extends ConsumerWidget {
  const _TeamReports({required this.team});
  final String team;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(_teamReportsProvider(team)).value ?? [];
    if (list.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionHeader(tr('News', 'Actus'), icon: Icons.article_rounded),
      for (final r in list)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: FsCard(
            padding: const EdgeInsets.all(14),
            onTap: () => context.push('/news/${Uri.encodeComponent(str(r['slug']))}'),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(str(r['title']), maxLines: 2, overflow: TextOverflow.ellipsis, style: context.text.titleSmall),
              const SizedBox(height: 4),
              Text(str(r['competition']), style: context.text.bodySmall),
            ]),
          ),
        ),
    ]);
  }
}
