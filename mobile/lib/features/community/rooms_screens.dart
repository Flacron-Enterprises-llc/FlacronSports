import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../widgets/common.dart';
import '../match/chat_panel.dart' show ChatPanel, ensureGuidelines;
import 'community_common.dart';

const _roomPassParticipants = 50;

final roomsListProvider = FutureProvider.autoDispose<List<Json>>((ref) async {
  ref.watch(authUserProvider);
  return asMapList(asMap(await api.get('/rooms'))['rooms']);
});

bool _ended(String? iso) {
  final d = Fmt.parse(iso);
  return d != null && DateTime.now().isAfter(d);
}

String _timeLeft(String? iso) {
  final d = Fmt.parse(iso);
  if (d == null) return '';
  final left = d.difference(DateTime.now());
  if (left.isNegative) return tr('Ended', 'Terminé');
  if (left.inHours >= 24) return tr('${left.inDays} d ${left.inHours % 24} h left', '${left.inDays} j ${left.inHours % 24} h restants');
  if (left.inHours >= 1) return tr('${left.inHours} h ${left.inMinutes % 60} min left', '${left.inHours} h ${left.inMinutes % 60} min restantes');
  return tr('${left.inMinutes} min left', '${left.inMinutes} min restantes');
}

class RoomsScreen extends ConsumerStatefulWidget {
  const RoomsScreen({super.key, this.matchId});
  final String? matchId;

  @override
  ConsumerState<RoomsScreen> createState() => _RoomsScreenState();
}

class _RoomsScreenState extends ConsumerState<RoomsScreen> {
  bool _autoOpened = false;

  @override
  void initState() {
    super.initState();
    // Coming from a match page: open the create form straight away.
    if (widget.matchId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!_autoOpened && mounted) {
          _autoOpened = true;
          final account = ref.read(accountProvider).value;
          if (account?.canCreateRooms == true) _create();
        }
      });
    }
  }

  Future<void> _create() async {
    final created = await showModalBottomSheet<Json>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _CreateRoomSheet(matchId: widget.matchId),
    );
    if (created == null || !mounted) return;
    ref.invalidate(roomsListProvider);
    context.push('/rooms/${str(created['id'])}', extra: str(created['inviteToken']));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final rooms = ref.watch(roomsListProvider);
    final account = ref.watch(accountProvider).value;
    final canHost = account?.canCreateRooms ?? false;

    return Scaffold(
      appBar: AppBar(title: Text(tr('Watch rooms', 'Salons'))),
      floatingActionButton: canHost
          ? FloatingActionButton.extended(
              onPressed: _create,
              backgroundColor: FsColors.orange,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_rounded),
              label: Text(tr('Create room', 'Créer un salon')),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(roomsListProvider);
          await ref.read(roomsListProvider.future).catchError((_) => <Json>[]);
        },
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 110), children: [
          FsCard(
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c.heroStart, c.heroEnd]),
            border: false,
            child: Row(children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
                child: const Icon(Icons.forum_rounded, color: Colors.white),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(tr('Private rooms', 'Salons privés'), style: const TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, fontSize: 17, color: Colors.white)),
                  const SizedBox(height: 4),
                  Text(
                    tr('Each member watches on their own authorized source. A room does not share video.',
                        'Chaque membre regarde sur sa propre source autorisée. Un salon ne partage aucune vidéo.'),
                    style: const TextStyle(color: Colors.white70, fontSize: 12.5, height: 1.4),
                  ),
                ]),
              ),
            ]),
          ).entrance(0),
          const SizedBox(height: 14),
          if (account != null && !canHost) ...[
            FsCard(
              color: c.warning.withValues(alpha: 0.08),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr('Create a room', 'Créer un salon'), style: context.text.titleSmall),
                const SizedBox(height: 4),
                Text(
                  tr('Your plan can join rooms but not create them. A Plus or Premium plan or a room pass is needed.',
                      "Votre offre permet de rejoindre des salons, pas d'en créer. Il faut une offre Plus ou Premium, ou un pass salon."),
                  style: context.text.bodyMedium,
                ),
                const SizedBox(height: 10),
                Wrap(spacing: 8, children: [
                  FilledButton(onPressed: () => context.push('/billing'), child: Text(tr('Upgrade', 'Évoluer'))),
                  OutlinedButton(onPressed: () => openWeb('/app/assistant#addons'), child: Text(tr('Room pass', 'Pass salon'))),
                ]),
              ]),
            ),
            const SizedBox(height: 14),
          ],
          rooms.when(
            loading: () => const SkeletonList(count: 3, padding: EdgeInsets.zero),
            error: (e, _) => ErrorView(error: e, compact: true, onRetry: () => ref.invalidate(roomsListProvider)),
            data: (list) {
              if (list.isEmpty) {
                return StateView.empty(
                  tr('No rooms yet', 'Aucun salon pour le moment'),
                  message: tr('Create a room for an upcoming game, or open an invitation link from a host.',
                      "Créez un salon pour un match à venir, ou ouvrez le lien d'invitation d'un hôte."),
                  icon: Icons.groups_rounded,
                  action: tr('Browse games', 'Parcourir les matchs'),
                  onAction: () => context.go('/scores?status=scheduled'),
                  compact: true,
                );
              }
              return Column(children: [
                for (var i = 0; i < list.length; i++)
                  Padding(padding: const EdgeInsets.only(bottom: 10), child: _RoomRow(room: list[i]).entrance(i + 1)),
              ]);
            },
          ),
          const SizedBox(height: 6),
          JoinByLinkCard(
            kind: 'rooms',
            title: tr('Have an invitation? Paste the link your host sent you.', 'Vous avez une invitation ? Collez le lien envoyé par votre hôte.'),
            onToken: (t) => context.push('/rooms/join/$t'),
          ),
        ]),
      ),
    );
  }
}

