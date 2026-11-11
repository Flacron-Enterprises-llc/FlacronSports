import '../../core/i18n.dart';
import '../../models/account.dart';

/// The plan table from lib/billing/matrix.ts, in both languages. Limits come from
/// [PlanInfo] so the app cannot disagree with what the backend enforces.
class MatrixRow {
  const MatrixRow(this.labelEn, this.labelFr, this.cells);
  final String labelEn, labelFr;
  final Map<String, (String, String)> cells;
  String get label => tr(labelEn, labelFr);
  String cell(String plan) {
    final c = cells[plan]!;
    return tr(c.$1, c.$2);
  }
}

Map<String, (String, String)> _same((String, String) t) => {'basic': t, 'plus': t, 'premium': t};
(String, String) _requests(PlanInfo p) => ('${p.assistant} requests', '${p.assistant} demandes');

const _digest = ('Daily digest and basic reports', 'Résumé quotidien et comptes rendus de base');
const _unlimited = ('Unlimited', 'Illimités');
const _removed = ('Removed', 'Retirées');
const _fullReports = ('Full personalized reports', 'Comptes rendus complets et personnalisés');
const _deepReports = ('Full reports and deeper analysis', 'Comptes rendus complets et analyse approfondie');
const _basicCompare = ('Basic comparison', 'Comparaison de base');
const _advancedCompare = ('Advanced comparison and saved views', 'Comparaison avancée et vues enregistrées');
const _allAlerts = ('All supported event alerts', "Toutes les alertes d'événement prises en charge");

final planMatrix = <MatrixRow>[
  MatrixRow('Scores and schedules', 'Scores et calendriers', _same(('All enabled sports', 'Tous les sports activés'))),
  MatrixRow('Authorized public video', 'Vidéo publique autorisée', _same(('Where available', 'Si disponible'))),
  MatrixRow('Favorite teams or athletes', 'Équipes ou athlètes favoris', {
    'basic': ('${PlanInfo.basic.favoritesLimit} total', '${PlanInfo.basic.favoritesLimit} au total'),
    'plus': _unlimited,
    'premium': _unlimited,
  }),
  MatrixRow('Alerts', 'Alertes', {
    'basic': ('Start and final result', 'Début et résultat final'),
    'plus': _allAlerts,
    'premium': ('All supported alerts and advanced filters', 'Toutes les alertes prises en charge et filtres avancés'),
  }),
  MatrixRow('FlacronSport display ads', 'Publicités FlacronSport', {'basic': ('Included', 'Incluses'), 'plus': _removed, 'premium': _removed}),
  MatrixRow('News and summaries', 'Actualités et résumés', {'basic': _digest, 'plus': _fullReports, 'premium': _deepReports}),
  MatrixRow('Sports assistant per month', 'Assistant sportif par mois',
      {'basic': _requests(PlanInfo.basic), 'plus': _requests(PlanInfo.plus), 'premium': _requests(PlanInfo.premium)}),
  MatrixRow('Private room creation', 'Création de salons privés', {
    'basic': ('Join only', 'Rejoindre uniquement'),
    'plus': ('${PlanInfo.plus.rooms} active rooms', '${PlanInfo.plus.rooms} salons actifs'),
    'premium': ('${PlanInfo.premium.rooms} active rooms', '${PlanInfo.premium.rooms} salons actifs'),
  }),
  MatrixRow('Room participant limit', 'Participants par salon', {
    'basic': ('Host plan applies', "Selon l'offre de l'hôte"),
    'plus': ('${PlanInfo.plus.roomPeople} per room', '${PlanInfo.plus.roomPeople} par salon'),
    'premium': ('${PlanInfo.premium.roomPeople} per room', '${PlanInfo.premium.roomPeople} par salon'),
  }),
  MatrixRow('Advanced comparison tools', 'Outils de comparaison avancés',
      {'basic': ('No', 'Non'), 'plus': _basicCompare, 'premium': _advancedCompare}),
];

const everyPlan = <(String, String)>[
  ('English and French', 'Anglais et français'),
  ('Basic accessibility controls', "Réglages d'accessibilité de base"),
  ('Supported public scores', 'Scores publics pris en charge'),
  ('Public community participation after sign-in', 'Participation à la communauté publique après connexion'),
  ('Free predictions', 'Pronostics gratuits'),
  ('Spoiler protection', 'Protection anti-spoiler'),
  ('Available public highlights', 'Résumés vidéo publics disponibles'),
];

(String, String) _assistantLine(PlanInfo p) => ('${p.assistant} assistant requests a month', '${p.assistant} demandes à l\'assistant par mois');

final planHighlights = <String, List<(String, String)>>{
  'basic': [
    ('Scores and schedules for all enabled sports', 'Scores et calendriers de tous les sports activés'),
    ('${PlanInfo.basic.favoritesLimit} favorite teams or athletes', '${PlanInfo.basic.favoritesLimit} équipes ou athlètes favoris'),
    ('Start and final result alerts', 'Alertes de début et de résultat final'),
    _digest,
    _assistantLine(PlanInfo.basic),
    ('Join private rooms', 'Rejoindre des salons privés'),
  ],
  'plus': [
    ('Everything in Basic', 'Tout le contenu de Basic'),
    ('Unlimited favorites', 'Favoris illimités'),
    _allAlerts,
    ('No FlacronSport display ads', 'Sans publicité FlacronSport'),
    _fullReports,
    _assistantLine(PlanInfo.plus),
    (
      '${PlanInfo.plus.rooms} active private rooms, ${PlanInfo.plus.roomPeople} people each',
      '${PlanInfo.plus.rooms} salons privés actifs, ${PlanInfo.plus.roomPeople} personnes chacun'
    ),
    _basicCompare,
  ],
  'premium': [
    ('Everything in Plus', 'Tout le contenu de Plus'),
    ('Advanced alert filters', "Filtres d'alertes avancés"),
    _deepReports,
    _assistantLine(PlanInfo.premium),
    (
      '${PlanInfo.premium.rooms} active private rooms, ${PlanInfo.premium.roomPeople} people each',
      '${PlanInfo.premium.rooms} salons privés actifs, ${PlanInfo.premium.roomPeople} personnes chacun'
    ),
    _advancedCompare,
  ],
};

/// Add-ons (lib/billing/addons.ts), bought on the website.
const addons = <(String sku, double price, String en, String fr, String detailEn, String detailFr)>[
  ('assistant_100', 4.99, '100 assistant requests', "100 demandes à l'assistant", 'Valid 30 days', 'Valables 30 jours'),
  ('day_pass', 1.99, 'Day pass', 'Pass journée', 'Premium benefits and 10 requests for 24 hours', 'Avantages Premium et 10 demandes pendant 24 heures'),
  ('room_pass', 2.99, 'Room pass', 'Pass salon', 'One private room for 50 people, 7 days', 'Un salon privé de 50 personnes, 7 jours'),
  ('export_pack', 2.99, 'Export pack', "Pack d'exports", '10 PDF exports, valid 30 days', '10 exports PDF, valables 30 jours'),
];

String addonName(String sku) {
  for (final a in addons) {
    if (a.$1 == sku) return tr(a.$3, a.$4);
  }
  return sku;
}
