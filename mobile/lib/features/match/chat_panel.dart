import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../widgets/common.dart';

// ---------------- Community guidelines gate (community-gate.tsx) ----------------

/// Shared across the app, so one confirmation opens every community surface.
bool? _accepted;
Future<bool>? _checking;

Future<bool> _checkAcceptance() {
  if (_accepted != null) return Future.value(_accepted);
  return _checking ??= api.get('/community/accept').then((res) {
    _accepted = asBool(asMap(res)['accepted'], true);
    return _accepted!;
  }).catchError((Object _) {
    // An unreadable answer must not hide the feature: the server has the last word.
    _accepted = true;
    return true;
  }).whenComplete(() => _checking = null);
}

/// True when the member has accepted the community guidelines. Asks with a
/// dialog when they have not. Call before any community write, and again when
/// a write fails with `guidelines_required`.
Future<bool> ensureGuidelines(BuildContext context, {bool force = false}) async {
  if (force) _accepted = false;
  final ok = force ? false : await _checkAcceptance();
  if (ok) return true;
  if (!context.mounted) return false;
  final accepted = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (_) => const _GuidelinesSheet(),
  );
  if (accepted == true) _accepted = true;
  return accepted == true;
}

/// Lets other screens reset the cache (e.g. after sign-out).
void resetGuidelinesCache() => _accepted = null;

class _GuidelinesSheet extends StatefulWidget {
  const _GuidelinesSheet();

  @override
  State<_GuidelinesSheet> createState() => _GuidelinesSheetState();
}

class _GuidelinesSheetState extends State<_GuidelinesSheet> {
  bool _age = false, _rules = false, _busy = false;
  String? _error;

  Future<void> _confirm() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await api.post('/community/accept', body: {'ageConfirmed': true, 'guidelinesAccepted': true});
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() {
        _busy = false;
        _error = errorText(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    Widget check(bool value, ValueChanged<bool> onChanged, Widget label) => Pressable(
          onTap: () => onChanged(!value),
          haptic: false,
          child: Container(
            margin: const EdgeInsets.only(top: 10),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: value ? c.success : c.line)),
            child: Row(children: [
              Checkbox(value: value, onChanged: (v) => onChanged(v ?? false), activeColor: c.success),
              const SizedBox(width: 4),
              Expanded(child: label),
            ]),
          ),
        );
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 4, 20, 20 + MediaQuery.viewInsetsOf(context).bottom + MediaQuery.paddingOf(context).bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: c.brand.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
            child: Icon(Icons.verified_user_rounded, color: c.brand),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(tr('Before you join in', 'Avant de participer'), style: context.text.titleLarge)),
        ]),
        const SizedBox(height: 10),
        Text(
          tr('Chat, predictions and rooms are for members aged 16 and over who follow the community guidelines.',
              'Le chat, les pronostics et les salons sont réservés aux membres de 16 ans et plus qui respectent les règles de la communauté.'),
          style: context.text.bodyMedium,
        ),
        check(_age, (v) => setState(() => _age = v), Text(tr('I am 16 or older', "J'ai 16 ans ou plus"), style: TextStyle(color: c.ink, fontWeight: FontWeight.w600))),
        check(
          _rules,
          (v) => setState(() => _rules = v),
          Wrap(crossAxisAlignment: WrapCrossAlignment.center, children: [
            Text(tr('I accept the ', "J'accepte les "), style: TextStyle(color: c.ink, fontWeight: FontWeight.w600)),
            GestureDetector(
              onTap: () => openWeb('/community-guidelines'),
              child: Text(tr('community guidelines', 'règles de la communauté'), style: TextStyle(color: c.accentText, fontWeight: FontWeight.w700, decoration: TextDecoration.underline)),
            ),
          ]),
        ),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_error!, style: TextStyle(color: c.danger))),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _age && _rules && !_busy ? _confirm : null,
          child: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white)) : Text(tr('Confirm', 'Confirmer')),
        ),
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: Text(tr('Not now', 'Plus tard'))),
      ]),
    );
  }
}

