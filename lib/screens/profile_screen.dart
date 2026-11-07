import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../theme/colors.dart';
import '../responsive.dart';
import '../theme/text_styles.dart';
import '../theme/widgets.dart';
import '../i18n.dart';
import '../profile_data.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.lang, required this.onDone});
  final Lang lang;

  /// Called once the profile answers are validated and ready. Carries the
  /// same JSON shape the backend's `/quiz/init` call expects — the caller
  /// (now the /initializing route) makes that actual network call, so it
  /// can be paced and retried by LoadingScreen instead of blocking this
  /// screen's submit button.
  final ValueChanged<Map<String, dynamic>> onDone;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  int _step = 0;
  bool _forward = true;
  int _animKey = 0;
  bool _submitting = false;

  /// Answers for all three steps. Lives here (not in the step widgets) so it
  /// survives Back/Next and language switches.
  final ProfileData _data = ProfileData();

  /// Returns a localized message if [step] isn't complete, otherwise null.
  String? _validate(int step, ProfileMessages m) {
    final d = _data;
    switch (step) {
      case 0:
        if (!d.aboutYouComplete) return m.incomplete;
        if (d.preferClose && !d.hasLocation) return m.locationNeeded;
        return null;
      case 1:
        if (d.gpaText.trim().isEmpty || d.track == null) return m.incomplete;
        return d.gpa == null ? m.gpaInvalid : null;
      default:
        return d.careerGoal == null ? m.incomplete : null;
    }
  }

  Future<void> _goNext() async {
    if (_submitting) return;

    final error = _validate(_step, stringsFor(widget.lang).profile.messages);
    if (error != null) {
      _toast(context, error);
      return;
    }

    if (_step < 2) {
      setState(() {
        _forward = true;
        _animKey++;
        _step++;
      });
    } else {
      await _submit();
    }
  }

  void _goBack() {
    if (_submitting || _step == 0) return;
    setState(() {
      _forward = false;
      _animKey++;
      _step--;
    });
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    final version = await _appVersion();
    if (!mounted) return;
    // Stay in the "saving" state while the route changes so a second tap
    // can't queue this twice. The actual (potentially slow) /quiz/init
    // call now happens on the next screen, where LoadingScreen can pace
    // it and retry it safely instead of this button racing a 90s request.
    widget.onDone(_data.toJson(appVersion: version));
  }

  @override
  Widget build(BuildContext context) {
    final s = stringsFor(widget.lang);
    final p = s.profile;
    final isRtl = widget.lang == Lang.ar;

    final stepper = _StepperColumn(steps: p.steps, current: _step);

    final content = AppCard(
      padding: EdgeInsets.symmetric(horizontal: context.wp(3.4), vertical: context.hp(3.4)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(p.steps[_step], style: AppText.display(context, percent: 3.4, min: 18, max: 28)),
          SizedBox(height: context.hp(2.4)),
          StepTransition(
            animKey: _animKey,
            forward: _forward,
            child: _step == 0
                ? _Step1(lang: widget.lang, data: _data)
                : _step == 1
                    ? _Step2(lang: widget.lang, data: _data)
                    : _Step3(lang: widget.lang, data: _data),
          ),
          SizedBox(height: context.hp(2)),
          Row(
            textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              GhostButton(label: p.back, onPressed: _goBack, visible: _step != 0),
              PrimaryButton(
                label: _submitting ? p.messages.saving : (_step == 2 ? p.step3.startQuiz : p.next),
                onPressed: () {
                  if (!_submitting) _goNext();
                },
              ),
            ],
          ),
        ],
      ),
    );

    return SingleChildScrollView(
      padding: EdgeInsets.symmetric(horizontal: context.wp(4), vertical: context.hp(3)),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: context.wp(78).clamp(320, 1120)),
        child: LayoutBuilder(
          builder: (context, constraints) {
            if (context.isWide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(width: context.wp(15).clamp(160, 240), child: stepper),
                  SizedBox(width: context.wp(3.5)),
                  Expanded(child: content),
                ],
              );
            }
            return Column(children: [
              _StepperRow(steps: p.steps, current: _step),
              SizedBox(height: context.hp(2.4)),
              content,
            ]);
          },
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

