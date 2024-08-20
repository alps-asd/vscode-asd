import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as jsonc from 'jsonc-parser';

export function validateJson(document: TextDocument): Diagnostic[] {
    const text = document.getText();
    const diagnostics: Diagnostic[] = [];

    const errors: jsonc.ParseError[] = [];
    jsonc.parse(text, errors, { allowTrailingComma: true });

    errors.forEach(error => {
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
                start: document.positionAt(error.offset),
                end: document.positionAt(error.offset + error.length)
            },
            message: getErrorMessage(error),
            source: 'ALPS JSON Validator'
        });
    });

    return diagnostics;
}

function getErrorMessage(error: jsonc.ParseError): string {
    switch (error.error) {
        case jsonc.ParseErrorCode.InvalidSymbol:
            return "Invalid symbol";
        case jsonc.ParseErrorCode.InvalidNumberFormat:
            return "Invalid number format";
        case jsonc.ParseErrorCode.PropertyNameExpected:
            return "Property name expected";
        case jsonc.ParseErrorCode.ValueExpected:
            return "Value expected";
        case jsonc.ParseErrorCode.ColonExpected:
            return "Colon expected";
        case jsonc.ParseErrorCode.CommaExpected:
            return "Comma expected";
        case jsonc.ParseErrorCode.CloseBraceExpected:
            return "Closing brace expected";
        case jsonc.ParseErrorCode.CloseBracketExpected:
            return "Closing bracket expected";
        case jsonc.ParseErrorCode.EndOfFileExpected:
            return "End of file expected";
        case jsonc.ParseErrorCode.InvalidCommentToken:
            return "Invalid comment token";
        case jsonc.ParseErrorCode.UnexpectedEndOfComment:
            return "Unexpected end of comment";
        case jsonc.ParseErrorCode.UnexpectedEndOfString:
            return "Unexpected end of string";
        case jsonc.ParseErrorCode.UnexpectedEndOfNumber:
            return "Unexpected end of number";
        case jsonc.ParseErrorCode.InvalidUnicode:
            return "Invalid unicode";
        case jsonc.ParseErrorCode.InvalidEscapeCharacter:
            return "Invalid escape character";
        case jsonc.ParseErrorCode.InvalidCharacter:
            return "Invalid character";
        default:
            return "Unknown error";
    }
}