// ---------------- Chat ----------------

const _emoji = {'like': '👍', 'love': '❤️', 'laugh': '😂', 'wow': '😮', 'fire': '🔥', 'sad': '😢'};

String _chatError(Object e) {
  if (e is ApiException) {
    switch (e.code) {
      case 'slow_mode':
        return tr('Slow mode is on. Wait a few seconds before posting again.', 'Mode lent activé. Attendez quelques secondes.');
      case 'stream_link_rejected':
        return tr('Links to unofficial streams are not allowed.', 'Les liens vers des flux non officiels sont interdits.');
      case 'message_too_long':
        return tr('Messages can be up to 500 characters.', 'Les messages sont limités à 500 caractères.');
      case 'room_locked':
        return tr('This chat is locked.', 'Ce chat est verrouillé.');
      case 'sanctioned':
        return tr('You cannot post right now.', 'Vous ne pouvez pas publier pour le moment.');
      case 'room_expired':
        return tr('This room has ended.', 'Ce salon est terminé.');
      case 'rate_limited':
        return tr("You're posting too fast.", 'Vous publiez trop vite.');
      case 'feed_unavailable':
        return tr('Match data is unavailable right now.', 'Les données du match sont indisponibles.');
    }
  }
  return errorText(e);
}

String badgeLabel(String b) => switch (b) {
      'supporter' => tr('Supporter', 'Supporter'),
      'club_member' => tr('Club member', 'Membre de club'),
      'predictor' => tr('Predictor', 'Pronostiqueur'),
      'veteran' => tr('Veteran', 'Vétéran'),
      'sharp' => tr('Sharp', 'Expert'),
      _ => b,
    };

IconData badgeIcon(String b) => switch (b) {
      'supporter' => Icons.favorite_rounded,
      'club_member' => Icons.flag_rounded,
      'predictor' => Icons.insights_rounded,
      'veteran' => Icons.military_tech_rounded,
      'sharp' => Icons.bolt_rounded,
      _ => Icons.star_rounded,
    };

/// A community chat: match chat (`scope: 'match'`) or a room/club chat
/// (`scope: 'room'`). Needs a bounded height (e.g. inside Expanded or a tab).
/// [listPath] and [postPath] are API paths without the `/api` prefix, such as
/// `/matches/tsdb-1/chat` or `/rooms/<id>/messages`.
class ChatPanel extends ConsumerStatefulWidget {
  const ChatPanel({
    super.key,
    required this.scope,
    required this.scopeId,
    required this.listPath,
    required this.postPath,
    this.showPoll = false,
    this.closedMessage,
    this.header,
  });

  final String scope;
  final String scopeId;
  final String listPath;
  final String postPath;
  final bool showPoll;

  /// When set, the chat is read-only and this says why.
  final String? closedMessage;

  /// Optional widget shown above the messages (e.g. a room summary).
  final Widget? header;

  @override
  ConsumerState<ChatPanel> createState() => _ChatPanelState();
}

