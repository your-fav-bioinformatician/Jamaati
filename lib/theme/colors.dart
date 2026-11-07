import 'package:flutter/material.dart';


class AppColors {
  AppColors._();

  static const bg = Color(0xFFFBFEFC);
  static const primary = Color(0xFF628B98);
  static const primaryTint = Color(0xFFEDF3F5); // A lightened version of the new primary
  static const primary25 = Color(0x40628B98); // 25% opacity (0x40) of the new primary
  static const accent = Color(0xFF035790);
  static const secondary = Color(0xFFEAD720);
  static const text = Color(0xFF030C06);
  static const white = Color(0xFFFFFFFF);

  static List<BoxShadow> get shadowSoft => const [
        BoxShadow(color: Color(0x14000000), blurRadius: 16, offset: Offset(0, 6)),
      ];

  static List<BoxShadow> get shadowHover => const [
        BoxShadow(color: Color(0x1F000000), blurRadius: 24, offset: Offset(0, 10)),
      ];
}
