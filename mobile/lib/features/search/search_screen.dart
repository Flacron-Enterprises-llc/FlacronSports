import 'dart:async';

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
import '../scores/feed.dart';

/// Global search (components/search/search-results.tsx): fixtures, teams,
/// competitions, players, reports and the Africa section.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key, this.query, this.sport});
  final String? query;
  final String? sport;

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  late final _controller = TextEditingController(text: widget.query ?? '');
  late String? _sport = Sport.byId(widget.sport) != null ? widget.sport : null;
  Timer? _debounce;
  Json? _results;
  Object? _error;
  bool _loading = false;
  int _seq = 0;
  static final List<String> _recent = [];

  @override
  void initState() {
    super.initState();
    _run();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _changed(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _run);
  }

  Future<void> _run() async {
    final q = _controller.text.trim();
    final seq = ++_seq;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = asMap(await api.get('/search', query: {'q': q, 'locale': ref.read(prefsValueProvider).locale, 'sport': _sport}));
      if (!mounted || seq != _seq) return;
      setState(() {
        _results = res;
        _loading = false;
      });
      if (q.length >= 2) {
        _recent.remove(q);
        _recent.insert(0, q);
        if (_recent.length > 8) _recent.removeLast();
      }
    } catch (e) {
      if (!mounted || seq != _seq) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final r = _results;
    final q = _controller.text.trim();
    final fixtures = SportEvent.list(r?['fixtures']);
    final teams = asMapList(r?['teams']);
    final competitions = asMapList(r?['competitions']);
    final players = asMapList(r?['players']);
    final reports = asMapList(r?['reports']);
    final africa = asMap(r?['africa']);
    final empty = q.length >= 2 && r != null && fixtures.isEmpty && teams.isEmpty && competitions.isEmpty && players.isEmpty && reports.isEmpty;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Padding(
          padding: const EdgeInsets.only(right: 16),
          child: SizedBox(
            height: 46,
            child: TextField(
              controller: _controller,
              autofocus: widget.query == null,
              textInputAction: TextInputAction.search,
              onChanged: _changed,
              onSubmitted: (_) => _run(),
              decoration: InputDecoration(
                hintText: tr('Search teams, players, competitions', 'Équipes, joueurs, compétitions'),
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                suffixIcon: _loading
                    ? const Padding(padding: EdgeInsets.all(13), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)))
                    : (q.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.close_rounded, size: 18),
                            onPressed: () {
                              _controller.clear();
                              _run();
                            })),
              ),
            ),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 40),
        children: [
          ChipStrip(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            items: [('', tr('All sports', 'Tous les sports'), Icons.apps_rounded), for (final s in Sport.all) (s.id, s.name, s.icon)],
            selected: _sport ?? '',
            onSelect: (v) {
              setState(() => _sport = v.isEmpty ? null : v);
              _run();
            },
          ),
          if (_error != null)
            ErrorView(error: _error!, onRetry: _run, compact: true)
          else if (r == null)
            const SkeletonList(count: 5, height: 60)
          else ...[
            if (asBool(r['partial']))
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Text(tr('Some results could not be loaded. Showing what we have.', 'Certains résultats sont indisponibles.'), style: context.text.bodySmall),
              ),
            if (q.length < 2 && _recent.isNotEmpty) ...[
              SectionHeader(tr('Recent searches', 'Recherches récentes')),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final s in _recent)
                    ActionChip(
                      avatar: const Icon(Icons.history_rounded, size: 16),
                      label: Text(s),
                      onPressed: () {
                        _controller.text = s;
                        _run();
                      },
                    ),
                ]),
              ),
            ],
            if (empty)
              StateView.empty(tr('No results for "$q"', 'Aucun résultat pour « $q »'),
                  message: tr('Check the spelling or try another sport.', "Vérifiez l'orthographe ou essayez un autre sport."), icon: Icons.search_off_rounded),
            if (fixtures.isNotEmpty) ...[
              SectionHeader(tr('Matches', 'Matchs'), icon: Icons.sports_score_rounded),
              for (var i = 0; i < fixtures.length; i++)
                Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 8), child: EventTile(event: fixtures[i], showCompetition: true).entrance(i)),
            ],
            if (teams.isNotEmpty) ...[
              SectionHeader(tr('Teams and athletes', 'Équipes et athlètes'), icon: Icons.shield_rounded),
              for (final t in teams) _TeamRow(name: str(t['name']), sportId: str(t['sportId'])),
            ],
            if (competitions.isNotEmpty) ...[
              SectionHeader(tr('Competitions', 'Compétitions'), icon: Icons.emoji_events_rounded),
              for (final comp in competitions) _competitionRow(context, comp),
            ],
            if (players.isNotEmpty) ...[
              SectionHeader(tr('Players', 'Joueurs'), icon: Icons.person_rounded),
              for (final p in players)
                ListTile(
                  leading: CircleAvatar(backgroundColor: c.surfaceMuted, child: Icon(Sport.iconOf(str(p['sportId'])), color: c.ink2, size: 20)),
                  title: Text(str(p['name']), style: context.text.titleSmall),
                  subtitle: Text([asString(p['team']), asString(p['position'])].whereType<String>().join(' · ')),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push('/player/${str(p['id'])}'),
                ),
            ],
            if (reports.isNotEmpty) ...[
              SectionHeader(tr('News', 'Actus'), icon: Icons.article_rounded),
              for (final rep in reports)
                ListTile(
                  leading: CircleAvatar(backgroundColor: c.surfaceMuted, child: Icon(Icons.article_outlined, color: c.ink2, size: 20)),
                  title: Text(str(rep['title']), maxLines: 2, overflow: TextOverflow.ellipsis, style: context.text.titleSmall),
                  subtitle: Text(str(rep['competition'])),
                  onTap: () => context.push('/news/${Uri.encodeComponent(str(rep['slug']))}'),
                ),
            ],
            _AfricaSection(africa: africa, competitionRow: (comp) => _competitionRow(context, comp)),
          ],
        ],
      ),
    );
  }

  Widget _competitionRow(BuildContext context, Json comp) {
    final c = context.fs;
    final sportId = str(comp['sportId']);
    final route = leagueRoute(id: asString(comp['id']), sportId: sportId, name: str(comp['name']));
    final today = asInt(comp['today']) ?? 0;
    return ListTile(
      leading: CircleAvatar(backgroundColor: c.surfaceMuted, child: Icon(Sport.iconOf(sportId), color: c.ink2, size: 20)),
      title: Text(str(comp['name']), style: context.text.titleSmall),
      subtitle: Text([Sport.nameOf(sportId), if (today > 0) tr('$today today', "$today aujourd'hui")].join(' · ')),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: () => route != null ? context.push(route) : context.go('/scores?sport=$sportId&q=${Uri.encodeQueryComponent(str(comp['name']))}'),
    );
  }
}

