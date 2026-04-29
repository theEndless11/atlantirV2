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
exports.POST = void 0;
var server_1 = require("next/server");
var nango_executor_1 = require("@/lib/tool-executor/nango-executor");
var supabase_1 = require("@/lib/supabase");
function POST(req) {
    return __awaiter(this, void 0, void 0, function () {
        var body, _a, workspaceId, employeeId, app, redirectUrl, scopes, sbUser, user, sb, membership, entityId, _b, oauthRedirectUrl, connectionId, sessionToken, err_1, message;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, req.json()["catch"](function () { return null; })];
                case 1:
                    body = _c.sent();
                    if (!body)
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })];
                    _a = body, workspaceId = _a.workspaceId, employeeId = _a.employeeId, app = _a.app, redirectUrl = _a.redirectUrl, scopes = _a.scopes;
                    if (!workspaceId || !employeeId || !app || !redirectUrl) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'workspaceId, employeeId, app, and redirectUrl are required' }, { status: 400 })];
                    }
                    return [4 /*yield*/, supabase_1.supabaseServer()];
                case 2:
                    sbUser = _c.sent();
                    return [4 /*yield*/, sbUser.auth.getUser()];
                case 3:
                    user = (_c.sent()).data.user;
                    if (!user)
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 })];
                    sb = supabase_1.supabaseAdmin();
                    return [4 /*yield*/, sb
                            .from('workspace_members').select('id')
                            .eq('workspace_id', workspaceId).eq('user_id', user.id).single()];
                case 4:
                    membership = (_c.sent()).data;
                    if (!membership)
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Forbidden' }, { status: 403 })];
                    _c.label = 5;
                case 5:
                    _c.trys.push([5, 7, , 8]);
                    entityId = "ws:" + workspaceId + ":emp:" + employeeId;
                    return [4 /*yield*/, nango_executor_1.nangoExecutor.initiateOAuth({
                            app: app, entityId: entityId, redirectUrl: redirectUrl, scopes: scopes
                        })];
                case 6:
                    _b = _c.sent(), oauthRedirectUrl = _b.redirectUrl, connectionId = _b.connectionId, sessionToken = _b.sessionToken;
                    return [2 /*return*/, server_1.NextResponse.json({ redirectUrl: oauthRedirectUrl, connectionId: connectionId, sessionToken: sessionToken })];
                case 7:
                    err_1 = _c.sent();
                    message = err_1 instanceof Error ? err_1.message : String(err_1);
                    console.error('[oauth POST]', message);
                    return [2 /*return*/, server_1.NextResponse.json({ error: message }, { status: 500 })];
                case 8: return [2 /*return*/];
            }
        });
    });
}
exports.POST = POST;
