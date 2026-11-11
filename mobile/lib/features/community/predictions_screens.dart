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
import '../match/chat_panel.dart' show ensureGuidelines;
import 'community_common.dart';

const predictionSports = ['football', 'basketball', 'american-football', 'baseball', 'ice-hockey', 'rugby', 'volleyball', 'tennis', 'cricket', 'combat-sports', 'motorsport'];

final _myPicksProvider = FutureProvider.autoDispose<List<Json>>((ref) async {
  ref.watch(authUserProvider);
  return asMapList(asMap(await api.get('/predictions/mine'))['predictions']);
});

final _leaderboardProvider = FutureProvider.autoDispose.family<List<Json>, String>((ref, sport) async {
  return asMapList(asMap(await api.get('/predictions/leaderboard', query: {'sport': sport.isEmpty ? null : sport}))['entries']);
});

final groupsListProvider = FutureProvider.autoDispose<List<Json>>((ref) async {
  ref.watch(authUserProvider);
  return asMapList(asMap(await api.get('/groups'))['groups']);
});

final _badgesProvider = FutureProvider.autoDispose<List<String>>((ref) async {
  return asStringList(asMap(await api.get('/community/badges'))['badges']);
});

final _referralProvider = FutureProvider.autoDispose<Json>((ref) async => asMap(await api.get('/referrals')));

/// pickWords in lib/community/pick-words.ts.
String pickWords(Json pick) {
  final podium = asStringList(pick['podium']);
  if (podium.isNotEmpty) {
    final places = [tr('1st place', '1re place'), tr('2nd place', '2e place'), tr('3rd place', '3e place')];
    return [for (var i = 0; i < podium.length && i < 3; i++) '${places[i]}: ${podium[i]}'].join(', ');
  }
  final winner = asString(pick['winner']);
  if (winner != null) return tr('$winner to win', 'Victoire de $winner');
  final score = '${pick['home']} – ${pick['away']}';
  final game = pick['game'] is Map ? asMap(pick['game']) : null;
  final home = asString(game?['home']), away = asString(game?['away']);
  return home != null && away != null ? '$home $score $away' : score;
}

class PredictionsScreen extends ConsumerStatefulWidget {
  const PredictionsScreen({super.key});

  @override
  ConsumerState<PredictionsScreen> createState() => _PredictionsScreenState();
}

class _PredictionsScreenState extends ConsumerState<PredictionsScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 5, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: NestedScrollView(
        headerSliverBuilder: (context, _) => [
          SliverAppBar(
            pinned: true,
            expandedHeight: 168,
            backgroundColor: context.fs.heroStart,
            foregroundColor: Colors.white,
            iconTheme: const IconThemeData(color: Colors.white),
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [context.fs.heroStart, context.fs.heroEnd])),
                child: Stack(children: [
                  Positioned(right: -24, top: 10, child: Icon(Icons.emoji_events_rounded, size: 170, color: Colors.white.withValues(alpha: 0.07))),
                  SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 56, 20, 56),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.end, children: [
                        Text(tr('Predictions', 'Pronostics'), style: const TextStyle(fontFamily: 'Sora', fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white)),
                        const SizedBox(height: 4),
                        Text(tr('Free to play. No deposits, wagers or prizes.', 'Gratuit. Ni dépôt, ni mise, ni lot.'), style: const TextStyle(color: Colors.white70, fontSize: 13)),
                      ]),
                    ),
                  ),
                ]),
              ),
            ),
            bottom: TabBar(
              controller: _tabs,
              isScrollable: true,
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white60,
              indicatorColor: FsColors.orange,
              dividerColor: Colors.transparent,
              tabs: [
                Tab(text: tr('My picks', 'Mes pronostics')),
                Tab(text: tr('Leaderboard', 'Classement')),
                Tab(text: tr('Groups', 'Groupes')),
                Tab(text: tr('Badges', 'Badges')),
                Tab(text: tr('Invite', 'Inviter')),
              ],
            ),
          ),
        ],
        body: TabBarView(controller: _tabs, children: const [_MyPicksTab(), _LeaderboardTab(), _GroupsTab(), _BadgesTab(), _ReferralTab()]),
      ),
    );
  }
}

