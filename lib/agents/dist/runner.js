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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
exports.__esModule = true;
exports.runAgent = exports.checkNeedsClarification = void 0;
var anthropic_1 = require("../anthropic");
var supabase_1 = require("../supabase");
var ai_1 = require("ai");
var AGENT_PROMPTS = {
    orchestrator: '',
    research: "You are a Research Agent. Find accurate, up-to-date information on the given topic.\n- Summarise findings clearly with source context where available\n- If company knowledge is provided, prioritise it over general knowledge\n- You can produce: richtext documents (markdown), tables of data, or graphs/charts when relevant\n- Return a well-structured research summary",
    writer: "You are a Writer Agent. Produce clear, professional written content.\n- Match tone to context (formal for reports, conversational for emails)\n- Structure content with headers where appropriate\n- If company knowledge is provided, use it to personalise the content\n- You can produce: richtext documents, tables (for structured comparisons), or graphs (for data visualisation)\n- Return the complete document, ready to use",
    analyst: "You are an Analyst Agent. Analyse information and produce insights.\n- Use structured frameworks (pros/cons, comparisons, rankings)\n- Back conclusions with reasoning\n- If company knowledge is provided, incorporate it into the analysis\n- If connected databases are listed, reference them in your analysis \u2014 the executor can query them if needed\n- You can produce: tables (for data comparisons), graphs (bar, line, pie, scatter, area), or richtext reports\n- Return a clear analysis with actionable recommendations",
    executor: "You are an Executor Agent. Carry out specific tasks precisely using the connected tools and integrations available.\n- Do exactly what is asked\n- Use the connected integrations and databases listed in the workspace context\n- IMPORTANT: If databases are listed as connected, you have access to them \u2014 do not claim otherwise\n- When the task involves data, produce a table or graph artifact to visualise results\n- Report what you did and the result clearly\n- Return a clear completion report"
};
var CLARIFICATION_PROMPT = "You are about to work on a task. Before starting, decide if you have enough information.\nIf you need ONE specific piece of info to do the task well, ask it as a single short question.\nIf you have enough to proceed, respond with exactly: PROCEED\nDo not ask obvious or unnecessary questions.";
function embedQuery(text) {
    return __awaiter(this, void 0, Promise, function () {
        var res, data, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, fetch('https://openrouter.ai/api/v1/embeddings', {
                            method: 'POST',
                            headers: {
                                'Authorization': "Bearer " + process.env.OPENROUTER_API_KEY,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ model: 'openai/text-embedding-ada-002', input: [text] })
                        })];
                case 1:
                    res = _b.sent();
                    if (!res.ok)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, res.json()];
                case 2:
                    data = _b.sent();
                    return [2 /*return*/, data.data[0].embedding];
                case 3:
                    _a = _b.sent();
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getRelevantContext(query, workspaceId) {
    return __awaiter(this, void 0, Promise, function () {
        var sb, embedding, data, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    sb = supabase_1.supabaseAdmin();
                    return [4 /*yield*/, embedQuery(query)];
                case 1:
                    embedding = _b.sent();
                    if (!embedding)
                        return [2 /*return*/, ''];
                    return [4 /*yield*/, sb.rpc('match_chunks', {
                            query_embedding: embedding,
                            workspace_filter: workspaceId,
                            match_count: 5
                        })];
                case 2:
                    data = (_b.sent()).data;
                    if (!(data === null || data === void 0 ? void 0 : data.length))
                        return [2 /*return*/, ''];
                    return [2 /*return*/, data.map(function (c) { return c.content; }).join('\n\n---\n\n')];
                case 3:
                    _a = _b.sent();
                    return [2 /*return*/, ''];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getWorkspaceToolsContext(workspaceId) {
    return __awaiter(this, void 0, Promise, function () {
        var sb, _a, intResult, dbResult, integrations, databases, ctx, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    sb = supabase_1.supabaseAdmin();
                    return [4 /*yield*/, Promise.all([
                            sb.from('integrations').select('type').eq('workspace_id', workspaceId).eq('status', 'connected'),
                            sb.from('db_connections').select('name, db_type, status, config').eq('workspace_id', workspaceId)
                        ])];
                case 1:
                    _a = _c.sent(), intResult = _a[0], dbResult = _a[1];
                    integrations = (intResult.data || []).map(function (i) { return i.type; });
                    databases = (dbResult.data || []).map(function (d) {
                        var _a, _b;
                        var tables = ((_b = (_a = d.config) === null || _a === void 0 ? void 0 : _a.tables) === null || _b === void 0 ? void 0 : _b.join(', ')) || '';
                        return d.name + " (" + d.db_type + ", status: " + d.status + ")" + (tables ? ' — tables: ' + tables : '');
                    });
                    ctx = '';
                    if (integrations.length)
                        ctx += "\n\nConnected integrations available to use: " + integrations.join(', ');
                    if (databases.length)
                        ctx += "\n\nConnected databases available to query: " + databases.join('; ');
                    return [2 /*return*/, ctx];
                case 2:
                    _b = _c.sent();
                    return [2 /*return*/, ''];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getTaskMessages(taskId) {
    return __awaiter(this, void 0, void 0, function () {
        var sb, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sb = supabase_1.supabaseAdmin();
                    return [4 /*yield*/, sb
                            .from('messages')
                            .select('*')
                            .eq('task_id', taskId)
                            .order('created_at', { ascending: true })];
                case 1:
                    data = (_a.sent()).data;
                    return [2 /*return*/, data || []];
            }
        });
    });
}
function checkNeedsClarification(task, agentType) {
    return __awaiter(this, void 0, Promise, function () {
        var text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, anthropic_1.callLLM({
                        model: anthropic_1.AGENT_MODEL,
                        system: CLARIFICATION_PROMPT,
                        prompt: "Task: " + task.title + "\n\n" + (task.description || ''),
                        maxTokens: 300
                    })];
                case 1:
                    text = _a.sent();
                    if (text.trim() === 'PROCEED')
                        return [2 /*return*/, null];
                    return [2 /*return*/, text.trim()];
            }
        });
    });
}
exports.checkNeedsClarification = checkNeedsClarification;
function runAgent(task, agentType, runId) {
    var e_1, _a;
    return __awaiter(this, void 0, Promise, function () {
        var sb, _b, context, toolsContext, history, agentBasePrompt, systemPrompt, prompt, _i, history_1, msg, accumulated, lastEmitLen, EMIT_EVERY, textStream, textStream_1, textStream_1_1, delta, e_1_1, output;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    sb = supabase_1.supabaseAdmin();
                    return [4 /*yield*/, Promise.all([
                            getRelevantContext(task.title + " " + (task.description || ''), task.workspace_id),
                            getWorkspaceToolsContext(task.workspace_id),
                            getTaskMessages(task.id)
                        ])];
                case 1:
                    _b = _c.sent(), context = _b[0], toolsContext = _b[1], history = _b[2];
                    agentBasePrompt = AGENT_PROMPTS[agentType];
                    systemPrompt = agentBasePrompt + (toolsContext ? "\n\nWorkspace tools context:" + toolsContext : '');
                    prompt = '';
                    if (context) {
                        prompt += "Relevant company knowledge for this task:\n\n" + context + "\n\n---\n\n";
                    }
                    for (_i = 0, history_1 = history; _i < history_1.length; _i++) {
                        msg = history_1[_i];
                        prompt += (msg.sender_type === 'human' ? 'User' : 'Assistant') + ": " + msg.content + "\n\n";
                    }
                    prompt += "Task: " + task.title + "\n\n" + (task.description || '');
                    // Emit "started" update
                    return [4 /*yield*/, sb.from('task_updates').insert({
                            workspace_id: task.workspace_id,
                            task_id: task.id,
                            agent_run_id: runId,
                            pet_name: agentType,
                            update_type: 'started',
                            content: agentType + " agent starting\u2026"
                        })
                        // Stream the response and emit chunks as progress updates
                    ];
                case 2:
                    // Emit "started" update
                    _c.sent();
                    accumulated = '';
                    lastEmitLen = 0;
                    EMIT_EVERY = 150;
                    textStream = ai_1.streamText({
                        model: anthropic_1.getLLM(anthropic_1.AGENT_MODEL),
                        system: systemPrompt,
                        prompt: prompt,
                        maxTokens: anthropic_1.MAX_TOKENS
                    }).textStream;
                    _c.label = 3;
                case 3:
                    _c.trys.push([3, 9, 10, 15]);
                    textStream_1 = __asyncValues(textStream);
                    _c.label = 4;
                case 4: return [4 /*yield*/, textStream_1.next()];
                case 5:
                    if (!(textStream_1_1 = _c.sent(), !textStream_1_1.done)) return [3 /*break*/, 8];
                    delta = textStream_1_1.value;
                    accumulated += delta;
                    if (!(accumulated.length - lastEmitLen >= EMIT_EVERY)) return [3 /*break*/, 7];
                    lastEmitLen = accumulated.length;
                    return [4 /*yield*/, sb.from('task_updates').insert({
                            workspace_id: task.workspace_id,
                            task_id: task.id,
                            agent_run_id: runId,
                            pet_name: agentType,
                            update_type: 'progress',
                            content: accumulated
                        })];
                case 6:
                    _c.sent();
                    _c.label = 7;
                case 7: return [3 /*break*/, 4];
                case 8: return [3 /*break*/, 15];
                case 9:
                    e_1_1 = _c.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 15];
                case 10:
                    _c.trys.push([10, , 13, 14]);
                    if (!(textStream_1_1 && !textStream_1_1.done && (_a = textStream_1["return"]))) return [3 /*break*/, 12];
                    return [4 /*yield*/, _a.call(textStream_1)];
                case 11:
                    _c.sent();
                    _c.label = 12;
                case 12: return [3 /*break*/, 14];
                case 13:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 14: return [7 /*endfinally*/];
                case 15:
                    output = accumulated;
                    return [4 /*yield*/, sb.from('agent_runs').update({
                            status: 'completed',
                            output: output,
                            tool_calls: [],
                            ended_at: new Date().toISOString()
                        }).eq('id', runId)];
                case 16:
                    _c.sent();
                    return [2 /*return*/, output];
            }
        });
    });
}
exports.runAgent = runAgent;
