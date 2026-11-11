import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../models/preferences.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';
import '../../widgets/event_tile.dart';
import '../scores/event_actions.dart';
import '../scores/feed.dart';
import '../scores/scores_screen.dart';

final _calendarProvider = FutureProvider.autoDispose<List<SportEvent>>((ref) async {
  final res = asMap(await api.get('/me/calendar'));
  return SportEvent.list(res['events']);
});

/// My Teams (components/account/my-teams.tsx): what the member follows, in
/// priority order, their next seven days and their reminders.
class MyTeamsScreen extends ConsumerWidget {
  const MyTeamsScreen({super.key});

  Future<void> _save(BuildContext context, WidgetRef ref, Json patch) async {
    try {
      await ref.read(prefsProvider.notifier).save(patch);
    } catch (e) {
      if (context.mounted) toast(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final prefsAsync = ref.watch(prefsProvider);
    final prefs = ref.watch(prefsValueProvider);
    final account = ref.watch(accountProvider).value;
    final limit = account?.planInfo.favoritesLimit;
    final total = prefs.favoriteTotal;
    final today = Fmt.isoDate(DateTime.now());
    final feed = ref.watch(dayFeedProvider((date: today, sport: null)));
    final todayGames = feed.hasValue ? followedGames(prefs, feed.value!.events) : <SportEvent>[];
    final calendar = ref.watch(_calendarProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(tr('My teams', 'Mes équipes')),
        actions: [
          IconButton(
            tooltip: tr('Add a team', 'Ajouter une équipe'),
            onPressed: () => _openAdd(context),
            icon: const Icon(Icons.add_circle_outline_rounded),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openAdd(context),
        backgroundColor: FsColors.orange,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: Text(tr('Follow', 'Suivre')),
      ),
      body: prefsAsync.hasError && !prefsAsync.hasValue
          ? ErrorView(error: prefsAsync.error!, onRetry: () => ref.invalidate(prefsProvider))
          : !prefsAsync.hasValue
              ? const SkeletonList()
              : RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(prefsProvider);
                    ref.invalidate(_calendarProvider);
                    ref.invalidate(dayFeedProvider((date: today, sport: null)));
                    await ref.read(prefsProvider.future).catchError((_) => prefs);
                  },
                  child: ListView(
                    padding: const EdgeInsets.only(bottom: 110),
                    children: [
                      if (limit != null)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                          child: FsCard(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                Expanded(
                                  child: Text(tr('$total of $limit favorites used', '$total favoris sur $limit utilisés'),
                                      style: context.text.titleSmall),
                                ),
                                TextButton(onPressed: () => context.push('/billing'), child: Text(tr('Upgrade', 'Évoluer'))),
                              ]),
                              const SizedBox(height: 6),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: LinearProgressIndicator(
                                  value: limit == 0 ? 1 : (total / limit).clamp(0, 1).toDouble(),
                                  minHeight: 7,
                                  color: total >= limit ? c.warning : c.accent,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(tr('Plus and Premium follow without limits.', 'Plus et Premium suivent sans limite.'), style: context.text.bodySmall),
                            ]),
                          ),
                        ),
                      if (total == 0 && prefs.reminders.isEmpty)
                        StateView.empty(
                          tr('You are not following anything yet', 'Vous ne suivez encore rien'),
                          message: tr('Follow teams, athletes, leagues and players to see their games first everywhere.',
                              'Suivez équipes, athlètes, compétitions et joueurs pour voir leurs matchs en premier.'),
                          icon: Icons.star_outline_rounded,
                          action: tr('Find a team', 'Trouver une équipe'),
                          onAction: () => _openAdd(context),
                        ),
                      if (todayGames.isNotEmpty) ...[
                        SectionHeader(tr('Today', "Aujourd'hui"), icon: Icons.today_rounded),
                        for (var i = 0; i < todayGames.length; i++)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                            child: GestureDetector(
                              onLongPress: () => showEventActions(context, ref, todayGames[i]),
                              child: EventTile(event: todayGames[i], showCompetition: true),
                            ).entrance(i),
                          ),
                      ],
                      if (prefs.favorites.isNotEmpty) ...[
                        SectionHeader(tr('Teams and athletes', 'Équipes et athlètes'), icon: Icons.shield_rounded),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                          child: Text(tr('Drag to set priority. The top ones show first.', 'Glissez pour définir la priorité.'), style: context.text.bodySmall),
                        ),
                        _ReorderList(
                          items: prefs.favorites,
                          keyOf: (n) => n,
                          onReorder: (list) => _save(context, ref, {'favorites': list}),
                          builder: (name) => _Row(
                            leading: Crest(name: name, size: 34),
                            title: name,
                            onTap: () => context.push('/team/${Uri.encodeComponent(name)}'),
                            onRemove: () => _save(context, ref, {'favorites': prefs.favorites.where((f) => f != name).toList()}),
                          ),
                        ),
                      ],
                      if (prefs.leagues.isNotEmpty) ...[
                        SectionHeader(tr('Competitions', 'Compétitions'), icon: Icons.emoji_events_rounded),
                        _ReorderList(
                          items: prefs.leagues,
                          keyOf: (l) => str(l['id']),
                          onReorder: (list) => _save(context, ref, {'leagues': list}),
                          builder: (l) {
                            final route = leagueRoute(id: str(l['id']), sportId: str(l['sportId']), name: str(l['name']));
                            return _Row(
                              leading: _IconBox(Sport.iconOf(str(l['sportId']))),
                              title: str(l['name']),
                              subtitle: Sport.nameOf(str(l['sportId'])),
                              onTap: route == null ? null : () => context.push(route),
                              onRemove: () => _save(context, ref, {'leagues': prefs.leagues.where((x) => str(x['id']) != str(l['id'])).toList()}),
                            );
                          },
                        ),
                      ],
                      if (prefs.players.isNotEmpty) ...[
                        SectionHeader(tr('Players', 'Joueurs'), icon: Icons.person_rounded),
                        for (final p in prefs.players)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                            child: _Row(
                              leading: _IconBox(Sport.iconOf(str(p['sportId']))),
                              title: str(p['name']),
                              subtitle: asString(p['team']) ?? Sport.nameOf(str(p['sportId'])),
                              onTap: () => context.push('/player/${str(p['id'])}'),
                              onRemove: () => _save(context, ref, {'players': prefs.players.where((x) => str(x['id']) != str(p['id'])).toList()}),
                            ),
                          ),
                      ],
                      if (total > 0) ...[
                        SectionHeader(tr('Next 7 days', '7 prochains jours'), icon: Icons.calendar_month_rounded),
                        calendar.when(
                          data: (events) => events.isEmpty
                              ? Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 16),
                                  child: FsCard(child: Text(tr('No games in the next seven days.', 'Aucun match dans les sept prochains jours.'), style: context.text.bodyMedium)),
                                )
                              : _CalendarList(events: events),
                          loading: () => const SkeletonList(count: 3, height: 64),
                          error: (e, _) => ErrorView(error: e, compact: true, onRetry: () => ref.invalidate(_calendarProvider)),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                          child: TextButton.icon(
                            onPressed: () => context.push('/settings?section=calendar'),
                            icon: const Icon(Icons.ios_share_rounded, size: 18),
                            label: Text(tr('Add these games to your calendar app', 'Ajouter ces matchs à votre agenda')),
                          ),
                        ),
                      ],
                      if (prefs.reminders.isNotEmpty) ...[
                        SectionHeader(tr('Reminders', 'Rappels'), icon: Icons.notifications_active_rounded),
                        for (final r in prefs.reminders)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                            child: _Row(
                              leading: _IconBox(Icons.alarm_rounded),
                              title: str(r['title']),
                              subtitle: Fmt.parse(asString(r['startUTC'])) == null ? null : Fmt.full(Fmt.parse(asString(r['startUTC']))!),
                              onTap: () => context.push('/match/${Uri.encodeComponent(str(r['eventId']))}'),
                              onRemove: () => _save(context, ref, {'reminders': prefs.reminders.where((x) => str(x['eventId']) != str(r['eventId'])).toList()}),
                            ),
                          ),
                      ],
                    ],
                  ),
                ),
    );
  }

  void _openAdd(BuildContext context) {
    showModalBottomSheet<void>(context: context, useRootNavigator: true, isScrollControlled: true, builder: (_) => const _AddTeamSheet());
  }
}