class _MyPicksTab extends ConsumerWidget {
  const _MyPicksTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final picks = ref.watch(_myPicksProvider);
    final upcoming = ref.watch(upcomingGamesProvider);
    final picked = (picks.value ?? []).map((p) => str(p['matchId'])).toSet();

    Widget status(Json p) {
      final s = str(p['status']);
      if (s == 'open') return Pill(tr('Open until the start', "Ouvert jusqu'au début"), color: c.success, background: c.success.withValues(alpha: 0.12));
      if (s == 'locked') return Pill(tr('Locked', 'Verrouillé'), icon: Icons.lock_rounded);
      return SpoilerGuard(
        label: tr('Reveal', 'Afficher'),
        child: s == 'void'
            ? Pill(tr('Void', 'Annulé'))
            : Pill('${tr('Settled', 'Réglé')} · ${tr('Points', 'Points')}: ${asInt(p['points']) ?? 0}', color: c.accentText, background: c.accent.withValues(alpha: 0.12)),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(_myPicksProvider);
        ref.invalidate(upcomingGamesProvider);
        await ref.read(_myPicksProvider.future).catchError((_) => <Json>[]);
      },
      child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 40), children: [
        Text(tr('Your picks, with the ones still open first.', 'Vos pronostics, ceux encore ouverts en premier.'), style: context.text.bodySmall),
        const SizedBox(height: 10),
        picks.when(
          loading: () => const SkeletonList(count: 3, padding: EdgeInsets.zero),
          error: (e, _) => ErrorView(error: e, compact: true, onRetry: () => ref.invalidate(_myPicksProvider)),
          data: (list) {
            if (list.isEmpty) {
              return StateView.empty(
                tr('No predictions yet', 'Aucun pronostic pour le moment'),
                message: tr('Choose an upcoming game and make your pick before it starts.', 'Choisissez un match à venir et faites votre pronostic avant le début.'),
                icon: Icons.emoji_events_outlined,
                compact: true,
              );
            }
            return Column(children: [
              for (var i = 0; i < list.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: FsCard(
                    padding: const EdgeInsets.all(14),
                    onTap: () => context.push('/match/${str(list[i]['matchId'])}?tab=predict'),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(
                          child: Text(
                            str(asMap(list[i]['game'])['title'], tr('Game no longer available', "Match plus disponible")),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.text.titleSmall,
                          ),
                        ),
                        const SizedBox(width: 8),
                        status(list[i]),
                      ]),
                      const SizedBox(height: 6),
                      Text(pickWords(list[i]), style: TextStyle(fontWeight: FontWeight.w700, color: c.accentText)),
                      if (Fmt.parse(asString(list[i]['kickoffUTC'])) != null)
                        Padding(padding: const EdgeInsets.only(top: 3), child: Text(Fmt.full(Fmt.parse(asString(list[i]['kickoffUTC']))!), style: context.text.bodySmall)),
                    ]),
                  ).entrance(i),
                ),
            ]);
          },
        ),
        SectionHeader(tr('Games to predict', 'Matchs à pronostiquer'), icon: Icons.event_available_rounded, padding: const EdgeInsets.fromLTRB(4, 18, 0, 4)),
        Text(tr('Teams you follow and major competitions come first.', "Les équipes que vous suivez et les grandes compétitions d'abord."), style: context.text.bodySmall),
        const SizedBox(height: 10),
        upcoming.when(
          loading: () => const SkeletonList(count: 3, height: 60, padding: EdgeInsets.zero),
          error: (e, _) => ErrorView(error: e, compact: true, onRetry: () => ref.invalidate(upcomingGamesProvider)),
          data: (d) {
            final games = d.games.where((g) => asBool(g['predictable']) && !picked.contains(str(g['id']))).take(6).toList();
            if (games.isEmpty) return Text(tr('No upcoming games to predict right now.', 'Aucun match à pronostiquer pour le moment.'), style: context.text.bodyMedium);
            return Column(children: [
              for (final g in games)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: FsCard(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    onTap: () => context.push('/match/${str(g['id'])}?tab=predict'),
                    child: Row(children: [Expanded(child: GameLine(game: g)), Icon(Icons.chevron_right_rounded, color: c.ink3)]),
                  ),
                ),
            ]);
          },
        ),
        const SizedBox(height: 6),
        OutlinedButton(onPressed: () => context.go('/scores?status=scheduled'), child: Text(tr('Browse upcoming games', 'Parcourir les matchs à venir'))),
        const SizedBox(height: 18),
        const _RulesCard(),
      ]),
    );
  }
}