class _TeamRow extends ConsumerWidget {
  const _TeamRow({required this.name, required this.sportId});
  final String name, sportId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final fav = ref.watch(prefsValueProvider).isFavorite(name);
    final individual = Sport.individual.contains(sportId);
    return ListTile(
      leading: Crest(name: name, size: 36),
      title: Text(name, style: context.text.titleSmall),
      subtitle: Text(Sport.nameOf(sportId)),
      trailing: IconButton(
        icon: Icon(fav ? Icons.star_rounded : Icons.star_outline_rounded, color: fav ? c.accent : c.ink3),
        onPressed: () async {
          try {
            await ref.read(prefsProvider.notifier).toggleFavorite(name);
          } catch (e) {
            if (context.mounted) toast(context, errorText(e), error: true);
          }
        },
      ),
      onTap: individual
          ? () => context.go('/scores?sport=$sportId&q=${Uri.encodeQueryComponent(name)}')
          : () => context.push('/team/${Uri.encodeComponent(name)}?sport=$sportId'),
    );
  }
}

class _AfricaSection extends StatelessWidget {
  const _AfricaSection({required this.africa, required this.competitionRow});
  final Json africa;
  final Widget Function(Json) competitionRow;

  @override
  Widget build(BuildContext context) {
    final teams = asStringList(africa['teams']);
    final comps = asMapList(africa['competitions']);
    final fixtures = SportEvent.list(africa['fixtures']);
    if (teams.isEmpty && comps.isEmpty && fixtures.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionHeader(tr('Africa', 'Afrique'), icon: Icons.public_rounded),
      if (teams.isNotEmpty)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Wrap(spacing: 8, runSpacing: 8, children: [
            for (final t in teams)
              ActionChip(
                avatar: Crest(name: t, size: 20),
                label: Text(t),
                onPressed: () => context.push('/team/${Uri.encodeComponent(t)}?sport=football'),
              ),
          ]),
        ),
      for (var i = 0; i < fixtures.length; i++)
        Padding(padding: const EdgeInsets.fromLTRB(16, 10, 16, 0), child: EventTile(event: fixtures[i], showCompetition: true)),
      for (final comp in comps) competitionRow(comp),
    ]);
  }
}
