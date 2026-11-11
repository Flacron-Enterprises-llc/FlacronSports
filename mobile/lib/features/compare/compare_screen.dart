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
import '../match/match_actions.dart';

const _blank = '–';

/// Sports the comparison offers (enabled sports minus individual ones).
List<Sport> get _compareSports => Sport.all.where((s) => !Sport.individual.contains(s.id)).toList();

/// Compare two teams or two players (compare-tool.tsx). Plus gets the basic
/// comparison, Premium the advanced one with saved views and head to head.
class CompareScreen extends ConsumerStatefulWidget {
  const CompareScreen({super.key});

  @override
  ConsumerState<CompareScreen> createState() => _CompareScreenState();
}

class _CompareScreenState extends ConsumerState<CompareScreen> {
  String _mode = 'teams';

  @override
  Widget build(BuildContext context) {
    final account = ref.watch(accountProvider).value;
    final allowed = account?.plusFeatures ?? false;
    return Scaffold(
      appBar: AppBar(title: Text(tr('Compare', 'Comparer'))),
      body: !allowed
          ? _Locked()
          : ListView(
              padding: EdgeInsets.fromLTRB(16, 4, 16, 32 + MediaQuery.paddingOf(context).bottom),
              children: [
                Text(tr('Put two teams or two players side by side.', 'Mettez deux équipes ou deux joueurs côte à côte.'), style: context.text.bodyMedium),
                const SizedBox(height: 14),
                _Segmented(
                  value: _mode,
                  options: [('teams', tr('Teams', 'Équipes'), Icons.shield_rounded), ('players', tr('Players', 'Joueurs'), Icons.person_rounded)],
                  onChanged: (v) => setState(() => _mode = v),
                ),
                const SizedBox(height: 16),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 280),
                  child: _mode == 'teams' ? _TeamCompare(key: const ValueKey('teams'), premium: account!.isPremium) : _PlayerCompare(key: const ValueKey('players'), plan: account!.plan),
                ),
              ],
            ),
    );
  }
}

class _Locked extends StatelessWidget {
  @override
  Widget build(BuildContext context) => StateView(
        icon: Icons.compare_arrows_rounded,
        title: tr('Compare is on Plus and Premium', 'La comparaison est incluse dans Plus et Premium'),
        message: tr('Put two teams or players side by side: records, form, home and away splits and head to head.',
            'Comparez deux équipes ou deux joueurs : bilans, forme, domicile et extérieur, confrontations directes.'),
        action: tr('Upgrade', 'Passer à la formule supérieure'),
        onAction: () => context.push('/billing'),
      );
}

class _Segmented extends StatelessWidget {
  const _Segmented({required this.value, required this.options, required this.onChanged});
  final String value;
  final List<(String, String, IconData)> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(16)),
      child: LayoutBuilder(builder: (context, box) {
        final w = box.maxWidth / options.length;
        final index = options.indexWhere((o) => o.$1 == value);
        return Stack(children: [
          AnimatedPositioned(
            duration: const Duration(milliseconds: 320),
            curve: AppTheme.ease,
            left: w * index,
            top: 0,
            bottom: 0,
            width: w,
            child: Container(
              decoration: BoxDecoration(
                color: c.surface,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 8, offset: const Offset(0, 2))],
              ),
            ),
          ),
          Row(children: [
            for (final o in options)
              Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onChanged(o.$1),
                  child: SizedBox(
                    height: 42,
                    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(o.$3, size: 17, color: o.$1 == value ? c.accent : c.ink3),
                      const SizedBox(width: 6),
                      Text(o.$2, style: TextStyle(fontWeight: FontWeight.w700, color: o.$1 == value ? c.ink : c.ink3)),
                    ]),
                  ),
                ),
              ),
          ]),
        ]);
      }),
    );
  }
}

