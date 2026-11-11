import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../models/account.dart';
import '../../models/json.dart';
import '../../models/preferences.dart';
import '../api/api_client.dart';
import '../i18n.dart';

/// Device-local settings that are not part of the account.
class LocalStore {
  LocalStore._();
  static late SharedPreferences prefs;
  static Future<void> init() async => prefs = await SharedPreferences.getInstance();

  static bool get onboarded => prefs.getBool('onboarded') ?? false;
  static Future<void> setOnboarded() => prefs.setBool('onboarded', true);

  static String get themeMode => prefs.getString('themeMode') ?? 'system';
  static Future<void> setThemeMode(String v) => prefs.setString('themeMode', v);

  static String? get notificationsSeen => prefs.getString('notificationsSeen');
  static Future<void> setNotificationsSeen(String v) => prefs.setString('notificationsSeen', v);

  static bool get setupHidden => prefs.getBool('setupHidden') ?? false;
  static Future<void> setSetupHidden() => prefs.setBool('setupHidden', true);

  static bool get spoilerDecided => prefs.getBool('spoilerDecided') ?? false;
  static Future<void> setSpoilerDecided() => prefs.setBool('spoilerDecided', true);

  static bool get adDismissed => prefs.getBool('houseAdDismissed') ?? false;
  static Future<void> setAdDismissed() => prefs.setBool('houseAdDismissed', true);
}

/// Signed-in Firebase user, refreshed on token and profile changes.
final authUserProvider = StreamProvider<User?>((ref) => FirebaseAuth.instance.userChanges());

final themeModeProvider = NotifierProvider<ThemeModeNotifier, ThemeMode>(ThemeModeNotifier.new);

class ThemeModeNotifier extends Notifier<ThemeMode> {
  @override
  ThemeMode build() => switch (LocalStore.themeMode) { 'light' => ThemeMode.light, 'dark' => ThemeMode.dark, _ => ThemeMode.system };

  void set(ThemeMode mode) {
    state = mode;
    LocalStore.setThemeMode(mode.name);
  }
}

/// Plan and allowance: `/api/billing/status` + `/api/assistant`, as account-context.tsx.
final accountProvider = AsyncNotifierProvider<AccountNotifier, Account?>(AccountNotifier.new);

class AccountNotifier extends AsyncNotifier<Account?> {
  @override
  Future<Account?> build() async {
    final user = ref.watch(authUserProvider).value;
    if (user == null) return null;
    final results = await Future.wait([
      api.get('/billing/status'),
      api.get('/assistant').then<dynamic>((v) => v).catchError((_) => null),
      user.getIdTokenResult().then<dynamic>((r) => r.claims?['role']).catchError((_) => null),
    ]);
    final assistant = results[1] is Map ? asMap(results[1]) : null;
    return Account(
      status: asMap(results[0]),
      allowance: assistant == null ? null : Allowance(asMap(assistant['balance'])),
      dayPassEnd: assistant == null ? null : asString(assistant['dayPassExpiresAtUTC']),
      role: asString(results[2]),
    );
  }

  Future<void> refresh() async {
    final next = await AsyncValue.guard(build);
    // Keep the last good value if a background refresh fails.
    if (next.hasError && state.hasValue && state.value != null) return;
    state = next;
  }

  void setAllowance(Json balance) {
    final current = state.value;
    if (current == null) return;
    state = AsyncData(Account(status: current.status, allowance: Allowance(balance), dayPassEnd: current.dayPassEnd, role: current.role));
  }
}

/// Account preferences: GET/PUT `/api/me/preferences`.
final prefsProvider = AsyncNotifierProvider<PrefsNotifier, Preferences>(PrefsNotifier.new);

class PrefsNotifier extends AsyncNotifier<Preferences> {
  @override
  Future<Preferences> build() async {
    final user = ref.watch(authUserProvider).value;
    if (user == null) return Preferences.defaults;
    final prefs = Preferences(asMap(await api.get('/me/preferences')));
    AppLocale.set(prefs.locale);
    unawaited(_syncTimeZone(prefs));
    return prefs;
  }

