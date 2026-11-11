import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api/api_client.dart';
import '../core/config.dart';
import '../core/i18n.dart';
import '../core/theme/app_theme.dart';

/// Scales down slightly while pressed: the app's standard touch feedback.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.onTap, this.onLongPress, this.scale = 0.97, this.haptic = true});
  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double scale;
  final bool haptic;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null || widget.onLongPress != null;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: enabled ? (_) => setState(() => _down = true) : null,
      onTapUp: enabled ? (_) => setState(() => _down = false) : null,
      onTapCancel: enabled ? () => setState(() => _down = false) : null,
      onTap: widget.onTap == null
          ? null
          : () {
              if (widget.haptic) HapticFeedback.selectionClick();
              widget.onTap!();
            },
      onLongPress: widget.onLongPress,
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: const Duration(milliseconds: 140),
        curve: AppTheme.ease,
        child: widget.child,
      ),
    );
  }
}

/// The standard surface: rounded, hairline border, soft shadow in light mode.
class FsCard extends StatelessWidget {
  const FsCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap, this.color, this.radius = AppTheme.radius, this.border = true, this.gradient});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;
  final double radius;
  final bool border;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final box = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: gradient == null ? (color ?? c.surface) : null,
        gradient: gradient,
        borderRadius: BorderRadius.circular(radius),
        border: border ? Border.all(color: c.line.withValues(alpha: context.isDark ? 1 : 0.8)) : null,
        boxShadow: context.isDark
            ? null
            : [BoxShadow(color: const Color(0xFF0A1A33).withValues(alpha: 0.05), blurRadius: 18, offset: const Offset(0, 6), spreadRadius: -6)],
      ),
      child: child,
    );
    return onTap == null ? box : Pressable(onTap: onTap, child: box);
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.action, this.onAction, this.icon, this.padding = const EdgeInsets.fromLTRB(20, 24, 12, 10)});
  final String title;
  final String? action;
  final VoidCallback? onAction;
  final IconData? icon;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(children: [
        if (icon != null) ...[Icon(icon, size: 20, color: context.fs.accent), const SizedBox(width: 8)],
        Expanded(child: Text(title, style: context.text.titleLarge)),
        if (action != null)
          TextButton(
            onPressed: onAction,
            child: Row(mainAxisSize: MainAxisSize.min, children: [Text(action!), const SizedBox(width: 2), const Icon(Icons.chevron_right_rounded, size: 18)]),
          ),
      ]),
    );
  }
}

/// Pulsing red dot for live games.
class LiveDot extends StatelessWidget {
  const LiveDot({super.key, this.size = 7});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(width: size, height: size, decoration: BoxDecoration(color: context.fs.live, shape: BoxShape.circle))
        .animate(onPlay: (c) => c.repeat(reverse: true))
        .fade(begin: 1, end: 0.25, duration: 800.ms);
  }
}

class Pill extends StatelessWidget {
  const Pill(this.label, {super.key, this.color, this.background, this.icon, this.live = false});
  final String label;
  final Color? color;
  final Color? background;
  final IconData? icon;
  final bool live;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final fg = live ? c.live : (color ?? c.ink2);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: background ?? (live ? c.live.withValues(alpha: 0.12) : c.surfaceMuted),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (live) ...[const LiveDot(size: 6), const SizedBox(width: 5)],
        if (icon != null) ...[Icon(icon, size: 13, color: fg), const SizedBox(width: 4)],
        Text(label, style: TextStyle(fontFamily: 'Inter', fontSize: 11.5, fontWeight: FontWeight.w700, color: fg)),
      ]),
    );
  }
}

/// Team badge from the provider, or initials on a tinted disc.
class Crest extends StatelessWidget {
  const Crest({super.key, this.url, required this.name, this.size = 32});
  final String? url;
  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final initials = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => w[0].toUpperCase()).join();
    final fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: c.surfaceMuted, shape: BoxShape.circle, border: Border.all(color: c.line)),
      child: Text(initials, style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, fontSize: size * 0.36, color: c.ink2)),
    );
    if (url == null || url!.isEmpty) return fallback;
    return SizedBox(
      width: size,
      height: size,
      child: CachedNetworkImage(
        imageUrl: url!.endsWith('/tiny') || url!.contains('/preview') ? url! : '$url/tiny',
        fit: BoxFit.contain,
        fadeInDuration: const Duration(milliseconds: 200),
        placeholder: (_, _) => fallback,
        errorWidget: (_, _, _) => CachedNetworkImage(imageUrl: url!, fit: BoxFit.contain, errorWidget: (_, _, _) => fallback),
      ),
    );
  }
}

