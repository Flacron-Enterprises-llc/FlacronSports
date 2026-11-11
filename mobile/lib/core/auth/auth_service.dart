import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../api/api_client.dart';
import '../config.dart';
import '../i18n.dart';

/// Thrown when the account has a second factor. Carries what the TOTP screen needs.
class MfaRequired implements Exception {
  MfaRequired(this.resolver, this.hint);
  final MultiFactorResolver resolver;
  final MultiFactorInfo? hint; // null when the only factor is not TOTP
}

/// Firebase Authentication, the same project and flows as the web app
/// (components/auth/auth-form.tsx, lib/mfa.ts).
class AuthService {
  AuthService._();
  static final instance = AuthService._();

  final _auth = FirebaseAuth.instance;
  bool _googleReady = false;

  User? get user => _auth.currentUser;

  static final _emailRule = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');
  static bool validEmail(String v) => _emailRule.hasMatch(v.trim());

  /// Web rule: 8+ characters, a letter, and a digit or symbol.
  static String? passwordProblem(String v) {
    if (v.length < 8) return tr('Use at least 8 characters.', 'Utilisez au moins 8 caractères.');
    if (!RegExp(r'[A-Za-z]').hasMatch(v)) return tr('Add at least one letter.', 'Ajoutez au moins une lettre.');
    if (!RegExp(r'[\d\W_]').hasMatch(v)) return tr('Add a number or a symbol.', 'Ajoutez un chiffre ou un symbole.');
    return null;
  }

  Future<UserCredential> signIn(String email, String password) async {
    try {
      return await _auth.signInWithEmailAndPassword(email: email.trim(), password: password);
    } on FirebaseAuthMultiFactorException catch (e) {
      throw _mfa(e);
    }
  }

  Future<UserCredential> signUp(String email, String password) async {
    final cred = await _auth.createUserWithEmailAndPassword(email: email.trim(), password: password);
    await sendVerification();
    return cred;
  }

  Future<UserCredential?> signInWithGoogle() async {
    final google = GoogleSignIn.instance;
    if (!_googleReady) {
      await google.initialize(serverClientId: AppConfig.googleServerClientId);
      _googleReady = true;
    }
    final GoogleSignInAccount account;
    try {
      account = await google.authenticate();
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled || e.code == GoogleSignInExceptionCode.interrupted) return null;
      rethrow;
    }
    final idToken = account.authentication.idToken;
    final credential = GoogleAuthProvider.credential(idToken: idToken);
    try {
      return await _auth.signInWithCredential(credential);
    } on FirebaseAuthMultiFactorException catch (e) {
      throw _mfa(e);
    }
  }

  MfaRequired _mfa(FirebaseAuthMultiFactorException e) {
    final hints = e.resolver.hints;
    final totp = hints.where((h) => h is TotpMultiFactorInfo || h.factorId == 'totp').firstOrNull;
    return MfaRequired(e.resolver, totp);
  }

  Future<UserCredential> resolveTotp(MfaRequired mfa, String code) async {
    final assertion = await TotpMultiFactorGenerator.getAssertionForSignIn(mfa.hint!.uid, code);
    return mfa.resolver.resolveSignIn(assertion);
  }

  /// Branded email through the backend (SES), falling back to Firebase's own.
  Future<void> sendVerification() async {
    try {
      final res = await api.post('/auth/send-verification');
      if (res is Map && res['sent'] == true) return;
    } catch (_) {}
    await _auth.currentUser?.sendEmailVerification();
  }

  /// Always reports success (the server does, to avoid revealing accounts).
  Future<void> sendReset(String email) => api.post('/auth/send-reset', body: {'email': email.trim()});

  /// Reloads the user; when newly verified, refreshes the token so the server sees it.
  Future<bool> refreshVerified() async {
    final u = _auth.currentUser;
    if (u == null) return false;
    await u.reload();
    final fresh = _auth.currentUser;
    if (fresh?.emailVerified == true) {
      await fresh!.getIdToken(true);
      return true;
    }
    return false;
  }

  Future<void> updateDisplayName(String name) async {
    await _auth.currentUser?.updateDisplayName(name.trim().isEmpty ? null : name.trim());
    await _auth.currentUser?.reload();
  }

  Future<void> signOut() async {
    try {
      if (_googleReady) await GoogleSignIn.instance.signOut();
    } catch (_) {}
    await _auth.signOut();
  }

  /// TOTP enrolment (lib/mfa.ts). Returns the secret for the QR/setup key.
  Future<TotpSecret> startTotpEnrollment() async {
    final session = await _auth.currentUser!.multiFactor.getSession();
    return TotpMultiFactorGenerator.generateSecret(session);
  }

  Future<void> finishTotpEnrollment(TotpSecret secret, String code) async {
    final assertion = await TotpMultiFactorGenerator.getAssertionForEnrollment(secret, code);
    await _auth.currentUser!.multiFactor.enroll(assertion, displayName: tr('Authenticator app', "Application d'authentification"));
  }

  Future<List<MultiFactorInfo>> enrolledFactors() async {
    final u = _auth.currentUser;
    if (u == null) return [];
    return u.multiFactor.getEnrolledFactors();
  }

  /// Human copy for Firebase auth error codes (lib/auth-rules.ts).
  static String message(Object e) {
    if (e is FirebaseAuthException) {
      switch (e.code) {
        case 'invalid-credential':
        case 'wrong-password':
        case 'user-not-found':
        case 'invalid-login-credentials':
          return tr('Wrong email or password.', 'E-mail ou mot de passe incorrect.');
        case 'email-already-in-use':
          return tr('An account already uses this email.', 'Un compte utilise déjà cet e-mail.');
        case 'weak-password':
          return tr('Choose a stronger password.', 'Choisissez un mot de passe plus solide.');
        case 'invalid-email':
          return tr('Enter a valid email address.', 'Saisissez une adresse e-mail valide.');
        case 'too-many-requests':
          return tr('Too many attempts. Try again in a few minutes.', 'Trop de tentatives. Réessayez dans quelques minutes.');
        case 'network-request-failed':
          return tr('Network problem. Check your connection.', 'Problème de réseau. Vérifiez votre connexion.');
        case 'user-disabled':
          return tr('This account is disabled.', 'Ce compte est désactivé.');
        case 'account-exists-with-different-credential':
          return tr('This email signs in with another method.', 'Cet e-mail utilise une autre méthode de connexion.');
        case 'invalid-verification-code':
          return tr('That code is not right. Try the current one.', "Ce code n'est pas bon. Essayez le code actuel.");
        case 'requires-recent-login':
          return tr('Sign in again, then retry.', 'Reconnectez-vous, puis réessayez.');
        case 'unverified-email':
          return tr('Verify your email first.', "Vérifiez d'abord votre e-mail.");
        case 'operation-not-allowed':
        case 'admin-restricted-operation':
        case 'unsupported-first-factor':
          return tr('This sign-in option is not available for your account.', "Cette option n'est pas disponible pour votre compte.");
      }
      return e.message ?? tr('Something went wrong.', 'Une erreur est survenue.');
    }
    if (e is GoogleSignInException) return tr('Google sign-in failed. Try again.', 'La connexion Google a échoué. Réessayez.');
    if (e is ApiException) return e.message;
    return tr('Something went wrong.', 'Une erreur est survenue.');
  }
}
