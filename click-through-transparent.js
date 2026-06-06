/**
 * draw.io Click Through Transparent Plugin
 * 
 * 塗りつぶしのないオブジェクト（透明なオブジェクト）の内部をクリックした際、
 * イベントを透過させて背面にある別のオブジェクトを選択できるようにします。
 * 枠線（境界線）やテキストラベルをクリックした場合は、通常通りそのオブジェクトが選択されます。
 */
(function() {
    Draw.loadPlugin(function(ui) {
        var graph = ui.editor.graph;
        
        var originalGetCellAt = graph.getCellAt;
        graph.getCellAt = function(x, y, parent, vertices, edges, ignoreFn) {
            var self = this;
            
            var customIgnoreFn = function(cell) {
                // 元の ignoreFn が指定されている場合はまずそれを適用
                if (ignoreFn && ignoreFn(cell)) {
                    return true;
                }
                
                // 頂点かつ、選択可能なセルの場合のみ透過判定を行う
                if (self.model.isVertex(cell)) {
                    var state = self.view.getState(cell);
                    if (state != null) {
                        var style = state.style || {};
                        var fillColor = style['fillColor'];
                        
                        // 塗りつぶしが設定されていない（none、または値が存在しない）
                        var isTransparent = (!fillColor || fillColor === 'none');
                        
                        // テキストシェイプやラベルシェイプは透過させない
                        var shape = style['shape'];
                        var isTextOrLabel = (shape === 'text' || shape === 'label');
                        
                        if (isTransparent && !isTextOrLabel) {
                            var scale = self.view.scale;
                            var translate = self.view.translate;
                            var screenX = (x + translate.x) * scale;
                            var screenY = (y + translate.y) * scale;
                            
                            // 1. ラベル（テキスト）領域のクリック判定
                            // ラベル領域をクリックした場合は、透過させずに選択可能にする
                            if (state.labelBounds != null &&
                                screenX >= state.labelBounds.x &&
                                screenX <= state.labelBounds.x + state.labelBounds.width &&
                                screenY >= state.labelBounds.y &&
                                screenY <= state.labelBounds.y + state.labelBounds.height) {
                                return false;
                            }
                            
                            // 2. 境界線（枠線）のクリック判定
                            // 枠線の周りに一定の許容誤差（tolerance）を持たせ、その範囲内であれば選択可能にする
                            var strokeWidth = parseFloat(style['strokeWidth'] || 1) * scale;
                            var tol = Math.max(8, strokeWidth + 4); // クリック判定の許容範囲（ピクセル）
                            
                            var rx = state.x;
                            var ry = state.y;
                            var rw = state.width;
                            var rh = state.height;
                            
                            var dx1 = Math.abs(screenX - rx);
                            var dx2 = Math.abs(screenX - (rx + rw));
                            var dy1 = Math.abs(screenY - ry);
                            var dy2 = Math.abs(screenY - (ry + rh));
                            
                            var minDist = Math.min(dx1, dx2, dy1, dy2);
                            var isOnBorder = (minDist <= tol);
                            
                            // 境界線上でなければ、このセルを無視（透過）して背面を探索する
                            if (!isOnBorder) {
                                return true;
                            }
                        }
                    }
                }
                return false;
            };
            
            return originalGetCellAt.call(this, x, y, parent, vertices, edges, customIgnoreFn);
        };
        
        console.log('click-through-transparent: loaded');
    });
})();
