import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';

import '../../core/i18n.dart';
import '../../core/state/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../models/sport.dart';

/// First-run walkthrough: what FlacronSport does, in four slides.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _Slide {
  const _Slide(this.titleEn, this.titleFr, this.bodyEn, this.bodyFr, this.accent);
  final String titleEn, titleFr, bodyEn, bodyFr;
  final Color accent;
}

const _slides = [
  _Slide('Every score, live', 'Tous les scores, en direct',
      'Follow 11 sports in one place: football, basketball, cricket, tennis, motorsport and more, updated as they happen.',
      "Suivez 11 sports au même endroit : football, basketball, cricket, tennis, sport automobile et plus, mis à jour en temps réel.",
      FsColors.orange),
  _Slide('Highlights and where to watch', 'Résumés et où regarder',
      'Authorized highlights, goal clips and TV listings for the games you care about.',
      'Résumés autorisés, buts en vidéo et programmes TV pour les matchs qui vous intéressent.',
      Color(0xFF4F8DF5)),
  _Slide('News and a sports assistant', 'Actus et assistant sportif',
      'Match reports written from verified data, plus an assistant that answers your questions on fixtures, results and tables.',
      'Des comptes rendus rédigés à partir de données vérifiées et un assistant qui répond à vos questions sur les matchs, résultats et classements.',
      Color(0xFF2EC27E)),
  _Slide('Watch together', 'Vivez-le ensemble',
      'Private rooms for match day, prediction leagues with friends, and clubs for your team and sport.',
      'Des salons privés pour le jour du match, des ligues de pronostics entre amis et des clubs pour votre équipe et votre sport.',
      Color(0xFFB07CFF)),
];

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _page = 0;

  Future<void> _finish() async {
    HapticFeedback.mediumImpact();
    await LocalStore.setOnboarded();
    if (mounted) context.go('/signin');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final last = _page == _slides.length - 1;
    final slide = _slides[_page];
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: FsColors.navyDeep,
        body: AnimatedContainer(
          duration: const Duration(milliseconds: 600),
          curve: AppTheme.ease,
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: const Alignment(0, -0.45),
              radius: 1.25,
              colors: [Color.lerp(FsColors.navy, slide.accent, 0.28)!, FsColors.navyDeep, const Color(0xFF020A18)],
              stops: const [0, 0.6, 1],
            ),
          ),
          child: SafeArea(
            child: Column(children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 12, 0),
                child: Row(children: [
                  Image.asset('assets/brand/fs-mark-reversed.png', height: 28),
                  const Spacer(),
                  ValueListenableBuilder<String>(
                    valueListenable: AppLocale.notifier,
                    builder: (context, code, _) => _LanguageToggle(code: code),
                  ),
                  const SizedBox(width: 4),
                  if (!last)
                    TextButton(
                      onPressed: _finish,
                      child: Text(tr('Skip', 'Passer'), style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w600)),
                    ),
                ]),
              ),
              Expanded(
                child: PageView.builder(
                  controller: _controller,
                  itemCount: _slides.length,
                  onPageChanged: (i) {
                    HapticFeedback.selectionClick();
                    setState(() => _page = i);
                  },
                  itemBuilder: (context, i) => _SlideView(index: i, slide: _slides[i]),
                ),
              ),
              SmoothPageIndicator(
                controller: _controller,
                count: _slides.length,
                effect: ExpandingDotsEffect(
                  dotHeight: 8,
                  dotWidth: 8,
                  expansionFactor: 3.4,
                  spacing: 6,
                  activeDotColor: FsColors.orange,
                  dotColor: Colors.white.withValues(alpha: 0.25),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: last
                        ? _finish
                        : () => _controller.nextPage(duration: const Duration(milliseconds: 520), curve: AppTheme.ease),
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 220),
                      child: Row(
                        key: ValueKey(last),
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(last ? tr('Get started', 'Commencer') : tr('Next', 'Suivant')),
                          const SizedBox(width: 8),
                          Icon(last ? Icons.rocket_launch_rounded : Icons.arrow_forward_rounded, size: 20),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _LanguageToggle extends StatelessWidget {
  const _LanguageToggle({required this.code});
  final String code;

  @override
  Widget build(BuildContext context) {
    Widget option(String value, String label) {
      final active = code == value;
      return GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          AppLocale.set(value);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(color: active ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(999)),
          child: Text(label, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: active ? FsColors.navy : Colors.white70)),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [option('en', 'EN'), option('fr', 'FR')]),
    );
  }
}

