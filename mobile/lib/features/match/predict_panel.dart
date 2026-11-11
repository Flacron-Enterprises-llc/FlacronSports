import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/i18n.dart';
import '../../core/theme/app_theme.dart';
import '../../models/json.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';
import 'chat_panel.dart';
import 'match_data.dart';
import 'match_detail_tabs.dart';
import 'match_sections.dart';

final _myPredictionProvider = FutureProvider.autoDispose.family<Json?, String>((ref, matchId) async {
  final res = asMap(await api.get('/predictions', query: {'matchId': matchId}));
  return res['prediction'] is Map ? asMap(res['prediction']) : null;
});

final _entrantsProvider = FutureProvider.autoDispose.family<List<String>, String>((ref, matchId) async {
  final res = asMap(await api.get('/predictions/entrants', query: {'matchId': matchId}));
  return asStringList(res['entrants']);
});

/// The prediction game for this match (Predictions in match-community.tsx).
class PredictTab extends ConsumerStatefulWidget {
  const PredictTab({super.key, required this.event});
  final SportEvent event;

  @override
  ConsumerState<PredictTab> createState() => _PredictTabState();
}

class _PredictTabState extends ConsumerState<PredictTab> {
  int _home = 0, _away = 0;
  final _podium = <String?>[null, null, null];
  bool _busy = false;

  SportEvent get e => widget.event;