class _RulesCard extends StatelessWidget {
  const _RulesCard();

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final rules = [
      (Icons.gps_fixed_rounded, tr('Exact score', 'Score exact'), 5),
      (Icons.check_circle_outline_rounded, tr('Right outcome (win, draw or loss)', 'Bonne issue (victoire, nul ou défaite)'), 2),
      (Icons.emoji_events_outlined, tr('Right winner', 'Bon vainqueur'), 3),
      (Icons.looks_one_outlined, tr('Podium driver in the exact place', 'Pilote du podium à la bonne place'), 4),
      (Icons.format_list_numbered_rounded, tr('Podium driver in another podium place', 'Pilote sur le podium à une autre place'), 2),
    ];
    return FsCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr('How points work', 'Comment marquer des points'), style: context.text.titleMedium),
        const SizedBox(height: 10),
        for (final (icon, label, pts) in rules)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(children: [
              Icon(icon, size: 18, color: c.accent),
              const SizedBox(width: 10),
              Expanded(child: Text(label, style: context.text.bodyMedium)),
              Pill('+$pts', color: c.accentText, background: c.accent.withValues(alpha: 0.12)),
            ]),
          ),
        const SizedBox(height: 8),
        Text(
          tr('One pick per game, made before it starts. Picks cannot be changed. Points are for fun only: no deposits, wagers or prizes.',
              'Un pronostic par match, avant le début. Il ne peut pas être modifié. Les points sont pour le plaisir : ni dépôt, ni mise, ni lot.'),
          style: context.text.bodySmall,
        ),
      ]),
    );
  }
}

class _LeaderboardTab extends ConsumerStatefulWidget {
  const _LeaderboardTab();

  @override
  ConsumerState<_LeaderboardTab> createState() => _LeaderboardTabState();
}

class _LeaderboardTabState extends ConsumerState<_LeaderboardTab> {
  String _sport = '';

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final board = ref.watch(_leaderboardProvider(_sport));
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(_leaderboardProvider(_sport));
        await ref.read(_leaderboardProvider(_sport).future).catchError((_) => <Json>[]);
      },
      child: ListView(padding: const EdgeInsets.fromLTRB(0, 16, 0, 40), children: [
        ChipStrip(
          items: [
            ('', tr('All sports', 'Tous les sports'), Icons.apps_rounded),
            for (final id in predictionSports) (id, Sport.nameOf(id), Sport.iconOf(id)),
          ],
          selected: _sport,
          onSelect: (v) => setState(() => _sport = v),
        ),
        const SizedBox(height: 14),
        board.when(
          loading: () => const SkeletonList(count: 6, height: 52),
          error: (e, _) => ErrorView(error: e, compact: true, onRetry: () => ref.invalidate(_leaderboardProvider(_sport))),
          data: (entries) {
            if (entries.isEmpty) {
              return StateView.empty(
                _sport.isEmpty ? tr('No points yet', 'Aucun point pour le moment') : tr('No points in this sport yet', 'Aucun point dans ce sport pour le moment'),
                icon: Icons.leaderboard_outlined,
                compact: true,
              );
            }
            final top = entries.take(3).toList();
            final rest = entries.skip(3).toList();
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(children: [
                _Podium(entries: top),
                const SizedBox(height: 14),
                for (var i = 0; i < rest.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: c.line)),
                      child: Row(children: [
                        RankBadge(rank: asInt(rest[i]['rank'])),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(str(rest[i]['displayName']), maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.titleSmall),
                            BadgeChips(badges: asStringList(rest[i]['badges'])),
                          ]),
                        ),
                        if (asInt(rest[i]['exact']) != null)
                          Padding(padding: const EdgeInsets.only(right: 10), child: Text(tr('${rest[i]['exact']} exact', '${rest[i]['exact']} exacts'), style: context.text.bodySmall)),
                        Text('${asInt(rest[i]['points']) ?? 0}', style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, fontSize: 16, color: c.ink)),
                      ]),
                    ).entrance(i),
                  ),
              ]),
            );
          },
        ),
      ]),
    );
  }
}

