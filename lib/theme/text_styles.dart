import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'colors.dart';
import '../responsive.dart';

/// Text style helpers. Sizes are always derived from [Responsive.sp] (a
/// percentage of the shortest screen side) rather than fixed point sizes.
class AppText {
  AppText._();

  /// Display / heading font, mirrors the original `'Lalezar', sans-serif`.
  static TextStyle display(
    BuildContext context, {
    double percent = 4.4,
    Color? color,
    double min = 18,
    double max = 40,
  }) {
    return GoogleFonts.lalezar(
      fontSize: context.sp(percent, min: min, max: max),
      color: color ?? AppColors.accent,
      height: 1.15,
    );
  }

  /// Body font, mirrors the original `'IBM Plex Sans Arabic', sans-serif`.
  static TextStyle body(
    BuildContext context, {
    double percent = 2.0,
    Color? color,
    double min = 12,
    double max = 20,
    double height = 1.5,
    FontWeight? weight,
  }) {
    return GoogleFonts.ibmPlexSansArabic(
      fontSize: context.sp(percent, min: min, max: max),
      color: color ?? AppColors.text,
      height: height,
      fontWeight: weight,
    );
  }
}
