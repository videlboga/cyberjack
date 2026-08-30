import { resolveSleepAvatar } from '../src/domain/characterVisuals.ts';
for (const slug of ['nika','rin','mira','kate','male_test','sumi','eli','iona','mai']) {
  console.log(slug, 'neutral ->', resolveSleepAvatar(slug, 'neutral'));
}