class _RoomRow extends StatelessWidget {
  const _RoomRow({required this.room});
  final Json room;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final ended = _ended(asString(room['expiresAtUTC']));
    final host = str(room['role']) == 'host';
    return FsCard(
      padding: const EdgeInsets.all(14),
      onTap: () => context.push('/rooms/${str(room['id'])}'),
      child: Row(children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(14)),
          child: Icon(Icons.groups_rounded, color: c.brand),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(str(room['name']), maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.titleSmall),
            const SizedBox(height: 3),
            Row(children: [
              if (host) ...[Pill(tr('Host', 'Hôte'), color: c.accentText, background: c.accent.withValues(alpha: 0.12)), const SizedBox(width: 6)],
              Flexible(child: Text(ended ? tr('Ended', 'Terminé') : _timeLeft(asString(room['expiresAtUTC'])), style: context.text.bodySmall)),
            ]),
          ]),
        ),
        Pill('${asInt(room['memberCount']) ?? 0}', icon: Icons.person_rounded),
        const SizedBox(width: 4),
        Icon(Icons.chevron_right_rounded, color: c.ink3),
      ]),
    );
  }
}

class _CreateRoomSheet extends ConsumerStatefulWidget {
  const _CreateRoomSheet({this.matchId});
  final String? matchId;

  @override
  ConsumerState<_CreateRoomSheet> createState() => _CreateRoomSheetState();
}

