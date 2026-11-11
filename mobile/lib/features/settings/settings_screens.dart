import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_service.dart';
import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/account.dart';
import '../../models/json.dart';
import '../../models/preferences.dart';
import '../../models/sport.dart';
import '../../widgets/common.dart';
import '../../widgets/user_avatar.dart';

const _appVersion = String.fromEnvironment('APP_VERSION', defaultValue: '1.0.0');

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

class _Group extends StatelessWidget {
  const _Group({required this.title, required this.children, this.icon, this.groupKey, this.footer});
  final String title;
  final IconData? icon;
  final List<Widget> children;
  final Key? groupKey;
  final String? footer;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Column(key: groupKey, crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(6, 26, 6, 10),
        child: Row(children: [
          if (icon != null) ...[Icon(icon, size: 18, color: c.accent), const SizedBox(width: 8)],
          Text(title.toUpperCase(), style: context.text.labelSmall?.copyWith(letterSpacing: 1, fontWeight: FontWeight.w800)),
        ]),
      ),
      FsCard(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) Divider(indent: 16, endIndent: 16, color: c.line.withValues(alpha: 0.7)),
            children[i],
          ],
        ]),
      ),
      if (footer != null) Padding(padding: const EdgeInsets.fromLTRB(8, 8, 8, 0), child: Text(footer!, style: context.text.bodySmall)),
    ]);
  }
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow({required this.title, this.subtitle, required this.value, required this.onChanged, this.locked = false, this.icon});
  final String title;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool>? onChanged;
  final bool locked;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return SwitchListTile.adaptive(
      value: value,
      onChanged: locked ? null : onChanged,
      secondary: icon == null ? null : Icon(icon, color: c.ink2),
      title: Row(children: [
        Flexible(child: Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: locked ? c.ink3 : c.ink))),
        if (locked) ...[const SizedBox(width: 6), Icon(Icons.lock_rounded, size: 14, color: c.ink3)],
      ]),
      subtitle: subtitle == null ? null : Text(subtitle!, style: context.text.bodySmall),
    );
  }
}

class _NavRow extends StatelessWidget {
  const _NavRow({required this.icon, required this.title, this.subtitle, this.onTap, this.trailing, this.danger = false, this.external = false});
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool danger, external;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return ListTile(
      onTap: onTap,
      leading: Icon(icon, color: danger ? c.danger : c.ink2),
      title: Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: danger ? c.danger : c.ink)),
      subtitle: subtitle == null ? null : Text(subtitle!, style: context.text.bodySmall),
      trailing: trailing ?? Icon(external ? Icons.open_in_new_rounded : Icons.chevron_right_rounded, size: 20, color: c.ink3),
    );
  }
}

String _alertName(String type) => switch (type) {
      'start' => tr('Event start', "Début de l'événement"),
      'final' => tr('Final result', 'Résultat final'),
      'participants' => tr('Lineups and participants', 'Compositions et participants'),
      'scoring' => tr('Scoring', 'Scores'),
      'interval' => tr('Interval', 'Mi-temps et pauses'),
      'highlights' => tr('Highlights', 'Temps forts'),
      _ => type,
    };