class _ChatPanelState extends ConsumerState<ChatPanel> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  List<Json> _messages = [];
  String? _cursor;
  bool _loaded = false, _busy = false, _locked = false, _loadingOlder = false;
  Object? _error;
  int _participants = 0;
  Json? _notice, _poll;
  Timer? _timer;
  bool _olderOpen = false;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (mounted && !_olderOpen && _messages.length <= 50) _load(silent: true);
    });
    _input.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _timer?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load({String? after, bool silent = false}) async {
    try {
      final res = asMap(await api.get(widget.listPath, query: {'cursor': after}));
      if (!mounted) return;
      setState(() {
        final list = asMapList(res['messages']);
        if (after != null) {
          _messages = [..._messages, ...list];
          _olderOpen = true;
        } else {
          _messages = list;
        }
        _cursor = asString(res['nextCursor']);
        if (widget.scope == 'match') {
          _locked = asBool(res['locked']);
          _participants = asInt(res['participants']) ?? 0;
          _notice = res['notice'] is Map ? asMap(res['notice']) : null;
          _poll = res['poll'] is Map ? asMap(res['poll']) : null;
        }
        _loaded = true;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      if (!silent || !_loaded) setState(() => _error = e);
    }
  }

  Future<void> _post() async {
    final text = _input.text.trim();
    if (text.isEmpty || _busy) return;
    if (!await ensureGuidelines(context)) return;
    setState(() => _busy = true);
    try {
      await api.post(widget.postPath, body: {'text': text});
      HapticFeedback.lightImpact();
      _input.clear();
      _olderOpen = false;
      await _load();
      if (_scroll.hasClients) _scroll.animateTo(0, duration: const Duration(milliseconds: 300), curve: AppTheme.ease);
    } catch (e) {
      if (e is ApiException && e.code == 'guidelines_required' && mounted) {
        if (await ensureGuidelines(context, force: true)) {
          setState(() => _busy = false);
          return _post();
        }
      } else if (mounted) {
        toast(context, _chatError(e), error: true);
      }
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _react(Json message, String reaction) async {
    if (!await ensureGuidelines(context)) return;
    try {
      final res = asMap(await api.post('/community/react', body: {'scope': widget.scope, 'scopeId': widget.scopeId, 'messageId': message['id'], 'reaction': reaction}));
      final next = asString(res['reaction']);
      setState(() {
        _messages = _messages.map((m) {
          if (m['id'] != message['id']) return m;
          final reactions = Map<String, dynamic>.from(asMap(m['reactions']));
          final mine = asString(m['myReaction']);
          if (mine != null) reactions[mine] = ((asInt(reactions[mine]) ?? 0) - 1).clamp(0, 1 << 30);
          if (next != null) reactions[next] = (asInt(reactions[next]) ?? 0) + 1;
          reactions.removeWhere((_, v) => (asInt(v) ?? 0) <= 0);
          return {...m, 'reactions': reactions, 'myReaction': next};
        }).toList();
      });
    } catch (e) {
      if (e is ApiException && e.code == 'guidelines_required' && mounted) {
        if (await ensureGuidelines(context, force: true)) return _react(message, reaction);
      } else if (mounted) {
        toast(context, _chatError(e), error: true);
      }
    }
  }

  Future<void> _flag(String kind, Json message, [String? reason]) async {
    try {
      await api.post('/community/$kind', body: {'scope': widget.scope, 'scopeId': widget.scopeId, 'messageId': message['id'], 'reason': ?reason});
      if (!mounted) return;
      toast(context, kind == 'report' ? tr('Thanks. A moderator will review it.', 'Merci. Un modérateur va examiner ce message.') : tr('Blocked. You will no longer see their messages.', 'Bloqué. Vous ne verrez plus ses messages.'));
      if (kind == 'block') _load();
    } catch (e) {
      if (e is ApiException && e.code == 'guidelines_required' && mounted) {
        if (await ensureGuidelines(context, force: true)) return _flag(kind, message, reason);
      } else if (mounted) {
        toast(context, _chatError(e), error: true);
      }
    }
  }

  Future<void> _vote(int option) async {
    if (!await ensureGuidelines(context)) return;
    try {
      final res = asMap(await api.post('/matches/${Uri.encodeComponent(widget.scopeId)}/poll', body: {'option': option}));
      HapticFeedback.mediumImpact();
      setState(() => _poll = res['poll'] is Map ? asMap(res['poll']) : _poll);
    } catch (e) {
      if (e is ApiException && e.code == 'guidelines_required' && mounted) {
        if (await ensureGuidelines(context, force: true)) return _vote(option);
        return;
      }
      if (!mounted) return;
      final msg = e is ApiException && e.code == 'already_voted'
          ? tr('You have already voted.', 'Vous avez déjà voté.')
          : e is ApiException && e.code == 'poll_closed'
              ? tr('This poll is closed.', 'Ce sondage est fermé.')
              : _chatError(e);
      toast(context, msg, error: true);
    }
  }

  void _openActions(Json m) {
    final mine = asBool(m['mine']);
    HapticFeedback.mediumImpact();
    showModalBottomSheet<void>(
      context: context,
      builder: (sheet) {
        final c = sheet.fs;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
                for (final entry in _emoji.entries)
                  Pressable(
                    onTap: () {
                      Navigator.pop(sheet);
                      _react(m, entry.key);
                    },
                    child: Container(
                      width: 48,
                      height: 48,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: m['myReaction'] == entry.key ? c.accent.withValues(alpha: 0.18) : c.surfaceMuted,
                      ),
                      child: Text(entry.value, style: const TextStyle(fontSize: 24)),
                    ),
                  ),
              ]),
              if (!mine) ...[
                const SizedBox(height: 12),
                ListTile(
                  leading: const Icon(Icons.flag_outlined),
                  title: Text(tr('Report message', 'Signaler le message')),
                  onTap: () {
                    Navigator.pop(sheet);
                    _report(m);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.block_rounded),
                  title: Text(tr('Block ${m['displayName']}', 'Bloquer ${m['displayName']}')),
                  onTap: () {
                    Navigator.pop(sheet);
                    _flag('block', m);
                  },
                ),
              ],
              ListTile(
                leading: const Icon(Icons.copy_rounded),
                title: Text(tr('Copy text', 'Copier le texte')),
                onTap: () {
                  Clipboard.setData(ClipboardData(text: str(m['text'])));
                  Navigator.pop(sheet);
                },
              ),
            ]),
          ),
        );
      },
    );
  }

  void _report(Json m) {
    final reasons = {
      'spam': tr('Spam', 'Spam'),
      'abuse': tr('Abuse or harassment', 'Abus ou harcèlement'),
      'illegal_stream': tr('Illegal stream link', 'Lien de diffusion illégale'),
      'other': tr('Something else', 'Autre chose'),
    };
    showModalBottomSheet<void>(
      context: context,
      builder: (sheet) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(tr('Why are you reporting this?', 'Pourquoi signalez-vous ce message ?'), style: sheet.text.titleMedium)),
          for (final r in reasons.entries)
            ListTile(
              title: Text(r.value),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () {
                Navigator.pop(sheet);
                _flag('report', m, r.key);
              },
            ),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }

  Future<void> _showBlocked() async {
    await showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (_) => _BlockedSheet(onChange: _load));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final user = ref.watch(authUserProvider).value;
    final closed = widget.closedMessage ?? (_locked ? tr('This chat is locked.', 'Ce chat est verrouillé.') : null);

    Widget body;
    if (!_loaded && _error == null) {
      body = const SkeletonList(count: 5, height: 54);
    } else if (!_loaded && _error != null) {
      body = ErrorView(error: _error!, onRetry: _load, compact: true);
    } else {
      final header = <Widget>[
        ?widget.header,
        if (_notice != null) _NoticeCard(text: str(_notice!['text'])),
        if (widget.showPoll && _poll != null) _PollCard(poll: _poll!, onVote: _vote),
        if (_participants > 0)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              Icon(Icons.people_alt_rounded, size: 15, color: c.ink3),
              const SizedBox(width: 6),
              Text(tr('$_participants taking part', '$_participants participants'), style: context.text.labelMedium),
              const Spacer(),
              GestureDetector(onTap: _showBlocked, child: Text(tr('Blocked people', 'Personnes bloquées'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.accentText))),
            ]),
          ),
      ];
      body = RefreshIndicator(
        onRefresh: () {
          _olderOpen = false;
          return _load();
        },
        child: ListView.builder(
          controller: _scroll,
          reverse: true,
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          itemCount: _messages.length + 2,
          itemBuilder: (context, i) {
            if (i < _messages.length) {
              final m = _messages[i];
              return _Bubble(message: m, onLongPress: closed == null ? () => _openActions(m) : null, onReact: closed == null ? (r) => _react(m, r) : null);
            }
            if (i == _messages.length) {
              if (_cursor == null) return const SizedBox(height: 4);
              return Center(
                child: TextButton.icon(
                  onPressed: _loadingOlder
                      ? null
                      : () async {
                          setState(() => _loadingOlder = true);
                          await _load(after: _cursor);
                          if (mounted) setState(() => _loadingOlder = false);
                        },
                  icon: const Icon(Icons.history_rounded, size: 18),
                  label: Text(tr('Older messages', 'Messages plus anciens')),
                ),
              );
            }
            return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              ...header,
              if (_messages.isEmpty)
                StateView.empty(tr('No messages yet', 'Aucun message'), message: tr('Start the conversation.', 'Lancez la conversation.'), icon: Icons.forum_rounded, compact: true),
            ]);
          },
        ),
      );
    }

    return Column(children: [
      Expanded(child: body),
      if (closed != null)
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          color: c.warning.withValues(alpha: 0.12),
          child: SafeArea(top: false, child: Text(closed, textAlign: TextAlign.center, style: TextStyle(color: c.ink, fontWeight: FontWeight.w600))),
        )
      else if (user != null) ...[
        if ((user.displayName ?? '').trim().isEmpty) const _NameSetup(),
        _Composer(controller: _input, busy: _busy, onSend: _post),
      ],
    ]);
  }
}

