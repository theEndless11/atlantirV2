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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.DataGridRenderer = void 0;
var react_1 = require("react");
var glide_data_grid_1 = require("@glideapps/glide-data-grid");
require("@glideapps/glide-data-grid/dist/index.css");
var lucide_react_1 = require("lucide-react");
function css(name, fallback) {
    if (typeof window === 'undefined')
        return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function buildTheme() {
    return {
        accentColor: css('--accent', '#6366f1'),
        accentFg: css('--text-inv', '#ffffff'),
        accentLight: css('--accent-soft', '#eef2ff'),
        textDark: css('--text-1', '#1a1714'),
        textMedium: css('--text-2', '#5c5549'),
        textLight: css('--text-3', '#9c9289'),
        textBubble: css('--text-1', '#1a1714'),
        bgIconHeader: css('--surface-2', '#f5f3ef'),
        fgIconHeader: css('--text-2', '#5c5549'),
        textHeader: css('--text-1', '#1a1714'),
        textGroupHeader: css('--text-1', '#1a1714'),
        bgCell: css('--surface', '#ffffff'),
        bgCellMedium: css('--bg', '#f9f7f4'),
        bgHeader: css('--surface-2', '#f5f3ef'),
        bgHeaderHasFocus: css('--accent-soft', '#eef2ff'),
        bgHeaderHovered: css('--surface-3', '#ede9e2'),
        bgBubble: css('--surface-2', '#f5f3ef'),
        bgBubbleSelected: css('--accent-border', '#c7d2fe'),
        borderColor: css('--border', '#e8e4dc'),
        drilldownBorder: css('--accent', '#6366f1'),
        linkColor: css('--accent', '#6366f1'),
        cellHorizontalPadding: 12,
        cellVerticalPadding: 4,
        headerFontStyle: '500 12px',
        baseFontStyle: '13px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        editorFontSize: '13px',
        lineHeight: 1.5
    };
}
function buildColumns(headers, widths) {
    return headers.map(function (h, i) {
        var _a;
        return ({
            title: h,
            id: "col-" + i,
            width: (_a = widths[i]) !== null && _a !== void 0 ? _a : 160,
            hasMenu: false
        });
    });
}
function toCsv(headers, rows) {
    var esc = function (v) { return "\"" + String(v).replace(/"/g, '""') + "\""; };
    return __spreadArrays([headers], rows).map(function (r) { return r.map(esc).join(','); }).join('\n');
}
function DataGridRenderer(_a) {
    var _b, _c, _d, _e;
    var artifact = _a.artifact, onDataChange = _a.onDataChange;
    var content = artifact.content;
    var _f = react_1.useState((_b = content.headers) !== null && _b !== void 0 ? _b : []), headers = _f[0], setHeaders = _f[1];
    var _g = react_1.useState((_c = content.rows) !== null && _c !== void 0 ? _c : []), rows = _g[0], setRows = _g[1];
    var _h = react_1.useState((_d = content.columnWidths) !== null && _d !== void 0 ? _d : ((_e = content.headers) !== null && _e !== void 0 ? _e : []).map(function () { return 160; })), widths = _h[0], setWidths = _h[1];
    var _j = react_1.useState({
        columns: glide_data_grid_1.CompactSelection.empty(),
        rows: glide_data_grid_1.CompactSelection.empty(),
        current: undefined
    }), selection = _j[0], setSelection = _j[1];
    var _k = react_1.useState(''), aiPrompt = _k[0], setAiPrompt = _k[1];
    var _l = react_1.useState(false), aiLoading = _l[0], setAiLoading = _l[1];
    var _m = react_1.useState(null), aiError = _m[0], setAiError = _m[1];
    var _o = react_1.useState({}), gridTheme = _o[0], setGridTheme = _o[1];
    // Read CSS vars after mount so canvas gets real resolved values
    react_1.useEffect(function () { setGridTheme(buildTheme()); }, []);
    react_1.useEffect(function () {
        var _a, _b, _c, _d;
        setHeaders((_a = content.headers) !== null && _a !== void 0 ? _a : []);
        setRows((_b = content.rows) !== null && _b !== void 0 ? _b : []);
        setWidths((_c = content.columnWidths) !== null && _c !== void 0 ? _c : ((_d = content.headers) !== null && _d !== void 0 ? _d : []).map(function () { return 160; }));
    }, [artifact.id, artifact.version]); // eslint-disable-line
    var emit = react_1.useCallback(function (h, r, w) { return onDataChange === null || onDataChange === void 0 ? void 0 : onDataChange({ headers: h, rows: r, columnWidths: w }); }, [onDataChange]);
    var getContent = react_1.useCallback(function (_a) {
        var _b, _c;
        var col = _a[0], row = _a[1];
        var value = (_c = (_b = rows[row]) === null || _b === void 0 ? void 0 : _b[col]) !== null && _c !== void 0 ? _c : '';
        return { kind: glide_data_grid_1.GridCellKind.Text, data: value, displayData: value, allowOverlay: true, readonly: false };
    }, [rows]);
    var onCellEdited = react_1.useCallback(function (_a, cell) {
        var col = _a[0], row = _a[1];
        var next = rows.map(function (r, ri) {
            return ri === row ? r.map(function (c, ci) { var _a; return (ci === col ? String((_a = cell.data) !== null && _a !== void 0 ? _a : '') : c); }) : r;
        });
        setRows(next);
        emit(headers, next, widths);
    }, [rows, headers, widths, emit]);
    var columns = react_1.useMemo(function () { return buildColumns(headers, widths); }, [headers, widths]);
    var onColumnResize = react_1.useCallback(function (_col, newSize, colIndex) {
        var next = widths.map(function (w, i) { return (i === colIndex ? newSize : w); });
        setWidths(next);
        emit(headers, rows, next);
    }, [widths, headers, rows, emit]);
    function addRow() {
        var next = __spreadArrays(rows, [Array(headers.length).fill('')]);
        setRows(next);
        emit(headers, next, widths);
    }
    function addColumn() {
        var nh = __spreadArrays(headers, ["Column " + (headers.length + 1)]);
        var nw = __spreadArrays(widths, [160]);
        var nr = rows.map(function (r) { return __spreadArrays(r, ['']); });
        setHeaders(nh);
        setWidths(nw);
        setRows(nr);
        emit(nh, nr, nw);
    }
    function deleteSelectedRows() {
        var del = new Set(selection.rows.toArray());
        if (!del.size)
            return;
        var next = rows.filter(function (_, i) { return !del.has(i); });
        setRows(next);
        setSelection({ columns: glide_data_grid_1.CompactSelection.empty(), rows: glide_data_grid_1.CompactSelection.empty(), current: undefined });
        emit(headers, next, widths);
    }
    function exportCsv() {
        var blob = new Blob([toCsv(headers, rows)], { type: 'text/csv' });
        var a = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(blob),
            download: artifact.title.replace(/\s+/g, '_') + ".csv"
        });
        a.click();
        URL.revokeObjectURL(a.href);
    }
    function runAiAssist() {
        return __awaiter(this, void 0, void 0, function () {
            var res, _a, data, nw, err_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!aiPrompt.trim())
                            return [2 /*return*/];
                        setAiLoading(true);
                        setAiError(null);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 6, 7, 8]);
                        return [4 /*yield*/, fetch('/api/artifacts/datagrid-ai', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ headers: headers, rows: rows, prompt: aiPrompt })
                            })];
                    case 2:
                        res = _b.sent();
                        if (!!res.ok) return [3 /*break*/, 4];
                        _a = Error.bind;
                        return [4 /*yield*/, res.text()];
                    case 3: throw new (_a.apply(Error, [void 0, _b.sent()]))();
                    case 4: return [4 /*yield*/, res.json()];
                    case 5:
                        data = _b.sent();
                        nw = data.headers.map(function (_, i) { var _a; return (_a = widths[i]) !== null && _a !== void 0 ? _a : 160; });
                        setHeaders(data.headers);
                        setRows(data.rows);
                        setWidths(nw);
                        emit(data.headers, data.rows, nw);
                        setAiPrompt('');
                        return [3 /*break*/, 8];
                    case 6:
                        err_1 = _b.sent();
                        setAiError(err_1 instanceof Error ? err_1.message : 'AI assist failed');
                        return [3 /*break*/, 8];
                    case 7:
                        setAiLoading(false);
                        return [7 /*endfinally*/];
                    case 8: return [2 /*return*/];
                }
            });
        });
    }
    var gridHeight = Math.min(540, Math.max(180, rows.length * 34 + 48));
    var selCount = selection.rows.length;
    return (React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
            React.createElement("button", { className: "btn btn-ghost", style: { fontSize: 12, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }, onClick: addRow },
                React.createElement(lucide_react_1.Plus, { size: 12 }),
                " Row"),
            React.createElement("button", { className: "btn btn-ghost", style: { fontSize: 12, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }, onClick: addColumn },
                React.createElement(lucide_react_1.Columns2, { size: 12 }),
                " Column"),
            selCount > 0 && (React.createElement("button", { className: "btn btn-danger", style: { fontSize: 12, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }, onClick: deleteSelectedRows },
                React.createElement(lucide_react_1.Trash2, { size: 12 }),
                " Delete ",
                selCount,
                " row",
                selCount > 1 ? 's' : '')),
            React.createElement("div", { style: { flex: 1 } }),
            React.createElement("span", { className: "badge badge-grey", style: { fontFamily: 'monospace', fontSize: 11 } },
                rows.length,
                " \u00D7 ",
                headers.length),
            React.createElement("button", { className: "btn btn-ghost", style: { fontSize: 12, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }, onClick: exportCsv },
                React.createElement(lucide_react_1.Download, { size: 12 }),
                " Export CSV")),
        React.createElement("div", { style: { borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', height: gridHeight } },
            React.createElement(glide_data_grid_1["default"], { width: "100%", height: gridHeight, columns: columns, getCellContent: getContent, onCellEdited: onCellEdited, onColumnResize: onColumnResize, rows: rows.length, rowMarkers: "both", smoothScrollX: true, smoothScrollY: true, freezeColumns: 1, rowSelect: "multi", gridSelection: selection, onGridSelectionChange: function (s) {
                    return setSelection({ columns: s.columns, rows: s.rows, current: s.current });
                }, theme: gridTheme, getCellsForSelection: true, onPaste: true })),
        React.createElement("div", { style: {
                display: 'flex', alignItems: 'center', gap: 8,
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--surface-2)', padding: '7px 12px',
                opacity: aiLoading ? 0.6 : 1,
                pointerEvents: aiLoading ? 'none' : 'auto'
            } },
            aiLoading
                ? React.createElement(lucide_react_1.Loader2, { size: 13, style: { color: 'var(--accent)', flexShrink: 0, animation: 'spin .8s linear infinite' } })
                : React.createElement(lucide_react_1.Sparkles, { size: 13, style: { color: 'var(--text-3)', flexShrink: 0 } }),
            React.createElement("input", { style: {
                    flex: 1, border: 'none', background: 'transparent', outline: 'none',
                    fontSize: 12, color: 'var(--text-1)', fontFamily: 'inherit'
                }, placeholder: 'Ask AI: "add Bonus column", "sort by score desc", "summarize by dept"\u2026', value: aiPrompt, onChange: function (e) { return setAiPrompt(e.target.value); }, onKeyDown: function (e) { if (e.key === 'Enter')
                    runAiAssist(); } }),
            React.createElement("button", { disabled: !aiPrompt.trim(), onClick: runAiAssist, style: {
                    padding: '3px 10px', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: aiPrompt.trim() ? 'var(--accent)' : 'transparent',
                    color: aiPrompt.trim() ? 'var(--text-inv)' : 'var(--text-3)',
                    fontFamily: 'inherit'
                } }, aiLoading ? 'Working…' : 'Run')),
        aiError && (React.createElement("p", { style: { fontSize: 12, color: 'var(--red-text)', padding: '0 4px' } }, aiError))));
}
exports.DataGridRenderer = DataGridRenderer;
git;
add.
;
git;
commit - m;
"...";
git;
push;
origin;
main;
