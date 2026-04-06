import { chatMemoryRepo } from '../src/infrastructure/repositories';
console.log(chatMemoryRepo.getRecent('S-01', 10));