void _toast(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message), behavior: SnackBarBehavior.floating));
}

String _formatDate(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// The option label for a stored index (null when nothing is selected).
String? _labelAt(List<String> options, int? index) =>
    (index == null || index < 0 || index >= options.length) ? null : options[index];

/// The stored index for a picked label.
int? _indexOf(List<String> options, String? label) {
  if (label == null) return null;
  final i = options.indexOf(label);
  return i < 0 ? null : i;
}

/// Sent to the backend as `app_version`.
Future<String> _appVersion() async {
  try {
    return (await PackageInfo.fromPlatform()).version;
  } catch (e) {
    debugPrint('App version unavailable: $e');
    return 'unknown';
  }
}

/// Current device position, or null if services are off, permission is
/// denied, or the lookup fails/times out.
Future<Position?> _currentPosition() async {
  try {
    if (!await Geolocator.isLocationServiceEnabled()) return null;

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      return null;
    }

    return await Geolocator.getCurrentPosition().timeout(const Duration(seconds: 15));
  } catch (e) {
    debugPrint('Location error: $e');
    return null;
  }
}

class _StepperColumn extends StatelessWidget {
  const _StepperColumn({required this.steps, required this.current});
  final List<String> steps;
  final int current;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                children: [
                  _StepDot(index: i, done: i < current, active: i == current),
                  if (i < steps.length - 1)
                    Container(
                      width: 2,
                      height: context.hp(6),
                      margin: EdgeInsets.symmetric(vertical: context.hp(0.5)),
                      color: i < current ? AppColors.accent : AppColors.primary25,
                    ),
                ],
              ),
              SizedBox(width: context.wp(1.6)),
              Padding(
                padding: EdgeInsets.only(top: context.hp(0.8)),
                child: Text(
                  steps[i],
                  style: i == current
                      ? AppText.display(context, percent: 2.2, min: 14, max: 18)
                      : AppText.body(context, percent: 1.9, color: i < current ? AppColors.text : AppColors.primary),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _StepperRow extends StatelessWidget {
  const _StepperRow({required this.steps, required this.current});
  final List<String> steps;
  final int current;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          _StepDot(index: i, done: i < current, active: i == current),
          if (i < steps.length - 1)
            Expanded(
              child: Container(height: 2, margin: EdgeInsets.symmetric(horizontal: context.wp(1)), color: i < current ? AppColors.accent : AppColors.primary25),
            ),
        ],
      ],
    );
  }
}

