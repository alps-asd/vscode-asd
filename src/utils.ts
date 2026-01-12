/**
 * Finds the most recent unclosed opening tag at the given position in the text.
 *
 * This function scans backwards from the current position to find matching
 * open/close tags and returns the name of the first unclosed tag it encounters.
 *
 * @param text - The full text content to search within
 * @param currentPosition - The position to start searching backwards from
 * @returns The tag name of the unclosed opening tag, or null if none found
 *
 * @example
 * // Given: "<alps><descriptor></alps>"
 * // With cursor after "</descriptor", would return "descriptor"
 * getOpenTag("<alps><descriptor></alps>", 18);
 */
export function getOpenTag(text: string, currentPosition: number): string | null {
    let depth = 0;

    for (let i = currentPosition - 1; i >= 0; i--) {
        if (text[i] !== '>') {
            continue;
        }

        const closeTagMatch = text.slice(Math.max(0, i - 10), i + 1).match(/<\/(\w+)>$/);
        if (closeTagMatch) {
            depth++;
            continue;
        }

        if (text[i - 1] === '/') {
            continue;
        }

        const openTagMatch = text.slice(Math.max(0, i - 20), i + 1).match(/<(\w+)[^>]*>$/);
        if (openTagMatch) {
            if (depth === 0) {
                return openTagMatch[1];
            }
            depth--;
        }
    }

    return null;
}