class _CreateRoomSheetState extends ConsumerState<_CreateRoomSheet> {
  late String? _game = widget.matchId;
  Json? _gameRow;
  final _name = TextEditingController();
  double? _limit;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_game == null) return setState(() => _error = tr('Choose a game first.', "Choisissez d'abord un match."));
    final name = _name.text.trim();
    if (name.isEmpty || name.length > 60) return setState(() => _error = tr('Give the room a name (up to 60 characters).', 'Donnez un nom au salon (60 caractères au plus).'));
    setState(() {
      _busy = true;
      _error = null;
    });
    Future<Json> post() async => asMap(await api.post('/rooms', body: {
          'matchId': _game,
          'name': name,
          if (_limit != null) 'participantLimit': _limit!.round(),
        }));
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
      if (mounted) Navigator.pop(context, res);
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
    final account = ref.watch(accountProvider).value;
    final max = account?.planInfo.roomPeople ?? _roomPassParticipants;
    final upcoming = ref.watch(upcomingGamesProvider).value;
    final listed = upcoming?.games.where((g) => str(g['id']) == _game).firstOrNull;
    final game = _gameRow ?? listed;

    Widget step(int n, String title, Widget child) => Padding(
          padding: const EdgeInsets.only(bottom: 18),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: context.isDark ? c.accent : FsColors.navy, shape: BoxShape.circle),
              child: Text('$n', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800)),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: context.text.titleSmall), const SizedBox(height: 8), child])),
          ]),
        );

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text(tr('Create a room', 'Créer un salon'), style: context.text.titleLarge),
          const SizedBox(height: 18),
          step(
            1,
            tr('Pick a game', 'Choisissez un match'),
            Pressable(
              onTap: () async {
                final id = await pickGame(context, selected: _game, preset: widget.matchId);
                if (id == null) return;
                setState(() {
                  _game = id;
                  _gameRow = ref.read(upcomingGamesProvider).value?.games.where((g) => str(g['id']) == id).firstOrNull;
                });
              },
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(14), border: Border.all(color: c.line)),
                child: Row(children: [
                  Expanded(
                    child: game != null
                        ? GameLine(game: game)
                        : Text(_game != null ? tr('The game you came from', 'Le match que vous consultiez') : tr('Choose a game', 'Choisissez un match'),
                            style: context.text.titleSmall?.copyWith(color: _game != null ? c.ink : c.ink3)),
                  ),
                  Icon(Icons.unfold_more_rounded, color: c.ink3),
                ]),
              ),
            ),
          ),
          step(
            2,
            tr('Name the room', 'Nommez le salon'),
            TextField(controller: _name, maxLength: 60, decoration: InputDecoration(hintText: tr('Saturday crew', 'Les amis du samedi'), counterText: '')),
          ),
          step(
            3,
            tr('Participant limit', 'Nombre de participants'),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                  child: Slider(
                    value: (_limit ?? max.toDouble()).clamp(2, max.toDouble()),
                    min: 2,
                    max: max.toDouble(),
                    divisions: max - 2,
                    label: '${(_limit ?? max.toDouble()).round()}',
                    activeColor: FsColors.orange,
                    onChanged: (v) => setState(() => _limit = v),
                  ),
                ),
                SizedBox(width: 36, child: Text('${(_limit ?? max.toDouble()).round()}', textAlign: TextAlign.end, style: context.text.titleMedium)),
              ]),
              Text(tr('Up to $max people on your plan.', "Jusqu'à $max personnes avec votre formule."), style: context.text.bodySmall),
            ]),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: TextStyle(color: c.danger, fontWeight: FontWeight.w600)),
            ),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _busy ? null : _submit,
              child: _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white)) : Text(tr('Create room', 'Créer le salon')),
            ),
          ),
        ]),
      ),
    );
  }
}

final _roomDetailProvider = FutureProvider.autoDispose.family<Json?, String>((ref, id) async {
  ref.watch(authUserProvider);
  final timer = Timer(const Duration(seconds: 15), ref.invalidateSelf);
  ref.onDispose(timer.cancel);
  try {
    return asMap(await api.get('/rooms/$id'));
  } on ApiException catch (e) {
    if (e.status == 404) return null;
    rethrow;
  }
});

class RoomScreen extends ConsumerStatefulWidget {
  const RoomScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<RoomScreen> createState() => _RoomScreenState();
}

