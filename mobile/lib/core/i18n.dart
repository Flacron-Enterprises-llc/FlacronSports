import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';

/// The member's language. The web app ships English and French; the app follows
/// the `locale` preference stored on the account, so both stay in step.
class AppLocale {
  AppLocale._();

  static final ValueNotifier<String> notifier = ValueNotifier<String>('en');

  static String get code => notifier.value;
  static bool get isFr => notifier.value == 'fr';

  static void set(String code) {
    final next = code == 'fr' ? 'fr' : 'en';
    if (notifier.value != next) notifier.value = next;
  }
}

/// Inline bilingual copy: `tr('Live now', 'En direct')`.
String tr(String en, String fr) => AppLocale.isFr ? fr : en;

/// Date and time helpers. Times from the backend are UTC ISO strings; members see
/// them in the device's time zone.
class Fmt {
  Fmt._();

  static String get _l => AppLocale.isFr ? 'fr' : 'en';

  static DateTime? parse(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    return DateTime.tryParse(iso)?.toLocal();
  }

  static String time(DateTime d) => AppLocale.isFr ? DateFormat.Hm(_l).format(d) : DateFormat.jm(_l).format(d);
  static String dayShort(DateTime d) => DateFormat.E(_l).format(d);
  static String dayMonth(DateTime d) => DateFormat.MMMd(_l).format(d);
  static String dayMonthYear(DateTime d) => DateFormat.yMMMd(_l).format(d);
  static String weekdayLong(DateTime d) => DateFormat.MMMMEEEEd(_l).format(d);
  static String full(DateTime d) => '${DateFormat.yMMMd(_l).format(d)} · ${time(d)}';

  static String isoDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  static bool sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

  /// "Today", "Tomorrow", "Yesterday" or a short date.
  static String relativeDay(DateTime d) {
    final now = DateTime.now();
    if (sameDay(d, now)) return tr('Today', "Aujourd'hui");
    if (sameDay(d, now.add(const Duration(days: 1)))) return tr('Tomorrow', 'Demain');
    if (sameDay(d, now.subtract(const Duration(days: 1)))) return tr('Yesterday', 'Hier');
    return '${dayShort(d)} ${dayMonth(d)}';
  }

  static String ago(DateTime d) {
    final diff = DateTime.now().difference(d);
    if (diff.inSeconds < 60) return tr('just now', "à l'instant");
    if (diff.inMinutes < 60) return tr('${diff.inMinutes} min ago', 'il y a ${diff.inMinutes} min');
    if (diff.inHours < 24) return tr('${diff.inHours} h ago', 'il y a ${diff.inHours} h');
    if (diff.inDays < 7) return tr('${diff.inDays} d ago', 'il y a ${diff.inDays} j');
    return dayMonthYear(d);
  }

  static String money(num usd) => NumberFormat.simpleCurrency(name: 'USD', locale: AppLocale.isFr ? 'fr_FR' : 'en_US').format(usd);
}
