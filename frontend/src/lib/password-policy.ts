export const PASSWORD_REQUIREMENTS = [
  'минимум 8 символов',
  'заглавная латинская буква',
  'строчная латинская буква',
  'цифра',
  'только латинские символы, цифры и специальные знаки',
] as const;

export const getPasswordPolicyErrors = (password: string): string[] => {
  const errors: string[] = [];
  if (password.length < 8) errors.push(PASSWORD_REQUIREMENTS[0]);
  if (!/[A-Z]/.test(password)) errors.push(PASSWORD_REQUIREMENTS[1]);
  if (!/[a-z]/.test(password)) errors.push(PASSWORD_REQUIREMENTS[2]);
  if (!/[0-9]/.test(password)) errors.push(PASSWORD_REQUIREMENTS[3]);
  if (!/^[\x20-\x7E]*$/.test(password)) errors.push(PASSWORD_REQUIREMENTS[4]);
  return errors;
};
