import bcrypt from 'bcryptjs';


export function hashPin(pin) {
  const saltRounds = 10;
  return bcrypt.hashSync(pin.toString(), saltRounds);
}

export function verifyPin(pin, hashedPin) {
  return bcrypt.compareSync(pin.toString(), hashedPin);
}