/// Text field with debounced suggestions in an overlay list below it.
class _Typeahead extends StatefulWidget {
  const _Typeahead({required this.label, required this.controller, required this.search, this.onPicked});
  final String label;
  final TextEditingController controller;
  final Future<List<(String value, String label)>> Function(String q) search;
  final ValueChanged<String>? onPicked;

  @override
  State<_Typeahead> createState() => _TypeaheadState();
}

class _TypeaheadState extends State<_Typeahead> {
  Timer? _timer;
  List<(String, String)> _options = [];
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (!_focus.hasFocus) setState(() => _options = []);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _focus.dispose();
    super.dispose();
  }

  void _changed(String text) {
    _timer?.cancel();
    if (text.trim().length < 2) {
      setState(() => _options = []);
      return;
    }
    _timer = Timer(const Duration(milliseconds: 350), () async {
      try {
        final list = await widget.search(text.trim());
        if (mounted && _focus.hasFocus) setState(() => _options = list);
      } catch (_) {}
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      TextField(
        controller: widget.controller,
        focusNode: _focus,
        maxLength: 120,
        decoration: InputDecoration(labelText: widget.label, counterText: '', prefixIcon: const Icon(Icons.search_rounded)),
        onChanged: _changed,
      ),
      AnimatedSize(
        duration: const Duration(milliseconds: 200),
        child: _options.isEmpty
            ? const SizedBox(width: double.infinity)
            : Container(
                margin: const EdgeInsets.only(top: 6),
                decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: c.line)),
                child: Column(children: [
                  for (final o in _options.take(6))
                    ListTile(
                      dense: true,
                      title: Text(o.$2, maxLines: 1, overflow: TextOverflow.ellipsis),
                      onTap: () {
                        widget.controller.text = o.$2;
                        widget.onPicked?.call(o.$1);
                        setState(() => _options = []);
                        _focus.unfocus();
                      },
                    ),
                ]),
              ),
      ),
    ]);
  }
}

// ---------------- Teams ----------------

class _TeamCompare extends ConsumerStatefulWidget {
  const _TeamCompare({super.key, required this.premium});
  final bool premium;

  @override
  ConsumerState<_TeamCompare> createState() => _TeamCompareState();
}

class _TeamCompareState extends ConsumerState<_TeamCompare> {
  final _first = TextEditingController();
  final _second = TextEditingController();
  String _sport = 'football';
  Json? _data;
  (String, String, String?)? _asked;
  String? _error;
  bool _busy = false;
  List<Json> _views = [];

  @override
  void initState() {
    super.initState();
    _loadViews();
  }

  @override
  void dispose() {
    _first.dispose();
    _second.dispose();
    super.dispose();
  }

  Future<void> _loadViews() async {
    try {
      final res = asMap(await api.get('/compare/saved'));
      if (mounted) setState(() => _views = asMapList(res['views']));
    } catch (_) {}
  }

  Future<List<(String, String)>> _searchTeams(String q) async {
    final res = asMap(await api.get('/teams/search', query: {'q': q, 'sport': _sport}));
    return asMapList(res['teams']).map((t) => (str(t['name']), str(t['name']))).toList();
  }