class _RoomScreenState extends ConsumerState<RoomScreen> {
  String? _invite;
  bool _inviteRead = false;

  Future<void> _act(Future<void> Function() action) async {
    try {
      await action();
    } catch (e) {
      if (mounted) toast(context, communityError(e), error: true);
    }
  }

  Future<void> _rotate(bool create) => _act(() async {
        if (create) {
          final res = asMap(await api.post('/rooms/${widget.id}/invite'));
          setState(() => _invite = asString(res['inviteToken']));
        } else {
          await api.delete('/rooms/${widget.id}/invite');
          setState(() => _invite = null);
          if (mounted) toast(context, tr('Invitation revoked', 'Invitation révoquée'));
        }
        ref.invalidate(_roomDetailProvider(widget.id));
      });

  Future<void> _leave() async {
    if (!await confirmAction(context, tr('Leave this room?', 'Quitter ce salon ?'), confirm: tr('Leave', 'Quitter'))) return;
    await _act(() async {
      await api.delete('/rooms/${widget.id}/members/me');
      ref.invalidate(roomsListProvider);
      if (mounted) context.pop();
    });
  }

  Future<void> _close() async {
    if (!await confirmAction(context, tr('Close this room for everyone? This cannot be undone.', 'Fermer ce salon pour tout le monde ? Cette action est définitive.'),
        danger: true, confirm: tr('Close room', 'Fermer'))) {
      return;
    }
    await _act(() async {
      await api.delete('/rooms/${widget.id}');
      ref.invalidate(roomsListProvider);
      if (mounted) context.pop();
    });
  }

