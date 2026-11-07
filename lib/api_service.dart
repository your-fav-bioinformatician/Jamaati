import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// One ranked department/university match, as returned by `POST /results`.
class DeptMatch {
  const DeptMatch({
    required this.fullName,
    required this.description,
    required this.web,
    required this.score,
    required this.similarity,
    required this.rankScore,
  });

  /// Raw `"<uni_name> - <college_name> - <dept_name>"` from the backend.
  final String fullName;
  final String description;
  final String web;

  /// The backend's combined ranking score. Not guaranteed to be bounded to
  /// 0..1 (it's a weighted mix of [similarity] and [rankScore]) — use
  /// [displayScore] for anything that renders it as a ring/percentage.
  final double score;
  final double similarity;
  final double rankScore;

  factory DeptMatch.fromJson(Map<String, dynamic> json) {
    final rawDetails = json['details'];
    final details = rawDetails is Map ? Map<String, dynamic>.from(rawDetails) : const <String, dynamic>{};
    return DeptMatch(
      fullName: (json['full_name'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      web: (json['web'] ?? '').toString(),
      score: _asDouble(json['score']),
      similarity: _asDouble(details['sim']),
      rankScore: _asDouble(details['rank']),
    );
  }

  static double _asDouble(dynamic v) {
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0.0;
    return 0.0;
  }

  List<String> get _nameParts =>
      fullName.split(' - ').map((p) => p.trim()).where((p) => p.isNotEmpty).toList();

  /// Just the department name — the most meaningful headline of the three
  /// segments the backend concatenates into [fullName].
  String get displayName => _nameParts.isNotEmpty ? _nameParts.last : fullName;

  /// University / college, shown as supporting tags under [displayName].
  List<String> get tags =>
      _nameParts.length > 1 ? _nameParts.sublist(0, _nameParts.length - 1) : const [];

  /// [score] clamped to 0..1 for anything that renders it as a ring or %.
  double get displayScore => score.clamp(0.0, 1.0);
}

class JaamatiApi extends ChangeNotifier {
  // 1. SINGLETON PATTERN: Ensures the whole app shares one API instance
  static final JaamatiApi _instance = JaamatiApi._internal();
  factory JaamatiApi() => _instance;
  JaamatiApi._internal();

  // Configuration
  static const String baseUrl = 'http://127.0.0.1:8000'; // Update for production

  // ==========================================
  // DEVICE IDENTITY
  // ==========================================
  //
  // There's no account system any more: on first launch the client mints
  // its own random token and uses it as `user_id` on every call. The
  // backend never issues or validates this value — it just upserts a doc
  // keyed on it (`{"device_token": token}` with a unique index) the first
  // time it sees it, and trusts it on every call after that. That's not a
  // change from today's actual trust model (any `user_id` was already
  // accepted on every request); it's just no longer pretending there's a
  // login step in front of it.

  static const String _keyDeviceToken = 'jaamati_user_id'; // unchanged key name: lets already-installed devices keep their existing identity

  /// The device's anonymous identity token. Set once, by [ensureDeviceToken],
  /// and never changes for the lifetime of the install — there's no
  /// login/logout to swap it out from under you.
  String? currentUserId;

  /// Loads the saved device token, minting and persisting a new one on
  /// first launch. Pure local storage — no network round trip — so this
  /// resolves almost immediately. Safe to call more than once; after the
  /// first successful call it just returns the cached value.
  Future<String> ensureDeviceToken() async {
    final existing = currentUserId;
    if (existing != null) return existing;

    final prefs = await SharedPreferences.getInstance();
    var token = prefs.getString(_keyDeviceToken);
    if (token == null || token.isEmpty) {
      token = _generateDeviceToken();
      await prefs.setString(_keyDeviceToken, token);
    }

    currentUserId = token;
    notifyListeners();
    return token;
  }

  /// 32 bytes (256 bits) from a CSPRNG, hex-encoded. Collision-proof for
  /// any realistic install base, and needs nothing from the server to
  /// generate.
  String _generateDeviceToken() {
    final rand = Random.secure();
    final bytes = List<int>.generate(32, (_) => rand.nextInt(256));
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  String _extractError(http.Response response, String fallback) {
    try {
      final body = jsonDecode(response.body);
      final detail = body is Map ? body['detail'] : null;
      if (detail is String && detail.isNotEmpty) return detail;
      if (detail is List && detail.isNotEmpty) {
        final messages = detail
            .map((e) => e is Map && e['msg'] != null ? e['msg'].toString() : e.toString())
            .join(' ');
        if (messages.isNotEmpty) return messages;
      }
      return "$fallback (HTTP ${response.statusCode})";
    } catch (e) {
      debugPrint("Could not parse error body: $e | raw: ${response.body}");
      return "$fallback (HTTP ${response.statusCode})";
    }
  }
  Future<Map<String, dynamic>> checkUserStatus() async {
    final token = currentUserId;
    if (token == null) {
      return {'is_registered': false, 'is_complete': false, 'user_data': null};
    }

    try {
      final response = await http.get(
        Uri.parse('$baseUrl/user/status/$token'),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        return {'is_registered': false, 'is_complete': false, 'user_data': null};
      }
    } catch (e) {
      debugPrint('Failed to check user status: $e');
      return {'is_registered': false, 'is_complete': false, 'user_data': null};
    }
  }
  // ==========================================
  // QUIZ & RESULTS
  // ==========================================

  /// Upserts the backend's user doc (eligibility filtering + entropy calc
  /// over the full major/question set) for the current device token. Always
  /// call [ensureDeviceToken] before this — it assumes `currentUserId` is
  /// already set and just attaches it to the payload.
  Future<bool> initializeUser(Map<String, dynamic> userData) async {
    final token = currentUserId;
    if (token == null) {
      throw StateError('No device token — call ensureDeviceToken() first.');
    }
    
    // Create a mutable copy before modification
    final requestPayload = Map<String, dynamic>.from(userData);
    requestPayload['user_id'] = token;

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/quiz/init'),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: jsonEncode(requestPayload),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        // Extract the boolean from the backend response (default to false if missing)
        return data['is_complete'] ?? false; 
      } else{
        throw Exception("Server [${response.statusCode}]: ${response.body}");
      }
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  Future<Map<String, dynamic>?> getNextQuestion() async {
    if (currentUserId == null) return null;
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/quiz/next_q?user_id=$currentUserId'),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) return jsonDecode(response.body);
      return null;
    } catch (e) {
      debugPrint("Error NextQ: $e");
      return null;
    }
  }

  Future<bool> processAnswer(int answer) async {
    if (currentUserId == null) return false;
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/quiz/process_a'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'user_id': currentUserId, 'answer': answer}),
      ).timeout(const Duration(seconds: 30));

      return response.statusCode == 200;
    } catch (e) {
      debugPrint("Error ProcessA: $e");
      return false;
    }
  }

  Future<List<DeptMatch>> getResults() async {
    final token = currentUserId;
    if (token == null) {
      throw StateError('No device token — call ensureDeviceToken() first.');
    }

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/results'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'user_id': token}),
      ).timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as List<dynamic>;
        final results = data
            .whereType<Map>()
            .map((e) => DeptMatch.fromJson(Map<String, dynamic>.from(e)))
            .toList();
        // Backend ranks internally, but sort defensively so the UI's
        // "best match" is always genuinely the highest-scoring one.
        results.sort((a, b) => b.score.compareTo(a.score));
        return results;
      } else {
        throw Exception(_extractError(response, "Backend failed to calculate results"));
      }
    } catch (e) {
      debugPrint("Error Results: $e");
      rethrow;
    }
  }
}