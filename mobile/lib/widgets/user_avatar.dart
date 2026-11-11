import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/state/providers.dart';
import '../core/theme/app_theme.dart';

/// The member's profile photo (Firebase `photoURL`, set through /api/me/avatar
/// or by Google), or their initials on the brand gradient.
class UserAvatar extends ConsumerWidget {
  const UserAvatar({super.key, this.size = 40, this.ring = false});
  final double size;
  final bool ring;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authUserProvider).value;
    final name = (user?.displayName?.trim().isNotEmpty == true ? user!.displayName! : (user?.email ?? '?')).trim();
    final initials = name.isEmpty ? '?' : name.split(RegExp(r'[\s@._-]+')).where((w) => w.isNotEmpty).take(2).map((w) => w[0].toUpperCase()).join();
    final photo = user?.photoURL;

    final fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [FsColors.orange, FsColors.navy]),
      ),
      child: Text(initials, style: TextStyle(fontFamily: 'Sora', fontWeight: FontWeight.w700, color: Colors.white, fontSize: size * 0.36)),
    );

    final image = photo == null || photo.isEmpty
        ? fallback
        : ClipOval(
            child: CachedNetworkImage(
              imageUrl: photo,
              width: size,
              height: size,
              fit: BoxFit.cover,
              placeholder: (_, _) => fallback,
              errorWidget: (_, _, _) => fallback,
            ),
          );

    if (!ring) return image;
    return Container(
      padding: const EdgeInsets.all(2.5),
      decoration: const BoxDecoration(shape: BoxShape.circle, gradient: SweepGradient(colors: [FsColors.orange, FsColors.navy, FsColors.orange])),
      child: Container(
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(shape: BoxShape.circle, color: context.fs.bg),
        child: image,
      ),
    );
  }
}
