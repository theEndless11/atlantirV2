"use strict";
/**
 * Agent pipeline — runs a sequence of specialized agents (pets) to complete a task.
 *
 * Uses @ai-sdk/openai → OpenRouter for all LLM calls (fixes 401 errors that
 * occurred when the Anthropic SDK was incorrectly pointed at OpenRouter).
 */
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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.runPipeline = void 0;
var anthropic_1 = require("../anthropic");
var ai_1 = require("ai");
var zod_1 = require("zod");
var supabase_1 = require("../supabase");
var pets_1 = require("./pets");
var tool_executor_1 = require("../tool-executor");
var tool_registry_1 = require("../tool-registry");
// ─── Context loaders ──────────────────────────────────────────────────────────
function getRagContext(workspaceId, taskTitle, taskDesc) {
    return __awaiter(this, void 0, Promise, function () {
        var sb, keywords_1, data, scored, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    sb = supabase_1.supabaseAdmin();
                    keywords_1 = (taskTitle + ' ' + (taskDesc || ''))
                        .toLowerCase().split(/\s+/).filter(function (w) { return w.length > 4; }).slice(0, 6);
                    if (!keywords_1.length)
                        return [2 /*return*/, ''];
                    return [4 /*yield*/, sb.from('file_chunks').select('content').eq('workspace_id', workspaceId).limit(60)];
                case 1:
                    data = (_b.sent()).data;
                    if (!(data === null || data === void 0 ? void 0 : data.length))
                        return [2 /*return*/, ''];
                    scored = data
                        .map(function (chunk) { return ({ content: chunk.content, score: keywords_1.filter(function (k) { return chunk.content.toLowerCase().includes(k); }).length }); })
                        .filter(function (c) { return c.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 4);
                    if (!scored.length)
                        return [2 /*return*/, ''];
                    return [2 /*return*/, "\n\n## Company knowledge\n" + scored.map(function (c) { return c.content; }).join('\n\n---\n\n')];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, ''];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getIntegrationSummary(workspaceId) {
    return __awaiter(this, void 0, Promise, function () {
        var sb, _a, data, dbData, hasAnything, lines, summary, dbLines;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    sb = supabase_1.supabaseAdmin();
                    return [4 /*yield*/, Promise.all([
                            sb.from('integrations').select('type, config').eq('workspace_id', workspaceId).eq('status', 'connected'),
                            sb.from('db_connections').select('name, db_type, status, config').eq('workspace_id', workspaceId)
                        ])];
                case 1:
                    _a = _b.sent(), data = _a[0].data, dbData = _a[1].data;
                    hasAnything = ((data === null || data === void 0 ? void 0 : data.length) || 0) + ((dbData === null || dbData === void 0 ? void 0 : dbData.length) || 0) > 0;
                    if (!hasAnything)
                        return [2 /*return*/, ''];
                    lines = (data || []).map(function (i) {
                        var _a;
                        var cfg = i.config;
                        var details = {
                            slack: "Slack (default channel: " + ((cfg === null || cfg === void 0 ? void 0 : cfg.channel) || '#general') + ")",
                            github: "GitHub (default repo: " + ((cfg === null || cfg === void 0 ? void 0 : cfg.repo) || 'auto-detect') + ")",
                            notion: "Notion (database: " + ((cfg === null || cfg === void 0 ? void 0 : cfg.database_id) ? 'configured' : 'not set') + ")",
                            gmail: "Gmail (sender: " + ((cfg === null || cfg === void 0 ? void 0 : cfg.sender_email) || 'not set') + ")",
                            google_calendar: "Google Calendar (via webhook)",
                            zapier: "Zapier (webhook: configured)",
                            jira: "Jira (project: " + ((cfg === null || cfg === void 0 ? void 0 : cfg.project_key) || 'PROJ') + ", host: " + ((cfg === null || cfg === void 0 ? void 0 : cfg.host) || 'not set') + ")",
                            linear: "Linear (team: " + ((cfg === null || cfg === void 0 ? void 0 : cfg.team_id) || 'default') + ")",
                            hubspot: "HubSpot CRM",
                            twilio: "Twilio (from: " + ((cfg === null || cfg === void 0 ? void 0 : cfg.from_number) || 'not set') + ")",
                            stripe: "Stripe (live: " + (((_a = cfg === null || cfg === void 0 ? void 0 : cfg.secret_key) === null || _a === void 0 ? void 0 : _a.startsWith('sk_live')) ? 'yes' : 'test mode') + ")",
                            airtable: "Airtable",
                            asana: "Asana (project: " + ((cfg === null || cfg === void 0 ? void 0 : cfg.project_id) || 'default') + ")",
                            trello: "Trello",
                            intercom: "Intercom",
                            zendesk: "Zendesk (subdomain: " + ((cfg === null || cfg === void 0 ? void 0 : cfg.subdomain) || 'not set') + ")",
                            vercel: "Vercel (team: " + ((cfg === null || cfg === void 0 ? void 0 : cfg.team_id) || 'personal') + ")",
                            pagerduty: "PagerDuty",
                            sentry: "Sentry (org: " + ((cfg === null || cfg === void 0 ? void 0 : cfg.org_slug) || 'not set') + ")",
                            cloudflare: "Cloudflare"
                        };
                        return '- ' + (details[i.type] || i.type);
                    });
                    summary = '';
                    if (lines.length)
                        summary += "\n\n## Connected integrations\n" + lines.join('\n');
                    summary += "\n\nAlways available:\n- Excel: generate .xlsx files\n- Web search: search the internet";
                    if (dbData === null || dbData === void 0 ? void 0 : dbData.length) {
                        dbLines = dbData.map(function (d) {
                            var _a, _b;
                            var tables = ((_b = (_a = d.config) === null || _a === void 0 ? void 0 : _a.tables) === null || _b === void 0 ? void 0 : _b.length) ? " (tables: " + d.config.tables.join(', ') + ")" : '';
                            return "- " + d.name + " [" + d.db_type + "] \u2014 status: " + d.status + tables;
                        });
                        summary += "\n\n## Connected databases\n" + dbLines.join('\n');
                    }
                    return [2 /*return*/, summary];
            }
        });
    });
}
function loadMemory(workspaceId, agentType) {
    return __awaiter(this, void 0, Promise, function () {
        var sb, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sb = supabase_1.supabaseAdmin();
                    return [4 /*yield*/, sb.from('agent_memory').select('content')
                            .eq('workspace_id', workspaceId).eq('agent_type', agentType)
                            .order('created_at', { ascending: false }).limit(5)];
                case 1:
                    data = (_a.sent()).data;
                    if (!(data === null || data === void 0 ? void 0 : data.length))
                        return [2 /*return*/, ''];
                    return [2 /*return*/, "\n\n## Memory from past tasks\n" + data.map(function (m) { return "- " + m.content; }).join('\n')];
            }
        });
    });
}
function saveMemory(workspaceId, agentType, content, taskId) {
    return __awaiter(this, void 0, void 0, function () {
        var memory, sb, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, anthropic_1.callLLM({
                            model: anthropic_1.AGENT_MODEL,
                            system: 'Extract 1 key fact worth remembering for future tasks. Return just the fact as one sentence, or "NONE".',
                            prompt: content.slice(0, 800),
                            maxTokens: 150
                        })];
                case 1:
                    memory = _b.sent();
                    if (!(memory && memory !== 'NONE')) return [3 /*break*/, 3];
                    sb = supabase_1.supabaseAdmin();
                    return [4 /*yield*/, sb.from('agent_memory').insert({
                            workspace_id: workspaceId, agent_type: agentType,
                            memory_type: 'fact', content: memory, source_task_id: taskId
                        })];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3: return [3 /*break*/, 5];
                case 4:
                    _a = _b.sent();
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function postProgress(taskId, workspaceId, petName, agentType, type, content) {
    return __awaiter(this, void 0, void 0, function () {
        var sb;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sb = supabase_1.supabaseAdmin();
                    return [4 /*yield*/, sb.from('task_updates').insert({ task_id: taskId, workspace_id: workspaceId, agent_type: agentType, pet_name: petName, update_type: type, content: content })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ─── Build AI SDK tools from tool-registry ───────────────────────────────────
// Maps each connected tool into AI SDK `tool()` format.
// The actual execution still goes through executeTools() so all the
// existing integration dispatch logic is preserved.
function buildAiSdkTools(workspaceId) {
    var _a, _b;
    return __awaiter(this, void 0, Promise, function () {
        var connected, tools, _loop_1, _i, connected_1, t;
        var _this = this;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, tool_registry_1.getConnectedTools(workspaceId)];
                case 1:
                    connected = _c.sent();
                    if (!connected.length)
                        return [2 /*return*/, {}];
                    tools = {};
                    _loop_1 = function (t) {
                        // Build a Zod schema from the tool's input_schema properties
                        var props = ((_a = t.input_schema) === null || _a === void 0 ? void 0 : _a.properties) || {};
                        var required = ((_b = t.input_schema) === null || _b === void 0 ? void 0 : _b.required) || [];
                        var shape = {};
                        for (var _i = 0, _a = Object.entries(props); _i < _a.length; _i++) {
                            var _b = _a[_i], key = _b[0], def = _b[1];
                            var zField = zod_1.z.string().describe(def.description || key);
                            if (!required.includes(key))
                                zField = zField.optional();
                            shape[key] = zField;
                        }
                        var toolName = t.name;
                        var wid = workspaceId;
                        tools[toolName] = ai_1.tool({
                            description: t.description,
                            parameters: zod_1.z.object(shape),
                            execute: function (input) { return __awaiter(_this, void 0, void 0, function () {
                                var calls, results;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            calls = [{
                                                    id: toolName + "-" + Date.now(),
                                                    name: toolName,
                                                    input: Object.fromEntries(Object.entries(input).map(function (_a) {
                                                        var k = _a[0], v = _a[1];
                                                        return [k, String(v !== null && v !== void 0 ? v : '')];
                                                    }))
                                                }];
                                            return [4 /*yield*/, tool_executor_1.executeTools(calls, wid)];
                                        case 1:
                                            results = _b.sent();
                                            return [2 /*return*/, ((_a = results[0]) === null || _a === void 0 ? void 0 : _a.content) || 'Tool completed'];
                                    }
                                });
                            }); }
                        });
                    };
                    for (_i = 0, connected_1 = connected; _i < connected_1.length; _i++) {
                        t = connected_1[_i];
                        _loop_1(t);
                    }
                    return [2 /*return*/, tools];
            }
        });
    });
}
// ─── Agentic tool loop (for Bolt/executor) ────────────────────────────────────
function runAgenticLoop(systemPrompt, userMessage, workspaceId, onProgress) {
    var _a;
    return __awaiter(this, void 0, Promise, function () {
        var tools, hasTools, result, err_1, msg;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, buildAiSdkTools(workspaceId)];
                case 1:
                    tools = _b.sent();
                    hasTools = Object.keys(tools).length > 0;
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, ai_1.generateText({
                            model: anthropic_1.getLLM(anthropic_1.EXECUTOR_MODEL),
                            system: systemPrompt,
                            prompt: userMessage,
                            tools: hasTools ? tools : undefined,
                            maxSteps: 10,
                            maxTokens: anthropic_1.MAX_TOKENS,
                            onStepFinish: function (_a) {
                                var text = _a.text, toolCalls = _a.toolCalls, toolResults = _a.toolResults;
                                return __awaiter(_this, void 0, void 0, function () {
                                    var names;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0:
                                                if (!(text === null || text === void 0 ? void 0 : text.trim())) return [3 /*break*/, 2];
                                                return [4 /*yield*/, onProgress(text.trim())];
                                            case 1:
                                                _b.sent();
                                                _b.label = 2;
                                            case 2:
                                                if (!(toolCalls === null || toolCalls === void 0 ? void 0 : toolCalls.length)) return [3 /*break*/, 4];
                                                names = toolCalls.map(function (tc) { return tc.toolName.replace(/_/g, ' '); }).join(', ');
                                                return [4 /*yield*/, onProgress("\u26A1 Executing: " + names + "\u2026")];
                                            case 3:
                                                _b.sent();
                                                _b.label = 4;
                                            case 4: return [2 /*return*/];
                                        }
                                    });
                                });
                            }
                        })];
                case 3:
                    result = _b.sent();
                    return [2 /*return*/, result.text || ((_a = result.steps) === null || _a === void 0 ? void 0 : _a.map(function (s) { return s.text; }).filter(Boolean).join('\n')) || 'Task completed.'];
                case 4:
                    err_1 = _b.sent();
                    msg = (err_1 === null || err_1 === void 0 ? void 0 : err_1.message) || String(err_1);
                    if (msg.includes('401') || msg.includes('User not found')) {
                        return [2 /*return*/, "Could not connect to the AI provider. Please check OPENROUTER_API_KEY in your .env.local file is valid and has credits."];
                    }
                    throw err_1;
                case 5: return [2 /*return*/];
            }
        });
    });
}
// ─── Run a single pet step ────────────────────────────────────────────────────
function runPet(petName, task, previousOutputs, stepId) {
    var e_1, _a;
    return __awaiter(this, void 0, Promise, function () {
        var pet, sb, _b, memory, rag, integrationSummary, context, systemPrompt, userMessage, output, accumulated, lastEmitLen, EMIT_EVERY, textStream, textStream_1, textStream_1_1, delta, e_1_1;
        var _this = this;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    pet = pets_1.PETS[petName];
                    sb = supabase_1.supabaseAdmin();
                    return [4 /*yield*/, sb.from('task_pipeline').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', stepId)];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, postProgress(task.id, task.workspace_id, pet.displayName, pet.agentType, 'started', pet.displayName + " starting\u2026")];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, Promise.all([
                            loadMemory(task.workspace_id, pet.agentType),
                            getRagContext(task.workspace_id, task.title, task.description || ''),
                            getIntegrationSummary(task.workspace_id),
                        ])];
                case 3:
                    _b = _c.sent(), memory = _b[0], rag = _b[1], integrationSummary = _b[2];
                    context = previousOutputs.length > 0
                        ? "\n\n## Previous step output\n" + previousOutputs[previousOutputs.length - 1]
                        : '';
                    systemPrompt = pet.systemPrompt + integrationSummary + memory + rag;
                    userMessage = "Task: " + task.title + (task.description ? "\nDetails: " + task.description : '') + context;
                    if (!(pet.agentType === 'executor')) return [3 /*break*/, 5];
                    return [4 /*yield*/, runAgenticLoop(systemPrompt, userMessage, task.workspace_id, function (msg) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, postProgress(task.id, task.workspace_id, pet.displayName, pet.agentType, 'progress', msg)];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 4:
                    output = _c.sent();
                    return [3 /*break*/, 20];
                case 5:
                    accumulated = '';
                    lastEmitLen = 0;
                    EMIT_EVERY = 120;
                    textStream = ai_1.streamText({
                        model: anthropic_1.getLLM(anthropic_1.AGENT_MODEL),
                        system: systemPrompt,
                        prompt: userMessage,
                        maxTokens: anthropic_1.MAX_TOKENS
                    }).textStream;
                    _c.label = 6;
                case 6:
                    _c.trys.push([6, 12, 13, 18]);
                    textStream_1 = __asyncValues(textStream);
                    _c.label = 7;
                case 7: return [4 /*yield*/, textStream_1.next()];
                case 8:
                    if (!(textStream_1_1 = _c.sent(), !textStream_1_1.done)) return [3 /*break*/, 11];
                    delta = textStream_1_1.value;
                    accumulated += delta;
                    if (!(accumulated.length - lastEmitLen >= EMIT_EVERY)) return [3 /*break*/, 10];
                    lastEmitLen = accumulated.length;
                    return [4 /*yield*/, postProgress(task.id, task.workspace_id, pet.displayName, pet.agentType, 'progress', accumulated)];
                case 9:
                    _c.sent();
                    _c.label = 10;
                case 10: return [3 /*break*/, 7];
                case 11: return [3 /*break*/, 18];
                case 12:
                    e_1_1 = _c.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 18];
                case 13:
                    _c.trys.push([13, , 16, 17]);
                    if (!(textStream_1_1 && !textStream_1_1.done && (_a = textStream_1["return"]))) return [3 /*break*/, 15];
                    return [4 /*yield*/, _a.call(textStream_1)];
                case 14:
                    _c.sent();
                    _c.label = 15;
                case 15: return [3 /*break*/, 17];
                case 16:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 17: return [7 /*endfinally*/];
                case 18:
                    output = accumulated;
                    if (!output) return [3 /*break*/, 20];
                    return [4 /*yield*/, postProgress(task.id, task.workspace_id, pet.displayName, pet.agentType, 'progress', output)];
                case 19:
                    _c.sent();
                    _c.label = 20;
                case 20: return [4 /*yield*/, sb.from('task_pipeline').update({ status: 'completed', output: output, completed_at: new Date().toISOString() }).eq('id', stepId)];
                case 21:
                    _c.sent();
                    saveMemory(task.workspace_id, pet.agentType, output, task.id)["catch"](function () { });
                    return [2 /*return*/, output];
            }
        });
    });
}
// ─── Run full pipeline ────────────────────────────────────────────────────────
function runPipeline(task) {
    return __awaiter(this, void 0, Promise, function () {
        var sb, pipeline, stepRecords, i, pet, data, outputs, _i, stepRecords_1, _a, petName, stepId, output, err_2, errMsg;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    sb = supabase_1.supabaseAdmin();
                    pipeline = pets_1.getPipelineForTask(task.assigned_agent || 'default');
                    stepRecords = [];
                    i = 0;
                    _b.label = 1;
                case 1:
                    if (!(i < pipeline.length)) return [3 /*break*/, 4];
                    pet = pets_1.PETS[pipeline[i]];
                    return [4 /*yield*/, sb.from('task_pipeline').insert({
                            task_id: task.id, workspace_id: task.workspace_id,
                            step_index: i, agent_type: pet.agentType,
                            pet_name: pet.displayName, status: 'waiting'
                        }).select().single()];
                case 2:
                    data = (_b.sent()).data;
                    stepRecords.push({ petName: pipeline[i], stepId: data.id });
                    _b.label = 3;
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4:
                    outputs = [];
                    _i = 0, stepRecords_1 = stepRecords;
                    _b.label = 5;
                case 5:
                    if (!(_i < stepRecords_1.length)) return [3 /*break*/, 12];
                    _a = stepRecords_1[_i], petName = _a.petName, stepId = _a.stepId;
                    _b.label = 6;
                case 6:
                    _b.trys.push([6, 8, , 11]);
                    return [4 /*yield*/, runPet(petName, task, outputs, stepId)];
                case 7:
                    output = _b.sent();
                    outputs.push(output);
                    return [3 /*break*/, 11];
                case 8:
                    err_2 = _b.sent();
                    errMsg = err_2.message || String(err_2);
                    return [4 /*yield*/, sb.from('task_pipeline').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', stepId)];
                case 9:
                    _b.sent();
                    return [4 /*yield*/, postProgress(task.id, task.workspace_id, pets_1.PETS[petName].displayName, pets_1.PETS[petName].agentType, 'error', pets_1.PETS[petName].displayName + " failed: " + errMsg)];
                case 10:
                    _b.sent();
                    outputs.push("[" + petName + " failed: " + errMsg + "]");
                    return [3 /*break*/, 11];
                case 11:
                    _i++;
                    return [3 /*break*/, 5];
                case 12: return [2 /*return*/, __spreadArrays(outputs).reverse().find(function (o) { return !o.startsWith('['); }) || outputs[outputs.length - 1] || ''];
            }
        });
    });
}
exports.runPipeline = runPipeline;
