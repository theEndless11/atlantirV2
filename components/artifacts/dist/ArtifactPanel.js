'use client';
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
exports.ArtifactPanel = void 0;
var react_1 = require("react");
var badge_1 = require("@/components/ui/badge");
var button_1 = require("@/components/ui/button");
var separator_1 = require("@/components/ui/separator");
var lucide_react_1 = require("lucide-react");
var DataGridRenderer_1 = require("./DataGridRenderer");
var STATE_BADGE = {
    draft: { label: 'Draft', variant: 'secondary' },
    reviewed: { label: 'Reviewed', variant: 'outline' },
    approved: { label: 'Approved', variant: 'default' },
    executed: { label: 'Executed', variant: 'default' }
};
var TYPE_ICON = {
    document: React.createElement(lucide_react_1.FileText, { className: "h-4 w-4" }),
    email: React.createElement(lucide_react_1.Mail, { className: "h-4 w-4" }),
    chart: React.createElement(lucide_react_1.BarChart2, { className: "h-4 w-4" }),
    code: React.createElement(lucide_react_1.Code2, { className: "h-4 w-4" }),
    slides: React.createElement(lucide_react_1.Presentation, { className: "h-4 w-4" }),
    video: React.createElement(lucide_react_1.Video, { className: "h-4 w-4" }),
    datagrid: React.createElement(lucide_react_1.Table2, { className: "h-4 w-4" }),
    other: React.createElement(lucide_react_1.FileText, { className: "h-4 w-4" }),
    research: React.createElement(lucide_react_1.FileText, { className: "h-4 w-4" })
};
function DocumentRenderer(_a) {
    var content = _a.content;
    return (React.createElement("div", { className: "prose prose-sm dark:prose-invert max-w-none" },
        React.createElement("pre", { className: "whitespace-pre-wrap text-sm leading-relaxed font-sans" }, content.markdown)));
}
function EmailRenderer(_a) {
    var _b;
    var content = _a.content;
    return (React.createElement("div", { className: "space-y-3 text-sm" },
        React.createElement("div", null,
            React.createElement("span", { className: "text-muted-foreground" }, "To: "),
            content.to.join(', ')),
        ((_b = content.cc) === null || _b === void 0 ? void 0 : _b.length) ? React.createElement("div", null,
            React.createElement("span", { className: "text-muted-foreground" }, "Cc: "),
            content.cc.join(', ')) : null,
        React.createElement("div", null,
            React.createElement("span", { className: "text-muted-foreground" }, "Subject: "),
            React.createElement("strong", null, content.subject)),
        React.createElement(separator_1.Separator, null),
        React.createElement("pre", { className: "whitespace-pre-wrap font-sans leading-relaxed" }, content.body_mjml)));
}
function ChartRenderer(_a) {
    var content = _a.content;
    return (React.createElement("div", { className: "space-y-2 text-sm text-muted-foreground" },
        React.createElement("p", { className: "font-medium text-foreground" }, content.title),
        React.createElement("p", null,
            "Type: ",
            content.chartType,
            " \u00B7 ",
            content.data.length,
            " data points"),
        React.createElement("p", { className: "text-xs" }, "Full Tremor chart renderer loads in the task view.")));
}
function CodeRenderer(_a) {
    var _b, _c;
    var content = _a.content;
    var _d = react_1.useState((_b = Object.keys(content.files)[0]) !== null && _b !== void 0 ? _b : ''), activeFile = _d[0], setActiveFile = _d[1];
    return (React.createElement("div", { className: "space-y-2" },
        React.createElement("div", { className: "flex gap-1 flex-wrap" }, Object.keys(content.files).map(function (f) { return (React.createElement("button", { key: f, onClick: function () { return setActiveFile(f); }, className: "text-xs px-2 py-0.5 rounded border " + (activeFile === f ? 'bg-muted font-medium' : 'text-muted-foreground') }, f)); })),
        React.createElement("pre", { className: "text-xs bg-muted rounded p-3 overflow-auto max-h-80 whitespace-pre" }, (_c = content.files[activeFile]) !== null && _c !== void 0 ? _c : '')));
}
function GenericRenderer(_a) {
    var content = _a.content;
    return (React.createElement("pre", { className: "text-xs bg-muted rounded p-3 overflow-auto max-h-80" }, JSON.stringify(content, null, 2)));
}
function ArtifactContent(_a) {
    var artifact = _a.artifact, onDataGridChange = _a.onDataGridChange;
    var c = artifact.content;
    switch (artifact.type) {
        case 'document': return React.createElement(DocumentRenderer, { content: c });
        case 'email': return React.createElement(EmailRenderer, { content: c });
        case 'chart': return React.createElement(ChartRenderer, { content: c });
        case 'code': return React.createElement(CodeRenderer, { content: c });
        case 'datagrid': return (React.createElement(DataGridRenderer_1.DataGridRenderer, { artifact: artifact, onDataChange: onDataGridChange }));
        default: return React.createElement(GenericRenderer, { content: c });
    }
}
function transitionArtifact(artifactId, workspaceId, action) {
    return __awaiter(this, void 0, Promise, function () {
        var res, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, fetch('/api/artifacts', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ artifactId: artifactId, workspaceId: workspaceId, action: action })
                    })];
                case 1:
                    res = _b.sent();
                    if (!!res.ok) return [3 /*break*/, 3];
                    _a = Error.bind;
                    return [4 /*yield*/, res.text()];
                case 2: throw new (_a.apply(Error, [void 0, _b.sent()]))();
                case 3: return [2 /*return*/, res.json()];
            }
        });
    });
}
function ArtifactPanel(_a) {
    var _b, _c;
    var artifact = _a.artifact, workspaceId = _a.workspaceId, onUpdate = _a.onUpdate, onDataGridChange = _a.onDataGridChange;
    var _d = react_1.useState(artifact), current = _d[0], setCurrent = _d[1];
    var _e = react_1.useTransition(), isPending = _e[0], startTransition = _e[1];
    var _f = react_1.useState(null), error = _f[0], setError = _f[1];
    var badge = (_b = STATE_BADGE[current.state]) !== null && _b !== void 0 ? _b : { label: current.state, variant: 'secondary' };
    var icon = (_c = TYPE_ICON[current.type]) !== null && _c !== void 0 ? _c : React.createElement(lucide_react_1.FileText, { className: "h-4 w-4" });
    function handleTransition(action) {
        var _this = this;
        setError(null);
        startTransition(function () { return __awaiter(_this, void 0, void 0, function () {
            var updated, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, transitionArtifact(current.id, workspaceId, action)];
                    case 1:
                        updated = _a.sent();
                        setCurrent(updated);
                        onUpdate === null || onUpdate === void 0 ? void 0 : onUpdate(updated);
                        return [3 /*break*/, 3];
                    case 2:
                        err_1 = _a.sent();
                        setError(err_1 instanceof Error ? err_1.message : 'Action failed');
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
    }
    return (React.createElement("div", { className: "rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden" },
        React.createElement("div", { className: "flex items-center justify-between px-4 py-3 border-b bg-muted/40" },
            React.createElement("div", { className: "flex items-center gap-2 min-w-0" },
                React.createElement("span", { className: "text-muted-foreground shrink-0" }, icon),
                React.createElement("span", { className: "font-medium text-sm truncate" }, current.title),
                current.version > 1 && (React.createElement("span", { className: "text-xs text-muted-foreground shrink-0" },
                    "v",
                    current.version))),
            React.createElement(badge_1.Badge, { variant: badge.variant, className: "shrink-0 ml-2 text-xs" }, badge.label)),
        React.createElement("div", { className: "p-4 max-h-[420px] overflow-y-auto" },
            React.createElement(ArtifactContent, { artifact: current, onDataGridChange: onDataGridChange })),
        current.state !== 'executed' && (React.createElement(React.Fragment, null,
            React.createElement(separator_1.Separator, null),
            React.createElement("div", { className: "flex items-center justify-between px-4 py-3 gap-2" },
                error && React.createElement("p", { className: "text-xs text-destructive flex-1" }, error),
                React.createElement("div", { className: "flex gap-2 ml-auto" },
                    current.state === 'draft' && (React.createElement(button_1.Button, { size: "sm", variant: "outline", disabled: isPending, onClick: function () { return handleTransition('review'); } },
                        React.createElement(lucide_react_1.Eye, { className: "h-3.5 w-3.5 mr-1.5" }),
                        "Mark Reviewed")),
                    current.state === 'reviewed' && (React.createElement(button_1.Button, { size: "sm", variant: "outline", disabled: isPending, onClick: function () { return handleTransition('approve'); } },
                        React.createElement(lucide_react_1.CheckCircle, { className: "h-3.5 w-3.5 mr-1.5" }),
                        "Approve")),
                    current.state === 'approved' && (React.createElement(React.Fragment, null,
                        React.createElement(button_1.Button, { size: "sm", variant: "outline", disabled: isPending, onClick: function () { return handleTransition('review'); } },
                            React.createElement(lucide_react_1.RotateCcw, { className: "h-3.5 w-3.5 mr-1.5" }),
                            "Request Changes"),
                        React.createElement(button_1.Button, { size: "sm", disabled: isPending, onClick: function () { return handleTransition('execute'); } },
                            React.createElement(lucide_react_1.Send, { className: "h-3.5 w-3.5 mr-1.5" }),
                            "Execute")))))))));
}
exports.ArtifactPanel = ArtifactPanel;
