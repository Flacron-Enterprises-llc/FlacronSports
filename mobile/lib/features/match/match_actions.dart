import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api/api_client.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../widgets/common.dart';

/// Shares bytes of a PDF through the system sheet.
Future<void> sharePdf(Uint8List bytes, String fileName) async {
  final file = XFile.fromData(bytes, mimeType: 'application/pdf', name: fileName);
  await SharePlus.instance.share(ShareParams(files: [file], fileNameOverrides: [fileName], title: fileName));
}

/// POST an export endpoint and share the returned PDF (export-button.tsx).
Future<void> exportPdf(BuildContext context, {required String path, required Json body, required String fileName}) async {
  toast(context, tr('Preparing your PDF…', 'Préparation du PDF…'));
  try {
    final bytes = await api.bytes('POST', path, body: body);
    await sharePdf(bytes, fileName);
  } catch (e) {
    if (!context.mounted) return;
    var message = errorText(e);
    if (e is ApiException) {
      if (e.code == 'allowance_exhausted' || (e.status == 403 && e.code == null)) {
        message = tr('You have no export credits. Buy an export pack on the website.', "Vous n'avez plus de crédits d'export. Achetez un pack sur le site.");
      } else if (e.code == 'email_not_verified') {
        message = tr('Verify your email address to export.', 'Vérifiez votre adresse e-mail pour exporter.');
      } else if (e.code == 'exports_unavailable') {
        message = tr('Exports are unavailable right now.', 'Les exports sont indisponibles pour le moment.');
      }
    }
    toast(context, message, error: true);
  }
}

/// Share card flow (share-card-button.tsx): the score stays off unless turned on.
Future<void> showShareSheet(BuildContext context, {required String matchId, required bool hasResult}) {
  return showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (_) => _ShareSheet(matchId: matchId, hasResult: hasResult));
}

class _ShareSheet extends StatefulWidget {
  const _ShareSheet({required this.matchId, required this.hasResult});
  final String matchId;
  final bool hasResult;

  @override
  State<_ShareSheet> createState() => _ShareSheetState();
}

class _ShareSheetState extends State<_ShareSheet> {
  bool _reveal = false, _busy = false;
  Json? _card;

  Future<void> _create() async {
    setState(() => _busy = true);
    try {
      final res = asMap(await api.post('/share', body: {'matchId': widget.matchId, 'locale': AppLocale.code, 'reveal': widget.hasResult && _reveal}));
      setState(() => _card = res);
    } catch (e) {
      if (mounted) toast(context, tr("We couldn't create the share card.", "Impossible de créer la carte de partage."), error: true);
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final card = _card;
    final image = card == null ? null : (str(card['image']).startsWith('http') ? str(card['image']) : '${AppConfig.siteBase}${card['image']}');
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Icon(Icons.ios_share_rounded, color: c.accent),
            const SizedBox(width: 10),
            Text(tr('Share this game', 'Partager ce match'), style: context.text.titleLarge),
          ]),
          const SizedBox(height: 16),
          if (card == null) ...[
            if (widget.hasResult)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(14)),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr('Include the score', 'Inclure le score'), style: TextStyle(fontWeight: FontWeight.w700, color: c.ink)),
                      Text(tr('Off by default, so the card never spoils the result.', 'Désactivé par défaut pour ne rien gâcher.'), style: context.text.bodySmall),
                    ]),
                  ),
                  Switch(value: _reveal, onChanged: (v) => setState(() => _reveal = v)),
                ]),
              ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy ? null : _create,
              child: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white)) : Text(tr('Create share card', 'Créer la carte')),
            ),
          ] else ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: AspectRatio(
                aspectRatio: 1200 / 630,
                child: CachedNetworkImage(imageUrl: image!, fit: BoxFit.cover, placeholder: (_, _) => const Skeleton(height: 200), errorWidget: (_, _, _) => Container(color: FsColors.navy)),
              ),
            ),
            const SizedBox(height: 12),
            Text(tr('Your card is ready.', 'Votre carte est prête.'), style: context.text.bodyMedium),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () => SharePlus.instance.share(ShareParams(text: str(card['url']))),
              icon: const Icon(Icons.share_rounded),
              label: Text(tr('Share link', 'Partager le lien')),
            ),
          ],
        ]),
      ),
    );
  }
}
