import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'colors.dart';
import '../responsive.dart';
import 'text_styles.dart';
import 'package:flutter_svg/flutter_svg.dart';
/// White rounded panel, ports the `.card` CSS class.
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding, this.borderColor});

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding ?? EdgeInsets.symmetric(horizontal: context.wp(3.4), vertical: context.hp(3)),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(context.cardRadius),
        border: Border.all(color: borderColor ?? AppColors.primary25),
        boxShadow: AppColors.shadowSoft,
      ),
      child: child,
    );
  }
}

/// A widget that grows slightly and shows a hover shadow on desktop/web when
/// the pointer enters it. On touch devices this is inert (harmless).
class HoverLift extends StatefulWidget {
  const HoverLift({super.key, required this.builder, this.scale = 1.02});
  final Widget Function(BuildContext context, bool hovering) builder;
  final double scale;

  @override
  State<HoverLift> createState() => _HoverLiftState();
}

class _HoverLiftState extends State<HoverLift> {
  bool _hovering = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _hovering = true),
      onExit: (_) => setState(() => _hovering = false),
      child: AnimatedScale(
        scale: _hovering ? widget.scale : 1.0,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        child: widget.builder(context, _hovering),
      ),
    );
  }
}

/// Accent-filled primary button, ports `.btn-primary`.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({super.key, required this.label, required this.onPressed, this.fullWidth = false});
  final String label;
  final VoidCallback? onPressed;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null;
    final button = ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: disabled ? AppColors.primary25 : AppColors.accent,
        foregroundColor: AppColors.white,
        elevation: 0,
        padding: EdgeInsets.symmetric(horizontal: context.wp(4.5), vertical: context.hp(1.7)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(context.fieldRadius * 1.4)),
      ),
      child: Text(label, style: AppText.display(context, percent: 2.4, color: AppColors.white, min: 14, max: 18)),
    );
    return fullWidth ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// Light, tinted button, ports `.btn-secondary`.
class SecondaryButton extends StatelessWidget {
  const SecondaryButton({super.key, required this.label, required this.onPressed, this.fullWidth = false});
  final String label;
  final VoidCallback? onPressed;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final button = OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        backgroundColor: AppColors.primaryTint,
        foregroundColor: AppColors.accent,
        side: BorderSide(color: AppColors.accent.withValues(alpha: 0.35)),
        padding: EdgeInsets.symmetric(horizontal: context.wp(4), vertical: context.hp(1.5)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(context.fieldRadius * 1.4)),
      ),
      child: Text(label, style: AppText.body(context, percent: 1.9, color: AppColors.accent, weight: FontWeight.w600)),
    );
    return fullWidth ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// Text-only button, ports `.btn-ghost`.
class GhostButton extends StatelessWidget {
  const GhostButton({super.key, required this.label, required this.onPressed, this.fullWidth = false, this.visible = true});
  final String label;
  final VoidCallback? onPressed;
  final bool fullWidth;
  final bool visible;

  @override
  Widget build(BuildContext context) {
    final button = TextButton(
      onPressed: visible ? onPressed : null,
      style: TextButton.styleFrom(
        foregroundColor: AppColors.primary,
        padding: EdgeInsets.symmetric(horizontal: context.wp(3.5), vertical: context.hp(1.5)),
      ),
      child: Opacity(
        opacity: visible ? 1 : 0,
        child: Text(label, style: AppText.body(context, percent: 1.9, color: AppColors.primary, weight: FontWeight.w600)),
      ),
    );
    return fullWidth ? SizedBox(width: double.infinity, child: button) : button;
  }
}

enum ChipVariant { primary, secondary }

/// Small pill, ports `.chip` / `.chip-primary` / `.chip-secondary`.
class AppChip extends StatelessWidget {
  const AppChip(this.label, {super.key, this.variant = ChipVariant.primary, this.fontPercent = 1.7});
  final String label;
  final ChipVariant variant;
  final double fontPercent;