class _Podium extends StatelessWidget {
  const _Podium({required this.entries});
  final List<Json> entries;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    Widget column(Json? e, double height, int place) {
      if (e == null) return const Expanded(child: SizedBox.shrink());
      return Expanded(
        child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
          RankBadge(rank: asInt(e['rank']) ?? place, size: place == 1 ? 46 : 38),
          const SizedBox(height: 6),
          Text(str(e['displayName']), maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: context.text.titleSmall),
          Text('${asInt(e['points']) ?? 0} pts', style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, color: c.accentText)),
          const SizedBox(height: 6),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: height),
            duration: Duration(milliseconds: 500 + place * 120),
            curve: AppTheme.ease,
            builder: (context, h, _) => Container(
              height: h,
              decoration: BoxDecoration(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: place == 1 ? [FsColors.orange, const Color(0xFFB83600)] : [c.heroStart, c.heroEnd],
                ),
              ),
              alignment: Alignment.topCenter,
              padding: const EdgeInsets.only(top: 8),
              child: Text('$place', style: const TextStyle(fontFamily: 'Sora', fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white)),
            ),
          ),
        ]),
      );
    }

    return SizedBox(
      height: 230,
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        column(entries.length > 1 ? entries[1] : null, 84, 2),
        const SizedBox(width: 8),
        column(entries.isNotEmpty ? entries[0] : null, 116, 1),
        const SizedBox(width: 8),
        column(entries.length > 2 ? entries[2] : null, 64, 3),
      ]),
    );
  }
}

class _GroupsTab extends ConsumerWidget {
  const _GroupsTab();

  Future<void> _create(BuildContext context, WidgetRef ref) async {
    final name = await showDialog<String>(context: context, builder: (_) => const _NameDialog());
    if (name == null || !context.mounted) return;
    Future<Json> post() async => asMap(await api.post('/groups', body: {'name': name}));
    try {
      Json res;
      try {
        res = await post();
      } on ApiException catch (e) {
        if (e.code != 'guidelines_required' || !context.mounted) rethrow;
        if (!await ensureGuidelines(context)) return;
        res = await post();
      }
      ref.invalidate(groupsListProvider);
      if (context.mounted) context.push('/predictions/groups/${str(res['id'])}', extra: str(res['inviteToken']));
    } catch (e) {
      if (context.mounted) toast(context, communityError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final groups = ref.watch(groupsListProvider);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(groupsListProvider);
        await ref.read(groupsListProvider.future).catchError((_) => <Json>[]);
      },
      child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 40), children: [
        Text(
          tr('A group ranks its members by their league points, and equal totals share a rank. There are no deposits, wagers or prizes.',
              "Un groupe classe ses membres selon leurs points de ligue, et les totaux égaux partagent le même rang. Il n'y a ni dépôt, ni mise, ni lot."),
          style: context.text.bodySmall,
        ),
        const SizedBox(height: 12),
        FilledButton.icon(onPressed: () => _create(context, ref), icon: const Icon(Icons.group_add_rounded), label: Text(tr('Create a group', 'Créer un groupe'))),
        const SizedBox(height: 16),
        groups.when(
          loading: () => const SkeletonList(count: 3, padding: EdgeInsets.zero),
          error: (e, _) => ErrorView(error: e, compact: true, onRetry: () => ref.invalidate(groupsListProvider)),
          data: (list) {
            if (list.isEmpty) {
              return StateView.empty(tr('No groups yet', 'Aucun groupe pour le moment'),
                  message: tr('Create one and invite friends, or join with a link.', 'Créez-en un et invitez vos amis, ou rejoignez-en un avec un lien.'), icon: Icons.groups_2_outlined, compact: true);
            }
            return Column(children: [
              for (var i = 0; i < list.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: FsCard(
                    padding: const EdgeInsets.all(14),
                    onTap: () => context.push('/predictions/groups/${str(list[i]['id'])}'),
                    child: Row(children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(14)),
                        child: Icon(Icons.emoji_events_rounded, color: c.accent),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(str(list[i]['name']), style: context.text.titleSmall),
                          Text(
                            '${str(list[i]['role']) == 'owner' ? tr('Owner', 'Propriétaire') : tr('Member', 'Membre')} · ${tr('${asInt(list[i]['memberCount']) ?? 0} members', '${asInt(list[i]['memberCount']) ?? 0} membres')}',
                            style: context.text.bodySmall,
                          ),
                        ]),
                      ),
                      Icon(Icons.chevron_right_rounded, color: c.ink3),
                    ]),
                  ).entrance(i),
                ),
            ]);
          },
        ),
        const SizedBox(height: 6),
        JoinByLinkCard(
          kind: 'predictions',
          title: tr('Join a group with an invitation link', "Rejoindre un groupe avec un lien d'invitation"),
          onToken: (t) => context.push('/predictions/join/$t'),
        ),
      ]),
    );
  }
}

