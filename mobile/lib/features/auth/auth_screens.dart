import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_service.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/common.dart';

// ---------------------------------------------------------------------------
// Shared layout
// ---------------------------------------------------------------------------

/// Gradient hero with the logo, then the form on a raised sheet.
class _AuthScaffold extends StatelessWidget {
  const _AuthScaffold({required this.title, required this.subtitle, required this.child, this.showBack = false, this.icon});
  final String title;
  final String subtitle;
  final Widget child;
  final bool showBack;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final top = MediaQuery.paddingOf(context).top;
    const heroColors = [Color(0xFF0B3C85), FsColors.navy, FsColors.navyDeep];
    final header = ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(36)),
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.fromLTRB(24, top + 12, 24, 76),
        decoration: const BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: heroColors),
        ),
        child: Stack(clipBehavior: Clip.none, children: [
          // Soft brand glow, kept inside the rounded header.
          Positioned(
            right: -90,
            top: -70,
            child: IgnorePointer(
              child: Container(
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [FsColors.orange.withValues(alpha: 0.30), FsColors.orange.withValues(alpha: 0)]),
                ),
              ),
            ),
          ),
          Positioned(
            left: -60,
            bottom: -110,
            child: IgnorePointer(
              child: Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [const Color(0xFF1E5BB8).withValues(alpha: 0.35), const Color(0xFF1E5BB8).withValues(alpha: 0)]),
                ),
              ),
            ),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              if (showBack)
                IconButton(
                  onPressed: () => context.canPop() ? context.pop() : context.go('/signin'),
                  icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                  style: IconButton.styleFrom(backgroundColor: Colors.white.withValues(alpha: 0.12)),
                )
              else
                Image.asset('assets/brand/fs-mark-reversed.png', height: 30),
              const Spacer(),
              ValueListenableBuilder<String>(
                valueListenable: AppLocale.notifier,
                builder: (context, code, _) => TextButton(
                  onPressed: () => AppLocale.set(code == 'fr' ? 'en' : 'fr'),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.white,
                    backgroundColor: Colors.white.withValues(alpha: 0.10),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    shape: const StadiumBorder(),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.translate_rounded, size: 15),
                    const SizedBox(width: 6),
                    Text(code == 'fr' ? 'English' : 'Français', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  ]),
                ),
              ),
            ]),
            const SizedBox(height: 30),
            if (icon != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),
                child: Icon(icon, color: Colors.white, size: 28),
              ).animate().scale(begin: const Offset(0.6, 0.6), curve: Curves.easeOutBack, duration: 500.ms),
              const SizedBox(height: 16),
            ],
            Text(title,
                    style: const TextStyle(fontFamily: 'Sora', fontSize: 30, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.8, height: 1.1))
                .animate()
                .fadeIn(duration: 400.ms)
                .slideY(begin: 0.2, end: 0, curve: AppTheme.ease),
            const SizedBox(height: 8),
            Text(subtitle, style: TextStyle(fontSize: 15, height: 1.45, color: Colors.white.withValues(alpha: 0.78)))
                .animate()
                .fadeIn(delay: 100.ms, duration: 400.ms),
          ]),
        ]),
      ),
    );

    final card = Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.fromLTRB(20, 26, 20, 22),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: c.line),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: context.isDark ? 0.45 : 0.10), blurRadius: 36, offset: const Offset(0, 18), spreadRadius: -12),
        ],
      ),
      child: child,
    ).animate().fadeIn(delay: 120.ms, duration: 450.ms).slideY(begin: 0.06, end: 0, curve: AppTheme.ease);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(statusBarColor: Colors.transparent),
      child: Scaffold(
        backgroundColor: c.bg,
        body: SingleChildScrollView(
          // Clamping, so pulling down never reveals an empty band above the header.
          physics: const ClampingScrollPhysics(),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24),
          // One column: the card is painted after the header, so it always sits on top of it.
          child: Column(children: [
            header,
            Transform.translate(offset: const Offset(0, -44), child: card),
          ]),
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner(this.message, {this.action, this.onAction});
  final String message;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.danger.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.danger.withValues(alpha: 0.3)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.error_outline_rounded, color: c.danger, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(message, style: TextStyle(color: c.ink, fontSize: 13.5, height: 1.35)),
            if (action != null)
              GestureDetector(
                onTap: onAction,
                child: Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(action!, style: TextStyle(color: c.accentText, fontWeight: FontWeight.w700, fontSize: 13.5)),
                ),
              ),
          ]),
        ),
      ]),
    ).animate().fadeIn(duration: 250.ms).shakeX(hz: 3, amount: 3, duration: 350.ms);
  }
}

