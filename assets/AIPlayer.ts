import { Node, Vec2 } from 'cc';
import { ChessNode, ChessRules } from './ChessRules';

export enum AIDifficulty {
    Easy = 0,
    Medium = 1,
    Hard = 2
}

type Board = (Node | null)[][];

export interface AIMove {
    from: Vec2;
    to: Vec2;
    piece: ChessNode;
}

export class AIPlayer {
    private static readonly HARD_DEPTH = 2;
    private static readonly MAX_ROOT_MOVES = 24;
    private static readonly MAX_BRANCH_MOVES = 16;

    private static readonly PIECE_VALUES: { [key: number]: number } = {
        0: 40,    // Mã đen
        1: 40,    // Mã đỏ
        2: 45,    // Pháo đen
        3: 45,    // Pháo đỏ
        4: 20,    // Sĩ đen
        5: 20,    // Sĩ đỏ
        6: 10,    // Tốt đen
        7: 10,    // Tốt đỏ
        8: 10000, // Tướng đen
        9: 10000, // Tướng đỏ
        10: 20,   // Tượng đen
        11: 20,   // Tượng đỏ
        12: 90,   // Xe đen
        13: 90    // Xe đỏ
    };

    private static readonly POSITION_BONUS: { [key: number]: number[][] } = {
        6: [ // Tốt đen
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 1],
            [2, 2, 2, 2, 2, 2, 2, 2, 2],
            [3, 3, 3, 3, 3, 3, 3, 3, 3],
            [4, 4, 4, 4, 4, 4, 4, 4, 4],
            [5, 5, 5, 5, 5, 5, 5, 5, 5],
            [6, 6, 6, 6, 6, 6, 6, 6, 6],
            [7, 7, 7, 7, 7, 7, 7, 7, 7],
            [8, 8, 8, 8, 8, 8, 8, 8, 8],
            [9, 9, 9, 9, 9, 9, 9, 9, 9]
        ],
        7: [ // Tốt đỏ
            [9, 9, 9, 9, 9, 9, 9, 9, 9],
            [8, 8, 8, 8, 8, 8, 8, 8, 8],
            [7, 7, 7, 7, 7, 7, 7, 7, 7],
            [6, 6, 6, 6, 6, 6, 6, 6, 6],
            [5, 5, 5, 5, 5, 5, 5, 5, 5],
            [4, 4, 4, 4, 4, 4, 4, 4, 4],
            [3, 3, 3, 3, 3, 3, 3, 3, 3],
            [2, 2, 2, 2, 2, 2, 2, 2, 2],
            [1, 1, 1, 1, 1, 1, 1, 1, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ],
        0: [ // Mã đen - ưu tiên vị trí trung tâm
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 2, 2, 2, 2, 2, 1, 0],
            [0, 2, 3, 4, 4, 4, 3, 2, 0],
            [0, 2, 4, 5, 5, 5, 4, 2, 0],
            [0, 2, 4, 5, 5, 5, 4, 2, 0],
            [0, 2, 4, 5, 5, 5, 4, 2, 0],
            [0, 2, 4, 5, 5, 5, 4, 2, 0],
            [0, 2, 3, 4, 4, 4, 3, 2, 0],
            [0, 1, 2, 2, 2, 2, 2, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ],
        1: [ // Mã đỏ
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 2, 2, 2, 2, 2, 1, 0],
            [0, 2, 3, 4, 4, 4, 3, 2, 0],
            [0, 2, 4, 5, 5, 5, 4, 2, 0],
            [0, 2, 4, 5, 5, 5, 4, 2, 0],
            [0, 2, 4, 5, 5, 5, 4, 2, 0],
            [0, 2, 4, 5, 5, 5, 4, 2, 0],
            [0, 2, 3, 4, 4, 4, 3, 2, 0],
            [0, 1, 2, 2, 2, 2, 2, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ],
        2: [ // Pháo đen - ưu tiên trung tâm và đường đi
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 1, 2, 2, 2, 2, 2, 1, 0],
            [0, 1, 2, 3, 3, 3, 2, 1, 0],
            [0, 1, 2, 3, 4, 3, 2, 1, 0],
            [0, 1, 2, 3, 4, 3, 2, 1, 0],
            [0, 1, 2, 3, 3, 3, 2, 1, 0],
            [0, 1, 2, 2, 2, 2, 2, 1, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ],
        3: [ // Pháo đỏ
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 1, 2, 2, 2, 2, 2, 1, 0],
            [0, 1, 2, 3, 3, 3, 2, 1, 0],
            [0, 1, 2, 3, 4, 3, 2, 1, 0],
            [0, 1, 2, 3, 4, 3, 2, 1, 0],
            [0, 1, 2, 3, 3, 3, 2, 1, 0],
            [0, 1, 2, 2, 2, 2, 2, 1, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ],
        12: [ // Xe đen - ưu tiên cột trung tâm
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 2, 1, 0, 0, 0],
            [0, 0, 1, 2, 3, 2, 1, 0, 0],
            [0, 0, 1, 2, 3, 2, 1, 0, 0],
            [0, 0, 1, 2, 3, 2, 1, 0, 0],
            [0, 0, 1, 2, 3, 2, 1, 0, 0],
            [0, 0, 1, 2, 3, 2, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ],
        13: [ // Xe đỏ
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 2, 3, 2, 1, 0, 0],
            [0, 0, 1, 2, 3, 2, 1, 0, 0],
            [0, 0, 1, 2, 3, 2, 1, 0, 0],
            [0, 0, 1, 2, 3, 2, 1, 0, 0],
            [0, 0, 1, 2, 3, 2, 1, 0, 0],
            [0, 0, 0, 1, 2, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]
    };

