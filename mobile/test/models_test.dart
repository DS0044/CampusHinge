import 'package:flutter_test/flutter_test.dart';
import 'package:campushinge_mobile/config/api_config.dart';
import 'package:campushinge_mobile/models/intent_model.dart';
import 'package:campushinge_mobile/models/user_model.dart';
import 'package:campushinge_mobile/models/deck_model.dart';
import 'package:campushinge_mobile/models/message_model.dart';

void main() {
  group('CampusHinge Model & Config Tests', () {
    test('ApiConfig resolves local and CDN photo paths correctly', () {
      expect(ApiConfig.resolvePhotoUrl(''), '');
      expect(
        ApiConfig.resolvePhotoUrl('uploads/avatar.jpg'),
        contains('/cdn/uploads/avatar.jpg'),
      );
      expect(
        ApiConfig.resolvePhotoUrl('https://images.unsplash.com/photo-1'),
        'https://images.unsplash.com/photo-1',
      );
    });

    test('IntentConfig parses all 5 multi-intent campus modes', () {
      expect(IntentType.fromString('dating'), IntentType.dating);
      expect(IntentType.fromString('friendship'), IntentType.friendship);
      expect(IntentType.fromString('study'), IntentType.study);
      expect(IntentType.fromString('activity'), IntentType.activity);
      expect(IntentType.fromString('networking'), IntentType.networking);

      final studyConfig = IntentConfig.get(IntentType.study);
      expect(studyConfig.label, 'Study');
      expect(studyConfig.icon, '📚');

      final activityConfig = IntentConfig.get('activity');
      expect(activityConfig.label, 'Activity');
      expect(activityConfig.icon, '⚽');
    });

    test('User and Profile JSON serialization works symmetrically', () {
      final userJson = {
        'id': 'usr_101',
        'email': 'student@university.edu',
        'role': 'user',
        'subscription_status': 'free',
        'profile_completed': 1,
        'active_intent': 'study',
      };

      final user = User.fromJson(userJson);
      expect(user.id, 'usr_101');
      expect(user.email, 'student@university.edu');
      expect(user.profileCompleted, true);
      expect(user.activeIntent, IntentType.study);

      final profileJson = {
        'user_id': 'usr_101',
        'name': 'Alex Rivera',
        'bio': 'CS Sophomore interested in Hackathons',
        'photos': ['photo1.jpg', 'photo2.jpg'],
        'branch': 'Computer Science & Engg',
        'year': 2027,
        'gender': 'male',
        'interested_in': 'everyone',
        'interests': ['Coding/Tech', 'Coffee'],
        'activity_tags': ['Badminton', 'Gym'],
        'active_intent': 'study',
      };

      final profile = Profile.fromJson(profileJson);
      expect(profile.name, 'Alex Rivera');
      expect(profile.photos.length, 2);
      expect(profile.interests.contains('Coding/Tech'), true);
      expect(profile.activityTags.contains('Badminton'), true);
      expect(profile.year, 2027);

      final serialized = profile.toJson();
      expect(serialized['name'], 'Alex Rivera');
      expect(serialized['active_intent'], 'study');
    });

    test('ChatMessage formatting works properly', () {
      final msg = ChatMessage(
        id: 'msg_1',
        matchId: 'match_123',
        senderId: 'usr_1',
        content: 'Hey, are you taking Data Structures this semester?',
        createdAt: '2026-09-27T10:30:00Z',
      );

      expect(msg.content, contains('Data Structures'));
      expect(msg.formattedTime.isNotEmpty, true);
    });

    test('SwipeAction toApiString conforms to backend contract', () {
      expect(SwipeAction.like.toApiString(), 'like');
      expect(SwipeAction.pass.toApiString(), 'pass');
      expect(SwipeAction.superLike.toApiString(), 'super_like');
    });
  });
}
