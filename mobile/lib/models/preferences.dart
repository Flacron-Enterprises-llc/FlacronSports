import 'json.dart';

const homeSections = ['favorites', 'live', 'upcoming', 'results', 'highlights', 'trending', 'news'];
const alertTypes = ['start', 'final', 'participants', 'scoring', 'interval', 'highlights'];

/// The member's preferences (lib/me/preferences-defaults.ts). Kept as the raw
/// map so a PUT always sends back exactly what the server stored.
class Preferences {
  Preferences(this.j);
  final Json j;

  static final defaults = Preferences({
    'locale': 'en',
    'timeZone': 'UTC',
    'spoilerMode': false,
    'lowData': false,
    'scoresFavoritesOnly': false,
    'favorites': <String>[],
    'leagues': <Json>[],
    'players': <Json>[],
    'reminders': <Json>[],
    'boardPins': <String>[],
    'homeFeed': {'order': [...homeSections], 'hidden': <String>[]},
    'alerts': {'muted': false, 'types': ['start', 'final'], 'quietStart': null, 'quietEnd': null, 'email': false},
    'newsletter': {'optedIn': false, 'consentedAt': null},
    'tourVersion': 0,
  });

  String get locale => str(j['locale'], 'en');
  String get timeZone => str(j['timeZone'], 'UTC');
  bool get spoilerMode => asBool(j['spoilerMode']);
  bool get lowData => asBool(j['lowData']);
  bool get scoresFavoritesOnly => asBool(j['scoresFavoritesOnly']);
  List<String> get favorites => asStringList(j['favorites']);
  List<Json> get leagues => asMapList(j['leagues']);
  List<Json> get players => asMapList(j['players']);
  List<Json> get reminders => asMapList(j['reminders']);
  List<String> get boardPins => asStringList(j['boardPins']);
  Json get alerts => asMap(j['alerts']).isEmpty ? asMap(defaults.j['alerts']) : asMap(j['alerts']);
  Json get newsletter => asMap(j['newsletter']).isEmpty ? asMap(defaults.j['newsletter']) : asMap(j['newsletter']);
  int get tourVersion => asInt(j['tourVersion']) ?? 0;

  int get favoriteTotal => favorites.length + leagues.length + players.length;

  bool isFavorite(String name) => favorites.any((f) => f.toLowerCase() == name.toLowerCase());
  bool followsLeague(String? id) => id != null && leagues.any((l) => str(l['id']) == id);
  bool followsPlayer(String? id) => id != null && players.any((p) => str(p['id']) == id);
  bool hasReminder(String eventId) => reminders.any((r) => str(r['eventId']) == eventId);
  bool isPinned(String eventId) => boardPins.contains(eventId);

  /// resolveHomeFeed: saved order, then any section added later, minus hidden.
  ({List<String> order, List<String> hidden}) get homeFeed {
    final feed = asMap(j['homeFeed']);
    final saved = asStringList(feed['order']).where(homeSections.contains).toList();
    final order = [...saved, ...homeSections.where((s) => !saved.contains(s))];
    final hidden = asStringList(feed['hidden']).where(homeSections.contains).toList();
    return (order: order, hidden: hidden);
  }
}
