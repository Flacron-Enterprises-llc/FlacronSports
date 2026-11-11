import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../widgets/common.dart';

/// Alerts the backend sent this member (newest 50), as notification-list.tsx.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  String? _seenBefore;

  @override
  void initState() {
    super.initState();
    _seenBefore = LocalStore.notificationsSeen;
  }

  void _markSeen(List<Json> list) {
    if (list.isEmpty) return;
    final newest = list.map((n) => str(n['createdAt'])).reduce((a, b) => a.compareTo(b) > 0 ? a : b);
    if (newest.isEmpty || newest == LocalStore.notificationsSeen) return;
    LocalStore.setNotificationsSeen(newest).then((_) {
      if (mounted) ref.invalidate(unreadCountProvider);
    });
  }

  (IconData, Color) _style(String type, FsColors c) => switch (type) {
        'start' => (Icons.play_circle_fill_rounded, c.info),
        'final' => (Icons.sports_score_rounded, c.success),
        'participants' => (Icons.groups_rounded, const Color(0xFF8B5CF6)),
        'scoring' => (Icons.sports_soccer_rounded, c.accent),
        'interval' => (Icons.pause_circle_filled_rounded, c.warning),
        'highlights' => (Icons.movie_filter_rounded, c.live),
        'correction' => (Icons.edit_note_rounded, c.warning),
        'summary' => (Icons.summarize_rounded, c.brand),
        _ => (Icons.notifications_rounded, c.ink2),
      };

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final value = ref.watch(notificationsProvider);
    ref.listen(notificationsProvider, (_, next) {
      final list = next.value;
      if (list != null) _markSeen(list);
    });
    if (value.hasValue) WidgetsBinding.instance.addPostFrameCallback((_) => _markSeen(value.value!));

    return Scaffold(
      appBar: AppBar(
        title: Text(tr('Notifications', 'Notifications')),
        actions: [
          IconButton(
            tooltip: tr('Alert settings', 'Réglages des alertes'),
            onPressed: () => context.push('/settings?section=alerts'),
            icon: const Icon(Icons.tune_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(notificationsProvider.future),
        child: AsyncView<List<Json>>(
          value: value,
          onRetry: () => ref.invalidate(notificationsProvider),
          builder: (list) {
            if (list.isEmpty) {
              return ListView(physics: const AlwaysScrollableScrollPhysics(), children: [
                const SizedBox(height: 60),
                StateView.empty(
                  tr('No notifications yet', 'Aucune notification'),
                  icon: Icons.notifications_none_rounded,
                  message: tr('Follow teams and turn on alerts to hear about kickoffs and results.',
                      'Suivez des équipes et activez les alertes pour être prévenu des matchs et résultats.'),
                  action: tr('Choose alerts', 'Choisir les alertes'),
                  onAction: () => context.push('/settings?section=alerts'),
                ),
              ]);
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
              itemCount: list.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final n = list[i];
                final type = str(n['type']);
                final (icon, color) = _style(type, c);
                final created = Fmt.parse(asString(n['createdAt']));
                final path = str(n['path']);
                final unread = _seenBefore == null || str(n['createdAt']).compareTo(_seenBefore!) > 0;
                final matchId = path.startsWith('/app/match/') ? path.substring('/app/match/'.length).split(RegExp(r'[?#]')).first : null;
                return FsCard(
                  onTap: matchId == null || matchId.isEmpty ? null : () => context.push('/match/${Uri.encodeComponent(matchId)}'),
                  padding: const EdgeInsets.all(14),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: color.withValues(alpha: 0.13), borderRadius: BorderRadius.circular(14)),
                      child: Icon(icon, color: color, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Expanded(
                            child: Text(str(n['title']),
                                maxLines: 2, overflow: TextOverflow.ellipsis, style: context.text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                          ),
                          if (unread) Container(width: 8, height: 8, decoration: const BoxDecoration(color: FsColors.orange, shape: BoxShape.circle)),
                        ]),
                        if (str(n['body']).isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(str(n['body']), style: context.text.bodyMedium),
                        ],
                        if (created != null) ...[
                          const SizedBox(height: 6),
                          Text(Fmt.ago(created), style: context.text.bodySmall),
                        ],
                      ]),
                    ),
                    if (matchId != null) Padding(padding: const EdgeInsets.only(left: 4), child: Icon(Icons.chevron_right_rounded, color: c.ink3)),
                  ]),
                ).entrance(i);
              },
            );
          },
        ),
      ),
    );
  }
}