/// Grey shimmering block while content loads.
class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.height = 16, this.width, this.radius = 10});
  final double height;
  final double? width;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Shimmer.fromColors(
      baseColor: c.surfaceMuted,
      highlightColor: context.isDark ? c.line : Colors.white,
      child: Container(height: height, width: width, decoration: BoxDecoration(color: c.surfaceMuted, borderRadius: BorderRadius.circular(radius))),
    );
  }
}

class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 6, this.height = 72, this.padding = const EdgeInsets.fromLTRB(16, 8, 16, 8)});
  final int count;
  final double height;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Column(
        children: List.generate(count, (i) => Padding(padding: const EdgeInsets.only(bottom: 10), child: Skeleton(height: height, radius: 16))),
      ),
    );
  }
}

/// Empty or error state with an optional action.
class StateView extends StatelessWidget {
  const StateView({super.key, required this.icon, required this.title, this.message, this.action, this.onAction, this.compact = false});
  final IconData icon;
  final String title;
  final String? message;
  final String? action;
  final VoidCallback? onAction;
  final bool compact;

  factory StateView.empty(String title, {String? message, IconData icon = Icons.inbox_rounded, String? action, VoidCallback? onAction, bool compact = false}) =>
      StateView(icon: icon, title: title, message: message, action: action, onAction: onAction, compact: compact);

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 32, vertical: compact ? 20 : 48),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: compact ? 52 : 72,
            height: compact ? 52 : 72,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(colors: [c.accent.withValues(alpha: 0.16), c.brand.withValues(alpha: 0.10)]),
            ),
            child: Icon(icon, size: compact ? 24 : 32, color: c.accent),
          ).animate().scale(begin: const Offset(0.8, 0.8), duration: 400.ms, curve: Curves.easeOutBack),
          SizedBox(height: compact ? 12 : 18),
          Text(title, textAlign: TextAlign.center, style: context.text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          if (message != null) ...[
            const SizedBox(height: 6),
            Text(message!, textAlign: TextAlign.center, style: context.text.bodyMedium),
          ],
          if (action != null && onAction != null) ...[
            const SizedBox(height: 18),
            FilledButton(onPressed: onAction, child: Text(action!)),
          ],
        ]),
      ),
    );
  }
}

/// Maps an error to the right state: no plan, higher plan, offline, or generic.
class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, this.onRetry, this.compact = false});
  final Object error;
  final VoidCallback? onRetry;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final e = error;
    if (e is ApiException) {
      if (e.needsPlan) {
        return StateView(
          icon: Icons.workspace_premium_rounded,
          title: tr('Choose a plan to continue', 'Choisissez une formule pour continuer'),
          message: tr('This needs an active FlacronSport plan.', 'Cette fonction nécessite une formule FlacronSport active.'),
          action: tr('See plans', 'Voir les formules'),
          onAction: () => context.push('/plans'),
          compact: compact,
        );
      }
      if (e.needsHigherPlan) {
        return StateView(
          icon: Icons.lock_rounded,
          title: tr('Available on Plus and Premium', 'Disponible avec Plus et Premium'),
          message: e.message,
          action: tr('Upgrade', 'Passer à la formule supérieure'),
          onAction: () => context.push('/billing'),
          compact: compact,
        );
      }
      if (e.code == 'feature_disabled') {
        return StateView(icon: Icons.construction_rounded, title: tr('Not available right now', 'Indisponible pour le moment'), compact: compact);
      }
      if (e.isNetwork) {
        return StateView(
          icon: Icons.wifi_off_rounded,
          title: tr("You're offline", 'Vous êtes hors ligne'),
          message: tr('Check your connection and try again.', 'Vérifiez votre connexion et réessayez.'),
          action: onRetry == null ? null : tr('Retry', 'Réessayer'),
          onAction: onRetry,
          compact: compact,
        );
      }
    }
    return StateView(
      icon: Icons.error_outline_rounded,
      title: tr("Couldn't load this", 'Chargement impossible'),
      message: e is ApiException ? e.message : tr('Something went wrong. Try again.', 'Une erreur est survenue. Réessayez.'),
      action: onRetry == null ? null : tr('Retry', 'Réessayer'),
      onAction: onRetry,
      compact: compact,
    );
  }
}

