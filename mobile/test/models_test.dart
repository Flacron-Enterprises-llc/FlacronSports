import 'package:flacron_sport/core/router.dart';
import 'package:flacron_sport/models/account.dart';
import 'package:flacron_sport/models/preferences.dart';
import 'package:flacron_sport/models/priority.dart';
import 'package:flacron_sport/models/sport.dart';
import 'package:flutter_test/flutter_test.dart';

SportEvent event(Map<String, dynamic> extra) => SportEvent({
      'id': 'tsdb-1',
      'sportId': 'football',
      'eventType': 'match',
      'participantType': 'team',
      'participants': [
        {'id': '1', 'name': 'Arsenal', 'role': 'home', 'badgeUrl': null},
        {'id': '2', 'name': 'Chelsea', 'role': 'away', 'badgeUrl': null},
      ],
      'competition': {'id': '4328', 'name': 'English Premier League', 'country': 'England'},
      'scheduledStartUTC': '2026-11-11T20:00:00Z',
      'status': 'finished',
      'score': {'kind': 'team', 'home': 2, 'away': 1},
      'providerStatus': 'FT',
      'venue': null,
      'provider': {'name': 'TheSportsDB', 'eventId': '1'},
      'sourceUpdatedAt': null,
      'coverageFlags': {'liveScores': false, 'statistics': false, 'video': false},
      ...extra,
    });

void main() {
  group('SportEvent', () {
    test('team score rows and title', () {
      final e = event({});
      expect(e.isDuel, isTrue);
      expect(e.title, 'Arsenal / Chelsea');
      expect(e.rowValues, ['2', '1']);
      expect(e.compactScore, '2 - 1');
    });

    test('cricket innings read like the web card', () {
      final e = event({
        'sportId': 'cricket',
        'score': {
          'kind': 'innings',
          'home': {'runs': 319, 'wickets': 9, 'overs': null, 'declared': true},
          'away': {'runs': 244, 'wickets': null, 'overs': null},
          'homeInnings': [
            {'runs': 244, 'wickets': null, 'overs': null},
            {'runs': 319, 'wickets': 9, 'overs': null, 'declared': true},
          ],
          'winner': 'Arsenal',
          'margin': {'value': 5, 'unit': 'wickets'},
        },
      });
      expect(e.rowValues.first, '244 & 319/9d');
      expect(e.resultNote, 'Arsenal won by 5 wickets');
    });

    test('sets won and classification', () {
      final tennis = event({
        'sportId': 'tennis',
        'score': {
          'kind': 'sets',
          'lines': [
            {'name': 'Arsenal', 'games': [6, 3, 7]},
            {'name': 'Chelsea', 'games': [4, 6, 5]},
          ],
          'winner': 'Arsenal',
          'retired': null,
        },
      });
      expect(tennis.setsWon, (2, 1));
      expect(tennis.resultNote, 'Arsenal won');

      final race = event({
        'sportId': 'motorsport',
        'participants': [],
        'eventName': 'Brazil Grand Prix',
        'score': {
          'kind': 'classification',
          'entries': [
            {'position': 1, 'name': 'A', 'team': null, 'time': null},
          ],
        },
      });
      expect(race.isDuel, isFalse);
      expect(race.title, 'Brazil Grand Prix');
    });

    test('live clock gets a minute mark', () {
      expect(event({'status': 'live', 'clock': '90+5'}).clockText, '90+5′');
      expect(event({'status': 'live', 'clock': 'HT'}).clockText, 'HT');
    });
  });

  test('major competitions sort first', () {
    expect(competitionRank('FIFA World Cup'), lessThan(competitionRank('English Premier League')));
    expect(isMajorCompetition('Some Regional League'), isFalse);
    expect(isMajorIn('basketball', 'NBA'), isTrue);
  });

  test('account reads the effective plan', () {
    final a = Account(status: {'plan': 'basic', 'effectivePlan': 'premium', 'state': 'active', 'addons': []}, allowance: null);
    expect(a.plan, 'premium');
    expect(a.subscriptionPlan, 'basic');
    expect(a.plusFeatures, isTrue);
    expect(PlanInfo.premium.annualSavingPercent, 17);
  });

  test('home feed appends sections added later', () {
    final p = Preferences({
      'homeFeed': {'order': ['news', 'live'], 'hidden': ['trending']},
    });
    expect(p.homeFeed.order.take(2), ['news', 'live']);
    expect(p.homeFeed.order.length, homeSections.length);
    expect(p.homeFeed.hidden, ['trending']);
  });

  test('website links open the matching screen', () {
    expect(routeForWebLink(Uri.parse('https://flacronsport.com/app/rooms/join/abcDEF123_-xyz0000000')), '/rooms/join/abcDEF123_-xyz0000000');
    expect(routeForWebLink(Uri.parse('https://flacronsport.com/fr/app/predictions/join/tok')), '/predictions/join/tok');
    expect(routeForWebLink(Uri.parse('https://flacronsport.com/app/match/tsdb-42')), '/match/tsdb-42');
    expect(routeForWebLink(Uri.parse('https://flacronsport.com/pricing')), isNull);
  });
}