    static getBestMove(boardState: Board, team: number, difficulty: AIDifficulty): AIMove | null {
        const allMoves = this.getAllMoves(boardState, team);

        if (allMoves.length === 0) return null;

        switch (difficulty) {
            case AIDifficulty.Easy:
                return this.getRandomMove(allMoves);
            case AIDifficulty.Medium:
                return this.getMediumMove(boardState, team, allMoves);
            case AIDifficulty.Hard:
                return this.getHardMove(boardState, team, allMoves, this.HARD_DEPTH);
            default:
                return this.getRandomMove(allMoves);
        }
    }

    private static getAllMoves(boardState: Board, team: number): AIMove[] {
        const moves: AIMove[] = [];

        for (let c = 0; c < 9; c++) {
            for (let r = 0; r < 10; r++) {
                const piece = boardState[c][r] as ChessNode | null;
                if (!piece || piece.chessId % 2 !== team) continue;

                const validMoves = ChessRules.getValidMoves(c, r, piece.chessId, boardState);
                for (const move of validMoves) {
                    moves.push({
                        from: new Vec2(c, r),
                        to: move,
                        piece: piece
                    });
                }
            }
        }

        return moves;
    }

    private static getRandomMove(moves: AIMove[]): AIMove | null {
        if (moves.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * moves.length);
        return moves[randomIndex];
    }

