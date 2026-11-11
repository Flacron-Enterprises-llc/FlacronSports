import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/account.dart';
import '../../models/json.dart';
import '../../models/preferences.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';
import '../../widgets/event_tile.dart';

class _Turn {
  _Turn(this.id, this.question);
  final int id;
  String question;
  Json? answer;
  String? error;
  bool exhausted = false;
}

/// Conversation kept in memory for the session, per account (as the web does).
final Map<String, List<_Turn>> _sessionTurns = {};
const _maxKeptTurns = 50;

/// suggestionsFor in lib/assistant/suggestions.ts.
List<String> assistantSuggestions(Preferences prefs) {
  final team = prefs.favorites.isNotEmpty ? prefs.favorites.first : null;
  final sportId = prefs.leagues.isNotEmpty ? str(prefs.leagues.first['sportId']) : (prefs.players.isNotEmpty ? str(prefs.players.first['sportId']) : null);
  final name = Sport.byId(sportId)?.name.toLowerCase();
  final tips = <String>[
    if (team != null) ...[tr('$team latest result', '$team dernier résultat'), tr('$team next fixture', '$team prochain match')],
    if (name != null) ...[
      tr("Today's $name fixtures", "Matchs de $name aujourd'hui"),
      tr('Live $name right now', '$name en direct maintenant'),
      tr('Latest $name results', 'Derniers résultats de $name'),
    ],
    tr('What is offside?', "C'est quoi le hors-jeu ?"),
    tr('Arsenal latest result', 'Arsenal dernier résultat'),
    tr("Today's basketball fixtures", "Matchs de basketball aujourd'hui"),
  ];
  return tips.toSet().take(4).toList();
}

class AssistantScreen extends ConsumerStatefulWidget {
  const AssistantScreen({super.key});

  @override
  ConsumerState<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends ConsumerState<AssistantScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  late List<_Turn> _turns;
  bool _busy = false;
  String _uid = '';

  @override
  void initState() {
    super.initState();
    _uid = ref.read(authUserProvider).value?.uid ?? '';
    _turns = _sessionTurns[_uid] ?? [];
    _input.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _sessionTurns[_uid] = _turns.where((t) => t.answer != null).toList().reversed.take(_maxKeptTurns).toList().reversed.toList();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _toBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(_scroll.position.maxScrollExtent + 200, duration: const Duration(milliseconds: 380), curve: AppTheme.ease);
    });
  }

  Future<void> _ask(String text, {_Turn? retry}) async {
    final asked = text.trim();
    if (asked.length < 2 || _busy) return;
    if (asked.length > 300) {
      toast(context, tr('Keep it under 300 characters.', 'Moins de 300 caractères, s’il vous plaît.'), error: true);
      return;
    }
    HapticFeedback.lightImpact();
    final turn = retry ?? _Turn(DateTime.now().millisecondsSinceEpoch, asked);
    setState(() {
      if (retry == null) {
        _turns.add(turn);
      } else {
        turn
          ..error = null
          ..exhausted = false;
      }
      _busy = true;
    });
    _input.clear();
    _toBottom();
    try {
      final res = asMap(await api.post('/assistant', body: {'question': asked, 'locale': AppLocale.code}));
      turn.answer = asMap(res['answer']);
      if (res['balance'] is Map) ref.read(accountProvider.notifier).setAllowance(asMap(res['balance']));
    } on ApiException catch (e) {
      turn.exhausted = e.code == 'allowance_exhausted';
      turn.error = switch (e.code) {
        'allowance_exhausted' => tr(
            'You have no requests left. Your plan allowance resets next month, or you can add requests on the website. Nothing is charged automatically.',
            "Vous n'avez plus de demandes. Votre allocation se renouvelle le mois prochain, ou vous pouvez en ajouter sur le site. Rien n'est débité automatiquement."),
        'email_not_verified' => tr('Verify your email address first.', "Vérifiez d'abord votre adresse e-mail."),
        _ => tr('The assistant could not answer just now. Try again.', "L'assistant n'a pas pu répondre. Réessayez."),
      };
    } catch (_) {
      turn.error = tr('The assistant could not answer just now. Try again.', "L'assistant n'a pas pu répondre. Réessayez.");
    }
    if (!mounted) return;
    setState(() => _busy = false);
    _sessionTurns[_uid] = _turns.where((t) => t.answer != null).toList();
    _toBottom();
  }

  void _showAllowance(Account? account) {
    showModalBottomSheet<void>(context: context, builder: (_) => _AllowanceSheet(account: account));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final prefs = ref.watch(prefsValueProvider);
    final account = ref.watch(accountProvider).value;
    final tips = assistantSuggestions(prefs);
    final allowance = account?.allowance;

    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          Container(
            width: 34,
            height: 34,
            decoration: const BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: [FsColors.orange, FsColors.navy])),
            child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 18),
          ),
          const SizedBox(width: 10),
          Text(tr('Assistant', 'Assistant')),
        ]),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 10),
            child: Pressable(
              onTap: () => _showAllowance(account),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(999), border: Border.all(color: c.line)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.speed_rounded, size: 16, color: c.accent),
                  const SizedBox(width: 6),
                  Text(allowance == null ? '–' : '${allowance.remaining}', style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, color: c.ink)),
                  const SizedBox(width: 4),
                  Text(tr('left', 'restantes'), style: context.text.bodySmall),
                ]),
              ),
            ),
          ),
        ],
      ),
      body: Column(children: [
        if (allowance != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: allowance.limit == 0 ? 0 : (allowance.used / allowance.limit).clamp(0, 1).toDouble(),
                minHeight: 4,
              ),
            ),
          ),
        Expanded(
          child: _turns.isEmpty
              ? _Welcome(tips: tips, onPick: _ask)
              : ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  itemCount: _turns.length + 1,
                  itemBuilder: (context, i) {
                    if (i == _turns.length) {
                      if (_busy) return const SizedBox(height: 8);
                      return Padding(
                        padding: const EdgeInsets.only(left: 42, top: 4),
                        child: Wrap(spacing: 8, runSpacing: 8, children: [for (final t in tips) _TipChip(text: t, onTap: () => _ask(t))]),
                      ).animate().fadeIn(duration: 300.ms);
                    }
                    final turn = _turns[i];
                    return _TurnView(
                      key: ValueKey(turn.id),
                      turn: turn,
                      onRetry: () => _ask(turn.question, retry: turn),
                    );
                  },
                ),
        ),
        _Composer(controller: _input, busy: _busy, onSend: () => _ask(_input.text)),
      ]),
    );
  }
}

