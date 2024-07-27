import * as sax from 'sax';
import { Diagnostic, DiagnosticSeverity, Position, Range, DiagnosticTag } from 'vscode-languageserver/node';

export function validateXML(content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const parser = sax.parser(true);
    let currentElement: string | null = null;
    const openTags: string[] = [];

    parser.onerror = (error) => {
        const { line, column } = parser;
        const range = Range.create(Position.create(line - 1, column), Position.create(line - 1, column + 1));
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range,
            message: `XML syntax error: ${error.message}`,
            source: 'ALPS XML Validator',
            tags: [DiagnosticTag.Unnecessary] // これにより破線で表示されます
        });
        parser.resume();
    };

    parser.onopentag = (node) => {
        currentElement = node.name;
        openTags.push(node.name);
    };

    parser.onclosetag = (tagName) => {
        if (openTags.pop() !== tagName) {
            const { line, column } = parser;
            const range = Range.create(Position.create(line - 1, column - tagName.length - 2), Position.create(line - 1, column));
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range,
                message: `Mismatched closing tag: expected </${openTags[openTags.length - 1] || 'unknown'}>, found </${tagName}>`,
                source: 'ALPS XML Validator',
                tags: [DiagnosticTag.Unnecessary] // これにより破線で表示されます
            });
        }
    };

    parser.write(content).close();

    // 閉じていないタグを警告として追加
    if (openTags.length > 0) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: Range.create(Position.create(parser.line - 1, parser.column), Position.create(parser.line - 1, parser.column + 1)),
            message: `Unclosed tags: ${openTags.join(', ')}`,
            source: 'ALPS XML Validator'
        });
    }

    return diagnostics;
}
