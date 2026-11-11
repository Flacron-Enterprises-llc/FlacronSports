import '../../core/i18n.dart';
import '../../models/json.dart';
import '../../models/sport.dart';

/// Wording for each sport's details (lib/sports/sport-terms.ts), kept in one place.
typedef Fact = (String label, String value);

String _humanize(String v) {
  final s = v.replaceAll('-', ' ').replaceAll('_', ' ');
  return s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

String _place(Json d) => [asString(d['city']), asString(d['country'])].whereType<String>().where((s) => s.isNotEmpty).join(', ');

List<Fact> _facts(List<(String, Object?)> rows) => [
      for (final (label, value) in rows)
        if (value != null && value != false && value.toString().isNotEmpty) (label, value.toString()),
    ];

String stageText(String? stage) {
  if (stage == null) return '';
  return switch (stage) {
    'final' => tr('Final', 'Finale'),
    'semi' || 'semi-final' => tr('Semi-final', 'Demi-finale'),
    'quarter' || 'quarter-final' => tr('Quarter-final', 'Quart de finale'),
    'third-place' => tr('Third-place match', 'Match pour la 3e place'),
    'preseason' => tr('Preseason', 'Présaison'),
    'play-in' => tr('Play-in', 'Play-in'),
    'first-round' => tr('First round', 'Premier tour'),
    'playoff' => tr('Playoff', 'Barrage'),
    'qualifier' => tr('Qualifier', 'Qualification'),
    'eliminator' => tr('Eliminator', 'Éliminatoire'),
    'wild-card' => tr('Wild card', 'Wild card'),
    'divisional' => tr('Divisional round', 'Tour de division'),
    'conference-final' => tr('Conference final', 'Finale de conférence'),
    'super-bowl' => 'Super Bowl',
    'grand-final' => tr('Grand final', 'Grande finale'),
    'round-robin' => tr('Round robin', 'Phase de poules'),
    _ => _humanize(stage),
  };
}

String cricketFormat(String? f) => switch (f) {
      'test' => 'Test',
      'first-class' => tr('First-class', 'First-class'),
      'odi' => 'ODI',
      't20' => 'T20',
      'hundred' => 'The Hundred',
      _ => f ?? '',
    };

String sessionName(String? s) => switch (s) {
      'practice' => tr('Practice', 'Essais libres'),
      'testing' => tr('Testing', 'Essais'),
      'sprint-qualifying' => tr('Sprint qualifying', 'Qualifications sprint'),
      'qualifying' => tr('Qualifying', 'Qualifications'),
      'sprint' => 'Sprint',
      'race' => tr('Race', 'Course'),
      'stage' => tr('Stage', 'Étape'),
      _ => s ?? '',
    };

String tennisRound(Json? round) {
  if (round == null || round.isEmpty) return '';
  final key = str(round['key']);
  if (key == 'round') return tr('Round ${round['number'] ?? ''}', 'Tour ${round['number'] ?? ''}');
  return stageText(key);
}

/// sportFacts: what the event is, no result. Visible in spoiler mode.
List<Fact> sportFacts(SportEvent e) {
  final d = e.details;
  if (d == null) return [];
  final kind = str(d['kind']);
  final season = (tr('Season', 'Saison'), d['season']);
  final place = (tr('Place', 'Lieu'), _place(d));
  final spectators = (tr('Spectators', 'Spectateurs'), d['spectators']);
  final group = (tr('Group', 'Groupe'), d['group']);
  final round = (tr('Round', 'Journée'), d['round']);
  switch (kind) {
    case 'football':
      return _facts([(tr('Stage', 'Phase'), d['stage'] == null ? null : stageText(asString(d['stage']))), round, group, season, place]);
    case 'basketball':
    case 'rugby':
    case 'volleyball':
      return _facts([
        if (kind == 'rugby') (tr('Code', 'Code'), d['code'] == null ? null : _humanize(str(d['code']))),
        (tr('Stage', 'Phase'), d['stage'] == null ? null : stageText(asString(d['stage']))),
        round,
        group,
        if (kind == 'volleyball') (tr('Format', 'Format'), asBool(d['goldenSet']) ? tr('Golden set', 'Set en or') : null),
        season,
        place,
        if (kind != 'volleyball') spectators,
      ]);
    case 'american-football':
      final stage = asString(d['stage']);
      return _facts([
        stage != null ? (tr('Stage', 'Phase'), stageText(stage)) : (tr('Week', 'Semaine'), d['week']),
        season,
        place,
        spectators,
      ]);
    case 'cricket':
      final toss = asMap(d['toss']);
      return _facts([
        (tr('Format', 'Format'), d['format'] == null ? null : cricketFormat(asString(d['format']))),
        (tr('Match', 'Match'), d['matchLabel']),
        (tr('Stage', 'Phase'), d['stage'] == null ? null : stageText(asString(d['stage']))),
        group,
        (tr('Phase', 'Étape'), d['phase']),
        season,
        (tr('Scheduled', 'Prévu'), d['scheduledDays'] == null ? null : tr('${d['scheduledDays']} days', '${d['scheduledDays']} jours')),
        (tr('Start', 'Début'), asBool(d['dayNight']) ? tr('Day/night', 'Jour/nuit') : null),
        place,
        (tr('Category', 'Catégorie'), asBool(d['women']) ? tr('Women', 'Femmes') : null),
        (
          tr('Toss', 'Tirage au sort'),
          toss.isEmpty
              ? null
              : (toss['choice'] == 'bat'
                  ? tr('${toss['side']} chose to bat', '${toss['side']} a choisi de batter')
                  : tr('${toss['side']} chose to field', '${toss['side']} a choisi de lancer'))
        ),
        (tr('Umpires', 'Arbitres'), d['umpires']),
        spectators,
      ]);
    case 'tennis':
      return _facts([
        (tr('Tournament', 'Tournoi'), d['tournament']),
        (tr('Round', 'Tour'), tennisRound(d['round'] is Map ? asMap(d['round']) : null)),
        group,
        (tr('Draw', 'Tableau'), switch (str(d['format'])) { 'singles' => tr('Singles', 'Simple'), 'doubles' => tr('Doubles', 'Double'), 'team-tie' => tr('Team tie', 'Rencontre par équipes'), _ => null }),
        (tr('Category', 'Catégorie'), switch (str(d['gender'])) { 'men' => tr('Men', 'Hommes'), 'women' => tr('Women', 'Femmes'), 'mixed' => tr('Mixed', 'Mixte'), _ => null }),
        season,
        place,
      ]);
    case 'motorsport':
      final n = asInt(d['sessionNumber']);
      return _facts([
        (tr('Session', 'Séance'), '${sessionName(asString(d['session']))}${n != null ? ' $n' : ''}'),
        (tr('Weekend', 'Week-end'), d['weekend']),
        (tr('Class', 'Catégorie'), d['className']),
        round,
        (tr('Circuit', 'Circuit'), d['circuit']),
        place,
        season,
        (tr('Scheduled laps', 'Tours prévus'), d['scheduledLaps']),
      ]);
    case 'combat':
      return _facts([
        (tr('Discipline', 'Discipline'), d['discipline'] == null ? null : (d['discipline'] == 'mma' ? 'MMA' : _humanize(str(d['discipline'])))),
        (tr('Card', 'Carte'), d['card']),
        (tr('Bouts', 'Combats'), asMapList(d['bouts']).isEmpty ? null : asMapList(d['bouts']).length),
        (tr('Weight class', 'Catégorie de poids'), d['weightClass']),
        (tr('Rounds', 'Rounds'), d['scheduledRounds']),
        (tr('Title bout', 'Combat pour le titre'), d['title']),
        place,
        season,
        spectators,
      ]);
  }
  return [];
}

/// resultFacts: result facts beyond the score table. Reveals the outcome.
List<Fact> resultFacts(SportEvent e) {
  final s = e.score;
  if (e.scoreKind == 'innings') {
    return _facts([
      (tr('Balls left', 'Balles restantes'), s['ballsLeft']),
      (tr('Method', 'Méthode'), s['method'] == 'dls' ? 'DLS' : null),
      (tr('Weather', 'Météo'), asBool(s['rain']) ? tr('Rain affected', 'Perturbé par la pluie') : null),
      (tr('Reduced overs', 'Overs réduits'), s['reducedOvers']),
      (tr('Revised overs', 'Overs révisés'), s['revisedOvers']),
      (tr('Target', 'Objectif'), s['target']),
      (tr('Player of the match', 'Joueur du match'), s['playerOfMatch']),
    ]);
  }
  if (e.scoreKind == 'classification') {
    final fl = asMap(s['fastestLap']);
    return _facts([
      (tr('Pole position', 'Pole position'), s['pole']),
      (tr('Fastest lap', 'Meilleur tour'), fl.isEmpty ? null : [asString(fl['name']), asString(fl['time'])].whereType<String>().join(' · ')),
    ]);
  }
  return [];
}

String setScore(List<int> games, int? tiebreak) => '${games[0]}-${games[1]}${tiebreak == null ? '' : '($tiebreak)'}';

String? boutLine(Json bout) {
  final winner = asString(bout['winner']);
  if (winner == null) return null;
  final loser = asStringList(bout['names']).where((n) => n != winner).firstOrNull ?? '';
  final how = [
    if (bout['method'] != null) SportEvent.combatMethod(asString(bout['method'])),
    if (bout['round'] != null) tr('Round ${bout['round']}', 'Round ${bout['round']}'),
    if (bout['time'] != null) asString(bout['time']),
  ].whereType<String>().join(', ');
  return '$winner ${tr('beat', 'bat')} $loser${how.isNotEmpty ? ': $how' : ''}';
}

String _inningsText(Json? m) {
  if (m == null || m.isEmpty) return '';
  final runs = asInt(m['runs']) ?? 0;
  final w = asInt(m['wickets']);
  return '${w == null ? '$runs' : '$runs/$w'}${asBool(m['declared']) ? 'd' : ''}';
}

String inningsLine(dynamic list, dynamic total) {
  final l = asMapList(list);
  if (l.isNotEmpty) return l.map(_inningsText).join(' & ');
  return total is Map ? _inningsText(asMap(total)) : '';
}

/// sportSteps: what happened in order, for sports with no running feed.
List<String> sportSteps(SportEvent e) {
  final s = e.score;
  final d = e.details;
  final parts = e.participants;
  if (e.scoreKind == 'innings') {
    final toss = d != null && d['kind'] == 'cricket' ? asMap(d['toss']) : <String, dynamic>{};
    final out = <String>[];
    if (toss.isNotEmpty) {
      out.add('${tr('Toss', 'Tirage au sort')}: ${toss['choice'] == 'bat' ? tr('${toss['side']} chose to bat', '${toss['side']} a choisi de batter') : tr('${toss['side']} chose to field', '${toss['side']} a choisi de lancer')}');
    }
    final sides = [(parts.isNotEmpty ? parts[0].name : null, s['homeInnings'], s['home']), (parts.length > 1 ? parts[1].name : null, s['awayInnings'], s['away'])];
    for (final (name, list, total) in sides) {
      final text = inningsLine(list, total);
      if (name == null || text.isEmpty) continue;
      final overs = total is Map ? asString(total['overs']) : null;
      out.add('$name: $text${overs != null ? ' (${tr('$overs overs', '$overs overs')})' : ''}');
    }
    return out;
  }
  if (e.scoreKind == 'sets') {
    final lines = asMapList(s['lines']);
    if (parts.length < 2) return [];
    Json? lineOf(Participant p) => lines.where((l) => str(l['name']) == p.rawName).firstOrNull;
    final first = lineOf(parts[0]), second = lineOf(parts[1]);
    if (first == null || second == null) return [];
    final a = (first['games'] as List? ?? []).map((g) => asInt(g) ?? 0).toList();
    final b = (second['games'] as List? ?? []).map((g) => asInt(g) ?? 0).toList();
    final tbs = (s['tiebreaks'] as List? ?? []).map(asInt).toList();
    return [
      for (var i = 0; i < a.length && i < b.length; i++)
        '${tr('Set ${i + 1}', 'Set ${i + 1}')}: ${first['name']} ${setScore([a[i], b[i]], i < tbs.length ? tbs[i] : null)} ${second['name']}',
    ];
  }
  if (d != null && d['kind'] == 'tennis') {
    return asMapList(d['rubbers']).map((r) {
      final games = (r['games'] as List? ?? []).map((g) => (g as List).map((x) => asInt(x) ?? 0).toList()).toList();
      final tbs = (r['tiebreaks'] as List? ?? []).map(asInt).toList();
      return '${r['winner']} ${tr('beat', 'bat')} ${r['loser']}: ${[for (var i = 0; i < games.length; i++) setScore(games[i], i < tbs.length ? tbs[i] : null)].join(' ')}';
    }).toList();
  }
  if (d != null && d['kind'] == 'combat') return asMapList(d['bouts']).map(boutLine).whereType<String>().toList();
  return [];
}

bool hasSportStatistics(SportEvent e) {
  if (e.scoreKind == 'innings' || e.scoreKind == 'classification') return true;
  final d = e.details;
  if (d == null) return false;
  if (d['kind'] == 'tennis') return asMapList(d['rubbers']).isNotEmpty;
  if (d['kind'] == 'combat') return asMapList(d['bouts']).any((b) => b['winner'] != null);
  return false;
}

// ---------- Detail labels (lib/i18n.ts match.*) ----------

const _statsEn = {
  'ball possession': 'Possession', 'expected_goals': 'Expected goals', 'total shots': 'Total shots', 'shots on goal': 'Shots on target',
  'shots off goal': 'Shots off target', 'blocked shots': 'Blocked shots', 'corner kicks': 'Corners', 'offsides': 'Offsides', 'fouls': 'Fouls',
  'yellow cards': 'Yellow cards', 'red cards': 'Red cards', 'goalkeeper saves': 'Goalkeeper saves', 'total passes': 'Total passes',
  'passes accurate': 'Accurate passes', 'passes %': 'Pass accuracy', 'shots insidebox': 'Shots inside the box', 'shots outsidebox': 'Shots outside the box',
  'free kicks': 'Free kicks', 'hits': 'Hits', 'errors': 'Errors', '2-points %': '2-point shooting', '3-points %': '3-point shooting',
  'free throws %': 'Free throw shooting', 'rebounds': 'Rebounds', 'offensive rebounds': 'Offensive rebounds', 'defensive rebounds': 'Defensive rebounds',
  'assists': 'Assists', 'steals': 'Steals', 'blocks': 'Blocks', 'turnovers': 'Turnovers', 'personal fouls': 'Personal fouls',
};

const _statsFr = {
  'ball possession': 'Possession', 'expected_goals': 'Buts attendus', 'total shots': 'Tirs', 'shots on goal': 'Tirs cadrés',
  'shots off goal': 'Tirs non cadrés', 'blocked shots': 'Tirs contrés', 'corner kicks': 'Corners', 'offsides': 'Hors-jeu', 'fouls': 'Fautes',
  'yellow cards': 'Cartons jaunes', 'red cards': 'Cartons rouges', 'goalkeeper saves': 'Arrêts du gardien', 'total passes': 'Passes',
  'passes accurate': 'Passes réussies', 'passes %': 'Précision des passes', 'shots insidebox': 'Tirs dans la surface', 'shots outsidebox': 'Tirs hors de la surface',
  'free kicks': 'Coups francs', 'hits': 'Coups sûrs', 'errors': 'Erreurs', '2-points %': 'Réussite à 2 points', '3-points %': 'Réussite à 3 points',
  'free throws %': 'Réussite aux lancers francs', 'rebounds': 'Rebonds', 'offensive rebounds': 'Rebonds offensifs', 'defensive rebounds': 'Rebonds défensifs',
  'assists': 'Passes décisives', 'steals': 'Interceptions', 'blocks': 'Contres', 'turnovers': 'Balles perdues', 'personal fouls': 'Fautes personnelles',
};

/// labelStats: known keys translated; unknown keys keep the source label in English only.
String? statLabel(Json row) {
  final key = str(row['key']);
  final known = (AppLocale.isFr ? _statsFr : _statsEn)[key];
  if (known != null) return known;
  return AppLocale.isFr ? null : (asString(row['label']) ?? key);
}

String? timelineKindLabel(String kind) => switch (kind) {
      'goal' => tr('Goal', 'But'),
      'penalty' => tr('Penalty goal', 'But sur penalty'),
      'missed-penalty' => tr('Missed penalty', 'Penalty manqué'),
      'own-goal' => tr('Own goal', 'But contre son camp'),
      'yellow' => tr('Yellow card', 'Carton jaune'),
      'red' => tr('Red card', 'Carton rouge'),
      'substitution' => tr('Substitution', 'Remplacement'),
      'var' => tr('VAR review', 'Vérification VAR'),
      'infraction' => tr('Penalty', 'Pénalité'),
      _ => null,
    };

String positionShort(String? group) => switch (group) {
      'goalkeeper' => tr('GK', 'G'),
      'defender' => tr('DEF', 'DÉF'),
      'midfielder' => tr('MID', 'MIL'),
      'forward' => tr('FWD', 'ATT'),
      _ => '',
    };

String basketballRole(String? role) => switch (role) {
      'PG' => tr('Point guard', 'Meneur'),
      'SG' => tr('Shooting guard', 'Arrière'),
      'SF' => tr('Small forward', 'Ailier'),
      'PF' => tr('Power forward', 'Ailier fort'),
      'C' => tr('Center', 'Pivot'),
      'G' => tr('Guard', 'Arrière'),
      'F' => tr('Forward', 'Ailier'),
      _ => '',
    };

/// Per-sport empty notes (match.sportNotes).
String sportNote(String sportId, String which) {
  final notes = <String, Map<String, (String, String)>>{
    'basketball': {
      'updates': ('Play-by-play is not published for basketball.', "Le jeu action par action n'est pas publié pour le basketball."),
      'statistics': ('Team statistics are published for a few major games only, and this game has none.', 'Les statistiques ne sont publiées que pour quelques grands matchs, et pas pour celui-ci.'),
      'lineups': ('Starting fives are published for a few major games only, and this game has none.', 'Les cinq de départ ne sont publiés que pour quelques grands matchs, et pas pour celui-ci.'),
    },
    'ice-hockey': {
      'updates': ('Goals and penalties are published for some NHL games only, and this game has none.', 'Les buts et pénalités ne sont publiés que pour certains matchs de NHL, et pas pour celui-ci.'),
      'statistics': ('Shots, power plays and other team statistics are not published for hockey.', "Les tirs, supériorités numériques et autres statistiques ne sont pas publiés pour le hockey."),
      'lineups': ('Game rosters are not published for hockey.', 'Les feuilles de match ne sont pas publiées pour le hockey.'),
    },
    'american-football': {
      'lineups': ('Game rosters are not published for American football.', 'Les effectifs ne sont pas publiés pour le football américain.'),
    },
    'baseball': {
      'lineups': ('Batting orders are not published for baseball.', "Les ordres des frappeurs ne sont pas publiés pour le baseball."),
    },
    'rugby': {
      'lineups': ('Team sheets are not published for rugby.', 'Les compositions ne sont pas publiées pour le rugby.'),
    },
    'cricket': {
      'lineups': ('Playing elevens are not published for this match.', 'Les onze de départ ne sont pas publiés pour ce match.'),
    },
    'volleyball': {
      'lineups': ('Team sheets are not published for volleyball.', 'Les compositions ne sont pas publiées pour le volley-ball.'),
    },
  };
  final pair = notes[sportId]?[which];
  if (pair != null) return tr(pair.$1, pair.$2);
  return switch (which) {
    'updates' => tr('No live updates for this game yet.', 'Pas encore de mises à jour pour ce match.'),
    'statistics' => tr('No statistics for this game yet.', 'Pas encore de statistiques pour ce match.'),
    _ => tr('Lineups have not been published for this game.', "Les compositions n'ont pas été publiées pour ce match."),
  };
}

/// Segment heading for the line score (segmentHeading, short form).
String segmentHeading(Json seg, List<Json> all) {
  final kind = str(seg['kind']);
  final n = asInt(seg['number']) ?? 0;
  final severalOt = all.where((s) => s['kind'] == 'overtime').length > 1;
  return switch (kind) {
    'quarter' => tr('Q$n', 'QT$n'),
    'half' => tr('H$n', 'MT$n'),
    'period' => 'P$n',
    'inning' => '$n',
    'extras' => tr('Ext', 'Supp'),
    'set' => 'S$n',
    'overtime' => severalOt ? tr('OT$n', 'Prol$n') : tr('OT', 'Prol'),
    'shootout' => tr('SO', 'TAB'),
    'extra' => tr('ET', 'Prol'),
    _ => '$n',
  };
}

String lineCaption(String firstKind) => switch (firstKind) {
      'quarter' || 'overtime' => tr('Score by quarter', 'Score par quart-temps'),
      'half' || 'extra' => tr('Score by half', 'Score par mi-temps'),
      'period' || 'shootout' => tr('Score by period', 'Score par période'),
      'inning' || 'extras' => tr('Line score', 'Score par manche'),
      'set' => tr('Score by set', 'Score par set'),
      _ => tr('Score by period', 'Score par période'),
    };

String sportLabelFor(String sportId) => Sport.nameOf(sportId);
