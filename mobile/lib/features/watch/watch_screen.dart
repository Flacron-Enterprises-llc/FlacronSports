import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/i18n.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';
import '../../widgets/event_tile.dart';
import '../shell/app_shell.dart';
import 'broadcasts.dart';

/// GET /api/watch with the given filters, keyed by its query string.
final watchFeedProvider = FutureProvider.autoDispose.family<Json, String>((ref, query) async {
  final params = Uri.splitQueryString(query);
  return asMap(await api.get('/watch', query: params));
});

const _facetKeys = ['competition', 'team', 'athlete', 'tournament', 'race', 'session', 'series', 'format'];

String _facetName(String key) => switch (key) {
      'competition' => tr('Competition', 'Compétition'),
      'team' => tr('Team', 'Équipe'),
      'athlete' => tr('Athlete', 'Athlète'),
      'tournament' => tr('Tournament', 'Tournoi'),
      'race' => tr('Race', 'Course'),
      'session' => tr('Session', 'Séance'),
      'series' => tr('Series', 'Série'),
      'format' => tr('Format', 'Format'),
      _ => key,
    };

({String live, String highlights, String listings}) _labels(String? sport) {
  if (sport == null) return (live: tr('Live now', 'En direct'), highlights: tr('Highlights', 'Résumés'), listings: tr('Upcoming broadcasts', 'Prochaines diffusions'));
  final matches = {'tennis', 'cricket', 'rugby', 'volleyball'}.contains(sport);
  if (sport == 'combat-sports') return (live: tr('Live fights', 'Combats en direct'), highlights: tr('Fight highlights', 'Résumés des combats'), listings: tr('Fights on TV', 'Combats à la TV'));
  if (sport == 'motorsport') return (live: tr('Live sessions', 'Séances en direct'), highlights: tr('Race highlights', 'Résumés des courses'), listings: tr('Sessions on TV', 'Séances à la TV'));
  return matches
      ? (live: tr('Live matches', 'Matchs en direct'), highlights: tr('Match highlights', 'Résumés des matchs'), listings: tr('Matches on TV', 'Matchs à la TV'))
      : (live: tr('Live games', 'Matchs en direct'), highlights: sport == 'football' ? tr('Match highlights', 'Résumés des matchs') : tr('Game highlights', 'Résumés des matchs'), listings: tr('Games on TV', 'Matchs à la TV'));
}

/// Watch tab (app/[locale]/app/watch): highlights, clips, live games and TV listings.
class WatchScreen extends ConsumerStatefulWidget {
  const WatchScreen({super.key, this.initialSport});
  final String? initialSport;

  @override
  ConsumerState<WatchScreen> createState() => _WatchScreenState();
}

class _WatchScreenState extends ConsumerState<WatchScreen> {
  String? _sport;
  String _q = '';
  bool _watchable = false;
  final Map<String, String> _facets = {};
  final _search = TextEditingController();
  Timer? _debounce;
  bool _allClips = false;

  @override
  void initState() {
    super.initState();
    _sport = Sport.byId(widget.initialSport)?.id;
  }

