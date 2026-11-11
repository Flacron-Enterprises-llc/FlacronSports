import 'dart:async';

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
import '../../widgets/event_tile.dart';
import '../scores/event_actions.dart';

final _boardProvider = FutureProvider.autoDispose<Json>((ref) async {
  // Reload whenever the pins change.
  ref.watch(prefsValueProvider.select((p) => p.boardPins.join(',')));
  return asMap(await api.get('/me/board'));
});

/// The multi-game board (components/sports/multi-board.tsx): pinned games and
/// today's games for followed teams, refreshed every minute.
class BoardScreen extends ConsumerStatefulWidget {
  const BoardScreen({super.key});

  @override
  ConsumerState<BoardScreen> createState() => _BoardScreenState();
}

class _BoardScreenState extends ConsumerState<BoardScreen> {
  String _view = 'pinned';
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 60), (_) {
      if (mounted && !ref.read(prefsValueProvider).lowData) ref.invalidate(_boardProvider);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final async = ref.watch(_boardProvider);
    final prefs = ref.watch(prefsValueProvider);
    final board = async.value;
    final events = SportEvent.list(board?[_view]);
    final missing = asInt(board?['missing']) ?? 0;
    final fetched = Fmt.parse(asString(board?['fetchedAt']));

    return Scaffold(
      appBar: AppBar(
        title: Text(tr('Board', 'Tableau')),
        actions: [
          IconButton(onPressed: () => ref.invalidate(_boardProvider), icon: const Icon(Icons.refresh_rounded), tooltip: tr('Refresh', 'Actualiser')),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_boardProvider);
          try {
            await ref.read(_boardProvider.future);
          } catch (_) {}
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 40),
          children: [
            SegmentedButton<String>(
              segments: [
                ButtonSegment(value: 'pinned', icon: const Icon(Icons.push_pin_rounded, size: 18), label: Text(tr('Pinned', 'Épinglés'))),
                ButtonSegment(value: 'favorites', icon: const Icon(Icons.star_rounded, size: 18), label: Text(tr('My teams', 'Mes équipes'))),
              ],
              selected: {_view},
              onSelectionChanged: (s) => setState(() => _view = s.first),
              showSelectedIcon: false,
            ),
            const SizedBox(height: 10),
            Row(children: [
              if (fetched != null) Text(tr('Updated ${Fmt.time(fetched)}', 'Mis à jour à ${Fmt.time(fetched)}'), style: context.text.bodySmall),
              const Spacer(),
              Text(tr('${prefs.boardPins.length}/12 pinned', '${prefs.boardPins.length}/12 épinglés'), style: context.text.bodySmall),
            ]),
            if (prefs.lowData)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(tr('Low-data mode is on: the board refreshes only when you pull.', 'Mode données réduites : actualisez en tirant vers le bas.'),
                    style: context.text.bodySmall),
              ),
            if (board != null && str(board['state']) == 'stale')
              _note(context, Icons.schedule_rounded, tr('Scores may be a few minutes behind.', 'Les scores peuvent avoir quelques minutes de retard.'), c.warning),
            if (_view == 'pinned' && missing > 0)
              _note(context, Icons.info_outline_rounded,
                  tr('$missing pinned game(s) could not be found today.', "$missing match(s) épinglé(s) introuvable(s) aujourd'hui."), c.warning),
            const SizedBox(height: 8),
            if (async.hasError && board == null)
              ErrorView(error: async.error!, onRetry: () => ref.invalidate(_boardProvider))
            else if (board == null)
              const SkeletonList(count: 4, height: 90, padding: EdgeInsets.zero)
            else if (events.isEmpty)
              _view == 'pinned'
                  ? StateView.empty(
                      tr('Nothing pinned yet', 'Rien d\'épinglé'),
                      message: tr('Long-press any game in Scores and pin it to follow several games at once.',
                          'Appuyez longuement sur un match dans Scores pour l\'épingler.'),
                      icon: Icons.push_pin_outlined,
                      action: tr('Browse scores', 'Voir les scores'),
                      onAction: () => context.go('/scores'),
                    )
                  : StateView.empty(
                      tr('No games for your teams today', "Aucun match de vos équipes aujourd'hui"),
                      icon: Icons.star_outline_rounded,
                      action: tr('My teams', 'Mes équipes'),
                      onAction: () => context.push('/my-teams'),
                    )
            else
              for (var i = 0; i < events.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Stack(children: [
                    GestureDetector(
                      onLongPress: () => showEventActions(context, ref, events[i]),
                      child: EventTile(event: events[i], showCompetition: true),
                    ),
                    if (_view == 'pinned')
                      Positioned(
                        right: 4,
                        top: 2,
                        child: IconButton(
                          visualDensity: VisualDensity.compact,
                          tooltip: tr('Unpin', 'Retirer'),
                          onPressed: () async {
                            try {
                              await ref.read(prefsProvider.notifier).togglePin(events[i].id);
                            } catch (e) {
                              if (context.mounted) toast(context, errorText(e), error: true);
                            }
                          },
                          icon: Icon(Icons.push_pin_rounded, size: 18, color: c.accent),
                        ),
                      ),
                  ]).entrance(i),
                ),
          ],
        ),
      ),
    );
  }

  Widget _note(BuildContext context, IconData icon, String text, Color color) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14)),
          child: Row(children: [Icon(icon, size: 18, color: color), const SizedBox(width: 8), Expanded(child: Text(text, style: context.text.bodyMedium))]),
        ),
      );
}
