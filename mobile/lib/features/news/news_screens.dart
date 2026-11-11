import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api/api_client.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';
import '../shell/app_shell.dart';
import 'news_models.dart';

export 'article_screen.dart';

String savedErrorText(Object e) {
  if (e is ApiException && e.code == 'saved_limit') {
    return tr('You have saved the maximum of 200 reports. Remove one first.', 'Vous avez atteint 200 comptes rendus enregistrés. Retirez-en un.');
  }
  return errorText(e);
}

/// Bookmark toggle shared by cards and the article page.
class SaveReportButton extends ConsumerWidget {
  const SaveReportButton({super.key, required this.slug, this.light = false, this.size = 22});
  final String slug;
  final bool light;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saved = ref.watch(savedSlugsProvider).contains(slug);
    final c = context.fs;
    return IconButton(
      tooltip: saved ? tr('Remove from saved', 'Retirer des enregistrements') : tr('Save', 'Enregistrer'),
      onPressed: () async {
        try {
          final now = await ref.read(savedSlugsProvider.notifier).toggle(slug);
          if (context.mounted) toast(context, now ? tr('Saved', 'Enregistré') : tr('Removed from saved', 'Retiré des enregistrements'));
        } catch (e) {
          if (context.mounted) toast(context, savedErrorText(e), error: true);
        }
      },
      icon: AnimatedSwitcher(
        duration: const Duration(milliseconds: 220),
        transitionBuilder: (child, a) => ScaleTransition(scale: a, child: child),
        child: Icon(
          saved ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
          key: ValueKey(saved),
          size: size,
          color: saved ? FsColors.orange : (light ? Colors.white : c.ink2),
        ),
      ),
    );
  }
}

class NewsScreen extends ConsumerStatefulWidget {
  const NewsScreen({super.key});

