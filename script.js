let board = null;
let game = new Chess();
let stockfish = new Worker('stockfish.js');
let playerColor = 'white';
let isHintRequest = false; // Phân biệt Stockfish đang tính toán để đi hay để gợi ý nước đi

const $status = $('#status');
const $difficulty = $('#difficulty');

// Cấu hình bàn cờ ban đầu
const config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
};
board = Chessboard('myBoard', config);

// Xóa màu các ô đang được highlight gợi ý cũ
function removeHighlights() {
    $('#myBoard .square-55d63').removeClass('highlight-hint');
}

// Đổ màu vàng lên ô cờ đi và ô cờ đến để người chơi dễ nhìn
function highlightSquares(from, to) {
    removeHighlights();
    $('#myBoard .square-' + from).addClass('highlight-hint');
    $('#myBoard .square-' + to).addClass('highlight-hint');
}

// Ngăn cản di chuyển quân cờ nếu game kết thúc hoặc sai lượt màu cờ đã chọn
function onDragStart(source, piece, position, orientation) {
    if (game.game_over()) return false;

    if ((playerColor === 'white' && piece.search(/^b/) !== -1) ||
        (playerColor === 'black' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

// Xử lý khi người dùng thả quân cờ xuống ô mới
function onDrop(source, target) {
    let move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Mặc định phong Hậu khi tốt xuống đáy
    });

    if (move === null) return 'snapback';

    removeHighlights(); // Xóa màu ô gợi ý ngay khi người chơi thực hiện nước đi mới
    updateStatus();
    
    // Kích hoạt bot Stockfish phản đòn sau 250ms
    window.setTimeout(makeEngineMove, 250);
}

function onSnapEnd() {
    board.position(game.fen());
}

// Gửi tín hiệu yêu cầu Stockfish tính toán nước đi cho BOT
function makeEngineMove() {
    if (game.game_over()) return;

    isHintRequest = false; 
    $status.html('Stockfish đang suy nghĩ...');
    
    stockfish.postMessage('position fen ' + game.fen());
    let depth = $difficulty.val();
    stockfish.postMessage('go depth ' + depth);
}

// Lắng nghe phản hồi trả về từ file Stockfish Worker ngầm
stockfish.onmessage = function(event) {
    let line = event.data;
    if (line.indexOf('bestmove') > -1) {
        let match = line.match(/^bestmove\s([a-h][1-8])([a-h][1-8])([qrbn])?/);
        if (match) {
            let fromSquare = match[1];
            let toSquare = match[2];
            let promotionPiece = match[3];

            if (isHintRequest) {
                // NẾU LÀ GỢI Ý: Hiện chữ hướng dẫn và highlight ô, không tự ý di chuyển quân của người chơi
                $status.html(`💡 Gợi ý: Di chuyển quân từ <b>${fromSquare.toUpperCase()}</b> đến <b>${toSquare.toUpperCase()}</b>`);
                highlightSquares(fromSquare, toSquare);
                isHintRequest = false;
            } else {
                // NẾU LÀ BOT ĐI THẬT: Thực hiện di chuyển quân trên bàn cờ
                game.move({
                    from: fromSquare,
                    to: toSquare,
                    promotion: promotionPiece
                });
                board.position(game.fen());
                updateStatus();
            }
        }
    }
};

// Cập nhật dòng trạng thái thông báo
function updateStatus() {
    let status = '';
    let moveColor = game.turn() === 'b' ? 'Đen' : 'Trắng';

    if (game.in_checkmate()) {
        status = 'Trò chơi kết thúc! ' + (game.turn() === 'w' ? 'Đen' : 'Trắng') + ' thắng (Checkmate).';
    } else if (game.in_draw()) {
        status = 'Trò chơi kết thúc! Hòa cờ.';
    } else {
        status = 'Lượt đi: ' + moveColor;
        if (game.in_check()) {
            status += ' (Đang bị Chiếu!)';
        }
    }
    $status.html(status);
}

// XỬ LÝ SỰ KIỆN NÚT GỢI Ý (HINT)
$('#hintBtn').on('click', () => {
    if (game.game_over()) return;
    
    // Kiểm tra xem có đúng lượt của người chơi không
    let isWhiteTurn = game.turn() === 'w';
    if ((playerColor === 'white' && !isWhiteTurn) || (playerColor === 'black' && isWhiteTurn)) {
        $status.html('Chờ bot đi xong lượt đã nhé!');
        return;
    }

    $status.html('Đang tìm nước đi tối ưu nhất cho bạn...');
    isHintRequest = true; 
    
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth 10'); // Gợi ý nhanh ở depth 10 để đỡ phải đợi lâu
});

// Nút chơi lại
$('#restartBtn').on('click', () => {
    removeHighlights();
    game.reset();
    board.start();
    if (playerColor === 'black') {
        board.flip();
        makeEngineMove();
    }
    updateStatus();
});

// Nút đổi bên
$('#flipBtn').on('click', () => {
    removeHighlights();
    playerColor = playerColor === 'white' ? 'black' : 'white';
    board.flip();
    game.reset();
    board.start();
    if (playerColor === 'black') {
        makeEngineMove();
    }
    updateStatus();
});
