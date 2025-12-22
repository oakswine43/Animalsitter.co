const bcrypt = require('bcryptjs');

(async () => {
  const password = 'Animalsitter123!';   // <-- the password you want to log in with
  const hash = await bcrypt.hash(password, 10);
  console.log('HASH =', hash);
})();