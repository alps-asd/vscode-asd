export function getOpenTag(text: string, currentPosition: number): string | null {
    let depth = 0;
    for (let i = currentPosition - 1; i >= 0; i--) {
        if (text[i] === '>') {
            const closeTagMatch = text.slice(Math.max(0, i - 10), i + 1).match(/<\/(\w+)>$/);
            if (closeTagMatch) {
                depth++;
            } else if (text[i - 1] === '/') {
                continue;
            } else {
                const openTagMatch = text.slice(Math.max(0, i - 20), i + 1).match(/<(\w+)[^>]*>$/);
                if (openTagMatch) {
                    if (depth === 0) {
                        return openTagMatch[1];
                    }
                    depth--;
                }
            }
        }
    }
    return null;
}
