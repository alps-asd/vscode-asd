import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    TextDocumentPositionParams,
    CompletionList,
    Position,
    Range,
    TextEdit
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as jsonc from 'jsonc-parser';
import { DescriptorInfo } from './alpsParser';
import { semanticTerms } from './semanticTerms';

export function provideJsonCompletionItems(
    document: TextDocument,
    params: TextDocumentPositionParams,
    descriptors: DescriptorInfo[]
): CompletionList {
    const text = document.getText();
    const offset = document.offsetAt(params.position);
    let items: CompletionItem[] = [];

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

    const startOffset = Math.max(0, offset - 20);
    const endOffset = Math.min(text.length, offset + 20);
    const surroundingText = text.substring(startOffset, endOffset);
    console.log('Surrounding text:', JSON.stringify(surroundingText));

    const isInsideString = node?.type === 'string';
    console.log('Is inside string:', isInsideString);

    const isStartOfObject = (node?.type === 'object' && (node.offset === offset - 1 || node.offset === offset));
    console.log('Is start of object:', isStartOfObject);

    const isAfterComma = text.substring(offset - 1, offset) === ',';
    console.log('Is after comma:', isAfterComma);

    if (isAfterComma && path[1] === 'descriptor' && typeof path[2] === 'number') {
        items = getAutoInsertCompletions(document, params.position);
    } else if (isStartOfObject) {
        items = getObjectCompletions(path, document, params.position);
    } else if (isInsideString) {
        items = getStringCompletions(path, descriptors);
    } else if (node?.type === 'property') {
        items = getPropertyValueCompletions(path, document, params.position);
    } else if (location.isAtPropertyKey) {
        items = getPropertyKeyCompletions(path, document, params.position);
    }

    console.log('Generated completion items:', items.map(item => item.label));
    console.log('=== End JSON Completion Debug Info ===');

    return CompletionList.create(items, false);
}

function getAutoInsertCompletions(document: TextDocument, position: Position): CompletionItem[] {
    const text = document.getText();
    const lines = text.split('\n');
    const currentLine = lines[position.line];
    const indent = currentLine.match(/^\s*/)?.[0] || '';
    const additionalIndent = '  ';

    const insertText = `\n${indent}${additionalIndent}{\n${indent}${additionalIndent}${additionalIndent}$0\n${indent}${additionalIndent}}`;
    const range = Range.create(position, position);

    return [
        {
            label: 'New Descriptor',
            kind: CompletionItemKind.Snippet,
            insertText: insertText,
            insertTextFormat: InsertTextFormat.Snippet,
            textEdit: TextEdit.insert(position, insertText),
            additionalTextEdits: [TextEdit.insert(position, `\n${indent}`)],
            command: { title: 'Trigger Suggest', command: 'editor.action.triggerSuggest' }
        }
    ];
}

function getObjectCompletions(path: jsonc.JSONPath, document: TextDocument, position: Position): CompletionItem[] {
    const text = document.getText();
    const lines = text.split('\n');
    const currentLine = lines[position.line];
    const indent = currentLine.match(/^\s*/)?.[0] || '';
    const additionalIndent = '  ';

    if (path.length === 0) {
        return [createCompletionItem('alps', CompletionItemKind.Property, '"alps": {$1}', document, position)];
    } else if (path[0] === 'alps' && path.length === 1) {
        return [
            createCompletionItem('version', CompletionItemKind.Property, '"version": "$1"', document, position),
            createCompletionItem('doc', CompletionItemKind.Property, '"doc": {$1}', document, position),
            createCompletionItem('descriptor', CompletionItemKind.Property, `"descriptor": [\n${indent}${additionalIndent}${additionalIndent}{\n${indent}${additionalIndent}${additionalIndent}${additionalIndent}$1\n${indent}${additionalIndent}${additionalIndent}}\n${indent}${additionalIndent}]`, document, position)
        ];
    } else if (path[1] === 'descriptor' && typeof path[2] === 'number') {
        return getDescriptorPropertyCompletions(document, position);
    } else if (path[path.length - 1] === 'doc') {
        return [
            createCompletionItem('value', CompletionItemKind.Property, '"value": "$1"', document, position),
            createCompletionItem('format', CompletionItemKind.Property, '"format": "$1"', document, position),
            createCompletionItem('href', CompletionItemKind.Property, '"href": "$1"', document, position),
            createCompletionItem('contentType', CompletionItemKind.Property, '"contentType": "$1"', document, position)
        ];
    }
    return [];
}

