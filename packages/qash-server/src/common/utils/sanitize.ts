// /**
//  * Sanitize and normalize input data
//  */
export function sanitizeInput<T extends Record<string, any>>(data: T): T {
  const sanitized = { ...data };

  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      (sanitized as any)[key] = value.trim();
    }
  }

  return sanitized;
}
