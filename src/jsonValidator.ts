import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as jsonc from 'jsonc-parser';

const VALIDATOR_SOURCE = 'ALPS JSON Validator';

const ERROR_MESSAGES: Record<jsonc.ParseErrorCode, string> = {
    [jsonc.ParseErrorCode.InvalidSymbol]: 'Invalid symbol',
    [jsonc.ParseErrorCode.InvalidNumberFormat]: 'Invalid number format',
    [jsonc.ParseErrorCode.PropertyNameExpected]: 'Property name expected',
    [jsonc.ParseErrorCode.ValueExpected]: 'Value expected',
    [jsonc.ParseErrorCode.ColonExpected]: 'Colon expected',
    [jsonc.ParseErrorCode.CommaExpected]: 'Comma expected',
    [jsonc.ParseErrorCode.CloseBraceExpected]: 'Closing brace expected',
    [jsonc.ParseErrorCode.CloseBracketExpected]: 'Closing bracket expected',
    [jsonc.ParseErrorCode.EndOfFileExpected]: 'End of file expected',
    [jsonc.ParseErrorCode.InvalidCommentToken]: 'Invalid comment token',
    [jsonc.ParseErrorCode.UnexpectedEndOfComment]: 'Unexpected end of comment',
    [jsonc.ParseErrorCode.UnexpectedEndOfString]: 'Unexpected end of string',
    [jsonc.ParseErrorCode.UnexpectedEndOfNumber]: 'Unexpected end of number',
    [jsonc.ParseErrorCode.InvalidUnicode]: 'Invalid unicode',
    [jsonc.ParseErrorCode.InvalidEscapeCharacter]: 'Invalid escape character',
    [jsonc.ParseErrorCode.InvalidCharacter]: 'Invalid character'
};

export function validateJson(document: TextDocument): Diagnostic[] {
    const text = document.getText();
    const errors: jsonc.ParseError[] = [];

    jsonc.parse(text, errors, { allowTrailingComma: true });

    return errors.map((error) => ({
        severity: DiagnosticSeverity.Error,
        range: {
            start: document.positionAt(error.offset),
            end: document.positionAt(error.offset + error.length)
        },
        message: ERROR_MESSAGES[error.error] || 'Unknown error',
        source: VALIDATOR_SOURCE
    }));
}
