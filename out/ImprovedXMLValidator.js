"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateXML = void 0;
const sax = __importStar(require("sax"));
const node_1 = require("vscode-languageserver/node");
function validateXML(content) {
    const diagnostics = [];
    const parser = sax.parser(true);
    let currentElement = null;
    const openTags = [];
    parser.onerror = (error) => {
        const { line, column } = parser;
        const range = node_1.Range.create(node_1.Position.create(line - 1, column), node_1.Position.create(line - 1, column + 1));
        diagnostics.push({
            severity: node_1.DiagnosticSeverity.Error,
            range,
            message: `XML syntax error: ${error.message}`,
            source: 'ALPS XML Validator',
            tags: [node_1.DiagnosticTag.Unnecessary] // これにより破線で表示されます
        });
        parser.resume();
    };
    parser.onopentag = (node) => {
        currentElement = node.name;
        openTags.push(node.name);
    };
    parser.onclosetag = (tagName) => {
        if (openTags.pop() !== tagName) {
            const { line, column } = parser;
            const range = node_1.Range.create(node_1.Position.create(line - 1, column - tagName.length - 2), node_1.Position.create(line - 1, column));
            diagnostics.push({
                severity: node_1.DiagnosticSeverity.Error,
                range,
                message: `Mismatched closing tag: expected </${openTags[openTags.length - 1] || 'unknown'}>, found </${tagName}>`,
                source: 'ALPS XML Validator',
                tags: [node_1.DiagnosticTag.Unnecessary] // これにより破線で表示されます
            });
        }
    };
    parser.write(content).close();
    // 閉じていないタグを警告として追加
    if (openTags.length > 0) {
        diagnostics.push({
            severity: node_1.DiagnosticSeverity.Warning,
            range: node_1.Range.create(node_1.Position.create(parser.line - 1, parser.column), node_1.Position.create(parser.line - 1, parser.column + 1)),
            message: `Unclosed tags: ${openTags.join(', ')}`,
            source: 'ALPS XML Validator'
        });
    }
    return diagnostics;
}
exports.validateXML = validateXML;
//# sourceMappingURL=ImprovedXMLValidator.js.map