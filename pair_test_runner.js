const startpairing = require('./pair.js');
const number = process.argv[2];
if (!number) throw new Error('Phone number is required.');
startpairing(number).catch((error) => {
  console.error('PAIRING_FAILED:', error.message);
  if (error.stack) console.error(error.stack);
  process.exitCode = 1;
});