  Future<void> _run([String? one, String? two, String? sport]) async {
    final a = (one ?? _first.text).trim(), b = (two ?? _second.text).trim();
    if (a.isEmpty || b.isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
      _data = null;
    });
    try {
      final chosen = sport ?? _sport;
      final res = asMap(await api.get('/compare', query: {'first': a, 'second': b, 'sport': chosen}));
      setState(() {
        _data = res;
        _asked = (a, b, chosen);
      });
    } catch (e) {
      String msg = tr("We couldn't compare these right now.", 'Comparaison impossible pour le moment.');
      if (e is ApiException) {
        if (e.code == 'team_not_found') msg = tr('We could not find ${e.body?['team'] ?? ''}. Pick a name from the suggestions.', "Nous n'avons pas trouvé ${e.body?['team'] ?? ''}. Choisissez un nom dans les suggestions.");
        if (e.code == 'same_team') msg = tr('Choose two different teams.', 'Choisissez deux équipes différentes.');
        if (e.needsPlan || e.needsHigherPlan || e.isRateLimited) msg = errorText(e);
      }
      setState(() => _error = msg);
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _save() async {
    try {
      await api.post('/compare/saved', body: {'first': _first.text.trim(), 'second': _second.text.trim(), 'sport': _sport});
      await _loadViews();
      if (mounted) toast(context, tr('View saved', 'Vue enregistrée'));
    } catch (e) {
      if (!mounted) return;
      toast(context, e is ApiException && e.code == 'views_limit' ? tr('You can keep up to 20 saved views.', "Vous pouvez garder jusqu'à 20 vues.") : errorText(e), error: true);
    }
  }

  Future<void> _remove(String id) async {
    try {
      await api.delete('/compare/saved', query: {'id': id});
      await _loadViews();
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      ChipStrip(
        padding: EdgeInsets.zero,
        items: [for (final s in _compareSports) (s.id, s.name, s.icon)],
        selected: _sport,
        onSelect: (id) => setState(() => _sport = id),
      ),
      const SizedBox(height: 14),
      FsCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _Typeahead(label: tr('First team', 'Première équipe'), controller: _first, search: _searchTeams),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Center(
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(shape: BoxShape.circle, color: c.accent.withValues(alpha: 0.14)),
                child: Icon(Icons.compare_arrows_rounded, color: c.accent, size: 20),
              ),
            ),
          ),
          _Typeahead(label: tr('Second team', 'Deuxième équipe'), controller: _second, search: _searchTeams),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(
              child: FilledButton(
                onPressed: _busy ? null : () => _run(),
                child: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white)) : Text(tr('Compare', 'Comparer')),
              ),
            ),
            if (widget.premium) ...[
              const SizedBox(width: 10),
              OutlinedButton.icon(
                onPressed: _first.text.trim().isEmpty || _second.text.trim().isEmpty ? null : _save,
                icon: const Icon(Icons.bookmark_add_rounded, size: 18),
                label: Text(tr('Save', 'Enregistrer')),
              ),
            ],
          ]),
        ]),
      ),
      if (_views.isNotEmpty) ...[
        const SizedBox(height: 16),
        Text(tr('Saved views', 'Vues enregistrées'), style: context.text.titleMedium),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final v in _views)
            InputChip(
              avatar: Icon(Sport.iconOf(asString(v['sport'])), size: 16),
              label: Text('${v['first']} / ${v['second']}'),
              onPressed: () {
                _first.text = str(v['first']);
                _second.text = str(v['second']);
                final sport = asString(v['sport']);
                if (sport != null && _compareSports.any((s) => s.id == sport)) setState(() => _sport = sport);
                _run(str(v['first']), str(v['second']), sport ?? _sport);
              },
              onDeleted: () => _remove(str(v['id'])),
            ),
        ]),
      ],
      const SizedBox(height: 16),
      if (_error != null) _ErrorBox(_error!),
      if (_busy) const Skeleton(height: 320, radius: 18),
      if (_data != null && _asked != null) _TeamResults(data: _data!, asked: _asked!).entrance(0),
    ]);
  }
}

String _recordFor(Json r, String sport) {
  final played = asInt(r['played']) ?? 0;
  if (played == 0) return _blank;
  final w = asInt(r['wins']) ?? 0, d = asInt(r['draws']) ?? 0, l = asInt(r['losses']) ?? 0;
  final t = asInt(r['ties']) ?? 0, nr = asInt(r['noResults']) ?? 0, otl = asInt(r['overtimeLosses']) ?? 0;
  if (sport == 'cricket') return '$w-$l-$t-$nr';
  if (sport == 'american-football' || sport == 'baseball' || sport == 'combat-sports') return d > 0 ? '$w-$l-$d' : '$w-$l';
  if (sport == 'ice-hockey' && d == 0) return '$w-${l - otl}-$otl';
  return d > 0 || sport == 'football' || sport == 'rugby' ? '$w-$d-$l' : '$w-$l';
}