String _hour(int? h) {
  if (h == null) return tr('Off', 'Désactivé');
  return Fmt.time(DateTime(2000, 1, 1, h));
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key, this.section});
  final String? section;

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _keys = {for (final s in ['general', 'alerts', 'calendar', 'privacy', 'help']) s: GlobalKey()};

  @override
  void initState() {
    super.initState();
    final target = _keys[widget.section];
    if (target != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Future.delayed(const Duration(milliseconds: 350), () {
          final ctx = target.currentContext;
          if (ctx != null && ctx.mounted) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 500), curve: AppTheme.ease);
        });
      });
    }
  }

  Future<void> _save(Json patch) async {
    try {
      await ref.read(prefsProvider.notifier).save(patch);
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    }
  }

  Future<void> _saveAlerts(Preferences prefs, Json change) => _save({'alerts': {...prefs.alerts, ...change}});

  Future<void> _pickTimeZone(Preferences prefs) async {
    final zone = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _TimeZoneSheet(current: prefs.timeZone),
    );
    if (zone != null && zone != prefs.timeZone) await _save({'timeZone': zone});
  }

  Future<void> _pickHour(Preferences prefs, String field) async {
    final current = asInt(prefs.alerts[field]);
    final picked = await showModalBottomSheet<int>(
      context: context,
      builder: (context) => SafeArea(
        child: SizedBox(
          height: 380,
          child: ListView(children: [
            ListTile(
              title: Text(tr('Off', 'Désactivé')),
              trailing: current == null ? Icon(Icons.check_rounded, color: context.fs.accent) : null,
              onTap: () => Navigator.pop(context, -1),
            ),
            for (var h = 0; h < 24; h++)
              ListTile(
                title: Text(_hour(h)),
                trailing: current == h ? Icon(Icons.check_rounded, color: context.fs.accent) : null,
                onTap: () => Navigator.pop(context, h),
              ),
          ]),
        ),
      ),
    );
    if (picked == null) return;
    await _saveAlerts(prefs, {field: picked < 0 ? null : picked});
  }

  Future<void> _export() async {
    try {
      final bytes = await api.bytes('GET', '/me/export');
      await SharePlus.instance.share(ShareParams(
        files: [XFile.fromData(bytes, mimeType: 'application/json', name: 'flacronsport-data.json')],
        fileNameOverrides: const ['flacronsport-data.json'],
        subject: tr('My FlacronSport data', 'Mes données FlacronSport'),
      ));
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(context: context, builder: (_) => const _DeleteDialog());
    if (confirmed != true || !mounted) return;
    showDialog(context: context, barrierDismissible: false, builder: (_) => const Center(child: CircularProgressIndicator()));
    try {
      await api.delete('/me');
      if (mounted) Navigator.of(context, rootNavigator: true).pop();
      await AuthService.instance.signOut();
    } catch (e) {
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        toast(context, errorText(e), error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final prefsValue = ref.watch(prefsProvider);
    final prefs = prefsValue.value ?? Preferences.defaults;
    final account = ref.watch(accountProvider).value;
    final user = ref.watch(authUserProvider).value;
    final themeMode = ref.watch(themeModeProvider);
    final alerts = prefs.alerts;
    final muted = asBool(alerts['muted']);
    final types = asStringList(alerts['types']);
    final plus = account?.plusFeatures ?? false;
    final premium = account?.isPremium ?? false;
    final filters = asMap(alerts['filters']);
    final filterSports = asStringList(filters['sports']);
    final newsletter = asBool(prefs.newsletter['optedIn']);

    return Scaffold(
      appBar: AppBar(title: Text(tr('Settings', 'Paramètres'))),
      body: prefsValue.hasError && !prefsValue.hasValue
          ? ErrorView(error: prefsValue.error!, onRetry: () => ref.invalidate(prefsProvider))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 48),
              children: [
                // Profile
                FsCard(
                  onTap: () => context.push('/settings/profile'),
                  child: Row(children: [
                    const Hero(tag: 'profile-avatar', child: UserAvatar(size: 56, ring: true)),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(
                          user?.displayName?.trim().isNotEmpty == true ? user!.displayName! : tr('Your profile', 'Votre profil'),
                          style: context.text.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(user?.email ?? '', style: context.text.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                        const SizedBox(height: 6),
                        if (account != null) Pill(account.planInfo.label, icon: Icons.workspace_premium_rounded, color: c.accentText),
                      ]),
                    ),
                    Icon(Icons.chevron_right_rounded, color: c.ink3),
                  ]),
                ).entrance(0),

                // General
                _Group(groupKey: _keys['general'], title: tr('General', 'Général'), icon: Icons.tune_rounded, children: [
                  ListTile(
                    leading: Icon(Icons.translate_rounded, color: c.ink2),
                    title: Text(tr('Language', 'Langue'), style: const TextStyle(fontWeight: FontWeight.w600)),
                    trailing: SegmentedButton<String>(
                      showSelectedIcon: false,
                      style: const ButtonStyle(visualDensity: VisualDensity.compact),
                      segments: const [ButtonSegment(value: 'en', label: Text('EN')), ButtonSegment(value: 'fr', label: Text('FR'))],
                      selected: {prefs.locale},
                      onSelectionChanged: (s) => _save({'locale': s.first}),
                    ),
                  ),
                  _NavRow(
                    icon: Icons.schedule_rounded,
                    title: tr('Time zone', 'Fuseau horaire'),
                    subtitle: prefs.timeZone,
                    onTap: () => _pickTimeZone(prefs),
                  ),
                  _SwitchRow(
                    icon: Icons.visibility_off_outlined,
                    title: tr('Spoiler mode', 'Mode anti-spoiler'),
                    subtitle: tr('Hide scores until you choose to reveal them.', "Masquez les scores jusqu'à ce que vous choisissiez de les afficher."),
                    value: prefs.spoilerMode,
                    onChanged: (v) {
                      LocalStore.setSpoilerDecided();
                      _save({'spoilerMode': v});
                    },
                  ),
                  _SwitchRow(
                    icon: Icons.data_saver_on_rounded,
                    title: tr('Low-data mode', 'Mode données réduites'),
                    subtitle: tr('Load scores first, and video only when you ask for it.', "Chargez d'abord les scores, et la vidéo seulement à votre demande."),
                    value: prefs.lowData,
                    onChanged: (v) => _save({'lowData': v}),
                  ),
                  _SwitchRow(
                    icon: Icons.star_outline_rounded,
                    title: tr('Favorites only on Scores', 'Favoris uniquement dans Scores'),
                    subtitle: tr('Open Scores showing the teams you follow.', 'Ouvrir Scores sur les équipes que vous suivez.'),
                    value: prefs.scoresFavoritesOnly,
                    onChanged: (v) => _save({'scoresFavoritesOnly': v}),
                  ),
                ]),

                // Appearance
                _Group(title: tr('Appearance', 'Apparence'), icon: Icons.palette_outlined, children: [
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: SizedBox(
                      width: double.infinity,
                      child: SegmentedButton<ThemeMode>(
                        showSelectedIcon: false,
                        segments: [
                          ButtonSegment(value: ThemeMode.system, icon: const Icon(Icons.brightness_auto_rounded, size: 18), label: Text(tr('Auto', 'Auto'))),
                          ButtonSegment(value: ThemeMode.light, icon: const Icon(Icons.light_mode_rounded, size: 18), label: Text(tr('Light', 'Clair'))),
                          ButtonSegment(value: ThemeMode.dark, icon: const Icon(Icons.dark_mode_rounded, size: 18), label: Text(tr('Dark', 'Sombre'))),
                        ],
                        selected: {themeMode},
                        onSelectionChanged: (s) => ref.read(themeModeProvider.notifier).set(s.first),
                      ),
                    ),
                  ),
                ]),

                // Alerts
                _Group(
                  groupKey: _keys['alerts'],
                  title: tr('Alerts', 'Alertes'),
                  icon: Icons.notifications_active_outlined,
                  children: [
                    _SwitchRow(
                      icon: Icons.notifications_off_outlined,
                      title: tr('Mute all alerts', 'Couper toutes les alertes'),
                      value: muted,
                      onChanged: (v) => _saveAlerts(prefs, {'muted': v}),
                    ),
                    _SwitchRow(
                      icon: Icons.summarize_outlined,
                      title: tr('Daily summary', 'Résumé quotidien'),
                      subtitle: tr('One alert a day with your teams’ results and fixtures.', 'Une alerte par jour avec les résultats et matchs de vos équipes.'),
                      value: asBool(alerts['dailySummary']),
                      locked: muted,
                      onChanged: (v) => _saveAlerts(prefs, {'dailySummary': v}),
                    ),
                    _SwitchRow(
                      icon: Icons.mail_outline_rounded,
                      title: tr('Email alerts', 'Alertes par e-mail'),
                      subtitle: tr('Also send alerts to your email address.', 'Envoyer aussi les alertes à votre adresse e-mail.'),
                      value: asBool(alerts['email']),
                      locked: muted,
                      onChanged: (v) => _saveAlerts(prefs, {'email': v}),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
                      child: Align(alignment: Alignment.centerLeft, child: Text(tr('Alert types', "Types d'alertes"), style: context.text.titleSmall)),
                    ),
                    for (final type in alertTypes)
                      CheckboxListTile(
                        dense: true,
                        controlAffinity: ListTileControlAffinity.trailing,
                        value: types.contains(type),
                        onChanged: muted || (!plus && !(type == 'start' || type == 'final'))
                            ? null
                            : (v) {
                                final next = [...types]..remove(type);
                                if (v == true) next.add(type);
                                _saveAlerts(prefs, {'types': alertTypes.where(next.contains).toList()});
                              },
                        title: Row(children: [
                          Flexible(child: Text(_alertName(type), style: const TextStyle(fontWeight: FontWeight.w600))),
                          if (!plus && !(type == 'start' || type == 'final')) ...[
                            const SizedBox(width: 6),
                            Icon(Icons.lock_rounded, size: 14, color: c.ink3),
                          ],
                        ]),
                      ),
                    if (!plus)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                        child: Row(children: [
                          Icon(Icons.workspace_premium_rounded, size: 15, color: c.accent),
                          const SizedBox(width: 6),
                          Expanded(child: Text(tr('Included with Plus and Premium.', 'Inclus avec Plus et Premium.'), style: context.text.bodySmall)),
                          TextButton(onPressed: () => context.push('/billing'), child: Text(tr('Upgrade', 'Évoluer'))),
                        ]),
                      ),
                    _NavRow(
                      icon: Icons.bedtime_outlined,
                      title: tr('Quiet hours from', 'Heures calmes de'),
                      trailing: Text(_hour(asInt(alerts['quietStart'])), style: TextStyle(color: c.accentText, fontWeight: FontWeight.w700)),
                      onTap: muted ? null : () => _pickHour(prefs, 'quietStart'),
                    ),
                    _NavRow(
                      icon: Icons.wb_twilight_rounded,
                      title: tr('Quiet hours to', 'Heures calmes à'),
                      trailing: Text(_hour(asInt(alerts['quietEnd'])), style: TextStyle(color: c.accentText, fontWeight: FontWeight.w700)),
                      onTap: muted ? null : () => _pickHour(prefs, 'quietEnd'),
                    ),
                  ],
                ),

                // Premium filters
                _Group(
                  title: tr('Advanced filters', 'Filtres avancés'),
                  icon: Icons.filter_alt_outlined,
                  footer: premium
                      ? tr('Choose which sports alert you. With none selected, every sport does.', 'Choisissez les sports qui vous alertent. Sans sélection, tous les sports le font.')
                      : tr('Included with Premium.', 'Inclus avec Premium.'),
                  children: [
                    _SwitchRow(
                      icon: Icons.emoji_events_outlined,
                      title: tr('Major competitions only', 'Grandes compétitions uniquement'),
                      value: asBool(filters['majorOnly']),
                      locked: !premium || muted,
                      onChanged: (v) => _saveAlerts(prefs, {
                        'filters': {'sports': filterSports, 'majorOnly': v}
                      }),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 6, 14, 14),
                      child: Wrap(spacing: 8, runSpacing: 8, children: [
                        for (final s in Sport.all)
                          FilterChip(
                            avatar: Icon(s.icon, size: 16, color: filterSports.contains(s.id) ? Colors.white : c.ink2),
                            label: Text(s.name),
                            selected: filterSports.contains(s.id),
                            labelStyle: TextStyle(fontWeight: FontWeight.w600, color: filterSports.contains(s.id) ? Colors.white : c.ink2),
                            onSelected: !premium || muted
                                ? null
                                : (v) {
                                    final next = [...filterSports]..remove(s.id);
                                    if (v) next.add(s.id);
                                    _saveAlerts(prefs, {
                                      'filters': {'sports': next, 'majorOnly': asBool(filters['majorOnly'])}
                                    });
                                  },
                          ),
                      ]),
                    ),
                  ],
                ),

                // Calendar feed
                if (account?.hasPlan == true) _CalendarFeedGroup(groupKey: _keys['calendar']),

                // Privacy
                _Group(groupKey: _keys['privacy'], title: tr('Privacy', 'Confidentialité'), icon: Icons.privacy_tip_outlined, children: [
                  _SwitchRow(
                    icon: Icons.newspaper_rounded,
                    title: tr('Newsletter', 'Newsletter'),
                    subtitle: tr('A daily digest, sent in your own time zone. Unsubscribe at any time.',
                        'Un résumé quotidien envoyé dans votre fuseau horaire. Désabonnement à tout moment.'),
                    value: newsletter,
                    onChanged: (v) => _save({
                      'newsletter': {'optedIn': v, 'consentedAt': null}
                    }),
                  ),
                  _NavRow(icon: Icons.download_rounded, title: tr('Download my data', 'Télécharger mes données'), onTap: _export),
                  _NavRow(icon: Icons.delete_forever_rounded, title: tr('Delete my account', 'Supprimer mon compte'), danger: true, onTap: _delete),
                ]),

                // Security
                _Group(title: tr('Security', 'Sécurité'), icon: Icons.shield_outlined, children: [
                  _NavRow(
                    icon: Icons.verified_user_outlined,
                    title: tr('Two-step verification', 'Validation en deux étapes'),
                    onTap: () => context.push('/settings/security'),
                  ),
                  _NavRow(icon: Icons.credit_card_rounded, title: tr('Billing', 'Facturation'), onTap: () => context.push('/billing')),
                ]),

                // Help
                _Group(groupKey: _keys['help'], title: tr('Help', 'Aide'), icon: Icons.help_outline_rounded, children: [
                  _NavRow(icon: Icons.quiz_outlined, title: tr('FAQ', 'FAQ'), external: true, onTap: () => openWeb('/faq')),
                  _NavRow(icon: Icons.support_agent_rounded, title: tr('Contact us', 'Nous contacter'), external: true, onTap: () => openWeb('/contact')),
                  _NavRow(icon: Icons.info_outline_rounded, title: tr('About FlacronSport', 'À propos de FlacronSport'), external: true, onTap: () => openWeb('/about')),
                  _NavRow(icon: Icons.groups_2_outlined, title: tr('Community guidelines', 'Règles de la communauté'), external: true, onTap: () => openWeb('/community-guidelines')),
                  _NavRow(icon: Icons.description_outlined, title: tr('Terms of service', "Conditions d'utilisation"), external: true, onTap: () => openWeb('/terms-of-service')),
                  _NavRow(icon: Icons.lock_outline_rounded, title: tr('Privacy policy', 'Politique de confidentialité'), external: true, onTap: () => openWeb('/privacy-policy')),
                  _NavRow(icon: Icons.cookie_outlined, title: tr('Cookie policy', 'Politique de cookies'), external: true, onTap: () => openWeb('/cookie-policy')),
                  _NavRow(icon: Icons.receipt_long_outlined, title: tr('Refund policy', 'Politique de remboursement'), external: true, onTap: () => openWeb('/refund-policy')),
                  _NavRow(icon: Icons.gavel_rounded, title: tr('End user licence (EULA)', "Contrat de licence (CLUF)"), external: true, onTap: () => openWeb('/eula')),
                  _NavRow(icon: Icons.warning_amber_rounded, title: tr('Disclaimer', 'Avertissement'), external: true, onTap: () => openWeb('/disclaimer')),
                ]),

                const SizedBox(height: 24),
                OutlinedButton.icon(
                  onPressed: () => AuthService.instance.signOut(),
                  icon: const Icon(Icons.logout_rounded),
                  label: Text(tr('Sign out', 'Se déconnecter')),
                ),
                const SizedBox(height: 16),
                Center(child: Text('FlacronSport $_appVersion · Flacron Enterprises LLC', style: context.text.bodySmall)),
              ],
            ),
    );
  }
}

