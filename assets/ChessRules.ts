import { Vec2, Node } from 'cc';

/** Node của quân cờ kèm dữ liệu game. */
export type ChessNode = Node & { chessId: number; col: number; row: number };

type Board = (Node | null)[][];

export class ChessRules {
    static isInBoard(c: number, r: number): boolean {
        return c >= 0 && c <= 8 && r >= 0 && r <= 9;
    }

    /**
     * Pseudo-legal moves: chỉ lọc theo biên bàn cờ và quân cùng phe.
     * KHÔNG kiểm tra việc Tướng bị chiếu hay 2 Tướng đối mặt.
     */
    static getPseudoMoves(col: number, row: number, id: number, boardState: Board): Vec2[] {
        let moves: Vec2[] = [];

        switch (id) {
            case 12: case 13: moves = this.getRookMoves(col, row, boardState); break;       // XE
            case 2: case 3: moves = this.getCannonMoves(col, row, boardState); break;     // PHÁO
            case 0: case 1: moves = this.getKnightMoves(col, row, boardState); break;     // MÃ
            case 10: case 11: moves = this.getElephantMoves(col, row, id, boardState); break; // TƯỢNG
            case 4: case 5: moves = this.getAdvisorMoves(col, row, id, boardState); break;  // SĨ
            case 8: case 9: moves = this.getKingMoves(col, row, id, boardState); break;     // TƯỚNG
            case 6: case 7: moves = this.getPawnMoves(col, row, id, boardState); break;     // TỐT
        }

        const team = id % 2;
        return moves.filter(m => {
            if (!this.isInBoard(m.x, m.y)) return false;
            const target = boardState[m.x][m.y] as ChessNode | null;
            if (target === null) return true;
            return (target.chessId % 2) !== team;
        });
    }

    /**
     * Legal moves: lọc tiếp các nước khiến Tướng nhà bị chiếu
     * hoặc khiến hai Tướng đối mặt nhau.
     */
    static getValidMoves(col: number, row: number, id: number, boardState: Board): Vec2[] {
        const team = id % 2;
        return this.getPseudoMoves(col, row, id, boardState)
            .filter(m => this.isMoveLegal(col, row, m.x, m.y, team, boardState));
    }

    private static isMoveLegal(
        fc: number, fr: number, tc: number, tr: number,
        team: number, boardState: Board
    ): boolean {
        const piece = boardState[fc][fr] as ChessNode | null;
        if (!piece) return false;
        const captured = boardState[tc][tr];
        const oldCol = piece.col, oldRow = piece.row;

        // Mô phỏng nước đi
        boardState[fc][fr] = null;
        boardState[tc][tr] = piece;
        piece.col = tc; piece.row = tr;

        let legal = true;
        const kingPos = this.findKing(team, boardState);
        if (!kingPos) {
            legal = false;
        } else if (this.isSquareAttacked(kingPos.x, kingPos.y, 1 - team, boardState)) {
            legal = false;
        } else if (this.areKingsFacing(boardState)) {
            legal = false;
        }

        // Hoàn tác
        boardState[fc][fr] = piece;
        boardState[tc][tr] = captured;
        piece.col = oldCol; piece.row = oldRow;

        return legal;
    }

    /** Tìm vị trí Tướng của một phe. team 0 = đen (id 8), team 1 = đỏ (id 9). */
    static findKing(team: number, boardState: Board): Vec2 | null {
        const kingId = team === 0 ? 8 : 9;
        for (let c = 0; c < 9; c++) {
            for (let r = 0; r < 10; r++) {
                const p = boardState[c][r] as ChessNode | null;
                if (p && p.chessId === kingId) return new Vec2(c, r);
            }
        }
        return null;
    }

    /** Hai Tướng cùng cột và không có quân nào chắn ở giữa. */
    static areKingsFacing(boardState: Board): boolean {
        const k0 = this.findKing(0, boardState);
        const k1 = this.findKing(1, boardState);
        if (!k0 || !k1) return false;
        if (k0.x !== k1.x) return false;
        const minR = Math.min(k0.y, k1.y), maxR = Math.max(k0.y, k1.y);
        for (let r = minR + 1; r < maxR; r++) {
            if (boardState[k0.x][r] !== null) return false;
        }
        return true;
    }

    /** Ô (col,row) có bị phe `byTeam` tấn công không (dùng pseudo-moves). */
    static isSquareAttacked(col: number, row: number, byTeam: number, boardState: Board): boolean {
        for (let c = 0; c < 9; c++) {
            for (let r = 0; r < 10; r++) {
                const p = boardState[c][r] as ChessNode | null;
                if (!p || p.chessId % 2 !== byTeam) continue;
                const moves = this.getPseudoMoves(c, r, p.chessId, boardState);
                if (moves.some(m => m.x === col && m.y === row)) return true;
            }
        }
        return false;
    }