class _Composer extends StatelessWidget {
  const _Composer({required this.controller, required this.busy, required this.onSend});
  final TextEditingController controller;
  final bool busy;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final count = controller.text.characters.length;
    return Container(
      padding: EdgeInsets.fromLTRB(12, 8, 12, 8 + MediaQuery.paddingOf(context).bottom),
      decoration: BoxDecoration(color: c.surface, border: Border(top: BorderSide(color: c.line))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Expanded(
          child: TextField(
            controller: controller,
            minLines: 1,
            maxLines: 4,
            maxLength: 500,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: tr('Write a message', 'Écrire un message'),
              counterText: count > 400 ? '$count/500' : '',
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide(color: c.line)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide(color: c.accent, width: 1.4)),
            ),
            onSubmitted: (_) => onSend(),
          ),
        ),
        const SizedBox(width: 8),
        Padding(
          padding: const EdgeInsets.only(bottom: 2),
          child: Pressable(
            onTap: busy || controller.text.trim().isEmpty ? null : onSend,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: controller.text.trim().isEmpty ? null : const LinearGradient(colors: [FsColors.orange, Color(0xFFFF7A3D)]),
                color: controller.text.trim().isEmpty ? c.surfaceMuted : null,
              ),
              child: busy
                  ? const Padding(padding: EdgeInsets.all(13), child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
                  : Icon(Icons.send_rounded, size: 20, color: controller.text.trim().isEmpty ? c.ink3 : Colors.white),
            ),
          ),
        ),
      ]),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, this.onLongPress, this.onReact});
  final Json message;
  final VoidCallback? onLongPress;
  final ValueChanged<String>? onReact;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final m = message;
    final mine = asBool(m['mine']);
    final removed = asBool(m['removed']);
    final former = asBool(m['formerMember']);
    final live = !removed && !former;
    final name = former ? tr('Former member', 'Ancien membre') : str(m['displayName']);
    final text = removed ? tr('Message removed by a moderator.', 'Message retiré par un modérateur.') : former ? tr('Message from a former member.', "Message d'un ancien membre.") : str(m['text']);
    final at = Fmt.parse(asString(m['createdAtUTC']));
    final reactions = asMap(m['reactions']).entries.where((e) => (asInt(e.value) ?? 0) > 0).toList();
    final badges = asStringList(m['badges']);
    final initials = name.trim().isEmpty ? '?' : name.trim().split(RegExp(r'\s+')).take(2).map((w) => w[0].toUpperCase()).join();

    final avatar = Container(
      width: 30,
      height: 30,
      alignment: Alignment.center,
      decoration: BoxDecoration(shape: BoxShape.circle, color: mine ? FsColors.orange : (context.isDark ? c.surfaceMuted : FsColors.navy)),
      child: Text(initials, style: const TextStyle(fontFamily: 'Sora', color: Colors.white, fontWeight: FontWeight.w700, fontSize: 11)),
    );

    final bubble = Column(crossAxisAlignment: mine ? CrossAxisAlignment.end : CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 5, children: [
          Text(name, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: c.ink)),
          for (final b in badges) Tooltip(message: badgeLabel(b), child: Icon(badgeIcon(b), size: 13, color: c.accent)),
          if (at != null) Text(Fmt.relativeDay(at) == tr('Today', "Aujourd'hui") ? Fmt.time(at) : '${Fmt.dayMonth(at)} ${Fmt.time(at)}', style: TextStyle(fontSize: 11, color: c.ink3)),
        ]),
      ),
      const SizedBox(height: 3),
      GestureDetector(
        onLongPress: live ? onLongPress : null,
        child: Container(
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.72),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            gradient: mine && live ? const LinearGradient(colors: [FsColors.navy, Color(0xFF0B3C85)]) : null,
            color: mine && live ? null : c.surfaceMuted,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(mine ? 18 : 6),
              topRight: Radius.circular(mine ? 6 : 18),
              bottomLeft: const Radius.circular(18),
              bottomRight: const Radius.circular(18),
            ),
          ),
          child: Text(text,
              style: TextStyle(
                color: mine && live ? Colors.white : c.ink,
                fontSize: 14.5,
                height: 1.35,
                fontStyle: live ? FontStyle.normal : FontStyle.italic,
              )),
        ),
      ),
      if (live && reactions.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Wrap(spacing: 4, children: [
            for (final r in reactions)
              GestureDetector(
                onTap: onReact == null ? null : () => onReact!(r.key),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: m['myReaction'] == r.key ? c.accent : c.line),
                  ),
                  child: Text('${_emoji[r.key] ?? ''} ${r.value}', style: TextStyle(fontSize: 12, color: c.ink)),
                ),
              ),
          ]),
        ),
    ]);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: mine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: mine ? [Flexible(child: bubble), const SizedBox(width: 8), avatar] : [avatar, const SizedBox(width: 8), Flexible(child: bubble)],
      ),
    );
  }
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: c.info.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14), border: Border.all(color: c.info.withValues(alpha: 0.3))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.push_pin_rounded, size: 18, color: c.info),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr('Pinned', 'Épinglé'), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: c.info)),
            const SizedBox(height: 2),
            Text(text, style: TextStyle(color: c.ink)),
          ]),
        ),
      ]),
    );
  }
}

