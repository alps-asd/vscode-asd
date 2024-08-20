import * as jsonc from 'jsonc-parser';

export function parseJson(content: string): any {
    try {
        return jsonc.parse(content);
    } catch (error) {
        console.error('Error parsing JSON:', error);
        return null;
    }
}
