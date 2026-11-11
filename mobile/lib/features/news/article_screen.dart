import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';
import '../../widgets/event_tile.dart';
import 'news_models.dart';
import 'news_screens.dart';

final _articleProvider = FutureProvider.autoDispose.family<Report?, String>((ref, slug) async {
  ref.watch(authUserProvider);
  try {
    final res = asMap(await api.get('/reports/${Uri.encodeComponent(slug)}', query: {'locale': AppLocale.code}));
    return res['report'] is Map ? Report(asMap(res['report'])) : null;
  } on ApiException catch (e) {
    if (e.status == 404) return null;
    rethrow;
  }
});

final _fullReportProvider = FutureProvider.autoDispose.family<Json, String>((ref, slug) async {
  return asMap(await api.get('/reports/${Uri.encodeComponent(slug)}/full', query: {'locale': AppLocale.code}));
});

class ArticleScreen extends ConsumerWidget {
  const ArticleScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final article = ref.watch(_articleProvider(slug));
    ref.watch(savedSlugsProvider);
    return Scaffold(
      body: article.when(
        loading: () => Scaffold(appBar: AppBar(), body: const SkeletonList(count: 5, height: 90)),
        error: (e, _) => Scaffold(appBar: AppBar(), body: ErrorView(error: e, onRetry: () => ref.invalidate(_articleProvider(slug)))),
        data: (report) {
          if (report == null) {
            return Scaffold(
              appBar: AppBar(),
              body: StateView.empty(
                tr('Report not found', 'Compte rendu introuvable'),
                message: tr('It may have been withdrawn.', 'Il a peut-être été retiré.'),
                icon: Icons.article_outlined,
                action: tr('Back to news', 'Retour aux actualités'),
                onAction: () => context.canPop() ? context.pop() : context.go('/news'),
              ),
            );
          }
          return _Article(report: report);
        },
      ),
    );
  }
}