class _StepDot extends StatelessWidget {
  const _StepDot({required this.index, required this.done, required this.active});
  final int index;
  final bool done;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final size = context.wp(8).clamp(30.0, 40.0);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: done ? AppColors.accent : (active ? AppColors.primary : AppColors.primaryTint),
        border: active ? Border.all(color: AppColors.accent, width: 2) : null,
      ),
      child: Text(
        done ? '✓' : '${index + 1}',
        style: AppText.display(context, percent: 2, color: (done || active) ? Colors.white : AppColors.primary, min: 13, max: 17),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Step 1 — About you
// ---------------------------------------------------------------------------

class _Step1 extends StatefulWidget {
  const _Step1({required this.lang, required this.data});
  final Lang lang;
  final ProfileData data;

  @override
  State<_Step1> createState() => _Step1State();
}

class _Step1State extends State<_Step1> {
  final _dateController = TextEditingController();
  bool _locating = false;

  ProfileData get _d => widget.data;

  @override
  void initState() {
    super.initState();
    // Restore the date text when returning to this step.
    final dob = _d.birthDate;
    if (dob != null) _dateController.text = _formatDate(dob);
  }

  @override
  void dispose() {
    _dateController.dispose();
    super.dispose();
  }

  Future<void> _useLocation() async {
    setState(() => _locating = true);
    final position = await _currentPosition();
    if (!mounted) return;
    setState(() {
      _locating = false;
      if (position != null) {
        _d.lat = position.latitude;
        _d.lon = position.longitude;
      }
    });
    if (position == null) {
      _toast(context, stringsFor(widget.lang).profile.messages.locationUnavailable);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = stringsFor(widget.lang).profile.step1;
    final m = stringsFor(widget.lang).profile.messages;
    final wide = context.isWide;
    final genders = [s.female, s.male];

    Widget row(Widget a, Widget b) => wide
        ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: a),
            SizedBox(width: context.wp(2.4)),
            Expanded(child: b),
          ])
        : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [a, SizedBox(height: context.hp(1.8)), b]);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        row(
          _Field(
            label: s.birthDate,
            child: FieldInput(
              placeholder: s.birthDate,
              readOnly: true,
              suffixIcon: const Icon(Icons.calendar_today_rounded, size: 18),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _d.birthDate ?? DateTime(2006, 1, 1),
                  firstDate: DateTime(1970),
                  lastDate: DateTime.now(),
                );
                if (picked == null || !mounted) return;
                setState(() {
                  _d.birthDate = picked;
                  _dateController.text = _formatDate(picked);
                });
              },
              controller: _dateController,
            ),
          ),
          _Field(
            label: s.gender,
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(color: AppColors.primaryTint, borderRadius: BorderRadius.circular(context.fieldRadius)),
              child: Row(children: [
                for (var i = 0; i < genders.length; i++)
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _d.gender = i),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: EdgeInsets.symmetric(vertical: context.hp(1.2)),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _d.gender == i ? AppColors.white : Colors.transparent,
                          borderRadius: BorderRadius.circular(context.fieldRadius * 0.7),
                          boxShadow: _d.gender == i ? AppColors.shadowSoft : null,
                        ),
                        child: Text(genders[i], style: AppText.body(context, percent: 1.9, color: _d.gender == i ? AppColors.accent : AppColors.primary)),
                      ),
                    ),
                  ),
              ]),
            ),
          ),
        ),
        SizedBox(height: context.hp(1.8)),
        row(
          _Field(
            label: s.city,
            child: FieldSelect(
              options: s.cities,
              placeholder: s.city,
              value: _labelAt(s.cities, _d.city),
              onChanged: (v) => setState(() => _d.city = _indexOf(s.cities, v)),
            ),
          ),
          _Field(
            label: s.religion,
            child: FieldSelect(
              options: s.religions,
              placeholder: s.religion,
              value: _labelAt(s.religions, _d.religion),
              onChanged: (v) => setState(() => _d.religion = _indexOf(s.religions, v)),
            ),
          ),
        ),
        SizedBox(height: context.hp(1.8)),
        row(
          _Field(
            label: s.language,
            child: FieldSelect(
              options: s.languages,
              placeholder: s.language,
              value: _labelAt(s.languages, _d.language),
              onChanged: (v) => setState(() => _d.language = _indexOf(s.languages, v)),
            ),
          ),
          _Field(
            label: s.income,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              FieldSelect(
                options: s.incomeLevels,
                placeholder: s.income,
                value: _labelAt(s.incomeLevels, _d.income),
                onChanged: (v) => setState(() => _d.income = _indexOf(s.incomeLevels, v)),
              ),
              SizedBox(height: context.hp(0.8)),
              Text(s.incomeHelper, style: AppText.body(context, percent: 1.5, color: AppColors.primary)),
            ]),
          ),
        ),
        SizedBox(height: context.hp(1.8)),
        SelectableCard(
          selected: false,
          onTap: () => setState(() => _d.preferClose = !_d.preferClose),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Expanded(child: Text(s.closeUni, style: AppText.body(context, percent: 1.9))),
              ToggleSwitch(on: _d.preferClose),
            ]),
            if (_d.preferClose) ...[
              SizedBox(height: context.hp(1.4)),
              SecondaryButton(
                label: _d.hasLocation ? '✓ ${m.locationSaved}' : '📍 ${s.useLocation}',
                onPressed: () {
                  if (!_locating) _useLocation();
                },
              ),
            ],
          ]),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Studies
// ---------------------------------------------------------------------------

class _Step2 extends StatefulWidget {
  const _Step2({required this.lang, required this.data});
  final Lang lang;
  final ProfileData data;

  @override
  State<_Step2> createState() => _Step2State();
}