/// A full-width button that shows a spinner while [busy].
class _BusyButton extends StatelessWidget {
  const _BusyButton({required this.label, required this.busy, required this.onPressed, this.icon});
  final String label;
  final bool busy;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: busy
              ? const SizedBox(key: ValueKey('b'), width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
              : Row(key: const ValueKey('l'), mainAxisSize: MainAxisSize.min, children: [
                  Text(label),
                  if (icon != null) ...[const SizedBox(width: 8), Icon(icon, size: 19)],
                ]),
        ),
      ),
    );
  }
}

class _GoogleButton extends StatelessWidget {
  const _GoogleButton({required this.busy, required this.onPressed});
  final bool busy;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: busy ? null : onPressed,
        child: busy
            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4))
            : Row(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 22,
                  height: 22,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white, border: Border.all(color: c.line)),
                  child: const Text('G',
                      style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF4285F4))),
                ),
                const SizedBox(width: 10),
                Text(tr('Continue with Google', 'Continuer avec Google')),
              ]),
      ),
    );
  }
}

class _OrDivider extends StatelessWidget {
  const _OrDivider();

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Row(children: [
        Expanded(child: Divider(color: c.line)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(tr('or', 'ou'), style: context.text.bodySmall),
        ),
        Expanded(child: Divider(color: c.line)),
      ]),
    );
  }
}

class _PasswordField extends StatefulWidget {
  const _PasswordField({required this.controller, required this.label, this.validator, this.textInputAction, this.onSubmitted, this.autofill});
  final TextEditingController controller;
  final String label;
  final String? Function(String?)? validator;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;
  final Iterable<String>? autofill;

  @override
  State<_PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<_PasswordField> {
  bool _hidden = true;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      obscureText: _hidden,
      validator: widget.validator,
      textInputAction: widget.textInputAction,
      onFieldSubmitted: widget.onSubmitted,
      autofillHints: widget.autofill,
      decoration: InputDecoration(
        labelText: widget.label,
        prefixIcon: const Icon(Icons.lock_outline_rounded),
        suffixIcon: IconButton(
          tooltip: _hidden ? tr('Show password', 'Afficher le mot de passe') : tr('Hide password', 'Masquer le mot de passe'),
          icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined),
          onPressed: () => setState(() => _hidden = !_hidden),
        ),
      ),
    );
  }
}

String? _emailError(String? v) {
  if (v == null || v.trim().isEmpty) return tr('Enter your email address.', 'Saisissez votre adresse e-mail.');
  if (!AuthService.validEmail(v)) return tr('Enter a valid email address.', 'Saisissez une adresse e-mail valide.');
  return null;
}

/// Shared Google flow for sign in and sign up.
Future<String?> _runGoogle(BuildContext context) async {
  try {
    await AuthService.instance.signInWithGoogle();
    return null;
  } on MfaRequired catch (m) {
    if (context.mounted) context.push('/mfa', extra: m);
    return null;
  } catch (e) {
    return AuthService.message(e);
  }
}