class _NameDialog extends StatefulWidget {
  const _NameDialog();

  @override
  State<_NameDialog> createState() => _NameDialogState();
}

class _NameDialogState extends State<_NameDialog> {
  final _ctl = TextEditingController();

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(tr('New group', 'Nouveau groupe')),
      content: TextField(
        controller: _ctl,
        autofocus: true,
        maxLength: 60,
        decoration: InputDecoration(hintText: tr('Group name', 'Nom du groupe')),
        onSubmitted: (v) => v.trim().isEmpty ? null : Navigator.pop(context, v.trim()),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(tr('Cancel', 'Annuler'))),
        FilledButton(
          onPressed: () {
            final v = _ctl.text.trim();
            if (v.isNotEmpty) Navigator.pop(context, v);
          },
          child: Text(tr('Create', 'Créer')),
        ),
      ],
    );
  }
}

class _BadgesTab extends ConsumerWidget {
  const _BadgesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final badges = ref.watch(_badgesProvider);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(_badgesProvider);
        await ref.read(_badgesProvider.future).catchError((_) => <String>[]);
      },
      child: badges.when(
        loading: () => const SkeletonList(count: 5),
        error: (e, _) => ListView(children: [ErrorView(error: e, onRetry: () => ref.invalidate(_badgesProvider))]),
        data: (mine) => GridView.count(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 0.92,
          children: [
            for (var i = 0; i < badgeIds.length; i++)
              () {
                final b = badgeIds[i];
                final has = mine.contains(b);
                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    color: has ? null : c.surface,
                    gradient: has ? LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c.heroStart, c.heroEnd]) : null,
                    border: Border.all(color: has ? Colors.transparent : c.line),
                  ),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Container(
                      width: 58,
                      height: 58,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: has ? const LinearGradient(colors: [FsColors.orange, Color(0xFFFFB37A)]) : null,
                        color: has ? null : c.surfaceMuted,
                      ),
                      child: Icon(has ? badgeIcon(b) : Icons.lock_outline_rounded, color: has ? Colors.white : c.ink3, size: 28),
                    ),
                    const SizedBox(height: 10),
                    Text(badgeName(b), textAlign: TextAlign.center, style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, color: has ? Colors.white : c.ink)),
                    const SizedBox(height: 4),
                    Text(badgeHelp(b), textAlign: TextAlign.center, maxLines: 3, style: TextStyle(fontSize: 12, height: 1.3, color: has ? Colors.white70 : c.ink3)),
                  ]),
                ).entrance(i);
              }(),
          ],
        ),
      ),
    );
  }
}

