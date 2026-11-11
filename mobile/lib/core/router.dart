import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/assistant/assistant_screen.dart';
import '../features/auth/auth_screens.dart';
import '../features/billing/billing_screen.dart';
import '../features/billing/plans_screen.dart';
import '../features/community/clubs_screens.dart';
import '../features/community/predictions_screens.dart';
import '../features/community/rooms_screens.dart';
import '../features/compare/compare_screen.dart';
import '../features/home/home_screen.dart';
import '../features/league/league_screens.dart';
import '../features/match/match_screen.dart';
import '../features/more/more_screen.dart';
import '../features/my_teams/board_screen.dart';
import '../features/my_teams/my_teams_screen.dart';
import '../features/news/news_screens.dart';
import '../features/notifications/notifications_screen.dart';
import '../features/onboarding/onboarding_screen.dart';
import '../features/player/player_screen.dart';
import '../features/scores/scores_screen.dart';
import '../features/search/search_screen.dart';
import '../features/settings/settings_screens.dart';
import '../features/shell/app_shell.dart';
import '../features/shell/splash_screen.dart';
import '../features/team/team_screen.dart';
import '../features/watch/video_screen.dart';
import '../features/watch/watch_screen.dart';
import '../models/account.dart';
import 'auth/auth_service.dart';
import 'state/providers.dart';

/// Re-runs the redirect whenever sign-in or plan state changes.
class _RouterRefresh extends ChangeNotifier {
  _RouterRefresh(Ref ref) {
    ref.listen(authUserProvider, (_, _) => notifyListeners());
    ref.listen(accountProvider, (_, _) => notifyListeners());
  }
}

const _publicPaths = {'/onboarding', '/signin', '/signup', '/forgot'};

/// Paths an account without a plan may still open (shellState in paywall.tsx).
bool _openWithoutPlan(String path) =>
    path == '/plans' || path.startsWith('/billing') || path.startsWith('/settings') || path == '/verify' || path == '/splash';

/// An add-on keeps its own feature open after a plan ends (addonOpensPath).
bool _addonOpens(Account a, String path) {
  if (a.addons.contains('room') && (path.startsWith('/rooms') || path.startsWith('/match'))) return true;
  if (a.addons.contains('export') && path.startsWith('/match')) return true;
  return false;
}

final rootNavigatorKey = GlobalKey<NavigatorState>();

