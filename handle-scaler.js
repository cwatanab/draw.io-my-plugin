/**
 * draw.io Handle Scaler Plugin
 * 
 * 頂点（選択時のサイズ変更・回転ハンドル）や、接続ポイント（コネクタ接続用の点）の
 * 表示サイズおよび判定サイズを大きくして、操作性を向上させます。
 */
(function() {
    'use strict';

    var pluginName = 'Handle Scaler';

    function log(message) {
        if (typeof console !== 'undefined' && console.log) {
            console.log(pluginName + ': ' + message);
        }
    }

    function warn(message) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn(pluginName + ': ' + message);
        }
    }

    var CONFIG = {
        handleSize: 10,       // 頂点の選択・リサイズハンドルのサイズ（デフォルト: 6〜7）
        labelHandleSize: 6,    // テキストラベルの移動ハンドルのサイズ（デフォルト: 4）
        connectHandleSize: 10, // コネクタ接続用トリガーハンドルのサイズ（デフォルト: 8）
        pointImageSize: 6,     // コネクションポイント（青/緑の点）のサイズ（デフォルト: 5）
        roundHandles: false,   // ハンドルを丸型（円形）にするかどうか
        maxHandleSize: 24,     // ズーム時のハンドルサイズの上限（ピクセル）
        maxPointSize: 12       // ズーム時の接続ポイントサイズの上限（ピクセル）
    };

    if (typeof Draw === 'undefined' || Draw.loadPlugin == null) {
        warn('Draw.loadPlugin is not available.');
        return;
    }

    Draw.loadPlugin(function(ui) {
        var graph = ui.editor.graph;

        // --- ヘルパー関数 ---

        // ズーム比に応じたサイズ計算（100%〜800%で緩やかに最大サイズへ変化）
        var getScaledSize = function(baseSize, maxSize, scale, minSize) {
            var size;
            if (scale >= 1) {
                var targetMaxScale = 8; // 800% で最大サイズに到達
                var t = (scale - 1) / (targetMaxScale - 1);
                t = Math.min(1, Math.max(0, t)); // 0〜1にクランプ
                size = baseSize + (maxSize - baseSize) * t;
            } else {
                size = baseSize * scale;
            }
            return Math.max(minSize || 4, Math.round(size));
        };

        // 設定に応じた sizer ハンドルの形状を生成する
        var getSizerShape = function(bounds, index, fillColor) {
            if (CONFIG.roundHandles) {
                return new mxEllipse(bounds, fillColor || mxConstants.HANDLE_FILLCOLOR, mxConstants.HANDLE_STROKECOLOR);
            } else {
                return new mxRectangleShape(bounds, fillColor || mxConstants.HANDLE_FILLCOLOR, mxConstants.HANDLE_STROKECOLOR);
            }
        };

        // sizers ハンドル配列の各 bounds サイズを最新の設定値に書き換える
        var updateSizersBounds = function(sizers, labelShape, rotationShape) {
            if (sizers == null) return;
            for (var i = 0; i < sizers.length; i++) {
                var sizer = sizers[i];
                if (sizer != null) {
                    if (labelShape && sizer === labelShape) {
                        sizer.bounds.width = mxConstants.LABEL_HANDLE_SIZE;
                        sizer.bounds.height = mxConstants.LABEL_HANDLE_SIZE;
                    } else if (rotationShape && sizer === rotationShape) {
                        sizer.bounds.width = mxConstants.HANDLE_SIZE + 3;
                        sizer.bounds.height = mxConstants.HANDLE_SIZE + 3;
                    } else {
                        sizer.bounds.width = mxConstants.HANDLE_SIZE;
                        sizer.bounds.height = mxConstants.HANDLE_SIZE;
                    }
                }
            }
        };

        // --- プロトタイプオーバーライド ---

        // 1. ハンドル形状設定のオーバーライド
        if (typeof mxVertexHandler !== 'undefined' && mxVertexHandler.prototype) {
            var originalVertexSizer = mxVertexHandler.prototype.createSizerShape;
            mxVertexHandler.prototype.createSizerShape = function(bounds, index, fillColor) {
                if (index !== mxEvent.ROTATION_HANDLE) {
                    return getSizerShape(bounds, index, fillColor);
                }
                return originalVertexSizer.apply(this, arguments);
            };
        }
        if (typeof mxEdgeHandler !== 'undefined' && mxEdgeHandler.prototype) {
            mxEdgeHandler.prototype.createSizerShape = function(bounds, index, fillColor) {
                return getSizerShape(bounds, index, fillColor);
            };
        }

        // 2. ズーム時に既存のハンドルの大きさが追従するように redraw を拡張
        if (typeof mxVertexHandler !== 'undefined' && mxVertexHandler.prototype) {
            var originalVertexRedraw = mxVertexHandler.prototype.redraw;
            mxVertexHandler.prototype.redraw = function() {
                updateSizersBounds(this.sizers, this.labelShape, this.rotationShape);
                originalVertexRedraw.apply(this, arguments);
            };
        }
        if (typeof mxEdgeHandler !== 'undefined' && mxEdgeHandler.prototype) {
            var originalEdgeRedraw = mxEdgeHandler.prototype.redraw;
            mxEdgeHandler.prototype.redraw = function() {
                updateSizersBounds(this.sizers);
                originalEdgeRedraw.apply(this, arguments);
            };
        }

        // 3. 接続ポイントの判定範囲（tolerance）の動的スケーリング拡張
        var originalPointImageSrc = null;
        if (typeof mxConstraintHandler !== 'undefined' && mxConstraintHandler.prototype) {
            var oldPointImage = mxConstraintHandler.prototype.pointImage;
            originalPointImageSrc = oldPointImage ? oldPointImage.src : (typeof mxClient !== 'undefined' ? mxClient.imageBasePath : '') + '/point.gif';

            var originalGetTolerance = mxConstraintHandler.prototype.getTolerance;
            mxConstraintHandler.prototype.getTolerance = function(me) {
                var tol = originalGetTolerance ? originalGetTolerance.apply(this, arguments) : this.graph.getTolerance();
                var scale = (this.graph && this.graph.view) ? (this.graph.view.scale || 1) : 1;
                var currentPointSize = getScaledSize(CONFIG.pointImageSize, CONFIG.maxPointSize, scale, 3);
                return Math.max(tol, Math.ceil(currentPointSize / 2) + 2);
            };
        }

        var originalConnectImageSrc = null;
        if (typeof mxConnectionHandler !== 'undefined' && mxConnectionHandler.prototype) {
            var oldConnectImage = mxConnectionHandler.prototype.connectImage;
            if (oldConnectImage) {
                originalConnectImageSrc = oldConnectImage.src;
            }
        }

        // --- ズーム連動処理 ---

        var updateSizes = function() {
            var scale = (graph && graph.view) ? (graph.view.scale || 1) : 1;

            // 各種ハンドルのサイズをズーム倍率に合わせて動的変更
            if (typeof mxConstants !== 'undefined') {
                mxConstants.HANDLE_SIZE = getScaledSize(CONFIG.handleSize, CONFIG.maxHandleSize, scale, 4);
                mxConstants.LABEL_HANDLE_SIZE = getScaledSize(CONFIG.labelHandleSize, CONFIG.maxHandleSize, scale, 4);
                mxConstants.CONNECT_HANDLE_SIZE = getScaledSize(CONFIG.connectHandleSize, CONFIG.maxHandleSize, scale, 4);
            }

            // 接続ポイントのサイズをズーム倍率に合わせて動的変更
            var currentPointSize = getScaledSize(CONFIG.pointImageSize, CONFIG.maxPointSize, scale, 3);
            if (typeof mxConstraintHandler !== 'undefined' && mxConstraintHandler.prototype && originalPointImageSrc) {
                mxConstraintHandler.prototype.pointImage = new mxImage(originalPointImageSrc, currentPointSize, currentPointSize);
            }
            if (typeof mxConnectionHandler !== 'undefined' && mxConnectionHandler.prototype && originalConnectImageSrc) {
                mxConnectionHandler.prototype.connectImage = new mxImage(originalConnectImageSrc, currentPointSize, currentPointSize);
            }

            // 選択中セルの表示ハンドラをリフレッシュ
            if (graph && graph.selectionCellsHandler && typeof graph.selectionCellsHandler.refresh === 'function') {
                graph.selectionCellsHandler.refresh();
            }
        };

        // 初期実行
        updateSizes();

        // ズームイベントリスナーの登録
        if (graph && graph.view) {
            graph.view.addListener(mxEvent.SCALE, updateSizes);
            graph.view.addListener(mxEvent.SCALE_AND_TRANSLATE, updateSizes);
        }

        log('loaded (handleSize=' + CONFIG.handleSize + ', pointSize=' + CONFIG.pointImageSize + ', dynamicZoom=true)');
    });
})();