function getStringCompletions(path: jsonc.JSONPath, descriptors: DescriptorInfo[]): CompletionItem[] {
    const lastPath = path[path.length - 1];
    if (lastPath === 'type') {
        return [
            { label: 'semantic', kind: CompletionItemKind.EnumMember },
            { label: 'safe', kind: CompletionItemKind.EnumMember },
            { label: 'unsafe', kind: CompletionItemKind.EnumMember },
            { label: 'idempotent', kind: CompletionItemKind.EnumMember }
        ];
    } else if (lastPath === 'href' || lastPath === 'rt') {
        return descriptors.map(descriptor => ({
            label: `#${descriptor.id}`,
            kind: CompletionItemKind.Reference,
            documentation: `Reference to ${descriptor.type} descriptor with id ${descriptor.id}`
        }));
    } else if (lastPath === 'id') {
        return semanticTerms.map(term => ({
            label: term,
            kind: CompletionItemKind.Text,
            documentation: `Semantic term: ${term}`
        }));
    } else if (path[path.length - 2] === 'doc' && lastPath === 'format') {
        return [
            { label: 'text', kind: CompletionItemKind.EnumMember },
            { label: 'html', kind: CompletionItemKind.EnumMember },
            { label: 'asciidoc', kind: CompletionItemKind.EnumMember },
            { label: 'markdown', kind: CompletionItemKind.EnumMember }
        ];
    } else if (path[path.length - 2] === 'doc' && lastPath === 'contentType') {
        return [
            { label: 'text/plain', kind: CompletionItemKind.EnumMember },
            { label: 'text/html', kind: CompletionItemKind.EnumMember },
            { label: 'text/asciidoc', kind: CompletionItemKind.EnumMember },
            { label: 'text/markdown', kind: CompletionItemKind.EnumMember }
        ];
    }
    return [];
}

function getPropertyValueCompletions(path: jsonc.JSONPath, document: TextDocument, position: Position): CompletionItem[] {
    const lastPath = path[path.length - 1];
    if (lastPath === 'descriptor') {
        const text = document.getText();
        const lines = text.split('\n');
        const currentLine = lines[position.line];
        const indent = currentLine.match(/^\s*/)?.[0] || '';
        const additionalIndent = '  ';

        const insertText = `[\n${indent}${additionalIndent}{\n${indent}${additionalIndent}${additionalIndent}$1\n${indent}${additionalIndent}}\n${indent}]`;

        return [
            createCompletionItem('descriptor array', CompletionItemKind.Snippet, insertText, document, position)
        ];
    }
    return [];
}

function getPropertyKeyCompletions(path: jsonc.JSONPath, document: TextDocument, position: Position): CompletionItem[] {
    if (path[0] === 'alps') {
        if (path[1] === 'descriptor' && typeof path[2] === 'number') {
            return getDescriptorPropertyCompletions(document, position);
        } else if (path[1] === 'doc') {
            return [
                createCompletionItem('value', CompletionItemKind.Property, 'value": "$1"', document, position),
                createCompletionItem('format', CompletionItemKind.Property, 'format": "$1"', document, position),
                createCompletionItem('href', CompletionItemKind.Property, 'href": "$1"', document, position),
                createCompletionItem('contentType', CompletionItemKind.Property, 'contentType": "$1"', document, position)
            ];
        }
    }
    return [];
}

function getDescriptorPropertyCompletions(document: TextDocument, position: Position): CompletionItem[] {
    return [
        createCompletionItem('id', CompletionItemKind.Property, '"id": "$1"', document, position),
        createCompletionItem('href', CompletionItemKind.Property, '"href": "$1"', document, position),
        createCompletionItem('name', CompletionItemKind.Property, '"name": "$1"', document, position),
        createCompletionItem('type', CompletionItemKind.Property, '"type": "$1"', document, position),
        createCompletionItem('rt', CompletionItemKind.Property, '"rt": "$1"', document, position),
        createCompletionItem('rel', CompletionItemKind.Property, '"rel": "$1"', document, position),
        createCompletionItem('def', CompletionItemKind.Property, '"def": "http://schema.org/$1"', document, position),
        createCompletionItem('doc', CompletionItemKind.Property, '"doc": {$1}', document, position),
        createCompletionItem('descriptor', CompletionItemKind.Property, '"descriptor": [{$1}]', document, position)
    ];
}

function createCompletionItem(label: string, kind: CompletionItemKind, insertText: string, document: TextDocument, position: Position): CompletionItem {
    const text = document.getText();
    const lines = text.split('\n');
    const currentLine = lines[position.line];
    const indent = currentLine.match(/^\s*/)?.[0] || '';

    const adjustedInsertText = insertText.split('\n').map((line, index) => {
        if (index === 0) return line;
        return indent + line;
    }).join('\n');

    return {
        label,
        kind,
        insertText: adjustedInsertText,
        insertTextFormat: InsertTextFormat.Snippet
    };
}

// Make sure to export any other functions that might be used in other files
export {
    getAutoInsertCompletions,
    getObjectCompletions,
    getStringCompletions,
    getPropertyValueCompletions,
    getPropertyKeyCompletions,
    getDescriptorPropertyCompletions,
    createCompletionItem
};