  @override
  Widget build(BuildContext context) {
    final isPrimary = variant == ChipVariant.primary;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: context.wp(2.2), vertical: context.hp(0.7)),
      decoration: BoxDecoration(
        color: isPrimary ? AppColors.primaryTint : AppColors.secondary.withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(context.chipRadius),
      ),
      child: Text(
        label,
        style: AppText.body(
          context,
          percent: fontPercent,
          color: isPrimary ? AppColors.accent : AppColors.text,
          weight: FontWeight.w600,
          height: 1.0,
        ),
      ),
    );
  }
}

/// Label above a form field, ports `.field-label`.
class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: context.hp(0.8)),
      child: Text(text, style: AppText.body(context, percent: 1.7, color: AppColors.primary, weight: FontWeight.w600)),
    );
  }
}

InputDecoration fieldDecoration(BuildContext context, {String? placeholder, Widget? suffixIcon}) {
  return InputDecoration(
    hintText: placeholder,
    hintStyle: AppText.body(context, percent: 1.8, color: AppColors.primary.withValues(alpha: 0.6)),
    filled: true,
    fillColor: AppColors.white,
    suffixIcon: suffixIcon,
    contentPadding: EdgeInsets.symmetric(horizontal: context.wp(3), vertical: context.hp(1.6)),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(context.fieldRadius),
      borderSide: const BorderSide(color: AppColors.primary25),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(context.fieldRadius),
      borderSide: const BorderSide(color: AppColors.primary25),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(context.fieldRadius),
      borderSide: const BorderSide(color: AppColors.accent, width: 1.6),
    ),
  );
}

/// Text field, ports `.field-input` when used for free text.
class FieldInput extends StatelessWidget {
  const FieldInput({
    super.key,
    this.controller,
    this.placeholder,
    this.obscureText = false,
    this.keyboardType,
    this.suffixIcon,
    this.maxLines = 1,
    this.readOnly = false,
    this.onTap,
  });

  final TextEditingController? controller;
  final String? placeholder;
  final bool obscureText;
  final TextInputType? keyboardType;
  final Widget? suffixIcon;
  final int maxLines;
  final bool readOnly;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      maxLines: maxLines,
      readOnly: readOnly,
      onTap: onTap,
      style: AppText.body(context, percent: 1.9),
      decoration: fieldDecoration(context, placeholder: placeholder, suffixIcon: suffixIcon),
    );
  }
}

/// Dropdown, ports `.field-input` when used as a `<select>`.
class FieldSelect extends StatelessWidget {
  const FieldSelect({
    super.key,
    required this.options,
    required this.placeholder,
    this.value,
    required this.onChanged,
  });

  final List<String> options;
  final String placeholder;
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      isExpanded: true,
      icon: Icon(Icons.keyboard_arrow_down_rounded, size: context.sp(2.6, min: 16, max: 24), color: AppColors.primary),
      style: AppText.body(context, percent: 1.9, color: AppColors.text),
      decoration: fieldDecoration(context, placeholder: placeholder),
      hint: Text(placeholder, style: AppText.body(context, percent: 1.8, color: AppColors.primary.withValues(alpha: 0.6))),
      items: options
          .map((o) => DropdownMenuItem(value: o, child: Text(o, overflow: TextOverflow.ellipsis)))
          .toList(),
      onChanged: onChanged,
    );
  }
}

/// Card that highlights when selected, ports `.selectable-card` / `.selected`.
class SelectableCard extends StatelessWidget {
  const SelectableCard({
    super.key,
    required this.child,
    required this.selected,
    required this.onTap,
    this.padding,
  });

  final Widget child;
  final bool selected;
  final VoidCallback onTap;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: padding ?? EdgeInsets.symmetric(horizontal: context.wp(2.6), vertical: context.hp(2)),
        decoration: BoxDecoration(
          color: selected ? AppColors.primaryTint : AppColors.white,
          borderRadius: BorderRadius.circular(context.fieldRadius * 1.3),
          border: Border.all(color: selected ? AppColors.accent : AppColors.primary25, width: 1.4),
          boxShadow: selected ? AppColors.shadowSoft : null,
        ),
        child: child,
      ),
    );
  }
}

