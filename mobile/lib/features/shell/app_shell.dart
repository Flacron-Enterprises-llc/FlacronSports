import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n.dart';
import '../../core/theme/app_theme.dart';

/// The five tabs, as the web's mobile bottom bar (home, scores, watch, news),
/// with "More" holding every other section of the product.
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      extendBody: true,
      body: shell,
      bottomNavigationBar: _FloatingNavBar(
        index: shell.currentIndex,
        onTap: (i) {
          HapticFeedback.selectionClick();
          shell.goBranch(i, initialLocation: i == shell.currentIndex);
        },
      ),
    );
  }
}

class _NavItem {
  const _NavItem(this.icon, this.activeIcon, this.en, this.fr);
  final IconData icon, activeIcon;
  final String en, fr;
}

const _items = [
  _NavItem(Icons.home_outlined, Icons.home_rounded, 'Home', 'Accueil'),
  _NavItem(Icons.scoreboard_outlined, Icons.scoreboard_rounded, 'Scores', 'Scores'),
  _NavItem(Icons.play_circle_outline_rounded, Icons.play_circle_rounded, 'Watch', 'Regarder'),
  _NavItem(Icons.article_outlined, Icons.article_rounded, 'News', 'Actus'),
  _NavItem(Icons.grid_view_outlined, Icons.grid_view_rounded, 'More', 'Plus'),
];

class _FloatingNavBar extends StatelessWidget {
  const _FloatingNavBar({required this.index, required this.onTap});
  final int index;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.fs;
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(14, 0, 14, bottom > 0 ? bottom : 12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(26),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
          child: Container(
            height: 68,
            decoration: BoxDecoration(
              color: (context.isDark ? const Color(0xFF0B1729) : Colors.white).withValues(alpha: context.isDark ? 0.86 : 0.9),
              borderRadius: BorderRadius.circular(26),
              border: Border.all(color: c.line.withValues(alpha: 0.7)),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 30, offset: const Offset(0, 10), spreadRadius: -10)],
            ),
            child: LayoutBuilder(builder: (context, box) {
              final w = box.maxWidth / _items.length;
              return Stack(children: [
                AnimatedPositioned(
                  duration: const Duration(milliseconds: 420),
                  curve: AppTheme.ease,
                  left: w * index + (w - 52) / 2,
                  top: 8,
                  child: Container(
                    width: 52,
                    height: 34,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      gradient: const LinearGradient(colors: [FsColors.orange, Color(0xFFFF7A3D)]),
                      boxShadow: [BoxShadow(color: FsColors.orange.withValues(alpha: 0.4), blurRadius: 14, offset: const Offset(0, 4), spreadRadius: -4)],
                    ),
                  ),
                ),
                Row(
                  children: List.generate(_items.length, (i) {
                    final item = _items[i];
                    final active = i == index;
                    return Expanded(
                      child: Semantics(
                        button: true,
                        selected: active,
                        label: tr(item.en, item.fr),
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => onTap(i),
                          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                            SizedBox(
                              height: 34,
                              child: Center(
                                child: AnimatedSwitcher(
                                  duration: const Duration(milliseconds: 220),
                                  transitionBuilder: (child, a) => ScaleTransition(scale: a, child: child),
                                  child: Icon(active ? item.activeIcon : item.icon,
                                      key: ValueKey(active), size: 22, color: active ? Colors.white : c.ink3),
                                ),
                              ),
                            ),
                            const SizedBox(height: 3),
                            AnimatedDefaultTextStyle(
                              duration: const Duration(milliseconds: 220),
                              style: TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 10.5,
                                fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                                color: active ? c.ink : c.ink3,
                              ),
                              child: Text(tr(item.en, item.fr)),
                            ),
                          ]),
                        ),
                      ),
                    );
                  }),
                ),
              ]);
            }),
          ),
        ),
      ),
    );
  }
}

/// Bottom padding so content clears the floating bar.
double navClearance(BuildContext context) => 96 + MediaQuery.paddingOf(context).bottom;