  @override
  void didUpdateWidget(covariant WatchScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialSport != oldWidget.initialSport && widget.initialSport != null) {
      setState(() => _sport = Sport.byId(widget.initialSport)?.id);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  String get _query {
    final params = <String, String>{
      'sport': ?_sport,
      if (_q.isNotEmpty) 'q': _q,
      if (_watchable) 'watchable': '1',
      ..._facets,
    };
    return Uri(queryParameters: params.isEmpty ? null : params).query;
  }

  bool get _filtered => _q.isNotEmpty || _watchable || _facets.isNotEmpty;

  void _setSport(String? sport) {
    setState(() {
      _sport = sport;
      _facets.clear();
      _allClips = false;
    });
  }

  void _clear() {
    _search.clear();
    setState(() {
      _q = '';
      _watchable = false;
      _facets.clear();
    });
  }

  Future<void> _pickFacet(String key, List<String> options) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (sheet) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(sheet).height * 0.7),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(_facetName(key), style: sheet.text.titleLarge),
            const SizedBox(height: 8),
            Flexible(
              child: ListView(shrinkWrap: true, children: [
                ListTile(
                  title: Text(tr('All', 'Tous'), style: const TextStyle(fontWeight: FontWeight.w700)),
                  trailing: _facets[key] == null ? Icon(Icons.check_rounded, color: sheet.fs.accent) : null,
                  onTap: () => Navigator.pop(sheet, ''),
                ),
                for (final o in options)
                  ListTile(
                    title: Text(key == 'session' && o == 'Race' ? tr('Race', 'Course') : o),
                    trailing: _facets[key] == o ? Icon(Icons.check_rounded, color: sheet.fs.accent) : null,
                    onTap: () => Navigator.pop(sheet, o),
                  ),
              ]),
            ),
          ]),
        ),
      ),
    );
    if (picked == null) return;
    setState(() => picked.isEmpty ? _facets.remove(key) : _facets[key] = picked);
  }

  @override
  Widget build(BuildContext context) {
    final query = _query;
    final v = ref.watch(watchFeedProvider(query));
    final c = context.fs;
    final labels = _labels(_sport);

    return Scaffold(
      body: RefreshIndicator(
        edgeOffset: 120,
        onRefresh: () async {
          ref.invalidate(watchFeedProvider(query));
          try {
            await ref.read(watchFeedProvider(query).future);
          } catch (_) {}
        },
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              expandedHeight: 116,
              backgroundColor: c.bg,
              flexibleSpace: FlexibleSpaceBar(
                titlePadding: const EdgeInsetsDirectional.only(start: 20, bottom: 14),
                title: Text(tr('Watch', 'Regarder'), style: context.text.headlineSmall),
                background: Align(
                  alignment: Alignment.topRight,
                  child: Padding(
                    padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top + 8, right: 16),
                    child: Icon(Icons.play_circle_rounded, size: 72, color: c.accent.withValues(alpha: 0.12)),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                  child: Text(tr('Highlights from official channels and TV listings for the games ahead.', 'Résumés des chaînes officielles et programmes TV des prochains matchs.'),
                      style: context.text.bodyMedium),
                ),
                ChipStrip(
                  items: [
                    ('', tr('All sports', 'Tous les sports'), Icons.apps_rounded),
                    for (final s in Sport.all) (s.id, s.name, s.icon),
                  ],
                  selected: _sport ?? '',
                  onSelect: (id) => _setSport(id.isEmpty ? null : id),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: TextField(
                    controller: _search,
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      hintText: tr('Search names or events', 'Rechercher un nom ou un événement'),
                      prefixIcon: const Icon(Icons.search_rounded),
                      suffixIcon: _search.text.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(Icons.close_rounded),
                              onPressed: () {
                                _search.clear();
                                setState(() => _q = '');
                              },
                            ),
                    ),
                    onChanged: (text) {
                      _debounce?.cancel();
                      _debounce = Timer(const Duration(milliseconds: 500), () => setState(() => _q = text.trim().length > 80 ? text.trim().substring(0, 80) : text.trim()));
                    },
                    onSubmitted: (text) => setState(() => _q = text.trim()),
                  ),
                ),
                _Filters(
                  facets: asMapList(v.value?['facets']),
                  chosen: _facets,
                  watchable: _watchable,
                  filtered: _filtered,
                  onFacet: _pickFacet,
                  onWatchable: (w) => setState(() => _watchable = w),
                  onClear: _clear,
                ),
              ]),
            ),
            ...v.when(
              loading: () => [const SliverToBoxAdapter(child: SkeletonList(count: 3, height: 210))],
              error: (e, _) => [SliverToBoxAdapter(child: ErrorView(error: e, onRetry: () => ref.invalidate(watchFeedProvider(query))))],
              data: (feed) => _sections(context, feed, labels),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 20, 20, navClearance(context)),
                child: Text(
                  tr('FlacronSport subscriptions do not guarantee universal broadcast access or replace broadcaster subscriptions.',
                      'Les abonnements FlacronSport ne garantissent pas un accès universel aux diffusions et ne remplacent pas les abonnements des diffuseurs.'),
                  style: context.text.bodySmall,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _sections(BuildContext context, Json feed, ({String live, String highlights, String listings}) labels) {
    final c = context.fs;
    final live = SportEvent.list(feed['live']);
    final highlights = asMapList(feed['highlights']);
    final clips = asMapList(feed['clips']);
    final streams = asMapList(feed['streams']);
    final broadcasts = asMapList(feed['broadcasts']);
    final playable = highlights.length + clips.length + streams.length;
    final nothing = playable + (_watchable ? 0 : live.length + broadcasts.length) == 0;
    final sportName = _sport == null ? '' : Sport.nameOf(_sport).toLowerCase();
    final viewerCode = ui.PlatformDispatcher.instance.locale.countryCode;
    final out = <Widget>[];

    void add(Widget w) => out.add(SliverToBoxAdapter(child: w));

    if (str(feed['state']) == 'stale') {
      add(_Banner(icon: Icons.schedule_rounded, color: c.warning, text: tr('This list may be out of date.', 'Cette liste peut être dépassée.')));
    }
    if (_watchable) {
      add(_Banner(
        icon: Icons.info_outline_rounded,
        color: c.info,
        text: tr("Showing only video you can play here. The rights holder's player may still limit some countries.", 'Seules les vidéos lisibles ici sont affichées. Le lecteur du détenteur des droits peut limiter certains pays.'),
      ));
    }

    if (nothing) {
      final next = feed['nextGame'] is Map ? asMap(feed['nextGame']) : null;
      add(Column(children: [
        _filtered
            ? StateView.empty(tr('Nothing matches these filters', 'Aucun résultat pour ces filtres'),
                message: tr('Try another team or competition, or clear the filters.', 'Essayez une autre équipe ou compétition, ou effacez les filtres.'),
                icon: Icons.filter_alt_off_rounded,
                action: tr('Clear filters', 'Effacer les filtres'),
                onAction: _clear)
            : StateView.empty(
                _sport != null ? tr('Nothing to watch in $sportName right now', 'Rien à regarder en $sportName pour le moment') : tr('Nothing to show yet', 'Rien à afficher pour le moment'),
                message: tr('A game appears here only when it can genuinely be played.', "Un match n'apparaît ici que s'il peut vraiment être lu."),
                icon: Icons.live_tv_rounded,
                action: tr("Follow today's scores", 'Suivre les scores du jour'),
                onAction: () => context.go(_sport == null ? '/scores' : '/scores?sport=$_sport'),
              ),
        if (next != null) Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: _NextGame(game: next)),
      ]));
      return out;
    }

    // Live streams first, as on the web.
    if (streams.isNotEmpty) {
      add(SectionHeader(labels.live, icon: Icons.sensors_rounded));
      out.add(_videoList([
        for (final s in streams)
          VideoTile(
            title: str(s['title']),
            subtitle: str(s['competition']),
            thumbnailUrl: asString(s['thumbnailUrl']),
            live: true,
            onPlay: () => playClip(context, str(s['id']), str(s['title'])),
            onTitle: s['matchId'] == null ? null : () => context.push('/match/${Uri.encodeComponent(str(s['matchId']))}'),
          ),
      ]));
      add(Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
        child: Text(tr('Listed by our video source for this game. A stream can end or change at any time.', 'Indiqué par notre source vidéo. Un flux peut se terminer ou changer à tout moment.'), style: context.text.bodySmall),
      ));
    }

    if (live.isNotEmpty && !_watchable) {
      if (streams.isEmpty) add(SectionHeader(labels.live, icon: Icons.sensors_rounded));
      add(SizedBox(
        height: 150,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: live.length,
          separatorBuilder: (_, _) => const SizedBox(width: 12),
          itemBuilder: (context, i) => EventCard(event: live[i]).entrance(i),
        ),
      ));
    } else if (!_watchable && streams.isEmpty) {
      add(SectionHeader(labels.live, icon: Icons.sensors_rounded));
      add(Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Text(_sport != null ? tr('No $sportName events are live right now.', 'Aucun événement de $sportName en direct.') : tr('No games are live right now.', 'Aucun match en direct pour le moment.'), style: context.text.bodyMedium),
      ));
    }

    if (clips.isNotEmpty) {
      add(SectionHeader(
        tr('Football clips', 'Vidéos de football'),
        icon: Icons.movie_filter_rounded,
        action: _sport == null ? tr('View all', 'Tout voir') : null,
        onAction: _sport == null ? () => _setSport('football') : null,
      ));
      add(Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
        child: Text(tr("Match highlights and goals from this week's games.", 'Résumés et buts des matchs de la semaine.'), style: context.text.bodySmall),
      ));
      final shown = _allClips ? clips : clips.take(12).toList();
      out.add(_videoList([
        for (final clip in shown)
          Builder(builder: (context) {
            final videos = asMapList(clip['videos']);
            final lead = leadClip(videos);
            final date = Fmt.parse(asString(clip['dateUTC']));
            final matchId = asString(clip['matchId']);
            return VideoTile(
              title: str(clip['title']),
              subtitle: str(clip['competition']),
              meta: date == null ? null : Fmt.full(date),
              thumbnailUrl: asString(clip['thumbnailUrl']),
              live: lead?['kind'] == 'live',
              onPlay: () => playClip(context, str(lead?['id'] ?? clip['id']), str(clip['title'])),
              onTitle: matchId == null ? null : () => context.push('/match/${Uri.encodeComponent(matchId)}?tab=watch'),
            );
          }),
      ]));
      if (clips.length > 12 && !_allClips) {
        add(Center(
          child: TextButton(
            onPressed: () => setState(() => _allClips = true),
            child: Text(tr('Show all ${clips.length} games', 'Afficher les ${clips.length} matchs')),
          ),
        ));
      }
    }

    if (!(highlights.isEmpty && clips.isNotEmpty)) {
      final bySport = _sport == null
          ? Sport.all.map((s) => (s, highlights.where((h) => h['sportId'] == s.id).toList())).where((g) => g.$2.isNotEmpty).toList()
          : <(Sport, List<Json>)>[];
      Widget tile(Json h) => VideoTile(
            title: str(h['title']),
            subtitle: str(h['competition']),
            meta: tr('From ${h['channel']}', 'De ${h['channel']}'),
            thumbnailUrl: asString(h['thumbnailUrl']),
            badge: 'YouTube',
            onPlay: () => playMatchHighlight(context, str(h['matchId']), str(h['title'])),
            onTitle: () => context.push('/match/${Uri.encodeComponent(str(h['matchId']))}'),
          );
      if (highlights.isEmpty) {
        add(SectionHeader(labels.highlights, icon: Icons.slow_motion_video_rounded));
        add(Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text(_sport != null ? tr('No $sportName highlights from official channels yet.', 'Pas encore de résumés de $sportName des chaînes officielles.') : tr('No highlights from official channels for these games yet.', 'Pas encore de résumés des chaînes officielles.'), style: context.text.bodyMedium),
        ));
      } else if (bySport.length > 1) {
        for (final (sport, items) in bySport) {
          add(SectionHeader(sport.name, icon: sport.icon, action: tr('View all', 'Tout voir'), onAction: () => _setSport(sport.id)));
          add(SizedBox(
            height: 268,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (context, i) => SizedBox(width: 290, child: tile(items[i])).entrance(i),
            ),
          ));
        }
      } else {
        add(SectionHeader(labels.highlights, icon: Icons.slow_motion_video_rounded));
        out.add(_videoList(highlights.map(tile).toList()));
      }
    }

    if (!_watchable) {
      add(SectionHeader(labels.listings, icon: Icons.live_tv_rounded));
      add(Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
        child: Text(tr("Listings show where a game airs. A broadcaster's subscription may be needed.", "Les programmes indiquent où un match est diffusé. Un abonnement au diffuseur peut être nécessaire."), style: context.text.bodySmall),
      ));
      if (broadcasts.isEmpty) {
        add(Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text(_sport != null ? tr('No $sportName TV listings for today or tomorrow yet.', "Pas encore de programmes TV de $sportName pour aujourd'hui ou demain.") : tr('No TV listings for today or tomorrow yet.', "Pas encore de programmes TV pour aujourd'hui ou demain."), style: context.text.bodyMedium),
        ));
      } else {
        final viewer = countryName(viewerCode);
        final sorted = [...broadcasts]..sort((a, b) => (b['country'] == viewer ? 1 : 0) - (a['country'] == viewer ? 1 : 0));
        final games = ListingCard.group(sorted);
        out.add(SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverList.separated(
            itemCount: games.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, i) => ListingCard(game: games[i].$1, channels: games[i].$2, viewerCountry: viewerCode).entrance(i),
          ),
        ));
      }
    }
    return out;
  }

  Widget _videoList(List<Widget> tiles) => SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        sliver: SliverList.separated(
          itemCount: tiles.length,
          separatorBuilder: (_, _) => const SizedBox(height: 14),
          itemBuilder: (context, i) => tiles[i].entrance(i),
        ),
      );
}

