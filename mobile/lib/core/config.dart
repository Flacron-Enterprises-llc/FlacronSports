/// App-wide constants. Nothing here is secret: the backend identifies users only
/// through verified Firebase ID tokens.
class AppConfig {
  AppConfig._();

  /// The deployed site. Its /api routes forward to the AWS backend (ECS), the
  /// same path the web app uses. Override with --dart-define=API_BASE=...
  static const String siteBase = String.fromEnvironment('API_BASE', defaultValue: 'https://flacronsport.com');

  static String get apiBase => '$siteBase/api';

  /// OAuth web client of the Firebase project, needed by Google Sign-In on
  /// Android to mint an ID token Firebase accepts.
  static const String googleServerClientId =
      '587360197502-5ei96rcpbenp49rgdg7jn0frqjnnjh5v.apps.googleusercontent.com';

  static String webUrl(String path, {String locale = 'en'}) {
    final prefix = locale == 'fr' ? '/fr' : '';
    return '$siteBase$prefix$path';
  }

  static const String supportEmail = 'contact@flacronenterprises.com';
}
