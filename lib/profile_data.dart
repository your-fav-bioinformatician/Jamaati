import 'i18n.dart';

/// Answers collected by the profile wizard, shaped to map onto the backend's
/// `UserInfoRequest`.
///
/// Choice fields are stored as **indices** into the option lists. Both
/// languages list their options in the same order, so:
///  * switching language mid-form keeps every selection, and
///  * the backend always receives the English label, never Arabic text
///    (see [toJson]).
class ProfileData {
  // Step 1 - About you
  DateTime? birthDate;
  int? gender; // 0 = female, 1 = male
  int? city;
  int? religion;
  int? language;
  int? income;
  bool preferClose = false;
  double? lat;
  double? lon;

  // Step 2 - Studies
  String gpaText = '';
  int? track;
  int? mbti; // optional in the UI

  // Step 3 - Goals
  int? careerGoal;

  bool get hasLocation => lat != null && lon != null;

  bool get aboutYouComplete =>
      birthDate != null &&
      gender != null &&
      city != null &&
      religion != null &&
      language != null &&
      income != null;

  /// Age in whole years, computed from [birthDate].
  int? get age {
    final dob = birthDate;
    if (dob == null) return null;
    final now = DateTime.now();
    var years = now.year - dob.year;
    final hadBirthday =
        now.month > dob.month || (now.month == dob.month && now.day >= dob.day);
    if (!hadBirthday) years--;
    return years;
  }

  /// The GPA as a number, or `null` if the text isn't a number in 0-105.
  double? get gpa => parseGpa(gpaText);

  static double? parseGpa(String raw) {
    final value = double.tryParse(_asciiNumber(raw.trim()));
    // tryParse accepts 'NaN' and 'Infinity', so check isFinite too.
    if (value == null || !value.isFinite) return null;
    if (value < 0 || value > 105) return null;
    return value;
  }

  /// Arabic-Indic (٠-٩) and Persian (۰-۹) digits, the Arabic decimal
  /// separator (٫) and a decimal comma all become their ASCII equivalents,
  /// so a GPA typed on an Arabic keyboard still parses.
  static String _asciiNumber(String input) {
    final out = StringBuffer();
    for (final r in input.runes) {
      if (r >= 0x0660 && r <= 0x0669) {
        out.writeCharCode(0x30 + r - 0x0660);
      } else if (r >= 0x06F0 && r <= 0x06F9) {
        out.writeCharCode(0x30 + r - 0x06F0);
      } else if (r == 0x066B || r == 0x2C) {
        out.write('.');
      } else {
        out.writeCharCode(r);
      }
    }
    return out.toString();
  }

  /// Body for the backend's `UserInfoRequest`.
  ///
  /// `user_id` is intentionally absent: `JaamatiApi.initializeUser` adds it
  /// when a session exists. Call this only after every step has validated.
  Map<String, dynamic> toJson({required String appVersion}) {
    // Always send the English labels, regardless of the UI language.
    final s1 = appStringsEn.profile.step1;
    final s2 = appStringsEn.profile.step2;
    final s3 = appStringsEn.profile.step3;

    return {
      'age': age!,
      'gender': gender == 0 ? s1.female : s1.male,
      'income': s1.incomeLevels[income!],
      'city': s1.cities[city!],
      'religion': s1.religions[religion!],
      'language': s1.languages[language!],
      'gpa': gpa!,
      'hs': s2.tracks[track!],
      // Backend field is a required str but the UI says "optional":
      // send an empty string when skipped.
      'mbti': mbti == null ? '' : s2.mbtiTypes[mbti!],
      'career_goal': s3.priorities[careerGoal!].label,
      'app_version': appVersion,
      'prefer_close': preferClose,
      // Only share coordinates when the user opted in.
      if (preferClose && hasLocation) 'lat': lat,
      if (preferClose && hasLocation) 'lon': lon,
    };
  }
}