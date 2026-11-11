import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// FlacronSport palette. Values mirror the web design tokens in app/globals.css
/// so both products read as one brand.
class FsColors extends ThemeExtension<FsColors> {
  const FsColors({
    required this.bg,
    required this.surface,
    required this.surfaceMuted,
    required this.surfaceRaised,
    required this.line,
    required this.lineStrong,
    required this.ink,
    required this.ink2,
    required this.ink3,
    required this.brand,
    required this.onBrand,
    required this.accent,
    required this.accentText,
    required this.success,
    required this.warning,
    required this.danger,
    required this.live,
    required this.info,
    required this.heroStart,
    required this.heroEnd,
  });

  final Color bg, surface, surfaceMuted, surfaceRaised, line, lineStrong;
  final Color ink, ink2, ink3, brand, onBrand, accent, accentText;
  final Color success, warning, danger, live, info, heroStart, heroEnd;

  static const navy = Color(0xFF002961);
  static const navyDeep = Color(0xFF001A3F);
  static const orange = Color(0xFFFE4B01);
  static const orangeHover = Color(0xFFE54300);
  static const blue = Color(0xFF1E5BB8);

  static const light = FsColors(
    bg: Color(0xFFF5F7FA),
    surface: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFEEF2F7),
    surfaceRaised: Color(0xFFFFFFFF),
    line: Color(0xFFD6DDE7),
    lineStrong: Color(0xFFB4C0D0),
    ink: Color(0xFF0A1A33),
    ink2: Color(0xFF3A4B66),
    ink3: Color(0xFF5C6B82),
    brand: navy,
    onBrand: Colors.white,
    accent: orange,
    accentText: Color(0xFFC23A00),
    success: Color(0xFF1A7F45),
    warning: Color(0xFF9A6200),
    danger: Color(0xFFB4232C),
    live: Color(0xFFC8102E),
    info: blue,
    heroStart: navy,
    heroEnd: Color(0xFF0B3C85),
  );

  static const dark = FsColors(
    bg: Color(0xFF050D1C),
    surface: Color(0xFF0B1729),
    surfaceMuted: Color(0xFF112038),
    surfaceRaised: Color(0xFF0F1D33),
    line: Color(0xFF1E3150),
    lineStrong: Color(0xFF2C4469),
    ink: Color(0xFFF3F6FB),
    ink2: Color(0xFFBAC6D9),
    ink3: Color(0xFF8A9AB4),
    brand: Color(0xFF8FB2EC),
    onBrand: navyDeep,
    accent: Color(0xFFFE6A2A),
    accentText: Color(0xFFFF8A55),
    success: Color(0xFF4ACB82),
    warning: Color(0xFFF0B44C),
    danger: Color(0xFFF17A82),
    live: Color(0xFFFF6B7F),
    info: Color(0xFF8FB2EC),
    heroStart: Color(0xFF0A2350),
    heroEnd: navyDeep,
  );

  @override
  FsColors copyWith() => this;

  @override
  FsColors lerp(ThemeExtension<FsColors>? other, double t) {
    if (other is! FsColors) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return FsColors(
      bg: l(bg, other.bg),
      surface: l(surface, other.surface),
      surfaceMuted: l(surfaceMuted, other.surfaceMuted),
      surfaceRaised: l(surfaceRaised, other.surfaceRaised),
      line: l(line, other.line),
      lineStrong: l(lineStrong, other.lineStrong),
      ink: l(ink, other.ink),
      ink2: l(ink2, other.ink2),
      ink3: l(ink3, other.ink3),
      brand: l(brand, other.brand),
      onBrand: l(onBrand, other.onBrand),
      accent: l(accent, other.accent),
      accentText: l(accentText, other.accentText),
      success: l(success, other.success),
      warning: l(warning, other.warning),
      danger: l(danger, other.danger),
      live: l(live, other.live),
      info: l(info, other.info),
      heroStart: l(heroStart, other.heroStart),
      heroEnd: l(heroEnd, other.heroEnd),
    );
  }
}

extension FsThemeX on BuildContext {
  FsColors get fs => Theme.of(this).extension<FsColors>()!;
  TextTheme get text => Theme.of(this).textTheme;
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
}

class AppTheme {
  AppTheme._();

  static const radius = 18.0;
  static const radiusSm = 12.0;
  static const ease = Cubic(0.16, 1, 0.3, 1);

  static ThemeData light() => _build(Brightness.light, FsColors.light);
  static ThemeData dark() => _build(Brightness.dark, FsColors.dark);