class _ReferralTab extends ConsumerWidget {
  const _ReferralTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final data = ref.watch(_referralProvider);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(_referralProvider);
        await ref.read(_referralProvider.future).catchError((_) => <String, dynamic>{});
      },
      child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 40), children: [
        data.when(
          loading: () => const SkeletonList(count: 2, padding: EdgeInsets.zero),
          error: (e, _) => ErrorView(error: e, compact: true, onRetry: () => ref.invalidate(_referralProvider)),
          data: (s) {
            final code = str(s['code']);
            final link = AppConfig.webUrl('/app/billing/invite/$code', locale: AppLocale.code);
            final perAward = asInt(s['perAward']) ?? 100;
            final cap = asInt(s['cap']) ?? 10;
            Widget stat(String label, String value) => Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(14)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(label, style: context.text.bodySmall),
                      const SizedBox(height: 2),
                      Text(value, style: context.text.titleLarge),
                    ]),
                  ),
                );
            return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(Icons.card_giftcard_rounded, color: c.accent),
                const SizedBox(width: 8),
                Text(tr('Invite friends', 'Invitez vos amis'), style: context.text.titleLarge),
              ]),
              const SizedBox(height: 6),
              Text(tr('Share your link. You earn points when a friend takes a paid plan.', 'Partagez votre lien. Vous gagnez des points quand un ami prend une offre payante.'),
                  style: context.text.bodyMedium),
              const SizedBox(height: 14),
              Row(children: [
                stat(tr('Points', 'Points'), '${asInt(s['points']) ?? 0}'),
                const SizedBox(width: 8),
                stat(tr('Rewarded', 'Récompensés'), '${asInt(s['awards']) ?? 0} / $cap'),
                const SizedBox(width: 8),
                stat(tr('Waiting', 'En attente'), '${asInt(s['pending']) ?? 0}'),
              ]),
              const SizedBox(height: 14),
              _ReferralLink(link: link),
              const SizedBox(height: 12),
              Text(
                tr(
                    'You earn $perAward points for each friend who takes a paid plan, up to $cap friends. Inviting yourself earns nothing, including through another spelling of your email address. Referral points are for recognition only: they are separate from league points and cannot be exchanged for money, plan credit or prizes.',
                    "Vous gagnez $perAward points pour chaque ami qui prend une offre payante, dans la limite de $cap amis. Vous inviter vous-même ne rapporte rien, y compris avec une autre écriture de votre adresse e-mail. Les points de parrainage sont purement honorifiques : ils sont distincts des points de ligue et ne peuvent être échangés contre de l'argent, du crédit d'offre ou des lots."),
                style: context.text.bodySmall,
              ),
            ]);
          },
        ),
      ]),
    );
  }
}

class _ReferralLink extends StatelessWidget {
  const _ReferralLink({required this.link});
  final String link;

  @override
  Widget build(BuildContext context) {
    return FsCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr('Your invitation link', "Votre lien d'invitation"), style: context.text.titleSmall),
        const SizedBox(height: 8),
        SelectableText(link, style: context.text.bodySmall),
        const SizedBox(height: 10),
        FilledButton.icon(
          onPressed: () => shareText(link, subject: 'FlacronSport'),
          icon: const Icon(Icons.ios_share_rounded, size: 18),
          label: Text(tr('Share link', 'Partager le lien')),
        ),
      ]),
    );
  }
}

final _groupProvider = FutureProvider.autoDispose.family<Json?, String>((ref, id) async {
  try {
    return asMap(await api.get('/groups/$id'));
  } on ApiException catch (e) {
    if (e.status == 404) return null;
    rethrow;
  }
});

class GroupScreen extends ConsumerStatefulWidget {
  const GroupScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<GroupScreen> createState() => _GroupScreenState();
}

class _GroupScreenState extends ConsumerState<GroupScreen> {
  String? _invite;
  bool _inviteRead = false;