class _SlideView extends StatelessWidget {
  const _SlideView({required this.index, required this.slide});
  final int index;
  final _Slide slide;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, box) {
      final art = math.min(box.maxWidth * 0.82, box.maxHeight * 0.52);
      return SingleChildScrollView(
        physics: const ClampingScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: box.maxHeight),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              SizedBox(width: art, height: art, child: _art(art)),
              const SizedBox(height: 28),
              Text(
                tr(slide.titleEn, slide.titleFr),
                textAlign: TextAlign.center,
                style: const TextStyle(fontFamily: 'Sora', fontSize: 30, fontWeight: FontWeight.w800, color: Colors.white, height: 1.12, letterSpacing: -0.8),
              ).animate(key: ValueKey('t$index${AppLocale.code}')).fadeIn(duration: 500.ms).slideY(begin: 0.2, end: 0, curve: AppTheme.ease),
              const SizedBox(height: 14),
              Text(
                tr(slide.bodyEn, slide.bodyFr),
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 15.5, height: 1.5, color: Colors.white.withValues(alpha: 0.74)),
              ).animate(key: ValueKey('b$index${AppLocale.code}')).fadeIn(delay: 120.ms, duration: 500.ms).slideY(begin: 0.2, end: 0, curve: AppTheme.ease),
            ]),
          ),
        ),
      );
    });
  }

  Widget _art(double size) {
    switch (index) {
      case 0:
        return _SportsOrbit(size: size, accent: slide.accent);
      case 1:
        return _MockCard(
          accent: slide.accent,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              height: size * 0.36,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: LinearGradient(colors: [slide.accent.withValues(alpha: 0.6), FsColors.navy]),
              ),
              child: Center(
                child: Container(
                  width: 56,
                  height: 56,
                  decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white),
                  child: const Icon(Icons.play_arrow_rounded, size: 36, color: FsColors.navy),
                ).animate(onPlay: (c) => c.repeat(reverse: true)).scale(begin: const Offset(1, 1), end: const Offset(1.1, 1.1), duration: 900.ms),
              ),
            ),
            const SizedBox(height: 14),
            _line(Icons.sports_soccer_rounded, tr('Goal clips · Highlights', 'Buts · Résumés')),
            const SizedBox(height: 8),
            _line(Icons.live_tv_rounded, tr('TV listings near you', 'Programmes TV près de chez vous')),
          ]),
        );
      case 2:
        return _MockCard(
          accent: slide.accent,
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            _bubble(tr('Who plays tonight?', 'Qui joue ce soir ?'), mine: true),
            const SizedBox(height: 10),
            _bubble(tr('3 fixtures in your leagues. First kickoff 19:45.', '3 matchs dans vos ligues. Premier coup d\'envoi à 19h45.'), mine: false)
                .animate(delay: 500.ms)
                .fadeIn()
                .slideX(begin: -0.1, end: 0),
            const SizedBox(height: 14),
            _line(Icons.article_rounded, tr('Verified match reports', 'Comptes rendus vérifiés')),
          ]),
        );
      default:
        return _MockCard(
          accent: slide.accent,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            SizedBox(
              height: 44,
              child: Stack(children: List.generate(5, (i) {
                final colors = [FsColors.orange, const Color(0xFF4F8DF5), const Color(0xFF2EC27E), const Color(0xFFB07CFF), const Color(0xFFF0B44C)];
                return Positioned(
                  left: i * 30.0,
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: colors[i], border: Border.all(color: FsColors.navyDeep, width: 3)),
                    child: Icon([Icons.person, Icons.face, Icons.emoji_emotions, Icons.sports, Icons.star][i], color: Colors.white, size: 20),
                  ).animate(delay: (i * 90).ms).scale(begin: const Offset(0.4, 0.4), curve: Curves.easeOutBack),
                );
              })),
            ),
            const SizedBox(height: 16),
            _line(Icons.groups_rounded, tr('Private match rooms', 'Salons privés de match')),
            const SizedBox(height: 8),
            _line(Icons.emoji_events_rounded, tr('Prediction leagues', 'Ligues de pronostics')),
            const SizedBox(height: 8),
            _line(Icons.flag_rounded, tr('Team and sport clubs', "Clubs d'équipe et de sport")),
          ]),
        );
    }
  }

  Widget _line(IconData icon, String text) => Row(children: [
        Container(
          padding: const EdgeInsets.all(7),
          decoration: BoxDecoration(color: slide.accent.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, size: 16, color: slide.accent),
        ),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13.5))),
      ]);

  Widget _bubble(String text, {required bool mine}) => Align(
        alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 230),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: mine ? FsColors.orange : Colors.white.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 13.5, height: 1.35)),
        ),
      );
}

