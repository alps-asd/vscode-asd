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

const ALPS_TAGS = ['descriptor', 'doc', 'ext', 'link'];
const DESCRIPTOR_ATTRIBUTES = ['id', 'href', 'rel', 'name', 'type', 'rt', 'title', 'tag'];
const DOC_ATTRIBUTES = ['format', 'contentType', 'href', 'tag'];
const TYPE_VALUES = ['semantic', 'safe', 'unsafe', 'idempotent'];
const FORMAT_VALUES = ['text', 'html', 'asciidoc', 'markdown'];
const CONTENT_TYPE_VALUES = ['text/plain', 'text/html', 'text/asciidoc', 'text/markdown'];

interface CompletionContext {
    linePrefix: string;
    text: string;
    offset: number;
}

function isTagStart(linePrefix: string, text: string, offset: number): boolean {
    return /<\s*$/.test(linePrefix) || (offset > 0 && text[offset - 1] === '<');
}

function isAttributeStart(linePrefix: string): boolean {
    return /\s+\w*$/.test(linePrefix);
}

function isInsideTypeAttribute(linePrefix: string): boolean {
    return /\s+type=["'][^"']*$/.test(linePrefix);
}

function isInsideHrefAttribute(linePrefix: string): boolean {
    return /\s+href=["'][^"']*$/.test(linePrefix);
}

function isInsideRtAttribute(linePrefix: string): boolean {
    return /\s+rt=["'][^"']*$/.test(linePrefix);
}

function isTagClosing(linePrefix: string): boolean {
    return /<\/\w*$/.test(linePrefix);
}

function isDocStart(linePrefix: string): boolean {
    return /<doc\s*$/.test(linePrefix) || /<doc\s+[^>]*$/.test(linePrefix);
}

function isInsideFormatAttribute(linePrefix: string): boolean {
    return /<doc[^>]*\s+format=["'][^"']*$/.test(linePrefix);
}

function isInsideContentTypeAttribute(linePrefix: string): boolean {
    return /<doc[^>]*\s+contentType=["'][^"']*$/.test(linePrefix);
}

function isInsideIdAttribute(linePrefix: string): boolean {
    return /\s+id=["'][^"']*$/.test(linePrefix);
}

function getCurrentAttributes(linePrefix: string): string[] {
    const match = linePrefix.match(/\w+(?==)/g);
    return match || [];
}

function createEnumCompletions(values: string[]): CompletionItem[] {
    return values.map((value) => ({
        label: value,
        kind: CompletionItemKind.EnumMember
    }));
}

function createAttributeCompletions(
    availableAttributes: string[],
    currentAttributes: string[]
): CompletionItem[] {
    return availableAttributes
        .filter((attr) => !currentAttributes.includes(attr))
        .map((attr) => ({
            label: attr,
            kind: CompletionItemKind.Property
        }));
}

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

export function provideCompletionItems(
    params: CompletionParams,
    documents: TextDocuments<TextDocument>,
    descriptors: DescriptorInfo[]
): CompletionList {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return { isIncomplete: false, items: [] };
    }

    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const linePrefix = text.slice(text.lastIndexOf('\n', offset - 1) + 1, offset);

    let items: CompletionItem[] = [];

    if (isInsideFormatAttribute(linePrefix)) {
        items = createEnumCompletions(FORMAT_VALUES);
    } else if (isInsideContentTypeAttribute(linePrefix)) {
        items = createEnumCompletions(CONTENT_TYPE_VALUES);
    } else if (isTagClosing(linePrefix)) {
        const openTag = getOpenTag(text, offset);
        if (openTag) {
            items = [
                {
                    label: openTag,
                    kind: CompletionItemKind.Property,
                    insertText: `${openTag}>`,
                    documentation: `Close <${openTag}> tag`
                }
            ];
        }
    } else if (isDocStart(linePrefix)) {
        const currentAttributes = getCurrentAttributes(linePrefix);
        items = createAttributeCompletions(DOC_ATTRIBUTES, currentAttributes);
    } else if (isInsideTypeAttribute(linePrefix)) {
        items = createEnumCompletions(TYPE_VALUES);
    } else if (isInsideHrefAttribute(linePrefix)) {
        items = descriptors.map((descriptor) => ({
            label: `#${descriptor.id}`,
            kind: CompletionItemKind.Reference,
            documentation: `Reference to ${descriptor.type} descriptor with id ${descriptor.id}`
        }));
    } else if (isInsideRtAttribute(linePrefix)) {
        items = descriptors
            .filter((descriptor) => descriptor.type === 'semantic')
            .map((descriptor) => ({
                label: `#${descriptor.id}`,
                kind: CompletionItemKind.Reference,
                documentation: `Transition to ${descriptor.id}`
            }));
    } else if (isTagStart(linePrefix, text, offset)) {
        items = ALPS_TAGS.map((tagName) => createTagCompletionItem(tagName));
    } else if (isAttributeStart(linePrefix)) {
        const currentAttributes = getCurrentAttributes(linePrefix);
        items = createAttributeCompletions(DESCRIPTOR_ATTRIBUTES, currentAttributes);
    } else if (isInsideIdAttribute(linePrefix)) {
        items = semanticTerms.map((term) => ({
            label: term,
            kind: CompletionItemKind.Text,
            documentation: `Semantic term: ${term}`
        }));
    }

    return { isIncomplete: false, items };
}
