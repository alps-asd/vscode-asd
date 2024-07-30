import {
    CompletionParams,
    CompletionList,
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    TextDocuments
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getOpenTag } from './utils';
import { semanticTerms } from './semanticTerms';
import { DescriptorInfo } from './alpsParser';

export function createTagCompletionItem(tagName: string): CompletionItem {
    if (tagName === 'descriptor') {
        return {
            label: tagName,
            kind: CompletionItemKind.Property,
            insertText: `${tagName}`,
            insertTextFormat: InsertTextFormat.PlainText,
            documentation: `Inserts a <${tagName}> tag.`
        };
    }
    return {
        label: tagName,
        kind: CompletionItemKind.Property,
        insertText: `${tagName}>$1</${tagName}`,
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: `Inserts a <${tagName}> tag and automatically closes it.`
    };
}

export function provideCompletionItems(params: CompletionParams, documents: TextDocuments<TextDocument>, descriptors: DescriptorInfo[]): CompletionList {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        console.log('No document found for completion');
        return { isIncomplete: false, items: [] };
    }

    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const linePrefix = text.slice(text.lastIndexOf('', offset - 1) + 1, offset);
    const idStart = /<descriptor\s+id="\w*$/.test(linePrefix);
    console.log('Line prefix:', linePrefix);
    console.log('Offset:', offset);

    const insideAlps = /<alps[^>]*>[\s\S]*$/.test(text.slice(0, offset));
    const tagStart = /<\s*([a-zA-Z]*)?$/.test(linePrefix);
    const attributeStart = /\s+\w*$/.test(linePrefix);
    const insideTypeAttr = /\s+type=["'][^"']*$/.test(linePrefix);
    const insideHrefAttr = /\s+href=["'][^"']*$/.test(linePrefix);
    const insideRtAttr = /\s+rt=["'][^"']*$/.test(linePrefix);
    const tagClosing = /<\/\w*$/.test(linePrefix);
    const docStart = /<doc\s*$/.test(linePrefix) || /<doc\s+[^>]*$/.test(linePrefix);
    const insideFormatAttr = /<doc[^>]*\s+format=["'][^"']*$/.test(linePrefix);
    const insideContentTypeAttr = /<doc[^>]*\s+contentType=["'][^"']*$/.test(linePrefix);

    console.log('insideAlps:', insideAlps, 'tagStart:', tagStart, 'attributeStart:', attributeStart,
        'insideTypeAttr:', insideTypeAttr, 'insideHrefAttr:', insideHrefAttr,
        'insideRtAttr:', insideRtAttr, 'tagClosing:', tagClosing,
        'docStart:', docStart, 'insideFormatAttr:', insideFormatAttr,
        'insideContentTypeAttr:', insideContentTypeAttr);

    let items: CompletionItem[] = [];

    if (insideFormatAttr) {
        items = [
            { label: 'text', kind: CompletionItemKind.EnumMember },
            { label: 'html', kind: CompletionItemKind.EnumMember },
            { label: 'asciidoc', kind: CompletionItemKind.EnumMember },
            { label: 'markdown', kind: CompletionItemKind.EnumMember }
        ];
    } else if (insideContentTypeAttr) {
        items = [
            { label: 'text/plain', kind: CompletionItemKind.EnumMember },
            { label: 'text/html', kind: CompletionItemKind.EnumMember },
            { label: 'text/asciidoc', kind: CompletionItemKind.EnumMember },
            { label: 'text/markdown', kind: CompletionItemKind.EnumMember }
        ];
    } else if (tagClosing) {
        console.log('Attempting to close tag');
        const openTag = getOpenTag(text, offset);
        console.log('Open tag:', openTag);
        if (openTag) {
            items = [{
                label: openTag,
                kind: CompletionItemKind.Property,
                insertText: `${openTag}>`,
                documentation: `Close <${openTag}> tag`
            }];
        }
    } else if (docStart) {
        const currentAttributesMatch = linePrefix.match(/\w+(?==)/g);
        const currentAttributes: string[] = currentAttributesMatch ? currentAttributesMatch : [];
        const availableAttributes = ['format', 'contentType', 'href', 'tag']
            .filter(attr => !currentAttributes.includes(attr));
        items = availableAttributes.map(attr => ({
            label: attr,
            kind: CompletionItemKind.Property
        }));
    } else if (insideTypeAttr) {
        items = [
            { label: 'semantic', kind: CompletionItemKind.EnumMember },
            { label: 'safe', kind: CompletionItemKind.EnumMember },
            { label: 'unsafe', kind: CompletionItemKind.EnumMember },
            { label: 'idempotent', kind: CompletionItemKind.EnumMember }
        ];
    } else if (insideHrefAttr) {
        items = descriptors.map(descriptor => ({
            label: `#${descriptor.id}`,
            kind: CompletionItemKind.Reference,
            documentation: `Reference to ${descriptor.type} descriptor with id ${descriptor.id}`
        }));
    } else if (insideRtAttr) {
        items = descriptors
            .filter(descriptor => descriptor.type === 'semantic')
            .map(descriptor => ({
                label: `#${descriptor.id}`,
                kind: CompletionItemKind.Reference,
                documentation: `Transition to ${descriptor.id}`
            }));
    } else if (tagStart) {
        if (!insideAlps) {
            items = [{
                label: 'alps',
                kind: CompletionItemKind.Class,
                insertText: `?xml version="1.0" encoding="UTF-8" ?><alps xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://alps-io.github.io/schemas/alps.xsd">	$1</alps`,
                insertTextFormat: InsertTextFormat.Snippet,
                documentation: `Inserts a <alps> tag with version attribute and closes it.`
            }];
        } else {
            const tagNames = ['title', 'doc', 'link', 'descriptor'];
            tagNames.forEach(tagName => {
                items.push(createTagCompletionItem(tagName));
            });
        }
    } else if (idStart) {
        items = semanticTerms.map(term => ({
            label: term,
            kind: CompletionItemKind.Text,
            insertText: term,
            insertTextFormat: InsertTextFormat.PlainText,
            documentation: `Inserts the term "${term}" as id value.`
        }));
    } else if (attributeStart) {
        const currentAttributesMatch = linePrefix.match(/\w+(?==)/g);
        const currentAttributes: string[] = currentAttributesMatch ? currentAttributesMatch : [];
        const availableAttributes = ['id', 'href', 'type', 'rt', 'rel', 'title', 'tag']
            .filter(attr => !currentAttributes.includes(attr));
        items = availableAttributes.map(attr => ({
            label: attr,
            kind: CompletionItemKind.Property
        }));
    }

    console.log(`Providing ${items.length} completion items`);
    return { isIncomplete: false, items };
}
