import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    CompletionItem,
    CompletionItemKind,
    CompletionParams,
    CompletionList,
    TextDocumentSyncKind,
    TextDocumentChangeEvent,
    InsertTextFormat // 追加
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as xml2js from 'xml2js';
import * as sax from 'sax';

// サーバーの接続を作成
const connection = createConnection(ProposedFeatures.all);

// ドキュメントマネージャを初期化
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// ディスクリプタ情報のインターフェース
interface DescriptorInfo {
    id: string;
    type: string;
}

// ディスクリプタ情報のリストを格納する変数
let descriptors: DescriptorInfo[] = [];
let lastValidDescriptors: DescriptorInfo[] = [];

// サーバーの初期化時に呼ばれる
connection.onInitialize((params: InitializeParams) => {
    console.log('ALPS Language Server initialized');
    return {
        capabilities: {
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['<', ' ', '"', '#', '/']
            },
            textDocumentSync: TextDocumentSyncKind.Incremental,
        }
    };
});

// ALPSプロファイルを解析する関数
async function parseAlpsProfile(content: string): Promise<DescriptorInfo[]> {
    try {
        // XMLを解析
        const result = await xml2js.parseStringPromise(content);
        const descriptors = result.alps?.descriptor
            ?.map((desc: any) => ({
                id: desc.$.id,
                type: desc.$.type || 'semantic'
            })) || [];
        console.log('Extracted descriptors (XML parsing):', descriptors);
        if (descriptors.length > 0) {
            // ディスクリプタが存在する場合、最後に有効なディスクリプタを更新
            lastValidDescriptors = descriptors;
        }
        return lastValidDescriptors;
    } catch (err) {
        console.error('Error parsing ALPS profile:', err);
        // XML解析に失敗した場合、SAXパーサーを使用
        const saxDescriptors = await extractDescriptors(content);
        console.log('Extracted descriptors (SAX fallback):', saxDescriptors);
        if (saxDescriptors.length > 0) {
            // SAXパーサーでディスクリプタが見つかった場合、最後に有効なディスクリプタを更新
            lastValidDescriptors = saxDescriptors;
        }
        return lastValidDescriptors;
    }
}

// SAXパーサーを使用してディスクリプタを抽出する関数
function extractDescriptors(content: string): Promise<DescriptorInfo[]> {
    return new Promise((resolve) => {
        const parser = sax.parser(true);
        const descriptors: DescriptorInfo[] = [];

        parser.onopentag = (node) => {
            // ディスクリプタタグを見つけたときに呼ばれる
            if (node.name === 'descriptor') {
                const id = node.attributes.id as string;
                const type = (node.attributes.type as string) || 'semantic';
                if (id) {
                    // IDが存在する場合のみディスクリプタリストに追加
                    descriptors.push({ id, type });
                }
            }
        };

        parser.onend = () => {
            // パースが完了したときに呼ばれる
            resolve(descriptors);
        };

        parser.onerror = () => {
            // エラーが発生した場合に呼ばれる
            parser.resume(); // エラーを無視してパースを続行
        };

        // パースの開始
        parser.write(content).close();
    });
}

// ドキュメントが変更されたときに呼ばれる
documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
    const document = change.document;
    console.log(`Document changed. Language ID: ${document.languageId}`);
    if (document.languageId === 'alps-xml') {
        // 言語IDがalps-xmlの場合のみ解析を実行
        descriptors = await parseAlpsProfile(document.getText());
        console.log('Updated descriptors:', descriptors);
    }
});

// 開始タグを取得する関数
function getOpenTag(text: string, currentPosition: number): string | null {
    let depth = 0;
    for (let i = currentPosition - 1; i >= 0; i--) {
        if (text[i] === '>') {
            // 終了タグを見つけた場合
            const closeTagMatch = text.slice(Math.max(0, i - 10), i + 1).match(/<\/(\w+)>$/);
            if (closeTagMatch) {
                depth++; // ネストを増やす
            } else if (text[i - 1] === '/') {
                // 自己閉じタグの場合は無視
                continue;
            } else {
                // 開始タグを探す
                const openTagMatch = text.slice(Math.max(0, i - 20), i + 1).match(/<(\w+)[^>]*>$/);
                if (openTagMatch) {
                    if (depth === 0) {
                        // 対応するタグが見つかった場合、そのタグ名を返す
                        return openTagMatch[1];
                    }
                    depth--; // ネストを減らす
                }
            }
        }
    }
    return null;
}

