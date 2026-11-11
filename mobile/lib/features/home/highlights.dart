import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';

/// One video tile from GET /watch: a clip (ScoreBat) or an approved YouTube highlight.
class VideoItem {
  VideoItem.clip(Json j)
      : id = str(j['id']),
        isClip = true,
        title = str(j['title']),
        competition = str(j['competition']),
        thumbnail = asString(j['thumbnailUrl']),
        date = asString(j['dateUTC']),
        matchId = asString(j['matchId']),
        sportId = 'football';

  VideoItem.highlight(Json j)
      : id = str(j['youtubeId']),
        isClip = false,
        title = str(j['title']),
        competition = str(j['competition']),
        thumbnail = asString(j['thumbnailUrl']) ?? 'https://i.ytimg.com/vi/${str(j['youtubeId'])}/hqdefault.jpg',
        date = asString(j['dateUTC']),
        matchId = asString(j['matchId']),
        sportId = asString(j['sportId']);

  final String id, title, competition;
  final bool isClip;
  final String? thumbnail, date, matchId, sportId;

  String get route => isClip
      ? '/video?clip=${Uri.encodeComponent(id)}&title=${Uri.encodeComponent(title)}'
      : '/video?match=${Uri.encodeComponent(matchId ?? '')}&title=${Uri.encodeComponent(title)}';

  /// Clips first, then highlights (highlights-section.tsx).
  static List<VideoItem> fromWatch(Json feed, {int? limit}) {
    final items = [
      ...asMapList(feed['clips']).map(VideoItem.clip),
      ...asMapList(feed['highlights']).where((h) => asString(h['matchId']) != null).map(VideoItem.highlight),
    ];
    return limit == null ? items : items.take(limit).toList();
  }
}

class VideoTile extends StatelessWidget {
  const VideoTile({super.key, required this.item, this.width = 240});
  final VideoItem item;
  final double width;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final d = Fmt.parse(item.date);
    return Pressable(
      onTap: () => context.push(item.route),
      child: SizedBox(
        width: width,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: Stack(fit: StackFit.expand, children: [
                if (item.thumbnail != null)
                  CachedNetworkImage(
                    imageUrl: item.thumbnail!,
                    fit: BoxFit.cover,
                    placeholder: (_, _) => Container(color: c.surfaceMuted),
                    errorWidget: (_, _, _) => Container(color: c.surfaceMuted, child: Icon(Sport.iconOf(item.sportId), color: c.ink3)),
                  )
                else
                  Container(
                    decoration: BoxDecoration(gradient: LinearGradient(colors: [c.heroStart, c.heroEnd])),
                    child: Icon(Sport.iconOf(item.sportId), color: Colors.white54, size: 36),
                  ),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Color(0xAA000000)]),
                  ),
                ),
                Center(
                  child: Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: FsColors.orange,
                      shape: BoxShape.circle,
                      boxShadow: [BoxShadow(color: FsColors.orange.withValues(alpha: 0.45), blurRadius: 16)],
                    ),
                    child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 28),
                  ),
                ),
                Positioned(
                  left: 10,
                  bottom: 8,
                  right: 10,
                  child: Text(item.competition, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700)),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 8),
          Text(item.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: context.text.titleSmall),
          if (d != null) Text(Fmt.relativeDay(d), style: context.text.bodySmall),
        ]),
      ),
    );
  }
}

/// Horizontal carousel of video tiles.
class VideoCarousel extends StatelessWidget {
  const VideoCarousel({super.key, required this.items});
  final List<VideoItem> items;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 214,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (_, i) => VideoTile(item: items[i]).entrance(i),
      ),
    );
  }
}
