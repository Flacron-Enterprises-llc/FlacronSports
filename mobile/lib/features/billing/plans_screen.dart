import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_service.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/account.dart';
import '../../widgets/common.dart';
import 'plan_matrix.dart';

/// The paywall for an account with no plan (ChoosePlan on the web). Purchases
/// happen on flacronsport.com; the app re-reads the plan when it comes back.
class PlansScreen extends ConsumerStatefulWidget {
  const PlansScreen({super.key});

  @override
  ConsumerState<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends ConsumerState<PlansScreen> {
  bool _annual = false;
  bool _refreshing = false;

  Future<void> _refresh() async {
    setState(() => _refreshing = true);
    await ref.read(accountProvider.notifier).refresh();
    if (!mounted) return;
    setState(() => _refreshing = false);
    final a = ref.read(accountProvider).value;
    if (a == null || !a.hasPlan) {
      toast(context, tr('No active plan yet. Purchases can take a minute to arrive.', "Pas encore de formule active. Un achat peut mettre une minute à arriver."));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final user = ref.watch(authUserProvider).value;
    final account = ref.watch(accountProvider).value;
    final top = MediaQuery.paddingOf(context).top;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: RefreshIndicator(
          onRefresh: _refresh,
          child: CustomScrollView(slivers: [
            SliverToBoxAdapter(
              child: Container(
                padding: EdgeInsets.fromLTRB(22, top + 10, 12, 34),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF0B3C85), FsColors.navy, FsColors.navyDeep]),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Image.asset('assets/brand/fs-mark-reversed.png', height: 28),
                    const Spacer(),
                    IconButton(
                      tooltip: tr('Settings', 'Paramètres'),
                      onPressed: () => context.push('/settings'),
                      icon: const Icon(Icons.settings_outlined, color: Colors.white70),
                    ),
                    PopupMenuButton<String>(
                      icon: const Icon(Icons.more_vert_rounded, color: Colors.white70),
                      onSelected: (v) {
                        if (v == 'signout') AuthService.instance.signOut();
                        if (v == 'billing') context.push('/billing');
                      },
                      itemBuilder: (_) => [
                        PopupMenuItem(value: 'billing', child: Text(tr('Billing', 'Facturation'))),
                        PopupMenuItem(value: 'signout', child: Text(tr('Sign out', 'Se déconnecter'))),
                      ],
                    ),
                  ]),
                  const SizedBox(height: 18),
                  Text(tr('Choose your plan', 'Choisissez votre formule'),
                          style: const TextStyle(fontFamily: 'Sora', fontSize: 30, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.8))
                      .animate()
                      .fadeIn()
                      .slideY(begin: 0.2, end: 0),
                  const SizedBox(height: 8),
                  Text(
                    user?.email == null
                        ? tr('Every FlacronSport feature starts with a plan.', 'Chaque fonction FlacronSport commence par une formule.')
                        : tr('Signed in as ${user!.email}. Every FlacronSport feature starts with a plan.',
                            'Connecté en tant que ${user.email}. Chaque fonction FlacronSport commence par une formule.'),
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.75), height: 1.45),
                  ),
                  if (account?.state == 'expired' || account?.state == 'past_due') ...[
                    const SizedBox(height: 12),
                    Pill(
                      account!.state == 'past_due' ? tr('Payment past due', 'Paiement en retard') : tr('Your plan has ended', 'Votre formule a pris fin'),
                      color: Colors.white,
                      background: Colors.white.withValues(alpha: 0.14),
                      icon: Icons.info_outline_rounded,
                    ),
                  ],
                ]),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 6),
                child: IntervalToggle(annual: _annual, onChanged: (v) => setState(() => _annual = v)),
              ),
            ),
            SliverList.list(children: [
              for (final (i, p) in PlanInfo.paid.indexed)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                  child: PlanCard(plan: p, annual: _annual, highlighted: p.id == 'plus', onChoose: () => openWeb('/pricing')).entrance(i),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
                child: FsCard(
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(Icons.public_rounded, color: c.accent),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(tr('Subscribe on flacronsport.com', 'Abonnez-vous sur flacronsport.com'), style: context.text.titleSmall),
                        const SizedBox(height: 4),
                        Text(
                          tr('Plans are bought on the website with the same account. Come back to the app and it unlocks on its own.',
                              "Les formules s'achètent sur le site avec le même compte. Revenez dans l'appli : elle se débloque toute seule."),
                          style: context.text.bodySmall,
                        ),
                      ]),
                    ),
                  ]),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                child: Column(children: [
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () => openWeb('/pricing'),
                      icon: const Icon(Icons.open_in_new_rounded, size: 18),
                      label: Text(tr('See plans on flacronsport.com', 'Voir les formules sur flacronsport.com')),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _refreshing ? null : _refresh,
                      icon: _refreshing
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.refresh_rounded, size: 18),
                      label: Text(tr('I already subscribed, refresh', "Je suis déjà abonné, actualiser")),
                    ),
                  ),
                ]),
              ),
              SectionHeader(tr('Day pass and add-ons', 'Pass journée et options')),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: FsCard(
                  onTap: () => openWeb('/pricing'),
                  child: Row(children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: c.accent.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                      child: Icon(Icons.bolt_rounded, color: c.accent),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${tr('Day pass', 'Pass journée')} · ${Fmt.money(1.99)}', style: context.text.titleSmall),
                        const SizedBox(height: 2),
                        Text(tr('Premium benefits and 10 assistant requests for 24 hours.', "Avantages Premium et 10 demandes à l'assistant pendant 24 heures."),
                            style: context.text.bodySmall),
                      ]),
                    ),
                    Icon(Icons.chevron_right_rounded, color: c.ink3),
                  ]),
                ),
              ),
              SectionHeader(tr('Every plan includes', 'Inclus dans chaque formule')),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: FsCard(
                  child: Column(
                    children: [for (final f in everyPlan) _Bullet(tr(f.$1, f.$2))],
                  ),
                ),
              ),
              SectionHeader(tr('Compare plans', 'Comparer les formules')),
              const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: PlanMatrixTable()),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
                child: Center(
                  child: TextButton.icon(
                    onPressed: () => AuthService.instance.signOut(),
                    icon: const Icon(Icons.logout_rounded, size: 18),
                    label: Text(tr('Sign out', 'Se déconnecter')),
                  ),
                ),
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet(this.text, {this.light = false});
  final String text;
  final bool light;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.only(top: 1),
          child: Icon(Icons.check_circle_rounded, size: 17, color: light ? FsColors.orange : c.success),
        ),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: TextStyle(fontSize: 13.5, height: 1.4, color: light ? Colors.white.withValues(alpha: 0.88) : c.ink2))),
      ]),
    );
  }
}