class _DeleteDialog extends StatefulWidget {
  const _DeleteDialog();

  @override
  State<_DeleteDialog> createState() => _DeleteDialogState();
}

class _DeleteDialogState extends State<_DeleteDialog> {
  final _ctrl = TextEditingController();
  String get _word => tr('DELETE', 'SUPPRIMER');

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return AlertDialog(
      icon: Icon(Icons.warning_amber_rounded, color: c.danger, size: 32),
      title: Text(tr('Delete your account?', 'Supprimer votre compte ?')),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr('Delete your account for good? An active subscription is canceled immediately. This cannot be undone.',
            'Supprimer définitivement votre compte ? Un abonnement actif est annulé immédiatement. Cette action est irréversible.')),
        const SizedBox(height: 14),
        Text(tr('Type $_word to confirm.', 'Tapez $_word pour confirmer.'), style: context.text.bodySmall),
        const SizedBox(height: 8),
        TextField(controller: _ctrl, autofocus: true, textCapitalization: TextCapitalization.characters, onChanged: (_) => setState(() {})),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: Text(tr('Cancel', 'Annuler'))),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: c.danger),
          onPressed: _ctrl.text.trim().toUpperCase() == _word ? () => Navigator.pop(context, true) : null,
          child: Text(tr('Delete', 'Supprimer')),
        ),
      ],
    );
  }
}

