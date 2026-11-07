import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'app_shell.dart';
import 'app_state.dart';
import 'api_service.dart';
import 'i18n.dart';
import 'screens/feedback_screen.dart';
import 'screens/landing_page.dart';
import 'screens/loading_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/quiz_screen.dart';
import 'screens/results_screen.dart';
import 'screens/splash_screen.dart';

abstract final class AppRoutes {
  static const splash = '/';
  static const landing = '/landing';
  static const profile = '/profile';
  static const initializing = '/initializing';
  static const quiz = '/quiz';
  static const loading = '/loading';
  static const results = '/results';
  static const feedback = '/feedback';
}
//TODO Landing-page module id -> route. Add future modules here.
const Map<String, String> _moduleRoutes = {
  // 'articles': AppRoutes.articles,
  // 'catalog': AppRoutes.catalog,
};

void _openModule(BuildContext context, String moduleId) {
  // 1. Intercept the quiz module dynamically using global state
  if (moduleId == 'quiz') {
    final app = AppScope.read(context);
    if (app.isQuizComplete) {
      context.go(AppRoutes.results);
    } else if (app.isRegistered && app.userData != null) {
      context.go(AppRoutes.quiz);
    } else {
      context.go(AppRoutes.profile);
    }
    return;
  }

  // 2. Standard fallback for other modules
  final route = _moduleRoutes[moduleId];
  if (route != null) {
    context.go(route);
  } else {
    // Graceful fallback for modules not yet built
    final landing = stringsFor(AppScope.read(context).lang).landing;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(landing.comingSoonFor(moduleId)),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

/// Guard: everything except splash just needs the device token to be ready.
/// There's no login/guest gate any more — every install has access to
/// everything from first launch.
String? _redirect(AppState app, GoRouterState state) {
  final loc = state.matchedLocation;

  // Splash decides where to go next once the device token is ready.
  if (loc == AppRoutes.splash) return null;

  // Deep link / reload before the device token is known: hold at splash.
  if (!app.deviceReady) return AppRoutes.splash;

  return null;
}

/// Same slide-in the old AnimatedSwitcher used (350ms, easeOutCubic).
/// SlideTransition follows the ambient Directionality, so it mirrors in RTL.
Page<void> _slidePage(GoRouterState state, Widget child) {
  final slide = Tween<Offset>(begin: const Offset(1.0, 0.0), end: Offset.zero)
      .chain(CurveTween(curve: Curves.easeOutCubic));

  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 350),
    reverseTransitionDuration: const Duration(milliseconds: 350),
    transitionsBuilder: (context, animation, secondaryAnimation, child) =>
        SlideTransition(position: animation.drive(slide), child: child),
  );
}

/// A route whose screen watches [AppState] itself, so a language toggle
/// rebuilds it without recreating the router.
GoRoute _route(
  String path,
  Widget Function(BuildContext context, AppState app) build,
) {
  return GoRoute(
    path: path,
    pageBuilder: (context, state) => _slidePage(
      state,
      Builder(builder: (context) => build(context, AppScope.of(context))),
    ),
  );
}

/// Same as [_route], but also exposes `GoRouterState.extra` to the builder —
/// used for routes that receive data handed off from the previous screen
/// instead of re-fetching it themselves (results, from the loading screen).
GoRoute _routeWithExtra<T>(
  String path,
  Widget Function(BuildContext context, AppState app, T? extra) build,
) {
  return GoRoute(
    path: path,
    pageBuilder: (context, state) => _slidePage(
      state,
      Builder(builder: (context) => build(context, AppScope.of(context), state.extra as T?)),
    ),
  );
}

GoRouter createRouter(AppState appState) {
  return GoRouter(
    initialLocation: AppRoutes.splash,
    refreshListenable: appState,
    redirect: (context, state) => _redirect(appState, state),
    routes: [
      // Outer shell: background + SafeArea for every screen.
      ShellRoute(
        builder: (context, state, child) => AppFrame(child: child),
        routes: [
          // No top nav on these three.
          _route(
            AppRoutes.splash,
            (context, app) => SplashScreen(
              lang: app.lang,
              onDone: () async {
                await app.ready; // don't decide before the device token is ready
                if (!context.mounted) return;
                context.go(AppRoutes.landing);
              },
            ),
          ),
          _routeWithExtra<Map<String, dynamic>>(
            AppRoutes.initializing,
            (context, app, profileData) => LoadingScreen<bool>(
              lang: app.lang,
              task: () => app.initializeQuizSession(profileData ?? <String, dynamic>{}),
              // Read the result of the task and route accordingly
              onDone: (bool isComplete) {
                if (isComplete) {
                  context.go(AppRoutes.results);
                } else {
                  context.go(AppRoutes.quiz);
                }
              },
            ),
          ),
          _route(
            AppRoutes.loading,
            (context, app) => LoadingScreen<List<DeptMatch>>(
              lang: app.lang,
              task: app.fetchResults,
              // Hand the freshly-fetched results straight to /results rather
              // than making that screen re-fetch (and re-show a spinner).
              onDone: (results) => context.go(AppRoutes.results, extra: results),
              // NOTE: JaamatiApi.getResults() no longer throws an
              // auth-required error — every device token is trusted, so
              // there's nothing to redirect to sign-in for any more.
              // LoadingScreen's `onSignInRequired` callback (if its own
              // constructor still requires one) can be dropped there too;
              // it's dead code under this model.
            ),
          ),

          // Inner shell: everything that shows the top nav.
          ShellRoute(
            builder: (context, state, child) => NavShell(child: child),
            routes: [
              _route(
                AppRoutes.landing,
                (context, app) => LandingPage(
                  lang: app.lang,
                  onTap: (String moduleId) => _openModule(context, moduleId),
                ),
              ),
              _route(
                AppRoutes.profile,
                (context, app) => ProfileScreen(
                  lang: app.lang,
                  // Just hands off the collected profile answers — the
                  // (potentially slow) /quiz/init call that used to run
                  // inline behind this screen's submit button now happens
                  // on /initializing, where LoadingScreen can pace and
                  // retry it properly.
                  onDone: (profileData) => context.go(AppRoutes.initializing, extra: profileData),
                ),
              ),
              _route(
                AppRoutes.quiz,
                (context, app) => QuizScreen(
                  lang: app.lang,
                  onDone: () => context.go(AppRoutes.loading),
                ),
              ),
              _routeWithExtra<List<DeptMatch>>(
                AppRoutes.results,
                (context, app, results) => ResultsScreen(
                  lang: app.lang,
                  results: results ?? const [],
                  onFeedback: () => context.go(AppRoutes.feedback),
                ),
              ),
              _route(
                AppRoutes.feedback,
                (context, app) => FeedbackScreen(lang: app.lang),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}