class _PollCard extends StatelessWidget {
  const _PollCard({required this.poll, required this.onVote});
  final Json poll;
  final ValueChanged<int> onVote;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final options = asMapList(poll['options']);
    final total = options.fold<int>(0, (n, o) => n + (asInt(o['votes']) ?? 0));
    final open = asBool(poll['open']);
    final myVote = asInt(poll['myVote']);
    final results = !open || myVote != null;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: c.line)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Icon(Icons.poll_rounded, size: 16, color: c.accent),
          const SizedBox(width: 6),
          Text(tr('Poll', 'Sondage'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: c.ink2)),
        ]),
        const SizedBox(height: 6),
        Text(str(poll['question']), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: c.ink)),
        const SizedBox(height: 10),
        for (var i = 0; i < options.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: results
                ? Builder(builder: (context) {
                    final votes = asInt(options[i]['votes']) ?? 0;
                    final pct = total == 0 ? 0.0 : votes / total;
                    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Row(children: [
                        Expanded(child: Text(str(options[i]['text']), style: TextStyle(fontWeight: myVote == i ? FontWeight.w800 : FontWeight.w500, color: c.ink))),
                        Text('${(pct * 100).round()}%', style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, color: c.ink2)),
                      ]),
                      const SizedBox(height: 4),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(99),
                        child: TweenAnimationBuilder<double>(
                          tween: Tween(begin: 0, end: pct),
                          duration: const Duration(milliseconds: 600),
                          curve: AppTheme.ease,
                          builder: (_, v, _) => LinearProgressIndicator(value: v, minHeight: 7, color: myVote == i ? FsColors.orange : c.brand, backgroundColor: c.surfaceMuted),
                        ),
                      ),
                    ]);
                  })
                : OutlinedButton(onPressed: () => onVote(i), style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44), alignment: Alignment.centerLeft), child: Text(str(options[i]['text']))),
          ),
        if (!open) Text(tr('This poll is closed.', 'Ce sondage est fermé.'), style: context.text.bodySmall),
      ]),
    );
  }
}