  @override
  ConsumerState<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends ConsumerState<NewsScreen> {
  String _sport = '';
  String _type = '';
  String? _team;
  String? _competition;
  String _q = '';
  int _page = 1;
  final _search = TextEditingController();
  final _scroll = ScrollController();

  @override
  void dispose() {
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _set(VoidCallback change) {
    setState(() {
      change();
      _page = 1;
    });
  }

  void _goPage(int page) {
    setState(() => _page = page);
    _scroll.animateTo(0, duration: const Duration(milliseconds: 400), curve: AppTheme.ease);
  }

  Future<void> _openFilters(List<Report> all) async {
    final comps = reportCompetitions(all);
    final teams = reportTeams(all);
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _FilterSheet(
        competitions: comps,
        teams: teams,
        competition: _competition,
        team: _team,
        onApply: (competition, team) => _set(() {
          _competition = competition;
          _team = team;
        }),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final feed = ref.watch(newsFeedProvider(_sport));
    final prefs = ref.watch(prefsValueProvider);
    ref.watch(savedSlugsProvider);

    return Scaffold(
      body: RefreshIndicator(
        color: c.accent,
        onRefresh: () async {
          ref.invalidate(newsFeedProvider(_sport));
          ref.invalidate(forYouProvider);
          await ref.read(newsFeedProvider(_sport).future).catchError((_) => (state: 'ok', reports: <Report>[]));
        },
        child: CustomScrollView(
          controller: _scroll,
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverAppBar(
              pinned: true,
              floating: false,
              expandedHeight: 104,
              backgroundColor: c.bg,
              surfaceTintColor: Colors.transparent,
              actions: [
                IconButton(
                  tooltip: tr('Saved', 'Enregistrés'),
                  onPressed: () => context.push('/news/saved'),
                  icon: const Icon(Icons.bookmarks_outlined),
                ),
                const SizedBox(width: 4),
              ],
              flexibleSpace: FlexibleSpaceBar(
                titlePadding: const EdgeInsetsDirectional.only(start: 20, bottom: 14),
                title: Text(tr('News', 'Actualités'), style: context.text.headlineSmall),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
                child: TextField(
                  controller: _search,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (v) => _set(() => _q = v),
                  onChanged: (v) {
                    if (v.isEmpty && _q.isNotEmpty) _set(() => _q = '');
                  },
                  decoration: InputDecoration(
                    hintText: tr('Search reports', 'Rechercher des comptes rendus'),
                    prefixIcon: const Icon(Icons.search_rounded),
                    suffixIcon: _q.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.close_rounded),
                            onPressed: () {
                              _search.clear();
                              _set(() => _q = '');
                            },
                          ),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: ChipStrip(
                items: [
                  ('', tr('All sports', 'Tous les sports'), Icons.apps_rounded),
                  for (final s in Sport.all) (s.id, s.name, s.icon),
                ],
                selected: _sport,
                onSelect: (v) => _set(() {
                  _sport = v;
                  _team = null;
                  _competition = null;
                }),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 8)),
            SliverToBoxAdapter(
              child: ChipStrip(
                items: [
                  ('', tr('All news', 'Toutes les actualités'), null),
                  for (final t in reportTypes) (t, reportTypeLabel(t), null),
                ],
                selected: _type,
                onSelect: (v) => _set(() => _type = v),
              ),
            ),
            if (prefs.favorites.isNotEmpty) ...[
              const SliverToBoxAdapter(child: SizedBox(height: 8)),
              SliverToBoxAdapter(
                child: ChipStrip(
                  items: [
                    for (final f in prefs.favorites.take(20)) (f, f, Icons.star_rounded),
                  ],
                  selected: _team ?? '',
                  onSelect: (v) => _set(() => _team = _team == v ? null : v),
                ),
              ),
            ],
            ...feed.when(
              loading: () => [const SliverToBoxAdapter(child: _NewsSkeleton())],
              error: (e, _) => [
                SliverFillRemaining(hasScrollBody: false, child: ErrorView(error: e, onRetry: () => ref.invalidate(newsFeedProvider(_sport)))),
              ],
              data: (data) => _content(context, data.state, data.reports),
            ),
            SliverToBoxAdapter(child: SizedBox(height: navClearance(context))),
          ],
        ),
      ),
    );
  }

  List<Widget> _content(BuildContext context, String state, List<Report> all) {
    final c = context.fs;
    final filtered = filterReports(all, team: _team, competition: _competition, type: _type, q: _q);
    final pages = filtered.isEmpty ? 1 : (filtered.length / newsPageSize).ceil();
    final page = _page.clamp(1, pages);
    final items = filtered.skip((page - 1) * newsPageSize).take(newsPageSize).toList();
    final active = (_competition != null ? 1 : 0) + (_team != null && !ref.read(prefsValueProvider).favorites.contains(_team) ? 1 : 0);

    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 8, 0),
          child: Row(children: [
            Expanded(
              child: Text(
                [
                  tr('${filtered.length} reports', '${filtered.length} comptes rendus'),
                  ?_competition,
                  ?_team,
                ].join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.text.bodySmall,
              ),
            ),
            TextButton.icon(
              onPressed: all.isEmpty ? null : () => _openFilters(all),
              icon: Badge(isLabelVisible: active > 0, label: Text('$active'), child: const Icon(Icons.tune_rounded, size: 18)),
              label: Text(tr('Filter', 'Filtrer')),
            ),
          ]),
        ),
      ),
      if (page == 1 && _q.isEmpty && _type.isEmpty && _team == null && _competition == null) const SliverToBoxAdapter(child: _ForYouStrip()),
      if (state == 'unavailable' && all.isEmpty)
        SliverToBoxAdapter(
          child: StateView(
            icon: Icons.cloud_off_rounded,
            title: tr('Reports are temporarily unavailable', 'Comptes rendus momentanément indisponibles'),
            message: tr('Please try again shortly.', 'Réessayez dans quelques instants.'),
            action: tr('Retry', 'Réessayer'),
            onAction: () => ref.invalidate(newsFeedProvider(_sport)),
          ),
        )
      else if (items.isEmpty)
        SliverToBoxAdapter(
          child: StateView.empty(
            all.isEmpty ? tr('No reports yet', 'Aucun compte rendu pour le moment') : tr('No reports match your search.', 'Aucun compte rendu ne correspond à votre recherche.'),
            icon: Icons.article_outlined,
            action: all.isEmpty ? null : tr('Clear filters', 'Effacer les filtres'),
            onAction: all.isEmpty
                ? null
                : () {
                    _search.clear();
                    _set(() {
                      _q = '';
                      _type = '';
                      _team = null;
                      _competition = null;
                    });
                  },
          ),
        )
      else ...[
        if (page == 1)
          SliverToBoxAdapter(
            child: Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 6), child: LeadStoryCard(report: items.first).entrance(0)),
          ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
          sliver: SliverList.separated(
            itemCount: page == 1 ? items.length - 1 : items.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, i) {
              final r = items[page == 1 ? i + 1 : i];
              return ReportCard(report: r).entrance(i + 1);
            },
          ),
        ),
        if (pages > 1)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
              child: Row(children: [
                OutlinedButton.icon(
                  onPressed: page > 1 ? () => _goPage(page - 1) : null,
                  icon: const Icon(Icons.chevron_left_rounded),
                  label: Text(tr('Newer', 'Plus récents')),
                ),
                Expanded(child: Text(tr('Page $page of $pages', 'Page $page sur $pages'), textAlign: TextAlign.center, style: context.text.labelMedium)),
                OutlinedButton.icon(
                  onPressed: page < pages ? () => _goPage(page + 1) : null,
                  icon: const Icon(Icons.chevron_right_rounded),
                  label: Text(tr('Older', 'Plus anciens')),
                  iconAlignment: IconAlignment.end,
                ),
              ]),
            ),
          ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
            child: Row(children: [
              Icon(Icons.auto_awesome_rounded, size: 14, color: c.ink3),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  tr('Automated summaries, built from verified match data.', 'Résumés automatisés, générés à partir de données de match vérifiées.'),
                  style: context.text.bodySmall,
                ),
              ),
            ]),
          ),
        ),
      ],
    ];
  }
}

