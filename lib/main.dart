import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'app_router.dart';
import 'app_state.dart';
import 'theme/colors.dart';

void main() {
  runApp(const JaamatiApp());
}

class JaamatiApp extends StatefulWidget {
  const JaamatiApp({super.key});

  @override
  State<JaamatiApp> createState() => _JaamatiAppState();
}

class _JaamatiAppState extends State<JaamatiApp> {
  // Created once so the router isn't rebuilt on every state change.
  late final AppState _appState = AppState();
  late final GoRouter _router = createRouter(_appState);

  @override
  void dispose() {
    _router.dispose();
    _appState.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: _appState,
      child: MaterialApp.router(
        title: 'Jaamati',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          scaffoldBackgroundColor: AppColors.bg,
          colorScheme: ColorScheme.fromSeed(
            seedColor: AppColors.accent,
            primary: AppColors.accent,
            secondary: AppColors.secondary,
          ),
        ),
        routerConfig: _router,
        builder: (context, child) {
          // Above the Navigator so pages, dialogs and SnackBars all follow
          // the selected language's text direction.
          return Builder(
            builder: (context) => Directionality(
              textDirection: AppScope.of(context).textDirection,
              child: child!,
            ),
          );
        },
      ),
    );
  }
}