class _IconBox extends StatelessWidget {
  const _IconBox(this.icon);
  final IconData icon;

  @override
  Widget build(BuildContext context) => Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(color: context.fs.surfaceMuted, borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, size: 18, color: context.fs.ink2),
      );
}

class _Row extends StatelessWidget {
  const _Row({required this.leading, required this.title, this.subtitle, this.onTap, required this.onRemove});
  final Widget leading;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return FsCard(
      padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
      onTap: onTap,
      child: Row(children: [
        leading,
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.titleSmall),
            if (subtitle != null) Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.bodySmall),
          ]),
        ),
        IconButton(
          tooltip: tr('Remove', 'Retirer'),
          onPressed: onRemove,
          icon: Icon(Icons.delete_outline_rounded, color: c.ink3, size: 20),
        ),
      ]),
    );
  }
}

class _ReorderList<T> extends StatelessWidget {
  const _ReorderList({required this.items, required this.keyOf, required this.onReorder, required this.builder});
  final List<T> items;
  final String Function(T) keyOf;
  final void Function(List<T>) onReorder;
  final Widget Function(T) builder;

  @override
  Widget build(BuildContext context) {
    return ReorderableListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      buildDefaultDragHandles: false,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: items.length,
      onReorderItem: (from, to) {
        final list = [...items];
        final item = list.removeAt(from);
        list.insert(to, item);
        onReorder(list);
      },
      proxyDecorator: (child, _, _) => Material(color: Colors.transparent, elevation: 6, borderRadius: BorderRadius.circular(18), child: child),
      itemBuilder: (context, i) => Padding(
        key: ValueKey(keyOf(items[i])),
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(children: [
          ReorderableDragStartListener(
            index: i,
            child: Padding(padding: const EdgeInsets.only(right: 6), child: Icon(Icons.drag_indicator_rounded, color: context.fs.ink3)),
          ),
          Expanded(child: builder(items[i])),
        ]),
      ),
    );
  }
}

