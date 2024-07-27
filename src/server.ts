import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    TextDocumentSyncKind,
    TextDocumentChangeEvent,
    Diagnostic,
    DiagnosticSeverity
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { provideCompletionItems } from './completionItems';
import { parseAlpsProfile, DescriptorInfo } from './alpsParser';
import { validateXML } from './ImprovedXMLValidator';

// サーバーの接続を作成
const connection = createConnection(ProposedFeatures.all);

// ドキュメントマネージャを初期化
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// ディスクリプタ情報のリストを格納する変数
let descriptors: DescriptorInfo[] = [];

// バリデーションタイマー
let validationTimer: NodeJS.Timeout | null = null;

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
        // 既存の検証タイマーをクリア
        if (validationTimer) {
            clearTimeout(validationTimer);
        }

        // 新しい検証タイマーを設定
        validationTimer = setTimeout(async () => {
            const diagnostics = validateXML(document.getText());

            // エラーのみを即座に表示し、警告は遅延させる
            const immediateErrors = diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
            connection.sendDiagnostics({ uri: document.uri, diagnostics: immediateErrors });

            // 警告を含むすべての診断情報を少し遅れて送信
            setTimeout(() => {
                connection.sendDiagnostics({ uri: document.uri, diagnostics });
            }, 1000); // 1秒後に警告を表示

            // ALPS解析処理
            descriptors = await parseAlpsProfile(document.getText());
            console.log('Updated descriptors:', descriptors);
        }, 500); // 500ミリ秒の遅延
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
