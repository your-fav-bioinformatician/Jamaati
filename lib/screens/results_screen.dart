import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../responsive.dart';
import '../theme/text_styles.dart';
import '../theme/widgets.dart';
import '../i18n.dart';
import '../api_service.dart';

class ResultsScreen extends StatelessWidget {
  const ResultsScreen({
    super.key,
    required this.lang,
    required this.results,
    required this.onFeedback,
  });
  final Lang lang;
  final List<DeptMatch> results;
  final VoidCallback onFeedback;

  @override
  Widget build(BuildContext context) {
    final s = stringsFor(lang).results;
    final matches = results;

    return SingleChildScrollView(
      padding: EdgeInsets.symmetric(horizontal: context.wp(4), vertical: context.hp(4)),
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: context.wp(78).clamp(320, 1120)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(s.title, style: AppText.display(context, percent: 3.6, min: 20, max: 30)),
              SizedBox(height: context.hp(0.8)),
              Text(s.subtitle, style: AppText.body(context, percent: 1.9, color: AppColors.primary)),
              SizedBox(height: context.hp(3.5)),
              matches.isEmpty
                  ? _EmptyMatches(lang: lang)
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _BestMatchCard(match: matches.first, bestLabel: s.bestMatch),
                        SizedBox(height: context.hp(2.2)),
                        LayoutBuilder(builder: (context, constraints) {
                          final cols = context.isWide ? 2 : 1;
                          final rest = matches.skip(1).toList();
                          return GridView.count(
                            crossAxisCount: cols,
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            crossAxisSpacing: context.wp(1.8),
                            mainAxisSpacing: context.hp(1.8),
                            childAspectRatio: cols == 2 ? 2.6 : 3.2,
                            children: rest.map((m) => _MatchCard(match: m)).toList(),
                          );
                        }),
                      ],
                    ),
              SizedBox(height: context.hp(3.5)),
              Center(child: SecondaryButton(label: s.feedback, onPressed: onFeedback)),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyMatches extends StatelessWidget {
  const _EmptyMatches({required this.lang});
  final Lang lang;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: context.hp(6)),
      child: Center(
        child: Text(
          lang == Lang.ar ? 'لا توجد نتائج بعد.' : 'No matches yet.',
          textAlign: TextAlign.center,
          style: AppText.body(context, percent: 1.9, color: AppColors.primary),
        ),
      ),
    );
  }
}

class _BestMatchCard extends StatelessWidget {
  const _BestMatchCard({required this.match, required this.bestLabel});
  final DeptMatch match;
  final String bestLabel;

  @override
  Widget build(BuildContext context) {
    final ringSize = context.wp(11).clamp(90.0, 130.0).toInt();
    return AppCard(
      padding: EdgeInsets.symmetric(horizontal: context.wp(3.4), vertical: context.hp(3.4)),
      child: Stack(
        children: [
          Positioned(
            top: 0,
            right: 0,
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: context.wp(1.8), vertical: context.hp(0.6)),
              decoration: BoxDecoration(
                color: AppColors.secondary,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(context.fieldRadius),
                  bottomLeft: Radius.circular(context.fieldRadius),
                ),
              ),
              child: Text('🏆 $bestLabel', style: AppText.display(context, percent: 1.7, color: AppColors.text, min: 12, max: 15)),
            ),
          ),
          Padding(
            padding: EdgeInsets.only(top: context.hp(3)),
            child: LayoutBuilder(builder: (context, constraints) {
              final content = Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(match.displayName, style: AppText.display(context, percent: 3, min: 18, max: 26)),
                    SizedBox(height: context.hp(1.2)),
                    Text(match.description, style: AppText.body(context, percent: 1.7)),
                    SizedBox(height: context.hp(1.2)),
                    Wrap(
                      spacing: context.wp(1),
                      runSpacing: context.hp(0.8),
                      children: match.tags.map((t) => AppChip(t)).toList(),
                    ),
                  ],
                ),
              );
              final ring = ScoreRing(score: match.displayScore.toInt(), size: ringSize.toDouble());
              return context.isWide
                  ? Row(crossAxisAlignment: CrossAxisAlignment.center, children: [content, SizedBox(width: context.wp(2)), ring])
                  : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [content, SizedBox(height: context.hp(1.6)), Center(child: ring)]);
            }),
          ),
        ],
      ),
    );
  }
}

class _MatchCard extends StatelessWidget {
  const _MatchCard({required this.match});
  final DeptMatch match;

  @override
  Widget build(BuildContext context) {
    return HoverLift(
      scale: 1.0,
      builder: (context, hovering) => AppCard(
        borderColor: hovering ? AppColors.accent : AppColors.primary25,
        padding: EdgeInsets.symmetric(horizontal: context.wp(2.6), vertical: context.hp(2)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            ScoreRing(score: match.displayScore.toInt(), size: context.wp(6.5).clamp(56, 76)),
            SizedBox(width: context.wp(1.8)),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(match.displayName, style: AppText.body(context, percent: 1.9, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
                  SizedBox(height: context.hp(0.5)),
                  Text(match.description, style: AppText.body(context, percent: 1.4, color: AppColors.primary), maxLines: 2, overflow: TextOverflow.ellipsis),
                  SizedBox(height: context.hp(0.6)),
                  Wrap(
                    spacing: context.wp(0.7),
                    runSpacing: context.hp(0.5),
                    children: match.tags.map((t) => AppChip(t, fontPercent: 1.3)).toList(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}