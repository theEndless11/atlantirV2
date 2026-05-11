'use client';
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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.ArtifactPanel = void 0;
var react_1 = require("react");
var badge_1 = require("@/components/ui/badge");
var button_1 = require("@/components/ui/button");
var separator_1 = require("@/components/ui/separator");
var lucide_react_1 = require("lucide-react");
var DataGridRenderer_1 = require("./DataGridRenderer");
var MarkdownRenderer_1 = require("@/components/MarkdownRenderer");
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
    table: React.createElement(lucide_react_1.Table2, { className: "h-4 w-4" }),
    graph: React.createElement(lucide_react_1.TrendingUp, { className: "h-4 w-4" }),
    richtext: React.createElement(lucide_react_1.AlignLeft, { className: "h-4 w-4" }),
    composite: React.createElement(lucide_react_1.LayoutTemplate, { className: "h-4 w-4" }),
    other: React.createElement(lucide_react_1.FileText, { className: "h-4 w-4" }),
    research: React.createElement(lucide_react_1.FileText, { className: "h-4 w-4" })
};
// ── Fullscreen wrapper ────────────────────────────────────────────────────────
function FullscreenModal(_a) {
    var title = _a.title, onClose = _a.onClose, children = _a.children;
    react_1.useEffect(function () {
        var handler = function (e) { if (e.key === 'Escape')
            onClose(); };
        document.addEventListener('keydown', handler);
        return function () { return document.removeEventListener('keydown', handler); };
    }, [onClose]);
    return (React.createElement("div", { style: {
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', flexDirection: 'column',
            animation: 'fadeIn .18s ease'
        } },
        React.createElement("div", { style: {
                background: 'var(--surface)', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', padding: '12px 20px', gap: 12, flexShrink: 0
            } },
            React.createElement("span", { style: { fontSize: 14, fontWeight: 600, color: 'var(--text-1)', flex: 1 } }, title),
            React.createElement("button", { onClick: onClose, style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 6, borderRadius: 6 } },
                React.createElement(lucide_react_1.X, { className: "h-4 w-4" }))),
        React.createElement("div", { style: { flex: 1, overflow: 'auto', padding: 32, display: 'flex', flexDirection: 'column' } }, children)));
}
// ── Renderers ─────────────────────────────────────────────────────────────────
function DocumentRenderer(_a) {
    var content = _a.content, fullscreen = _a.fullscreen;
    var md = content.markdown || content.body || '';
    return React.createElement("div", { style: { maxWidth: fullscreen ? 860 : 'none', margin: fullscreen ? '0 auto' : undefined } },
        React.createElement(MarkdownRenderer_1.MarkdownRenderer, { content: md, size: fullscreen ? 'lg' : 'sm' }));
}
function EmailRenderer(_a) {
    var _b;
    var content = _a.content, fullscreen = _a.fullscreen;
    return (React.createElement("div", { className: "space-y-3 text-sm" },
        React.createElement("div", null,
            React.createElement("span", { className: "text-muted-foreground" }, "To: "),
            (content.to || []).join(', ')),
        ((_b = content.cc) === null || _b === void 0 ? void 0 : _b.length) ? React.createElement("div", null,
            React.createElement("span", { className: "text-muted-foreground" }, "Cc: "),
            content.cc.join(', ')) : null,
        React.createElement("div", null,
            React.createElement("span", { className: "text-muted-foreground" }, "Subject: "),
            React.createElement("strong", null, content.subject)),
        React.createElement(separator_1.Separator, null),
        React.createElement("pre", { className: "whitespace-pre-wrap font-sans leading-relaxed" }, content.body_mjml || content.body)));
}
function CodeRenderer(_a) {
    var _b;
    var _c, _d;
    var content = _a.content;
    var files = content.files || (content.code ? (_b = {}, _b[content.filename || 'main'] = content.code, _b) : {});
    var _e = react_1.useState((_c = Object.keys(files)[0]) !== null && _c !== void 0 ? _c : ''), activeFile = _e[0], setActiveFile = _e[1];
    return (React.createElement("div", { className: "space-y-2" },
        React.createElement("div", { className: "flex gap-1 flex-wrap" }, Object.keys(files).map(function (f) { return (React.createElement("button", { key: f, onClick: function () { return setActiveFile(f); }, className: "text-xs px-2 py-0.5 rounded border " + (activeFile === f ? 'bg-muted font-medium' : 'text-muted-foreground') }, f)); })),
        content.explanation && React.createElement("p", { style: { fontSize: 12, color: 'var(--text-2)', margin: '4px 0 8px' } }, content.explanation),
        React.createElement("pre", { className: "text-xs bg-muted rounded p-3 overflow-auto max-h-80 whitespace-pre" }, (_d = files[activeFile]) !== null && _d !== void 0 ? _d : '')));
}
// ── Rich Text Renderer ────────────────────────────────────────────────────────
function RichTextRenderer(_a) {
    var content = _a.content, fullscreen = _a.fullscreen;
    var md = content.markdown || content.body || '';
    return (React.createElement("div", { style: { maxWidth: fullscreen ? 860 : 'none', margin: fullscreen ? '0 auto' : undefined } },
        content.title && React.createElement("h2", { style: { fontSize: fullscreen ? 22 : 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-1)' } }, content.title),
        React.createElement(MarkdownRenderer_1.MarkdownRenderer, { content: md, size: fullscreen ? 'lg' : 'md' })));
}
// ── Table Renderer ────────────────────────────────────────────────────────────
function TableRenderer(_a) {
    var _b, _c, _d;
    var content = _a.content, fullscreen = _a.fullscreen;
    var _e = react_1.useState(null), sortCol = _e[0], setSortCol = _e[1];
    var _f = react_1.useState('asc'), sortDir = _f[0], setSortDir = _f[1];
    var _g = react_1.useState(''), filter = _g[0], setFilter = _g[1];
    var columns = content.columns || (((_b = content.rows) === null || _b === void 0 ? void 0 : _b[0]) ? Object.keys(content.rows[0]) : []);
    var rows = content.rows || [];
    if (filter) {
        var q_1 = filter.toLowerCase();
        rows = rows.filter(function (r) { return columns.some(function (c) { var _a; return String((_a = r[c]) !== null && _a !== void 0 ? _a : '').toLowerCase().includes(q_1); }); });
    }
    if (sortCol) {
        rows = __spreadArrays(rows).sort(function (a, b) {
            var av = a[sortCol], bv = b[sortCol];
            var an = parseFloat(av), bn = parseFloat(bv);
            if (!isNaN(an) && !isNaN(bn))
                return sortDir === 'asc' ? an - bn : bn - an;
            return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        });
    }
    function toggleSort(col) {
        if (sortCol === col)
            setSortDir(function (d) { return d === 'asc' ? 'desc' : 'asc'; });
        else {
            setSortCol(col);
            setSortDir('asc');
        }
    }
    return (React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 10, height: '100%' } },
        (content.filterable !== false) && (React.createElement("input", { placeholder: "Filter rows...", value: filter, onChange: function (e) { return setFilter(e.target.value); }, style: { padding: '7px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text-1)', outline: 'none', width: fullscreen ? 320 : '100%', boxSizing: 'border-box' } })),
        React.createElement("div", { style: { flex: 1, overflow: 'auto', borderRadius: 8, border: '1px solid var(--border)' } },
            React.createElement("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: fullscreen ? 14 : 12 } },
                React.createElement("thead", null,
                    React.createElement("tr", null, columns.map(function (col) { return (React.createElement("th", { key: col, onClick: function () { return content.sortable !== false && toggleSort(col); }, style: {
                            padding: fullscreen ? '10px 14px' : '7px 12px',
                            textAlign: 'left', fontWeight: 600,
                            color: 'var(--text-2)', fontSize: fullscreen ? 12 : 10,
                            textTransform: 'uppercase', letterSpacing: '.05em',
                            background: 'var(--surface-2)',
                            position: 'sticky', top: 0, borderBottom: '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                            cursor: content.sortable !== false ? 'pointer' : 'default',
                            userSelect: 'none'
                        } },
                        React.createElement("span", { style: { display: 'flex', alignItems: 'center', gap: 4 } },
                            col,
                            sortCol === col && React.createElement("span", { style: { fontSize: 9 } }, sortDir === 'asc' ? '↑' : '↓')))); }))),
                React.createElement("tbody", null, rows.map(function (row, i) { return (React.createElement("tr", { key: i, style: { background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' } }, columns.map(function (col) {
                    var _a;
                    return (React.createElement("td", { key: col, style: { padding: fullscreen ? '9px 14px' : '6px 12px', borderBottom: '1px solid var(--border-soft)', color: 'var(--text-1)', whiteSpace: 'nowrap' } }, String((_a = row[col]) !== null && _a !== void 0 ? _a : '')));
                }))); }))),
            rows.length === 0 && (React.createElement("div", { style: { textAlign: 'center', padding: 24, color: 'var(--text-3)', fontSize: 13 } }, "No results"))),
        React.createElement("div", { style: { fontSize: 11, color: 'var(--text-3)' } },
            rows.length,
            " of ", (_d = (_c = content.rows) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0,
            " rows")));
}
// ── Graph Renderer ────────────────────────────────────────────────────────────
function GraphRenderer(_a) {
    var content = _a.content, fullscreen = _a.fullscreen;
    var canvasRef = react_1.useRef(null);
    var chartRef = react_1.useRef(null);
    var _b = react_1.useState(false), ready = _b[0], setReady = _b[1];
    react_1.useEffect(function () {
        if (!window.Chart) {
            var s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js';
            s.onload = function () { return setReady(true); };
            document.head.appendChild(s);
        }
        else {
            setReady(true);
        }
    }, []);
    react_1.useEffect(function () {
        if (!ready || !canvasRef.current)
            return;
        var Chart = window.Chart;
        if (chartRef.current) {
            chartRef.current.destroy();
            chartRef.current = null;
        }
        // Professional palette — works on dark and light backgrounds
        var palette = [
            '#6366f1', '#10b981', '#f59e0b', '#3b82f6',
            '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
        ];
        var isPie = ['pie', 'doughnut'].includes(content.chartType);
        var chartType = content.chartType === 'area' ? 'line' : content.chartType;
        var datasets = (content.datasets || []).map(function (ds, i) {
            var color = ds.color || palette[i % palette.length];
            var isLine = ['line', 'area'].includes(content.chartType);
            return {
                label: ds.label,
                data: ds.data,
                backgroundColor: isPie
                    ? palette.map(function (c) { return c + 'cc'; })
                    : isLine ? color + '22' : color + 'cc',
                borderColor: isPie ? palette.map(function (c) { return c; }) : color,
                borderWidth: isLine ? 2.5 : 1.5,
                fill: content.chartType === 'area',
                tension: 0.42,
                pointBackgroundColor: color,
                pointBorderColor: '#1a1d27',
                pointBorderWidth: 2,
                pointRadius: isLine ? 4 : 0,
                pointHoverRadius: 6
            };
        });
        var gridColor = 'rgba(255,255,255,0.06)';
        var tickColor = 'rgba(255,255,255,0.35)';
        var fontFamily = "'Inter', 'system-ui', sans-serif";
        chartRef.current = new Chart(canvasRef.current, {
            type: chartType,
            data: { labels: content.labels || [], datasets: datasets },
            options: __assign({ responsive: true, maintainAspectRatio: true, animation: { duration: 600, easing: 'easeOutQuart' }, plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: tickColor,
                            font: { family: fontFamily, size: fullscreen ? 13 : 11 },
                            padding: 18,
                            usePointStyle: true,
                            pointStyleWidth: 10
                        }
                    },
                    title: content.title ? {
                        display: true,
                        text: content.title,
                        color: 'rgba(255,255,255,0.85)',
                        font: { family: fontFamily, size: fullscreen ? 16 : 13, weight: '600' },
                        padding: { bottom: 20 }
                    } : { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15,17,23,0.95)',
                        titleColor: 'rgba(255,255,255,0.9)',
                        bodyColor: 'rgba(255,255,255,0.65)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: { family: fontFamily, weight: '600', size: 12 },
                        bodyFont: { family: fontFamily, size: 12 }
                    }
                }, scales: !isPie ? {
                    x: {
                        grid: { color: gridColor, drawBorder: false },
                        ticks: { color: tickColor, font: { family: fontFamily, size: fullscreen ? 12 : 10 }, maxRotation: 45 },
                        border: { color: 'transparent' }
                    },
                    y: {
                        grid: { color: gridColor, drawBorder: false },
                        ticks: { color: tickColor, font: { family: fontFamily, size: fullscreen ? 12 : 10 } },
                        border: { color: 'transparent' }
                    }
                } : undefined }, content.options)
        });
        return function () { if (chartRef.current) {
            chartRef.current.destroy();
            chartRef.current = null;
        } };
    }, [ready, content, fullscreen]);
    return (React.createElement("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '8px 0' } },
        !ready && React.createElement("div", { style: { padding: 24, color: 'var(--text-3)', fontSize: 13 } }, "Loading chart..."),
        React.createElement("canvas", { ref: canvasRef, style: { maxHeight: fullscreen ? 'calc(100vh - 200px)' : 360, width: '100%' } })));
}
// ── ChartRenderer (legacy) ────────────────────────────────────────────────────
function ChartRenderer(_a) {
    var content = _a.content;
    return (React.createElement("div", { className: "space-y-2 text-sm text-muted-foreground" },
        React.createElement("p", { className: "font-medium text-foreground" }, content.title),
        React.createElement("p", null,
            "Type: ",
            content.chartType || content.chart_type,
            " \u00B7 ",
            (content.data || []).length,
            " data points")));
}
function GenericRenderer(_a) {
    var content = _a.content;
    return React.createElement("pre", { className: "text-xs bg-muted rounded p-3 overflow-auto max-h-80" }, JSON.stringify(content, null, 2));
}
// ── Composite Renderer ───────────────────────────────────────────────────────
// Renders multiple blocks (text + table + graph + code) in sequence
function CompositeRenderer(_a) {
    var content = _a.content, fullscreen = _a.fullscreen;
    var blocks = content.blocks || [];
    return (React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: fullscreen ? 40 : 24 } },
        content.summary && (React.createElement("p", { style: { fontSize: 13.5, lineHeight: 1.75, color: 'var(--text-1, #f1f5f9)', margin: '0 0 16px 0', opacity: 0.9 } }, content.summary)),
        blocks.map(function (block, i) { return (React.createElement("div", { key: i },
            block.type === 'text' && (React.createElement(MarkdownRenderer_1.MarkdownRenderer, { content: block.content || '', size: fullscreen ? 'md' : 'sm' })),
            block.type === 'table' && React.createElement(TableRenderer, { content: block, fullscreen: fullscreen }),
            block.type === 'graph' && React.createElement(GraphRenderer, { content: block, fullscreen: fullscreen }),
            block.type === 'code' && (React.createElement("pre", { style: { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 12, fontFamily: 'monospace', overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 } }, block.content || '')))); })));
}
// ── Artifact Content Router ───────────────────────────────────────────────────
function ArtifactContent(_a) {
    var artifact = _a.artifact, onDataGridChange = _a.onDataGridChange, fullscreen = _a.fullscreen;
    var c = artifact.content;
    // Supabase can return JSONB as raw string — parse defensively
    if (typeof c === 'string') {
        try {
            c = JSON.parse(c);
        }
        catch (_b) {
            c = { markdown: c };
        }
    }
    switch (artifact.type) {
        case 'document': return React.createElement(DocumentRenderer, { content: c, fullscreen: fullscreen });
        case 'email': return React.createElement(EmailRenderer, { content: c, fullscreen: fullscreen });
        case 'chart': return React.createElement(ChartRenderer, { content: c });
        case 'code': return React.createElement(CodeRenderer, { content: c });
        case 'datagrid': return React.createElement(DataGridRenderer_1.DataGridRenderer, { artifact: artifact, onDataChange: onDataGridChange });
        case 'table': return React.createElement(TableRenderer, { content: c, fullscreen: fullscreen });
        case 'graph': return React.createElement(GraphRenderer, { content: c, fullscreen: fullscreen });
        case 'richtext': return React.createElement(RichTextRenderer, { content: c, fullscreen: fullscreen });
        case 'composite': return React.createElement(CompositeRenderer, { content: c, fullscreen: fullscreen });
        default:
            // 'other' type — render markdown if present, else generic
            if ((c === null || c === void 0 ? void 0 : c.markdown) || (c === null || c === void 0 ? void 0 : c.body))
                return React.createElement(RichTextRenderer, { content: c, fullscreen: fullscreen });
            return React.createElement(GenericRenderer, { content: c });
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
var FULLSCREEN_TYPES = new Set(['table', 'graph', 'richtext', 'datagrid', 'composite', 'document', 'email', 'chart', 'code', 'research', 'other']);
function ArtifactPanel(_a) {
    var _b, _c;
    var artifact = _a.artifact, workspaceId = _a.workspaceId, onUpdate = _a.onUpdate, onDataGridChange = _a.onDataGridChange;
    var _d = react_1.useState(artifact), current = _d[0], setCurrent = _d[1];
    var _e = react_1.useTransition(), isPending = _e[0], startTransition = _e[1];
    var _f = react_1.useState(null), error = _f[0], setError = _f[1];
    var _g = react_1.useState(false), isFullscreen = _g[0], setIsFullscreen = _g[1];
    var badge = (_b = STATE_BADGE[current.state]) !== null && _b !== void 0 ? _b : { label: current.state, variant: 'secondary' };
    var icon = (_c = TYPE_ICON[current.type]) !== null && _c !== void 0 ? _c : React.createElement(lucide_react_1.FileText, { className: "h-4 w-4" });
    var canFullscreen = FULLSCREEN_TYPES.has(current.type);
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
    return (React.createElement(React.Fragment, null,
        isFullscreen && (React.createElement(FullscreenModal, { title: current.title, onClose: function () { return setIsFullscreen(false); } },
            React.createElement(ArtifactContent, { artifact: current, onDataGridChange: onDataGridChange, fullscreen: true }))),
        React.createElement("div", { className: "rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden" },
            React.createElement("div", { className: "flex items-center justify-between px-4 py-3 border-b bg-muted/40" },
                React.createElement("div", { className: "flex items-center gap-2 min-w-0" },
                    React.createElement("span", { className: "text-muted-foreground shrink-0" }, icon),
                    React.createElement("span", { className: "font-medium text-sm truncate" }, current.title),
                    current.version > 1 && (React.createElement("span", { className: "text-xs text-muted-foreground shrink-0" },
                        "v",
                        current.version))),
                React.createElement("div", { className: "flex items-center gap-2 ml-2 shrink-0" },
                    React.createElement(badge_1.Badge, { variant: badge.variant, className: "text-xs" }, badge.label),
                    canFullscreen && (React.createElement("button", { onClick: function () { return setIsFullscreen(true); }, title: "Fullscreen", style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 4, borderRadius: 4 } },
                        React.createElement(lucide_react_1.Maximize2, { className: "h-3.5 w-3.5" }))))),
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
                                "Execute")))))))),
        React.createElement("style", null, "@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }")));
}
exports.ArtifactPanel = ArtifactPanel;