  Future<void> _act(Future<void> Function() fn) async {
    try {
      await fn();
    } catch (e) {
      if (mounted) toast(context, communityError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_inviteRead) {
      _inviteRead = true;
      final extra = GoRouterState.of(context).extra;
      if (extra is String && extra.isNotEmpty) _invite = extra;
    }
    final c = context.fs;
    final group = ref.watch(_groupProvider(widget.id));
    return group.when(
      loading: () => Scaffold(appBar: AppBar(), body: const SkeletonList(count: 5)),
      error: (e, _) => Scaffold(appBar: AppBar(), body: ErrorView(error: e, onRetry: () => ref.invalidate(_groupProvider(widget.id)))),
      data: (g) {
        if (g == null) {
          return Scaffold(
            appBar: AppBar(),
            body: StateView.empty(tr('This group is no longer available', "Ce groupe n'est plus disponible"),
                icon: Icons.group_off_rounded, action: tr('Predictions', 'Pronostics'), onAction: () => context.go('/predictions')),
          );
        }
        final isOwner = asBool(g['isOwner']);
        final entries = asMapList(g['entries']);
        return Scaffold(
          appBar: AppBar(
            title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(str(g['name'])),
              Text('${tr('Participants', 'Participants')} ${asInt(g['memberCount']) ?? 0} / ${asInt(g['cap']) ?? 50}', style: context.text.bodySmall),
            ]),
            actions: [
              PopupMenuButton<String>(
                onSelected: (v) async {
                  if (v == 'invite') {
                    await _act(() async {
                      final res = asMap(await api.post('/groups/${widget.id}/invite'));
                      setState(() => _invite = asString(res['inviteToken']));
                      ref.invalidate(_groupProvider(widget.id));
                    });
                  } else if (v == 'revoke') {
                    await _act(() async {
                      await api.delete('/groups/${widget.id}/invite');
                      setState(() => _invite = null);
                      ref.invalidate(_groupProvider(widget.id));
                    });
                  } else if (v == 'close') {
                    if (!await confirmAction(context, tr('Close this group for everyone?', 'Fermer ce groupe pour tout le monde ?'), danger: true)) return;
                    await _act(() async {
                      await api.delete('/groups/${widget.id}');
                      ref.invalidate(groupsListProvider);
                      if (context.mounted) context.pop();
                    });
                  } else if (v == 'leave') {
                    if (!await confirmAction(context, tr('Leave this group?', 'Quitter ce groupe ?'))) return;
                    await _act(() async {
                      await api.delete('/groups/${widget.id}/members/me');
                      ref.invalidate(groupsListProvider);
                      if (context.mounted) context.pop();
                    });
                  }
                },
                itemBuilder: (_) => [
                  if (isOwner) PopupMenuItem(value: 'invite', child: Text(tr('New invitation link', "Nouveau lien d'invitation"))),
                  if (isOwner && asBool(g['inviteActive'])) PopupMenuItem(value: 'revoke', child: Text(tr('Revoke invitation', "Révoquer l'invitation"))),
                  if (isOwner) PopupMenuItem(value: 'close', child: Text(tr('Close group', 'Fermer le groupe'), style: TextStyle(color: c.danger))),
                  if (!isOwner) PopupMenuItem(value: 'leave', child: Text(tr('Leave group', 'Quitter le groupe'))),
                ],
              ),
            ],
          ),
          body: RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(_groupProvider(widget.id));
              await ref.read(_groupProvider(widget.id).future).catchError((_) => null);
            },
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 40), children: [
              if (_invite != null) ...[InviteLinkCard(url: groupInviteUrl(_invite!)), const SizedBox(height: 14)],
              if (isOwner && _invite == null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: OutlinedButton.icon(
                    onPressed: () => _act(() async {
                      final res = asMap(await api.post('/groups/${widget.id}/invite'));
                      setState(() => _invite = asString(res['inviteToken']));
                    }),
                    icon: const Icon(Icons.person_add_alt_1_rounded),
                    label: Text(tr('Invite friends', 'Inviter des amis')),
                  ),
                ),
              for (var i = 0; i < entries.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: asBool(entries[i]['mine']) ? c.accent.withValues(alpha: 0.08) : c.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: asBool(entries[i]['mine']) ? c.accent.withValues(alpha: 0.4) : c.line),
                    ),
                    child: Row(children: [
                      RankBadge(rank: asInt(entries[i]['rank'])),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(
                            '${str(entries[i]['displayName'])}${str(entries[i]['role']) == 'owner' ? ' · ${tr('Owner', 'Propriétaire')}' : ''}',
                            style: context.text.titleSmall?.copyWith(color: asBool(entries[i]['mine']) ? c.accentText : null),
                          ),
                          BadgeChips(badges: asStringList(entries[i]['badges'])),
                        ]),
                      ),
                      Text('${asInt(entries[i]['points']) ?? 0}', style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, fontSize: 16, color: c.ink)),
                      if (isOwner && str(entries[i]['role']) != 'owner')
                        IconButton(
                          tooltip: tr('Remove', 'Retirer'),
                          icon: Icon(Icons.person_remove_outlined, color: c.danger, size: 20),
                          onPressed: () async {
                            if (!await confirmAction(context, tr('Remove ${entries[i]['displayName']}?', 'Retirer ${entries[i]['displayName']} ?'), danger: true)) return;
                            await _act(() async {
                              await api.delete('/groups/${widget.id}/members/${str(entries[i]['ref'])}');
                              ref.invalidate(_groupProvider(widget.id));
                            });
                          },
                        ),
                    ]),
                  ).entrance(i),
                ),
              const SizedBox(height: 10),
              Text(
                tr('A group ranks its members by their league points, and equal totals share a rank. There are no deposits, wagers or prizes.',
                    "Un groupe classe ses membres selon leurs points de ligue, et les totaux égaux partagent le même rang. Il n'y a ni dépôt, ni mise, ni lot."),
                style: context.text.bodySmall,
              ),
            ]),
          ),
        );
      },
    );
  }
}