/// Renders an AsyncValue with skeleton / error / data.
class AsyncView<T> extends StatelessWidget {
  const AsyncView({super.key, required this.value, required this.builder, this.onRetry, this.loading, this.compact = false});
  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final VoidCallback? onRetry;
  final Widget? loading;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final v = value;
    if (v.hasValue) return builder(v.value as T);
    if (v.hasError) return ErrorView(error: v.error!, onRetry: onRetry, compact: compact);
    return loading ?? const SkeletonList();
  }
}

/// Horizontal chip strip.
class ChipStrip extends StatelessWidget {
  const ChipStrip({super.key, required this.items, required this.selected, required this.onSelect, this.padding = const EdgeInsets.symmetric(horizontal: 16)});
  final List<(String value, String label, IconData? icon)> items;
  final String selected;
  final ValueChanged<String> onSelect;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: padding,
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final (value, label, icon) = items[i];
          final active = value == selected;
          return Pressable(
            onTap: () => onSelect(value),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              curve: AppTheme.ease,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: active ? (context.isDark ? c.accent : FsColors.navy) : c.surface,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: active ? Colors.transparent : c.line),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                if (icon != null) ...[Icon(icon, size: 16, color: active ? Colors.white : c.ink2), const SizedBox(width: 6)],
                Text(label, style: TextStyle(fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w700, color: active ? Colors.white : c.ink2)),
              ]),
            ),
          );
        },
      ),
    );
  }
}

/// Branded app bar title with the FS mark.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.height = 26});
  final double height;

  @override
  Widget build(BuildContext context) => Image.asset(
        context.isDark ? 'assets/brand/fs-mark-reversed.png' : 'assets/brand/fs-mark.png',
        height: height,
        filterQuality: FilterQuality.high,
      );
}

void toast(BuildContext context, String message, {bool error = false}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(SnackBar(
    content: Row(children: [
      Icon(error ? Icons.error_outline_rounded : Icons.check_circle_rounded, color: error ? const Color(0xFFFF8A8A) : const Color(0xFF7CE0A3), size: 20),
      const SizedBox(width: 10),
      Expanded(child: Text(message)),
    ]),
    duration: const Duration(seconds: 3),
  ));
}

String errorText(Object e) {
  if (e is ApiException) {
    return switch (e.code) {
      'favorites_limit' => tr('Your plan has reached its favorites limit. Upgrade to follow more.', 'Votre formule a atteint sa limite de favoris. Passez à la formule supérieure.'),
      'subscription_required' => tr('Choose a plan to use this.', 'Choisissez une formule pour utiliser ceci.'),
      'plan_required' => tr('This needs the Plus or Premium plan.', 'Ceci nécessite la formule Plus ou Premium.'),
      'email_not_verified' => tr('Verify your email address first.', "Vérifiez d'abord votre adresse e-mail."),
      'rate_limited' => tr('Too many requests. Slow down a little.', 'Trop de requêtes. Ralentissez un peu.'),
      'guidelines_required' => tr('Accept the community guidelines first.', "Acceptez d'abord les règles de la communauté."),
      'sanctioned' => tr('Your community access is restricted.', 'Votre accès à la communauté est restreint.'),
      'allowance_exhausted' => tr('No credits left.', 'Plus de crédits.'),
      _ => e.message,
    };
  }
  return tr('Something went wrong.', 'Une erreur est survenue.');
}

Future<void> openExternal(String url) async {
  final uri = Uri.parse(url);
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// Opens a page of the website (billing, pricing, policies) in the browser.
Future<void> openWeb(String path) => openExternal(AppConfig.webUrl(path, locale: AppLocale.code));

/// Staggered entrance for list items.
extension EntranceX on Widget {
  Widget entrance(int index, {int baseMs = 40}) => animate()
      .fadeIn(duration: 380.ms, delay: (index.clamp(0, 10) * baseMs).ms, curve: AppTheme.ease)
      .slideY(begin: 0.08, end: 0, duration: 420.ms, delay: (index.clamp(0, 10) * baseMs).ms, curve: AppTheme.ease);
}