class _Article extends ConsumerWidget {
  const _Article({required this.report});
  final Report report;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final r = report;
    final sport = Sport.byId(r.sportId);
    final paragraphs = r.body.split(RegExp(r'\n\s*\n|\n')).map((p) => p.trim()).where((p) => p.isNotEmpty).toList();
    final hidesResult = r.type == 'result' || r.type == 'recap' || r.type == 'roundup';

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(_articleProvider(r.slug)),
      child: CustomScrollView(slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: 280,
          backgroundColor: c.heroStart,
          foregroundColor: Colors.white,
          iconTheme: const IconThemeData(color: Colors.white),
          actions: [
            SaveReportButton(slug: r.slug, light: true),
            IconButton(tooltip: tr('Share', 'Partager'), onPressed: () => shareReport(r), icon: const Icon(Icons.ios_share_rounded, color: Colors.white)),
          ],
          flexibleSpace: FlexibleSpaceBar(
            collapseMode: CollapseMode.parallax,
            background: Container(
              decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c.heroStart, c.heroEnd])),
              child: Stack(children: [
                Positioned(right: -40, bottom: -30, child: Icon(sport?.icon ?? Icons.article_rounded, size: 220, color: Colors.white.withValues(alpha: 0.06))),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 56, 20, 20),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.end, children: [
                      Wrap(spacing: 6, runSpacing: 6, children: [
                        Pill(sport?.name ?? tr('All sports', 'Tous les sports'), icon: sport?.icon ?? Icons.public_rounded, background: Colors.white.withValues(alpha: 0.14), color: Colors.white),
                        Pill(reportTypeLabel(r.type), background: FsColors.orange, color: Colors.white),
                        Pill(tr('Automated summary', 'Résumé automatisé'), icon: Icons.auto_awesome_rounded, background: Colors.white.withValues(alpha: 0.10), color: Colors.white70),
                      ]),
                      const SizedBox(height: 14),
                      Text(r.title,
                          maxLines: 4,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontFamily: 'Sora', fontSize: 23, height: 1.2, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.4)),
                      const SizedBox(height: 8),
                      Text(
                        [if (r.competition.isNotEmpty) r.competition, if (r.published != null) Fmt.full(r.published!)].join(' · '),
                        style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ]),
                  ),
                ),
              ]),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (r.participants.isNotEmpty && r.type != 'roundup')
                Wrap(spacing: 8, runSpacing: 8, children: [for (final p in r.participants.take(6)) participantChip(context, p, r.sportId)]),
              const SizedBox(height: 16),
              SpoilerGuard(
                active: hidesResult,
                label: tr('Reveal result', 'Afficher le résultat'),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  for (final p in paragraphs)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Text(p, style: TextStyle(fontSize: 16.5, height: 1.65, color: c.ink, fontFamily: 'Inter')),
                    ),
                ]),
              ),
              if (r.type == 'result' || r.type == 'recap') _FullReportSection(slug: r.slug),
              if (r.correctionNote != null && r.correctionNote!.isNotEmpty) ...[
                const SizedBox(height: 16),
                FsCard(
                  color: c.warning.withValues(alpha: 0.08),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Icon(Icons.edit_note_rounded, color: c.warning),
                      const SizedBox(width: 8),
                      Text(tr('Correction', 'Correction'), style: context.text.titleSmall),
                    ]),
                    const SizedBox(height: 6),
                    SpoilerGuard(child: Text(r.correctionNote!, style: context.text.bodyMedium)),
                  ]),
                ),
              ],
              const SizedBox(height: 20),
              Text(
                tr('Built automatically from verified match data. It states only what that data contains.',
                    'Généré automatiquement à partir de données de match vérifiées. Il indique uniquement ce que contiennent ces données.'),
                style: context.text.bodySmall,
              ),
              const SizedBox(height: 14),
              FsCard(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(children: [
                  if (r.published != null) _meta(context, tr('Published', 'Publié'), Fmt.full(r.published!)),
                  if (r.updated != null) _meta(context, tr('Updated', 'Mis à jour'), Fmt.full(r.updated!)),
                  _meta(context, tr('Source', 'Source'), tr('Verified match data', 'Données de match vérifiées')),
                ]),
              ),
              const SizedBox(height: 16),
              Row(children: [
                if (r.type != 'roundup' && r.matchId.isNotEmpty)
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => context.push('/match/${Uri.encodeComponent(r.matchId)}'),
                      icon: const Icon(Icons.scoreboard_rounded, size: 18),
                      label: Text(tr('Match page', 'Page du match')),
                    ),
                  ),
                if (r.type != 'roundup' && r.matchId.isNotEmpty) const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => openExternal(
                        'mailto:${AppConfig.supportEmail}?subject=${Uri.encodeComponent('${tr('Report an error', 'Signaler une erreur')}: ${r.title}')}'),
                    icon: const Icon(Icons.flag_outlined, size: 18),
                    label: Text(tr('Report an error', 'Signaler une erreur')),
                  ),
                ),
              ]),
              const SizedBox(height: 40),
            ]),
          ),
        ),
      ]),
    );
  }

  Widget _meta(BuildContext context, String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(children: [
          Expanded(child: Text(label, style: context.text.bodyMedium)),
          Flexible(child: Text(value, textAlign: TextAlign.end, style: context.text.labelLarge)),
        ]),
      );
}

String _momentKind(String kind) => switch (kind) {
      'goal' => tr('Goal', 'But'),
      'penalty' => tr('Penalty goal', 'But sur penalty'),
      'missed-penalty' => tr('Missed penalty', 'Penalty manqué'),
      'own-goal' => tr('Own goal', 'But contre son camp'),
      'yellow' => tr('Yellow card', 'Carton jaune'),
      'red' => tr('Red card', 'Carton rouge'),
      'substitution' => tr('Substitution', 'Remplacement'),
      'var' => 'VAR',
      'infraction' => tr('Penalty', 'Pénalité'),
      _ => '',
    };

