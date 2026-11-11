import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_service.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';

/// Shown while sign-in and plan state load. When the plan check fails it offers
/// a retry and never tells the member to subscribe (shellState "failed").
class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final account = ref.watch(accountProvider);
    final failed = account.hasError && !account.isLoading;
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(center: Alignment(0, -0.3), radius: 1.2, colors: [Color(0xFF0B3C85), FsColors.navyDeep, Color(0xFF020A18)]),
        ),
        child: SafeArea(
          child: Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Image.asset('assets/brand/fs-mark-reversed.png', width: 132)
                  .animate()
                  .fadeIn(duration: 500.ms)
                  .scale(begin: const Offset(0.86, 0.86), duration: 700.ms, curve: Curves.easeOutBack),
              const SizedBox(height: 18),
              const Text('FLACRONSPORT', style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w800, letterSpacing: 4, color: Colors.white, fontSize: 15))
                  .animate()
                  .fadeIn(delay: 250.ms, duration: 500.ms),
              const SizedBox(height: 36),
              if (failed) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 40),
                  child: Text(
                    tr("We couldn't check your plan. Your access is not affected.", "Impossible de vérifier votre formule. Votre accès n'est pas affecté."),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white70, fontSize: 14),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(onPressed: () => ref.read(accountProvider.notifier).refresh(), child: Text(tr('Try again', 'Réessayer'))),
                TextButton(
                  onPressed: () => AuthService.instance.signOut(),
                  child: Text(tr('Sign out', 'Se déconnecter'), style: const TextStyle(color: Colors.white70)),
                ),
              ] else
                const SizedBox(
                  width: 26,
                  height: 26,
                  child: CircularProgressIndicator(strokeWidth: 2.6, color: FsColors.orange),
                ).animate().fadeIn(delay: 400.ms),
            ]),
          ),
        ),
      ),
    );
  }
}