class _Welcome extends StatelessWidget {
  const _Welcome({required this.tips, required this.onPick});
  final List<String> tips;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return ListView(padding: const EdgeInsets.fromLTRB(24, 40, 24, 24), children: [
      Center(
        child: Container(
          width: 76,
          height: 76,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [FsColors.orange, FsColors.navy]),
            boxShadow: [BoxShadow(color: FsColors.orange.withValues(alpha: 0.35), blurRadius: 28, offset: const Offset(0, 12), spreadRadius: -10)],
          ),
          child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 34),
        ).animate(onPlay: (c) => c.repeat(reverse: true)).scaleXY(begin: 1, end: 1.05, duration: 1600.ms, curve: Curves.easeInOut),
      ),
      const SizedBox(height: 22),
      Text(tr('What would you like to know?', 'Que souhaitez-vous savoir ?'), textAlign: TextAlign.center, style: context.text.headlineSmall),
      const SizedBox(height: 8),
      Text(
        tr("Ask about today's fixtures, what is live, a team's latest result, a league table or a rule. Answers come from our sports data, with the source shown.",
            "Demandez les matchs du jour, ce qui est en direct, le dernier résultat d'une équipe, un classement ou une règle. Les réponses viennent de nos données sportives, avec la source."),
        textAlign: TextAlign.center,
        style: context.text.bodyMedium,
      ),
      const SizedBox(height: 24),
      Wrap(
        alignment: WrapAlignment.center,
        spacing: 8,
        runSpacing: 8,
        children: [for (var i = 0; i < tips.length; i++) _TipChip(text: tips[i], onTap: () => onPick(tips[i])).entrance(i, baseMs: 70)],
      ),
      const SizedBox(height: 24),
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(Icons.shield_outlined, size: 14, color: c.ink3),
        const SizedBox(width: 6),
        Flexible(child: Text(tr('No betting advice. Forecasts are never facts.', 'Aucun conseil de pari. Une prévision n’est jamais un fait.'), style: context.text.bodySmall)),
      ]),
    ]);
  }
}

