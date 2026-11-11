import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';

final _playerProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) async => asMap(await api.get('/players/${Uri.encodeComponent(id)}')));

/// A player profile (components/sports/player-profile.tsx).
class PlayerScreen extends ConsumerWidget {
  const PlayerScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_playerProvider(id));
    return Scaffold(
      body: async.when(
        loading: () => Scaffold(appBar: AppBar(), body: const SkeletonList()),
        error: (e, _) => Scaffold(
          appBar: AppBar(),
          body: e is ApiException && e.status == 404
              ? StateView.empty(
                  tr('Player not found', 'Joueur introuvable'),
                  message: tr('This player is not in our data. Try searching for them.', 'Ce joueur ne figure pas dans nos données.'),
                  icon: Icons.person_off_rounded,
                  action: tr('Search', 'Rechercher'),
                  onAction: () => context.push('/search'),
                )
              : ErrorView(error: e, onRetry: () => ref.invalidate(_playerProvider(id))),
        ),
        data: (data) => _PlayerBody(data: data, onRefresh: () async {
          ref.invalidate(_playerProvider(id));
          try {
            await ref.read(_playerProvider(id).future);
          } catch (_) {}
        }),
      ),
    );
  }
}

class _PlayerBody extends ConsumerWidget {
  const _PlayerBody({required this.data, required this.onRefresh});
  final Json data;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final p = asMap(data['player']);
    final career = data['career'] is Map ? asMap(data['career']) : null;
    final moves = asMapList(career?['moves']);
    final id = str(p['id']);
    final name = str(p['name']);
    final sportId = str(p['sportId']);
    final team = asString(p['team']);
    final prefs = ref.watch(prefsValueProvider);
    final teamSport = !Sport.individual.contains(sportId);
    final following = teamSport ? prefs.followsPlayer(id) : prefs.isFavorite(name);