/// Email sign-ups never set a name; members choose one before posting (name-setup.tsx).
class _NameSetup extends ConsumerStatefulWidget {
  const _NameSetup();

  @override
  ConsumerState<_NameSetup> createState() => _NameSetupState();
}

class _NameSetupState extends ConsumerState<_NameSetup> {
  final _name = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final clean = _name.text.trim();
    if (clean.length < 2 || clean.contains('@')) {
      toast(context, tr('Use at least 2 characters and no @.', 'Utilisez au moins 2 caractères, sans @.'), error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final user = FirebaseAuth.instance.currentUser!;
      await user.updateDisplayName(clean);
      await user.getIdToken(true);
      await user.reload();
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 4),
      color: c.surfaceMuted,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(tr('Choose a display name', 'Choisissez un nom affiché'), style: TextStyle(fontWeight: FontWeight.w700, color: c.ink)),
        Text(tr('Others see it next to your messages.', 'Les autres le voient à côté de vos messages.'), style: context.text.bodySmall),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: TextField(controller: _name, maxLength: 40, decoration: InputDecoration(hintText: tr('Display name', 'Nom affiché'), counterText: '', isDense: true))),
          const SizedBox(width: 8),
          OutlinedButton(onPressed: _busy ? null : _save, style: OutlinedButton.styleFrom(minimumSize: const Size(0, 46)), child: Text(tr('Save', 'Enregistrer'))),
        ]),
        const SizedBox(height: 6),
      ]),
    );
  }
}