class _NewsSkeleton extends StatelessWidget {
  const _NewsSkeleton();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(children: [
        const Skeleton(height: 220, radius: 24),
        const SizedBox(height: 12),
        for (var i = 0; i < 4; i++) const Padding(padding: EdgeInsets.only(bottom: 10), child: Skeleton(height: 92, radius: 18)),
      ]),
    );
  }
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.competitions, required this.teams, required this.competition, required this.team, required this.onApply});
  final List<String> competitions, teams;
  final String? competition, team;
  final void Function(String? competition, String? team) onApply;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late String? _competition = widget.competition;
  late String? _team = widget.team;
  String _teamQuery = '';

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final teams = widget.teams.where((t) => _teamQuery.isEmpty || t.toLowerCase().contains(_teamQuery.toLowerCase())).take(60).toList();
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      builder: (context, scroll) => ListView(
        controller: scroll,
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        children: [
          Text(tr('Filter news', 'Filtrer les actualités'), style: context.text.titleLarge),
          const SizedBox(height: 16),
          Text(tr('Competition', 'Compétition'), style: context.text.labelLarge),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            ChoiceChip(label: Text(tr('All competitions', 'Toutes les compétitions')), selected: _competition == null, onSelected: (_) => setState(() => _competition = null)),
            for (final comp in widget.competitions.take(40))
              ChoiceChip(label: Text(comp), selected: _competition == comp, onSelected: (_) => setState(() => _competition = comp)),
          ]),
          const SizedBox(height: 22),
          Text(tr('Team or athlete', 'Équipe ou athlète'), style: context.text.labelLarge),
          const SizedBox(height: 8),
          TextField(
            onChanged: (v) => setState(() => _teamQuery = v),
            decoration: InputDecoration(hintText: tr('Find a team', 'Trouver une équipe'), prefixIcon: const Icon(Icons.search_rounded)),
          ),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            ChoiceChip(label: Text(tr('Any', 'Toutes')), selected: _team == null, onSelected: (_) => setState(() => _team = null)),
            for (final t in teams) ChoiceChip(label: Text(t), selected: _team == t, onSelected: (_) => setState(() => _team = t)),
          ]),
          if (teams.isEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(tr('No match.', 'Aucun résultat.'), style: TextStyle(color: c.ink3))),
          const SizedBox(height: 24),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () {
                  widget.onApply(null, null);
                  Navigator.pop(context);
                },
                child: Text(tr('Clear', 'Effacer')),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                onPressed: () {
                  widget.onApply(_competition, _team);
                  Navigator.pop(context);
                },
                child: Text(tr('Apply', 'Appliquer')),
              ),
            ),
          ]),
        ],
      ),
    );
  }
}