  Future<void> _send(Json pick) async {
    if (!await ensureGuidelines(context)) return;
    setState(() => _busy = true);
    try {
      await api.post('/predictions', body: {'matchId': e.id, ...pick});
      HapticFeedback.heavyImpact();
      ref.invalidate(_myPredictionProvider(e.id));
      if (mounted) toast(context, tr('Prediction saved. Good luck!', 'Pronostic enregistré. Bonne chance !'));
    } catch (err) {
      if (err is ApiException && err.code == 'guidelines_required' && mounted) {
        setState(() => _busy = false);
        if (await ensureGuidelines(context, force: true)) return _send(pick);
        return;
      }
      if (!mounted) return;
      final code = err is ApiException ? err.code : null;
      toast(
        context,
        switch (code) {
          'prediction_locked' => tr('Predictions are closed for this game.', 'Les pronostics sont fermés pour ce match.'),
          'duplicate_prediction' => tr('You have already made a prediction for this game.', 'Vous avez déjà fait un pronostic pour ce match.'),
          'not_supported' => tr('This game does not take predictions.', "Ce match n'accepte pas de pronostics."),
          'invalid_score' => tr('That score is not possible here.', "Ce score n'est pas possible ici."),
          _ => errorText(err),
        },
        error: true,
      );
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final kind = predictionKind(e)!;
    final open = predictionOpen(e);
    final mine = ref.watch(_myPredictionProvider(e.id));
    final title = switch (kind) {
      'podium' => tr('Pick the podium', 'Pronostiquez le podium'),
      'winner' => tr('Pick the winner', 'Pronostiquez le vainqueur'),
      _ => tr('Predict the score', 'Pronostiquez le score'),
    };
    return TabScroll(
      onRefresh: () async => ref.invalidate(_myPredictionProvider(e.id)),
      children: [
        _Header(title: title, open: open),
        mine.when(
          loading: () => const Skeleton(height: 160, radius: 18),
          error: (err, _) => ErrorView(error: err, onRetry: () => ref.invalidate(_myPredictionProvider(e.id)), compact: true),
          data: (pick) {
            if (pick != null) return _OwnPick(pick: pick, event: e);
            if (!open) {
              return Panel(child: Text(tr('Predictions are closed for this game.', 'Les pronostics sont fermés pour ce match.'), style: context.text.bodyMedium));
            }
            return switch (kind) {
              'score' => _scoreForm(),
              'winner' => _winnerForm(),
              _ => _podiumForm(),
            };
          },
        ),
        Panel(
          title: tr('How points work', 'Comment marquer des points'),
          icon: Icons.rule_rounded,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _rule(tr('Exact score: 5 points', 'Score exact : 5 points')),
            _rule(tr('Right outcome: 2 points', 'Bonne issue : 2 points')),
            _rule(tr('Right winner: 3 points', 'Bon vainqueur : 3 points')),
            _rule(tr('Podium: 4 points for each driver in the exact place, 2 for one on the podium in another place', 'Podium : 4 points par pilote à la bonne place, 2 pour un pilote sur le podium à une autre place')),
            _rule(tr('One pick per game. Picks close at the start and cannot be changed.', 'Un pronostic par match. Fermeture au coup d’envoi, sans modification possible.')),
          ]),
        ),
        Pressable(
          onTap: () => context.push('/predictions'),
          child: FsCard(
            child: Row(children: [
              Icon(Icons.leaderboard_rounded, color: context.fs.accent),
              const SizedBox(width: 12),
              Expanded(child: Text(tr('Leaderboard, groups and your picks', 'Classement, groupes et vos pronostics'), style: const TextStyle(fontWeight: FontWeight.w700))),
              Icon(Icons.chevron_right_rounded, color: context.fs.ink3),
            ]),
          ),
        ),
      ],
    );
  }

  Widget _rule(String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.only(top: 6), child: Icon(Icons.circle, size: 6, color: context.fs.accent)),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: context.text.bodyMedium)),
        ]),
      );

  Widget _scoreForm() {
    final rule = scoreRules[e.sportId]!;
    final level = _home == _away && !rule.canEndLevel;
    Widget side(Participant p, int value, ValueChanged<int> set) {
      final c = context.fs;
      return Expanded(
        child: Column(children: [
          Crest(url: p.badgeUrl, name: p.name, size: 44),
          const SizedBox(height: 8),
          Text(p.name, maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, color: c.ink)),
          Text(scoreUnitLabel(rule.unit), style: context.text.bodySmall),
          const SizedBox(height: 10),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            _Step(icon: Icons.remove_rounded, onTap: value > 0 ? () => set(value - 1) : null),
            SizedBox(
              width: 56,
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 180),
                transitionBuilder: (child, a) => ScaleTransition(scale: a, child: child),
                child: Text('$value', key: ValueKey(value), textAlign: TextAlign.center, style: TextStyle(fontFamily: 'Sora', fontSize: 34, fontWeight: FontWeight.w800, color: c.ink)),
              ),
            ),
            _Step(icon: Icons.add_rounded, onTap: value < rule.max ? () => set(value + 1) : null),
          ]),
        ]),
      );
    }

    return Panel(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          side(e.participants[0], _home, (v) => setState(() => _home = v)),
          Padding(padding: const EdgeInsets.only(top: 90), child: Text('–', style: TextStyle(fontSize: 28, color: context.fs.ink3))),
          side(e.participants[1], _away, (v) => setState(() => _away = v)),
        ]),
        if (level)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(tr('This sport cannot end level. Pick a winner.', 'Ce sport ne peut pas finir sur une égalité.'), textAlign: TextAlign.center, style: TextStyle(color: context.fs.warning)),
          ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _busy || level ? null : () => _send({'home': _home, 'away': _away}),
          icon: const Icon(Icons.check_rounded),
          label: Text(tr('Predict', 'Pronostiquer')),
        ),
      ]),
    );
  }

  Widget _winnerForm() {
    final c = context.fs;
    final combat = e.sportId == 'combat-sports';
    return Panel(
      title: combat ? tr('Who wins the bout?', 'Qui gagne le combat ?') : tr('Who wins?', 'Qui gagne ?'),
      child: Row(children: [
        for (final p in e.participants.take(2)) ...[
          Expanded(
            child: Pressable(
              onTap: _busy ? null : () => _send({'winner': p.rawName}),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 10),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: c.line), color: c.surfaceMuted),
                child: Column(children: [
                  Crest(url: p.badgeUrl, name: p.name, size: 46),
                  const SizedBox(height: 10),
                  Text(p.name, maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w800, color: c.ink)),
                ]),
              ),
            ),
          ),
          if (p == e.participants.first) const SizedBox(width: 12),
        ],
      ]),
    );
  }

  Widget _podiumForm() {
    final entrants = ref.watch(_entrantsProvider(e.id));
    return entrants.when(
      loading: () => const Skeleton(height: 200, radius: 18),
      error: (err, _) => ErrorView(error: err, onRetry: () => ref.invalidate(_entrantsProvider(e.id)), compact: true),
      data: (names) {
        if (names.length < 3) {
          return Panel(child: Text(tr('The field for this race is not known yet, so the podium cannot be picked.', "Les engagés de cette course ne sont pas encore connus."), style: context.text.bodyMedium));
        }
        final places = podiumPlaces;
        final complete = _podium.every((p) => p != null);
        return Panel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (var i = 0; i < 3; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: DropdownButtonFormField<String>(
                  initialValue: _podium[i],
                  isExpanded: true,
                  decoration: InputDecoration(labelText: places[i], prefixIcon: Icon(Icons.emoji_events_rounded, color: [const Color(0xFFE8B931), const Color(0xFFB8C2CC), const Color(0xFFCD8B4E)][i])),
                  items: [
                    for (final n in names)
                      DropdownMenuItem(value: n, enabled: !_podium.contains(n) || _podium[i] == n, child: Text(n, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: (v) => setState(() => _podium[i] = v),
                ),
              ),
            FilledButton.icon(
              onPressed: _busy || !complete ? null : () => _send({'podium': _podium.cast<String>()}),
              icon: const Icon(Icons.check_rounded),
              label: Text(tr('Predict', 'Pronostiquer')),
            ),
          ]),
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.title, required this.open});
  final String title;
  final bool open;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(colors: [context.fs.heroStart, context.fs.heroEnd], begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      child: Row(children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(color: FsColors.orange.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(14)),
          child: const Icon(Icons.insights_rounded, color: FsColors.orange),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontFamily: 'Sora', fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white)),
            const SizedBox(height: 2),
            Text(open ? tr('Free for every member. Picks close at the start.', 'Gratuit pour tous les membres. Fermeture au départ.') : tr('Closed', 'Fermé'),
                style: const TextStyle(color: Colors.white70, fontSize: 13)),
          ]),
        ),
      ]),
    );
  }
}

