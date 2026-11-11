import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api/api_client.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../widgets/common.dart';

/// Messages for community error codes (rooms-panel.tsx, groups-panel.tsx).
String communityError(Object e) {
  if (e is ApiException) {
    final text = switch (e.code) {
      'plan_required' => tr('Your plan can join rooms but not create them. A Plus or Premium plan or a room pass is needed.',
          "Votre offre permet de rejoindre des salons, pas d'en créer. Il faut une offre Plus ou Premium, ou un pass salon."),
      'room_limit' => tr('You have reached your active room limit.', 'Vous avez atteint votre limite de salons actifs.'),
      'room_full' => tr('This room is full.', 'Ce salon est complet.'),
      'invite_invalid' => tr('This invitation is not valid.', "Cette invitation n'est pas valide."),
      'removed_from_room' => tr('You were removed from this room.', 'Vous avez été retiré de ce salon.'),
      'room_expired' => tr('This room has expired.', 'Ce salon a expiré.'),
      'room_locked' => tr('This conversation is locked.', 'Cette conversation est verrouillée.'),
      'match_over' => tr('This game is over, so a room cannot be created for it.', 'Ce match est terminé, un salon ne peut donc pas être créé.'),
      'group_limit' => tr('You have reached your limit of 5 groups.', 'Vous avez atteint votre limite de 5 groupes.'),
      'group_full' => tr('This group is full.', 'Ce groupe est complet.'),
      'removed_from_group' => tr('You were removed from this group.', 'Vous avez été retiré de ce groupe.'),
      'removed_from_club' => tr('You were removed from this club.', 'Vous avez été retiré de ce club.'),
      'team_not_found' => tr('We could not find that team.', 'Équipe introuvable.'),
      'sanctioned' => tr('Your community access is restricted.', 'Votre accès à la communauté est restreint.'),
      'not_found' => tr('This is no longer available.', "Ce n'est plus disponible."),
      'message_too_long' => tr('Keep it under 500 characters.', 'Moins de 500 caractères.'),
      'invalid_message' => tr('Enter a name.', 'Saisissez un nom.'),
      'referral_not_eligible' => tr('This account cannot use an invitation.', 'Ce compte ne peut pas utiliser une invitation.'),
      _ => null,
    };
    if (text != null) return text;
  }
  return errorText(e);
}

/// Pulls an invite token out of a pasted link or returns the text itself.
String? tokenFromInput(String input, String kind) {
  final text = input.trim();
  if (text.isEmpty) return null;
  final match = RegExp('$kind/join/([\\w-]{20,100})').firstMatch(text);
  if (match != null) return match.group(1);
  return RegExp(r'^[\w-]{20,100}$').hasMatch(text) ? text : null;
}

String roomInviteUrl(String token) => AppConfig.webUrl('/app/rooms/join/$token', locale: AppLocale.code);
String groupInviteUrl(String token) => AppConfig.webUrl('/app/predictions/join/$token', locale: AppLocale.code);

Future<void> shareText(String text, {String? subject}) => SharePlus.instance.share(ShareParams(text: text, subject: subject));

Future<bool> confirmAction(BuildContext context, String message, {bool danger = false, String? confirm}) async {
  final c = context.fs;
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      content: Text(message, style: context.text.bodyLarge),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: Text(tr('Cancel', 'Annuler'), style: TextStyle(color: c.ink2))),
        FilledButton(
          style: danger ? FilledButton.styleFrom(backgroundColor: c.danger) : null,
          onPressed: () => Navigator.pop(context, true),
          child: Text(confirm ?? tr('Confirm', 'Confirmer')),
        ),
      ],
    ),
  );
  return ok == true;
}

/// The invite link a host or owner shares. Shown once, like the web.
class InviteLinkCard extends StatelessWidget {
  const InviteLinkCard({super.key, required this.url, this.title});
  final String url;
  final String? title;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return FsCard(
      gradient: LinearGradient(colors: [c.accent.withValues(alpha: 0.10), c.brand.withValues(alpha: 0.05)]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.link_rounded, color: c.accent, size: 20),
          const SizedBox(width: 8),
          Text(title ?? tr('Invitation link', "Lien d'invitation"), style: context.text.titleSmall),
        ]),
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: c.line)),
          child: Text(url, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: c.ink2, fontFamily: 'Inter')),
        ),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: url));
                toast(context, tr('Link copied', 'Lien copié'));
              },
              icon: const Icon(Icons.copy_rounded, size: 18),
              label: Text(tr('Copy', 'Copier')),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: FilledButton.icon(
              onPressed: () => shareText(url),
              icon: const Icon(Icons.ios_share_rounded, size: 18),
              label: Text(tr('Share', 'Partager')),
            ),
          ),
        ]),
        const SizedBox(height: 8),
        Text(tr('Share this link now. It is shown only once.', "Partagez ce lien maintenant. Il n'est affiché qu'une seule fois."), style: context.text.bodySmall),
      ]),
    );
  }
}