    final bornIso = asString(p['born']);
    DateTime? born = bornIso == null ? null : DateTime.tryParse('${bornIso}T12:00:00Z');
    String? bornText;
    if (born != null) {
      final now = DateTime.now();
      var age = now.year - born.year;
      if (now.month < born.month || (now.month == born.month && now.day < born.day)) age--;
      bornText = '${DateFormat.yMMMMd(AppLocale.code).format(born)} (${tr('$age yrs', '$age ans')})';
    }
    final facts = <(IconData, String, String?)>[
      (Icons.sports_rounded, tr('Position', 'Poste'), asString(p['position'])),
      (Icons.flag_rounded, tr('Nationality', 'Nationalité'), asString(p['nationality'])),
      (Icons.cake_rounded, tr('Born', 'Naissance'), bornText),
      (Icons.tag_rounded, tr('Number', 'Numéro'), asString(p['number'])),
      (Icons.height_rounded, tr('Height', 'Taille'), asString(p['height'])),
      (Icons.monitor_weight_rounded, tr('Weight', 'Poids'), asString(p['weight'])),
    ].where((f) => f.$3 != null && f.$3!.isNotEmpty).toList();

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: CustomScrollView(slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: 220,
          backgroundColor: c.heroStart,
          iconTheme: const IconThemeData(color: Colors.white),
          actions: [
            IconButton(
              tooltip: following ? tr('Unfollow', 'Ne plus suivre') : tr('Follow', 'Suivre'),
              onPressed: () async {
                try {
                  final n = ref.read(prefsProvider.notifier);
                  teamSport ? await n.togglePlayer(id, name, team, sportId) : await n.toggleFavorite(name);
                  if (context.mounted) toast(context, following ? tr('Unfollowed', 'Plus suivi') : tr('Following $name', 'Vous suivez $name'));
                } catch (e) {
                  if (context.mounted) toast(context, errorText(e), error: true);
                }
              },
              icon: Icon(following ? Icons.star_rounded : Icons.star_outline_rounded, color: following ? FsColors.orange : Colors.white),
            ),
          ],
          flexibleSpace: FlexibleSpaceBar(
            titlePadding: const EdgeInsetsDirectional.only(start: 56, bottom: 14, end: 56),
            title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, color: Colors.white, fontSize: 18)),
            background: Container(
              decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c.heroStart, c.heroEnd])),
              child: Stack(children: [
                if (asString(p['number']) != null)
                  Positioned(
                    right: 16,
                    bottom: 10,
                    child: Text(str(p['number']),
                        style: TextStyle(fontFamily: 'Sora', fontSize: 120, fontWeight: FontWeight.w800, color: Colors.white.withValues(alpha: 0.08), height: 1)),
                  ),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 56, 20, 50),
                    child: Row(children: [
                      Container(
                        width: 76,
                        height: 76,
                        decoration: const BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: [FsColors.orange, FsColors.navy])),
                        child: Icon(Sport.iconOf(sportId), color: Colors.white, size: 34),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                          Text(Sport.nameOf(sportId), style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w600)),
                          if (team != null)
                            Text(team, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
                        ]),
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
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (team != null)
                FsCard(
                  onTap: () => context.push('/team/${Uri.encodeComponent(team)}?sport=$sportId'),
                  child: Row(children: [
                    Icon(Icons.shield_rounded, color: c.accent),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(tr('Team', 'Équipe'), style: context.text.bodySmall),
                        Text(team, style: context.text.titleSmall),
                      ]),
                    ),
                    Icon(Icons.chevron_right_rounded, color: c.ink3),
                  ]),
                ),
              if (facts.isNotEmpty) ...[
                const SizedBox(height: 12),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 2.2,
                  children: [
                    for (var i = 0; i < facts.length; i++)
                      FsCard(
                        padding: const EdgeInsets.all(12),
                        child: Row(children: [
                          Icon(facts[i].$1, size: 20, color: c.accent),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                              Text(facts[i].$2, style: context.text.bodySmall),
                              Text(facts[i].$3!, maxLines: 2, overflow: TextOverflow.ellipsis, style: context.text.titleSmall?.copyWith(fontSize: 13)),
                            ]),
                          ),
                        ]),
                      ).entrance(i),
                  ],
                ),
              ],
              if (team == null && facts.isEmpty)
                FsCard(child: Text(tr('No further details for this player yet.', 'Pas encore de détails pour ce joueur.'), style: context.text.bodyMedium)),
            ]),
          ),
        ),
        if (moves.isNotEmpty) ...[
          SliverToBoxAdapter(child: SectionHeader(tr('Career', 'Carrière'), icon: Icons.timeline_rounded)),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverList.builder(
              itemCount: moves.length,
              itemBuilder: (context, i) => _MoveRow(move: moves[i], last: i == moves.length - 1).entrance(i),
            ),
          ),
          if (Fmt.parse(asString(career?['checkedAt'])) != null)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                child: Text(tr('Updated ${Fmt.full(Fmt.parse(asString(career!['checkedAt']))!)}', 'Mis à jour ${Fmt.full(Fmt.parse(asString(career['checkedAt']))!)}'),
                    style: context.text.bodySmall),
              ),
            ),
        ],
        const SliverToBoxAdapter(child: SizedBox(height: 40)),
      ]),
    );
  }
}

class _MoveRow extends StatelessWidget {
  const _MoveRow({required this.move, required this.last});
  final Json move;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final type = str(move['type']);
    final typeLabel = switch (type) { 'loan' => tr('Loan', 'Prêt'), 'youth' => tr('Youth', 'Formation'), _ => tr('Permanent', 'Transfert') };
    final color = switch (type) { 'loan' => c.info, 'youth' => c.success, _ => c.accent };
    final joined = asInt(move['joined']);
    final left = asInt(move['left']);
    final years = left == null ? tr('Since $joined', 'Depuis $joined') : '$joined–$left';
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SizedBox(
          width: 24,
          child: Column(children: [
            Container(width: 12, height: 12, margin: const EdgeInsets.only(top: 6), decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
            if (!last) Expanded(child: Container(width: 2, color: c.line)),
          ]),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(str(move['team']), style: context.text.titleSmall),
                  const SizedBox(height: 4),
                  Pill(typeLabel, color: color, background: color.withValues(alpha: 0.12)),
                ]),
              ),
              Text(years, style: context.text.labelMedium),
            ]),
          ),
        ),
      ]),
    );
  }
}
