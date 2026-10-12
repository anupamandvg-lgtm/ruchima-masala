export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeFirestoreData) as unknown as T;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined) {
      cleaned[key] = sanitizeFirestoreData(value);
    }
  }
  return cleaned as T;
}
