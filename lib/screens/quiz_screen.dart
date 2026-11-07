import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../responsive.dart';
import '../theme/text_styles.dart';
import '../theme/widgets.dart';
import '../i18n.dart';
import '../api_service.dart';

class QuizScreen extends StatefulWidget {
  const QuizScreen({
    super.key,
    required this.lang,
    required this.onDone,
  });

  final Lang lang;

  /// Called once the quiz is finished.
  final VoidCallback onDone;

  @override
  State<QuizScreen> createState() => _QuizScreenState();
}

enum _Phase { loading, question, error }

class _QuizScreenState extends State<QuizScreen> {
  final JaamatiApi _api = JaamatiApi();

  _Phase _phase = _Phase.loading;
  Map<String, dynamic>? _question;
  bool _isFinalQuestion = false;
  int? _selected;
  int _answeredCount = 0;
  int _animKey = 0;
  bool _submitting = false;
  String? _errorMessage;
  VoidCallback? _pendingRetry;

  QuizStrings get _s => stringsFor(widget.lang).quiz;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final hasUser = await _ensureUserId();
    if (!hasUser) {
      _showError(_s.loadError, _bootstrap);
      return;
    }
    await _loadNextQuestion();
  }

  /// The device token is normally already set by the time the app reaches
  /// this screen (AppState mints/loads it up front, before the router lets
  /// you go anywhere past splash), and the profile step's answers are sent
  /// to `/quiz/init` on the /initializing screen before this one is ever
  /// shown. This just guards against arriving here without either anyway —
  /// e.g. a deep link that skipped onboarding.
  Future<bool> _ensureUserId() async {
    if (_api.currentUserId != null) return true;
    try {
      await _api.ensureDeviceToken();
      return await _api.initializeUser({
        'age': 0,
        'gender': '',
        'income': '',
        'city': '',
        'religion': '',
        'language': widget.lang.name,
        'gpa': 0.0,
        'hs': '',
        'mbti': '',
        'career_goal': '',
        'app_version': 'unknown',
        'prefer_close': false,
      });
    } catch (e) {
      debugPrint('Quiz session init failed: $e');
      return false;
    }
  }

  /// Pulls the next question one at a time. The backend decides adaptively
  /// how many questions there will be in total, so there's no fixed count
  /// to loop over — we just keep asking for "next" until it says we're done.
  Future<void> _loadNextQuestion() async {
    setState(() {
      _phase = _Phase.loading;
      _selected = null;
      _submitting = false; // Reset submitting so the button un-greys for the new question
    });

    final result = await _api.getNextQuestion();
    if (!mounted) return;

    if (result == null) {
      _showError(_s.loadError, _loadNextQuestion);
      return;
    }

    final status = result['status'] as String?;
    final questionData = result['question_data'];

    // The backend can stop the assessment outright (no more questions to
    // ask) instead of ever returning a "final_question" — treat both the
    // same way.
    if (status == 'completed' || questionData == null) {
      _finishQuiz();
      return;
    }

    setState(() {
      _question = Map<String, dynamic>.from(questionData as Map);
      _isFinalQuestion = status == 'final_question';
      _phase = _Phase.question;
      _animKey++;
    });
  }

  Future<void> _handleNext() async {
    if (_selected == null || _submitting) return;

    final answerValue = _selected! + 1; // options render as a 1..N scale
    final wasFinal = _isFinalQuestion;

    setState(() => _submitting = true);
    final ok = await _api.processAnswer(answerValue);
    if (!mounted) return;

    if (!ok) {
      setState(() => _submitting = false);
      _showError(_s.submitError, _handleNext);
      return;
    }

    _answeredCount++;

    if (wasFinal) {
      // This was flagged as the last question — no need to call next_q
      // again just to be told the assessment is complete.
      _finishQuiz();
    } else {
      await _loadNextQuestion();
    }
  }

  void _finishQuiz() {
    widget.onDone();
  }

  void _showError(String message, VoidCallback retryAction) {
    if (!mounted) return;
    setState(() {
      _phase = _Phase.error;
      _errorMessage = message;
      _submitting = false;
      _pendingRetry = retryAction;
    });
  }

  void _retry() => _pendingRetry?.call();

  /// The backend's `concept_vectors` documents carry the question under
  /// `question` (in English — that's the text the scoring model itself was
  /// built against) and a numeric `id`. We show a localized version keyed
  /// by that `id` when we have one, and fall back to the server's own text
  /// otherwise (this is also what always happens in English).
  String _questionText(Map<String, dynamic> q) {
    final raw = (q['question'] ?? '').toString();
    final id = q['id'];
    if (id is int) return _s.translateQuestion(raw, id);
    return raw;
  }

  @override
  Widget build(BuildContext context) {
    switch (_phase) {
      case _Phase.error:
        return _MessageView(
          title: _errorMessage ?? _s.loadError,
          primaryLabel: _s.retry,
          onPrimary: _retry,
        );
      case _Phase.loading:
        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(),
              SizedBox(height: context.hp(2)),
              Text(_s.loadingQuestion, style: AppText.body(context, percent: 1.8, color: AppColors.primary)),
            ],
          ),
        );
      case _Phase.question:
        return _buildQuestion(context);
    }
  }

  Widget _buildQuestion(BuildContext context) {
    final s = _s;
    final questionText = _questionText(_question!);

    return SingleChildScrollView(
      padding: EdgeInsets.symmetric(horizontal: context.wp(4), vertical: context.hp(4)),
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: context.wp(60).clamp(320, 760)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  AppChip(s.section),
                  Text('${s.questionLabel} ${_answeredCount + 1}',
                      style: AppText.body(context, percent: 1.7, color: AppColors.primary)),
                ],
              ),
              SizedBox(height: context.hp(3)),
              StepTransition(
                animKey: _animKey,
                forward: true,
                child: AppCard(
                  padding: EdgeInsets.symmetric(horizontal: context.wp(4), vertical: context.hp(4)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        questionText,
                        textAlign: TextAlign.center,
                        style: AppText.body(context, percent: 2.6, weight: FontWeight.w600),
                      ),
                      SizedBox(height: context.hp(3.5)),
                      Row(
                        children: [
                          for (var i = 0; i < s.options.length; i++) ...[
                            if (i != 0) SizedBox(width: context.wp(1)),
                            Expanded(
                              child: _OptionCard(
                                number: i + 1,
                                label: s.options[i],
                                selected: _selected == i,
                                onTap: () => setState(() => _selected = i),
                              ),
                            ),
                          ],
                        ],
                      ),
                      SizedBox(height: context.hp(3)),
                      Align(
                        alignment: Alignment.centerRight,
                        child: PrimaryButton(
                          label: _isFinalQuestion ? s.finish : s.next,
                          onPressed: (_selected == null || _submitting) ? null : _handleNext,
                        ),
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

class _OptionCard extends StatelessWidget {
  const _OptionCard({required this.number, required this.label, required this.selected, required this.onTap});
  final int number;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dotSize = context.wp(7).clamp(28.0, 36.0);
    return SelectableCard(
      selected: selected,
      onTap: onTap,
      padding: EdgeInsets.symmetric(vertical: context.hp(2), horizontal: context.wp(1)),
      child: Column(
        children: [
          Container(
            width: dotSize,
            height: dotSize,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? AppColors.accent : AppColors.primaryTint,
              shape: BoxShape.circle,
            ),
            child: Text(
              selected ? '✓' : '$number',
              style: AppText.display(context, percent: 1.9, color: selected ? Colors.white : AppColors.primary, min: 12, max: 16),
            ),
          ),
          SizedBox(height: context.hp(1)),
          Text(
            label,
            textAlign: TextAlign.center,
            style: AppText.body(context, percent: 1.35, color: selected ? AppColors.accent : AppColors.primary, height: 1.3),
          ),
        ],
      ),
    );
  }
}

/// Shared full-screen message used for load/submit errors.
class _MessageView extends StatelessWidget {
  const _MessageView({
    required this.title,
    required this.primaryLabel,
    required this.onPrimary,
  });

  final String title;
  final String primaryLabel;
  final VoidCallback onPrimary;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: context.wp(6)),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: context.wp(60).clamp(280, 480)),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                textAlign: TextAlign.center,
                style: AppText.display(context, percent: 2.4, min: 18, max: 24),
              ),
              SizedBox(height: context.hp(3)),
              PrimaryButton(label: primaryLabel, onPressed: onPrimary),
            ],
          ),
        ),
      ),
    );
  }
}