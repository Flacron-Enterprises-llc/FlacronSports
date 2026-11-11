import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import '../../core/api/api_client.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../widgets/common.dart';

/// GET /api/watch/play: an approved embed for a clip or a match's highlight.
final _playProvider = FutureProvider.autoDispose.family<Json?, (String?, String?)>((ref, key) async {
  final res = asMap(await api.get('/watch/play', query: {'clip': key.$1, 'match': key.$2}));
  return res['video'] is Map ? asMap(res['video']) : null;
});

/// Full-screen player. The embed runs in an iframe on a page served from the
/// site's origin, which YouTube's privacy-enhanced player and ScoreBat accept.
class VideoScreen extends ConsumerStatefulWidget {
  const VideoScreen({super.key, this.clipId, this.matchId, this.title});
  final String? clipId;
  final String? matchId;
  final String? title;

  @override
  ConsumerState<VideoScreen> createState() => _VideoScreenState();
}

class _VideoScreenState extends ConsumerState<VideoScreen> {
  WebViewController? _controller;
  String? _loadedUrl;
  bool _pageLoading = true;

  @override
  void initState() {
    super.initState();
    SystemChrome.setPreferredOrientations(DeviceOrientation.values);
  }

  @override
  void dispose() {
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  String _html(String embedUrl) {
    final safe = const HtmlEscape(HtmlEscapeMode.attribute).convert(embedUrl);
    return '''<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}
.wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
iframe{width:100%;height:100%;border:0;max-height:100vh}</style></head>
<body><div class="wrap"><iframe src="$safe" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div></body></html>''';
  }

  WebViewController _build(String embedUrl) {
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) {
          if (mounted) setState(() => _pageLoading = false);
        },
        onNavigationRequest: (request) {
          // Keep the player in place; anything that tries to leave opens outside.
          final url = request.url;
          if (url.startsWith('about:') || url.startsWith('data:') || url == '${AppConfig.siteBase}/' || !request.isMainFrame) {
            return NavigationDecision.navigate;
          }
          openExternal(url);
          return NavigationDecision.prevent;
        },
      ));
    // Let the embed start playing without a second tap inside the frame.
    final platform = controller.platform;
    if (platform is AndroidWebViewController) {
      platform.setMediaPlaybackRequiresUserGesture(false);
    }
    controller.loadHtmlString(_html(embedUrl), baseUrl: '${AppConfig.siteBase}/');
    return controller;
  }

  @override
  Widget build(BuildContext context) {
    final key = (widget.clipId, widget.clipId == null ? widget.matchId : null);
    final v = ref.watch(_playProvider(key));
    final title = widget.title ?? tr('Video', 'Vidéo');
    final landscape = MediaQuery.orientationOf(context) == Orientation.landscape;

    Widget content;
    if (v.isLoading && !v.hasValue) {
      content = const Center(child: CircularProgressIndicator(color: FsColors.orange));
    } else if (v.hasError) {
      content = Theme(data: AppTheme.dark(), child: ErrorView(error: v.error!, onRetry: () => ref.invalidate(_playProvider(key))));
    } else if (v.value == null || str(v.value!['embedUrl']).isEmpty) {
      content = Theme(
        data: AppTheme.dark(),
        child: StateView(
          icon: Icons.videocam_off_rounded,
          title: tr('This video is no longer available.', "Cette vidéo n'est plus disponible."),
          message: tr('It may have been removed by its owner or may not be playable in your country.', "Elle a peut-être été retirée ou n'est pas disponible dans votre pays."),
        ),
      );
    } else {
      final url = str(v.value!['embedUrl']);
      if (_loadedUrl != url) {
        _loadedUrl = url;
        _pageLoading = true;
        _controller = _build(url);
      }
      content = Stack(children: [
        Center(
          child: AspectRatio(
            aspectRatio: landscape ? MediaQuery.sizeOf(context).aspectRatio : 16 / 9,
            child: WebViewWidget(controller: _controller!),
          ),
        ),
        if (_pageLoading) const Center(child: CircularProgressIndicator(color: FsColors.orange)),
      ]);
    }

    final embed = v.value == null ? null : asString(v.value!['embedUrl']);
    final youtubeId = v.value == null ? null : asString(v.value!['youtubeId']);
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: landscape
          ? null
          : AppBar(
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
              systemOverlayStyle: SystemUiOverlayStyle.light,
              title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 16, fontFamily: 'Sora', fontWeight: FontWeight.w700)),
              actions: [
                if (embed != null)
                  IconButton(
                    tooltip: tr('Open in browser', 'Ouvrir dans le navigateur'),
                    icon: const Icon(Icons.open_in_new_rounded),
                    onPressed: () => openExternal(youtubeId != null ? 'https://www.youtube.com/watch?v=$youtubeId' : embed),
                  ),
              ],
            ),
      body: SafeArea(
        top: !landscape,
        bottom: false,
        child: Column(children: [
          Expanded(child: content),
          if (!landscape && v.value != null)
            Padding(
              padding: EdgeInsets.fromLTRB(20, 12, 20, 16 + MediaQuery.paddingOf(context).bottom),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (v.value!['channel'] != null)
                  Text(tr('From ${v.value!['channel']}', 'De ${v.value!['channel']}'), style: const TextStyle(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 6),
                Text(
                  tr('Rotate your phone for full screen. The rights holder may limit some countries.', 'Tournez votre téléphone pour le plein écran. Le détenteur des droits peut limiter certains pays.'),
                  style: const TextStyle(color: Colors.white38, fontSize: 12),
                ),
              ]),
            ),
        ]),
      ),
    );
  }
}
