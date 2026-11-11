import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';
import '../../widgets/event_tile.dart';
import '../watch/broadcasts.dart';
import 'match_data.dart';
import 'match_detail_tabs.dart';
import 'match_sections.dart';

/// Viewing options for this match (ViewingPanel + MatchPlayer on the web).
class MatchWatchTab extends ConsumerStatefulWidget {
  const MatchWatchTab({super.key, required this.event});
  final SportEvent event;

  @override
  ConsumerState<MatchWatchTab> createState() => _MatchWatchTabState();
}

class _MatchWatchTabState extends ConsumerState<MatchWatchTab> {
  bool _requested = false;

  @override
  Widget build(BuildContext context) {
    final e = widget.event;
    final lowData = ref.watch(prefsValueProvider).lowData;
    // Low-data mode checks only when asked, as on the web.
    if (lowData && !_requested) {
      return TabScroll(children: [
        Panel(
          title: tr('Viewing options', 'Options de visionnage'),
          icon: Icons.play_circle_rounded,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(tr('Low data mode is on, so video is checked only when you ask.', 'Le mode données réduites est activé : la vidéo est vérifiée seulement à votre demande.'), style: context.text.bodyMedium),
            const SizedBox(height: 12),
            FilledButton.icon(onPressed: () => setState(() => _requested = true), icon: const Icon(Icons.play_circle_rounded), label: Text(tr('Check viewing options', 'Vérifier les options'))),
          ]),
        ),
      ]);
    }
    final v = ref.watch(viewingProvider(e.id));
    return AsyncView<Json>(
      value: v,
      compact: true,
      onRetry: () => ref.invalidate(viewingProvider(e.id)),
      loading: const SkeletonList(count: 3, height: 120),
      builder: (data) {
        final options = asMapList(data['options']);
        final clips = asMapList(data['clips']);
        final video = data['video'] is Map ? asMap(data['video']) : null;
        final lead = leadClip(clips);
        final official = options.where((o) => o['action'] == 'official_broadcaster' && o['url'] != null).firstOrNull;
        final following = options.any((o) => o['action'] == 'follow_live');
        final broadcasts = asMapList(data['broadcasts']);
        final streaming = clips.any((c) => c['kind'] == 'live');
        final title = e.eventName?.isNotEmpty == true ? e.eventName! : e.participants.map((p) => p.name).join(' vs ');
        final parts = clips.where((c) => c['kind'] == 'highlight').toList();
        final goals = clips.where((c) => c['kind'] == 'goal').toList();
        final page = clips.where((c) => c['kind'] == 'match').firstOrNull;
        final nothing = official == null && video == null && clips.isEmpty && broadcasts.isEmpty;
        return TabScroll(
          onRefresh: () async => ref.invalidate(viewingProvider(e.id)),
          children: [
            if (lead != null)
              VideoTile(
                title: title,
                subtitle: lead['kind'] == 'live' ? tr('Live stream', 'Flux en direct') : str(lead['label']),
                thumbnailUrl: asString(data['clipThumbnail']),
                live: lead['kind'] == 'live',
                onPlay: () => playClip(context, str(lead['id']), title),
              ),
            if (clips.length > 1)
              Panel(
                title: tr('More videos', 'Autres vidéos'),
                icon: Icons.video_library_rounded,
                child: Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final s in clips.where((c) => c['kind'] == 'live')) _VideoChip(label: tr('Live stream', 'Flux en direct'), onTap: () => playClip(context, str(s['id']), title), live: true),
                  for (var i = 0; i < parts.length; i++) _VideoChip(label: tr('Highlights ${i + 1}', 'Résumé ${i + 1}'), onTap: () => playClip(context, str(parts[i]['id']), title)),
                  if (goals.isNotEmpty)
                    SpoilerGuard(
                      label: tr('Show goals', 'Afficher les buts'),
                      child: Wrap(spacing: 8, runSpacing: 8, children: [for (final g in goals) _VideoChip(label: str(g['label']), onTap: () => playClip(context, str(g['id']), title))]),
                    ),
                  if (page != null)
                    SpoilerGuard(
                      label: tr('Show full match view', 'Afficher le match complet'),
                      child: _VideoChip(label: tr('Full match view', 'Match complet'), onTap: () => playClip(context, str(page['id']), title)),
                    ),
                ]),
              ),
            if (video != null)
              VideoTile(
                title: title,
                subtitle: tr('From ${video['channel']}', 'De ${video['channel']}'),
                thumbnailUrl: e.thumbnailUrl ?? 'https://i.ytimg.com/vi/${video['youtubeId']}/hqdefault.jpg',
                badge: 'YouTube',
                onPlay: () => playMatchHighlight(context, e.id, title),
              ),
            Panel(
              title: tr('Viewing options', 'Options de visionnage'),
              icon: Icons.play_circle_rounded,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (streaming) ...[
                  _Line(icon: Icons.sensors_rounded, color: context.fs.live, text: tr('Live stream', 'Flux en direct'), bold: true),
                  Text(
                    tr('A live stream is listed for this game above. Listed by our video source; a stream can end or change at any time.',
                        'Un flux en direct est indiqué ci-dessus. Il provient de notre source vidéo et peut changer à tout moment.'),
                    style: context.text.bodySmall,
                  ),
                  const SizedBox(height: 10),
                ],
                if (video != null || clips.any((c) => c['kind'] != 'live'))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(tr('Video for this game is shown above.', 'La vidéo de ce match est affichée ci-dessus.'), style: context.text.bodyMedium),
                  ),
                if (broadcasts.isNotEmpty) BroadcastGroups(broadcasts: broadcasts, viewerCountry: asString(data['viewerCountry'])),
                if (nothing)
                  Text(
                    tr('No authorized video source is available for this event, so nothing can be played here.',
                        "Aucune source vidéo autorisée n'est disponible pour cet événement."),
                    style: context.text.bodyMedium,
                  ),
                if (official != null) ...[
                  const SizedBox(height: 10),
                  FilledButton.icon(
                    onPressed: () => openExternal(str(official['url'])),
                    icon: const Icon(Icons.open_in_new_rounded),
                    label: Text(tr('Official broadcaster', 'Diffuseur officiel')),
                  ),
                ],
                if (following) ...[
                  const SizedBox(height: 10),
                  _Line(
                    icon: Icons.sensors_rounded,
                    color: context.fs.live,
                    text: tr('Follow live: the score updates here while the game is on.', 'Suivez en direct : le score se met à jour ici pendant le match.'),
                    bold: true,
                  ),
                ],
              ]),
            ),
            Text(
              tr('FlacronSport subscriptions do not guarantee universal broadcast access or replace broadcaster subscriptions.',
                  'Les abonnements FlacronSport ne garantissent pas un accès universel aux diffusions et ne remplacent pas les abonnements des diffuseurs.'),
              style: context.text.bodySmall,
            ),
          ],
        );
      },
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.icon, required this.color, required this.text, this.bold = false});
  final IconData icon;
  final Color color;
  final String text;
  final bool bold;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: TextStyle(fontWeight: bold ? FontWeight.w700 : FontWeight.w500, color: context.fs.ink))),
        ]),
      );
}

class _VideoChip extends StatelessWidget {
  const _VideoChip({required this.label, required this.onTap, this.live = false});
  final String label;
  final VoidCallback onTap;
  final bool live;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Pressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: live ? c.live.withValues(alpha: 0.12) : c.surfaceMuted,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: live ? c.live.withValues(alpha: 0.4) : c.line),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.play_arrow_rounded, size: 16, color: live ? c.live : FsColors.orange),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: c.ink)),
        ]),
      ),
    );
  }
}