    static isInCheck(team: number, boardState: Board): boolean {
        const k = this.findKing(team, boardState);
        if (!k) return false;
        return this.isSquareAttacked(k.x, k.y, 1 - team, boardState);
    }

    /** Phe `team` còn ít nhất 1 nước đi hợp lệ. */
    static hasAnyLegalMove(team: number, boardState: Board): boolean {
        for (let c = 0; c < 9; c++) {
            for (let r = 0; r < 10; r++) {
                const p = boardState[c][r] as ChessNode | null;
                if (!p || p.chessId % 2 !== team) continue;
                if (this.getValidMoves(c, r, p.chessId, boardState).length > 0) return true;
            }
        }
        return false;
    }

    // --- LOGIC CHI TIẾT CÁC QUÂN ---

    private static getRookMoves(c: number, r: number, boardState: any[][]): Vec2[] {
        let moves: Vec2[] = [];
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let d of directions) {
            let nc = c + d[0], nr = r + d[1];
            while (this.isInBoard(nc, nr)) {
                moves.push(new Vec2(nc, nr));
                if (boardState[nc][nr] !== null) break;
                nc += d[0]; nr += d[1];
            }
        }
        return moves;
    }

    private static getCannonMoves(c: number, r: number, boardState: any[][]): Vec2[] {
        let moves: Vec2[] = [];
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let d of directions) {
            let nc = c + d[0], nr = r + d[1], hasJumper = false;
            while (this.isInBoard(nc, nr)) {
                if (!hasJumper) {
                    if (boardState[nc][nr] === null) moves.push(new Vec2(nc, nr));
                    else hasJumper = true;
                } else if (boardState[nc][nr] !== null) {
                    moves.push(new Vec2(nc, nr));
                    break;
                }
                nc += d[0]; nr += d[1];
            }
        }
        return moves;
    }

    private static getKnightMoves(c: number, r: number, boardState: any[][]): Vec2[] {
        let moves: Vec2[] = [];
        const steps = [[2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0], [1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1]];
        for (let s of steps) {
            let nc = c + s[0], nr = r + s[1], kc = c + s[2], kr = r + s[3];
            if (this.isInBoard(nc, nr) && boardState[kc][kr] === null) moves.push(new Vec2(nc, nr));
        }
        return moves;
    }

    private static getElephantMoves(c: number, r: number, id: number, boardState: any[][]): Vec2[] {
        let moves: Vec2[] = [];
        const directions = [[2, 2, 1, 1], [2, -2, 1, -1], [-2, 2, -1, 1], [-2, -2, -1, -1]];
        for (let d of directions) {
            let nc = c + d[0], nr = r + d[1], kc = c + d[2], kr = r + d[3];
            if (this.isInBoard(nc, nr) && boardState[kc][kr] === null) {
                if ((id === 10 && nr <= 4) || (id === 11 && nr >= 5)) moves.push(new Vec2(nc, nr)); // Không qua sông
            }
        }
        return moves;
    }

    private static getAdvisorMoves(c: number, r: number, id: number, boardState: any[][]): Vec2[] {
        let moves: Vec2[] = [];
        const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (let d of directions) {
            let nc = c + d[0], nr = r + d[1];
            if (nc >= 3 && nc <= 5 && ((id === 4 && nr <= 2) || (id === 5 && nr >= 7))) moves.push(new Vec2(nc, nr));
        }
        return moves;
    }

    private static getKingMoves(c: number, r: number, id: number, boardState: any[][]): Vec2[] {
        let moves: Vec2[] = [];
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let d of directions) {
            let nc = c + d[0], nr = r + d[1];
            if (nc >= 3 && nc <= 5 && ((id === 8 && nr <= 2) || (id === 9 && nr >= 7))) moves.push(new Vec2(nc, nr));
        }
        return moves;
    }

    private static getPawnMoves(c: number, r: number, id: number, boardState: any[][]): Vec2[] {
        let moves: Vec2[] = [];
        if (id === 6) { // Tốt đen
            moves.push(new Vec2(c, r + 1));
            if (r > 4) { moves.push(new Vec2(c + 1, r)); moves.push(new Vec2(c - 1, r)); }
        } else { // Tốt đỏ
            moves.push(new Vec2(c, r - 1));
            if (r < 5) { moves.push(new Vec2(c + 1, r)); moves.push(new Vec2(c - 1, r)); }
        }
        return moves.filter(m => this.isInBoard(m.x, m.y));
    }
}