String _perGame(int total, int counted) => counted == 0 ? _blank : (total / counted).toStringAsFixed(1);

({String record, String scored, String conceded, String difference, String? blanks, String? silent}) _terms(String sport) => switch (sport) {
      'basketball' => (record: tr('Won-lost', 'Victoires-défaites'), scored: tr('Points per game', 'Points par match'), conceded: tr('Allowed per game', 'Encaissés par match'), difference: tr('Point difference', 'Différence de points'), blanks: null, silent: null),
      'american-football' => (record: tr('Won-lost', 'Victoires-défaites'), scored: tr('Points per game', 'Points par match'), conceded: tr('Allowed per game', 'Encaissés par match'), difference: tr('Point difference', 'Différence de points'), blanks: tr('Shutouts', 'Blanchissages'), silent: null),
      'baseball' => (record: tr('Won-lost', 'Victoires-défaites'), scored: tr('Runs per game', 'Points par match'), conceded: tr('Allowed per game', 'Encaissés par match'), difference: tr('Run difference', 'Différence de points'), blanks: tr('Shutouts', 'Blanchissages'), silent: null),
      'ice-hockey' => (record: tr('Won-lost-OT losses', 'V-D-DP'), scored: tr('Goals per game', 'Buts par match'), conceded: tr('Allowed per game', 'Encaissés par match'), difference: tr('Goal difference', 'Différence de buts'), blanks: tr('Shutouts', 'Blanchissages'), silent: null),
      'rugby' => (record: tr('Won-drawn-lost', 'V-N-D'), scored: tr('Points per game', 'Points par match'), conceded: tr('Conceded per game', 'Encaissés par match'), difference: tr('Point difference', 'Différence de points'), blanks: null, silent: null),
      'volleyball' => (record: tr('Won-lost', 'Victoires-défaites'), scored: tr('Sets won per match', 'Sets gagnés par match'), conceded: tr('Sets lost per match', 'Sets perdus par match'), difference: tr('Set difference', 'Différence de sets'), blanks: tr('Wins in straight sets', 'Victoires sans perdre un set'), silent: tr('Losses without a set', 'Défaites sans gagner un set')),
      'cricket' => (record: tr('Won-lost-tied-no result', 'V-D-É-SR'), scored: tr('Runs per match', 'Points par match'), conceded: tr('Runs conceded per match', 'Points encaissés par match'), difference: tr('Run difference', 'Différence de points'), blanks: null, silent: null),
      _ => (record: tr('Won-drawn-lost', 'Victoires-nuls-défaites'), scored: tr('Goals per game', 'Buts par match'), conceded: tr('Conceded per game', 'Encaissés par match'), difference: tr('Goal difference', 'Différence de buts'), blanks: tr('Clean sheets', 'Clean sheets'), silent: tr('Games without a goal', 'Matchs sans marquer')),
    };

