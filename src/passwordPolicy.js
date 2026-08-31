/** Shared password rules for student signup and reset flows. */

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_REQUIREMENTS_HINT =
  `Use at least ${PASSWORD_MIN_LENGTH} characters.`;

/**
 * @param {string} password
 * @returns {{ valid: boolean, message?: string }}
 */
export function validatePassword(password) {
  const value = String(password || "");
  if (value.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  return { valid: true };
}