class _LegalNote extends StatelessWidget {
  const _LegalNote();

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final link = TextStyle(color: c.accentText, fontWeight: FontWeight.w700);
    return Text.rich(
      TextSpan(style: context.text.bodySmall?.copyWith(height: 1.5), children: [
        TextSpan(text: tr('By continuing you agree to the ', 'En continuant, vous acceptez les ')),
        TextSpan(text: tr('Terms', 'Conditions'), style: link, recognizer: TapGestureRecognizer()..onTap = () => openWeb('/terms-of-service')),
        TextSpan(text: tr(' and ', ' et la ')),
        TextSpan(
            text: tr('Privacy Policy', 'Politique de confidentialité'),
            style: link,
            recognizer: TapGestureRecognizer()..onTap = () => openWeb('/privacy-policy')),
        const TextSpan(text: '.'),
      ]),
      textAlign: TextAlign.center,
    );
  }
}

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key, this.email});
  final String? email;

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _form = GlobalKey<FormState>();
  late final _email = TextEditingController(text: widget.email ?? '');
  final _password = TextEditingController();
  bool _busy = false, _googleBusy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AuthService.instance.signIn(_email.text, _password.text);
      TextInput.finishAutofillContext();
    } on MfaRequired catch (m) {
      if (mounted) context.push('/mfa', extra: m);
    } catch (e) {
      if (mounted) setState(() => _error = AuthService.message(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _google() async {
    setState(() {
      _googleBusy = true;
      _error = null;
    });
    final error = await _runGoogle(context);
    if (mounted) {
      setState(() {
        _googleBusy = false;
        _error = error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return _AuthScaffold(
      title: tr('Welcome back', 'Bon retour'),
      subtitle: tr('Sign in to follow your teams, scores and highlights.', 'Connectez-vous pour suivre vos équipes, scores et résumés.'),
      child: AutofillGroup(
        child: Form(
          key: _form,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (_error != null) _ErrorBanner(_error!),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email, AutofillHints.username],
              validator: _emailError,
              decoration: InputDecoration(labelText: tr('Email', 'E-mail'), prefixIcon: const Icon(Icons.alternate_email_rounded)),
            ),
            const SizedBox(height: 14),
            _PasswordField(
              controller: _password,
              label: tr('Password', 'Mot de passe'),
              textInputAction: TextInputAction.done,
              autofill: const [AutofillHints.password],
              onSubmitted: (_) => _submit(),
              validator: (v) => (v == null || v.isEmpty) ? tr('Enter your password.', 'Saisissez votre mot de passe.') : null,
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => context.push('/forgot?email=${Uri.encodeQueryComponent(_email.text.trim())}'),
                child: Text(tr('Forgot password?', 'Mot de passe oublié ?')),
              ),
            ),
            const SizedBox(height: 6),
            _BusyButton(label: tr('Sign in', 'Se connecter'), busy: _busy, onPressed: _submit, icon: Icons.arrow_forward_rounded),
            const _OrDivider(),
            _GoogleButton(busy: _googleBusy, onPressed: _google),
            const SizedBox(height: 22),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text(tr('New to FlacronSport?', 'Nouveau sur FlacronSport ?'), style: TextStyle(color: c.ink2)),
              TextButton(onPressed: () => context.push('/signup'), child: Text(tr('Create an account', 'Créer un compte'))),
            ]),
          ]),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Sign up
// ---------------------------------------------------------------------------

class SignUpScreen extends StatefulWidget {
  const SignUpScreen({super.key});

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false, _googleBusy = false;
  String? _error;
  bool _emailInUse = false;

  @override
  void initState() {
    super.initState();
    _password.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
      _emailInUse = false;
    });
    try {
      await AuthService.instance.signUp(_email.text, _password.text);
      TextInput.finishAutofillContext();
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = AuthService.message(e);
          _emailInUse = e is FirebaseAuthException && e.code == 'email-already-in-use';
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _google() async {
    setState(() {
      _googleBusy = true;
      _error = null;
    });
    final error = await _runGoogle(context);
    if (mounted) {
      setState(() {
        _googleBusy = false;
        _error = error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final p = _password.text;
    Widget rule(bool ok, String text) => Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Row(children: [
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: Icon(ok ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                  key: ValueKey(ok), size: 16, color: ok ? c.success : c.ink3),
            ),
            const SizedBox(width: 8),
            Text(text, style: TextStyle(fontSize: 12.5, color: ok ? c.ink2 : c.ink3)),
          ]),
        );

    return _AuthScaffold(
      showBack: true,
      title: tr('Create your account', 'Créez votre compte'),
      subtitle: tr('One account for the app and flacronsport.com.', 'Un seul compte pour l\'appli et flacronsport.com.'),
      child: AutofillGroup(
        child: Form(
          key: _form,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (_error != null)
              _ErrorBanner(
                _error!,
                action: _emailInUse ? tr('Sign in instead', 'Se connecter plutôt') : null,
                onAction: () => context.go('/signin?email=${Uri.encodeQueryComponent(_email.text.trim())}'),
              ),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
              validator: _emailError,
              decoration: InputDecoration(labelText: tr('Email', 'E-mail'), prefixIcon: const Icon(Icons.alternate_email_rounded)),
            ),
            const SizedBox(height: 14),
            _PasswordField(
              controller: _password,
              label: tr('Password', 'Mot de passe'),
              textInputAction: TextInputAction.next,
              autofill: const [AutofillHints.newPassword],
              validator: (v) => AuthService.passwordProblem(v ?? ''),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                rule(p.length >= 8, tr('At least 8 characters', 'Au moins 8 caractères')),
                rule(RegExp(r'[A-Za-z]').hasMatch(p), tr('A letter', 'Une lettre')),
                rule(RegExp(r'[\d\W_]').hasMatch(p), tr('A number or a symbol', 'Un chiffre ou un symbole')),
              ]),
            ),
            const SizedBox(height: 14),
            _PasswordField(
              controller: _confirm,
              label: tr('Confirm password', 'Confirmez le mot de passe'),
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submit(),
              validator: (v) => v != _password.text ? tr('Passwords do not match.', 'Les mots de passe ne correspondent pas.') : null,
            ),
            const SizedBox(height: 20),
            _BusyButton(label: tr('Create account', 'Créer le compte'), busy: _busy, onPressed: _submit, icon: Icons.arrow_forward_rounded),
            const _OrDivider(),
            _GoogleButton(busy: _googleBusy, onPressed: _google),
            const SizedBox(height: 18),
            const _LegalNote(),
            const SizedBox(height: 8),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text(tr('Have an account?', 'Vous avez un compte ?'), style: TextStyle(color: c.ink2)),
              TextButton(onPressed: () => context.go('/signin'), child: Text(tr('Sign in', 'Se connecter'))),
            ]),
          ]),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Forgot password
// ---------------------------------------------------------------------------

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, this.email});
  final String? email;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _form = GlobalKey<FormState>();
  late final _email = TextEditingController(text: widget.email ?? '');
  bool _busy = false, _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AuthService.instance.sendReset(_email.text);
      if (mounted) setState(() => _sent = true);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.status == 429) {
        setState(() => _error = tr('Too many attempts. Try again in a few minutes.', 'Trop de tentatives. Réessayez dans quelques minutes.'));
      } else if (e.isNetwork) {
        setState(() => _error = tr('Network problem. Check your connection.', 'Problème de réseau. Vérifiez votre connexion.'));
      } else {
        // The web shows "sent" for every other answer, so accounts stay private.
        setState(() => _sent = true);
      }
    } catch (_) {
      if (mounted) setState(() => _sent = true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return _AuthScaffold(
      showBack: true,
      icon: Icons.key_rounded,
      title: tr('Reset your password', 'Réinitialisez votre mot de passe'),
      subtitle: tr("Enter your email and we'll send you a link to choose a new password.",
          'Saisissez votre e-mail et nous vous enverrons un lien pour choisir un nouveau mot de passe.'),
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        child: _sent
            ? Column(key: const ValueKey('sent'), children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: c.success.withValues(alpha: 0.12)),
                  child: Icon(Icons.mark_email_read_rounded, color: c.success, size: 30),
                ).animate().scale(curve: Curves.easeOutBack),
                const SizedBox(height: 14),
                Text(tr('Check your inbox', 'Consultez votre boîte de réception'), style: context.text.titleLarge),
                const SizedBox(height: 8),
                Text(
                  tr('If an account exists for ${_email.text.trim()}, a reset link is on its way. It can take a few minutes.',
                      'Si un compte existe pour ${_email.text.trim()}, un lien de réinitialisation est en route. Cela peut prendre quelques minutes.'),
                  textAlign: TextAlign.center,
                  style: context.text.bodyMedium,
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () => context.go('/signin?email=${Uri.encodeQueryComponent(_email.text.trim())}'),
                    child: Text(tr('Back to sign in', 'Retour à la connexion')),
                  ),
                ),
              ])
            : Form(
                key: _form,
                child: Column(key: const ValueKey('form'), crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  if (_error != null) _ErrorBanner(_error!),
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _submit(),
                    validator: _emailError,
                    decoration: InputDecoration(labelText: tr('Email', 'E-mail'), prefixIcon: const Icon(Icons.alternate_email_rounded)),
                  ),
                  const SizedBox(height: 20),
                  _BusyButton(label: tr('Send reset link', 'Envoyer le lien'), busy: _busy, onPressed: _submit),
                ]),
              ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Verify email
