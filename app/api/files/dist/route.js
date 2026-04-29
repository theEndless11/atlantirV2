"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.DELETE = exports.POST = exports.GET = void 0;
var server_1 = require("next/server");
var supabase_1 = require("@/lib/supabase");
var anthropic_1 = require("@/lib/anthropic");
function extractText(buffer, mimeType, filename) {
    return __awaiter(this, void 0, Promise, function () {
        var client, base64, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (mimeType === 'text/plain' || mimeType === 'text/markdown' || filename.endsWith('.md') || filename.endsWith('.txt')) {
                        return [2 /*return*/, buffer.toString('utf-8')];
                    }
                    if (!(mimeType === 'application/pdf')) return [3 /*break*/, 2];
                    client = anthropic_1.useAnthropic();
                    base64 = buffer.toString('base64');
                    return [4 /*yield*/, client.messages.create({
                            model: anthropic_1.AGENT_MODEL, max_tokens: 4096,
                            messages: [{ role: 'user', content: [
                                        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
                                        { type: 'text', text: 'Extract all text content from this document. Return only the raw text, preserve structure.' }
                                    ] }]
                        })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.content.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('')];
                case 2:
                    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                        return [2 /*return*/, buffer.toString('utf-8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()];
                    }
                    return [2 /*return*/, buffer.toString('utf-8')];
            }
        });
    });
}
function chunkText(text, chunkSize, overlap) {
    if (chunkSize === void 0) { chunkSize = 500; }
    if (overlap === void 0) { overlap = 50; }
    var words = text.split(/\s+/);
    var chunks = [];
    var i = 0;
    while (i < words.length) {
        chunks.push(words.slice(i, i + chunkSize).join(' '));
        i += chunkSize - overlap;
    }
    return chunks.filter(function (c) { return c.trim().length > 20; });
}
function embedChunks(chunks) {
    var _a, _b;
    return __awaiter(this, void 0, Promise, function () {
        var apiKey, results, _i, chunks_1, chunk, res, data, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    apiKey = process.env.GEMINI_API_KEY;
                    if (!apiKey)
                        return [2 /*return*/, chunks.map(function () { return new Array(768).fill(0); })];
                    results = [];
                    _i = 0, chunks_1 = chunks;
                    _d.label = 1;
                case 1:
                    if (!(_i < chunks_1.length)) return [3 /*break*/, 7];
                    chunk = chunks_1[_i];
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, fetch("https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=" + apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ model: 'models/text-embedding-004', content: { parts: [{ text: chunk }] } }) })];
                case 3:
                    res = _d.sent();
                    if (!res.ok) {
                        results.push(new Array(768).fill(0));
                        return [3 /*break*/, 6];
                    }
                    return [4 /*yield*/, res.json()];
                case 4:
                    data = _d.sent();
                    results.push((_b = (_a = data.embedding) === null || _a === void 0 ? void 0 : _a.values) !== null && _b !== void 0 ? _b : new Array(768).fill(0));
                    return [3 /*break*/, 6];
                case 5:
                    _c = _d.sent();
                    results.push(new Array(768).fill(0));
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/, results];
            }
        });
    });
}
function GET(req) {
    return __awaiter(this, void 0, void 0, function () {
        var searchParams, workspaceId, sb, _a, data, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    searchParams = new URL(req.url).searchParams;
                    workspaceId = searchParams.get('workspace_id');
                    if (!workspaceId)
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'workspace_id required' }, { status: 400 })];
                    sb = supabase_1.supabaseAdmin();
                    return [4 /*yield*/, sb.from('files').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error)
                        return [2 /*return*/, server_1.NextResponse.json({ error: error.message }, { status: 500 })];
                    return [2 /*return*/, server_1.NextResponse.json(data)];
            }
        });
    });
}
exports.GET = GET;
function POST(req) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function () {
        var sb, formData, file, workspaceId, userId, filename, mimeType, arrayBuf, buffer, storagePath, storageErr, _c, fileRecord, fileErr;
        var _this = this;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    sb = supabase_1.supabaseAdmin();
                    return [4 /*yield*/, req.formData()];
                case 1:
                    formData = _d.sent();
                    file = formData.get('file');
                    workspaceId = (_a = formData.get('workspace_id')) === null || _a === void 0 ? void 0 : _a.toString();
                    userId = (_b = formData.get('user_id')) === null || _b === void 0 ? void 0 : _b.toString();
                    if (!file || !workspaceId)
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'file and workspace_id required' }, { status: 400 })];
                    filename = file.name || 'upload';
                    mimeType = file.type || 'text/plain';
                    return [4 /*yield*/, file.arrayBuffer()];
                case 2:
                    arrayBuf = _d.sent();
                    buffer = Buffer.from(arrayBuf);
                    storagePath = workspaceId + "/" + Date.now() + "_" + filename;
                    return [4 /*yield*/, sb.storage.from('files').upload(storagePath, buffer, { contentType: mimeType, upsert: false })];
                case 3:
                    storageErr = (_d.sent()).error;
                    if (storageErr)
                        return [2 /*return*/, server_1.NextResponse.json({ error: storageErr.message }, { status: 500 })];
                    return [4 /*yield*/, sb.from('files').insert({
                            workspace_id: workspaceId, uploaded_by: userId || null,
                            filename: filename,
                            storage_path: storagePath, mime_type: mimeType, size_bytes: buffer.length
                        }).select().single()];
                case 4:
                    _c = _d.sent(), fileRecord = _c.data, fileErr = _c.error;
                    if (fileErr)
                        return [2 /*return*/, server_1.NextResponse.json({ error: fileErr.message }, { status: 500 })
                            // Index in background
                        ];
                    (function () { return __awaiter(_this, void 0, void 0, function () {
                        var text, chunks, embeddings_1, _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 6, , 8]);
                                    return [4 /*yield*/, extractText(buffer, mimeType, filename)];
                                case 1:
                                    text = _b.sent();
                                    chunks = chunkText(text);
                                    if (!(chunks.length > 0)) return [3 /*break*/, 5];
                                    return [4 /*yield*/, embedChunks(chunks)];
                                case 2:
                                    embeddings_1 = _b.sent();
                                    return [4 /*yield*/, sb.from('file_chunks').insert(chunks.map(function (content, i) { return ({
                                            file_id: fileRecord.id, workspace_id: workspaceId,
                                            content: content,
                                            embedding: JSON.stringify(embeddings_1[i]),
                                            embedding_vec: "[" + embeddings_1[i].join(',') + "]",
                                            chunk_index: i
                                        }); }))];
                                case 3:
                                    _b.sent();
                                    return [4 /*yield*/, sb.from('files').update({ embedding_meta: { chunks: chunks.length, status: 'indexed' } }).eq('id', fileRecord.id)];
                                case 4:
                                    _b.sent();
                                    _b.label = 5;
                                case 5: return [3 /*break*/, 8];
                                case 6:
                                    _a = _b.sent();
                                    return [4 /*yield*/, sb.from('files').update({ embedding_meta: { status: 'index_failed' } }).eq('id', fileRecord.id)];
                                case 7:
                                    _b.sent();
                                    return [3 /*break*/, 8];
                                case 8: return [2 /*return*/];
                            }
                        });
                    }); })();
                    return [2 /*return*/, server_1.NextResponse.json(fileRecord)];
            }
        });
    });
}
exports.POST = POST;
function DELETE(req) {
    return __awaiter(this, void 0, void 0, function () {
        var searchParams, fileId, _a, sb, file;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    searchParams = new URL(req.url).searchParams;
                    _a = searchParams.get('file_id');
                    if (_a) return [3 /*break*/, 2];
                    return [4 /*yield*/, req.json()["catch"](function () { return ({}); })];
                case 1:
                    _a = (_b.sent()).file_id;
                    _b.label = 2;
                case 2:
                    fileId = _a;
                    if (!fileId)
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'file_id required' }, { status: 400 })];
                    sb = supabase_1.supabaseAdmin();
                    return [4 /*yield*/, sb.from('files').select('storage_path').eq('id', fileId).single()];
                case 3:
                    file = (_b.sent()).data;
                    if (!file) return [3 /*break*/, 5];
                    return [4 /*yield*/, sb.storage.from('files').remove([file.storage_path])];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5: return [4 /*yield*/, sb.from('file_chunks')["delete"]().eq('file_id', fileId)];
                case 6:
                    _b.sent();
                    return [4 /*yield*/, sb.from('files')["delete"]().eq('id', fileId)];
                case 7:
                    _b.sent();
                    return [2 /*return*/, server_1.NextResponse.json({ success: true })];
            }
        });
    });
}
exports.DELETE = DELETE;
