import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';
import 'feed.dart';

/// Quick actions for a game (event-actions.tsx): follow a side or the league,
/// set a reminder, pin to the board, open the match.
Future<void> showEventActions(BuildContext context, WidgetRef ref, SportEvent event) {
  HapticFeedback.mediumImpact();
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    builder: (sheetContext) => _EventActionsSheet(event: event, hostContext: context),
  );
}

class _EventActionsSheet extends ConsumerWidget {
  const _EventActionsSheet({required this.event, required this.hostContext});
  final SportEvent event;
  final BuildContext hostContext;

  Future<void> _run(BuildContext context, Future<void> Function() action, String done) async {
    try {
      await action();
      if (hostContext.mounted) toast(hostContext, done);
    } catch (e) {
      if (hostContext.mounted) toast(hostContext, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final prefs = ref.watch(prefsValueProvider);
    final notifier = ref.read(prefsProvider.notifier);
    final e = event;
    final sides = e.participants.where((p) => p.rawName != 'TBD').take(e.isDuel ? 2 : 0).toList();

    Widget tile(IconData icon, String label, VoidCallback onTap, {bool active = false}) => ListTile(
          leading: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: active ? c.accent.withValues(alpha: 0.14) : c.surfaceMuted, borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: active ? c.accent : c.ink2, size: 21),
          ),
          title: Text(label, style: context.text.titleSmall),
          onTap: onTap,
        );

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
            child: Text(e.title, style: context.text.titleLarge, maxLines: 2, overflow: TextOverflow.ellipsis),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: Text([e.competitionName, if (e.kickoffLabel != null) e.kickoffLabel!].join(' · '), style: context.text.bodySmall),
          ),
          for (final p in sides)
            tile(
              prefs.isFavorite(p.rawName) ? Icons.star_rounded : Icons.star_outline_rounded,
              prefs.isFavorite(p.rawName) ? tr('Unfollow ${p.name}', 'Ne plus suivre ${p.name}') : tr('Follow ${p.name}', 'Suivre ${p.name}'),
              () {
                final was = prefs.isFavorite(p.rawName);
                Navigator.pop(context);
                _run(context, () => notifier.toggleFavorite(p.rawName), was ? tr('Removed from your teams', 'Retiré de vos équipes') : tr('Added to your teams', 'Ajouté à vos équipes'));
              },
              active: prefs.isFavorite(p.rawName),
            ),
          if (e.competitionId != null)
            tile(
              prefs.followsLeague(e.competitionId) ? Icons.emoji_events_rounded : Icons.emoji_events_outlined,
              prefs.followsLeague(e.competitionId) ? tr('Unfollow ${e.competitionName}', 'Ne plus suivre ${e.competitionName}') : tr('Follow ${e.competitionName}', 'Suivre ${e.competitionName}'),
              () {
                final was = prefs.followsLeague(e.competitionId);
                Navigator.pop(context);
                _run(context, () => notifier.toggleLeague(e.competitionId!, e.competitionName, e.sportId),
                    was ? tr('League removed', 'Compétition retirée') : tr('League followed', 'Compétition suivie'));
              },
              active: prefs.followsLeague(e.competitionId),
            ),
          if (canRemind(e) || prefs.hasReminder(e.id))
            tile(
              prefs.hasReminder(e.id) ? Icons.notifications_active_rounded : Icons.notifications_none_rounded,
              prefs.hasReminder(e.id) ? tr('Remove reminder', 'Supprimer le rappel') : tr('Remind me', 'Me le rappeler'),
              () {
                final was = prefs.hasReminder(e.id);
                Navigator.pop(context);
                _run(context, () => notifier.toggleReminder(e.id, e.title, e.startUTC), was ? tr('Reminder removed', 'Rappel supprimé') : tr('Reminder set', 'Rappel activé'));
              },
              active: prefs.hasReminder(e.id),
            ),
          if (prefs.isPinned(e.id) || prefs.boardPins.length < 12)
            tile(
              prefs.isPinned(e.id) ? Icons.push_pin_rounded : Icons.push_pin_outlined,
              prefs.isPinned(e.id) ? tr('Unpin from board', 'Retirer du tableau') : tr('Pin to board', 'Épingler au tableau'),
              () {
                final was = prefs.isPinned(e.id);
                Navigator.pop(context);
                _run(context, () => notifier.togglePin(e.id), was ? tr('Unpinned', 'Retiré') : tr('Pinned to your board', 'Épinglé au tableau'));
              },
              active: prefs.isPinned(e.id),
            ),
          tile(Icons.open_in_new_rounded, tr('Open match', 'Ouvrir le match'), () {
            Navigator.pop(context);
            hostContext.push('/match/${Uri.encodeComponent(e.id)}');
          }),
        ]),
      ),
    );
  }
}