class _OwnPick extends StatelessWidget {
  const _OwnPick({required this.pick, required this.event});
  final Json pick;
  final SportEvent event;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final settled = asBool(pick['settled']);
    final voided = asBool(pick['voided']);
    return Panel(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Icon(Icons.check_circle_rounded, color: c.success),
          const SizedBox(width: 8),
          Text(tr('Your prediction', 'Votre pronostic'), style: TextStyle(fontWeight: FontWeight.w800, color: c.ink)),
        ]),
        const SizedBox(height: 10),
        Text(pickWords(pick, event.isDuel ? event.home?.name : null, event.isDuel ? event.away?.name : null),
            style: TextStyle(fontFamily: 'Sora', fontSize: 17, fontWeight: FontWeight.w700, color: c.ink)),
        const SizedBox(height: 10),
        if (voided)
          Pill(tr('Void', 'Annulé'))
        else if (settled)
          Pill(tr('${pick['points'] ?? 0} points', '${pick['points'] ?? 0} points'), color: c.success, background: c.success.withValues(alpha: 0.12), icon: Icons.stars_rounded)
        else
          Pill(tr('Waiting for the result', 'En attente du résultat'), icon: Icons.hourglass_top_rounded),
      ]),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.icon, this.onTap});
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Pressable(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(shape: BoxShape.circle, color: onTap == null ? c.surfaceMuted : c.accent.withValues(alpha: 0.14)),
        child: Icon(icon, size: 20, color: onTap == null ? c.ink3 : c.accent),
      ),
    );
  }
}
