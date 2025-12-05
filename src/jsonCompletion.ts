import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    TextDocumentPositionParams,
    CompletionList,
    Position,
    TextEdit
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as jsonc from 'jsonc-parser';
import { DescriptorInfo } from './alpsParser';
import { semanticTerms } from './semanticTerms';

const TYPE_VALUES = ['semantic', 'safe', 'unsafe', 'idempotent'] as const;
const FORMAT_VALUES = ['text', 'html', 'asciidoc', 'markdown'] as const;
const CONTENT_TYPE_VALUES = ['text/plain', 'text/html', 'text/asciidoc', 'text/markdown'] as const;

export function provideJsonCompletionItems(
    document: TextDocument,
    params: TextDocumentPositionParams,
    descriptors: DescriptorInfo[]
): CompletionList {
    const text = document.getText();
    const offset = document.offsetAt(params.position);

    const location = jsonc.getLocation(text, offset);
    const path = location.path;

    const parsedTree = jsonc.parseTree(text);
    const node = parsedTree ? jsonc.findNodeAtOffset(parsedTree, offset) : undefined;

    const isInsideString = node?.type === 'string';
    const isStartOfObject = node?.type === 'object' && (node.offset === offset - 1 || node.offset === offset);
    const isAfterComma = checkIsAfterComma(text, offset);

    let items: CompletionItem[] = [];

    if (isAfterComma && path[1] === 'descriptor' && typeof path[2] === 'number') {
        items = getAutoInsertCompletions(document, params.position);
    } else if (isStartOfObject) {
        items = getObjectCompletions(path);
    } else if (isInsideString) {
        items = getStringCompletions(path, descriptors);
    } else if (node?.type === 'property') {
        items = getPropertyValueCompletions(path);
    } else if (location.isAtPropertyKey) {
        items = getPropertyKeyCompletions(path);
    }

    return CompletionList.create(items, false);
}

function checkIsAfterComma(text: string, offset: number): boolean {
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    const lineEnd = text.indexOf('\n', offset);
    const line = text.substring(lineStart, lineEnd !== -1 ? lineEnd : undefined).trim();
    return line.endsWith(',') && text.substring(offset - 2, offset - 1) === '}';
}

function getAutoInsertCompletions(document: TextDocument, position: Position): CompletionItem[] {
    const text = document.getText();
    const lineStart = text.lastIndexOf('\n', document.offsetAt(position) - 1) + 1;
    const currentLineText = text.substring(lineStart, document.offsetAt(position));
    const indentation = currentLineText.match(/^\s*/)?.[0] || '';

    const insertText = '{$0}';

    return [{
        label: 'New Descriptor',
        kind: CompletionItemKind.Snippet,
        insertText,
        insertTextFormat: InsertTextFormat.Snippet,
        textEdit: TextEdit.insert(position, insertText),
        additionalTextEdits: [TextEdit.insert(position, `\n${indentation}`)],
        command: { title: 'Trigger Suggest', command: 'editor.action.triggerSuggest' }
    }];
}

function getObjectCompletions(path: jsonc.JSONPath): CompletionItem[] {
    if (path.length === 0) {
        return [createSnippetItem('alps', '"alps": {$1}')];
    }

    if (path[0] === 'alps' && path.length === 1) {
        return [
            createSnippetItem('version', '"version": "$1"'),
            createSnippetItem('doc', '"doc": {$1}'),
            createSnippetItem('descriptor', '"descriptor": [\n    {$1}\n  ]')
        ];
    }

    if (path[1] === 'descriptor' && typeof path[2] === 'number') {
        return getDescriptorPropertyCompletions();
    }

    if (path[path.length - 1] === 'doc') {
        return [
            createSnippetItem('value', '"value": "$1"'),
            createSnippetItem('format', '"format": "$1"'),
            createSnippetItem('href', '"href": "$1"'),
            createSnippetItem('contentType', '"contentType": "$1"')
        ];
    }

    return [];
}

function getStringCompletions(path: jsonc.JSONPath, descriptors: DescriptorInfo[]): CompletionItem[] {
    const lastPath = path[path.length - 1];
    const parentPath = path[path.length - 2];

    if (lastPath === 'type') {
        return createEnumItems(TYPE_VALUES);
    }

    if (lastPath === 'href' || lastPath === 'rt') {
        return descriptors.map((descriptor) => ({
            label: `#${descriptor.id}`,
            kind: CompletionItemKind.Reference,
            documentation: `Reference to ${descriptor.type} descriptor with id ${descriptor.id}`
        }));
    }

    if (lastPath === 'id') {
        return semanticTerms.map((term) => ({
            label: term,
            kind: CompletionItemKind.Text,
            documentation: `Semantic term: ${term}`
        }));
    }

    if (parentPath === 'doc' && lastPath === 'format') {
        return createEnumItems(FORMAT_VALUES);
    }

    if (parentPath === 'doc' && lastPath === 'contentType') {
        return createEnumItems(CONTENT_TYPE_VALUES);
    }

    return [];
}

function getPropertyValueCompletions(path: jsonc.JSONPath): CompletionItem[] {
    const lastPath = path[path.length - 1];

    if (lastPath === 'descriptor') {
        return [createSnippetItem(
            'descriptor array',
            '[\n  {\n    "id": "$1",\n    "type": "$2"\n  }\n]'
        )];
    }

    return [];
}

function getPropertyKeyCompletions(path: jsonc.JSONPath): CompletionItem[] {
    if (path[0] !== 'alps') {
        return [];
    }

    if (path[1] === 'descriptor' && typeof path[2] === 'number') {
        return getDescriptorPropertyCompletions();
    }

    if (path[1] === 'doc') {
        return [
            createSnippetItem('value', 'value": "$1"'),
            createSnippetItem('format', 'format": "$1"'),
            createSnippetItem('href', 'href": "$1"'),
            createSnippetItem('contentType', 'contentType": "$1"')
        ];
    }

    return [];
}

function getDescriptorPropertyCompletions(): CompletionItem[] {
    return [
        createSnippetItem('id', '"id": "$1"'),
        createSnippetItem('href', '"href": "$1"'),
        createSnippetItem('name', '"name": "$1"'),
        createSnippetItem('title', '"title": "$1"'),
        createSnippetItem('type', '"type": "$1"'),
        createSnippetItem('rt', '"rt": "$1"'),
        createSnippetItem('rel', '"rel": "$1"'),
        createSnippetItem('def', '"def": "http://schema.org/$1"'),
        createSnippetItem('doc', '"doc": {"format": "$1", "value": "$2"}'),
        createSnippetItem('descriptor', '"descriptor": [\n    {$1}\n]')
    ];
}

function createSnippetItem(label: string, insertText: string): CompletionItem {
    return {
        label,
        kind: CompletionItemKind.Property,
        insertText,
        insertTextFormat: InsertTextFormat.Snippet
    };
}

function createEnumItems(values: readonly string[]): CompletionItem[] {
    return values.map((value) => ({
        label: value,
        kind: CompletionItemKind.EnumMember
    }));
}