class _TimeZoneSheet extends StatefulWidget {
  const _TimeZoneSheet({required this.current});
  final String current;

  @override
  State<_TimeZoneSheet> createState() => _TimeZoneSheetState();
}

class _TimeZoneSheetState extends State<_TimeZoneSheet> {
  List<String>? _zones;
  String _q = '';
  String? _device;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final all = await FlutterTimezone.getAvailableTimezones();
      final device = await FlutterTimezone.getLocalTimezone();
      final ids = all.map((z) => z.identifier).where((z) => z.isNotEmpty && z.length <= 64).toSet().toList()..sort();
      if (!ids.contains('UTC')) ids.insert(0, 'UTC');
      if (mounted) {
        setState(() {
          _zones = ids;
          _device = device.identifier;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _zones = ['UTC']);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final list = (_zones ?? []).where((z) => z.toLowerCase().contains(_q.toLowerCase())).toList();
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.8,
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: TextField(
            autofocus: false,
            onChanged: (v) => setState(() => _q = v),
            decoration: InputDecoration(prefixIcon: const Icon(Icons.search_rounded), hintText: tr('Search time zones', 'Rechercher un fuseau')),
          ),
        ),
        if (_device != null && _q.isEmpty)
          ListTile(
            leading: Icon(Icons.my_location_rounded, color: c.accent),
            title: Text(tr('Use this device: $_device', 'Utiliser cet appareil : $_device')),
            onTap: () => Navigator.pop(context, _device),
          ),
        Expanded(
          child: _zones == null
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  itemCount: list.length,
                  itemBuilder: (context, i) => ListTile(
                    dense: true,
                    title: Text(list[i]),
                    trailing: list[i] == widget.current ? Icon(Icons.check_rounded, color: c.accent) : null,
                    onTap: () => Navigator.pop(context, list[i]),
                  ),
                ),
        ),
      ]),
    );
  }
}

