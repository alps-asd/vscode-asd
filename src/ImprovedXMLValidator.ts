import * as sax from 'sax';
import { Diagnostic, DiagnosticSeverity, Position, Range, DiagnosticTag } from 'vscode-languageserver/node';

const VALIDATOR_SOURCE = 'ALPS XML Validator';

export function validateXML(content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const parser = sax.parser(true);
    const openTags: string[] = [];

    parser.onerror = (error) => {
        const { line, column } = parser;
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: Range.create(Position.create(line - 1, column), Position.create(line - 1, column + 1)),
            message: `XML syntax error: ${error.message}`,
            source: VALIDATOR_SOURCE,
            tags: [DiagnosticTag.Unnecessary]
        });
        parser.resume();
    };

    parser.onopentag = (node) => {
        openTags.push(node.name);
    };

    parser.onclosetag = (tagName) => {
        const expectedTag = openTags.pop();
        if (expectedTag !== tagName) {
            const { line, column } = parser;
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: Range.create(
                    Position.create(line - 1, column - tagName.length - 2),
                    Position.create(line - 1, column)
                ),
                message: `Mismatched closing tag: expected </${expectedTag || 'unknown'}>, found </${tagName}>`,
                source: VALIDATOR_SOURCE,
                tags: [DiagnosticTag.Unnecessary]
            });
        }
    };

    parser.write(content).close();

    if (openTags.length > 0) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: Range.create(
                Position.create(parser.line - 1, parser.column),
                Position.create(parser.line - 1, parser.column + 1)
            ),
            message: `Unclosed tags: ${openTags.join(', ')}`,
            source: VALIDATOR_SOURCE
        });
    }

    return diagnostics;
}
