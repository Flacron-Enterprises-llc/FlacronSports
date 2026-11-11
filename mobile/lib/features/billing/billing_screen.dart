import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/account.dart';
import '../../models/json.dart';
import '../../widgets/common.dart';
import 'plan_matrix.dart';
import 'plans_screen.dart';

/// Billing: the plan on file, allowance and add-ons, and the Stripe-backed
/// actions the web's billing page offers. New purchases happen on the website.
class BillingScreen extends ConsumerStatefulWidget {
  const BillingScreen({super.key});

  @override
  ConsumerState<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends ConsumerState<BillingScreen> {
  String? _busy;
  bool _annual = false;

  Future<void> _portal() async {
    setState(() => _busy = 'portal');
    try {
      final res = asMap(await api.post('/billing/portal'));
      final url = asString(res['url']);
      if (url != null) await openExternal(url);
    } on ApiException catch (e) {
      if (!mounted) return;
      toast(
        context,
        e.code == 'no_customer'
            ? tr('No billing account yet. Subscribe on the website first.', "Pas encore de compte de facturation. Abonnez-vous d'abord sur le site.")
            : errorText(e),
        error: true,
      );
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _cancel({required bool undo}) async {
    if (!undo) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(tr('Cancel your plan?', 'Résilier votre formule ?')),
          content: Text(tr(
              'Your plan stays active until the end of the current period. You can resume any time before then.',
              "Votre formule reste active jusqu'à la fin de la période en cours. Vous pouvez la reprendre d'ici là.")),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: Text(tr('Keep plan', 'Garder'))),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: context.fs.danger),
              onPressed: () => Navigator.pop(context, true),
              child: Text(tr('Cancel plan', 'Résilier')),
            ),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() => _busy = 'cancel');
    try {
      await api.post('/billing/cancel', body: {'undo': undo});
      await ref.read(accountProvider.notifier).refresh();
      if (mounted) {
        toast(context, undo ? tr('Your plan will renew.', 'Votre formule sera renouvelée.') : tr('Your plan will end at the period end.', 'Votre formule prendra fin à la fin de la période.'));
      }
    } on ApiException catch (e) {
      if (mounted) {
        toast(context, e.code == 'no_subscription' ? tr('No active subscription.', "Pas d'abonnement actif.") : errorText(e), error: true);
      }
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  String _stateLabel(Account a) => switch (a.state) {
        'active' => tr('Active', 'Active'),
        'canceling' => tr('Ends at period end', 'Se termine en fin de période'),
        'past_due' => tr('Payment past due', 'Paiement en retard'),
        'expired' => tr('Ended', 'Terminée'),
        _ => tr('No plan', 'Aucune formule'),
      };

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final value = ref.watch(accountProvider);
    return Scaffold(
      appBar: AppBar(title: Text(tr('Billing', 'Facturation'))),
      body: RefreshIndicator(
        onRefresh: () => ref.read(accountProvider.notifier).refresh(),
        child: AsyncView(
          value: value,
          onRetry: () => ref.read(accountProvider.notifier).refresh(),
          builder: (a) {
            if (a == null) return const SizedBox();
            final sub = PlanInfo.of(a.subscriptionPlan);
            final effective = a.planInfo;
            final stateColor = switch (a.state) { 'active' => c.success, 'canceling' || 'past_due' => c.warning, 'expired' => c.danger, _ => c.ink3 };
            final hasSubscription = ['active', 'canceling', 'past_due'].contains(a.state) && a.subscriptionPlan != 'none';
            final allowance = a.allowance;
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
              children: [
                // Current plan
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(24),
                    gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c.heroStart, c.heroEnd]),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      const Icon(Icons.workspace_premium_rounded, color: FsColors.orange),
                      const SizedBox(width: 8),
                      Text(tr('Your plan', 'Votre formule'), style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontWeight: FontWeight.w600)),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Container(width: 7, height: 7, decoration: BoxDecoration(color: stateColor, shape: BoxShape.circle)),
                          const SizedBox(width: 6),
                          Text(_stateLabel(a), style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
                        ]),
                      ),
                    ]),
                    const SizedBox(height: 14),
                    Text(effective.label, style: const TextStyle(fontFamily: 'Sora', fontSize: 32, fontWeight: FontWeight.w800, color: Colors.white)),
                    if (a.hasDayPass)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          tr('Day pass active until ${_when(a.dayPassEnd)}', "Pass journée actif jusqu'au ${_when(a.dayPassEnd)}"),
                          style: const TextStyle(color: Color(0xFFFFB98F), fontWeight: FontWeight.w600),
                        ),
                      ),
                    if (a.isStaff && a.subscriptionPlan == 'none')
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(tr('Staff access', 'Accès équipe'), style: TextStyle(color: Colors.white.withValues(alpha: 0.75))),
                      ),
                    if (hasSubscription) ...[
                      const SizedBox(height: 10),
                      Text(
                        [
                          '${sub.name} · ${a.interval == 'annual' ? tr('Annual', 'Annuel') : tr('Monthly', 'Mensuel')}',
                          if (a.periodEnd != null)
                            a.cancelAtPeriodEnd
                                ? tr('Ends ${Fmt.dayMonthYear(a.periodEnd!)}', 'Prend fin le ${Fmt.dayMonthYear(a.periodEnd!)}')
                                : tr('Renews ${Fmt.dayMonthYear(a.periodEnd!)}', 'Renouvellement le ${Fmt.dayMonthYear(a.periodEnd!)}'),
                        ].join('  ·  '),
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 13.5),
                      ),
                    ],
                  ]),
                ).entrance(0),
                if (a.state == 'past_due')
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: FsCard(
                      color: c.warning.withValues(alpha: 0.1),
                      child: Text(
                        tr('Your last payment did not go through. Update your card in Manage billing to keep your plan.',
                            "Votre dernier paiement n'a pas abouti. Mettez à jour votre carte dans Gérer la facturation pour garder votre formule."),
                        style: TextStyle(color: c.ink),
                      ),
                    ),
                  ),
                const SizedBox(height: 14),
                // Actions
                FsCard(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Column(children: [
                    _ActionTile(
                      icon: Icons.credit_card_rounded,
                      title: tr('Manage billing', 'Gérer la facturation'),
                      subtitle: tr('Card, invoices and receipts', 'Carte, factures et reçus'),
                      busy: _busy == 'portal',
                      onTap: _busy == null ? _portal : null,
                    ),
                    _ActionTile(
                      icon: Icons.swap_vert_rounded,
                      title: hasSubscription ? tr('Change plan', 'Changer de formule') : tr('Choose a plan', 'Choisir une formule'),
                      subtitle: tr('Opens flacronsport.com', 'Ouvre flacronsport.com'),
                      external: true,
                      onTap: () => openWeb(hasSubscription ? '/app/billing' : '/pricing'),
                    ),
                    _ActionTile(
                      icon: Icons.add_shopping_cart_rounded,
                      title: tr('Buy add-ons', 'Acheter des options'),
                      subtitle: tr('Assistant requests, day pass, room pass, exports', 'Demandes assistant, pass journée, pass salon, exports'),
                      external: true,
                      onTap: () => openWeb('/app/billing'),
                    ),
                    if (hasSubscription)
                      _ActionTile(
                        icon: a.cancelAtPeriodEnd ? Icons.replay_rounded : Icons.cancel_outlined,
                        title: a.cancelAtPeriodEnd ? tr('Resume plan', 'Reprendre la formule') : tr('Cancel plan', 'Résilier la formule'),
                        subtitle: a.cancelAtPeriodEnd
                            ? tr('Keep your plan after this period', 'Garder votre formule après cette période')
                            : tr('Stays active until the period ends', "Reste active jusqu'à la fin de la période"),
                        danger: !a.cancelAtPeriodEnd,
                        busy: _busy == 'cancel',
                        onTap: _busy == null ? () => _cancel(undo: a.cancelAtPeriodEnd) : null,
                      ),
                  ]),
                ).entrance(1),
                if (allowance != null) ...[
                  SectionHeader(tr('Assistant allowance', "Crédits de l'assistant"), padding: const EdgeInsets.fromLTRB(4, 24, 4, 10)),
                  FsCard(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Text('${allowance.remaining}', style: TextStyle(fontFamily: 'Sora', fontSize: 28, fontWeight: FontWeight.w800, color: c.ink)),
                        const SizedBox(width: 8),
                        Text(tr('requests left', 'demandes restantes'), style: context.text.bodyMedium),
                      ]),
                      const SizedBox(height: 10),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          minHeight: 8,
                          value: allowance.limit == 0 ? 0 : (allowance.used / allowance.limit).clamp(0, 1).toDouble(),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        tr('${allowance.used} of ${allowance.limit} plan requests used this month', '${allowance.used} sur ${allowance.limit} demandes de la formule utilisées ce mois-ci'),
                        style: context.text.bodySmall,
                      ),
                      if (allowance.purchased > 0)
                        Text(tr('+ ${allowance.purchased} purchased', '+ ${allowance.purchased} achetées'), style: context.text.bodySmall),
                    ]),
                  ).entrance(2),
                  if (allowance.credits.isNotEmpty) ...[
                    SectionHeader(tr('Add-on credits', 'Crédits des options'), padding: const EdgeInsets.fromLTRB(4, 24, 4, 10)),
                    FsCard(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Column(children: [
                        for (final credit in allowance.credits)
                          ListTile(
                            leading: Icon(Icons.local_activity_rounded, color: c.accent),
                            title: Text(addonName(str(credit['sku']))),
                            subtitle: Text(tr('Expires ${_when(asString(credit['expiresAtUTC']))}', 'Expire le ${_when(asString(credit['expiresAtUTC']))}')),
                            trailing: Text('${asInt(credit['remaining']) ?? 0}', style: context.text.titleMedium),
                          ),
                      ]),
                    ),
                  ],
                ],
                if (a.addons.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(spacing: 8, children: [
                    for (final unit in a.addons)
                      Pill(unit == 'room' ? tr('Room pass active', 'Pass salon actif') : tr('Export pack active', "Pack d'exports actif"), icon: Icons.verified_rounded),
                  ]),
                ],
                SectionHeader(tr('Plans', 'Formules'), padding: const EdgeInsets.fromLTRB(4, 26, 4, 10)),
                IntervalToggle(annual: _annual, onChanged: (v) => setState(() => _annual = v)),
                const SizedBox(height: 10),
                for (final p in PlanInfo.paid)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: PlanCard(
                      plan: p,
                      annual: _annual,
                      highlighted: p.id == 'plus',
                      current: a.subscriptionPlan == p.id,
                      onChoose: a.subscriptionPlan == p.id ? null : () => openWeb(hasSubscription ? '/app/billing' : '/pricing'),
                      actionLabel: hasSubscription ? tr('Switch on the website', 'Changer sur le site') : null,
                    ),
                  ),
                SectionHeader(tr('Compare plans', 'Comparer les formules'), padding: const EdgeInsets.fromLTRB(4, 16, 4, 10)),
                PlanMatrixTable(current: a.subscriptionPlan),
              ],
            );
          },
        ),
      ),
    );
  }

  static String _when(String? iso) {
    final d = Fmt.parse(iso);
    return d == null ? '' : Fmt.full(d);
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.icon, required this.title, required this.subtitle, this.onTap, this.busy = false, this.external = false, this.danger = false});
  final IconData icon;
  final String title, subtitle;
  final VoidCallback? onTap;
  final bool busy, external, danger;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final color = danger ? c.danger : c.ink;
    return ListTile(
      onTap: onTap,
      leading: Container(
        padding: const EdgeInsets.all(9),
        decoration: BoxDecoration(color: (danger ? c.danger : c.accent).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
        child: Icon(icon, size: 20, color: danger ? c.danger : c.accent),
      ),
      title: Text(title, style: TextStyle(fontWeight: FontWeight.w700, color: color)),
      subtitle: Text(subtitle, style: context.text.bodySmall),
      trailing: busy
          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
          : Icon(external ? Icons.open_in_new_rounded : Icons.chevron_right_rounded, size: 20, color: c.ink3),
    );
  }
}
