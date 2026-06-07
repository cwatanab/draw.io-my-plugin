/**
 * draw.io Quick Styler Plugin
 */
(function() {
    'use strict';

    var pluginName = 'Quick Styler';
    var styleStorageKey = pluginName + '-styles';

    /**
     * @param {string} message
     */
    function log(message) {
        if (typeof console !== 'undefined' && console.log) {
            console.log(pluginName + ': ' + message);
        }
    }

    /**
     * @param {string} message
     */
    function warn(message) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn(pluginName + ': ' + message);
        }
    }

    var CONFIG = {
        menus: [
            {
                label: 'プロパティ',
                properties: [
                    {
                        key: 'expand',
                        label: '連動してサイズを拡張する',
                        values: [
                            { value: '1' },
                            { value: '0' }
                        ]
                    },
                    {
                        key: 'autosize',
                        label: 'テキストに併せてサイズを調整する',
                        defaultOff: true,
                        values: [
                            { value: '1' },
                            { value: '0' }
                        ]
                    },
                    {
                        key: 'aspect',
                        label: '縦横比を固定する',
                        defaultOff: true,
                        values: [
                            { value: 'fixed' },
                            { value: '0' }
                        ]
                    },
                    {
                        key: 'resizable',
                        label: 'リサイズを禁止する',
                        defaultOff: true,
                        values: [
                            { value: '0' },
                            { value: '1' }
                        ]
                    },
                    {
                        key: 'movable',
                        label: '位置を固定する',
                        defaultOff: true,
                        values: [
                            { value: '0' },
                            { value: '1' }
                        ]
                    },
                    {
                        key: 'container',
                        label: 'コンテナにする',
                        defaultOff: true,
                        values: [
                            { value: '1' },
                            { value: '0' }
                        ]
                    },
                    {
                        key: 'noLabel',
                        label: 'ラベルを隠す',
                        defaultOff: true,
                        values: [
                            { value: '1' },
                            { value: '0' }
                        ]
                    },
                    {
                        key: 'snapToPoint',
                        label: 'ポイントにスナップ',
                        values: [
                            { value: '1' },
                            { value: '0' }
                        ]
                    },
                    {
                        key: 'constraintPoints',
                        label: '接続ポイントを制限する',
                        values: [
                            { value: 'all', label: '上下左右' },
                            { value: 'h', label: '左右' },
                            { value: 'v', label: '上下' },
                            { value: 'none', label: 'なし' }
                        ]
                    },
                    {
                        key: 'allowArrows',
                        label: '矢印を出さない',
                        defaultOff: true,
                        values: [
                            { value: '0' },
                            { value: '1' }
                        ]
                    },
                    {
                        key: 'connectable',
                        label: '接続できなくする',
                        defaultOff: true,
                        values: [
                            { value: '0' },
                            { value: '1' }
                        ]
                    }
                ]
            },
            {
                label: 'スタイル',
                type: 'style'
            }
        ]
    };

    /**
     * @param {mxGraph} graph
     * @param {mxCell} cell
     * @returns {Object}
     */
    function getStyleValues(graph, cell) {
        var resolved = graph.getCellStyle(cell);
        var keys = [
            // Style tab
            'fillColor', 'strokeColor', 'gradientColor', 'glass',
            'strokeWidth', 'dashed', 'dashPattern', 'rounded',
            'opacity', 'shadow', 'shape', 'perimeter',
            // Text tab
            'fontColor', 'fontSize', 'fontFamily', 'fontStyle',
            'align', 'verticalAlign', 'labelPosition',
            'spacingLeft', 'spacingRight', 'spacingTop', 'spacingBottom',
            'whiteSpace', 'overflow',
            // Arrange tab
            'movable', 'resizable', 'rotatable', 'deletable', 'editable',
            'container', 'aspect', 'autosize'
        ];
        var result = {};
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (resolved[k] !== undefined && resolved[k] !== null) {
                result[k] = resolved[k];
            }
        }
        return result;
    }

    /**
     * @param {mxGraph} graph
     * @param {Array<mxCell>} cells
     * @param {Object} styleObj
     */
    function applyStyleValues(graph, cells, styleObj) {
        graph.getModel().beginUpdate();
        try {
            var keys = Object.keys(styleObj);
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                if (k === 'glass' && styleObj[k] === '0') {
                    cells.forEach(function(c) {
                        var s = mxUtils.setStyle(graph.model.getStyle(c), 'glass', null);
                        graph.model.setStyle(c, s);
                    });
                } else {
                    graph.setCellStyles(k, styleObj[k], cells);
                }
            }
        } finally {
            graph.getModel().endUpdate();
        }
        graph.refresh();
    }

    /**
     * @returns {Array<{name: string, style: Object}>}
     */
    function getSavedStyles() {
        try {
            var raw = localStorage.getItem(styleStorageKey);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    /**
     * @param {Array<{name: string, style: Object}>} styles
     */
    function setSavedStyles(styles) {
        try {
            localStorage.setItem(styleStorageKey, JSON.stringify(styles));
        } catch (e) {
            warn('Failed to save styles to localStorage');
        }
    }

    /**
     * @param {string} name
     * @param {Object} styleObj
     */
    function saveStyle(name, styleObj) {
        var styles = getSavedStyles();
        var existing = null;
        for (var i = 0; i < styles.length; i++) {
            if (styles[i].name === name) {
                existing = i;
                break;
            }
        }
        if (existing !== null) {
            styles[existing].style = styleObj;
        } else {
            styles.push({ name: name, style: styleObj });
        }
        setSavedStyles(styles);
        log('style saved: ' + name);
    }

    /**
     * @param {string} name
     */
    function deleteSavedStyle(name) {
        var styles = getSavedStyles().filter(function(item) {
            return item.name !== name;
        });
        setSavedStyles(styles);
        log('style deleted: ' + name);
    }

    /**
     * @param {mxGraph} graph
     * @param {string} key
     * @param {string} value
     */
    function setProp(graph, key, value) {
        var cells = graph.getSelectionCells();
        if (cells.length === 0) return;

        if (key === 'constraintPoints') {
            var points;
            switch (value) {
                case 'all': points = '[[0.5,0],[1,0.5],[0.5,1],[0,0.5]]'; break;
                case 'v': points = '[[0.5,0],[0.5,1]]'; break;
                case 'h': points = '[[0,0.5],[1,0.5]]'; break;
                case 'none': points = null; break;
            }
            graph.getModel().beginUpdate();
            try {
                for (var i = 0; i < cells.length; i++) {
                    if (graph.model.isVertex(cells[i])) {
                        var style = mxUtils.setStyle(graph.model.getStyle(cells[i]), 'points', points);
                        graph.model.setStyle(cells[i], style);
                    }
                }
            } finally {
                graph.getModel().endUpdate();
            }
            graph.refresh();
            return;
        }

        if (key === 'aspect' && value === '0') {
            graph.getModel().beginUpdate();
            try {
                for (var i = 0; i < cells.length; i++) {
                    var aspectStyle = mxUtils.setStyle(graph.model.getStyle(cells[i]), 'aspect', null);
                    graph.model.setStyle(cells[i], aspectStyle);
                }
            } finally {
                graph.getModel().endUpdate();
            }
            graph.refresh();
            return;
        }

        if (key === 'container' && value === '0') {
            graph.getModel().beginUpdate();
            try {
                for (var i = 0; i < cells.length; i++) {
                    var containerStyle = mxUtils.setStyle(graph.model.getStyle(cells[i]), 'container', null);
                    graph.model.setStyle(cells[i], containerStyle);
                }
            } finally {
                graph.getModel().endUpdate();
            }
            graph.refresh();
            return;
        }

        graph.setCellStyles(key, value, cells);
        graph.refresh();
    }

    /**
     * @param {mxGraph} graph
     * @param {mxCell} cell
     * @param {string} key
     * @returns {string|null}
     */
    function getCurrentVal(graph, cell, key) {
        var resolved = graph.getCellStyle(cell);
        if (resolved[key]) return resolved[key];
        var match = cell.getStyle().match(new RegExp('(?:^|;)' + key + '=([^;]*)'));
        return match ? match[1] : null;
    }

    /**
     * @param {mxGraph} graph
     * @param {mxCell} cell
     * @returns {string}
     */
    function getConstraintPreset(graph, cell) {
        var raw = getCurrentVal(graph, cell, 'points');
        if (!raw) return 'none';
        var normalized = raw.replace(/\s/g, '');
        if (normalized === '[[0.5,0],[1,0.5],[0.5,1],[0,0.5]]') return 'all';
        if (normalized === '[[0.5,0],[0.5,1]]') return 'v';
        if (normalized === '[[0,0.5],[1,0.5]]') return 'h';
        return 'none';
    }

    /**
     * @param {mxGraph} graph
     * @param {mxCell} cell
     */
    function showStyleDialog(graph, cell) {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:10000;display:flex;align-items:center;justify-content:center;font-family:sans-serif;';

        var dialog = document.createElement('div');
        dialog.style.cssText = 'background:#fff;border-radius:6px;padding:20px;min-width:280px;max-width:340px;box-shadow:0 4px 16px rgba(0,0,0,0.2);max-height:80vh;overflow-y:auto;position:relative;';

        var closeTop = document.createElement('button');
        closeTop.textContent = '\u2715';
        closeTop.title = '閉じる';
        closeTop.style.cssText = 'position:absolute;top:8px;right:10px;padding:0;border:none;background:none;font-size:14px;color:#9ca3af;cursor:pointer;line-height:1;';
        closeTop.onclick = close;
        dialog.appendChild(closeTop);

        var titleEl = document.createElement('div');
        titleEl.textContent = 'スタイルを管理';
        titleEl.style.cssText = 'font-size:14px;font-weight:600;margin-bottom:12px;color:#1f2937;padding-right:16px;';
        dialog.appendChild(titleEl);

        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '名前を入力';
        input.style.cssText = 'width:100%;padding:6px 8px;border:1px solid #d1d5db;border-radius:4px;font-size:13px;box-sizing:border-box;margin-bottom:10px;';

        var datalistId = 'quick-styler-datalist';
        var datalist = document.createElement('datalist');
        datalist.id = datalistId;

        function refreshDatalist() {
            while (datalist.firstChild) {
                datalist.removeChild(datalist.firstChild);
            }
            var styles = getSavedStyles();
            styles.forEach(function(item) {
                var opt = document.createElement('option');
                opt.value = item.name;
                datalist.appendChild(opt);
            });
        }

        var savedStyles = getSavedStyles();
        savedStyles.forEach(function(item) {
            var opt = document.createElement('option');
            opt.value = item.name;
            datalist.appendChild(opt);
        });
        dialog.appendChild(datalist);
        input.setAttribute('list', datalistId);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') close();
        });
        dialog.appendChild(input);

        var buttonRow = document.createElement('div');
        buttonRow.style.cssText = 'display:flex;gap:6px;';

        var saveBtn = document.createElement('button');
        saveBtn.textContent = '保存';
        saveBtn.style.cssText = 'flex:1;padding:6px 14px;border:none;border-radius:4px;background:#2563eb;color:#fff;font-size:12px;cursor:pointer;';
        saveBtn.onclick = save;
        buttonRow.appendChild(saveBtn);

        var delBtn = document.createElement('button');
        delBtn.textContent = '削除';
        delBtn.style.cssText = 'flex:1;padding:6px 14px;border:1px solid #ef4444;border-radius:4px;background:#fff;color:#ef4444;font-size:12px;cursor:pointer;';
        delBtn.onclick = function() {
            var name = input.value.trim();
            if (name) {
                deleteSavedStyle(name);
                input.value = '';
                input.focus();
                refreshDatalist();
            }
        };
        buttonRow.appendChild(delBtn);

        dialog.appendChild(buttonRow);

        overlay.appendChild(dialog);

        overlay.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') close();
        });

        function save() {
            var name = input.value.trim();
            if (name) {
                var styleObj = getStyleValues(graph, cell);
                saveStyle(name, styleObj);
                input.value = '';
                refreshDatalist();
            }
        }

        function close() {
            document.body.removeChild(overlay);
        }

        document.body.appendChild(overlay);
        setTimeout(function() { input.focus(); }, 50);
    }

    /**
     * @param {Object} menu
     * @param {mxGraph} graph
     * @param {mxCell} cell
     */
    function buildStyleMenu(menu, graph, cell) {
        var styleParent = menu.addItem(CONFIG.menus[1].label, null, null);

        menu.addItem('スタイルを管理', null, function() {
            showStyleDialog(graph, cell);
        }, styleParent);

        var savedStyles = getSavedStyles();
        var applied = false;

        savedStyles.forEach(function(item) {
            if (!applied) {
                menu.addSeparator(styleParent);
                applied = true;
            }
            menu.addItem(item.name, null, function() {
                applyStyleValues(graph, graph.getSelectionCells(), item.style);
            }, styleParent);
        });
    }

    if (typeof Draw === 'undefined' || Draw.loadPlugin == null) {
        warn('Draw.loadPlugin is not available.');
        return;
    }

    Draw.loadPlugin(function(ui) {
        var graph = ui.editor.graph;
        var menus = ui.menus;
        var originalCreatePopupMenu = menus.createPopupMenu;

        menus.createPopupMenu = function(menu, cell, evt) {
            if (cell != null && graph.model.isVertex(cell)) {

                CONFIG.menus.forEach(function(menuGroup) {
                    if (menuGroup.type === 'style') {
                        buildStyleMenu(menu, graph, cell);
                        return;
                    }

                    var parentItem = menu.addItem(menuGroup.label, null, null);

                    menuGroup.properties.forEach(function(prop) {
                        if (prop.values.length === 2) {
                            var cur = getCurrentVal(graph, cell, prop.key);
                            var checked;
                            if (cur == null) {
                                checked = !prop.defaultOff;
                            } else {
                                checked = (cur !== prop.values[1].value);
                            }
                            var nextVal = checked ? prop.values[1].value : prop.values[0].value;
                            var item = menu.addItem(prop.label, null, function() {
                                setProp(graph, prop.key, nextVal);
                            }, parentItem);
                            if (checked) {
                                menu.addCheckmark(item, Editor.checkmarkImage);
                            }
                        } else {
                            var propItem = menu.addItem(prop.label, null, null, parentItem);
                            var currentPreset = (prop.key === 'constraintPoints') ? getConstraintPreset(graph, cell) : null;
                            prop.values.forEach(function(val) {
                                var isActive = (val.value === currentPreset);
                                var subItem = menu.addItem(val.label, null, function() {
                                    setProp(graph, prop.key, val.value);
                                }, propItem);
                                if (isActive) {
                                    menu.addCheckmark(subItem, Editor.checkmarkImage);
                                }
                            });
                        }
                    });
                });

                menu.addSeparator();
            }

            originalCreatePopupMenu.call(menus, menu, cell, evt);
        };

        var totalProps = 0;
        CONFIG.menus.forEach(function(m) {
            if (m.properties) {
                totalProps += m.properties.length;
            }
        });
        log('loaded (' + totalProps + ' properties)');
    });
})();