/// Paste an invite link to join a room or group.
class JoinByLinkCard extends StatefulWidget {
  const JoinByLinkCard({super.key, required this.kind, required this.onToken, required this.title});
  final String kind; // 'rooms' or 'predictions'
  final String title;
  final ValueChanged<String> onToken;

  @override
  State<JoinByLinkCard> createState() => _JoinByLinkCardState();
}

class _JoinByLinkCardState extends State<JoinByLinkCard> {
  final _ctl = TextEditingController();

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  void _submit() {
    final token = tokenFromInput(_ctl.text, widget.kind);
    if (token == null) {
      toast(context, tr('Paste the full invitation link.', "Collez le lien d'invitation complet."), error: true);
      return;
    }
    widget.onToken(token);
  }

  @override
  Widget build(BuildContext context) {
    return FsCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(widget.title, style: context.text.titleSmall),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(
            child: TextField(
              controller: _ctl,
              onSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                hintText: tr('Paste invitation link', "Collez le lien d'invitation"),
                prefixIcon: const Icon(Icons.link_rounded),
                suffixIcon: IconButton(
                  tooltip: tr('Paste', 'Coller'),
                  icon: const Icon(Icons.content_paste_rounded),
                  onPressed: () async {
                    final data = await Clipboard.getData('text/plain');
                    if (data?.text != null) _ctl.text = data!.text!;
                  },
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          FilledButton(onPressed: _submit, style: FilledButton.styleFrom(minimumSize: const Size(64, 52)), child: Text(tr('Join', 'Rejoindre'))),
        ]),
      ]),
    );
  }
}

/// Medal-style rank.
class RankBadge extends StatelessWidget {
  const RankBadge({super.key, required this.rank, this.size = 30});
  final int? rank;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final colors = switch (rank) {
      1 => [const Color(0xFFFFD45C), const Color(0xFFE0A100)],
      2 => [const Color(0xFFE3E8EF), const Color(0xFF9AA6B8)],
      3 => [const Color(0xFFF2B07A), const Color(0xFFB8682C)],
      _ => null,
    };
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: colors == null ? null : LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: colors),
        color: colors == null ? c.surfaceMuted : null,
      ),
      child: Text(rank?.toString() ?? '–',
          style: TextStyle(fontFamily: 'Sora', fontSize: size * 0.4, fontWeight: FontWeight.w800, color: colors == null ? c.ink2 : const Color(0xFF3A2A00))),
    );
  }
}

const badgeIds = ['supporter', 'club_member', 'predictor', 'veteran', 'sharp'];

String badgeName(String b) => switch (b) {
      'supporter' => tr('Supporter', 'Supporter'),
      'club_member' => tr('Club member', 'Membre de club'),
      'predictor' => tr('Predictor', 'Pronostiqueur'),
      'veteran' => tr('Veteran predictor', 'Pronostiqueur confirmé'),
      'sharp' => tr('Sharp eye', 'Œil affûté'),
      _ => b,
    };

String badgeHelp(String b) => switch (b) {
      'supporter' => tr('Follow a team.', 'Suivez une équipe.'),
      'club_member' => tr('Join a fan club.', 'Rejoignez un club de fans.'),
      'predictor' => tr('Make 10 predictions.', 'Faites 10 pronostics.'),
      'veteran' => tr('Make 50 predictions.', 'Faites 50 pronostics.'),
      'sharp' => tr('Get 5 exact scores, correct winners or perfect podiums.', 'Trouvez 5 scores exacts, bons vainqueurs ou podiums parfaits.'),
      _ => '',
    };

IconData badgeIcon(String b) => switch (b) {
      'supporter' => Icons.favorite_rounded,
      'club_member' => Icons.flag_rounded,
      'predictor' => Icons.psychology_rounded,
      'veteran' => Icons.military_tech_rounded,
      'sharp' => Icons.center_focus_strong_rounded,
      _ => Icons.workspace_premium_rounded,
    };

class BadgeChips extends StatelessWidget {
  const BadgeChips({super.key, required this.badges});
  final List<String> badges;

  @override
  Widget build(BuildContext context) {
    if (badges.isEmpty) return const SizedBox.shrink();
    final c = context.fs;
    return Wrap(spacing: 4, runSpacing: 4, children: [
      for (final b in badges)
        Tooltip(
          message: badgeHelp(b),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(99), border: Border.all(color: c.line)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(badgeIcon(b), size: 11, color: c.accent),
              const SizedBox(width: 3),
              Text(badgeName(b), style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: c.ink2)),
            ]),
          ),
        ),
    ]);
  }
}

/// Initials disc for members.
class MemberAvatar extends StatelessWidget {
  const MemberAvatar({super.key, required this.name, this.mine = false, this.size = 34});
  final String name;
  final bool mine;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final initials = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => w[0].toUpperCase()).join();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: mine ? const LinearGradient(colors: [FsColors.orange, FsColors.navy]) : null,
        color: mine ? null : c.surfaceMuted,
      ),
      child: Text(initials.isEmpty ? '?' : initials, style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, fontSize: size * 0.36, color: mine ? Colors.white : c.ink2)),
    );
  }
}