/// On/off pill switch, ports the hand-rolled `Toggle` component.
class ToggleSwitch extends StatelessWidget {
  const ToggleSwitch({super.key, required this.on});
  final bool on;

  @override
  Widget build(BuildContext context) {
    final w = context.wp(9.5).clamp(38.0, 50.0);
    final h = w * 0.5;
    final knob = h - 6;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: w,
      height: h,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: on ? AppColors.accent : AppColors.primary25,
        borderRadius: BorderRadius.circular(h),
      ),
      child: AnimatedAlign(
        duration: const Duration(milliseconds: 200),
        alignment: on ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          width: knob,
          height: knob,
          decoration: const BoxDecoration(color: AppColors.white, shape: BoxShape.circle, boxShadow: [
            BoxShadow(color: Color(0x33000000), blurRadius: 4, offset: Offset(0, 1)),
          ]),
        ),
      ),
    );
  }
}

/// Circular progress ring with a centered percentage label, ports the
/// hand-rolled `ScoreRing` SVG component.
class ScoreRing extends StatelessWidget {
  const ScoreRing({super.key, required this.score, required this.size});
  final int score;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: Size(size, size),
            painter: _ScoreRingPainter(score: score, strokeWidth: size < 80 ? size * 0.075 : size * 0.067),
          ),
          Text(
            '$score%',
            style: AppText.display(context, percent: size < 80 ? 2.6 : 4.0, min: 13, max: 30),
          ),
        ],
      ),
    );
  }
}

class _ScoreRingPainter extends CustomPainter {
  _ScoreRingPainter({required this.score, required this.strokeWidth});
  final int score;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;
    final track = Paint()
      ..color = AppColors.primaryTint
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;
    final fill = Paint()
      ..color = AppColors.accent
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, track);
    final sweep = 2 * math.pi * (score / 100);
    canvas.drawArc(Rect.fromCircle(center: center, radius: radius), -math.pi / 2, sweep, false, fill);
  }

  @override
  bool shouldRepaint(covariant _ScoreRingPainter oldDelegate) =>
      oldDelegate.score != score || oldDelegate.strokeWidth != strokeWidth;
}

/// The wordmark bridge icon, ports the hand-rolled `BridgeMark` SVG.
class BridgeMark extends StatelessWidget {
  const BridgeMark({super.key, required this.size});
  final double size;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      'assets/logo.svg', // Ensure this matches the path in your pubspec.yaml
      width: size,
      height: size * 0.65,
      fit: BoxFit.contain, // Ensures the SVG scales correctly within the bounds
    );
  }
}


/// Slide/fade transition between "steps", ports `.screen-enter-forward` /
/// `.screen-enter-back`.
class StepTransition extends StatelessWidget {
  const StepTransition({super.key, required this.animKey, required this.forward, required this.child});
  final Object animKey;
  final bool forward;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 300),
      transitionBuilder: (child, animation) {
        final offset = Tween<Offset>(
          begin: Offset(forward ? 0.06 : -0.06, 0),
          end: Offset.zero,
        ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOut));
        return FadeTransition(opacity: animation, child: SlideTransition(position: offset, child: child));
      },
      child: KeyedSubtree(key: ValueKey(animKey), child: child),
    );
  }
}

/// Blurs [child] while [blurred] is true, ports `.blur-results`.
class BlurWhen extends StatelessWidget {
  const BlurWhen({super.key, required this.blurred, required this.child});
  final bool blurred;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      duration: const Duration(milliseconds: 250),
      opacity: blurred ? 0.5 : 1,
      child: ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: blurred ? 8 : 0, sigmaY: blurred ? 8 : 0),
        child: IgnorePointer(ignoring: blurred, child: child),
      ),
    );
  }
}
