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
import '../match/chat_panel.dart' show ChatPanel, ensureGuidelines;
import 'community_common.dart';

final _clubsProvider = FutureProvider.autoDispose<Json>((ref) async {
  ref.watch(authUserProvider);
  return asMap(await api.get('/clubs'));
});

/// A sport club is one club for every language, so its name follows the reader's.
String clubName(Json club) => str(club['kind']) == 'sport' ? (Sport.byId(asString(club['sportId']))?.name ?? str(club['name'])) : str(club['name']);

String _members(int n) => tr('$n members', '$n membres');

/// POST, retrying once after the community guidelines are accepted.
Future<Json?> _postWithGate(BuildContext context, String path, {Object? body}) async {
  try {
    return asMap(await api.post(path, body: body));
  } on ApiException catch (e) {
    if (e.code != 'guidelines_required' || !context.mounted) rethrow;
    if (!await ensureGuidelines(context)) return null;
    return asMap(await api.post(path, body: body));
  }
}

class ClubsScreen extends ConsumerWidget {
  const ClubsScreen({super.key});

  Future<void> _join(BuildContext context, WidgetRef ref, Json body) async {
    try {
      final res = await _postWithGate(context, '/clubs', body: body);
      if (res == null) return;
      ref.invalidate(_clubsProvider);
      if (context.mounted) context.push('/clubs/${str(res['id'])}');
    } catch (e) {
      if (context.mounted) toast(context, communityError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final clubs = ref.watch(_clubsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(tr('Fan clubs', 'Clubs de fans'))),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_clubsProvider);
          await ref.read(_clubsProvider.future).catchError((_) => <String, dynamic>{});
        },
        child: clubs.when(
          loading: () => const SkeletonList(count: 6),
          error: (e, _) => ListView(children: [ErrorView(error: e, onRetry: () => ref.invalidate(_clubsProvider))]),
          data: (d) {
            final mine = asMapList(d['mine']);
            final sports = asMapList(d['sports']);
            final followed = asStringList(d['followed']);
            var i = 0;
            return ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 40), children: [
              if (mine.isEmpty)
                FsCard(
                  gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c.heroStart, c.heroEnd]),
                  border: false,
                  child: Row(children: [
                    const Icon(Icons.flag_rounded, color: Colors.white, size: 30),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(tr('No clubs yet', 'Aucun club pour le moment'), style: const TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, fontSize: 16, color: Colors.white)),
                        const SizedBox(height: 4),
                        Text(tr('Choose one of your teams or a sport below.', "Choisissez l'une de vos équipes ou un sport ci-dessous."),
                            style: const TextStyle(color: Colors.white70, fontSize: 13)),
                      ]),
                    ),
                  ]),
                ).entrance(i++)
              else ...[
                SectionHeader(tr('Your clubs', 'Vos clubs'), padding: const EdgeInsets.fromLTRB(4, 8, 0, 8)),
                for (final club in mine)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _ClubTile(
                      club: club,
                      trailing: Icon(Icons.chevron_right_rounded, color: c.ink3),
                      onTap: () => context.push('/clubs/${str(club['id'])}'),
                    ).entrance(i++),
                  ),
              ],
              if (followed.isNotEmpty) ...[
                SectionHeader(tr('Team clubs', "Clubs d'équipes"), padding: const EdgeInsets.fromLTRB(4, 18, 0, 2)),
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
                  child: Text(tr('Clubs for the teams you follow.', 'Les clubs des équipes que vous suivez.'), style: context.text.bodySmall),
                ),
                for (final team in followed)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: FsCard(
                      padding: const EdgeInsets.all(12),
                      child: Row(children: [
                        Crest(name: team, size: 40),
                        const SizedBox(width: 12),
                        Expanded(child: Text(team, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.titleSmall)),
                        OutlinedButton(
                          style: OutlinedButton.styleFrom(minimumSize: const Size(0, 38)),
                          onPressed: () => _join(context, ref, {'kind': 'team', 'team': team}),
                          child: Text(tr('Join', 'Rejoindre')),
                        ),
                      ]),
                    ).entrance(i++),
                  ),
              ],
              SectionHeader(tr('Sport clubs', 'Clubs par sport'), padding: const EdgeInsets.fromLTRB(4, 18, 0, 8)),
              for (final club in sports)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _ClubTile(
                    club: {...club, 'kind': 'sport'},
                    onTap: asBool(club['joined']) ? () => context.push('/clubs/${str(club['id'])}') : null,
                    trailing: asBool(club['joined'])
                        ? TextButton(onPressed: () => context.push('/clubs/${str(club['id'])}'), child: Text(tr('Open', 'Ouvrir')))
                        : OutlinedButton(
                            style: OutlinedButton.styleFrom(minimumSize: const Size(0, 38)),
                            onPressed: () => _join(context, ref, {'kind': 'sport', 'sportId': str(club['sportId'])}),
                            child: Text(tr('Join', 'Rejoindre')),
                          ),
                  ).entrance(i++),
                ),
            ]);
          },
        ),
      ),
    );
  }
}

