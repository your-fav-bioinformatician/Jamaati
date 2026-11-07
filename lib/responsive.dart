import 'package:flutter/widgets.dart';


extension Responsive on BuildContext {
  Size get _screenSize => MediaQuery.of(this).size;

  double get screenWidth => _screenSize.width;
  double get screenHeight => _screenSize.height;
  double get shortestSide => _screenSize.shortestSide;

  /// [percent] of the screen width. e.g. `context.wp(4)` ≈ 4% of the width.
  double wp(double percent) => screenWidth * percent / 100;

  /// [percent] of the screen height.
  double hp(double percent) => screenHeight * percent / 100;

  /// Font/icon size as a percentage of the shortest screen side, clamped so
  /// text stays readable on very small or very large screens.
  double sp(double percent, {double min = 10, double max = 56}) {
    final value = shortestSide * percent / 100;
    return value.clampD(min, max);
  }

  /// True once the viewport is wide enough for side-by-side (tablet/desktop)
  /// layouts; below this the app stacks panels vertically.
  bool get isWide => screenWidth >= 860;

  // ----- shared shape tokens, all percentage-derived -----
  double get panelRadius => wp(2.6).clampD(18, 30);
  double get cardRadius => wp(2.0).clampD(14, 22);
  double get fieldRadius => wp(1.4).clampD(10, 16);
  double get chipRadius => wp(4).clampD(16, 28);
  double get pillGap => wp(0.8).clampD(4, 10);
}

/// `num.clamp()` is declared to return `num` (not `double`), because its
/// bounds are `num` too — so `someDouble.clamp(0, 10)` doesn't type-check
/// where a `double` is expected (e.g. `SizedBox(width: ...)`). This keeps a
/// guaranteed `double` result everywhere sizes are clamped.
extension ClampDouble on double {
  double clampD(double min, double max) => this < min ? min : (this > max ? max : this);
}
