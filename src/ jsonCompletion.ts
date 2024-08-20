import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    TextDocumentPositionParams,
    CompletionList,
    Position
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as jsonc from 'jsonc-parser';

export function provideJsonCompletionItems(document: TextDocument, params: TextDocumentPositionParams): CompletionList {
    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const items: CompletionItem[] = [];

    console.log('=== JSON Completion Debug Info ===');
    console.log('Document URI:', params.textDocument.uri);
    console.log('Position:', JSON.stringify(params.position));
    console.log('Offset:', offset);

    const location = jsonc.getLocation(text, offset);
    console.log('JSON Location:', JSON.stringify(location));

    const path = location.path;
    console.log('Path:', JSON.stringify(path));

    const parsedTree = jsonc.parseTree(text);
    const node = parsedTree ? jsonc.findNodeAtOffset(parsedTree, offset) : undefined;

    console.log('Node type:', node?.type);
    console.log('Node value:', node?.value);

    // カーソル位置の前後のテキストを表示
    const startOffset = Math.max(0, offset - 20);
    const endOffset = Math.min(text.length, offset + 20);
    const surroundingText = text.substring(startOffset, endOffset);
    console.log('Surrounding text:', JSON.stringify(surroundingText));

    // Check if we're at the start of an object
    const isStartOfObject = /\{\s*$/.test(text.substring(0, offset));
    console.log('Is start of object:', isStartOfObject);

    if (isStartOfObject) {
        if (path.length === 0) {
            items.push(createCompletionItem('alps', CompletionItemKind.Property, '"alps": {$1}'));
        } else if (path[0] === 'alps') {
            items.push(
                createCompletionItem('version', CompletionItemKind.Property, '"version": "$1"'),
                createCompletionItem('doc', CompletionItemKind.Property, '"doc": {$1}'),
                createCompletionItem('descriptor', CompletionItemKind.Property, '"descriptor": [$1]')
            );
        } else if (path[1] === 'descriptor' && typeof path[2] === 'number') {
            items.push(
                createCompletionItem('id', CompletionItemKind.Property, '"id": "$1"'),
                createCompletionItem('href', CompletionItemKind.Property, '"href": "$1"'),
                createCompletionItem('name', CompletionItemKind.Property, '"name": "$1"'),
                createCompletionItem('type', CompletionItemKind.Property, '"type": "$1"'),
                createCompletionItem('rt', CompletionItemKind.Property, '"rt": "$1"'),
                createCompletionItem('doc', CompletionItemKind.Property, '"doc": {$1}'),
                createCompletionItem('descriptor', CompletionItemKind.Property, '"descriptor": [$1]')
            );
        }
    } else if (path[1] === 'descriptor' && node && node.parent && Array.isArray(node.parent.children) && node.parent.children.length === 0) {
        // Inside an empty descriptor array
        items.push(createCompletionItem('descriptor object', CompletionItemKind.Snippet, '{\n  "id": "$1",\n  "type": "$2"\n}'));
    }

    console.log('Generated completion items:', items.map(item => item.label));
    console.log('=== End JSON Completion Debug Info ===');

    return CompletionList.create(items, false);
}

function createCompletionItem(label: string, kind: CompletionItemKind, insertText: string): CompletionItem {
    return {
        label,
        kind,
        insertText,
        insertTextFormat: InsertTextFormat.Snippet
    };
}