  static ThemeData _build(Brightness brightness, FsColors c) {
    final isDark = brightness == Brightness.dark;
    final scheme = ColorScheme(
      brightness: brightness,
      primary: isDark ? c.accent : FsColors.navy,
      onPrimary: Colors.white,
      secondary: c.accent,
      onSecondary: Colors.white,
      error: c.danger,
      onError: Colors.white,
      surface: c.surface,
      onSurface: c.ink,
      surfaceContainerHighest: c.surfaceMuted,
      outline: c.line,
      outlineVariant: c.line,
    );

    final base = ThemeData(useMaterial3: true, brightness: brightness, colorScheme: scheme, fontFamily: 'Inter');
    TextStyle display(double size, FontWeight weight, {double spacing = -0.4}) =>
        TextStyle(fontFamily: 'Sora', fontSize: size, fontWeight: weight, color: c.ink, letterSpacing: spacing, height: 1.15);
    TextStyle body(double size, FontWeight weight, Color color, {double height = 1.4}) =>
        TextStyle(fontFamily: 'Inter', fontSize: size, fontWeight: weight, color: color, height: height);

    final textTheme = TextTheme(
      displayLarge: display(40, FontWeight.w800, spacing: -1.2),
      displayMedium: display(32, FontWeight.w800, spacing: -1),
      displaySmall: display(28, FontWeight.w700, spacing: -0.8),
      headlineMedium: display(24, FontWeight.w700, spacing: -0.6),
      headlineSmall: display(20, FontWeight.w700),
      titleLarge: display(18, FontWeight.w700, spacing: -0.2),
      titleMedium: body(16, FontWeight.w600, c.ink),
      titleSmall: body(14, FontWeight.w600, c.ink),
      bodyLarge: body(16, FontWeight.w400, c.ink),
      bodyMedium: body(14, FontWeight.w400, c.ink2),
      bodySmall: body(12.5, FontWeight.w400, c.ink3),
      labelLarge: body(14, FontWeight.w600, c.ink, height: 1.2),
      labelMedium: body(12.5, FontWeight.w600, c.ink2, height: 1.2),
      labelSmall: body(11, FontWeight.w600, c.ink3, height: 1.2).copyWith(letterSpacing: 0.4),
    );

    return base.copyWith(
      scaffoldBackgroundColor: c.bg,
      canvasColor: c.bg,
      extensions: [c],
      textTheme: textTheme,
      splashFactory: InkSparkle.splashFactory,
      dividerTheme: DividerThemeData(color: c.line, thickness: 1, space: 1),
      appBarTheme: AppBarTheme(
        backgroundColor: c.bg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        foregroundColor: c.ink,
        titleTextStyle: display(20, FontWeight.w700),
        systemOverlayStyle: isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      ),
      cardTheme: CardThemeData(
        color: c.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius), side: BorderSide(color: c.line)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surfaceMuted,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle: body(15, FontWeight.w400, c.ink3),
        labelStyle: body(15, FontWeight.w500, c.ink3),
        prefixIconColor: c.ink3,
        suffixIconColor: c.ink3,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: c.line)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: c.accent, width: 1.6)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: c.danger)),
        focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: c.danger, width: 1.6)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: FsColors.orange,
          foregroundColor: Colors.white,
          disabledBackgroundColor: c.surfaceMuted,
          minimumSize: const Size(0, 52),
          padding: const EdgeInsets.symmetric(horizontal: 22),
          textStyle: const TextStyle(fontFamily: 'Inter', fontSize: 15.5, fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: c.ink,
          minimumSize: const Size(0, 52),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          side: BorderSide(color: c.lineStrong),
          textStyle: const TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: c.accentText,
          textStyle: const TextStyle(fontFamily: 'Inter', fontSize: 14.5, fontWeight: FontWeight.w600),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: c.surface,
        selectedColor: isDark ? c.accent.withValues(alpha: 0.18) : FsColors.navy,
        side: BorderSide(color: c.line),
        labelStyle: body(13, FontWeight.w600, c.ink2),
        secondaryLabelStyle: body(13, FontWeight.w700, Colors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        showCheckmark: false,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Colors.white : c.ink3),
        trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? FsColors.orange : c.surfaceMuted),
        trackOutlineColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? FsColors.orange : c.lineStrong),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: c.lineStrong,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        titleTextStyle: display(20, FontWeight.w700),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: isDark ? c.surfaceMuted : FsColors.navyDeep,
        contentTextStyle: body(14, FontWeight.w500, Colors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: c.ink,
        unselectedLabelColor: c.ink3,
        indicatorColor: c.accent,
        indicatorSize: TabBarIndicatorSize.label,
        dividerColor: c.line,
        labelStyle: body(14, FontWeight.w700, c.ink),
        unselectedLabelStyle: body(14, FontWeight.w600, c.ink3),
        tabAlignment: TabAlignment.start,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: c.accent, linearTrackColor: c.surfaceMuted),
      listTileTheme: ListTileThemeData(
        iconColor: c.ink2,
        textColor: c.ink,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      pageTransitionsTheme: PageTransitionsTheme(builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.iOS: FadeForwardsPageTransitionsBuilder(),
      }),
    );
  }
}
