"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.nangoExecutor = exports.NangoExecutor = void 0;
var crypto_1 = require("crypto");
var supabase_1 = require("@/lib/supabase");
var registry_1 = require("./registry");
var types_1 = require("./types");
function nangoHost() {
    var host = process.env.NANGO_HOST;
    if (!host)
        throw new types_1.ToolExecutorError('UNKNOWN', 'NANGO_HOST env var not set');
    return host.replace(/\/$/, '');
}
function nangoConnectUiUrl() {
    var ui = process.env.NANGO_CONNECT_UI_URL;
    if (ui)
        return ui.replace(/\/$/, '');
    return 'https://app.nango.dev';
}
function nangoHeaders() {
    var key = process.env.NANGO_SECRET_KEY;
    if (!key)
        throw new types_1.ToolExecutorError('UNKNOWN', 'NANGO_SECRET_KEY env var not set');
    return {
        'Authorization': "Bearer " + key,
        'Content-Type': 'application/json'
    };
}
function parseEntityId(entityId) {
    var match = entityId.match(/^ws:([^:]+):emp:(.+)$/);
    if (!match)
        throw new types_1.ToolExecutorError('UNKNOWN', "Invalid entityId format: " + entityId);
    return { workspaceId: match[1], employeeId: match[2] };
}
function hashParams(params) {
    return crypto_1["default"].createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 16);
}
var NangoExecutor = /** @class */ (function () {
    function NangoExecutor() {
    }
    NangoExecutor.prototype.initiateOAuth = function (args) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function () {
            var _e, workspaceId, employeeId, nangoApp, connectionId, sessionRes, body, clean, sessionData, sessionToken, rawConnectLink, hostedUrl, parsed, base;
            var _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _e = parseEntityId(args.entityId), workspaceId = _e.workspaceId, employeeId = _e.employeeId;
                        nangoApp = this._appForAction(args.app);
                        connectionId = workspaceId + "-" + employeeId + "-" + nangoApp;
                        return [4 /*yield*/, fetch(nangoHost() + "/connect/sessions", {
                                method: 'POST',
                                headers: nangoHeaders(),
                                body: JSON.stringify(__assign({ end_user: { id: connectionId }, allowed_integrations: [nangoApp] }, (((_a = args.scopes) === null || _a === void 0 ? void 0 : _a.length) ? { integrations_config_defaults: (_f = {}, _f[nangoApp] = { oauth_scopes: args.scopes.join(',') }, _f) }
                                    : {})))
                            })];
                    case 1:
                        sessionRes = _g.sent();
                        if (!!sessionRes.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, sessionRes.text()];
                    case 2:
                        body = _g.sent();
                        clean = body.startsWith('<')
                            ? "HTTP " + sessionRes.status + " from " + nangoHost() + "/connect/sessions \u2014 check NANGO_HOST points to port 8080"
                            : body;
                        throw new types_1.ToolExecutorError('UNKNOWN', "Nango connect session failed: " + clean);
                    case 3: return [4 /*yield*/, sessionRes.json()];
                    case 4:
                        sessionData = _g.sent();
                        sessionToken = (_c = (_b = sessionData.data) === null || _b === void 0 ? void 0 : _b.token) !== null && _c !== void 0 ? _c : sessionData.token;
                        if (!sessionToken) {
                            throw new types_1.ToolExecutorError('UNKNOWN', "Nango did not return a session token. Response: " + JSON.stringify(sessionData));
                        }
                        rawConnectLink = (_d = sessionData.data) === null || _d === void 0 ? void 0 : _d.connect_link;
                        if (rawConnectLink) {
                            try {
                                parsed = new URL(rawConnectLink);
                                base = nangoConnectUiUrl();
                                hostedUrl = "" + base + parsed.search + "&redirect_url=" + encodeURIComponent(args.redirectUrl);
                            }
                            catch (_h) {
                                hostedUrl = nangoConnectUiUrl() + "/?session_token=" + sessionToken + "&redirect_url=" + encodeURIComponent(args.redirectUrl);
                            }
                        }
                        else {
                            hostedUrl = nangoConnectUiUrl() + "/?session_token=" + sessionToken + "&redirect_url=" + encodeURIComponent(args.redirectUrl);
                        }
                        return [2 /*return*/, { redirectUrl: hostedUrl, connectionId: connectionId, sessionToken: sessionToken }];
                }
            });
        });
    };
    NangoExecutor.prototype.getConnectionStatus = function (entityId, app) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var _c, workspaceId, employeeId, nangoApp, connectionId, res, data, expiresAt;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _c = parseEntityId(entityId), workspaceId = _c.workspaceId, employeeId = _c.employeeId;
                        nangoApp = this._appForAction(app);
                        connectionId = workspaceId + "-" + employeeId + "-" + nangoApp;
                        return [4 /*yield*/, fetch(nangoHost() + "/connection/" + connectionId + "?provider_config_key=" + nangoApp, { headers: nangoHeaders() })];
                    case 1:
                        res = _d.sent();
                        if (res.status === 404)
                            return [2 /*return*/, 'none'];
                        if (!res.ok)
                            return [2 /*return*/, 'none'];
                        return [4 /*yield*/, res.json()];
                    case 2:
                        data = _d.sent();
                        if (((_a = data.credentials) === null || _a === void 0 ? void 0 : _a.type) === 'OAUTH2' && ((_b = data.credentials) === null || _b === void 0 ? void 0 : _b.expires_at)) {
                            expiresAt = new Date(data.credentials.expires_at);
                            if (expiresAt < new Date())
                                return [2 /*return*/, 'expired'];
                        }
                        return [2 /*return*/, 'connected'];
                }
            });
        });
    };
    NangoExecutor.prototype.revokeConnection = function (entityId, app) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, workspaceId, employeeId, nangoApp, connectionId, res, body;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = parseEntityId(entityId), workspaceId = _a.workspaceId, employeeId = _a.employeeId;
                        nangoApp = this._appForAction(app);
                        connectionId = workspaceId + "-" + employeeId + "-" + nangoApp;
                        return [4 /*yield*/, fetch(nangoHost() + "/connection/" + connectionId + "?provider_config_key=" + nangoApp, { method: 'DELETE', headers: nangoHeaders() })];
                    case 1:
                        res = _b.sent();
                        if (!(!res.ok && res.status !== 404)) return [3 /*break*/, 3];
                        return [4 /*yield*/, res.text()];
                    case 2:
                        body = _b.sent();
                        throw new types_1.ToolExecutorError('UNKNOWN', "Failed to revoke Nango connection: " + body);
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    NangoExecutor.prototype.listActions = function (app) {
        return __awaiter(this, void 0, Promise, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Object.values(registry_1.TOOL_REGISTRY).filter(function (schema) {
                        var _a, _b;
                        var prefix = app.toLowerCase().replace(/-/g, '_');
                        var toolName = (_b = (_a = Object.entries(registry_1.TOOL_REGISTRY).find(function (_a) {
                            var s = _a[1];
                            return s === schema;
                        })) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : '';
                        return toolName.startsWith(prefix);
                    })];
            });
        });
    };
    NangoExecutor.prototype.execute = function (args) {
        var _a;
        return __awaiter(this, void 0, Promise, function () {
            var action, entityId, params, approvalTokenId, _b, workspaceId, employeeId, sb, schema, _c, approval, approvalErr, _d, auditRow, auditInsertErr, auditId, connectionId, startedAt, success, result, error, proxyRes, latencyMs, errBody, err_1, latencyMs, errMsg;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        action = args.action, entityId = args.entityId, params = args.params, approvalTokenId = args.approvalTokenId;
                        _b = parseEntityId(entityId), workspaceId = _b.workspaceId, employeeId = _b.employeeId;
                        sb = supabase_1.supabaseAdmin();
                        schema = registry_1.getToolSchema(action);
                        if (!schema)
                            throw new types_1.ToolExecutorError('UNKNOWN', "Unknown action: " + action);
                        if (!registry_1.isActionDangerous(action)) return [3 /*break*/, 3];
                        if (!approvalTokenId) {
                            throw new types_1.ToolExecutorError('APPROVAL_REQUIRED', "Action \"" + action + "\" requires an approval token.");
                        }
                        return [4 /*yield*/, sb
                                .from('approval_requests')
                                .select('*')
                                .eq('approval_token_id', approvalTokenId)
                                .single()];
                    case 1:
                        _c = _e.sent(), approval = _c.data, approvalErr = _c.error;
                        if (approvalErr || !approval) {
                            throw new types_1.ToolExecutorError('APPROVAL_REQUIRED', "Approval token not found: " + approvalTokenId);
                        }
                        if (approval.state !== 'approved') {
                            throw new types_1.ToolExecutorError('APPROVAL_REQUIRED', "Approval token is in state \"" + approval.state + "\", expected \"approved\".");
                        }
                        if (approval.consumed_at) {
                            throw new types_1.ToolExecutorError('APPROVAL_REQUIRED', "Approval token has already been consumed.");
                        }
                        return [4 /*yield*/, sb
                                .from('approval_requests')
                                .update({ consumed_at: new Date().toISOString() })
                                .eq('approval_token_id', approvalTokenId)];
                    case 2:
                        _e.sent();
                        _e.label = 3;
                    case 3: return [4 /*yield*/, sb
                            .from('tool_audit_log')
                            .insert({
                            workspace_id: workspaceId,
                            employee_id: employeeId,
                            action: action,
                            entity_id: entityId,
                            params_hash: hashParams(params),
                            approval_token_id: approvalTokenId !== null && approvalTokenId !== void 0 ? approvalTokenId : null,
                            result_code: 'pending',
                            created_at: new Date().toISOString()
                        })
                            .select('id')
                            .single()];
                    case 4:
                        _d = _e.sent(), auditRow = _d.data, auditInsertErr = _d.error;
                        auditId = (_a = auditRow === null || auditRow === void 0 ? void 0 : auditRow.id) !== null && _a !== void 0 ? _a : crypto_1["default"].randomUUID();
                        if (auditInsertErr)
                            console.error('[NangoExecutor] Failed to insert audit row:', auditInsertErr);
                        connectionId = workspaceId + "-" + employeeId + "-" + this._appForAction(action);
                        startedAt = Date.now();
                        success = false;
                        _e.label = 5;
                    case 5:
                        _e.trys.push([5, 12, , 16]);
                        return [4 /*yield*/, fetch(nangoHost() + "/connection/" + connectionId + "/proxy/" + action, {
                                method: 'POST',
                                headers: nangoHeaders(),
                                body: JSON.stringify(params)
                            })];
                    case 6:
                        proxyRes = _e.sent();
                        latencyMs = Date.now() - startedAt;
                        if (!!proxyRes.ok) return [3 /*break*/, 8];
                        return [4 /*yield*/, proxyRes.text()];
                    case 7:
                        errBody = _e.sent();
                        error = "Nango proxy returned " + proxyRes.status + ": " + errBody;
                        if (proxyRes.status === 401 || proxyRes.status === 403) {
                            throw new types_1.ToolExecutorError('CONNECTION_EXPIRED', "Connection expired for " + connectionId);
                        }
                        if (proxyRes.status === 429) {
                            throw new types_1.ToolExecutorError('RATE_LIMITED', "Rate limited by integration");
                        }
                        return [3 /*break*/, 10];
                    case 8: return [4 /*yield*/, proxyRes.json()["catch"](function () { return undefined; })];
                    case 9:
                        result = _e.sent();
                        success = true;
                        error = undefined;
                        _e.label = 10;
                    case 10: return [4 /*yield*/, sb
                            .from('tool_audit_log')
                            .update({ result_code: success ? 'ok' : 'error', latency_ms: latencyMs, error: error !== null && error !== void 0 ? error : null })
                            .eq('id', auditId)];
                    case 11:
                        _e.sent();
                        return [3 /*break*/, 16];
                    case 12:
                        err_1 = _e.sent();
                        latencyMs = Date.now() - startedAt;
                        if (!(err_1 instanceof types_1.ToolExecutorError)) return [3 /*break*/, 14];
                        return [4 /*yield*/, sb.from('tool_audit_log').update({ result_code: 'error', latency_ms: latencyMs, error: err_1.message }).eq('id', auditId)];
                    case 13:
                        _e.sent();
                        throw err_1;
                    case 14:
                        errMsg = err_1 instanceof Error ? err_1.message : String(err_1);
                        return [4 /*yield*/, sb.from('tool_audit_log').update({ result_code: 'error', latency_ms: latencyMs, error: errMsg }).eq('id', auditId)];
                    case 15:
                        _e.sent();
                        throw new types_1.ToolExecutorError('UNKNOWN', errMsg);
                    case 16: return [2 /*return*/, { success: success, result: result, error: error, auditId: auditId }];
                }
            });
        });
    };
    NangoExecutor.prototype._appForAction = function (action) {
        var _a;
        var APP_MAP = {
            slack: 'slack',
            gmail: 'google-mail',
            google_mail: 'google-mail',
            google_calendar: 'google-calendar',
            google_drive: 'google-drive',
            calendar: 'google-calendar',
            drive: 'google-drive',
            github: 'github',
            notion: 'notion',
            zapier: 'zapier',
            jira: 'jira',
            linear: 'linear',
            hubspot: 'hubspot',
            twilio: 'twilio',
            stripe: 'stripe',
            airtable: 'airtable',
            asana: 'asana',
            trello: 'trello',
            intercom: 'intercom',
            zendesk: 'zendesk',
            vercel: 'vercel',
            pagerduty: 'pagerduty',
            sentry: 'sentry',
            cloudflare: 'cloudflare',
            excel: 'microsoft-excel',
            microsoft_excel: 'microsoft-excel',
            web: 'web-search'
        };
        if (APP_MAP[action])
            return APP_MAP[action];
        var prefix = action.split('_')[0];
        return (_a = APP_MAP[prefix]) !== null && _a !== void 0 ? _a : prefix;
    };
    return NangoExecutor;
}());
exports.NangoExecutor = NangoExecutor;
exports.nangoExecutor = new NangoExecutor();