class GroupJoinScreen extends ConsumerStatefulWidget {
  const GroupJoinScreen({super.key, required this.token});
  final String token;

  @override
  ConsumerState<GroupJoinScreen> createState() => _GroupJoinScreenState();
}

class _GroupJoinScreenState extends ConsumerState<GroupJoinScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _join() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    Future<Json> post() async => asMap(await api.post('/groups/join', body: {'token': widget.token}));
    try {
      Json res;
      try {
        res = await post();
      } on ApiException catch (e) {
        if (e.code != 'guidelines_required' || !mounted) rethrow;
        if (!await ensureGuidelines(context)) {
          setState(() => _busy = false);
          return;
        }
        res = await post();
      }
      ref.invalidate(groupsListProvider);
      if (mounted) context.go('/predictions/groups/${str(res['id'])}');
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = communityError(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Scaffold(
      appBar: AppBar(title: Text(tr('Group invitation', 'Invitation de groupe'))),
      body: ListView(padding: const EdgeInsets.all(24), children: [
        const SizedBox(height: 24),
        Center(
          child: Container(
            width: 84,
            height: 84,
            decoration: const BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: [FsColors.orange, FsColors.navy])),
            child: const Icon(Icons.emoji_events_rounded, color: Colors.white, size: 38),
          ),
        ).entrance(0),
        const SizedBox(height: 22),
        Text(tr("You're invited to a prediction group", 'Vous êtes invité dans un groupe de pronostics'), textAlign: TextAlign.center, style: context.text.headlineSmall),
        const SizedBox(height: 8),
        Text(tr('Compare your league points with friends. No deposits, wagers or prizes.', 'Comparez vos points de ligue entre amis. Ni dépôt, ni mise, ni lot.'),
            textAlign: TextAlign.center, style: context.text.bodyMedium),
        const SizedBox(height: 28),
        if (_error != null)
          Container(
            padding: const EdgeInsets.all(14),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(color: c.danger.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14)),
            child: Text(_error!, style: TextStyle(color: c.danger, fontWeight: FontWeight.w600)),
          ),
        FilledButton(
          onPressed: _busy ? null : _join,
          child: _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white)) : Text(tr('Join group', 'Rejoindre le groupe')),
        ),
        const SizedBox(height: 10),
        OutlinedButton(onPressed: () => context.go('/predictions'), child: Text(tr('Predictions', 'Pronostics'))),
      ]),
    );
  }
}