/// teamSheet rows (lib/sports/compare-rows.ts), minus form which is drawn as pills.
List<(String, String, String)> _teamRows(Json data) {
  final teams = asMapList(data['teams']);
  final one = teams[0], two = teams[1];
  final sport = asString(data['sportId']) ?? 'football';
  final terms = _terms(sport);
  final advanced = data['tier'] == 'advanced';
  (String, String, String) both(String label, String? Function(Json t) read) => (label, read(one) ?? _blank, read(two) ?? _blank);
  (String, String, String) extra(String label, String? Function(Json a) read) =>
      both(label, (t) => t['advanced'] is Map ? read(asMap(t['advanced'])) : null);
  String? n(dynamic v) => v?.toString();

  final rows = <(String, String, String)>[
    both(terms.record, (t) => _recordFor(asMap(t['record']), sport)),
    both(terms.scored, (t) => _perGame(asInt(asMap(t['record'])['scored']) ?? 0, asInt(asMap(t['record'])['counted']) ?? 0)),
    both(terms.conceded, (t) => _perGame(asInt(asMap(t['record'])['conceded']) ?? 0, asInt(asMap(t['record'])['counted']) ?? 0)),
    both(terms.difference, (t) {
      final r = asMap(t['record']);
      if ((asInt(r['counted']) ?? 0) == 0) return null;
      final d = (asInt(r['scored']) ?? 0) - (asInt(r['conceded']) ?? 0);
      return d > 0 ? '+$d' : '$d';
    }),
    if (advanced) ...[
      extra(tr('Home record', 'Bilan à domicile'), (a) => _recordFor(asMap(a['home']), sport)),
      extra(tr('Away record', "Bilan à l'extérieur"), (a) => _recordFor(asMap(a['away']), sport)),
      if (sport == 'cricket') ...[
        for (final f in const ['test', 'odi', 't20', 'first-class', 'hundred'])
          extra(tr('${_fmt(f)} record', 'Bilan ${_fmt(f)}'), (a) {
            final r = asMap(asMap(asMap(a['cricket'])['byFormat'])[f]);
            return r.isEmpty ? null : _recordFor(r, sport);
          }),
        extra(tr('Highest total', 'Plus haut total'), (a) => n(asMap(a['cricket'])['highest'])),
        extra(tr('Lowest total', 'Plus bas total'), (a) => n(asMap(a['cricket'])['lowest'])),
        extra(tr('Wins by runs', 'Victoires aux points'), (a) => n(asMap(a['cricket'])['winsByRuns'])),
        extra(tr('Wins by wickets', 'Victoires aux guichets'), (a) => n(asMap(a['cricket'])['winsByWickets'])),
      ],
      if (terms.blanks != null) extra(terms.blanks!, (a) => n(a['cleanSheets'])),
      if (terms.silent != null) extra(terms.silent!, (a) => n(a['failedToScore'])),
      if (sport == 'ice-hockey' || sport == 'basketball' || sport == 'american-football') extra(tr('Games beyond regulation', 'Matchs après prolongation'), (a) => n(a['overtimeGames'])),
      extra(tr('League position', 'Classement'), (a) => n(asMap(a['standing'])['rank'])),
      if (sport != 'cricket') extra(tr('Points', 'Points'), (a) => n(asMap(a['standing'])['points'])),
    ],
  ];
  return rows.where((r) => r.$2 != _blank || r.$3 != _blank).toList();
}

String _fmt(String f) => switch (f) { 'test' => 'Test', 'odi' => 'ODI', 't20' => 'T20', 'first-class' => 'First-class', _ => 'The Hundred' };

