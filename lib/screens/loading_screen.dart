import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import '../theme/colors.dart';
import '../responsive.dart';
import '../theme/text_styles.dart';
import '../theme/widgets.dart';
import '../i18n.dart';

/// A loading screen that waits on whatever async [task] its caller hands
/// it, and paces its own progress bar off that task's *real* lifecycle:
///
/// - While [task] is in flight, progress creeps toward (but never quite
///   reaches) a cap. [estimatedDuration] only tunes how fast it creeps —
///   it's a feel knob, not a deadline. A task that finishes sooner just
///   finishes sooner; one that runs long never gets stuck looking done.
/// - The instant [task] resolves, the bar snaps the rest of the way to
///   full, then [onDone] fires with the real result.
/// - If [task] throws, it goes to [onError] if given, otherwise this
///   screen shows its own inline retry state.
///
/// This has no knowledge of results, quizzes, or any specific endpoint —
/// any screen that needs "spin while an async thing happens, then go
/// somewhere with the answer" can reuse it as-is.
class LoadingScreen<T> extends StatefulWidget {
  const LoadingScreen({
    super.key,
    required this.lang,
    required this.task,
    required this.onDone,
    this.onError,
    this.estimatedDuration = const Duration(milliseconds: 2200),
  });

  final Lang lang;

  /// Started once when this screen mounts (and again on retry after an
  /// error). A factory rather than a bare [Future] so retry can actually
  /// re-run the work instead of re-awaiting an already-settled Future.
  final Future<T> Function() task;

  final ValueChanged<T> onDone;

  /// Called for any error. If omitted, LoadingScreen shows its own
  /// minimal retry UI instead of failing silently.
  final void Function(Object error, StackTrace stackTrace)? onError;

  /// Roughly how long [task] is expected to take. Only shapes the pace of
  /// the progress bar's creep — never a timeout, never blocks completion.
  final Duration estimatedDuration;

  @override
  State<LoadingScreen<T>> createState() => _LoadingScreenState<T>();
}

class _LoadingScreenState<T> extends State<LoadingScreen<T>> with TickerProviderStateMixin {
  late final AnimationController _shimmer;
  late final AnimationController _finish;
  late final Ticker _ticker;
  final Stopwatch _stopwatch = Stopwatch();

  double _progress = 0.0;
  bool _settling = false; // true once the task resolved, while _finish plays
  Object? _error;

  static const double _asymptoteCap = 0.92;

  @override
  void initState() {
    super.initState();
    _shimmer = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();
    _finish = AnimationController(vsync: this, duration: const Duration(milliseconds: 260));
    _ticker = createTicker(_onTick);
    _run();
  }

  @override
  void dispose() {
    _ticker.dispose();
    _shimmer.dispose();
    _finish.dispose();
    super.dispose();
  }

  void _onTick(Duration _) {
    if (!mounted || _settling) return;
    final seconds = _stopwatch.elapsedMilliseconds / 1000.0;
    final halfLife = math.max(0.35, widget.estimatedDuration.inMilliseconds / 1000 * 0.5);
    final next = _asymptoteCap * (1 - math.exp(-seconds / halfLife));
    setState(() => _progress = next);
  }

  Future<void> _run() async {
    setState(() {
      _error = null;
      _settling = false;
      _progress = 0.0;
    });
    _stopwatch
      ..reset()
      ..start();
    _ticker.start();

    try {
      final result = await widget.task();
      if (!mounted) return;
      await _settle();
      if (!mounted) return;
      widget.onDone(result);
    } catch (error, stack) {
      if (!mounted) return;
      _stopwatch.stop();
      _ticker.stop();
      if (widget.onError != null) {
        widget.onError!(error, stack);
        return;
      }
      setState(() => _error = error);
    }
  }

  /// Animates the bar the rest of the way to full, then holds briefly so
  /// "done" is actually visible before the caller navigates away.
  Future<void> _settle() async {
    _settling = true;
    _stopwatch.stop();
    _ticker.stop();
    final start = _progress;
    void listener() {
      if (!mounted) return;
      setState(() => _progress = start + (1.0 - start) * _finish.value);
    }

    _finish.addListener(listener);
    await _finish.forward(from: 0);
    _finish.removeListener(listener);
    await Future.delayed(const Duration(milliseconds: 180));
  }

  @override
  Widget build(BuildContext context) {
    final s = stringsFor(widget.lang);
    final barWidth = context.wp(34).clamp(200.0, 300.0);

    return Center(
      child: AppCard(
        padding: EdgeInsets.symmetric(horizontal: context.wp(4), vertical: context.hp(6)),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: context.wp(34).clamp(280, 480)),
          child: _error != null ? _buildError(context, s) : _buildLoading(context, s, barWidth),
        ),
      ),
    );
  }

  Widget _buildLoading(BuildContext context, dynamic s, double barWidth) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(s.loading, textAlign: TextAlign.center, style: AppText.display(context, percent: 2.6, min: 15, max: 22)),
        SizedBox(height: context.hp(2.4)),
        SizedBox(
          width: barWidth,
          height: context.hp(0.7).clamp(4, 8),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: Container(
              color: AppColors.primaryTint,
              child: Align(
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(
                  widthFactor: _progress.clamp(0.0, 1.0),
                  child: AnimatedBuilder(
                    animation: _shimmer,
                    builder: (context, _) {
                      return Stack(
                        fit: StackFit.expand,
                        children: [
                          const DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(colors: [AppColors.accent, AppColors.secondary, AppColors.accent]),
                            ),
                          ),
                          FractionallySizedBox(
                            alignment: Alignment(-1 + 2 * _shimmer.value, 0),
                            widthFactor: 0.6,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(colors: [
                                  Colors.white.withValues(alpha: 0),
                                  Colors.white.withValues(alpha: 0.35),
                                  Colors.white.withValues(alpha: 0),
                                ]),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildError(BuildContext context, dynamic s) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.error_outline, color: AppColors.accent, size: 40),
        SizedBox(height: context.hp(2)),
        Text(
          s.loadingError,
          textAlign: TextAlign.center,
          style: AppText.display(context, percent: 2.2, min: 13, max: 18),
        ),
        SizedBox(height: context.hp(2.4)),
        TextButton(onPressed: _run, child: Text(s.loadingRetry)),
      ],
    );
  }
}