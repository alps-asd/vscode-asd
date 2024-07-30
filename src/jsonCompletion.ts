import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    TextDocumentPositionParams,
    CompletionList
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as jsonc from 'jsonc-parser';

export function provideJsonCompletionItems(document: TextDocument, params: TextDocumentPositionParams): CompletionList {
    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const items: CompletionItem[] = [];

    const tree = jsonc.parseTree(text);
    const path = jsonc.getLocation(text, offset).path;

    if (path.length === 0) {
        items.push(createCompletionItem('alps', CompletionItemKind.Property, '{"alps": {$1}}'));
    } else if (path[0] === 'alps') {
        items.push(
            createCompletionItem('version', CompletionItemKind.Property, '"version": "$1"'),
            createCompletionItem('doc', CompletionItemKind.Property, '"doc": {$1}'),
            createCompletionItem('descriptor', CompletionItemKind.Property, '"descriptor": [$1]')
        );
    } else if (path[1] === 'descriptor') {
        items.push(
            createCompletionItem('id', CompletionItemKind.Property, '"id": "$1"'),
            createCompletionItem('href', CompletionItemKind.Property, '"href": "$1"'),
            createCompletionItem('name', CompletionItemKind.Property, '"name": "$1"'),
            createCompletionItem('type', CompletionItemKind.Property, '"type": "$1"'),
            createCompletionItem('rt', CompletionItemKind.Property, '"rt": "$1"'),
            createCompletionItem('doc', CompletionItemKind.Property, '"doc": {$1}')
        );
    }

    return { isIncomplete: false, items };
}

function createCompletionItem(label: string, kind: CompletionItemKind, insertText: string): CompletionItem {
    return {
        label,
        kind,
        insertText,
        insertTextFormat: InsertTextFormat.Snippet
    };
}
