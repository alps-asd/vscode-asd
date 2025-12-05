import * as jsonc from 'jsonc-parser';

export function parseJson(content: string): unknown {
    try {
        return jsonc.parse(content);
    } catch {
        return null;
    }
}
