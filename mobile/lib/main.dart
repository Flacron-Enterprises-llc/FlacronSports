import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'core/i18n.dart';
import 'core/router.dart';
import 'core/state/providers.dart';
import 'core/theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Future.wait([
    Firebase.initializeApp(),
    LocalStore.init(),
    initializeDateFormatting('en'),
    initializeDateFormatting('fr'),
  ]);
  // Portrait everywhere; the video player unlocks rotation while it is open.
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarContrastEnforced: false,
  ));
  runApp(const ProviderScope(child: FlacronSportApp()));
}

class FlacronSportApp extends ConsumerStatefulWidget {
  const FlacronSportApp({super.key});

  @override
  ConsumerState<FlacronSportApp> createState() => _FlacronSportAppState();
}

class _FlacronSportAppState extends ConsumerState<FlacronSportApp> with WidgetsBindingObserver {
  StreamSubscription<Uri>? _links;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final appLinks = AppLinks();
    _links = appLinks.uriLinkStream.listen(_openLink);
  }

  void _openLink(Uri uri) {
    final route = routeForWebLink(uri);
    if (route == null) return;
    final router = ref.read(routerProvider);
    final account = ref.read(accountProvider).value;
    if (account == null) {
      pendingLocation = route;
      return;
    }
    router.push(route);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Back from the website (checkout, portal): re-read the plan so a purchase
    // made there unlocks the app straight away.
    if (state == AppLifecycleState.resumed && ref.read(authUserProvider).value != null) {
      ref.read(accountProvider.notifier).refresh();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _links?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    final mode = ref.watch(themeModeProvider);
    // Keep the language in step with the account preference.
    ref.listen(prefsProvider, (_, next) {
      final locale = next.value?.locale;
      if (locale != null) AppLocale.set(locale);
    });
    return ValueListenableBuilder<String>(
      valueListenable: AppLocale.notifier,
      builder: (context, locale, _) => MaterialApp.router(
        key: ValueKey(locale),
        title: 'FlacronSport',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: mode,
        locale: Locale(locale),
        supportedLocales: const [Locale('en'), Locale('fr')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        routerConfig: router,
      ),
    );
  }
}
