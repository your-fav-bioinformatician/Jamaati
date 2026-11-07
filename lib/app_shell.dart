import 'package:flutter/material.dart';
import 'theme/colors.dart';
import 'responsive.dart';
import 'theme/text_styles.dart';
import 'theme/widgets.dart';
import 'i18n.dart';
import 'app_state.dart';

/// Outer ShellRoute: wraps *every* screen (splash and loading included)
/// with the background and safe area.
class AppFrame extends StatelessWidget {
  const AppFrame({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(child: child),
    );
  }
}

/// Inner ShellRoute: adds the top nav bar. Splash and loading live outside
/// this shell, which replaces the old `showNav` check.
class NavShell extends StatelessWidget {
  const NavShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final s = stringsFor(app.lang);

    return Column(
      children: [
        _TopNav(
          appName: s.appName,
          langToggle: s.nav.langToggle,
          onToggleLang: app.toggleLang,
        ),
        Expanded(child: child),
      ],
    );
  }
}

class _TopNav extends StatelessWidget {
  const _TopNav({
    required this.appName,
    required this.langToggle,
    required this.onToggleLang,
  });

  final String appName, langToggle;
  final VoidCallback onToggleLang;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: context.wp(4), vertical: context.hp(1.6)),
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(bottom: BorderSide(color: AppColors.primary25)),
      ),
      child: Row(
        children: [
          BridgeMark(size: context.wp(3.6).clamp(28, 40)),
          SizedBox(width: context.wp(1.2)),
          Text(appName, style: AppText.display(context, percent: 2.6, min: 16, max: 22)),
          const Spacer(),
          TextButton(
            onPressed: onToggleLang,
            child: Text(langToggle, style: AppText.body(context, percent: 1.8, color: AppColors.primary, weight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}