class IntervalToggle extends StatelessWidget {
  const IntervalToggle({super.key, required this.annual, required this.onChanged});
  final bool annual;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    Widget option(bool value, String label, {String? badge}) {
      final active = annual == value;
      return Expanded(
        child: GestureDetector(
          onTap: () {
            HapticFeedback.selectionClick();
            onChanged(value);
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 240),
            curve: AppTheme.ease,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: active ? c.surface : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              boxShadow: active ? [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 10, offset: const Offset(0, 3))] : null,
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: active ? c.ink : c.ink3)),
              if (badge != null) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: c.success.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(999)),
                  child: Text(badge, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: c.success)),
                ),
              ],
            ]),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        option(false, tr('Monthly', 'Mensuel')),
        option(true, tr('Annual', 'Annuel'), badge: '-${PlanInfo.plus.annualSavingPercent}%'),
      ]),
    );
  }
}

/// One plan with price and highlights. [current] marks the member's plan.
class PlanCard extends StatelessWidget {
  const PlanCard({super.key, required this.plan, required this.annual, this.highlighted = false, this.current = false, this.onChoose, this.actionLabel});
  final PlanInfo plan;
  final bool annual;
  final bool highlighted;
  final bool current;
  final VoidCallback? onChoose;
  final String? actionLabel;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final dark = highlighted;
    final price = annual ? plan.annual : plan.monthly;
    final fg = dark ? Colors.white : c.ink;
    final sub = dark ? Colors.white.withValues(alpha: 0.7) : c.ink3;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        color: dark ? null : c.surface,
        gradient: dark ? const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF0B3C85), FsColors.navyDeep]) : null,
        border: Border.all(color: current ? c.accent : (dark ? Colors.transparent : c.line), width: current ? 2 : 1),
        boxShadow: dark ? [BoxShadow(color: FsColors.navy.withValues(alpha: 0.35), blurRadius: 30, offset: const Offset(0, 14), spreadRadius: -12)] : null,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(plan.name, style: TextStyle(fontFamily: 'Sora', fontSize: 22, fontWeight: FontWeight.w800, color: fg)),
          const SizedBox(width: 8),
          if (highlighted && !current) Pill(tr('Most popular', 'Le plus choisi'), color: Colors.white, background: FsColors.orange),
          if (current) Pill(tr('Current plan', 'Formule actuelle'), color: dark ? Colors.white : c.accentText, background: c.accent.withValues(alpha: 0.18)),
        ]),
        const SizedBox(height: 10),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 260),
            transitionBuilder: (child, a) => FadeTransition(opacity: a, child: SlideTransition(position: Tween(begin: const Offset(0, 0.3), end: Offset.zero).animate(a), child: child)),
            child: Text(Fmt.money(price),
                key: ValueKey(price), style: TextStyle(fontFamily: 'Sora', fontSize: 34, fontWeight: FontWeight.w800, color: fg, letterSpacing: -1)),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 7, left: 4),
            child: Text(annual ? tr('/ year', '/ an') : tr('/ month', '/ mois'), style: TextStyle(color: sub, fontWeight: FontWeight.w600)),
          ),
        ]),
        if (annual)
          Text(tr('Save ${plan.annualSavingPercent}% with annual billing', 'Économisez ${plan.annualSavingPercent} % en annuel'),
              style: TextStyle(fontSize: 12.5, color: dark ? const Color(0xFF7CE0A3) : c.success, fontWeight: FontWeight.w700)),
        const SizedBox(height: 14),
        for (final h in planHighlights[plan.id]!) _Bullet(tr(h.$1, h.$2), light: dark),
        if (onChoose != null) ...[
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: dark
                ? FilledButton(onPressed: onChoose, child: Text(actionLabel ?? tr('Choose ${plan.name}', 'Choisir ${plan.name}')))
                : OutlinedButton(onPressed: onChoose, child: Text(actionLabel ?? tr('Choose ${plan.name}', 'Choisir ${plan.name}'))),
          ),
        ],
      ]),
    );
  }
}

/// The full comparison table, one row per benefit.
class PlanMatrixTable extends StatelessWidget {
  const PlanMatrixTable({super.key, this.current});
  final String? current;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return FsCard(
      padding: EdgeInsets.zero,
      child: Column(children: [
        for (final (i, row) in planMatrix.indexed)
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: c.line))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(row.label, style: context.text.titleSmall),
              const SizedBox(height: 8),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                for (final p in PlanInfo.paid)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(p.name,
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: current == p.id ? c.accentText : c.ink3, letterSpacing: 0.3)),
                        const SizedBox(height: 2),
                        Text(row.cell(p.id), style: TextStyle(fontSize: 12.5, color: c.ink2, height: 1.3)),
                      ]),
                    ),
                  ),
              ]),
            ]),
          ),
      ]),
    );
  }
}