// ---------------------------------------------------------------------------

class VerifyEmailScreen extends ConsumerStatefulWidget {
  const VerifyEmailScreen({super.key});

  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> with WidgetsBindingObserver {
  bool _checking = false, _resending = false;
  int _cooldown = 0;
  Timer? _timer;
  String? _message;
  bool _messageIsError = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // A verification email was just sent at sign-up, so start the cooldown.
    _startCooldown();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _check(silent: true);
  }

  void _startCooldown() {
    _timer?.cancel();
    setState(() => _cooldown = 60);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _cooldown--);
      if (_cooldown <= 0) t.cancel();
    });
  }

  Future<void> _check({bool silent = false}) async {
    if (_checking) return;
    setState(() {
      _checking = true;
      if (!silent) _message = null;
    });
    try {
      final ok = await AuthService.instance.refreshVerified();
      if (ok) {
        ref.invalidate(authUserProvider);
        ref.invalidate(accountProvider);
        ref.invalidate(prefsProvider);
      } else if (!silent && mounted) {
        setState(() {
          _message = tr("Not verified yet. Open the link in the email, then try again.", "Pas encore vérifié. Ouvrez le lien de l'e-mail, puis réessayez.");
          _messageIsError = true;
        });
      }
    } catch (e) {
      if (!silent && mounted) {
        setState(() {
          _message = AuthService.message(e);
          _messageIsError = true;
        });
      }
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _resend() async {
    setState(() {
      _resending = true;
      _message = null;
    });
    try {
      await AuthService.instance.sendVerification();
      _startCooldown();
      if (mounted) {
        setState(() {
          _message = tr('Email sent. Check your inbox and spam folder.', 'E-mail envoyé. Vérifiez votre boîte de réception et vos indésirables.');
          _messageIsError = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _message = AuthService.message(e);
          _messageIsError = true;
        });
      }
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final email = ref.watch(authUserProvider).value?.email ?? '';
    Widget step(int n, String text) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 26,
              height: 26,
              alignment: Alignment.center,
              decoration: BoxDecoration(shape: BoxShape.circle, color: c.accent.withValues(alpha: 0.14)),
              child: Text('$n', style: TextStyle(fontWeight: FontWeight.w800, color: c.accentText, fontSize: 13)),
            ),
            const SizedBox(width: 12),
            Expanded(child: Padding(padding: const EdgeInsets.only(top: 3), child: Text(text, style: context.text.bodyMedium))),
          ]),
        ).entrance(n);

    return _AuthScaffold(
      icon: Icons.mark_email_unread_rounded,
      title: tr('Verify your email', 'Vérifiez votre e-mail'),
      subtitle: tr('We sent a link to $email.', 'Nous avons envoyé un lien à $email.'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        step(1, tr('Open the email from FlacronSport.', "Ouvrez l'e-mail de FlacronSport.")),
        step(2, tr('Tap the verification link.', 'Touchez le lien de vérification.')),
        step(3, tr("Come back here. We'll check automatically.", 'Revenez ici. Nous vérifierons automatiquement.')),
        if (_message != null)
          Container(
            margin: const EdgeInsets.only(top: 4, bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: (_messageIsError ? c.warning : c.success).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(_message!, style: TextStyle(color: c.ink, fontSize: 13.5)),
          ).animate().fadeIn(),
        const SizedBox(height: 8),
        _BusyButton(label: tr("I've verified", "J'ai vérifié"), busy: _checking, onPressed: () => _check(), icon: Icons.check_rounded),
        const SizedBox(height: 10),
        OutlinedButton(
          onPressed: _cooldown > 0 || _resending ? null : _resend,
          child: _resending
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2))
              : Text(_cooldown > 0
                  ? tr('Resend in ${_cooldown}s', 'Renvoyer dans $_cooldown s')
                  : tr('Resend email', "Renvoyer l'e-mail")),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: () async {
            await AuthService.instance.signOut();
            if (context.mounted) context.go('/signup');
          },
          child: Text(tr('Use another email', 'Utiliser un autre e-mail')),
        ),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Second factor (TOTP)
// ---------------------------------------------------------------------------

class MfaScreen extends StatefulWidget {
  const MfaScreen({super.key, required this.mfa});
  final MfaRequired mfa;

  @override
  State<MfaScreen> createState() => _MfaScreenState();
}

class _MfaScreenState extends State<MfaScreen> {
  final _code = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final code = _code.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _error = tr('Enter the 6-digit code from your app.', "Saisissez le code à 6 chiffres de votre application."));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AuthService.instance.resolveTotp(widget.mfa, code);
      // The router leaves this screen once the user is signed in.
    } catch (e) {
      if (mounted) {
        _code.clear();
        setState(() => _error = AuthService.message(e));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final supported = widget.mfa.hint != null;
    return _AuthScaffold(
      showBack: true,
      icon: Icons.shield_rounded,
      title: tr('Two-step verification', 'Validation en deux étapes'),
      subtitle: supported
          ? tr('Enter the code from your authenticator app.', "Saisissez le code de votre application d'authentification.")
          : tr('Your account uses a second factor this app does not support.', "Votre compte utilise un second facteur non pris en charge par l'appli."),
      child: supported
          ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (_error != null) _ErrorBanner(_error!),
              TextField(
                controller: _code,
                autofocus: true,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                maxLength: 6,
                autofillHints: const [AutofillHints.oneTimeCode],
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                onChanged: (v) {
                  if (v.length == 6) _submit();
                },
                style: TextStyle(fontFamily: 'Sora', fontSize: 30, fontWeight: FontWeight.w800, letterSpacing: 14, color: c.ink),
                decoration: const InputDecoration(counterText: '', hintText: '000000'),
              ),
              const SizedBox(height: 18),
              _BusyButton(label: tr('Verify', 'Valider'), busy: _busy, onPressed: _submit),
            ])
          : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(
                tr('Sign in on flacronsport.com, or contact support to reset your second factor.',
                    'Connectez-vous sur flacronsport.com ou contactez le support pour réinitialiser votre second facteur.'),
                style: context.text.bodyMedium,
              ),
              const SizedBox(height: 18),
              FilledButton(onPressed: () => context.go('/signin'), child: Text(tr('Back to sign in', 'Retour à la connexion'))),
            ]),
    );
  }
}
