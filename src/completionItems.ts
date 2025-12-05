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

const ALPS_TAGS = ['descriptor', 'doc', 'ext', 'link'] as const;
const DESCRIPTOR_ATTRIBUTES = ['id', 'href', 'rel', 'name', 'type', 'rt', 'title', 'tag'] as const;
const DOC_ATTRIBUTES = ['format', 'contentType', 'href', 'tag'] as const;
const TYPE_VALUES = ['semantic', 'safe', 'unsafe', 'idempotent'] as const;
const FORMAT_VALUES = ['text', 'html', 'asciidoc', 'markdown'] as const;
const CONTENT_TYPE_VALUES = ['text/plain', 'text/html', 'text/asciidoc', 'text/markdown'] as const;

interface CompletionContext {
    linePrefix: string;
    text: string;
    offset: number;
}

function createEnumItems(values: readonly string[]): CompletionItem[] {
    return values.map((value) => ({
        label: value,
        kind: CompletionItemKind.EnumMember
    }));
}

function getExistingAttributes(linePrefix: string): string[] {
    return linePrefix.match(/\w+(?==)/g) || [];
}

function filterAvailableAttributes(all: readonly string[], existing: string[]): string[] {
    return all.filter((attr) => !existing.includes(attr));
}

export function createTagCompletionItem(tagName: string): CompletionItem {
    const isDescriptor = tagName === 'descriptor';
    return {
        label: tagName,
        kind: CompletionItemKind.Property,
        insertText: isDescriptor ? tagName : `${tagName}>$1</${tagName}`,
        insertTextFormat: isDescriptor ? InsertTextFormat.PlainText : InsertTextFormat.Snippet,
        documentation: isDescriptor
            ? `Inserts a <${tagName}> tag.`
            : `Inserts a <${tagName}> tag and automatically closes it.`
    };
}

export function provideCompletionItems(
    params: CompletionParams,
    documents: TextDocuments<TextDocument>,
    descriptors: DescriptorInfo[]
): CompletionList {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return CompletionList.create([]);
    }

    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const linePrefix = text.slice(text.lastIndexOf('\n', offset - 1) + 1, offset);

    const context: CompletionContext = { linePrefix, text, offset };
    const items = getCompletionItems(context, descriptors);

    return CompletionList.create(items);
}

function getCompletionItems(context: CompletionContext, descriptors: DescriptorInfo[]): CompletionItem[] {
    const { linePrefix, text, offset } = context;

    if (isInsideFormatAttribute(linePrefix)) {
        return createEnumItems(FORMAT_VALUES);
    }

    if (isInsideContentTypeAttribute(linePrefix)) {
        return createEnumItems(CONTENT_TYPE_VALUES);
    }

    if (isClosingTag(linePrefix)) {
        return getClosingTagCompletion(text, offset);
    }

    if (isDocTagStart(linePrefix)) {
        return getDocAttributeCompletions(linePrefix);
    }

    if (isInsideTypeAttribute(linePrefix)) {
        return createEnumItems(TYPE_VALUES);
    }

    if (isInsideHrefAttribute(linePrefix)) {
        return getDescriptorReferences(descriptors);
    }

    if (isInsideRtAttribute(linePrefix)) {
        return getSemanticDescriptorReferences(descriptors);
    }

    if (isTagStart(linePrefix, text, offset)) {
        return ALPS_TAGS.map(createTagCompletionItem);
    }

    if (isAttributeStart(linePrefix)) {
        return getAttributeCompletions(linePrefix);
    }

    if (isInsideIdAttribute(linePrefix)) {
        return getSemanticTermCompletions();
    }

    return [];
}

function isInsideFormatAttribute(linePrefix: string): boolean {
    return /<doc[^>]*\s+format=["'][^"']*$/.test(linePrefix);
}

function isInsideContentTypeAttribute(linePrefix: string): boolean {
    return /<doc[^>]*\s+contentType=["'][^"']*$/.test(linePrefix);
}

function isClosingTag(linePrefix: string): boolean {
    return /<\/\w*$/.test(linePrefix);
}

function isDocTagStart(linePrefix: string): boolean {
    return /<doc\s*$/.test(linePrefix) || /<doc\s+[^>]*$/.test(linePrefix);
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

function isTagStart(linePrefix: string, text: string, offset: number): boolean {
    return /<\s*$/.test(linePrefix) || (offset > 0 && text[offset - 1] === '<');
}

function isAttributeStart(linePrefix: string): boolean {
    return /\s+\w*$/.test(linePrefix);
}

function isInsideIdAttribute(linePrefix: string): boolean {
    return /\s+id=["'][^"']*$/.test(linePrefix);
}

function getClosingTagCompletion(text: string, offset: number): CompletionItem[] {
    const openTag = getOpenTag(text, offset);
    if (!openTag) {
        return [];
    }

    return [{
        label: openTag,
        kind: CompletionItemKind.Property,
        insertText: `${openTag}>`,
        documentation: `Close <${openTag}> tag`
    }];
}

function getDocAttributeCompletions(linePrefix: string): CompletionItem[] {
    const existing = getExistingAttributes(linePrefix);
    const available = filterAvailableAttributes(DOC_ATTRIBUTES, existing);

    return available.map((attr) => ({
        label: attr,
        kind: CompletionItemKind.Property
    }));
}

function getDescriptorReferences(descriptors: DescriptorInfo[]): CompletionItem[] {
    return descriptors.map((descriptor) => ({
        label: `#${descriptor.id}`,
        kind: CompletionItemKind.Reference,
        documentation: `Reference to ${descriptor.type} descriptor with id ${descriptor.id}`
    }));
}

function getSemanticDescriptorReferences(descriptors: DescriptorInfo[]): CompletionItem[] {
    return descriptors
        .filter((descriptor) => descriptor.type === 'semantic')
        .map((descriptor) => ({
            label: `#${descriptor.id}`,
            kind: CompletionItemKind.Reference,
            documentation: `Transition to ${descriptor.id}`
        }));
}

function getAttributeCompletions(linePrefix: string): CompletionItem[] {
    const existing = getExistingAttributes(linePrefix);
    const available = filterAvailableAttributes(DESCRIPTOR_ATTRIBUTES, existing);

    return available.map((attr) => ({
        label: attr,
        kind: CompletionItemKind.Property
    }));
}

function getSemanticTermCompletions(): CompletionItem[] {
    return semanticTerms.map((term) => ({
        label: term,
        kind: CompletionItemKind.Text,
        documentation: `Semantic term: ${term}`
    }));
}
