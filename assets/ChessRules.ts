import { Vec2, Node } from 'cc';

export class ChessRules {
    static isInBoard(c: number, r: number): boolean {
        return c >= 0 && c <= 8 && r >= 0 && r <= 9;
    }

    static getValidMoves(col: number, row: number, id: number, boardState: (Node | null)[][]): Vec2[] {
        let moves: Vec2[] = [];

        switch (id) {
            case 12: case 13: // XE
                moves = this.getRookMoves(col, row, boardState);
                break;
            case 2: case 3:   // PHÁO
                moves = this.getCannonMoves(col, row, boardState);
                break;
            case 0: case 1:   // MÃ
                moves = this.getKnightMoves(col, row, boardState);
                break;
            case 10: case 11: // TƯỢNG
                moves = this.getElephantMoves(col, row, id, boardState);
                break;
            case 4: case 5:   // SĨ
                moves = this.getAdvisorMoves(col, row, id, boardState);
                break;
            case 8: case 9:   // TƯỚNG
                moves = this.getKingMoves(col, row, id, boardState);
                break;
            case 6: case 7:   // TỐT
                moves = this.getPawnMoves(col, row, id, boardState);
                break;
        }

        const team = id % 2;
        return moves.filter(m => {
            if (!this.isInBoard(m.x, m.y)) return false;
            const target = boardState[m.x][m.y];
            if (target === null) return true;
            const targetId = (target as any).chessId;
            return (targetId % 2) !== team;
        });
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