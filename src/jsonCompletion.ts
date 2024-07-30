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

export function provideJsonCompletionItems(document: TextDocument, params: TextDocumentPositionParams, descriptors: DescriptorInfo[]): CompletionList {
    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const linePrefix = text.slice(text.lastIndexOf('\n', offset - 1) + 1, offset);

    console.log('Full document text:', text);
    console.log('Line prefix:', linePrefix);
    console.log('Offset:', offset);

    const items: CompletionItem[] = [];

    const insideAlps = /"alps"/.test(text.slice(0, offset));
    const objectStart = /\{\s*$/.test(linePrefix);
    const propertyStart = /"[^"]*"?\s*:?\s*$/.test(linePrefix);
    const arrayStart = /\[\s*$/.test(linePrefix);
    const afterComma = /,\s*$/.test(linePrefix);
    const insideDescriptor = /"descriptor"/.test(text.slice(0, offset)) && /"descriptor"\s*:\s*\[/.test(text.slice(0, offset));
    const insideTypeValue = /"type"\s*:\s*"[^"]*$/.test(linePrefix);

    console.log('insideAlps:', insideAlps, 'objectStart:', objectStart, 'propertyStart:', propertyStart,
        'arrayStart:', arrayStart, 'afterComma:', afterComma, 'insideDescriptor:', insideDescriptor,
        'insideTypeValue:', insideTypeValue);

    if (!insideAlps && (objectStart || propertyStart)) {
        items.push(createCompletionItem('alps', CompletionItemKind.Property, '"alps": {$1}'));
    } else if (insideAlps && !insideDescriptor && (objectStart || propertyStart || afterComma)) {
        items.push(
            createCompletionItem('version', CompletionItemKind.Property, '"version": "$1"'),
            createCompletionItem('doc', CompletionItemKind.Property, '"doc": {$1}'),
            createCompletionItem('descriptor', CompletionItemKind.Property, '"descriptor": [$1]')
        );
    } else if (insideDescriptor && !insideTypeValue && (objectStart || propertyStart || afterComma || arrayStart)) {
        items.push(
            createCompletionItem('id', CompletionItemKind.Property, '"id": "$1"'),
            createCompletionItem('href', CompletionItemKind.Property, '"href": "$1"'),
            createCompletionItem('name', CompletionItemKind.Property, '"name": "$1"'),
            createCompletionItem('title', CompletionItemKind.Property, '"title": "$1"'),
            createCompletionItem('type', CompletionItemKind.Property, '"type": "$1"'),
            createCompletionItem('rt', CompletionItemKind.Property, '"rt": "$1"'),
            createCompletionItem('doc', CompletionItemKind.Property, '"doc": {$1}'),
            createCompletionItem('descriptor', CompletionItemKind.Property, '"descriptor": [$1]')
        );
    } else if (insideTypeValue) {
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

function createCompletionItem(label: string, kind: CompletionItemKind, insertText: string): CompletionItem {
    return {
        label,
        kind,
        insertText,
        insertTextFormat: InsertTextFormat.Snippet
    };
}