/// Calendar subscription link (calendar-feed-panel.tsx). The link is shown once.
class _CalendarFeedGroup extends StatefulWidget {
  const _CalendarFeedGroup({this.groupKey});
  final Key? groupKey;

  @override
  State<_CalendarFeedGroup> createState() => _CalendarFeedGroupState();
}

class _CalendarFeedGroupState extends State<_CalendarFeedGroup> {
  bool? _active;
  bool _failed = false, _busy = false;
  String? _url;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = asMap(await api.get('/me/calendar-feed'));
      if (mounted) {
        setState(() {
          _active = asBool(res['active']);
          _failed = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  Future<void> _generate() async {
    if (_active == true) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(tr('Replace your link?', 'Remplacer votre lien ?')),
          content: Text(tr('Calendars using the old link stop updating.', "Les calendriers qui utilisent l'ancien lien ne seront plus mis à jour.")),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: Text(tr('Cancel', 'Annuler'))),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(tr('Replace', 'Remplacer'))),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() => _busy = true);
    try {
      final res = asMap(await api.post('/me/calendar-feed'));
      if (mounted) {
        setState(() {
          _url = asString(res['url']);
          _active = true;
        });
      }
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _stop() async {
    setState(() => _busy = true);
    try {
      await api.delete('/me/calendar-feed');
      if (mounted) {
        setState(() {
          _active = false;
          _url = null;
        });
        toast(context, tr('Calendar link turned off.', 'Lien de calendrier désactivé.'));
      }
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return _Group(
      groupKey: widget.groupKey,
      title: tr('Calendar', 'Calendrier'),
      icon: Icons.event_available_outlined,
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              tr('Add your teams’ games to Google Calendar, Apple Calendar or Outlook. They update on their own.',
                  'Ajoutez les matchs de vos équipes à Google Agenda, Apple Calendrier ou Outlook. Ils se mettent à jour tout seuls.'),
              style: context.text.bodyMedium,
            ),
            const SizedBox(height: 12),
            if (_failed)
              TextButton.icon(onPressed: _load, icon: const Icon(Icons.refresh_rounded), label: Text(tr('Retry', 'Réessayer')))
            else if (_active == null)
              const Skeleton(height: 44)
            else ...[
              if (_url != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(12)),
                  child: SelectableText(_url!, style: TextStyle(fontSize: 12.5, color: c.ink2)),
                ).animate().fadeIn(),
                const SizedBox(height: 6),
                Text(tr('This link is shown only once. Copy it now.', 'Ce lien ne s’affiche qu’une fois. Copiez-le maintenant.'),
                    style: TextStyle(color: c.warning, fontSize: 12.5, fontWeight: FontWeight.w600)),
                const SizedBox(height: 10),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  FilledButton.icon(
                    onPressed: () => openExternal(_url!.replaceFirst(RegExp(r'^https?:'), 'webcal:')),
                    icon: const Icon(Icons.calendar_month_rounded, size: 18),
                    label: Text(tr('Add to calendar', 'Ajouter au calendrier')),
                  ),
                  OutlinedButton.icon(
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: _url!));
                      toast(context, tr('Link copied.', 'Lien copié.'));
                    },
                    icon: const Icon(Icons.copy_rounded, size: 18),
                    label: Text(tr('Copy', 'Copier')),
                  ),
                ]),
              ] else
                Text(
                  _active! ? tr('Your calendar link is on.', 'Votre lien de calendrier est actif.') : tr('No calendar link yet.', 'Pas encore de lien de calendrier.'),
                  style: TextStyle(fontWeight: FontWeight.w600, color: _active! ? c.success : c.ink3),
                ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : _generate,
                    child: _busy
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : Text(_active! ? tr('New link', 'Nouveau lien') : tr('Create link', 'Créer le lien')),
                  ),
                ),
                if (_active!) ...[
                  const SizedBox(width: 10),
                  TextButton(onPressed: _busy ? null : _stop, child: Text(tr('Turn off', 'Désactiver'), style: TextStyle(color: c.danger))),
                ],
              ]),
            ],
          ]),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  late final TextEditingController _name;
  bool _savingName = false, _uploading = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: FirebaseAuth.instance.currentUser?.displayName ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _afterPhotoChange() async {
    await FirebaseAuth.instance.currentUser?.reload();
    ref.invalidate(authUserProvider);
  }

  Future<void> _pick(ImageSource source) async {
    final file = await ImagePicker().pickImage(source: source, maxWidth: 512, maxHeight: 512, imageQuality: 85);
    if (file == null) return;
    setState(() => _uploading = true);
    try {
      final bytes = await file.readAsBytes();
      if (bytes.length > 400 * 1024) {
        throw ApiException(413, 'too_large', tr('That image is too large. Choose a smaller one.', 'Cette image est trop grande. Choisissez-en une plus petite.'));
      }
      final name = file.name.toLowerCase();
      final type = name.endsWith('.png')
          ? 'image/png'
          : name.endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg';
      await api.put('/me/avatar', body: {'image': base64Encode(bytes), 'contentType': type});
      await _afterPhotoChange();
      if (mounted) toast(context, tr('Profile photo updated.', 'Photo de profil mise à jour.'));
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _remove() async {
    setState(() => _uploading = true);
    try {
      await api.delete('/me/avatar');
      await _afterPhotoChange();
      if (mounted) toast(context, tr('Profile photo removed.', 'Photo de profil supprimée.'));
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _photoOptions() {
    final hasPhoto = FirebaseAuth.instance.currentUser?.photoURL?.isNotEmpty == true;
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: Text(tr('Choose from gallery', 'Choisir dans la galerie')),
            onTap: () {
              Navigator.pop(context);
              _pick(ImageSource.gallery);
            },
          ),
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined),
            title: Text(tr('Take a photo', 'Prendre une photo')),
            onTap: () {
              Navigator.pop(context);
              _pick(ImageSource.camera);
            },
          ),
          if (hasPhoto)
            ListTile(
              leading: Icon(Icons.delete_outline_rounded, color: context.fs.danger),
              title: Text(tr('Remove photo', 'Supprimer la photo'), style: TextStyle(color: context.fs.danger)),
              onTap: () {
                Navigator.pop(context);
                _remove();
              },
            ),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }

  Future<void> _saveName() async {
    FocusScope.of(context).unfocus();
    final value = _name.text.trim();
    if (value.length > 60) {
      toast(context, tr('Use 60 characters or fewer.', 'Utilisez 60 caractères au maximum.'), error: true);
      return;
    }
    setState(() => _savingName = true);
    try {
      await AuthService.instance.updateDisplayName(value);
      ref.invalidate(authUserProvider);
      if (mounted) toast(context, tr('Name saved.', 'Nom enregistré.'));
    } catch (e) {
      if (mounted) toast(context, AuthService.message(e), error: true);
    } finally {
      if (mounted) setState(() => _savingName = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final user = ref.watch(authUserProvider).value;
    final account = ref.watch(accountProvider).value;
    return Scaffold(
      appBar: AppBar(title: Text(tr('Profile', 'Profil'))),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 40), children: [
        Center(
          child: Stack(clipBehavior: Clip.none, children: [
            GestureDetector(
              onTap: _uploading ? null : _photoOptions,
              child: Hero(tag: 'profile-avatar', child: const UserAvatar(size: 128, ring: true)),
            ),
            if (_uploading)
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.black.withValues(alpha: 0.4)),
                  child: const Center(child: CircularProgressIndicator(color: Colors.white)),
                ),
              ),
            Positioned(
              right: 0,
              bottom: 4,
              child: Pressable(
                onTap: _uploading ? null : _photoOptions,
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: FsColors.orange,
                    border: Border.all(color: c.bg, width: 3),
                    boxShadow: [BoxShadow(color: FsColors.orange.withValues(alpha: 0.4), blurRadius: 12)],
                  ),
                  child: const Icon(Icons.photo_camera_rounded, color: Colors.white, size: 20),
                ),
              ),
            ),
          ]),
        ).animate().fadeIn().scale(begin: const Offset(0.9, 0.9), curve: Curves.easeOutBack),
        const SizedBox(height: 12),
        Center(
          child: TextButton(onPressed: _uploading ? null : _photoOptions, child: Text(tr('Change photo', 'Changer la photo'))),
        ),
        const SizedBox(height: 16),
        FsCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr('Display name', "Nom d'affichage"), style: context.text.titleSmall),
            const SizedBox(height: 4),
            Text(tr('Shown in rooms, clubs and leaderboards.', 'Affiché dans les salons, clubs et classements.'), style: context.text.bodySmall),
            const SizedBox(height: 12),
            TextField(
              controller: _name,
              maxLength: 60,
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(prefixIcon: const Icon(Icons.badge_outlined), hintText: tr('Your name', 'Votre nom'), counterText: ''),
              onSubmitted: (_) => _saveName(),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _savingName ? null : _saveName,
                child: _savingName
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
                    : Text(tr('Save name', 'Enregistrer le nom')),
              ),
            ),
          ]),
        ).entrance(1),
        const SizedBox(height: 14),
        FsCard(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(children: [
            ListTile(
              leading: Icon(Icons.mail_outline_rounded, color: c.ink2),
              title: Text(tr('Email', 'E-mail'), style: context.text.bodySmall),
              subtitle: Text(user?.email ?? '', style: TextStyle(fontWeight: FontWeight.w600, color: c.ink)),
              trailing: user?.emailVerified == true
                  ? Pill(tr('Verified', 'Vérifié'), icon: Icons.verified_rounded, color: c.success, background: c.success.withValues(alpha: 0.12))
                  : null,
            ),
            Divider(indent: 16, endIndent: 16, color: c.line),
            ListTile(
              onTap: () => context.push('/billing'),
              leading: Icon(Icons.workspace_premium_outlined, color: c.ink2),
              title: Text(tr('Plan', 'Formule'), style: context.text.bodySmall),
              subtitle: Text(account?.planInfo.label ?? PlanInfo.none.label, style: TextStyle(fontWeight: FontWeight.w600, color: c.ink)),
              trailing: Icon(Icons.chevron_right_rounded, color: c.ink3),
            ),
            Divider(indent: 16, endIndent: 16, color: c.line),
            ListTile(
              leading: Icon(Icons.login_rounded, color: c.ink2),
              title: Text(tr('Sign-in method', 'Méthode de connexion'), style: context.text.bodySmall),
              subtitle: Text(
                (user?.providerData ?? []).map((p) => p.providerId == 'google.com' ? 'Google' : tr('Email and password', 'E-mail et mot de passe')).toSet().join(', '),
                style: TextStyle(fontWeight: FontWeight.w600, color: c.ink),
              ),
            ),
          ]),
        ).entrance(2),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Security (TOTP)