class _TipChip extends StatelessWidget {
  const _TipChip({required this.text, required this.onTap});
  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Pressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(999), border: Border.all(color: c.line)),
        child: Text(text, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.ink2)),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({required this.controller, required this.busy, required this.onSend});
  final TextEditingController controller;
  final bool busy;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final ready = !busy && controller.text.trim().length >= 2;
    return Container(
      padding: EdgeInsets.fromLTRB(12, 10, 12, 10 + MediaQuery.paddingOf(context).bottom),
      decoration: BoxDecoration(color: c.surface, border: Border(top: BorderSide(color: c.line))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Expanded(
          child: TextField(
            controller: controller,
            minLines: 1,
            maxLines: 4,
            maxLength: 300,
            textInputAction: TextInputAction.send,
            onSubmitted: (_) => onSend(),
            decoration: InputDecoration(
              hintText: tr('Example: What is offside?', "Exemple : c'est quoi le hors-jeu ?"),
              counterText: '',
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide(color: c.line)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide(color: c.accent, width: 1.4)),
            ),
          ),
        ),
        const SizedBox(width: 8),
        AnimatedScale(
          scale: ready ? 1 : 0.9,
          duration: const Duration(milliseconds: 180),
          child: IconButton.filled(
            onPressed: ready ? onSend : null,
            style: IconButton.styleFrom(backgroundColor: FsColors.orange, disabledBackgroundColor: c.surfaceMuted, minimumSize: const Size(48, 48)),
            icon: busy
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.arrow_upward_rounded, color: Colors.white),
          ),
        ),
      ]),
    );
  }
}

class _TurnView extends StatelessWidget {
  const _TurnView({super.key, required this.turn, required this.onRetry});
  final _Turn turn;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Align(
          alignment: Alignment.centerRight,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.78),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
              decoration: BoxDecoration(
                color: context.isDark ? const Color(0xFF17335F) : FsColors.navy,
                borderRadius: const BorderRadius.only(topLeft: Radius.circular(20), topRight: Radius.circular(6), bottomLeft: Radius.circular(20), bottomRight: Radius.circular(20)),
              ),
              child: Text(turn.question, style: const TextStyle(color: Colors.white, fontSize: 14.5, height: 1.4)),
            ),
          ),
        ).animate().fadeIn(duration: 260.ms).slideX(begin: 0.06, end: 0, curve: AppTheme.ease),
        const SizedBox(height: 10),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(shape: BoxShape.circle, color: context.isDark ? c.surfaceMuted : FsColors.navy),
            child: Icon(Icons.smart_toy_rounded, size: 17, color: context.isDark ? c.brand : Colors.white),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Container(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              decoration: BoxDecoration(
                color: c.surfaceMuted,
                borderRadius: const BorderRadius.only(topLeft: Radius.circular(6), topRight: Radius.circular(20), bottomLeft: Radius.circular(20), bottomRight: Radius.circular(20)),
              ),
              child: turn.answer != null
                  ? _AnswerBody(answer: turn.answer!)
                  : turn.error != null
                      ? _ErrorBody(turn: turn, onRetry: onRetry)
                      : const _Typing(),
            ),
          ),
        ]).animate().fadeIn(duration: 300.ms, delay: 80.ms).slideY(begin: 0.08, end: 0, curve: AppTheme.ease),
      ]),
    );
  }
}

class _Typing extends StatelessWidget {
  const _Typing();

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      for (var i = 0; i < 3; i++)
        Container(
          margin: const EdgeInsets.only(right: 5),
          width: 7,
          height: 7,
          decoration: BoxDecoration(color: c.ink3, shape: BoxShape.circle),
        ).animate(onPlay: (ctl) => ctl.repeat(reverse: true)).moveY(begin: 0, end: -5, duration: 380.ms, delay: (i * 140).ms, curve: Curves.easeInOut),
      const SizedBox(width: 6),
      Text(tr('Checking...', 'Vérification...'), style: context.text.bodySmall),
    ]);
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.turn, required this.onRetry});
  final _Turn turn;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(turn.error!, style: TextStyle(color: c.danger, height: 1.45)),
      const SizedBox(height: 10),
      if (turn.exhausted)
        Wrap(spacing: 8, runSpacing: 8, children: [
          FilledButton.icon(
            onPressed: () => openWeb('/app/assistant#addons'),
            icon: const Icon(Icons.add_shopping_cart_rounded, size: 18),
            label: Text(tr('Add requests', 'Ajouter des demandes')),
          ),
          OutlinedButton(onPressed: () => context.push('/billing'), child: Text(tr('Upgrade plan', 'Changer de formule'))),
        ])
      else
        OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh_rounded, size: 18), label: Text(tr('Retry', 'Réessayer'))),
    ]);
  }
}

String _statusText(String s) => switch (s) {
      'live' => tr('Live', 'En direct'),
      'finished' => tr('Final', 'Terminé'),
      'scheduled' => tr('Scheduled', 'Prévu'),
      'postponed' => tr('Postponed', 'Reporté'),
      'canceled' => tr('Canceled', 'Annulé'),
      'interrupted' => tr('Interrupted', 'Interrompu'),
      'abandoned' => tr('Abandoned', 'Abandonné'),
      _ => tr('Awaiting result', 'Résultat attendu'),
    };