class _BlockedSheet extends StatefulWidget {
  const _BlockedSheet({required this.onChange});
  final Future<void> Function() onChange;

  @override
  State<_BlockedSheet> createState() => _BlockedSheetState();
}

class _BlockedSheetState extends State<_BlockedSheet> {
  List<Json>? _list;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = asMap(await api.get('/community/block'));
      if (mounted) setState(() => _list = asMapList(res['blocked']));
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _unblock(String ref) async {
    try {
      await api.delete('/community/block', body: {'ref': ref});
      await _load();
      await widget.onChange();
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.6),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(tr('Blocked people', 'Personnes bloquées'), style: context.text.titleLarge),
          const SizedBox(height: 8),
          if (_error != null)
            ErrorView(error: _error!, onRetry: _load, compact: true)
          else if (_list == null)
            const Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator())
          else if (_list!.isEmpty)
            StateView.empty(tr("You haven't blocked anyone", "Vous n'avez bloqué personne"), icon: Icons.block_rounded, compact: true)
          else
            Flexible(
              child: ListView(shrinkWrap: true, children: [
                for (final b in _list!)
                  ListTile(
                    leading: const Icon(Icons.person_off_rounded),
                    title: Text(str(b['displayName'])),
                    trailing: TextButton(onPressed: () => _unblock(str(b['ref'])), child: Text(tr('Unblock', 'Débloquer'))),
                  ),
              ]),
            ),
          const SizedBox(height: 12),
        ]),
      ),
    );
  }
}
