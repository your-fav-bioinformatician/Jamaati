import 'package:flutter/material.dart';
import '../responsive.dart';
import '../theme/text_styles.dart';
import '../theme/colors.dart';
import '../theme/widgets.dart';
import '../i18n.dart';
import '../app_state.dart';
import 'package:go_router/go_router.dart';
import '../app_router.dart';

class LandingPage extends StatelessWidget {
  const LandingPage({super.key, required this.lang, required this.onTap});
  
  final Lang lang;
  final void Function(String moduleId) onTap; // Generic onTap passing the module ID

  Widget _buildModule(BuildContext context, String title, IconData icon, String moduleId) {
    return Expanded(
      child: GestureDetector(
        onTap: () {
          if (moduleId == 'quiz') {
            final app = AppScope.read(context);
            if (app.isQuizComplete) {
              context.go(AppRoutes.results);
            } else if (app.isRegistered && app.userData != null) {
              context.go(AppRoutes.quiz);
            } else {
              context.go(AppRoutes.profile);
            }
          } else {
            onTap(moduleId); // Fallback to generic onTap for other modules
          }
        },// Passes the specific ID back to the router
        child: HoverLift(
          builder: (context, hovering) {
            return Container(
              height: context.hp(12).clamp(100.0, 140.0),
              decoration: BoxDecoration(
                color: hovering ? AppColors.primaryTint : AppColors.white,
                borderRadius: BorderRadius.circular(context.cardRadius),
                border: Border.all(color: hovering ? AppColors.accent : AppColors.primary25, width: 1.5),
                boxShadow: hovering ? AppColors.shadowSoft : null,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: context.sp(3.5, min: 24, max: 40), color: AppColors.primary),
                  SizedBox(height: context.hp(1)),
                  Text(
                    title,
                    style: AppText.display(context, percent: 2.2, min: 14, max: 22),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = stringsFor(lang);

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Center(
        child: SingleChildScrollView(
          padding: EdgeInsets.symmetric(horizontal: context.wp(4), vertical: context.hp(4)),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              BridgeMark(size: context.wp(11).clamp(56.0, 96.0)),
              SizedBox(height: context.hp(1.6)),
              Text(s.appName, style: AppText.display(context, percent: 4.6)),
              SizedBox(height: context.hp(4)),
              
              ConstrainedBox(
                constraints: BoxConstraints(maxWidth: context.wp(78).clamp(320, 600)),
                child: AppCard(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          _buildModule(context, s.landing.quiz, Icons.quiz_rounded, 'quiz'),
                          SizedBox(width: context.wp(3)),
                          _buildModule(context, s.landing.articles, Icons.article_rounded, 'articles'),
                        ],
                      ),
                      SizedBox(height: context.hp(2)),
                      Row(
                        children: [
                          _buildModule(context, s.landing.catalog, Icons.view_list_rounded, 'catalog'),
                          SizedBox(width: context.wp(3)),
                          _buildModule(context, s.landing.search, Icons.search_rounded, 'search'),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}