/// Where to land after the splash, given the current state.
String? pendingLocation;

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefresh(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final path = state.matchedLocation;
      final auth = ref.read(authUserProvider);
      if (auth.isLoading && !auth.hasValue) return path == '/splash' ? null : '/splash';
      final user = auth.value;

      if (!LocalStore.onboarded) return path == '/onboarding' ? null : '/onboarding';

      if (user == null) {
        if (_publicPaths.contains(path) || path == '/mfa') return null;
        if (path != '/splash' && path != '/') pendingLocation = state.uri.toString();
        return '/signin';
      }
      if (!user.emailVerified) return path == '/verify' ? null : '/verify';

      final account = ref.read(accountProvider);
      if (!account.hasValue || account.value == null) {
        // Still loading or failed: the splash shows progress or a retry.
        if (path != '/splash') pendingLocation ??= state.uri.toString();
        return path == '/splash' ? null : '/splash';
      }
      final a = account.value!;
      if (!a.isMember || (!a.hasPlan && !a.isStaff)) {
        if (_openWithoutPlan(path) && path != '/splash') return null;
        if (_addonOpens(a, path)) return null;
        return '/plans';
      }

      if (path == '/splash' || _publicPaths.contains(path) || path == '/verify' || path == '/plans' || path == '/mfa') {
        final next = pendingLocation;
        pendingLocation = null;
        return next != null && next != '/splash' && !next.startsWith('/signin') ? next : '/home';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/', redirect: (_, _) => '/home'),
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/onboarding', builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: '/signin', builder: (_, s) => SignInScreen(email: s.uri.queryParameters['email'])),
      GoRoute(path: '/signup', builder: (_, _) => const SignUpScreen()),
      GoRoute(path: '/forgot', builder: (_, s) => ForgotPasswordScreen(email: s.uri.queryParameters['email'])),
      GoRoute(path: '/verify', builder: (_, _) => const VerifyEmailScreen()),
      GoRoute(path: '/mfa', builder: (_, s) => MfaScreen(mfa: s.extra as MfaRequired)),
      GoRoute(path: '/plans', builder: (_, _) => const PlansScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AppShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/scores',
              builder: (_, s) => ScoresScreen(
                initialSport: s.uri.queryParameters['sport'],
                initialStatus: s.uri.queryParameters['status'],
                initialQuery: s.uri.queryParameters['q'],
              ),
            ),
          ]),
          StatefulShellBranch(routes: [GoRoute(path: '/watch', builder: (_, s) => WatchScreen(initialSport: s.uri.queryParameters['sport']))]),
          StatefulShellBranch(routes: [GoRoute(path: '/news', builder: (_, _) => const NewsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/more', builder: (_, _) => const MoreScreen())]),
        ],
      ),
      GoRoute(path: '/match/:id', builder: (_, s) => MatchScreen(id: s.pathParameters['id']!, initialTab: s.uri.queryParameters['tab'])),
      GoRoute(path: '/team/:name', builder: (_, s) => TeamScreen(name: s.pathParameters['name']!, sport: s.uri.queryParameters['sport'])),
      GoRoute(path: '/player/:id', builder: (_, s) => PlayerScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/league/:id', builder: (_, s) => LeagueScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/standings/:id', builder: (_, s) => StandingsScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/cups', builder: (_, s) => CupsScreen(competition: s.uri.queryParameters['competition'])),
      GoRoute(path: '/motorsport', builder: (_, s) => MotorsportScreen(series: s.uri.queryParameters['series'])),
      GoRoute(path: '/search', builder: (_, s) => SearchScreen(query: s.uri.queryParameters['q'], sport: s.uri.queryParameters['sport'])),
      GoRoute(
        path: '/video',
        builder: (_, s) => VideoScreen(clipId: s.uri.queryParameters['clip'], matchId: s.uri.queryParameters['match'], title: s.uri.queryParameters['title']),
      ),
      GoRoute(path: '/my-teams', builder: (_, _) => const MyTeamsScreen()),
      GoRoute(path: '/board', builder: (_, _) => const BoardScreen()),
      GoRoute(path: '/news/saved', builder: (_, _) => const SavedNewsScreen()),
      GoRoute(path: '/news/:slug', builder: (_, s) => ArticleScreen(slug: s.pathParameters['slug']!)),
      GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),
      GoRoute(path: '/assistant', builder: (_, _) => const AssistantScreen()),
      GoRoute(path: '/compare', builder: (_, _) => const CompareScreen()),
      GoRoute(path: '/rooms', builder: (_, s) => RoomsScreen(matchId: s.uri.queryParameters['match'])),
      GoRoute(path: '/rooms/join/:token', builder: (_, s) => RoomJoinScreen(token: s.pathParameters['token']!)),
      GoRoute(path: '/rooms/:id', builder: (_, s) => RoomScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/predictions', builder: (_, _) => const PredictionsScreen()),
      GoRoute(path: '/predictions/join/:token', builder: (_, s) => GroupJoinScreen(token: s.pathParameters['token']!)),
      GoRoute(path: '/predictions/groups/:id', builder: (_, s) => GroupScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/clubs', builder: (_, _) => const ClubsScreen()),
      GoRoute(path: '/clubs/:id', builder: (_, s) => ClubScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/billing', builder: (_, _) => const BillingScreen()),
      GoRoute(path: '/settings', builder: (_, s) => SettingsScreen(section: s.uri.queryParameters['section'])),
      GoRoute(path: '/settings/profile', builder: (_, _) => const ProfileScreen()),
      GoRoute(path: '/settings/security', builder: (_, _) => const SecurityScreen()),
    ],
  );
});

/// Maps a flacronsport.com link (App Links) to an in-app route.
String? routeForWebLink(Uri uri) {
  var path = uri.path;
  if (path.startsWith('/fr/')) path = path.substring(3);
  if (path.startsWith('/app/')) path = path.substring(4);
  final seg = path.split('/').where((s) => s.isNotEmpty).toList();
  if (seg.length == 3 && seg[0] == 'rooms' && seg[1] == 'join') return '/rooms/join/${seg[2]}';
  if (seg.length == 3 && seg[0] == 'predictions' && seg[1] == 'join') return '/predictions/join/${seg[2]}';
  if (seg.length == 2 && seg[0] == 'match') return '/match/${seg[1]}';
  if (seg.length == 2 && seg[0] == 'news') return '/news/${seg[1]}';
  return null;
}
