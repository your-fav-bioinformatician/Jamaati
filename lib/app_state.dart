import 'package:flutter/widgets.dart';
import 'api_service.dart';
import 'i18n.dart';

class AppState extends ChangeNotifier {
  AppState() {
    _api.addListener(_onApiChanged);
    ready = _initDeviceIdentity();
  }

  final JaamatiApi _api = JaamatiApi();

  Lang _lang = Lang.ar;
  bool _deviceReady = false;

  // --- Universal State Flags ---
  bool _isRegistered = false;
  bool _isQuizComplete = false;
  Map<String, dynamic>? _userData;
  late final Future<void> ready;

  Lang get lang => _lang;

  /// True once the device token is available, so every screen past splash
  /// can be shown. There's no login/guest distinction any more — every
  /// install is its own anonymous, permanent identity from first launch.
   bool get deviceReady => _deviceReady;

  bool get isRegistered => _isRegistered;
  bool get isQuizComplete => _isQuizComplete;
  Map<String, dynamic>? get userData => _userData;

  TextDirection get textDirection =>
      _lang == Lang.ar ? TextDirection.rtl : TextDirection.ltr;

  Future<void> _initDeviceIdentity() async {
    try {
      await _api.ensureDeviceToken();

      // Fetch the global profile and quiz status right after resolving the token
      final status = await _api.checkUserStatus();
      debugPrint("Backend status fetched: $status");
      
      _isRegistered = status['is_registered'] == true;
      _isQuizComplete = status['is_complete'] == true;
      _userData = status['user_data'];
      
    } catch (e) {
      debugPrint('Device token / status init failed: $e');
    }

    _deviceReady = true;
    notifyListeners();
  }

  void _onApiChanged() => notifyListeners();

  @override
  void dispose() {
    _api.removeListener(_onApiChanged);
    super.dispose();
  }


  void toggleLang() {
    _lang = _lang == Lang.en ? Lang.ar : Lang.en;
    notifyListeners();
  }

  /// Fetches the current device's quiz results.
  Future<List<DeptMatch>> fetchResults() async {
    final results = await _api.getResults();
    // Update local state so returning to landing page knows we are done!
    _isQuizComplete = true; 
    notifyListeners();
    return results;
  }

  /// Runs the backend setup for a quiz session (eligibility filtering +
  /// entropy calc) from the profile answers collected on ProfileScreen.
  /// This can be genuinely slow the first time, which is exactly why it's
  /// meant to be passed as LoadingScreen's `task` rather than awaited
  /// inline behind a button.
  Future<bool> initializeQuizSession(Map<String, dynamic> profileData) async {
    final isComplete = await _api.initializeUser(profileData);
    // Update local state instantly so the app knows we are registered!
    _isRegistered = true;
    _isQuizComplete = isComplete;
    _userData = profileData;
    notifyListeners();
    return isComplete;
  }
}

/// Makes [AppState] available to the whole tree (including every route).
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({
    super.key,
    required AppState state,
    required super.child,
  }) : super(notifier: state);

  /// Watches the state: the calling widget rebuilds when it changes.
  static AppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'No AppScope found above this context.');
    return scope!.notifier!;
  }

  /// Reads the state without subscribing (use in event handlers).
  static AppState read(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'No AppScope found above this context.');
    return scope!.notifier!;
  }
}