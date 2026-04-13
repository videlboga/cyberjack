const { initDB } = require('./src/api/db');
initDB(':memory:');
// Or whatever needed to get characterRepo.get('C-Gamma')
// let's just make a simple test route or log it inside the container.