class _ClubTile extends StatelessWidget {
  const _ClubTile({required this.club, required this.trailing, this.onTap});
  final Json club;
  final Widget trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final sport = Sport.byId(asString(club['sportId']));
    return FsCard(
      padding: const EdgeInsets.all(12),
      onTap: onTap,
      child: Row(children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(color: (sport?.color ?? c.brand).withValues(alpha: 0.14), borderRadius: BorderRadius.circular(14)),
          child: Icon(sport?.icon ?? Icons.flag_rounded, color: sport?.color ?? c.brand),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(clubName(club), maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.titleSmall),
            Text(_members(asInt(club['members']) ?? 0), style: context.text.bodySmall),
          ]),
        ),
        trailing,
      ]),
    );
  }
}

final _clubProvider = FutureProvider.autoDispose.family<Json?, String>((ref, id) async {
  try {
    return asMap(await api.get('/clubs/$id'));
  } on ApiException catch (e) {
    if (e.status == 404) return null;
    rethrow;
  }
});

class ClubScreen extends ConsumerWidget {
  const ClubScreen({super.key, required this.id});
  final String id;

  Future<void> _join(BuildContext context, WidgetRef ref) async {
    try {
      final res = await _postWithGate(context, '/clubs/$id');
      if (res == null) return;
      ref.invalidate(_clubProvider(id));
      ref.invalidate(_clubsProvider);
    } catch (e) {
      if (context.mounted) toast(context, communityError(e), error: true);
    }
  }

  Future<void> _leave(BuildContext context, WidgetRef ref) async {
    if (!await confirmAction(context, tr('Leave this club?', 'Quitter ce club ?'), confirm: tr('Leave', 'Quitter'))) return;
    try {
      await api.delete('/clubs/$id');
      ref.invalidate(_clubProvider(id));
      ref.invalidate(_clubsProvider);
    } catch (e) {
      if (context.mounted) toast(context, communityError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final club = ref.watch(_clubProvider(id));
    return club.when(
      loading: () => Scaffold(appBar: AppBar(), body: const SkeletonList(count: 4)),
      error: (e, _) => Scaffold(appBar: AppBar(), body: ErrorView(error: e, onRetry: () => ref.invalidate(_clubProvider(id)))),
      data: (cl) {
        if (cl == null) {
          return Scaffold(
            appBar: AppBar(),
            body: StateView.empty(tr('This club is not available', "Ce club n'est pas disponible"),
                icon: Icons.flag_outlined, action: tr('Fan clubs', 'Clubs de fans'), onAction: () => context.go('/clubs')),
          );
        }
        final joined = asBool(cl['joined']);
        final sport = Sport.byId(asString(cl['sportId']));
        return Scaffold(
          appBar: AppBar(
            title: Row(children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(color: (sport?.color ?? c.brand).withValues(alpha: 0.14), borderRadius: BorderRadius.circular(10)),
                child: Icon(sport?.icon ?? Icons.flag_rounded, color: sport?.color ?? c.brand, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(clubName(cl), maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(_members(asInt(cl['members']) ?? 0), style: context.text.bodySmall),
                ]),
              ),
            ]),
            actions: [
              if (joined) TextButton(onPressed: () => _leave(context, ref), child: Text(tr('Leave', 'Quitter'), style: TextStyle(color: c.danger))),
              const SizedBox(width: 4),
            ],
          ),
          body: Column(children: [
            if (asBool(cl['locked']))
              Container(
                width: double.infinity,
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: c.warning.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                child: Text(tr('This conversation is locked.', 'Cette conversation est verrouillée.'), style: TextStyle(color: c.warning, fontWeight: FontWeight.w600)),
              ),
            Expanded(
              child: joined
                  ? ChatPanel(
                      scope: 'room',
                      scopeId: id,
                      listPath: '/rooms/$id/messages',
                      postPath: '/rooms/$id/messages',
                      closedMessage: asBool(cl['locked']) ? tr('This conversation is locked.', 'Cette conversation est verrouillée.') : null,
                    )
                  : Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          Container(
                            width: 80,
                            height: 80,
                            decoration: const BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: [FsColors.orange, FsColors.navy])),
                            child: Icon(sport?.icon ?? Icons.flag_rounded, color: Colors.white, size: 36),
                          ).entrance(0),
                          const SizedBox(height: 18),
                          Text(clubName(cl), textAlign: TextAlign.center, style: context.text.headlineSmall),
                          const SizedBox(height: 6),
                          Text(tr('Join the club to read and post in its chat.', 'Rejoignez le club pour lire et écrire dans sa discussion.'),
                              textAlign: TextAlign.center, style: context.text.bodyMedium),
                          const SizedBox(height: 20),
                          FilledButton.icon(onPressed: () => _join(context, ref), icon: const Icon(Icons.group_add_rounded), label: Text(tr('Join club', 'Rejoindre le club'))),
                        ]),
                      ),
                    ),
            ),
          ]),
        );
      },
    );
  }
}