class _TeamResults extends StatelessWidget {
  const _TeamResults({required this.data, required this.asked});
  final Json data;
  final (String, String, String?) asked;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final teams = asMapList(data['teams']);
    if (teams.length < 2) return const SizedBox.shrink();
    final sport = asString(data['sportId']) ?? 'football';
    final rows = _teamRows(data);
    final advanced = data['tier'] == 'advanced';
    final h2h = asMapList(data['headToHead']);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _Versus(left: str(teams[0]['name']), right: str(teams[1]['name'])),
      const SizedBox(height: 12),
      SpoilerGuard(
        label: tr('Show comparison', 'Afficher la comparaison'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          FsCard(
            child: Column(children: [
              _CompareRow(label: tr('Recent form', 'Forme récente'), left: _FormPills(form: asStringList(teams[0]['form']), sport: sport), right: _FormPills(form: asStringList(teams[1]['form']), sport: sport)),
              for (final r in rows) _CompareRow(label: r.$1, left: _Value(r.$2), right: _Value(r.$3)),
            ]),
          ),
          if (advanced) ...[
            const SizedBox(height: 12),
            FsCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(tr('Head to head', 'Confrontations directes'), style: context.text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                if (h2h.isEmpty)
                  Text(tr('These teams have not met in their recent games.', 'Ces équipes ne se sont pas affrontées récemment.'), style: context.text.bodyMedium)
                else
                  for (final g in h2h)
                    Pressable(
                      onTap: () => context.push('/match/${Uri.encodeComponent(str(g['id']))}'),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(children: [
                          Expanded(child: Text(str(g['title']), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: c.ink2))),
                          Text(str(g['result']), style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, color: c.ink)),
                        ]),
                      ),
                    ),
              ]),
            ),
          ],
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => exportPdf(context, path: '/exports/compare', fileName: 'flacronsport-comparison.pdf', body: {
              'mode': 'teams',
              'first': asked.$1,
              'second': asked.$2,
              'locale': AppLocale.code,
              'sport': ?asked.$3,
            }),
            icon: const Icon(Icons.picture_as_pdf_rounded),
            label: Text(tr('Download comparison PDF', 'Télécharger la comparaison en PDF')),
          ),
        ]),
      ),
      const SizedBox(height: 12),
      FsCard(
        child: Column(children: [
          for (final t in teams)
            Builder(builder: (context) {
              final next = t['next'] is Map ? asMap(t['next']) : null;
              final start = next == null ? null : Fmt.parse(asString(next['startUTC']));
              return Pressable(
                onTap: next == null ? null : () => context.push('/match/${Uri.encodeComponent(str(next['id']))}'),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(children: [
                    Icon(Icons.event_rounded, color: c.accent, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${tr('Next game', 'Prochain match')}: ${t['name']}', style: context.text.bodySmall),
                        Text(next == null ? _blank : str(next['title']), style: TextStyle(fontWeight: FontWeight.w700, color: c.ink)),
                        if (start != null) Text(Fmt.full(start), style: context.text.bodySmall),
                      ]),
                    ),
                    if (next != null) Icon(Icons.chevron_right_rounded, color: c.ink3),
                  ]),
                ),
              );
            }),
        ]),
      ),
      const SizedBox(height: 8),
      Text(tr("Based on each team's most recent finished games.", "D'après les derniers matchs terminés de chaque équipe."), style: context.text.bodySmall),
    ]);
  }
}

// ---------------- Players ----------------

class _PlayerCompare extends ConsumerStatefulWidget {
  const _PlayerCompare({super.key, required this.plan});
  final String plan;

  @override
  ConsumerState<_PlayerCompare> createState() => _PlayerCompareState();
}