class _Step2State extends State<_Step2> {
  late final TextEditingController _gpaController;

  ProfileData get _d => widget.data;

  @override
  void initState() {
    super.initState();
    // Seed from the shared model and write every edit back to it.
    _gpaController = TextEditingController(text: _d.gpaText)
      ..addListener(() => _d.gpaText = _gpaController.text);
  }

  @override
  void dispose() {
    _gpaController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = stringsFor(widget.lang).profile.step2;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Field(
          label: s.gpa,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            FieldInput(
              placeholder: '50–105',
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              controller: _gpaController,
            ),
            SizedBox(height: context.hp(0.8)),
            Text(s.gpaHelper, style: AppText.body(context, percent: 1.5, color: AppColors.primary)),
          ]),
        ),
        SizedBox(height: context.hp(2.2)),
        _Field(
          label: s.track,
          child: Row(children: [
            for (var i = 0; i < s.tracks.length; i++) ...[
              if (i != 0) SizedBox(width: context.wp(1.6)),
              Expanded(
                child: SelectableCard(
                  selected: _d.track == i,
                  onTap: () => setState(() => _d.track = i),
                  padding: EdgeInsets.symmetric(vertical: context.hp(2.2)),
                  child: Column(children: [
                    Text(i == 0 ? '🔬' : (i == 1 ? '📖' : '🎨'), style: TextStyle(fontSize: context.sp(3.2, min: 20, max: 30))),
                    SizedBox(height: context.hp(0.8)),
                    Text(s.tracks[i], style: AppText.display(context, percent: 2.2, color: _d.track == i ? AppColors.accent : AppColors.text, min: 14, max: 18)),
                  ]),
                ),
              ),
            ],
          ]),
        ),
        SizedBox(height: context.hp(2.2)),
        _Field(
          label: s.mbti,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            FieldSelect(
              options: s.mbtiTypes,
              placeholder: s.mbti,
              value: _labelAt(s.mbtiTypes, _d.mbti),
              onChanged: (v) => setState(() => _d.mbti = _indexOf(s.mbtiTypes, v)),
            ),
            SizedBox(height: context.hp(0.8)),
            Text(s.mbtiHelper, style: AppText.body(context, percent: 1.5, color: AppColors.accent)),
          ]),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Goals
// ---------------------------------------------------------------------------

class _Step3 extends StatefulWidget {
  const _Step3({required this.lang, required this.data});
  final Lang lang;
  final ProfileData data;

  @override
  State<_Step3> createState() => _Step3State();
}

class _Step3State extends State<_Step3> {
  @override
  Widget build(BuildContext context) {
    final s = stringsFor(widget.lang).profile.step3;
    final d = widget.data;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(s.priority, style: AppText.body(context, percent: 1.9, color: AppColors.primary)),
        SizedBox(height: context.hp(1.8)),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: context.wp(1.6),
          mainAxisSpacing: context.hp(1.6),
          childAspectRatio: 1.05,
          children: s.priorities.asMap().entries.map((entry) {
            final i = entry.key;
            final p = entry.value;
            final selected = d.careerGoal == i;
            return SelectableCard(
              selected: selected,
              onTap: () => setState(() => d.careerGoal = i),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p.icon, style: TextStyle(fontSize: context.sp(3.6, min: 22, max: 34))),
                  SizedBox(height: context.hp(0.8)),
                  Text(p.label, style: AppText.display(context, percent: 2.4, color: selected ? AppColors.accent : AppColors.text, min: 15, max: 19)),
                  SizedBox(height: context.hp(0.6)),
                  Expanded(
                    child: Text(p.desc, style: AppText.body(context, percent: 1.5, color: AppColors.primary), overflow: TextOverflow.fade),
                  ),
                  if (selected)
                    Align(
                      alignment: Alignment.bottomRight,
                      child: Container(
                        width: 22,
                        height: 22,
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(color: AppColors.accent, shape: BoxShape.circle),
                        child: const Text('✓', style: TextStyle(color: Colors.white, fontSize: 12)),
                      ),
                    ),
                ],
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.child});
  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [FieldLabel(label), child]);
  }
}