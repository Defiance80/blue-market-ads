// Usage: npm run hash-password -- "the password"
// Prints a bcrypt hash to paste into TEAM_USERS. The password itself is
// never stored; only this one-way hash is.
import bcrypt from 'bcryptjs';
const pw = process.argv[2];
if (!pw || pw.length < 10) {
  console.error('Give a password of at least 10 characters:  npm run hash-password -- "..."');
  process.exit(1);
}
console.log(bcrypt.hashSync(pw, 12));