    private static getMediumMove(boardState: Board, team: number, moves: AIMove[]): AIMove | null {
        let bestMove: AIMove | null = null;
        let bestScore = -Infinity;

        const orderedMoves = this.orderMoves(boardState, team, moves, true);
        for (const move of orderedMoves) {
            const score = this.evaluateMove(boardState, team, move);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    private static getHardMove(boardState: Board, team: number, moves: AIMove[], depth: number): AIMove | null {
        let bestMove: AIMove | null = null;
        let bestScore = -Infinity;
        let alpha = -Infinity;
        const orderedMoves = this.orderMoves(boardState, team, moves, true).slice(0, this.MAX_ROOT_MOVES);

        for (const move of orderedMoves) {
            const nextBoard = this.applyMove(boardState, move);
            const score = this.minimax(nextBoard, team, depth - 1, alpha, Infinity, false);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
            alpha = Math.max(alpha, bestScore);
        }

        return bestMove;
    }

    private static evaluateMove(boardState: Board, team: number, move: AIMove): number {
        return this.evaluateBoard(this.applyMove(boardState, move), team, true);
    }

    private static minimax(boardState: Board, team: number, depth: number, alpha: number, beta: number, isMaximizing: boolean): number {
        if (depth === 0) {
            return this.evaluateBoard(boardState, team, false);
        }

        const currentTeam = isMaximizing ? team : (1 - team);
        const allMoves = this.getAllMoves(boardState, currentTeam);

        if (allMoves.length === 0) {
            if (ChessRules.isInCheck(currentTeam, boardState)) {
                return isMaximizing ? -100000 : 100000;
            }
            return 0;
        }

        const orderedMoves = this.orderMoves(boardState, team, allMoves, isMaximizing).slice(0, this.MAX_BRANCH_MOVES);

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const m of orderedMoves) {
                const evalScore = this.minimax(this.applyMove(boardState, m), team, depth - 1, alpha, beta, false);
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const m of orderedMoves) {
                const evalScore = this.minimax(this.applyMove(boardState, m), team, depth - 1, alpha, beta, true);
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    private static evaluateBoard(boardState: Board, team: number, includeMobility: boolean): number {
        let score = 0;
        let myMobility = 0;
        let opponentMobility = 0;

        for (let c = 0; c < 9; c++) {
            for (let r = 0; r < 10; r++) {
                const piece = boardState[c][r] as ChessNode | null;
                if (!piece) continue;

                const pieceTeam = piece.chessId % 2;
                const pieceValue = this.PIECE_VALUES[piece.chessId] || 0;

                if (pieceTeam === team) {
                    score += pieceValue;
                } else {
                    score -= pieceValue;
                }

                if (this.POSITION_BONUS[piece.chessId]) {
                    const positionBonus = this.POSITION_BONUS[piece.chessId][r][c];
                    if (pieceTeam === team) {
                        score += positionBonus;
                    } else {
                        score -= positionBonus;
                    }
                }

                const centerX = 4;
                const centerY = 4.5;
                const distFromCenter = Math.abs(c - centerX) + Math.abs(r - centerY);
                const centerBonus = (10 - distFromCenter) * 1;
                if (pieceTeam === team) {
                    score += centerBonus;
                } else {
                    score -= centerBonus;
                }

                if (includeMobility) {
                    const moves = ChessRules.getPseudoMoves(c, r, piece.chessId, boardState);
                    if (pieceTeam === team) {
                        myMobility += moves.length;
                    } else {
                        opponentMobility += moves.length;
                    }
                }
            }
        }

        if (includeMobility) {
            score += (myMobility - opponentMobility) * 2;
        }

        const opponentTeam = 1 - team;
        if (ChessRules.isInCheck(opponentTeam, boardState)) {
            score += 150;
        }
        if (ChessRules.isInCheck(team, boardState)) {
            score -= 150;
        }

        return score;
    }

    private static orderMoves(boardState: Board, team: number, moves: AIMove[], isMaximizing: boolean): AIMove[] {
        return moves
            .slice()
            .sort((a, b) => {
                const scoreA = this.getMoveOrderingScore(boardState, team, a);
                const scoreB = this.getMoveOrderingScore(boardState, team, b);
                return isMaximizing ? scoreB - scoreA : scoreA - scoreB;
            });
    }

    private static getMoveOrderingScore(boardState: Board, team: number, move: AIMove): number {
        const movingTeam = move.piece.chessId % 2;
        let score = 0;
        const target = boardState[move.to.x][move.to.y] as ChessNode | null;

        if (target) {
            const captureScore = (this.PIECE_VALUES[target.chessId] || 0) * 10 - (this.PIECE_VALUES[move.piece.chessId] || 0);
            score += movingTeam === team ? captureScore : -captureScore;
        }

        const positionDelta = this.getPositionBonus(move.piece.chessId, move.to.x, move.to.y)
            - this.getPositionBonus(move.piece.chessId, move.from.x, move.from.y);
        score += movingTeam === team ? positionDelta : -positionDelta;

        return score;
    }

    private static getPositionBonus(chessId: number, col: number, row: number): number {
        return this.POSITION_BONUS[chessId]?.[row]?.[col] || 0;
    }

    private static applyMove(boardState: Board, move: AIMove): Board {
        const clonedBoard = this.cloneBoard(boardState);
        clonedBoard[move.from.x][move.from.y] = null;
        clonedBoard[move.to.x][move.to.y] = move.piece;
        return clonedBoard;
    }

    private static cloneBoard(boardState: Board): Board {
        const cloned: Board = [];
        for (let c = 0; c < 9; c++) {
            cloned[c] = [];
            for (let r = 0; r < 10; r++) {
                cloned[c][r] = boardState[c][r];
            }
        }
        return cloned;
    }
}