  void _members(Json detail) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _MembersSheet(roomId: widget.id, detail: detail, onChanged: () => ref.invalidate(_roomDetailProvider(widget.id))),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_inviteRead) {
      _inviteRead = true;
      final extra = GoRouterState.of(context).extra;
      if (extra is String && extra.isNotEmpty) _invite = extra;
    }
    final c = context.fs;
    final detail = ref.watch(_roomDetailProvider(widget.id));
    final listRow = ref.watch(roomsListProvider).value?.where((r) => str(r['id']) == widget.id).firstOrNull;
    final matchId = listRow == null ? null : asString(listRow['matchId']);

    return detail.when(
      loading: () => Scaffold(appBar: AppBar(), body: const SkeletonList(count: 4)),
      error: (e, _) => Scaffold(appBar: AppBar(), body: ErrorView(error: e, onRetry: () => ref.invalidate(_roomDetailProvider(widget.id)))),
      data: (d) {
        if (d == null || str(asMap(d['room'])['status']) == 'closed') {
          return Scaffold(
            appBar: AppBar(),
            body: StateView.empty(
              tr('This room is no longer available', "Ce salon n'est plus disponible"),
              message: tr('It may have been closed by its host, or you left it.', "Il a peut-être été fermé par son hôte, ou vous l'avez quitté."),
              icon: Icons.meeting_room_outlined,
              action: tr('All rooms', 'Tous les salons'),
              onAction: () => context.go('/rooms'),
            ),
          );
        }
        final room = asMap(d['room']);
        final isHost = asBool(d['isHost']);
        final ended = _ended(asString(room['expiresAtUTC']));
        final locked = asBool(room['locked']);
        final name = str(room['name'], str(listRow?['name']));

        return Scaffold(
          appBar: AppBar(
            title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
              Text(
                '${tr('Participants', 'Participants')} ${asInt(room['memberCount']) ?? 0} / ${asInt(room['participantCap']) ?? 0} · ${_timeLeft(asString(room['expiresAtUTC']))}',
                style: context.text.bodySmall,
              ),
            ]),
            actions: [
              IconButton(tooltip: tr('Members', 'Membres'), onPressed: () => _members(d), icon: const Icon(Icons.people_alt_outlined)),
              PopupMenuButton<String>(
                onSelected: (v) {
                  switch (v) {
                    case 'invite':
                      _rotate(true);
                    case 'revoke':
                      _rotate(false);
                    case 'close':
                      _close();
                    case 'leave':
                      _leave();
                    case 'match':
                      if (matchId != null) context.push('/match/$matchId');
                  }
                },
                itemBuilder: (_) => [
                  if (matchId != null) PopupMenuItem(value: 'match', child: Text(tr('Open the match', 'Ouvrir le match'))),
                  if (isHost && !ended) PopupMenuItem(value: 'invite', child: Text(tr('New invitation link', "Nouveau lien d'invitation"))),
                  if (isHost && !ended && asBool(room['inviteActive'])) PopupMenuItem(value: 'revoke', child: Text(tr('Revoke invitation', "Révoquer l'invitation"))),
                  if (isHost) PopupMenuItem(value: 'close', child: Text(tr('Close room', 'Fermer le salon'), style: TextStyle(color: c.danger))),
                  if (!isHost) PopupMenuItem(value: 'leave', child: Text(tr('Leave room', 'Quitter le salon'))),
                ],
              ),
            ],
          ),
          body: Column(children: [
            if (_invite != null && isHost && !ended)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: Stack(children: [
                  InviteLinkCard(url: roomInviteUrl(_invite!)),
                  Positioned(right: 0, top: 0, child: IconButton(icon: const Icon(Icons.close_rounded, size: 18), onPressed: () => setState(() => _invite = null))),
                ]),
              ),
            if (isHost && !ended && _invite == null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
                child: Row(children: [
                  Expanded(
                    child: Text(
                      asBool(room['inviteActive'])
                          ? tr('An invitation link is active. Create a new one to share it again.', "Un lien d'invitation est actif. Créez-en un nouveau pour le partager.")
                          : tr('No invitation link is active.', "Aucun lien d'invitation n'est actif."),
                      style: context.text.bodySmall,
                    ),
                  ),
                  TextButton.icon(onPressed: () => _rotate(true), icon: const Icon(Icons.link_rounded, size: 18), label: Text(tr('Invite', 'Inviter'))),
                ]),
              ),
            if (matchId != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
                child: FsCard(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  onTap: () => context.push('/match/$matchId'),
                  child: Row(children: [
                    Icon(Icons.scoreboard_rounded, color: c.accent, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(tr('Each member watches on their own authorized source.', 'Chaque membre regarde sur sa propre source autorisée.'),
                          style: context.text.bodySmall),
                    ),
                    Text(tr('Match', 'Match'), style: TextStyle(color: c.accentText, fontWeight: FontWeight.w700)),
                    Icon(Icons.chevron_right_rounded, color: c.accentText),
                  ]),
                ),
              ),
            if (ended || locked)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 6),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: c.warning.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                child: Text(
                  ended
                      ? tr('This room has ended. Messages stay readable.', 'Ce salon est terminé. Les messages restent lisibles.')
                      : tr('This conversation is locked.', 'Cette conversation est verrouillée.'),
                  style: TextStyle(color: c.warning, fontWeight: FontWeight.w600),
                ),
              ),
            Expanded(
              child: ChatPanel(
                scope: 'room',
                scopeId: widget.id,
                listPath: '/rooms/${widget.id}/messages',
                postPath: '/rooms/${widget.id}/messages',
                closedMessage: ended
                    ? tr('This room has ended. Messages stay readable.', 'Ce salon est terminé. Les messages restent lisibles.')
                    : locked
                        ? tr('This conversation is locked.', 'Cette conversation est verrouillée.')
                        : null,
              ),
            ),
          ]),
        );
      },
    );
  }
}