class _AnswerBody extends StatelessWidget {
  const _AnswerBody({required this.answer});
  final Json answer;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final a = answer;
    final items = asMapList(a['items']);
    final table = a['table'] is Map ? asMap(a['table']) : null;
    final notes = asStringList(a['notes']);
    final sources = asMapList(a['sources']);
    final asOf = Fmt.parse(asString(a['asOfUTC']));
    final reveals = asBool(a['revealsResult']);
    final forecast = asString(a['forecast']);

    final words = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SelectableText(str(a['text']), style: TextStyle(fontSize: 14.5, height: 1.55, color: c.ink)),
      if (forecast != null && forecast.isNotEmpty) ...[
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: c.line)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(Icons.insights_rounded, size: 15, color: c.warning),
              const SizedBox(width: 6),
              Text(tr('Forecast, not a fact', 'Prévision, pas un fait'), style: context.text.labelMedium),
            ]),
            const SizedBox(height: 4),
            Text(forecast, style: TextStyle(fontSize: 14, height: 1.5, color: c.ink)),
            const SizedBox(height: 4),
            Text(tr('A possibility based on the data above. Nothing about a game is guaranteed.', 'Une possibilité fondée sur les données ci-dessus. Rien n’est garanti.'),
                style: context.text.bodySmall),
          ]),
        ),
      ],
    ]);

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      reveals ? SpoilerGuard(label: tr('Reveal', 'Afficher'), child: words) : words,
      if (items.isNotEmpty) ...[
        const SizedBox(height: 10),
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: FsCard(
              padding: const EdgeInsets.all(12),
              onTap: () => context.push('/match/${Uri.encodeComponent(str(item['matchId']))}'),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(str(item['title']), style: TextStyle(fontWeight: FontWeight.w700, color: c.accentText, fontSize: 14)),
                    const SizedBox(height: 2),
                    Text(
                      [
                        str(item['competition']),
                        _statusText(str(item['status'])),
                        if (Fmt.parse(asString(item['startUTC'])) != null) Fmt.full(Fmt.parse(asString(item['startUTC']))!),
                      ].where((s) => s.isNotEmpty).join(' · '),
                      style: context.text.bodySmall,
                    ),
                  ]),
                ),
                if (asString(item['score']) != null)
                  SpoilerGuard(
                    label: '•',
                    child: Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: Text(str(item['score']), style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, color: c.ink)),
                    ),
                  ),
                if (str(item['status']) == 'live') const Padding(padding: EdgeInsets.only(left: 8), child: LiveDot()),
              ]),
            ),
          ),
      ],
      if (table != null) ...[
        const SizedBox(height: 10),
        SpoilerGuard(label: tr('Reveal table', 'Afficher le classement'), child: _AnswerTable(table: table)),
      ],
      for (final n in notes) Padding(padding: const EdgeInsets.only(top: 8), child: Text(n, style: context.text.bodySmall?.copyWith(color: c.ink2))),
      if (sources.isNotEmpty) ...[
        const SizedBox(height: 10),
        Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 6, runSpacing: 4, children: [
          Text('${tr('Source', 'Source')}:', style: context.text.bodySmall),
          for (final s in sources)
            asString(s['url']) == null
                ? Text(str(s['label']), style: context.text.bodySmall)
                : GestureDetector(
                    onTap: () => openExternal(str(s['url'])),
                    child: Text(str(s['label']), style: context.text.bodySmall?.copyWith(decoration: TextDecoration.underline, color: c.accentText)),
                  ),
          if (asOf != null) Text('· ${tr('Updated', 'Mis à jour')} ${Fmt.full(asOf)}', style: context.text.bodySmall),
        ]),
      ],
      if (a['charged'] == false)
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(tr('This question was not counted.', "Cette question n'a pas été décomptée."), style: context.text.bodySmall?.copyWith(fontStyle: FontStyle.italic)),
        ),
    ]);
  }
}