IconData _momentIcon(String kind) => switch (kind) {
      'goal' || 'penalty' || 'own-goal' => Icons.sports_soccer_rounded,
      'missed-penalty' => Icons.block_rounded,
      'yellow' || 'red' => Icons.style_rounded,
      'substitution' => Icons.swap_horiz_rounded,
      'var' => Icons.videocam_rounded,
      _ => Icons.circle,
    };

String statLabel(Json row) {
  final label = asString(row['label']);
  if (label != null && label.isNotEmpty) return label;
  final key = str(row['key']);
  const fr = {
    'ball possession': 'Possession',
    'expected_goals': 'Buts attendus (xG)',
    'total shots': 'Tirs',
    'shots on goal': 'Tirs cadrés',
    'shots off goal': 'Tirs non cadrés',
    'blocked shots': 'Tirs contrés',
    'shots insidebox': 'Tirs dans la surface',
    'shots outsidebox': 'Tirs hors de la surface',
    'corner kicks': 'Corners',
    'offsides': 'Hors-jeu',
    'fouls': 'Fautes',
    'free kicks': 'Coups francs',
    'yellow cards': 'Cartons jaunes',
    'red cards': 'Cartons rouges',
    'goalkeeper saves': 'Arrêts',
    'total passes': 'Passes',
    'passes accurate': 'Passes réussies',
    'passes %': 'Passes réussies (%)',
  };
  const en = {
    'expected_goals': 'Expected goals (xG)',
    'shots insidebox': 'Shots inside the box',
    'shots outsidebox': 'Shots outside the box',
    'passes %': 'Pass accuracy',
  };
  if (AppLocale.isFr && fr[key] != null) return fr[key]!;
  final base = en[key] ?? key.replaceAll('_', ' ');
  return base.isEmpty ? base : base[0].toUpperCase() + base.substring(1);
}

double? _num(String? v) => v == null ? null : double.tryParse(v.replaceAll('%', '').trim());

class _FullReportSection extends ConsumerWidget {
  const _FullReportSection({required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final account = ref.watch(accountProvider).value;
    if (account == null) return const SizedBox.shrink();
    if (!account.plusFeatures) {
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: FsCard(
          gradient: LinearGradient(colors: [c.accent.withValues(alpha: 0.12), c.brand.withValues(alpha: 0.06)]),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.auto_awesome_rounded, color: c.accent),
              const SizedBox(width: 8),
              Expanded(child: Text(tr('Read the full report', 'Lire le compte rendu complet'), style: context.text.titleMedium)),
            ]),
            const SizedBox(height: 6),
            Text(
              tr('Plus adds key moments and reports on your teams. Premium adds statistics and deeper analysis.',
                  'Plus ajoute les moments clés et les comptes rendus de vos équipes. Premium ajoute les statistiques et une analyse approfondie.'),
              style: context.text.bodyMedium,
            ),
            const SizedBox(height: 12),
            FilledButton(onPressed: () => context.push('/billing'), child: Text(tr('Upgrade', 'Évoluer'))),
          ]),
        ),
      );
    }
    final full = ref.watch(_fullReportProvider(slug));
    return full.when(
      loading: () => const Padding(padding: EdgeInsets.only(top: 8), child: Column(children: [Skeleton(height: 18), SizedBox(height: 8), Skeleton(height: 18, width: 200)])),
      error: (e, _) => ErrorView(error: e, compact: true, onRetry: () => ref.invalidate(_fullReportProvider(slug))),
      data: (data) {
        if (str(data['state']) == 'empty') {
          return Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(tr('No extra detail is available for this game.', "Aucun détail supplémentaire n'est disponible pour ce match."), style: context.text.bodyMedium),
          );
        }
        final moments = asMapList(data['moments']);
        final summary = asStringList(data['summary']);
        final insights = asStringList(data['insights']);
        final stats = asMapList(data['stats']);
        final premium = str(data['tier']) == 'premium';
        return SpoilerGuard(
          label: tr('Reveal result', 'Afficher le résultat'),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Divider(height: 28),
            Row(children: [
              Text(tr('Full report', 'Compte rendu complet'), style: context.text.titleLarge),
              const SizedBox(width: 8),
              Pill(premium ? 'Premium' : 'Plus', color: Colors.white, background: premium ? FsColors.orange : FsColors.navy),
            ]),
            if (moments.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text(tr('Key moments', 'Moments clés'), style: context.text.titleSmall),
              const SizedBox(height: 8),
              for (var i = 0; i < moments.length; i++) _MomentRow(moment: moments[i], last: i == moments.length - 1),
            ],
            if (summary.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(summary.join(' '), style: TextStyle(fontSize: 16, height: 1.6, color: c.ink)),
            ],
            if (insights.isNotEmpty) ...[
              const SizedBox(height: 18),
              Text(tr('Analysis', 'Analyse'), style: context.text.titleSmall),
              const SizedBox(height: 8),
              for (final line in insights)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(padding: const EdgeInsets.only(top: 7), child: Icon(Icons.circle, size: 6, color: c.accent)),
                    const SizedBox(width: 10),
                    Expanded(child: Text(line, style: TextStyle(fontSize: 15, height: 1.5, color: c.ink))),
                  ]),
                ),
            ],
            if (stats.isNotEmpty) ...[
              const SizedBox(height: 18),
              Text(tr('Statistics', 'Statistiques'), style: context.text.titleSmall),
              const SizedBox(height: 10),
              for (final s in stats) _StatBar(row: s),
            ],
          ]),
        );
      },
    );
  }
}

