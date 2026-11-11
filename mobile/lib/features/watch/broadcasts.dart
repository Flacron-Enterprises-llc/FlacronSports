import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';

/// Listings name countries in English; the viewer's country arrives as an ISO code.
const _countryNames = {
  'US': 'United States', 'GB': 'United Kingdom', 'UK': 'United Kingdom', 'FR': 'France', 'DE': 'Germany', 'ES': 'Spain', 'IT': 'Italy',
  'PT': 'Portugal', 'NL': 'Netherlands', 'BE': 'Belgium', 'CH': 'Switzerland', 'AT': 'Austria', 'IE': 'Ireland', 'CA': 'Canada',
  'MX': 'Mexico', 'BR': 'Brazil', 'AR': 'Argentina', 'AU': 'Australia', 'NZ': 'New Zealand', 'IN': 'India', 'PK': 'Pakistan',
  'BD': 'Bangladesh', 'LK': 'Sri Lanka', 'ZA': 'South Africa', 'NG': 'Nigeria', 'KE': 'Kenya', 'GH': 'Ghana', 'CM': 'Cameroon',
  'CI': 'Ivory Coast', 'SN': 'Senegal', 'MA': 'Morocco', 'DZ': 'Algeria', 'TN': 'Tunisia', 'EG': 'Egypt', 'CD': 'DR Congo',
  'SA': 'Saudi Arabia', 'AE': 'United Arab Emirates', 'QA': 'Qatar', 'TR': 'Turkey', 'GR': 'Greece', 'PL': 'Poland', 'SE': 'Sweden',
  'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland', 'RU': 'Russia', 'UA': 'Ukraine', 'JP': 'Japan', 'KR': 'South Korea', 'CN': 'China',
  'HK': 'Hong Kong', 'SG': 'Singapore', 'MY': 'Malaysia', 'ID': 'Indonesia', 'PH': 'Philippines', 'TH': 'Thailand', 'VN': 'Vietnam',
  'CO': 'Colombia', 'CL': 'Chile', 'PE': 'Peru', 'UY': 'Uruguay', 'HT': 'Haiti', 'JM': 'Jamaica', 'CZ': 'Czech Republic', 'HU': 'Hungary',
  'RO': 'Romania', 'HR': 'Croatia', 'RS': 'Serbia', 'IL': 'Israel',
};

String? countryName(String? code) => code == null ? null : _countryNames[code.toUpperCase()];

class ChannelLogo extends StatelessWidget {
  const ChannelLogo({super.key, this.url, this.size = 24});
  final String? url;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final fallback = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: c.surfaceMuted, shape: BoxShape.circle),
      child: Icon(Icons.tv_rounded, size: size * 0.55, color: c.ink3),
    );
    if (url == null || url!.isEmpty) return fallback;
    return ClipOval(
      child: Container(
        width: size,
        height: size,
        color: Colors.white,
        child: CachedNetworkImage(imageUrl: url!, fit: BoxFit.contain, errorWidget: (_, _, _) => fallback, placeholder: (_, _) => fallback),
      ),
    );
  }
}

/// The match page's TV listings: grouped by country, the viewer's country first.
class BroadcastGroups extends StatefulWidget {
  const BroadcastGroups({super.key, required this.broadcasts, this.viewerCountry});
  final List<Json> broadcasts;
  final String? viewerCountry;

  @override
  State<BroadcastGroups> createState() => _BroadcastGroupsState();
}

class _BroadcastGroupsState extends State<BroadcastGroups> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final viewer = countryName(widget.viewerCountry);
    final groups = <String?, List<Json>>{};
    final seen = <String>{};
    for (final b in widget.broadcasts) {
      final key = '${b['country']}:${b['channel']}';
      if (!seen.add(key)) continue;
      groups.putIfAbsent(asString(b['country']), () => []).add(b);
    }
    int rank(String? country) => country == null ? 2 : (country == viewer ? 0 : 1);
    final ordered = groups.entries.toList()
      ..sort((a, b) {
        final r = rank(a.key).compareTo(rank(b.key));
        return r != 0 ? r : (a.key ?? '').compareTo(b.key ?? '');
      });
    final shown = _expanded ? ordered : ordered.take(6).toList();
    final channelCount = ordered.fold<int>(0, (n, g) => n + g.value.length);
    final countries = ordered.where((g) => g.key != null).length;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(child: Text(tr('TV listings', 'Diffusions TV'), style: TextStyle(fontWeight: FontWeight.w800, color: c.ink))),
        Text(tr('$channelCount channels · $countries countries', '$channelCount chaînes · $countries pays'), style: TextStyle(fontSize: 11.5, color: c.ink3)),
      ]),
      const SizedBox(height: 10),
      for (final g in shown)
        Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: g.key != null && g.key == viewer ? c.accent : c.line, width: g.key == viewer ? 1.4 : 1),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(g.key ?? tr('Other countries', 'Autres pays'), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: c.ink))),
              if (g.key != null && g.key == viewer) Pill(tr('Your country', 'Votre pays')),
            ]),
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final ch in (g.value..sort((a, b) => str(a['channel']).compareTo(str(b['channel'])))))
                Container(
                  padding: const EdgeInsets.fromLTRB(3, 3, 10, 3),
                  decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    ChannelLogo(url: asString(ch['logoUrl']), size: 22),
                    const SizedBox(width: 6),
                    Text(str(ch['channel']), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c.ink)),
                  ]),
                ),
            ]),
          ]),
        ),
      if (ordered.length > 6)
        TextButton(
          onPressed: () => setState(() => _expanded = !_expanded),
          child: Text(_expanded ? tr('Show fewer', 'Afficher moins') : tr('Show all ${ordered.length} countries', 'Afficher les ${ordered.length} pays')),
        ),
    ]);
  }
}