/// The big story at the top of page one.
class LeadStoryCard extends StatelessWidget {
  const LeadStoryCard({super.key, required this.report});
  final Report report;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final r = report;
    final sport = Sport.byId(r.sportId);
    return Pressable(
      onTap: () => context.push('/news/${Uri.encodeComponent(r.slug)}'),
      child: Container(
        constraints: const BoxConstraints(minHeight: 210),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c.heroStart, c.heroEnd, const Color(0xFF3A1A0A)]),
          boxShadow: [BoxShadow(color: FsColors.navy.withValues(alpha: 0.3), blurRadius: 26, offset: const Offset(0, 12), spreadRadius: -12)],
        ),
        child: Stack(children: [
          Positioned(
            right: -30,
            top: -30,
            child: Icon(sport?.icon ?? Icons.article_rounded, size: 180, color: Colors.white.withValues(alpha: 0.06)),
          ),
          Positioned(
            right: 0,
            top: 0,
            child: SaveReportButton(slug: r.slug, light: true),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Pill(tr('Top story', 'À la une'), background: FsColors.orange, color: Colors.white, icon: Icons.bolt_rounded),
                const SizedBox(width: 6),
                Pill(reportTypeLabel(r.type), background: Colors.white.withValues(alpha: 0.14), color: Colors.white),
              ]),
              const SizedBox(height: 40),
              Text(r.title, maxLines: 4, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Sora', fontSize: 22, height: 1.2, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.4)),
              const SizedBox(height: 10),
              Row(children: [
                Icon(sport?.icon ?? Icons.public_rounded, size: 14, color: Colors.white70),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    [if (r.competition.isNotEmpty) r.competition, if (r.published != null) Fmt.ago(r.published!)].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12.5, color: Colors.white70, fontWeight: FontWeight.w600),
                  ),
                ),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}

class ReportCard extends StatelessWidget {
  const ReportCard({super.key, required this.report});
  final Report report;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final r = report;
    final sport = Sport.byId(r.sportId);
    final typeColor = switch (r.type) {
      'preview' => c.info,
      'result' => c.success,
      'recap' => c.accentText,
      _ => c.warning,
    };
    return FsCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
      onTap: () => context.push('/news/${Uri.encodeComponent(r.slug)}'),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: LinearGradient(colors: [(sport?.color ?? c.brand).withValues(alpha: 0.18), (sport?.color ?? c.brand).withValues(alpha: 0.06)]),
          ),
          child: Icon(sport?.icon ?? Icons.public_rounded, color: sport?.color ?? c.brand, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Pill(reportTypeLabel(r.type), color: typeColor, background: typeColor.withValues(alpha: 0.12)),
              const SizedBox(width: 8),
              if (r.published != null) Flexible(child: Text(Fmt.ago(r.published!), maxLines: 1, style: context.text.bodySmall)),
            ]),
            const SizedBox(height: 6),
            Text(r.title, maxLines: 3, overflow: TextOverflow.ellipsis, style: context.text.titleSmall?.copyWith(fontSize: 15, height: 1.3)),
            if (r.competition.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(r.competition, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.bodySmall),
            ],
          ]),
        ),
        SaveReportButton(slug: r.slug, size: 20),
      ]),
    );
  }
}

/// "For you": reports about followed teams (Plus and Premium).
class _ForYouStrip extends ConsumerWidget {
  const _ForYouStrip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final account = ref.watch(accountProvider).value;
    if (account == null) return const SizedBox.shrink();
    if (!account.plusFeatures) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
        child: FsCard(
          padding: const EdgeInsets.all(14),
          onTap: () => context.push('/billing'),
          child: Row(children: [
            Icon(Icons.auto_awesome_rounded, color: c.accent),
            const SizedBox(width: 10),
            Expanded(child: Text(tr('Plus and Premium collect reports on your teams here.', 'Plus et Premium regroupent ici les comptes rendus de vos équipes.'), style: context.text.bodyMedium)),
            Text(tr('Upgrade', 'Évoluer'), style: TextStyle(color: c.accentText, fontWeight: FontWeight.w700)),
          ]),
        ),
      );
    }
    final data = ref.watch(forYouProvider).value;
    if (data == null) return const SizedBox.shrink();
    final reports = asMapList(data['reports']);
    final favorites = asInt(data['favorites']) ?? 0;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SectionHeader(tr('For you', 'Pour vous'), icon: Icons.auto_awesome_rounded, padding: const EdgeInsets.fromLTRB(20, 14, 12, 8)),
      if (reports.isEmpty)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(children: [
            Expanded(
              child: Text(
                favorites == 0
                    ? tr('Follow a team to see its reports here.', 'Suivez une équipe pour voir ses comptes rendus ici.')
                    : tr('No reports on your teams yet. They appear after their games finish.', 'Aucun compte rendu sur vos équipes pour le moment. Ils apparaissent après leurs matchs.'),
                style: context.text.bodyMedium,
              ),
            ),
            if (favorites == 0) TextButton(onPressed: () => context.push('/my-teams'), child: Text(tr('My teams', 'Mes équipes'))),
          ]),
        )
      else
        SizedBox(
          height: 128,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: reports.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, i) {
              final r = reports[i];
              final published = Fmt.parse(asString(r['publishedAt']));
              return SizedBox(
                width: 240,
                child: FsCard(
                  padding: const EdgeInsets.all(14),
                  onTap: () => context.push('/news/${Uri.encodeComponent(str(r['slug']))}'),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(str(r['title']), maxLines: 3, overflow: TextOverflow.ellipsis, style: context.text.titleSmall),
                    const Spacer(),
                    Text(
                      [str(r['competition']), if (published != null) Fmt.ago(published)].where((s) => s.isNotEmpty).join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.bodySmall,
                    ),
                  ]),
                ),
              ).entrance(i);
            },
          ),
        ),
      const SizedBox(height: 4),
    ]);
  }
}

