import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    TextDocumentSyncKind,
    TextDocumentChangeEvent
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { provideCompletionItems } from './completionItems';
import { parseAlpsProfile, DescriptorInfo } from './alpsParser';

// サーバーの接続を作成
const connection = createConnection(ProposedFeatures.all);

// ドキュメントマネージャを初期化
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// ディスクリプタ情報のリストを格納する変数
let descriptors: DescriptorInfo[] = [];

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

// コンテンツ補完が要求されたときに呼ばれる
connection.onCompletion((params) => {
    return provideCompletionItems(params, documents, descriptors);
});

// ドキュメントイベントのリスナーを登録
documents.listen(connection);

// サーバー接続を開始
connection.listen();

console.log('ALPS Language Server is running');