class _MockCard extends StatelessWidget {
  const _MockCard({required this.child, required this.accent});
  final Widget child;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
          boxShadow: [BoxShadow(color: accent.withValues(alpha: 0.28), blurRadius: 60, spreadRadius: -10)],
        ),
        child: child,
      ).animate().fadeIn(duration: 500.ms).scale(begin: const Offset(0.9, 0.9), curve: Curves.easeOutBack, duration: 600.ms),
    );
  }
}

/// Sport icons circling a live scoreboard.
class _SportsOrbit extends StatelessWidget {
  const _SportsOrbit({required this.size, required this.accent});
  final double size;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final r = size * 0.42;
    final sports = Sport.all;
    return Stack(alignment: Alignment.center, children: [
      Container(
        width: r * 2,
        height: r * 2,
        decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white.withValues(alpha: 0.08), width: 1.5)),
      ),
      ...List.generate(sports.length, (i) {
        final a = (i / sports.length) * 2 * math.pi - math.pi / 2;
        return Transform.translate(
          offset: Offset(math.cos(a) * r, math.sin(a) * r),
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withValues(alpha: 0.09),
              border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
            ),
            child: Icon(sports[i].icon, color: Colors.white, size: 20),
          ).animate(delay: (i * 60).ms).fadeIn(duration: 350.ms).scale(begin: const Offset(0.3, 0.3), curve: Curves.easeOutBack),
        );
      }),
      Container(
        width: size * 0.5,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: const LinearGradient(colors: [FsColors.navy, Color(0xFF0B3C85)]),
          boxShadow: [BoxShadow(color: accent.withValues(alpha: 0.45), blurRadius: 40, spreadRadius: -6)],
          border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Container(width: 7, height: 7, decoration: const BoxDecoration(color: Color(0xFFFF6B7F), shape: BoxShape.circle))
                .animate(onPlay: (c) => c.repeat(reverse: true))
                .fade(begin: 1, end: 0.2, duration: 700.ms),
            const SizedBox(width: 6),
            Text(tr("LIVE 67′", "DIRECT 67′"), style: const TextStyle(color: Color(0xFFFF8A9A), fontWeight: FontWeight.w800, fontSize: 11)),
          ]),
          const SizedBox(height: 8),
          const FittedBox(
            child: Text('2 - 1', style: TextStyle(fontFamily: 'Sora', color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800)),
          ),
        ]),
      ).animate().scale(begin: const Offset(0.7, 0.7), curve: Curves.easeOutBack, duration: 700.ms),
    ]);
  }
}