class _Filters extends StatelessWidget {
  const _Filters({
    required this.facets,
    required this.chosen,
    required this.watchable,
    required this.filtered,
    required this.onFacet,
    required this.onWatchable,
    required this.onClear,
  });
  final List<Json> facets;
  final Map<String, String> chosen;
  final bool watchable, filtered;
  final void Function(String key, List<String> options) onFacet;
  final ValueChanged<bool> onWatchable;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final visible = facets.where((f) => _facetKeys.contains(f['key']) && asStringList(f['options']).isNotEmpty).toList();
    Widget chip({required String label, required bool active, required VoidCallback onTap, IconData? icon}) => Pressable(
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: active ? c.accent.withValues(alpha: 0.14) : c.surface,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: active ? c.accent : c.line),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (icon != null) ...[Icon(icon, size: 15, color: active ? c.accent : c.ink2), const SizedBox(width: 5)],
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 180),
                child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: active ? c.accentText : c.ink2)),
              ),
              if (!active && icon == null) Icon(Icons.expand_more_rounded, size: 16, color: c.ink3),
            ]),
          ),
        );
    return SizedBox(
      height: 54,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
        children: [
          chip(label: tr('Watchable now', 'Lisible maintenant'), active: watchable, icon: Icons.play_circle_outline_rounded, onTap: () => onWatchable(!watchable)),
          for (final f in visible) ...[
            const SizedBox(width: 8),
            chip(
              label: chosen[str(f['key'])] ?? _facetName(str(f['key'])),
              active: chosen.containsKey(str(f['key'])),
              onTap: () => onFacet(str(f['key']), asStringList(f['options'])),
            ),
          ],
          if (filtered) ...[
            const SizedBox(width: 8),
            chip(label: tr('Clear', 'Effacer'), active: false, icon: Icons.close_rounded, onTap: onClear),
          ],
        ],
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.icon, required this.color, required this.text});
  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14), border: Border.all(color: color.withValues(alpha: 0.3))),
        child: Row(children: [Icon(icon, color: color, size: 18), const SizedBox(width: 10), Expanded(child: Text(text, style: TextStyle(color: context.fs.ink, fontSize: 13)))]),
      );
}

class _NextGame extends StatelessWidget {
  const _NextGame({required this.game});
  final Json game;

  @override
  Widget build(BuildContext context) {
    final start = Fmt.parse(asString(game['startUTC']));
    return FsCard(
      onTap: () => context.push('/match/${Uri.encodeComponent(str(game['matchId']))}'),
      gradient: LinearGradient(colors: [context.fs.heroStart, context.fs.heroEnd]),
      border: false,
      child: Row(children: [
        const Icon(Icons.event_rounded, color: FsColors.orange, size: 28),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr('Next listed game', 'Prochain match prévu'), style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
            Text(str(game['title']), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Sora', color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
            Text(
              [str(game['competition']), if (start != null) (asBool(game['dateOnly']) ? Fmt.dayMonth(start) : '${Fmt.relativeDay(start)} · ${Fmt.time(start)}')].join(' · '),
              style: const TextStyle(color: Colors.white70, fontSize: 12),
            ),
          ]),
        ),
        const Icon(Icons.chevron_right_rounded, color: Colors.white),
      ]),
    );
  }
}