/// One card per game with its channels (ListingList / groupListings).
class ListingCard extends StatelessWidget {
  const ListingCard({super.key, required this.game, required this.channels, this.viewerCountry});
  final Json game;
  final List<Json> channels;
  final String? viewerCountry;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final start = Fmt.parse(asString(game['startUTC']));
    final matchId = asString(game['matchId']);
    final viewer = countryName(viewerCountry);
    return FsCard(
      onTap: matchId == null ? null : () => context.push('/match/${Uri.encodeComponent(matchId)}'),
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Sport.iconOf(asString(game['sportId'])), size: 14, color: c.ink3),
          const SizedBox(width: 6),
          if (start != null) Text('${Fmt.relativeDay(start)} · ${Fmt.time(start)}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c.ink2)),
          const Spacer(),
          if (matchId != null) Icon(Icons.chevron_right_rounded, size: 18, color: c.ink3),
        ]),
        const SizedBox(height: 6),
        Text(str(game['eventName']), maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, fontSize: 15, color: c.ink)),
        const SizedBox(height: 10),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final ch in channels)
            Container(
              padding: const EdgeInsets.fromLTRB(3, 3, 10, 3),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: ch['country'] != null && ch['country'] == viewer ? c.accent : c.line),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                ChannelLogo(url: asString(ch['logoUrl']), size: 22),
                const SizedBox(width: 6),
                Text(str(ch['channel']), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.ink)),
                if (ch['country'] != null) Text(' ${ch['country']}', style: TextStyle(fontSize: 11.5, color: c.ink3)),
              ]),
            ),
        ]),
      ]),
    );
  }

  /// groupListings: one entry per game, keyed by match id or event name + start.
  static List<(Json game, List<Json> channels)> group(List<Json> broadcasts) {
    final map = <String, (Json, List<Json>)>{};
    for (final b in broadcasts) {
      final key = asString(b['matchId']) ?? '${b['eventName']}|${b['startUTC']}';
      map.putIfAbsent(key, () => (b, <Json>[])).$2.add(b);
    }
    return map.values.toList();
  }
}

/// Play overlay used by every video thumbnail.
class PlayBadge extends StatelessWidget {
  const PlayBadge({super.key, this.size = 52, this.live = false});
  final double size;
  final bool live;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: live ? const Color(0xFFC8102E) : FsColors.orange,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.35), blurRadius: 16, offset: const Offset(0, 6))],
      ),
      child: Icon(Icons.play_arrow_rounded, color: Colors.white, size: size * 0.58),
    );
  }
}

/// Big 16:9 video tile with thumbnail, play badge and caption.
class VideoTile extends StatelessWidget {
  const VideoTile({super.key, required this.title, this.subtitle, this.meta, this.thumbnailUrl, required this.onPlay, this.onTitle, this.live = false, this.badge});
  final String title;
  final String? subtitle, meta, thumbnailUrl;
  final VoidCallback onPlay;
  final VoidCallback? onTitle;
  final bool live;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return FsCard(
      padding: EdgeInsets.zero,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Pressable(
          onTap: onPlay,
          child: ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: Stack(fit: StackFit.expand, children: [
                if (thumbnailUrl != null && thumbnailUrl!.isNotEmpty)
                  CachedNetworkImage(imageUrl: thumbnailUrl!, fit: BoxFit.cover, errorWidget: (_, _, _) => _thumbFallback(context))
                else
                  _thumbFallback(context),
                const DecoratedBox(
                  decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Color(0xAA000000)])),
                ),
                Center(child: PlayBadge(live: live)),
                if (badge != null || live)
                  Positioned(left: 10, top: 10, child: Pill(badge ?? tr('LIVE', 'DIRECT'), live: live, color: Colors.white, background: Colors.black.withValues(alpha: 0.55))),
              ]),
            ),
          ),
        ),
        Pressable(
          onTap: onTitle ?? onPlay,
          haptic: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, fontSize: 15, color: c.ink, height: 1.25)),
              if (subtitle != null) ...[const SizedBox(height: 3), Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: c.ink3))],
              if (meta != null) ...[const SizedBox(height: 2), Text(meta!, style: TextStyle(fontSize: 11.5, color: c.ink3))],
            ]),
          ),
        ),
      ]),
    );
  }

  static Widget _thumbFallback(BuildContext context) => Container(
        decoration: BoxDecoration(gradient: LinearGradient(colors: [context.fs.heroStart, context.fs.heroEnd])),
        child: const Center(child: Icon(Icons.movie_rounded, color: Colors.white24, size: 48)),
      );
}

/// Lead clip order on the web: live, then highlight, then goal.
Json? leadClip(List<Json> videos) {
  for (final kind in ['live', 'highlight', 'goal']) {
    final v = videos.where((x) => x['kind'] == kind).firstOrNull;
    if (v != null) return v;
  }
  return null;
}

void playClip(BuildContext context, String clipId, String title) =>
    context.push('/video?clip=$clipId&title=${Uri.encodeComponent(title)}');

void playMatchHighlight(BuildContext context, String matchId, String title) =>
    context.push('/video?match=${Uri.encodeComponent(matchId)}&title=${Uri.encodeComponent(title)}');
