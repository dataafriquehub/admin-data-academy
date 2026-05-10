/**
 * Extrait le nom de fichier depuis un header `Content-Disposition`.
 * Gère les formats `filename="..."` et RFC 5987 `filename*=UTF-8''...`.
 */
export function parseContentDispositionFilename(
  header: string | null | undefined,
): string | null {
  if (!header) return null;

  const utf8Match = /filename\*\s*=\s*[^']*''([^;]+)/i.exec(header);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }

  const quotedMatch = /filename\s*=\s*"((?:[^"\\]|\\.)+)"/i.exec(header);
  if (quotedMatch?.[1]) {
    return quotedMatch[1].replace(/\\(.)/g, "$1");
  }

  const plainMatch = /filename\s*=\s*([^;]+)/i.exec(header);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  return null;
}