class _MembersSheet extends ConsumerWidget {
  const _MembersSheet({required this.roomId, required this.detail, required this.onChanged});
  final String roomId;
  final Json detail;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final members = asMapList(detail['members']);
    final isHost = asBool(detail['isHost']);
    final room = asMap(detail['room']);
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      builder: (context, scroll) => ListView(controller: scroll, padding: const EdgeInsets.fromLTRB(16, 0, 16, 24), children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
          child: Text('${tr('Members', 'Membres')} · ${asInt(room['memberCount']) ?? members.length} / ${asInt(room['participantCap']) ?? 0}', style: context.text.titleLarge),
        ),
        for (final m in members)
          ListTile(
            leading: MemberAvatar(name: str(m['displayName']), mine: asBool(m['mine'])),
            title: Text('${str(m['displayName'])}${asBool(m['mine']) ? ' ${tr('(you)', '(vous)')}' : ''}', style: context.text.titleSmall),
            subtitle: Text(str(m['role']) == 'host' ? tr('Host', 'Hôte') : tr('Member', 'Membre'), style: context.text.bodySmall),
            trailing: isHost && str(m['role']) != 'host'
                ? TextButton(
                    onPressed: () async {
                      final name = str(m['displayName']);
                      if (!await confirmAction(context, tr('Remove $name from this room? They cannot rejoin.', 'Retirer $name de ce salon ? Il ne pourra pas revenir.'),
                          danger: true, confirm: tr('Remove', 'Retirer'))) {
                        return;
                      }
                      try {
                        await api.delete('/rooms/$roomId/members/${str(m['ref'])}');
                        onChanged();
                        if (context.mounted) Navigator.pop(context);
                      } catch (e) {
                        if (context.mounted) toast(context, communityError(e), error: true);
                      }
                    },
                    child: Text(tr('Remove', 'Retirer'), style: TextStyle(color: c.danger)),
                  )
                : null,
          ),
      ]),
    );
  }
}

class RoomJoinScreen extends ConsumerStatefulWidget {
  const RoomJoinScreen({super.key, required this.token});
  final String token;

  @override
  ConsumerState<RoomJoinScreen> createState() => _RoomJoinScreenState();
}

class _RoomJoinScreenState extends ConsumerState<RoomJoinScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _join() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    Future<Json> post() async => asMap(await api.post('/rooms/join', body: {'token': widget.token}));
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
      ref.invalidate(roomsListProvider);
      if (mounted) context.go('/rooms/${str(res['id'])}');
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
      appBar: AppBar(title: Text(tr('Room invitation', 'Invitation au salon'))),
      body: ListView(padding: const EdgeInsets.all(24), children: [
        const SizedBox(height: 24),
        Center(
          child: Container(
            width: 84,
            height: 84,
            decoration: const BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: [FsColors.orange, FsColors.navy])),
            child: const Icon(Icons.mark_email_unread_rounded, color: Colors.white, size: 38),
          ),
        ).entrance(0),
        const SizedBox(height: 22),
        Text(tr("You're invited to a watch room", 'Vous êtes invité dans un salon'), textAlign: TextAlign.center, style: context.text.headlineSmall),
        const SizedBox(height: 8),
        Text(
          tr('Each member watches on their own authorized source. A room does not share video.', 'Chaque membre regarde sur sa propre source autorisée. Un salon ne partage aucune vidéo.'),
          textAlign: TextAlign.center,
          style: context.text.bodyMedium,
        ),
        const SizedBox(height: 28),
        if (_error != null)
          Container(
            padding: const EdgeInsets.all(14),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(color: c.danger.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14)),
            child: Row(children: [
              Icon(Icons.error_outline_rounded, color: c.danger),
              const SizedBox(width: 10),
              Expanded(child: Text(_error!, style: TextStyle(color: c.danger, fontWeight: FontWeight.w600))),
            ]),
          ),
        FilledButton(
          onPressed: _busy ? null : _join,
          child: _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white)) : Text(tr('Join room', 'Rejoindre le salon')),
        ),
        const SizedBox(height: 10),
        OutlinedButton(onPressed: () => context.go('/rooms'), child: Text(tr('My rooms', 'Mes salons'))),
      ]),
    );
  }
}