/// Upcoming games for rooms and predictions (GET /api/me/upcoming).
final upcomingGamesProvider = FutureProvider.autoDispose<({List<Json> games, bool stale})>((ref) async {
  ref.watch(authUserProvider);
  final res = asMap(await api.get('/me/upcoming'));
  return (games: asMapList(res['games']), stale: asBool(res['stale']));
});

class GameLine extends StatelessWidget {
  const GameLine({super.key, required this.game});
  final Json game;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final kickoff = Fmt.parse(asString(game['kickoffUTC']));
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        if (asBool(game['followed'])) Padding(padding: const EdgeInsets.only(right: 4), child: Icon(Icons.star_rounded, size: 15, color: c.accent)),
        Expanded(child: Text(str(game['title']), maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.titleSmall)),
      ]),
      const SizedBox(height: 2),
      Text(
        [str(game['competition']), if (kickoff != null) '${Fmt.relativeDay(kickoff)} · ${Fmt.time(kickoff)}'].where((s) => s.isNotEmpty).join(' · '),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: context.text.bodySmall,
      ),
    ]);
  }
}

/// Picks a game for a new room. `preset` is a game the member came from, which
/// may fall outside the listed week.
Future<String?> pickGame(BuildContext context, {String? selected, String? preset}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _GamePickerSheet(selected: selected, preset: preset),
  );
}

class _GamePickerSheet extends ConsumerStatefulWidget {
  const _GamePickerSheet({this.selected, this.preset});
  final String? selected, preset;

  @override
  ConsumerState<_GamePickerSheet> createState() => _GamePickerSheetState();
}

class _GamePickerSheetState extends ConsumerState<_GamePickerSheet> {
  String _q = '';

  String _plain(String s) {
    const from = 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ';
    const to = 'aaaaaaceeeeiiiinooooouuuuyy';
    final lower = s.toLowerCase();
    final b = StringBuffer();
    for (final ch in lower.split('')) {
      final i = from.indexOf(ch);
      b.write(i >= 0 ? to[i] : ch);
    }
    return b.toString();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final data = ref.watch(upcomingGamesProvider);
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.8,
      maxChildSize: 0.95,
      builder: (context, scroll) => Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr('Choose a game', 'Choisissez un match'), style: context.text.titleLarge),
            const SizedBox(height: 4),
            Text(tr('Teams you follow and major competitions come first.', "Les équipes que vous suivez et les grandes compétitions d'abord."), style: context.text.bodySmall),
            const SizedBox(height: 12),
            TextField(
              onChanged: (v) => setState(() => _q = v),
              decoration: InputDecoration(hintText: tr('Find a game', 'Trouver un match'), prefixIcon: const Icon(Icons.search_rounded)),
            ),
          ]),
        ),
        Expanded(
          child: AsyncView(
            value: data,
            onRetry: () => ref.invalidate(upcomingGamesProvider),
            builder: (d) {
              final words = _plain(_q).split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
              final games = d.games.where((g) {
                final hay = _plain('${g['title']} ${g['competition']}');
                return words.every(hay.contains);
              }).take(30).toList();
              final presetListed = widget.preset != null && d.games.any((g) => str(g['id']) == widget.preset);
              return ListView(controller: scroll, padding: const EdgeInsets.fromLTRB(16, 0, 16, 24), children: [
                if (d.stale) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(tr('Some data may be delayed.', 'Certaines données peuvent être retardées.'), style: context.text.bodySmall)),
                if (widget.preset != null && !presetListed)
                  _GameOption(
                    selected: widget.selected == widget.preset,
                    onTap: () => Navigator.pop(context, widget.preset),
                    child: Text(tr('The game you came from', 'Le match que vous consultiez'), style: context.text.titleSmall),
                  ),
                if (games.isEmpty)
                  StateView.empty(_q.isEmpty ? tr('No upcoming games this week', 'Aucun match à venir cette semaine') : tr('No game matches', 'Aucun match ne correspond'),
                      icon: Icons.event_busy_rounded, compact: true),
                for (final g in games)
                  _GameOption(selected: widget.selected == str(g['id']), onTap: () => Navigator.pop(context, str(g['id'])), child: GameLine(game: g)),
                if (games.isNotEmpty) const SizedBox(height: 4),
                if (games.isNotEmpty) Text(tr('Showing up to 30 games in the next 7 days.', "Jusqu'à 30 matchs dans les 7 prochains jours."), style: TextStyle(fontSize: 12, color: c.ink3)),
              ]);
            },
          ),
        ),
      ]),
    );
  }
}

class _GameOption extends StatelessWidget {
  const _GameOption({required this.selected, required this.onTap, required this.child});
  final bool selected;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Pressable(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: selected ? c.accent : c.line, width: selected ? 1.6 : 1),
          ),
          child: Row(children: [
            Icon(selected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded, color: selected ? c.accent : c.ink3, size: 20),
            const SizedBox(width: 10),
            Expanded(child: child),
          ]),
        ),
      ),
    );
  }
}
