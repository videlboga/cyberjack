import { ensureGeneratedProfile } from './src/orchestration/characterGenerator/profileManager';

for (let i = 1; i <= 10; i++) {
    const profile = ensureGeneratedProfile(`CharGen-${i}`);
    console.log(`\n### Персонаж ${i}`);
    console.log(profile.personaText.trim());
}
