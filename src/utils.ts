/**
 * Finds the most recent unclosed opening tag at the given position.
 * Used for providing closing tag completions.
 */
export function getOpenTag(text: string, currentPosition: number): string | null {
    let depth = 0;

    for (let i = currentPosition - 1; i >= 0; i--) {
        if (text[i] !== '>') {
            continue;
        }

        const precedingText = text.slice(Math.max(0, i - 20), i + 1);

        const closeTagMatch = precedingText.match(/<\/(\w+)>$/);
        if (closeTagMatch) {
            depth++;
            continue;
        }

        if (text[i - 1] === '/') {
            continue;
        }

        const openTagMatch = precedingText.match(/<(\w+)[^>]*>$/);
        if (openTagMatch) {
            if (depth === 0) {
                return openTagMatch[1];
            }
            depth--;
        }
    }

    return null;
}