class _PlayerCompareState extends ConsumerState<_PlayerCompare> {
  final _first = TextEditingController();
  final _second = TextEditingController();
  String? _firstId, _secondId;
  Json? _data;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _first.dispose();
    _second.dispose();
    super.dispose();
  }

  Future<List<(String, String)>> _search(String q) async {
    final res = asMap(await api.get('/players/search', query: {'q': q}));
    return asMapList(res['players']).map((p) => (str(p['id']), p['team'] != null ? '${p['name']} (${p['team']})' : str(p['name']))).toList();
  }

  Future<void> _run() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _error = null;
      _data = null;
    });
    if (_firstId == null || _secondId == null) {
      final missing = _firstId == null ? _first.text : _second.text;
      setState(() => _error = tr('We could not find $missing. Pick a name from the suggestions.', "Nous n'avons pas trouvé $missing. Choisissez un nom dans les suggestions."));
      return;
    }
    if (_firstId == _secondId) {
      setState(() => _error = tr('Choose two different players.', 'Choisissez deux joueurs différents.'));
      return;
    }
    setState(() => _busy = true);
    try {
      final res = asMap(await api.get('/compare/players', query: {'first': _firstId, 'second': _secondId}));
      setState(() => _data = res);
    } catch (e) {
      String msg = tr("We couldn't compare these right now.", 'Comparaison impossible pour le moment.');
      if (e is ApiException) {
        if (e.code == 'same_player') msg = tr('Choose two different players.', 'Choisissez deux joueurs différents.');
        if (e.code == 'player_not_found') msg = tr('One of these players could not be found.', "Un de ces joueurs est introuvable.");
      }
      setState(() => _error = msg);
    }
    if (mounted) setState(() => _busy = false);
  }

  List<(String, String, String)> _rows(Json data) {
    final players = asMapList(data['players']);
    final a = asMap(players[0]['profile']), b = asMap(players[1]['profile']);
    final aa = players[0]['advanced'] is Map ? asMap(players[0]['advanced']) : null;
    final ba = players[1]['advanced'] is Map ? asMap(players[1]['advanced']) : null;
    String? born(dynamic v) {
      final d = DateTime.tryParse('${v ?? ''}T12:00:00Z');
      return d == null ? null : Fmt.dayMonthYear(d);
    }

    final rows = <(String, String?, String?)>[
      (tr('Sport', 'Sport'), Sport.nameOf(asString(a['sportId'])), Sport.nameOf(asString(b['sportId']))),
      (tr('Team', 'Équipe'), asString(a['team']), asString(b['team'])),
      (tr('Position', 'Poste'), asString(a['position']), asString(b['position'])),
      (tr('Nationality', 'Nationalité'), asString(a['nationality']), asString(b['nationality'])),
      (tr('Born', 'Naissance'), born(a['born']), born(b['born'])),
      (tr('Number', 'Numéro'), asString(a['number']), asString(b['number'])),
      (tr('Height', 'Taille'), asString(a['height']), asString(b['height'])),
      (tr('Weight', 'Poids'), asString(a['weight']), asString(b['weight'])),
      if (data['tier'] == 'advanced') ...[
        (tr('Preferred side', 'Côté préféré'), asString(aa?['side']), asString(ba?['side'])),
        (tr('Birthplace', 'Lieu de naissance'), asString(aa?['birthplace']), asString(ba?['birthplace'])),
        (tr('Reported wage', 'Salaire annoncé'), asString(aa?['wage']), asString(ba?['wage'])),
      ],
    ];
    return [
      for (final r in rows)
        if ((r.$2 ?? '').isNotEmpty || (r.$3 ?? '').isNotEmpty) (r.$1, (r.$2 ?? '').isEmpty ? _blank : r.$2!, (r.$3 ?? '').isEmpty ? _blank : r.$3!),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    final players = data == null ? <Json>[] : asMapList(data['players']);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      FsCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _Typeahead(label: tr('First player', 'Premier joueur'), controller: _first, search: _search, onPicked: (id) => _firstId = id),
          const SizedBox(height: 12),
          _Typeahead(label: tr('Second player', 'Second joueur'), controller: _second, search: _search, onPicked: (id) => _secondId = id),
          const SizedBox(height: 14),
          FilledButton(
            onPressed: _busy ? null : _run,
            child: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white)) : Text(tr('Compare', 'Comparer')),
          ),
        ]),
      ),
      const SizedBox(height: 16),
      if (_error != null) _ErrorBox(_error!),
      if (_busy) const Skeleton(height: 280, radius: 18),
      if (data != null && players.length == 2) ...[
        _Versus(left: str(asMap(players[0]['profile'])['name']), right: str(asMap(players[1]['profile'])['name'])).entrance(0),
        const SizedBox(height: 12),
        FsCard(child: Column(children: [for (final r in _rows(data)) _CompareRow(label: r.$1, left: _Value(r.$2), right: _Value(r.$3))])).entrance(1),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => exportPdf(context, path: '/exports/compare', fileName: 'flacronsport-comparison.pdf', body: {
            'mode': 'players',
            'first': str(asMap(players[0]['profile'])['id']),
            'second': str(asMap(players[1]['profile'])['id']),
            'locale': AppLocale.code,
          }),
          icon: const Icon(Icons.picture_as_pdf_rounded),
          label: Text(tr('Download comparison PDF', 'Télécharger la comparaison en PDF')),
        ),
        const SizedBox(height: 8),
        Text(tr('Details as published for each player. A dash means none was published.', "Informations publiées pour chaque joueur. Un tiret signifie qu'aucune n'a été publiée."), style: context.text.bodySmall),
        if (widget.plan == 'plus')
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Pressable(
              onTap: () => context.push('/billing'),
              child: Text(tr('Premium adds preferred side, birthplace and reported wage. Upgrade', 'Premium ajoute le côté préféré, le lieu de naissance et le salaire. Passer à Premium'),
                  style: TextStyle(color: context.fs.accentText, fontWeight: FontWeight.w600)),
            ),
          ),
      ],
    ]);
  }
}

