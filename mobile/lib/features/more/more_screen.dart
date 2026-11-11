import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_service.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/user_avatar.dart';
import '../shell/app_shell.dart';

class _Tool {
  const _Tool(this.icon, this.en, this.fr, this.path, this.color, {this.locked = false});
  final IconData icon;
  final String en, fr, path;
  final Color color;
  final bool locked;
}

/// Tab 5: everything the web's sidebar holds beyond the four main tabs.
class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.fs;
    final user = ref.watch(authUserProvider).value;
    final account = ref.watch(accountProvider).value;
    final unread = ref.watch(unreadCountProvider);
    final plus = account?.plusFeatures ?? false;
    final name = user?.displayName?.trim().isNotEmpty == true ? user!.displayName! : (user?.email?.split('@').first ?? '');
    final allowance = account?.allowance;

    final follow = [
      _Tool(Icons.star_rounded, 'My teams', 'Mes équipes', '/my-teams', const Color(0xFFF0A020)),
      _Tool(Icons.dashboard_customize_rounded, 'Board', 'Tableau', '/board', const Color(0xFF4F8DF5)),
      _Tool(Icons.bookmark_rounded, 'Saved news', 'Actus enregistrées', '/news/saved', const Color(0xFF2EC27E)),
    ];
    final tools = [
      _Tool(Icons.auto_awesome_rounded, 'Assistant', 'Assistant', '/assistant', FsColors.orange),
      _Tool(Icons.compare_arrows_rounded, 'Compare', 'Comparer', '/compare', const Color(0xFF8B5CF6), locked: !plus),
      _Tool(Icons.account_tree_rounded, 'Cups', 'Coupes', '/cups', const Color(0xFF0E7C86)),
      _Tool(Icons.sports_motorsports_rounded, 'Motorsport', 'Sport auto', '/motorsport', const Color(0xFFC8102E)),
      _Tool(Icons.search_rounded, 'Search', 'Recherche', '/search', const Color(0xFF3A4B66)),
    ];
    final community = [
      _Tool(Icons.groups_rounded, 'Rooms', 'Salons', '/rooms', const Color(0xFF1E5BB8)),
      _Tool(Icons.emoji_events_rounded, 'Predictions', 'Pronostics', '/predictions', const Color(0xFFD9A400)),
      _Tool(Icons.flag_rounded, 'Clubs', 'Clubs', '/clubs', const Color(0xFF1A7F45)),
    ];

    return Scaffold(
      body: CustomScrollView(slivers: [
        SliverToBoxAdapter(
          child: Container(
            padding: EdgeInsets.fromLTRB(20, MediaQuery.paddingOf(context).top + 16, 20, 24),
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c.heroStart, c.heroEnd]),
              borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Pressable(
                  onTap: () => context.push('/settings/profile'),
                  child: const Hero(tag: 'profile-avatar', child: UserAvatar(size: 62, ring: true)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontFamily: 'Sora', fontSize: 21, fontWeight: FontWeight.w800, color: Colors.white)),
                    const SizedBox(height: 4),
                    Row(children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                        decoration: BoxDecoration(color: FsColors.orange, borderRadius: BorderRadius.circular(999)),
                        child: Text(
                          account == null ? '…' : (account.isStaff && !account.hasPlan ? tr('Staff', 'Équipe') : account.planInfo.label),
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11.5),
                        ),
                      ),
                      if (account?.hasDayPass == true) ...[
                        const SizedBox(width: 6),
                        Text(tr('· day pass', '· pass journée'), style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 12)),
                      ],
                    ]),
                  ]),
                ),
                IconButton(
                  tooltip: tr('Notifications', 'Notifications'),
                  onPressed: () => context.push('/notifications'),
                  icon: Badge(
                    isLabelVisible: unread > 0,
                    label: Text('$unread'),
                    backgroundColor: FsColors.orange,
                    child: const Icon(Icons.notifications_none_rounded, color: Colors.white),
                  ),
                ),
              ]),
              if (allowance != null) ...[
                const SizedBox(height: 18),
                Pressable(
                  onTap: () => context.push('/assistant'),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(16)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        const Icon(Icons.auto_awesome_rounded, size: 16, color: FsColors.orange),
                        const SizedBox(width: 6),
                        Text(tr('Assistant requests', "Demandes à l'assistant"), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                        const Spacer(),
                        Text('${allowance.used}/${allowance.limit}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13)),
                      ]),
                      const SizedBox(height: 10),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(99),
                        child: LinearProgressIndicator(
                          minHeight: 6,
                          value: allowance.limit == 0 ? 0 : (allowance.used / allowance.limit).clamp(0, 1).toDouble(),
                          backgroundColor: Colors.white.withValues(alpha: 0.14),
                          color: FsColors.orange,
                        ),
                      ),
                      if (allowance.purchased > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(tr('+ ${allowance.purchased} purchased', '+ ${allowance.purchased} achetées'),
                              style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12)),
                        ),
                    ]),
                  ),
                ),
              ],
            ]),
          ),
        ),
        if (account?.plan == 'basic')
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: FsCard(
                onTap: () => context.push('/billing'),
                gradient: const LinearGradient(colors: [FsColors.orange, Color(0xFFFF8A4C)]),
                border: false,
                child: Row(children: [
                  const Icon(Icons.rocket_launch_rounded, color: Colors.white),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr('Upgrade to Plus', 'Passez à Plus'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
                      Text(tr('Unlimited favorites, all alerts, no ads, comparison and rooms.', 'Favoris illimités, toutes les alertes, sans pub, comparaison et salons.'),
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12.5)),
                    ]),
                  ),
                  const Icon(Icons.chevron_right_rounded, color: Colors.white),
                ]),
              ).entrance(0),
            ),
          ),
        _section(context, tr('Follow', 'Suivre'), follow, 1),
        _section(context, tr('Tools', 'Outils'), tools, 2),
        _section(context, tr('Community', 'Communauté'), community, 3),
        SliverToBoxAdapter(child: SectionHeader(tr('Account', 'Compte'))),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: FsCard(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(children: [
                _row(context, Icons.notifications_none_rounded, tr('Notifications', 'Notifications'), '/notifications',
                    trailing: unread > 0 ? Badge(label: Text('$unread'), backgroundColor: FsColors.orange) : null),
                _row(context, Icons.credit_card_rounded, tr('Billing', 'Facturation'), '/billing'),
                _row(context, Icons.settings_outlined, tr('Settings', 'Paramètres'), '/settings'),
                _row(context, Icons.shield_outlined, tr('Security', 'Sécurité'), '/settings/security'),
                if (account?.isStaff == true)
                  ListTile(
                    leading: Icon(Icons.admin_panel_settings_outlined, color: c.ink2),
                    title: Text(tr('Admin console', "Console d'administration"), style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(tr('Opens on flacronsport.com', "S'ouvre sur flacronsport.com"), style: context.text.bodySmall),
                    trailing: Icon(Icons.open_in_new_rounded, size: 18, color: c.ink3),
                    onTap: () => openWeb('/app/admin'),
                  ),
              ]),
            ).entrance(4),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 20, 16, navClearance(context)),
            child: OutlinedButton.icon(
              onPressed: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: Text(tr('Sign out?', 'Se déconnecter ?')),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(context, false), child: Text(tr('Cancel', 'Annuler'))),
                      FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(tr('Sign out', 'Se déconnecter'))),
                    ],
                  ),
                );
                if (ok == true) await AuthService.instance.signOut();
              },
              icon: const Icon(Icons.logout_rounded),
              label: Text(tr('Sign out', 'Se déconnecter')),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _row(BuildContext context, IconData icon, String title, String path, {Widget? trailing}) {
    final c = context.fs;
    return ListTile(
      leading: Icon(icon, color: c.ink2),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        if (trailing != null) ...[trailing, const SizedBox(width: 6)],
        Icon(Icons.chevron_right_rounded, color: c.ink3),
      ]),
      onTap: () => context.push(path),
    );
  }

  Widget _section(BuildContext context, String title, List<_Tool> items, int index) {
    return SliverMainAxisGroup(slivers: [
      SliverToBoxAdapter(child: SectionHeader(title)),
      SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        sliver: SliverGrid.builder(
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 0.98),
          itemCount: items.length,
          itemBuilder: (context, i) => _ToolTile(tool: items[i]).entrance(index * 3 + i, baseMs: 30),
        ),
      ),
    ]);
  }
}

class _ToolTile extends StatelessWidget {
  const _ToolTile({required this.tool});
  final _Tool tool;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Pressable(
      onTap: () => context.push(tool.path),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: c.line),
        ),
        child: Stack(children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                gradient: LinearGradient(colors: [tool.color.withValues(alpha: 0.22), tool.color.withValues(alpha: 0.08)]),
              ),
              child: Icon(tool.icon, color: tool.color, size: 22),
            ),
            Text(tr(tool.en, tool.fr), maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: c.ink)),
          ]),
          if (tool.locked)
            Positioned(
              right: 0,
              top: 0,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(color: c.surfaceMuted, shape: BoxShape.circle),
                child: Icon(Icons.lock_rounded, size: 12, color: c.ink3),
              ),
            ),
        ]),
      ),
    );
  }
}