class SavedNewsScreen extends ConsumerWidget {
  const SavedNewsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saved = ref.watch(savedReportsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(tr('Saved reports', 'Comptes rendus enregistrés'))),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(savedReportsProvider);
          await ref.read(savedReportsProvider.future).catchError((_) => <Json>[]);
        },
        child: AsyncView<List<Json>>(
          value: saved,
          onRetry: () => ref.invalidate(savedReportsProvider),
          builder: (list) {
            if (list.isEmpty) {
              return ListView(children: [
                StateView.empty(
                  tr('Nothing saved yet', 'Rien d’enregistré pour le moment'),
                  message: tr('Tap the bookmark on any report to keep it here.', 'Touchez le signet d’un compte rendu pour le garder ici.'),
                  icon: Icons.bookmark_border_rounded,
                  action: tr('Browse news', 'Parcourir les actualités'),
                  onAction: () => context.go('/news'),
                ),
              ]);
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              itemCount: list.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final r = list[i];
                final slug = str(r['slug']);
                final published = Fmt.parse(asString(r['publishedAt']));
                final savedAt = Fmt.parse(asString(r['savedAtUTC']));
                return Dismissible(
                  key: ValueKey(slug),
                  direction: DismissDirection.endToStart,
                  background: Container(
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: 24),
                    decoration: BoxDecoration(color: context.fs.danger, borderRadius: BorderRadius.circular(18)),
                    child: const Icon(Icons.delete_outline_rounded, color: Colors.white),
                  ),
                  confirmDismiss: (_) async {
                    try {
                      await ref.read(savedSlugsProvider.notifier).toggle(slug);
                      if (context.mounted) toast(context, tr('Removed from saved', 'Retiré des enregistrements'));
                      return true;
                    } catch (e) {
                      if (context.mounted) toast(context, savedErrorText(e), error: true);
                      return false;
                    }
                  },
                  child: FsCard(
                    onTap: () => context.push('/news/${Uri.encodeComponent(slug)}'),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(str(r['title']), maxLines: 3, overflow: TextOverflow.ellipsis, style: context.text.titleSmall?.copyWith(fontSize: 15)),
                          const SizedBox(height: 4),
                          Text(
                            [str(r['competition']), if (published != null) Fmt.dayMonthYear(published)].where((s) => s.isNotEmpty).join(' · '),
                            style: context.text.bodySmall,
                          ),
                          if (savedAt != null)
                            Text(tr('Saved ${Fmt.ago(savedAt)}', 'Enregistré ${Fmt.ago(savedAt)}'), style: context.text.bodySmall),
                        ]),
                      ),
                      Icon(Icons.chevron_right_rounded, color: context.fs.ink3),
                    ]),
                  ),
                ).entrance(i);
              },
            );
          },
        ),
      ),
    );
  }
}

/// Shares a report link.
Future<void> shareReport(Report r) => SharePlus.instance.share(ShareParams(
      text: '${r.title}\n${AppConfig.webUrl('/app/news/${r.slug}', locale: AppLocale.code)}',
      subject: r.title,
    ));

/// Re-exported so other files can show team chips with the standard crest.
Widget participantChip(BuildContext context, String name, String sportId) => ActionChip(
      avatar: Crest(name: name, size: 20),
      label: Text(name),
      onPressed: () => context.push('/team/${Uri.encodeComponent(name)}${sportId.isNotEmpty && sportId != 'all' ? '?sport=$sportId' : ''}'),
    );
