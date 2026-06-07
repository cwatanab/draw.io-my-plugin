/**
 * Draw.io / diagrams.net plugin: Click Through Transparent
 *
 * 通常クリック時、透明な図形をスルーして背面の図形を選択します。
 * Alt+クリック時はdraw.io本来の挙動のままです。
 */
(function() {
    'use strict';

    var pluginName = 'Click Through Transparent';
    var handlerMarker = '__clickThroughTransparentPatched';
    var oldGraphMarker = '__clickThroughTransparentOldPatched';
    var patchVersion = 2;

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

    /**
     * @param {Event} evt
     * @returns {boolean}
     */
    function isAltDown(evt) {
        if (evt == null) {
            return false;
        }

        if (typeof mxEvent !== 'undefined' && mxEvent.isAltDown) {
            return mxEvent.isAltDown(evt);
        }

        return !!evt.altKey;
    }

    /**
     * @param {mxMouseEvent} me
     * @returns {mxCell|null}
     */
    function getMouseCell(me) {
        if (me != null && me.getCell != null) {
            var cell = me.getCell();

            if (cell != null) {
                return cell;
            }
        }

        var state = (me != null && me.getState != null) ? me.getState() : null;
        return (state != null) ? state.cell : null;
    }

    /**
     * @param {mxMouseEvent} me
     * @returns {number|null}
     */
    function getGraphX(me) {
        if (me == null) {
            return null;
        }

        return (me.graphX != null) ? me.graphX :
            (me.getGraphX != null ? me.getGraphX() : null);
    }

    /**
     * @param {mxMouseEvent} me
     * @returns {number|null}
     */
    function getGraphY(me) {
        if (me == null) {
            return null;
        }

        return (me.graphY != null) ? me.graphY :
            (me.getGraphY != null ? me.getGraphY() : null);
    }

    /**
     * @param {mxGraph} graph
     * @param {mxMouseEvent} me
     * @param {Function} ignoreFn
     * @returns {mxCell|null}
     */
    function getCellAt(graph, me, ignoreFn) {
        var x = getGraphX(me);
        var y = getGraphY(me);

        if (graph == null || graph.getCellAt == null || x == null || y == null) {
            return null;
        }

        return graph.getCellAt(x, y, null, null, null, ignoreFn);
    }

    /**
     * @param {mxGraph} graph
     * @param {mxMouseEvent} me
     * @param {mxCell} cell
     * @returns {mxCell|null}
     */
    function getNativeTransparentClickCell(graph, me, cell) {
        var active = false;

        return getCellAt(graph, me, function(state) {
            var selected = graph.isCellSelected(state.cell);
            active = active || selected;

            return !active || selected ||
                (state.cell !== cell && graph.model.isAncestor(state.cell, cell));
        });
    }

    /**
     * @param {mxGraph} graph
     * @param {mxMouseEvent} me
     * @param {mxCell} cell
     * @returns {mxCell|null}
     */
    function getChildCellBelow(graph, me, cell) {
        var model = graph != null ? graph.model : null;

        if (model == null ||
            model.getChildCount == null ||
            model.isAncestor == null ||
            model.getChildCount(cell) === 0) {
            return null;
        }

        var child = getCellAt(graph, me, function(state) {
            return state.cell === cell;
        });

        return (child != null && child !== cell && model.isAncestor(cell, child)) ?
            child :
            null;
    }

    /**
     * @param {mxGraphHandler} handler
     * @param {mxMouseEvent} me
     * @returns {mxCell|null}
     */
    function getNormalClickCell(handler, me) {
        var graph = handler.graph;
        var cell = getMouseCell(me);

        if (cell == null) {
            return null;
        }

        var transparentCell = getNativeTransparentClickCell(graph, me, cell);

        if (transparentCell != null && transparentCell !== cell) {
            return transparentCell;
        }

        var childCell = getChildCellBelow(graph, me, cell);

        return (childCell != null) ? childCell : cell;
    }

    /**
     * @param {mxGraph} graph
     */
    function restoreOldTransparentPatch(graph) {
        if (graph != null &&
            graph[oldGraphMarker] != null &&
            graph[oldGraphMarker].isTransparentClickEvent != null) {
            graph.isTransparentClickEvent = graph[oldGraphMarker].isTransparentClickEvent;
            graph[oldGraphMarker] = null;
        }
    }

    /**
     * @returns {boolean}
     */
    function patchGraphHandler() {
        if (typeof mxGraphHandler === 'undefined' ||
            mxGraphHandler.prototype == null ||
            mxGraphHandler.prototype.getInitialCellForEvent == null ||
            mxGraphHandler.prototype.selectCellForEvent == null) {
            warn('mxGraphHandler is not available; selection hook was not installed.');
            return false;
        }

        var prototype = mxGraphHandler.prototype;
        var previousPatch = prototype[handlerMarker];

        if (previousPatch != null && previousPatch.version === patchVersion) {
            return true;
        }

        var originalGetInitialCellForEvent =
            (previousPatch != null && previousPatch.getInitialCellForEvent != null) ?
                previousPatch.getInitialCellForEvent :
                prototype.getInitialCellForEvent;

        var originalSelectCellForEvent =
            (previousPatch != null && previousPatch.selectCellForEvent != null) ?
                previousPatch.selectCellForEvent :
                prototype.selectCellForEvent;

        prototype[handlerMarker] = {
            version: patchVersion,
            getInitialCellForEvent: originalGetInitialCellForEvent,
            selectCellForEvent: originalSelectCellForEvent
        };

        prototype.getInitialCellForEvent = function(me) {
            if (isAltDown(me.getEvent())) {
                return originalGetInitialCellForEvent.apply(this, arguments);
            }

            var cell = getNormalClickCell(this, me);

            return (cell != null) ?
                cell :
                originalGetInitialCellForEvent.apply(this, arguments);
        };

        prototype.selectCellForEvent = function(cell, me) {
            if (isAltDown(me.getEvent())) {
                return originalSelectCellForEvent.apply(this, arguments);
            }

            var state = this.graph.view.getState(cell);

            if (state != null) {
                this.graph.selectCellForEvent(cell, me.getEvent());
            }

            return cell;
        };

        return true;
    }

    if (typeof Draw === 'undefined' || Draw.loadPlugin == null) {
        warn('Draw.loadPlugin is not available.');
        return;
    }

    Draw.loadPlugin(function(ui) {
        var graph = ui != null && ui.editor != null ? ui.editor.graph : null;

        restoreOldTransparentPatch(graph);

        if (patchGraphHandler()) {
            log('loaded.');
        }
    });
})();
