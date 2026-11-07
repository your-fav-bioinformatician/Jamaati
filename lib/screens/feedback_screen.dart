import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../responsive.dart';
import '../theme/text_styles.dart';
import '../theme/widgets.dart';
import '../i18n.dart';

const _kFaces = ['😔', '😐', '😊', '🤩'];

class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key, required this.lang});
  final Lang lang;

  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  int? _selected;
  bool _submitted = false;
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = stringsFor(widget.lang).feedback;

    if (_submitted) {
      return Center(
        child: AppCard(
          padding: EdgeInsets.symmetric(horizontal: context.wp(4), vertical: context.hp(6)),
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: context.wp(30).clamp(280, 440)),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: 1),
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeOut,
                  builder: (context, value, child) => Transform.scale(scale: value, child: child),
                  child: Container(
                    width: context.wp(11).clamp(56, 80),
                    height: context.wp(11).clamp(56, 80),
                    decoration: const BoxDecoration(color: AppColors.secondary, shape: BoxShape.circle),
                    alignment: Alignment.center,
                    child: Text('✓', style: TextStyle(fontSize: context.sp(3.2, min: 22, max: 34))),
                  ),
                ),
                SizedBox(height: context.hp(2.4)),
                Text(s.thankYou, textAlign: TextAlign.center, style: AppText.display(context, percent: 3, min: 18, max: 26)),
                SizedBox(height: context.hp(1)),
                Text(s.thankYouSub, textAlign: TextAlign.center, style: AppText.body(context, percent: 1.9)),
              ],
            ),
          ),
        ),
      );
    }

    return Center(
      child: SingleChildScrollView(
        padding: EdgeInsets.symmetric(horizontal: context.wp(4), vertical: context.hp(4)),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: context.wp(34).clamp(320, 520)),
          child: AppCard(
            padding: EdgeInsets.symmetric(horizontal: context.wp(3.4), vertical: context.hp(4.4)),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(s.title, textAlign: TextAlign.center, style: AppText.display(context, percent: 2.8, min: 17, max: 22)),
                SizedBox(height: context.hp(3.4)),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(_kFaces.length, (i) {
                    final selected = _selected == i;
                    return Padding(
                      padding: EdgeInsets.symmetric(horizontal: context.wp(1.2)),
                      child: HoverLift(
                        scale: 1.08,
                        builder: (context, hovering) => GestureDetector(
                          onTap: () => setState(() => _selected = i),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            padding: EdgeInsets.all(context.wp(1.6)),
                            decoration: BoxDecoration(
                              color: selected ? AppColors.primaryTint : Colors.transparent,
                              shape: BoxShape.circle,
                              border: selected ? Border.all(color: AppColors.primary, width: 2) : null,
                              boxShadow: selected ? AppColors.shadowSoft : null,
                            ),
                            transform: Matrix4.diagonal3Values(
                              selected ? 1.18 : 1.0, // X scale
                              selected ? 1.18 : 1.0, // Y scale
                              1.0,                   // Z scale (keep at 1.0 for 2D UI)
                            ),
                            transformAlignment: Alignment.center,
                            child: Text(_kFaces[i], style: TextStyle(fontSize: context.sp(4.4, min: 26, max: 40))),
                          ),
                        ),
                      ),
                    );
                  }),
                ),
                SizedBox(height: context.hp(3.4)),
                FieldLabel(s.optional),
                FieldInput(controller: _controller, maxLines: 4, placeholder: '…'),
                SizedBox(height: context.hp(3)),
                Center(child: PrimaryButton(label: s.submit, onPressed: _selected == null ? null : () => setState(() => _submitted = true))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