class _AnswerTable extends StatelessWidget {
  const _AnswerTable({required this.table});
  final Json table;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final calculated = asBool(table['calculated']);
    final racing = asBool(table['racing']);
    final rows = asMapList(table['rows']);
    final season = asString(table['season']);
    TextStyle head = context.text.labelSmall!;
    return Container(
      decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: c.line)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
          child: Text(
            [str(table['league']), ?season, if (calculated) tr('calculated', 'calculé')].join(' · '),
            style: context.text.labelMedium,
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: Row(children: [
            SizedBox(width: 28, child: Text('#', style: head)),
            Expanded(child: Text(tr('Team', 'Équipe'), style: head)),
            SizedBox(width: 34, child: Text(tr('P', 'J'), textAlign: TextAlign.right, style: head)),
            SizedBox(width: 64, child: Text(calculated ? tr('Record', 'Bilan') : tr('Pts', 'Pts'), textAlign: TextAlign.right, style: head)),
          ]),
        ),
        for (final r in rows)
          Container(
            color: asBool(r['asked']) ? c.accent.withValues(alpha: 0.08) : null,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            child: Row(children: [
              SizedBox(width: 28, child: Text(asInt(r['rank'])?.toString() ?? '–', style: TextStyle(fontWeight: FontWeight.w700, color: c.ink2))),
              Expanded(
                child: Text(str(r['team']),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontWeight: asBool(r['asked']) ? FontWeight.w800 : FontWeight.w500, color: c.ink)),
              ),
              SizedBox(width: 34, child: Text(asInt(r['played'])?.toString() ?? '–', textAlign: TextAlign.right, style: TextStyle(color: c.ink2))),
              SizedBox(
                width: 64,
                child: Text(
                  (calculated ? asString(r['record']) : asInt(r['points'])?.toString()) ?? '–',
                  textAlign: TextAlign.right,
                  style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, color: c.ink),
                ),
              ),
            ]),
          ),
        TextButton(
          onPressed: () => context.push(racing ? '/league/${str(table['leagueId'])}' : '/standings/${str(table['leagueId'])}'),
          child: Text(tr('See the full table (${asInt(table['total']) ?? rows.length} teams)', 'Classement complet (${asInt(table['total']) ?? rows.length} équipes)')),
        ),
      ]),
    );
  }
}

class _AllowanceSheet extends StatelessWidget {
  const _AllowanceSheet({required this.account});
  final Account? account;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final a = account?.allowance;
    String sku(String s) => switch (s) {
          'assistant_100' => tr('100 assistant requests', '100 demandes à l’assistant'),
          'day_pass' => tr('Day pass', 'Pass journée'),
          'room_pass' => tr('Room pass', 'Pass salon'),
          'export_pack' => tr('Export pack', 'Pack d’exports'),
          _ => s,
        };
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 0, 22, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr('Assistant allowance', 'Allocation de l’assistant'), style: context.text.titleLarge),
          const SizedBox(height: 16),
          if (a == null)
            Text(tr('Your allowance could not be loaded.', "Votre allocation n'a pas pu être chargée."), style: context.text.bodyMedium)
          else ...[
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('${a.remaining}', style: context.text.displaySmall),
              const SizedBox(width: 8),
              Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(tr('requests left', 'demandes restantes'), style: context.text.bodyMedium)),
            ]),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(value: a.limit == 0 ? 0 : (a.used / a.limit).clamp(0, 1).toDouble(), minHeight: 8),
            ),
            const SizedBox(height: 10),
            Text(
              tr('${a.includedRemaining} of ${a.limit} plan requests left this month, plus ${a.purchased} purchased.',
                  '${a.includedRemaining} demandes sur ${a.limit} restantes ce mois-ci, plus ${a.purchased} achetées.'),
              style: context.text.bodyMedium,
            ),
            for (final cr in a.credits)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  '${sku(str(cr['sku']))}: ${asInt(cr['remaining']) ?? 0} · ${tr('expires', 'expire le')} ${Fmt.parse(asString(cr['expiresAtUTC'])) == null ? '' : Fmt.full(Fmt.parse(asString(cr['expiresAtUTC']))!)}',
                  style: context.text.bodySmall,
                ),
              ),
            if (account?.dayPassEnd != null && Fmt.parse(account!.dayPassEnd) != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text('${tr('Day pass active until', "Pass journée actif jusqu'au")} ${Fmt.full(Fmt.parse(account!.dayPassEnd)!)}', style: context.text.bodySmall),
              ),
          ],
          const SizedBox(height: 20),
          Row(children: [
            Expanded(
              child: FilledButton(
                onPressed: () => openWeb('/app/assistant#addons'),
                child: Text(tr('Add requests', 'Ajouter des demandes')),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.push('/billing');
                },
                child: Text(tr('Plans', 'Formules')),
              ),
            ),
          ]),
          const SizedBox(height: 8),
          Text(tr('Purchases are made securely on flacronsport.com.', 'Les achats se font en toute sécurité sur flacronsport.com.'), style: TextStyle(fontSize: 12, color: c.ink3)),
        ]),
      ),
    );
  }
}