// タグに対応する自動補完アイテムを生成するヘルパー関数を追加
function createTagCompletionItem(tagName: string): CompletionItem {
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

// コンテンツ補完アイテムを提供する関数
function provideCompletionItems(params: CompletionParams): CompletionList {
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

    // 現在のカーソル位置がALPSタグ内かどうかをチェック
    const insideAlps = /<alps[^>]*>[\s\S]*$/.test(text.slice(0, offset));
    // タグの開始かどうかをチェック
    const tagStart = /<\s*([a-zA-Z]*)?$/.test(linePrefix);
    // 属性の開始かどうかをチェック
    const attributeStart = /\s+\w*$/.test(linePrefix);
    // type属性の中かどうかをチェック
    const insideTypeAttr = /\s+type=["'][^"']*$/.test(linePrefix);
    // href属性の中かどうかをチェック
    const insideHrefAttr = /\s+href=["'][^"']*$/.test(linePrefix);
    // rt属性の中かどうかをチェック
    const insideRtAttr = /\s+rt=["'][^"']*$/.test(linePrefix);
    // タグを閉じる必要があるかどうかをチェック
    const tagClosing = /<\/\w*$/.test(linePrefix);
    console.log('insideAlps:', insideAlps, 'tagStart:', tagStart, 'attributeStart:', attributeStart, 'insideTypeAttr:', insideTypeAttr, 'insideHrefAttr:', insideHrefAttr, 'insideRtAttr:', insideRtAttr, 'tagClosing:', tagClosing);

    let items: CompletionItem[] = [];

    if (tagClosing) {
        // タグを閉じる場合の補完
        console.log('Attempting to close tag');
        const openTag = getOpenTag(text, offset);
        console.log('Open tag:', openTag);
        if (openTag) {
            // 開いているタグがある場合、そのタグを閉じる提案を追加
            items = [{
                label: openTag,
                kind: CompletionItemKind.Property,
                insertText: `${openTag}>`,
                documentation: `Close <${openTag}> tag`
            }];
        }
    } else if (insideTypeAttr) {
        // type属性の値を補完
        items = [
            { label: 'semantic', kind: CompletionItemKind.EnumMember },
            { label: 'safe', kind: CompletionItemKind.EnumMember },
            { label: 'unsafe', kind: CompletionItemKind.EnumMember },
            { label: 'idempotent', kind: CompletionItemKind.EnumMember }
        ];
    } else if (insideHrefAttr) {
        // href属性の値を補完
        items = descriptors.map(descriptor => ({
            label: `${descriptor.id}`,
            kind: CompletionItemKind.Reference,
            documentation: `Reference to ${descriptor.type} descriptor with id ${descriptor.id}`
        }));
    } else if (insideRtAttr) {
        // rt属性の値を補完
        items = descriptors
            .filter(descriptor => descriptor.type === 'semantic')
            .map(descriptor => ({
                label: `${descriptor.id}`,
                kind: CompletionItemKind.Reference,
                documentation: `Transition to ${descriptor.id}`
            }));
    } else if (tagStart) {
        // タグの開始時の補完
        if (!insideAlps) {
            // alpsタグがまだ開かれていない場合
            items = [{
                label: 'alps',
                kind: CompletionItemKind.Class,
                insertText: `?xml version="1.0"?>\n<alps xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://alps-io.github.io/schemas/alps.xsd">\n\t$1\n</alps`,
                insertTextFormat: InsertTextFormat.Snippet,
                documentation: `Inserts a <alps> tag with schema attributes and closes it.`
            }];
        } else {
            // alpsタグが開かれている場合
            const tagNames = ['title', 'doc', 'link', 'descriptor'];
            // 各タグに対して補完アイテムを作成
            tagNames.forEach(tagName => {
                items.push(createTagCompletionItem(tagName)); // ここで補完アイテムを追加
            });
        }
    } else if (attributeStart) {
        // 属性の補完
        const currentAttributes: string[] = linePrefix.match(/\b\w+(?==)/g) || [];
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

// コンテンツ補完が要求されたときに呼ばれる
connection.onCompletion((params: CompletionParams): CompletionList => {
    console.log('Completion requested', JSON.stringify(params));
    return provideCompletionItems(params);
});

// コンテンツ補完アイテムの詳細を提供する関数
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    if (item.data && item.data.type === 'descriptorId') {
        item.detail = `Descriptor ID: ${item.data.id}`;
        item.documentation = `Type: ${item.data.descriptorType}`;
    }
    return item;
});

// ドキュメントイベントのリスナーを登録
documents.listen(connection);

// サーバー接続を開始
connection.listen();

console.log('ALPS Language Server is running');
