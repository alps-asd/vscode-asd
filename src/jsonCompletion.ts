import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    TextDocumentPositionParams,
    CompletionList
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as jsonc from 'jsonc-parser';
import { DescriptorInfo } from './alpsParser';

interface CompletionContext {
    insideAlps: boolean;
    insideDescriptor: boolean;
    inPropertyName: boolean;
    inPropertyValue: boolean;
    currentProperty: string | null;
    path: jsonc.JSONPath;
}

export function provideJsonCompletionItems(document: TextDocument, params: TextDocumentPositionParams, descriptors: DescriptorInfo[]): CompletionList {
    const text = document.getText();
    const offset = document.offsetAt(params.position);

    console.log('Full document text:', text);
    console.log('Offset:', offset);

    const context = determineCompletionContext(text, offset);
    console.log('Completion context:', context);

    const items: CompletionItem[] = [];

    if (!context.insideAlps && context.inPropertyName) {
        items.push(createCompletionItem('alps', CompletionItemKind.Property, '"alps": {$1}'));
    } else if (context.insideAlps && !context.insideDescriptor) {
        // Always provide these items inside the alps object
        items.push(
            createCompletionItem('version', CompletionItemKind.Property, '"version": "$1"'),
            createCompletionItem('doc', CompletionItemKind.Property, '"doc": {$1}'),
            createCompletionItem('descriptor', CompletionItemKind.Property, '"descriptor": [$1]')
        );
    } else if (context.insideDescriptor && context.inPropertyName) {
        items.push(
            createCompletionItem('id', CompletionItemKind.Property, '"id": "$1"'),
            createCompletionItem('href', CompletionItemKind.Property, '"href": "$1"'),
            createCompletionItem('name', CompletionItemKind.Property, '"name": "$1"'),
            createCompletionItem('type', CompletionItemKind.Property, '"type": "$1"'),
            createCompletionItem('rt', CompletionItemKind.Property, '"rt": "$1"'),
            createCompletionItem('doc', CompletionItemKind.Property, '"doc": {$1}'),
            createCompletionItem('descriptor', CompletionItemKind.Property, '"descriptor": [$1]')
        );
    } else if (context.inPropertyValue && context.currentProperty === 'type') {
        items.push(
            createCompletionItem('semantic', CompletionItemKind.EnumMember, 'semantic'),
            createCompletionItem('safe', CompletionItemKind.EnumMember, 'safe'),
            createCompletionItem('unsafe', CompletionItemKind.EnumMember, 'unsafe'),
            createCompletionItem('idempotent', CompletionItemKind.EnumMember, 'idempotent')
        );
    }

    console.log(`Providing ${items.length} completion items:`, items.map(item => item.label));
    return { isIncomplete: false, items };
}

function determineCompletionContext(text: string, offset: number): CompletionContext {
    const path: jsonc.JSONPath = [];
    const parsedTree = jsonc.parseTree(text);

    if (!parsedTree) {
        console.log('Failed to parse JSON tree');
        return {
            insideAlps: false,
            insideDescriptor: false,
            inPropertyName: false,
            inPropertyValue: false,
            currentProperty: null,
            path: []
        };
    }

    const location = jsonc.getLocation(text, offset);
    path.push(...location.path);

    let currentProperty: string | null = null;
    let inPropertyName = location.isAtPropertyKey;
    let inPropertyValue = !inPropertyName && path.length % 2 === 0;

    const node = jsonc.findNodeAtOffset(parsedTree, offset);

    if (node) {
        if (node.type === 'property') {
            const propertyNode = node as jsonc.Node & { children?: jsonc.Node[] };
            currentProperty = propertyNode.children?.[0].value as string;
        } else if (node.parent?.type === 'property') {
            const parentNode = node.parent as jsonc.Node & { children?: jsonc.Node[] };
            currentProperty = parentNode.children?.[0].value as string;
        }
    }

    const insideAlps = path[0] === 'alps';
    const insideDescriptor = insideAlps && path.includes('descriptor');

    return {
        insideAlps,
        insideDescriptor,
        inPropertyName,
        inPropertyValue,
        currentProperty,
        path
    };
}

function createCompletionItem(label: string, kind: CompletionItemKind, insertText: string): CompletionItem {
    return {
        label,
        kind,
        insertText,
        insertTextFormat: InsertTextFormat.Snippet
    };
}