  /// Like the web, adopt the device's zone once while the account still says UTC.
  Future<void> _syncTimeZone(Preferences prefs) async {
    if (prefs.timeZone != 'UTC') return;
    try {
      final zone = (await FlutterTimezone.getLocalTimezone()).identifier;
      if (zone.isNotEmpty && zone != 'UTC' && zone.length <= 64) await save({'timeZone': zone});
    } catch (_) {}
  }

  /// Sends a partial patch. Nested objects (alerts, newsletter, homeFeed) must be
  /// complete: the server replaces them whole.
  Future<Preferences> save(Json patch) async {
    final previous = state.value ?? Preferences.defaults;
    // Optimistic: show the change at once, roll back on failure.
    state = AsyncData(Preferences({...previous.j, ...patch}));
    try {
      final saved = Preferences(asMap(await api.put('/me/preferences', body: patch)));
      state = AsyncData(saved);
      AppLocale.set(saved.locale);
      return saved;
    } catch (e) {
      state = AsyncData(previous);
      rethrow;
    }
  }

  Future<void> toggleFavorite(String name) {
    final p = state.value ?? Preferences.defaults;
    final list = [...p.favorites];
    final i = list.indexWhere((f) => f.toLowerCase() == name.toLowerCase());
    i >= 0 ? list.removeAt(i) : list.add(name);
    return save({'favorites': list});
  }

  Future<void> toggleLeague(String id, String name, String sportId) {
    final p = state.value ?? Preferences.defaults;
    final list = [...p.leagues];
    final i = list.indexWhere((l) => str(l['id']) == id);
    i >= 0 ? list.removeAt(i) : list.add({'id': id, 'name': name, 'sportId': sportId});
    return save({'leagues': list});
  }

  Future<void> togglePlayer(String id, String name, String? team, String sportId) {
    final p = state.value ?? Preferences.defaults;
    final list = [...p.players];
    final i = list.indexWhere((l) => str(l['id']) == id);
    i >= 0 ? list.removeAt(i) : list.add({'id': id, 'name': name, 'team': team, 'sportId': sportId});
    return save({'players': list});
  }

  Future<void> toggleReminder(String eventId, String title, String? startUTC) {
    final p = state.value ?? Preferences.defaults;
    final list = [...p.reminders];
    final i = list.indexWhere((r) => str(r['eventId']) == eventId);
    i >= 0 ? list.removeAt(i) : list.add({'eventId': eventId, 'title': title.length > 200 ? title.substring(0, 200) : title, 'startUTC': startUTC});
    return save({'reminders': list});
  }

  Future<void> togglePin(String eventId) {
    final p = state.value ?? Preferences.defaults;
    final list = [...p.boardPins];
    list.contains(eventId) ? list.remove(eventId) : list.add(eventId);
    return save({'boardPins': list});
  }
}

/// Convenience: the current preferences or defaults.
final prefsValueProvider = Provider<Preferences>((ref) => ref.watch(prefsProvider).value ?? Preferences.defaults);

/// Unread notification count for the bell (localStorage `fs-notifications-seen` on the web).
final notificationsProvider = FutureProvider.autoDispose<List<Json>>((ref) async {
  final user = ref.watch(authUserProvider).value;
  if (user == null) return [];
  final timer = Timer(const Duration(seconds: 60), ref.invalidateSelf);
  ref.onDispose(timer.cancel);
  final res = await api.get('/me/notifications');
  return asMapList(asMap(res)['notifications']);
});

final unreadCountProvider = Provider.autoDispose<int>((ref) {
  final list = ref.watch(notificationsProvider).value ?? [];
  final seen = LocalStore.notificationsSeen;
  if (seen == null) return list.length;
  return list.where((n) => str(n['createdAt']).compareTo(seen) > 0).length;
});
