import '../core/i18n.dart';
import 'json.dart';

/// Plans (lib/billing/plans.ts). Prices are the owner-approved ones in D-034.
class PlanInfo {
  const PlanInfo(this.id, this.name, this.monthly, this.annual, this.favoritesLimit, this.assistant, this.ads, this.rooms, this.roomPeople);
  final String id, name;
  final double monthly, annual;
  final int? favoritesLimit;
  final int assistant;
  final bool ads;
  final int? rooms, roomPeople;

  static const none = PlanInfo('none', 'No plan', 0, 0, 0, 0, false, null, null);
  static const basic = PlanInfo('basic', 'Basic', 19.99, 199.99, 5, 5, true, null, null);
  static const plus = PlanInfo('plus', 'Plus', 29.99, 299.99, null, 100, false, 3, 20);
  static const premium = PlanInfo('premium', 'Premium', 49.99, 499.99, null, 300, false, 10, 50);

  static const paid = [basic, plus, premium];

  static PlanInfo of(String? id) => switch (id) { 'basic' => basic, 'plus' => plus, 'premium' => premium, _ => none };

  String get label => id == 'none' ? tr('No plan', 'Aucune formule') : name;

  int get annualSavingPercent => monthly == 0 ? 0 : (100 - (annual / (monthly * 12)) * 100).round();
}

/// Assistant allowance (AllowanceBalance).
class Allowance {
  Allowance(this.j);
  final Json j;
  String get period => str(j['period']);
  Json get included => asMap(j['included']);
  int get limit => asInt(included['limit']) ?? 0;
  int get used => asInt(included['used']) ?? 0;
  int get includedRemaining => asInt(included['remaining']) ?? 0;
  int get purchased => asInt(j['purchased']) ?? 0;
  int get remaining => asInt(j['remaining']) ?? 0;
  List<Json> get credits => asMapList(j['credits']);
}

/// What the member may use: subscription plus day pass, admin and add-ons.
class Account {
  Account({required this.status, required this.allowance, this.dayPassEnd, this.role});

  final Json status;
  final Allowance? allowance;
  final String? dayPassEnd;
  final String? role;

  /// The subscription alone (cancel and change-plan controls use this).
  String get subscriptionPlan => str(status['plan'], 'none');

  /// Decides access (counts a day pass and platform admin).
  String get plan => str(status['effectivePlan'], subscriptionPlan);
  PlanInfo get planInfo => PlanInfo.of(plan);
  String get state => str(status['state'], 'none');
  String? get interval => asString(status['interval']);
  int? get currentPeriodEnd => asInt(status['currentPeriodEnd']);
  bool get cancelAtPeriodEnd => asBool(status['cancelAtPeriodEnd']);
  List<String> get addons => asStringList(status['addons']);

  bool get isStaff => role != null && role!.isNotEmpty;
  bool get hasPlan => plan != 'none';
  bool get isMember => hasPlan || isStaff || addons.isNotEmpty;
  bool get plusFeatures => plan == 'plus' || plan == 'premium';
  bool get isPremium => plan == 'premium';
  bool get hasDayPass => dayPassEnd != null;
  bool get canCreateRooms => plusFeatures || addons.contains('room');

  DateTime? get periodEnd => currentPeriodEnd == null ? null : DateTime.fromMillisecondsSinceEpoch(currentPeriodEnd! * 1000);
}