class _MomentRow extends StatelessWidget {
  const _MomentRow({required this.moment, required this.last});
  final Json moment;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final kind = str(moment['kind']);
    final minute = asInt(moment['minute']);
    final color = switch (kind) { 'red' => c.danger, 'yellow' => c.warning, 'goal' || 'penalty' || 'own-goal' => c.success, _ => c.ink3 };
    final words = [
      if (_momentKind(kind).isNotEmpty) _momentKind(kind),
      if (asString(moment['player']) != null) str(moment['player']),
    ].join(': ');
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SizedBox(
          width: 44,
          child: Text(minute == null ? '' : "$minute′", style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, color: c.ink2)),
        ),
        Column(children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.14), shape: BoxShape.circle),
            child: Icon(_momentIcon(kind), size: 14, color: color),
          ),
          if (!last) Expanded(child: Container(width: 2, color: c.line)),
        ]),
        const SizedBox(width: 10),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 14, top: 3),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(words.isEmpty ? '—' : words, style: context.text.titleSmall),
              if (asString(moment['team']) != null) Text(str(moment['team']), style: context.text.bodySmall),
              if (kind == 'substitution' && asString(moment['secondary']) != null)
                Text(tr('Off: ${moment['secondary']}', 'Sort : ${moment['secondary']}'), style: context.text.bodySmall),
            ]),
          ),
        ),
      ]),
    );
  }
}

class _StatBar extends StatelessWidget {
  const _StatBar({required this.row});
  final Json row;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final home = asString(row['home']);
    final away = asString(row['away']);
    final h = _num(home) ?? 0, a = _num(away) ?? 0;
    final total = h + a;
    final share = total <= 0 ? 0.5 : h / total;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(children: [
        Row(children: [
          Text(home ?? '–', style: const TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700)),
          Expanded(child: Text(statLabel(row), textAlign: TextAlign.center, style: context.text.bodySmall)),
          Text(away ?? '–', style: const TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: SizedBox(
            height: 6,
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.5, end: share),
              duration: const Duration(milliseconds: 700),
              curve: AppTheme.ease,
              builder: (context, v, _) => Row(children: [
                Expanded(flex: (v * 1000).round().clamp(1, 999), child: Container(color: h >= a ? c.accent : c.lineStrong)),
                const SizedBox(width: 3),
                Expanded(flex: ((1 - v) * 1000).round().clamp(1, 999), child: Container(color: a > h ? c.brand : c.lineStrong)),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}
