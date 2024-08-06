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

    if (isStartOfObject) {
        items = getObjectCompletions(path);
    } else if (isInsideString) {
        items = getStringCompletions(path, descriptors);
    } else if (node?.type === 'property') {
        items = getPropertyValueCompletions(path);
    } else if (location.isAtPropertyKey) {
        items = getPropertyKeyCompletions(path);
    }

    console.log('Generated completion items:', items.map(item => item.label));
    console.log('=== End JSON Completion Debug Info ===');

    return CompletionList.create(items, false);
}

function getObjectCompletions(path: jsonc.JSONPath): CompletionItem[] {
    if (path.length === 0) {
        return [createCompletionItem('alps', CompletionItemKind.Property, '"alps": {$1}')];
    } else if (path[0] === 'alps' && path.length === 1) {
        return [
            createCompletionItem('version', CompletionItemKind.Property, '"version": "$1"'),
            createCompletionItem('doc', CompletionItemKind.Property, '"doc": {$1}'),
            createCompletionItem('descriptor', CompletionItemKind.Property, '"descriptor": [$1]')
        ];
    } else if (path[1] === 'descriptor' && typeof path[2] === 'number') {
        return getDescriptorPropertyCompletions();
    } else if (path[path.length - 1] === 'doc') {
        return [
            createCompletionItem('value', CompletionItemKind.Property, '"value": "$1"'),
            createCompletionItem('format', CompletionItemKind.Property, '"format": "$1"'),
            createCompletionItem('href', CompletionItemKind.Property, '"href": "$1"'),
            createCompletionItem('contentType', CompletionItemKind.Property, '"contentType": "$1"')
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

function getPropertyValueCompletions(path: jsonc.JSONPath): CompletionItem[] {
    const lastPath = path[path.length - 1];
    if (lastPath === 'descriptor') {
        return [
            createCompletionItem('descriptor array', CompletionItemKind.Snippet, '[\n  {\n    "id": "$1",\n    "type": "$2"\n  }\n]')
        ];
    }
    return [];
}

function getPropertyKeyCompletions(path: jsonc.JSONPath): CompletionItem[] {
    if (path[0] === 'alps') {
        if (path[1] === 'descriptor' && typeof path[2] === 'number') {
            return getDescriptorPropertyCompletions();
        } else if (path[1] === 'doc') {
            return [
                createCompletionItem('value', CompletionItemKind.Property, 'value": "$1"'),
                createCompletionItem('format', CompletionItemKind.Property, 'format": "$1"'),
                createCompletionItem('href', CompletionItemKind.Property, 'href": "$1"'),
                createCompletionItem('contentType', CompletionItemKind.Property, 'contentType": "$1"')
            ];
        }
    }
    return [];
}

function getDescriptorPropertyCompletions(): CompletionItem[] {
    return [
        createCompletionItem('id', CompletionItemKind.Property, '"id": "$1"'),
        createCompletionItem('href', CompletionItemKind.Property, '"href": "$1"'),
        createCompletionItem('name', CompletionItemKind.Property, '"name": "$1"'),
        createCompletionItem('type', CompletionItemKind.Property, '"type": "$1"'),
        createCompletionItem('rt', CompletionItemKind.Property, '"rt": "$1"'),
        createCompletionItem('rel', CompletionItemKind.Property, '"rel": "$1"'),
        createCompletionItem('def', CompletionItemKind.Property, '"def": "http://schema.org/$1"'),
        createCompletionItem('doc', CompletionItemKind.Property, '"doc": {$1}'),
        createCompletionItem('descriptor', CompletionItemKind.Property, '"descriptor": [$1]')
    ];
}

function createCompletionItem(label: string, kind: CompletionItemKind, insertText: string): CompletionItem {
    return {
        label,
        kind,
        insertText,
        insertTextFormat: InsertTextFormat.Snippet
    };
}
