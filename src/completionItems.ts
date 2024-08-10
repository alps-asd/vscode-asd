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
    const linePrefix = text.slice(text.lastIndexOf('\n', offset - 1) + 1, offset);

    console.log('Line prefix:', linePrefix);
    console.log('Offset:', offset);

    const tagStart = /<\s*$/.test(linePrefix) || (offset > 0 && text[offset - 1] === '<');
    const attributeStart = /\s+\w*$/.test(linePrefix);
    const insideTypeAttr = /\s+type=["'][^"']*$/.test(linePrefix);
    const insideHrefAttr = /\s+href=["'][^"']*$/.test(linePrefix);
    const insideRtAttr = /\s+rt=["'][^"']*$/.test(linePrefix);
    const tagClosing = /<\/\w*$/.test(linePrefix);
    const docStart = /<doc\s*$/.test(linePrefix) || /<doc\s+[^>]*$/.test(linePrefix);
    const insideFormatAttr = /<doc[^>]*\s+format=["'][^"']*$/.test(linePrefix);
    const insideContentTypeAttr = /<doc[^>]*\s+contentType=["'][^"']*$/.test(linePrefix);
    const insideIdAttr = /\s+id=["'][^"']*$/.test(linePrefix);

    console.log('tagStart:', tagStart, 'attributeStart:', attributeStart,
        'insideTypeAttr:', insideTypeAttr, 'insideHrefAttr:', insideHrefAttr,
        'insideRtAttr:', insideRtAttr, 'tagClosing:', tagClosing,
        'docStart:', docStart, 'insideFormatAttr:', insideFormatAttr,
        'insideContentTypeAttr:', insideContentTypeAttr, 'insideIdAttr:', insideIdAttr);

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
        const tagNames = ['descriptor', 'doc', 'ext', 'link'];
        items = tagNames.map(tagName => createTagCompletionItem(tagName));
    } else if (attributeStart) {
        const currentAttributesMatch = linePrefix.match(/\w+(?==)/g);
        const currentAttributes: string[] = currentAttributesMatch ? currentAttributesMatch : [];
        const availableAttributes = ['id', 'href', 'rel', 'name', 'type', 'rt', 'title', 'tag']
            .filter(attr => !currentAttributes.includes(attr));
        items = availableAttributes.map(attr => ({
            label: attr,
            kind: CompletionItemKind.Property
        }));
    } else if (insideIdAttr) {
        items = semanticTerms.map(term => ({
            label: term,
            kind: CompletionItemKind.Text,
            documentation: `Semantic term: ${term}`
        }));
    }

    console.log(`Providing ${items.length} completion items`);
    return { isIncomplete: false, items };
}
