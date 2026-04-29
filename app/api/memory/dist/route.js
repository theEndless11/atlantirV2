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
exports.POST = exports.GET = void 0;
/**
 * REST API for the Memory tab UI.
 * GET  ?workspaceId=&path=  → memoryView
 * POST { workspaceId, path, content, action }  → create / update / delete
 *
 * Auth: validates workspace membership before any read/write.
 */
var server_1 = require("next/server");
var supabase_1 = require("@/lib/supabase");
var file_tools_1 = require("@/lib/memory/file-tools");
// ─── Auth helper ─────────────────────────────────────────────────────────────
function resolveUser(req) {
    return __awaiter(this, void 0, Promise, function () {
        var db, _a, user, error;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, supabase_1.supabaseServer()];
                case 1:
                    db = _b.sent();
                    return [4 /*yield*/, db.auth.getUser()];
                case 2:
                    _a = _b.sent(), user = _a.data.user, error = _a.error;
                    if (error || !user) {
                        return [2 /*return*/, { error: server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }];
                    }
                    return [2 /*return*/, { userId: user.id }];
            }
        });
    });
}
function assertWorkspaceMember(userId, workspaceId) {
    return __awaiter(this, void 0, Promise, function () {
        var db, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    db = supabase_1.supabaseAdmin();
                    return [4 /*yield*/, db
                            .from('workspace_members')
                            .select('id')
                            .eq('workspace_id', workspaceId)
                            .eq('user_id', userId)
                            .single()];
                case 1:
                    data = (_a.sent()).data;
                    return [2 /*return*/, !!data];
            }
        });
    });
}
// ─── GET ─────────────────────────────────────────────────────────────────────
function GET(req) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var _b, userId, authError, searchParams, workspaceId, path, isMember, db, _c, data, error, result, err_1;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, resolveUser(req)];
                case 1:
                    _b = _d.sent(), userId = _b.userId, authError = _b.error;
                    if (authError)
                        return [2 /*return*/, authError];
                    searchParams = new URL(req.url).searchParams;
                    workspaceId = searchParams.get('workspaceId');
                    path = (_a = searchParams.get('path')) !== null && _a !== void 0 ? _a : undefined;
                    if (!workspaceId) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })];
                    }
                    return [4 /*yield*/, assertWorkspaceMember(userId, workspaceId)];
                case 2:
                    isMember = _d.sent();
                    if (!isMember) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Forbidden' }, { status: 403 })];
                    }
                    _d.label = 3;
                case 3:
                    _d.trys.push([3, 7, , 8]);
                    if (!!path) return [3 /*break*/, 5];
                    db = supabase_1.supabaseAdmin();
                    return [4 /*yield*/, db
                            .from('memory_files')
                            .select('id, path, updated_by, updated_at, description')
                            .eq('workspace_id', workspaceId)
                            .order('path', { ascending: true })];
                case 4:
                    _c = _d.sent(), data = _c.data, error = _c.error;
                    if (error)
                        throw error;
                    return [2 /*return*/, server_1.NextResponse.json({ files: data !== null && data !== void 0 ? data : [] })];
                case 5: return [4 /*yield*/, file_tools_1.memoryView(workspaceId, path)];
                case 6:
                    result = _d.sent();
                    return [2 /*return*/, server_1.NextResponse.json({ content: result })];
                case 7:
                    err_1 = _d.sent();
                    console.error('[api/memory GET]', err_1);
                    return [2 /*return*/, server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 })];
                case 8: return [2 /*return*/];
            }
        });
    });
}
exports.GET = GET;
// ─── POST ────────────────────────────────────────────────────────────────────
function POST(req) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, userId, authError, body, _b, workspaceId, path, content, action, isMember, updatedBy, result, _c, currentContent, err_2;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, resolveUser(req)];
                case 1:
                    _a = _d.sent(), userId = _a.userId, authError = _a.error;
                    if (authError)
                        return [2 /*return*/, authError];
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, req.json()];
                case 3:
                    body = _d.sent();
                    return [3 /*break*/, 5];
                case 4:
                    _b = _d.sent();
                    return [2 /*return*/, server_1.NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })];
                case 5:
                    workspaceId = body.workspaceId, path = body.path, content = body.content, action = body.action;
                    if (!workspaceId || !path || !action) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'workspaceId, path, and action are required' }, { status: 400 })];
                    }
                    return [4 /*yield*/, assertWorkspaceMember(userId, workspaceId)];
                case 6:
                    isMember = _d.sent();
                    if (!isMember) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Forbidden' }, { status: 403 })];
                    }
                    updatedBy = "user:" + userId;
                    _d.label = 7;
                case 7:
                    _d.trys.push([7, 20, , 21]);
                    result = void 0;
                    _c = action;
                    switch (_c) {
                        case 'create': return [3 /*break*/, 8];
                        case 'update': return [3 /*break*/, 10];
                        case 'delete': return [3 /*break*/, 16];
                    }
                    return [3 /*break*/, 18];
                case 8:
                    if (!content) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'content is required for create' }, { status: 400 })];
                    }
                    return [4 /*yield*/, file_tools_1.memoryCreate(workspaceId, path, content, updatedBy)];
                case 9:
                    result = _d.sent();
                    return [3 /*break*/, 19];
                case 10:
                    if (content === undefined) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'content is required for update' }, { status: 400 })];
                    }
                    return [4 /*yield*/, file_tools_1.memoryView(workspaceId, path)];
                case 11:
                    currentContent = _d.sent();
                    if (!currentContent.startsWith('_(file not found')) return [3 /*break*/, 13];
                    return [4 /*yield*/, file_tools_1.memoryCreate(workspaceId, path, content, updatedBy)];
                case 12:
                    // File doesn't exist yet — create it
                    result = _d.sent();
                    return [3 /*break*/, 15];
                case 13: return [4 /*yield*/, file_tools_1.memoryStrReplace(workspaceId, path, currentContent, content, updatedBy)];
                case 14:
                    // Replace entire content via str_replace (full content swap)
                    result = _d.sent();
                    _d.label = 15;
                case 15: return [3 /*break*/, 19];
                case 16: return [4 /*yield*/, file_tools_1.memoryDelete(workspaceId, path, updatedBy)];
                case 17:
                    result = _d.sent();
                    return [3 /*break*/, 19];
                case 18: return [2 /*return*/, server_1.NextResponse.json({ error: "Unknown action: " + action }, { status: 400 })];
                case 19:
                    if (!result.ok) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: result.error }, { status: 422 })];
                    }
                    return [2 /*return*/, server_1.NextResponse.json({ ok: true })];
                case 20:
                    err_2 = _d.sent();
                    console.error('[api/memory POST]', err_2);
                    return [2 /*return*/, server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 })];
                case 21: return [2 /*return*/];
            }
        });
    });
}
exports.POST = POST;