// ---------------------------------------------------------------------------

class SecurityScreen extends ConsumerStatefulWidget {
  const SecurityScreen({super.key});

  @override
  ConsumerState<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends ConsumerState<SecurityScreen> {
  List<MultiFactorInfo>? _factors;
  TotpSecret? _secret;
  String? _qrUrl;
  final _code = TextEditingController();
  bool _busy = false, _done = false, _resetBusy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final f = await AuthService.instance.enrolledFactors();
      if (mounted) setState(() => _factors = f);
    } catch (_) {
      if (mounted) setState(() => _factors = []);
    }
  }

  Future<void> _start() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final secret = await AuthService.instance.startTotpEnrollment();
      final email = FirebaseAuth.instance.currentUser?.email ?? 'account';
      final url = await secret.generateQrCodeUrl(accountName: email, issuer: 'FlacronSport');
      if (mounted) {
        setState(() {
          _secret = secret;
          _qrUrl = url;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = AuthService.message(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _finish() async {
    final code = _code.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _error = tr('Enter the 6-digit code from your app.', 'Saisissez le code à 6 chiffres de votre application.'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AuthService.instance.finishTotpEnrollment(_secret!, code);
      if (mounted) setState(() => _done = true);
    } catch (e) {
      if (mounted) setState(() => _error = AuthService.message(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendReset() async {
    final email = FirebaseAuth.instance.currentUser?.email;
    if (email == null) return;
    setState(() => _resetBusy = true);
    try {
      await AuthService.instance.sendReset(email);
      if (mounted) toast(context, tr('Reset link sent to $email.', 'Lien de réinitialisation envoyé à $email.'));
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _resetBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final user = ref.watch(authUserProvider).value;
    final hasPassword = user?.providerData.any((p) => p.providerId == 'password') ?? false;
    final enrolled = _factors ?? [];
    return Scaffold(
      appBar: AppBar(title: Text(tr('Security', 'Sécurité'))),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 40), children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c.heroStart, c.heroEnd]),
          ),
          child: Row(children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),
              child: Icon(enrolled.isNotEmpty ? Icons.verified_user_rounded : Icons.shield_outlined, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr('Two-step verification', 'Validation en deux étapes'),
                    style: const TextStyle(fontFamily: 'Sora', fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
                const SizedBox(height: 4),
                Text(
                  enrolled.isNotEmpty
                      ? tr('On. Sign-in asks for a code from your authenticator app.', "Activée. La connexion demande un code de votre application d'authentification.")
                      : tr('Add a code from an authenticator app to every sign-in.', "Ajoutez un code d'application d'authentification à chaque connexion."),
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.78), fontSize: 13.5, height: 1.4),
                ),
              ]),
            ),
          ]),
        ).entrance(0),
        const SizedBox(height: 16),
        if (_factors == null)
          const Skeleton(height: 80)
        else if (enrolled.isNotEmpty && _secret == null)
          FsCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(children: [
              for (final f in enrolled)
                ListTile(
                  leading: Icon(Icons.phonelink_lock_rounded, color: c.success),
                  title: Text(f.displayName ?? tr('Authenticator app', "Application d'authentification"), style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(tr('Added ${Fmt.dayMonthYear(DateTime.fromMillisecondsSinceEpoch((f.enrollmentTimestamp * 1000).round()))}',
                      'Ajoutée le ${Fmt.dayMonthYear(DateTime.fromMillisecondsSinceEpoch((f.enrollmentTimestamp * 1000).round()))}')),
                ),
            ]),
          ),
        if (_done)
          FsCard(
            child: Column(children: [
              Icon(Icons.check_circle_rounded, color: c.success, size: 48).animate().scale(curve: Curves.easeOutBack),
              const SizedBox(height: 10),
              Text(tr('Two-step verification is on', 'La validation en deux étapes est activée'), style: context.text.titleMedium, textAlign: TextAlign.center),
              const SizedBox(height: 6),
              Text(tr('Sign in again to continue with your new protection.', 'Reconnectez-vous pour continuer avec votre nouvelle protection.'),
                  style: context.text.bodyMedium, textAlign: TextAlign.center),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: FilledButton(onPressed: () => AuthService.instance.signOut(), child: Text(tr('Sign in again', 'Se reconnecter'))),
              ),
            ]),
          )
        else if (_secret != null)
          FsCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr('1. Add FlacronSport to your authenticator', '1. Ajoutez FlacronSport à votre application'), style: context.text.titleSmall),
              const SizedBox(height: 8),
              Text(tr('Open your authenticator app, or enter this setup key in it.', "Ouvrez votre application d'authentification, ou saisissez-y cette clé."),
                  style: context.text.bodySmall),
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(12)),
                child: SelectableText(
                  _secret!.secretKey.replaceAllMapped(RegExp(r'.{4}'), (m) => '${m[0]} ').trim(),
                  style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, letterSpacing: 1.5, color: c.ink),
                ),
              ),
              const SizedBox(height: 10),
              Wrap(spacing: 8, runSpacing: 8, children: [
                FilledButton.icon(
                  onPressed: _qrUrl == null
                      ? null
                      : () async {
                          try {
                            await _secret!.openInOtpApp(_qrUrl!);
                          } catch (_) {
                            if (context.mounted) {
                              toast(context, tr('No authenticator app found. Enter the key by hand.', "Aucune application trouvée. Saisissez la clé à la main."), error: true);
                            }
                          }
                        },
                  icon: const Icon(Icons.open_in_new_rounded, size: 18),
                  label: Text(tr('Open authenticator', "Ouvrir l'application")),
                ),
                OutlinedButton.icon(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: _secret!.secretKey));
                    toast(context, tr('Key copied.', 'Clé copiée.'));
                  },
                  icon: const Icon(Icons.copy_rounded, size: 18),
                  label: Text(tr('Copy key', 'Copier la clé')),
                ),
              ]),
              const SizedBox(height: 20),
              Text(tr('2. Enter the 6-digit code', '2. Saisissez le code à 6 chiffres'), style: context.text.titleSmall),
              const SizedBox(height: 10),
              TextField(
                controller: _code,
                keyboardType: TextInputType.number,
                maxLength: 6,
                textAlign: TextAlign.center,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                style: TextStyle(fontFamily: 'Sora', fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: 12, color: c.ink),
                decoration: const InputDecoration(counterText: '', hintText: '000000'),
              ),
              if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: TextStyle(color: c.danger))),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _busy ? null : _finish,
                  child: _busy
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
                      : Text(tr('Turn on', 'Activer')),
                ),
              ),
            ]),
          ).animate().fadeIn()
        else if (_factors != null && enrolled.isEmpty)
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (_error != null)
              Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(_error!, style: TextStyle(color: c.danger))),
            FilledButton.icon(
              onPressed: _busy ? null : _start,
              icon: _busy
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.add_moderator_rounded),
              label: Text(tr('Set up an authenticator app', "Configurer une application d'authentification")),
            ),
          ]),
        if (hasPassword) ...[
          const SizedBox(height: 22),
          FsCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: ListTile(
              leading: Icon(Icons.password_rounded, color: c.ink2),
              title: Text(tr('Change password', 'Changer le mot de passe'), style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text(tr('We email you a secure link.', 'Nous vous envoyons un lien sécurisé.'), style: context.text.bodySmall),
              trailing: _resetBusy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : Icon(Icons.chevron_right_rounded, color: c.ink3),
              onTap: _resetBusy ? null : _sendReset,
            ),
          ),
        ],
      ]),
    );
  }
}