class _CalendarList extends StatelessWidget {
  const _CalendarList({required this.events});
  final List<SportEvent> events;

  @override
  Widget build(BuildContext context) {
    final days = <String, List<SportEvent>>{};
    for (final e in events) {
      final d = e.start;
      days.putIfAbsent(d == null ? '' : Fmt.isoDate(d), () => []).add(e);
    }
    final keys = days.keys.toList()..sort();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final k in keys) ...[
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 6),
          child: Text(k.isEmpty ? tr('Date to be confirmed', 'Date à confirmer') : Fmt.relativeDay(DateTime.parse('${k}T12:00:00')),
              style: context.text.labelMedium?.copyWith(color: context.fs.accentText)),
        ),
        for (final e in days[k]!) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 8), child: EventTile(event: e, showCompetition: true)),
      ],
    ]);
  }
}

/// Typeahead over /teams/search with a sport filter.
class _AddTeamSheet extends ConsumerStatefulWidget {
  const _AddTeamSheet();

  @override
  ConsumerState<_AddTeamSheet> createState() => _AddTeamSheetState();
}

class _AddTeamSheetState extends ConsumerState<_AddTeamSheet> {
  final _controller = TextEditingController();
  String? _sport;
  Timer? _debounce;
  List<Json> _results = [];
  bool _loading = false;
  Object? _error;
  int _seq = 0;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _search() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      final q = _controller.text.trim();
      if (q.length < 2) {
        setState(() => _results = []);
        return;
      }
      final seq = ++_seq;
      setState(() {
        _loading = true;
        _error = null;
      });
      try {
        final res = asMap(await api.get('/teams/search', query: {'q': q, 'sport': _sport}));
        if (!mounted || seq != _seq) return;
        setState(() {
          _results = asMapList(res['teams']);
          _loading = false;
        });
      } catch (e) {
        if (!mounted || seq != _seq) return;
        setState(() {
          _error = e;
          _loading = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final Preferences prefs = ref.watch(prefsValueProvider);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.75,
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: Text(tr('Follow a team or athlete', 'Suivre une équipe ou un athlète'), style: context.text.titleLarge),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              controller: _controller,
              autofocus: true,
              onChanged: (_) => _search(),
              decoration: InputDecoration(
                hintText: tr('Type at least 2 letters', 'Saisissez au moins 2 lettres'),
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _loading ? const Padding(padding: EdgeInsets.all(14), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))) : null,
              ),
            ),
          ),
          const SizedBox(height: 10),
          ChipStrip(
            items: [('', tr('All sports', 'Tous les sports'), Icons.apps_rounded), for (final s in Sport.all) (s.id, s.name, s.icon)],
            selected: _sport ?? '',
            onSelect: (v) {
              setState(() => _sport = v.isEmpty ? null : v);
              _search();
            },
          ),
          const SizedBox(height: 6),
          Expanded(
            child: _error != null
                ? ErrorView(error: _error!, compact: true)
                : _results.isEmpty
                    ? Center(
                        child: Text(
                          _controller.text.trim().length < 2 ? tr('Search by name', 'Recherchez par nom') : (_loading ? '' : tr('No match found', 'Aucun résultat')),
                          style: context.text.bodyMedium,
                        ),
                      )
                    : ListView.builder(
                        itemCount: _results.length,
                        itemBuilder: (context, i) {
                          final t = _results[i];
                          final name = str(t['name']);
                          final fav = prefs.isFavorite(name);
                          return ListTile(
                            leading: Crest(name: name, size: 34),
                            title: Text(name, style: context.text.titleSmall),
                            subtitle: Text(Sport.nameOf(str(t['sportId']))),
                            trailing: Icon(fav ? Icons.star_rounded : Icons.star_outline_rounded, color: fav ? c.accent : c.ink3),
                            onTap: () async {
                              try {
                                await ref.read(prefsProvider.notifier).toggleFavorite(name);
                                if (context.mounted) toast(context, fav ? tr('Removed $name', '$name retiré') : tr('Following $name', 'Vous suivez $name'));
                              } catch (e) {
                                if (context.mounted) toast(context, errorText(e), error: true);
                              }
                            },
                          );
                        },
                      ),
          ),
        ]),
      ),
    );
  }
}
