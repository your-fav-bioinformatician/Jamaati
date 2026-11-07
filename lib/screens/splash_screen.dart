import 'dart:async';
import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../responsive.dart';
import '../theme/text_styles.dart';
import '../theme/widgets.dart';
import '../i18n.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key, required this.lang, required this.onDone});
  final Lang lang;
  final VoidCallback onDone;

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))..forward();
    _timer = Timer(const Duration(milliseconds: 1600), widget.onDone);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = stringsFor(widget.lang);
    final barWidth = context.wp(34).clamp(200.0, 320.0);

    return Container(
      color: AppColors.bg,
      alignment: Alignment.center,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          BridgeMark(size: context.wp(11).clamp(56.0, 96.0)),
          SizedBox(height: context.hp(1.6)),
          Text(s.appName, style: AppText.display(context, percent: 4.6)),
          SizedBox(height: context.hp(4)),
          Text(s.splashMsg, style: AppText.body(context, percent: 2.1, color: AppColors.primary)),
          SizedBox(height: context.hp(3)),
          SizedBox(
            width: barWidth,
            height: context.hp(0.7).clamp(4.0, 8.0),
            child: AnimatedBuilder(
              animation: _controller,
              builder: (context, _) {
                return Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.primaryTint,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                    FractionallySizedBox(
                      widthFactor: _controller.value,
                      child: Container(
                        decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(999)),
                      ),
                    ),
                    Positioned(
                      left: (barWidth - 14) * _controller.value,
                      top: -4,
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          color: AppColors.secondary,
                          shape: BoxShape.circle,
                          boxShadow: [BoxShadow(color: AppColors.secondary.withValues(alpha: 0.3), blurRadius: 0, spreadRadius: 3)],
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