// ---------------- Shared bits ----------------

class _Versus extends StatelessWidget {
  const _Versus({required this.left, required this.right});
  final String left, right;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), gradient: LinearGradient(colors: [context.fs.heroStart, context.fs.heroEnd])),
      child: Row(children: [
        Expanded(child: Column(children: [Crest(name: left, size: 44), const SizedBox(height: 8), Text(left, textAlign: TextAlign.center, maxLines: 2, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))])),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(color: FsColors.orange, borderRadius: BorderRadius.circular(999)),
          child: const Text('VS', style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, color: Colors.white)),
        ),
        Expanded(child: Column(children: [Crest(name: right, size: 44), const SizedBox(height: 8), Text(right, textAlign: TextAlign.center, maxLines: 2, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))])),
      ]),
    );
  }
}

class _CompareRow extends StatelessWidget {
  const _CompareRow({required this.label, required this.left, required this.right});
  final String label;
  final Widget left, right;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.line.withValues(alpha: 0.6)))),
      child: Row(children: [
        Expanded(child: Align(alignment: Alignment.centerRight, child: left)),
        SizedBox(width: 120, child: Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: c.ink3, fontWeight: FontWeight.w600))),
        Expanded(child: Align(alignment: Alignment.centerLeft, child: right)),
      ]),
    );
  }
}

class _Value extends StatelessWidget {
  const _Value(this.text);
  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text, textAlign: TextAlign.center, style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, fontSize: 14.5, color: context.fs.ink));
}

class _FormPills extends StatelessWidget {
  const _FormPills({required this.form, required this.sport});
  final List<String> form;
  final String sport;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    if (form.isEmpty) return const _Value(_blank);
    Color tone(String r) => switch (r) { 'W' => c.success, 'L' => c.danger, _ => c.ink3 };
    String letter(String r) {
      final x = sport == 'american-football' && r == 'D' ? 'T' : r;
      return switch (x) { 'W' => tr('W', 'V'), 'D' => tr('D', 'N'), 'L' => tr('L', 'D'), 'T' => tr('T', 'É'), 'N' => tr('NR', 'SR'), _ => x };
    }

    return Wrap(spacing: 3, runSpacing: 3, children: [
      for (final r in form)
        Container(
          width: 22,
          height: 22,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: tone(r).withValues(alpha: 0.16), borderRadius: BorderRadius.circular(6)),
          child: Text(letter(r), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: tone(r))),
        ),
    ]);
  }
}

class _ErrorBox extends StatelessWidget {
  const _ErrorBox(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: c.danger.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14), border: Border.all(color: c.danger.withValues(alpha: 0.3))),
      child: Row(children: [Icon(Icons.error_outline_rounded, color: c.danger), const SizedBox(width: 10), Expanded(child: Text(text, style: TextStyle(color: c.ink)))]),
    );
  }
}
