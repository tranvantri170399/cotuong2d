import {
    _decorator,
    AudioClip, AudioSource,
    Color,
    Component,
    Graphics,
    instantiate,
    Label,
    Node, Prefab,
    Size,
    Sprite,
    SpriteFrame,
    tween,
    UITransform,
    Vec2,
    Vec3,
    view
} from 'cc';
import { AIPlayer } from './AIPlayer';
import { CannonAttackEffect2D } from './CannonAttackEffect2D';
import { ChariotAttackEffect2D } from './ChariotAttackEffect2D';
import { ChessNode, ChessRules } from './ChessRules';
import { HorseAttackEffect2D } from './HorseAttackEffect2D';
const { ccclass, property } = _decorator;

enum AIDifficulty {
    Easy = 0,
    Medium = 1,
    Hard = 2
}

interface MoveRecord {
    piece: ChessNode;
    fromCol: number;
    fromRow: number;
    toCol: number;
    toRow: number;
    capturedPiece: ChessNode | null;
    capturedChessId: number | null;
    wasGameOver: boolean;
}

const TEAM_BLACK = 0;
const TEAM_RED = 1;
const PIECE_NAME = 'ChessPiece';
const HINT_NAME = 'HintNode';
const GAMEOVER_NAME = 'GameOverPanel';

@ccclass('GameLogic')
export class GameLogic extends Component {
    @property(Prefab) public chessPrefab: Prefab = null;
    @property(Prefab) public hintPrefab: Prefab = null;
    @property([SpriteFrame]) public pieceImages: SpriteFrame[] = [];

    // --- PHẦN ÂM THANH ---
    @property(AudioClip) public moveSound: AudioClip = null;    // Tiếng đi quân bình thường
    @property(AudioClip) public captureSound: AudioClip = null; // Tiếng ăn quân
    @property(AudioClip) public bgMusic: AudioClip = null;
    // ---------------------

    // --- HIỆU ỨNG ---
    @property(Prefab) public captureParticle: Prefab = null; // Particle khi ăn quân
    @property(Prefab) public cannonAttackEffectPrefab: Prefab = null; // Hiệu ứng pháo bắn đạn
    @property(Prefab) public horseAttackEffectPrefab: Prefab = null; // Hiệu ứng ngựa ăn quân
    @property(Prefab) public chariotAttackEffectPrefab: Prefab = null; // Hiệu ứng xe ăn quân
    @property(Node) public effectLayer: Node = null; // Layer để hiển thị hiệu ứng
    // ----------------

    @property public cellWidth: number = 71.640625;
    @property public cellHeight: number = 73.63064236111111;
    @property public offsetX: number = -0.3385;
    @property public offsetY: number = 0.361328125;

    private selectedPiece: ChessNode = null;
    private boardState: (Node | null)[][] = [];
    private audioSource: AudioSource = null; // Dùng cho SFX (hiệu ứng)
    private bgSource: AudioSource = null;    // Dùng riêng cho nhạc nền

    // --- CAPTURED PIECE FOR UNDO ---
    private lastCapturedPiece: ChessNode | null = null;
    private lastCapturedChessId: number | null = null;

    // --- LƯỢT ĐI / TRẠNG THÁI ---
    private currentTurn: number = TEAM_RED; // Cờ Tướng: Đỏ đi trước
    private gameOver: boolean = false;
    private gameOverNode: Node = null;

    // --- HIỆU ỨNG SÔNG ---
    private riverTile1: Node = null;
    private riverTile2: Node = null;
    private riverLoopWidth: number = 0;
    private riverScrollSpeed: number = 40;
    private riverStartPos: Vec3 = null;
    private riverOffset: number = 0;

    // --- HUD ---
    private turnLabelNode: Node = null;
    private checkLabelNode: Node = null;
    private restartBtnNode: Node = null;
    private undoBtnNode: Node = null;

    // --- MOVE HISTORY ---
    private moveHistory: MoveRecord[] = [];

    // --- AI ---
    public aiDifficulty: number = 1; // 0: Easy, 1: Medium, 2: Hard
    public aiEnabled: boolean = true;
    private aiThinking: boolean = false;

    start() {
        // Khởi tạo Loa cho hiệu ứng (SFX)
        this.audioSource = this.getComponent(AudioSource);
        if (!this.audioSource) this.audioSource = this.addComponent(AudioSource);

        // Khởi tạo Loa riêng cho nhạc nền (BGM)
        this.bgSource = this.node.addComponent(AudioSource);

        // Cấu hình và phát nhạc nền
        if (this.bgMusic) {
            this.bgSource.clip = this.bgMusic;
            this.bgSource.loop = true;
            this.bgSource.volume = 0.3; // Nhạc nền nhỏ để không át tiếng quân cờ
            this.bgSource.play();
        }

        // Hiển thị menu chọn cấp độ khó
        this.showDifficultyMenu();
    }

    private showDifficultyMenu() {
        const menuNode = new Node('DifficultyMenu');
        menuNode.layer = this.node.layer;
        menuNode.parent = this.node;

        const ui = menuNode.addComponent(UITransform);
        const size = view.getVisibleSize();
        ui.setContentSize(size.width, size.height);

        // Nền mờ đen
        const bgNode = new Node('MenuBg');
        bgNode.layer = this.node.layer;
        bgNode.parent = menuNode;
        bgNode.addComponent(UITransform).setContentSize(size.width, size.height);
        const graphics = bgNode.addComponent(Graphics);
        graphics.fillColor = new Color(0, 0, 0, 200);
        graphics.rect(-size.width / 2, -size.height / 2, size.width, size.height);
        graphics.fill();
        bgNode.setPosition(0, 0, 200);

        // Label tiêu đề
        const titleLabel = new Node('TitleLabel');
        titleLabel.layer = this.node.layer;
        titleLabel.parent = menuNode;
        titleLabel.addComponent(UITransform).setContentSize(400, 80);
        const titleLbl = titleLabel.addComponent(Label);
        titleLbl.string = 'Chọn cấp độ khó';
        titleLbl.fontSize = 48;
        titleLbl.isBold = true;
        titleLbl.color = new Color(255, 215, 0);
        titleLbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLbl.verticalAlign = Label.VerticalAlign.CENTER;
        titleLabel.setPosition(0, 150, 201);

        // Nút Dễ
        this.createDifficultyButton(menuNode, 'Dễ', 0, 50, 201, () => {
            this.aiDifficulty = AIDifficulty.Easy;
            this.startGame(menuNode);
        });

        // Nút Thường
        this.createDifficultyButton(menuNode, 'Thường', 1, 0, 201, () => {
            this.aiDifficulty = AIDifficulty.Medium;
            this.startGame(menuNode);
        });

        // Nút Khó
        this.createDifficultyButton(menuNode, 'Khó', 2, -50, 201, () => {
            this.aiDifficulty = AIDifficulty.Hard;
            this.startGame(menuNode);
        });
    }

    private createDifficultyButton(parent: Node, text: string, index: number, yOffset: number, zOrder: number, callback: () => void) {
        const btnNode = new Node('DifficultyBtn_' + text);
        btnNode.layer = this.node.layer;
        btnNode.parent = parent;
        btnNode.addComponent(UITransform).setContentSize(200, 60);
        const lbl = btnNode.addComponent(Label);
        lbl.string = text;
        lbl.fontSize = 32;
        lbl.isBold = true;
        lbl.color = new Color(100, 200, 220);
        lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        lbl.verticalAlign = Label.VerticalAlign.CENTER;
        btnNode.setPosition(0, yOffset, zOrder);
        btnNode.on(Node.EventType.TOUCH_START, (e: any) => {
            e.propagationStopped = true;
            callback();
        }, this);
    }

    private startGame(menuNode: Node) {
        // Xóa menu
        menuNode.destroy();

        // Khởi tạo game
        this.initBoardArray();
        this.setupFullBoard();
        this.playRiverEffect();
        this.createHUD();

        this.node.on(Node.EventType.TOUCH_START, (event) => {
            if (this.gameOver) return;
            if (this.selectedPiece) {
                if (event.target === this.node || event.target.name === HINT_NAME) {
                    this.handleMove(event);
                }
            }
        }, this);
    }

    playRiverEffect() {
        const tile1 = this.node.getChildByName('River_Effect1');
        const tile2 = this.node.getChildByName('River_Effect2');

        if (!tile1 || !tile2) {
            console.error('Bạn chưa đặt đúng tên Node là River_Effect1 và River_Effect2');
            return;
        }

        const ui1 = tile1.getComponent(UITransform);
        const ui2 = tile2.getComponent(UITransform);

        if (!ui1 || !ui2) {
            console.error('River_Effect1 và River_Effect2 phải có UITransform');
            return;
        }

        // Dùng chiều rộng màn hình thực tế để river che được toàn bộ canvas
        const boardWidth = 1109.532;
        const riverY = this.offsetY; // Trung tâm giữa row 4 và row 5
        const riverZ = 0;

        // Bắt buộc sizeMode = CUSTOM để sprite giãn theo contentSize
        const sp1 = tile1.getComponent(Sprite);
        const sp2 = tile2.getComponent(Sprite);
        if (sp1) sp1.sizeMode = Sprite.SizeMode.CUSTOM;
        if (sp2) sp2.sizeMode = Sprite.SizeMode.CUSTOM;

        const startPos1 = new Vec3(0, riverY, riverZ);
        const startPos2 = new Vec3(boardWidth, riverY, riverZ);

        this.riverTile1 = tile1;
        this.riverTile2 = tile2;
        this.riverLoopWidth = boardWidth;
        this.riverStartPos = startPos1;
        this.riverOffset = 0;

        tile1.setPosition(startPos1);
        tile2.setPosition(startPos2);
    }

    update(deltaTime: number) {
        if (!this.riverTile1 || !this.riverTile2 || !this.riverStartPos || this.riverLoopWidth <= 0) {
            return;
        }

        this.riverOffset += this.riverScrollSpeed * deltaTime;
        if (this.riverOffset >= this.riverLoopWidth) {
            this.riverOffset %= this.riverLoopWidth;
        }

        const x1 = this.riverStartPos.x - this.riverOffset;
        const x2 = x1 + this.riverLoopWidth;

        this.riverTile1.setPosition(new Vec3(x1, this.riverStartPos.y, this.riverStartPos.z));
        this.riverTile2.setPosition(new Vec3(x2, this.riverStartPos.y, this.riverStartPos.z));
    }

    initBoardArray() {
        for (let i = 0; i < 9; i++) {
            this.boardState[i] = [];
            for (let j = 0; j < 10; j++) {
                this.boardState[i][j] = null;
            }
        }
    }

    setupFullBoard() {
        // Xóa các node quân cờ + gợi ý cũ (giữ nguyên hiệu ứng sông và background)
        this.node.children.slice().forEach(child => {
            if (child.name === PIECE_NAME || child.name === HINT_NAME || child.name === GAMEOVER_NAME) {
                child.destroy();
            }
        });

        // Reset toàn bộ trạng thái bàn cờ trước khi tạo lại quân
        this.initBoardArray();

        const layout = [
            { c: 0, r: 0, id: 12 }, { c: 1, r: 0, id: 0 }, { c: 2, r: 0, id: 10 }, { c: 3, r: 0, id: 4 }, { c: 4, r: 0, id: 8 }, { c: 5, r: 0, id: 4 }, { c: 6, r: 0, id: 10 }, { c: 7, r: 0, id: 0 }, { c: 8, r: 0, id: 12 },
            { c: 1, r: 2, id: 2 }, { c: 7, r: 2, id: 2 },
            { c: 0, r: 3, id: 6 }, { c: 2, r: 3, id: 6 }, { c: 4, r: 3, id: 6 }, { c: 6, r: 3, id: 6 }, { c: 8, r: 3, id: 6 },
            { c: 0, r: 9, id: 13 }, { c: 1, r: 9, id: 1 }, { c: 2, r: 9, id: 11 }, { c: 3, r: 9, id: 5 }, { c: 4, r: 9, id: 9 }, { c: 5, r: 9, id: 5 }, { c: 6, r: 9, id: 11 }, { c: 7, r: 9, id: 1 }, { c: 8, r: 9, id: 13 },
            { c: 1, r: 7, id: 3 }, { c: 7, r: 7, id: 3 },
            { c: 0, r: 6, id: 7 }, { c: 2, r: 6, id: 7 }, { c: 4, r: 6, id: 7 }, { c: 6, r: 6, id: 7 }, { c: 8, r: 6, id: 7 }
        ];
        layout.forEach(p => this.createPiece(p.c, p.r, p.id));
    }

    createPiece(col: number, row: number, imgIdx: number) {
        const piece = instantiate(this.chessPrefab) as ChessNode;
        piece.name = PIECE_NAME;
        piece.parent = this.node;
        piece.chessId = imgIdx;
        piece.col = col;
        piece.row = row;
        this.boardState[col][row] = piece;

        console.log(`[DEBUG] Creating piece at (${col},${row}) with imgIdx=${imgIdx}, pieceImages.length=${this.pieceImages.length}`);

        const spriteNode = piece.getChildByName('sprite_quan_co');
        if (!spriteNode) {
            console.error(`[ERROR] Prefab không có node con tên 'sprite_quan_co'`);
            return;
        }

        const sprite = spriteNode.getComponent(Sprite);
        if (!sprite) {
            console.error(`[ERROR] Node 'sprite_quan_co' không có component Sprite`);
            return;
        }

        if (!this.pieceImages || this.pieceImages.length === 0) {
            console.error(`[ERROR] pieceImages chưa được gán trong Inspector (array rỗng)`);
            return;
        }

        if (imgIdx < 0 || imgIdx >= this.pieceImages.length) {
            console.error(`[ERROR] imgIdx=${imgIdx} nằm ngoài phạm vi pieceImages (length=${this.pieceImages.length})`);
            return;
        }

        sprite.spriteFrame = this.pieceImages[imgIdx];
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        spriteNode.getComponent(UITransform).setContentSize(new Size(70, 70));
        console.log(`[DEBUG] Gán spriteFrame thành công cho imgIdx=${imgIdx}`);

        piece.setPosition(this.getBoardPosition(col, row));
        piece.on(Node.EventType.TOUCH_START, (e: any) => {
            e.propagationStopped = true;
            this.onPieceSelected(piece);
        }, this);

        const glowNode = piece.getChildByName('glow');
        if (glowNode) glowNode.active = false;
    }

    onPieceSelected(piece: ChessNode) {
        if (this.gameOver) return;

        // Click lại quân đang chọn -> bỏ chọn
        if (piece === this.selectedPiece) {
            this.cancelSelection();
            return;
        }

        const pTeam = piece.chessId % 2;

        // Click vào quân cùng phe đang đến lượt -> chọn quân đó
        if (pTeam === this.currentTurn) {
            this.selectNewPiece(piece);
            return;
        }

        // Click vào quân địch -> nếu đang chọn quân nhà và đây là nước hợp lệ thì ăn
        if (this.selectedPiece) {
            const sel = this.selectedPiece;
            const moves = ChessRules.getValidMoves(sel.col, sel.row, sel.chessId, this.boardState);
            if (moves.some(m => m.x === piece.col && m.y === piece.row)) {
                this.executeMove(piece.col, piece.row);
            }
        }
    }

    selectNewPiece(piece: ChessNode) {
        if (this.selectedPiece) {
            const g = this.selectedPiece.getChildByName('glow');
            if (g) g.active = false;
        }

        this.selectedPiece = piece;
        const glow = piece.getChildByName('glow');
        if (glow) {
            glow.active = true;
            glow.getComponent(UITransform).setContentSize(new Size(120, 120));
        }

        this.clearHints();
        const moves = ChessRules.getValidMoves(piece.col, piece.row, piece.chessId, this.boardState);
        moves.forEach(m => this.createHint(m.x, m.y));
    }

    executeMove(col: number, row: number) {
        if (!this.selectedPiece || this.gameOver) return;

        const movingPiece = this.selectedPiece;
        const movedTeam = movingPiece.chessId % 2;
        const targetPiece = this.boardState[col][row];
        const isCapture = targetPiece !== null && targetPiece !== movingPiece;

        // Lưu thông tin quân bị ăn cho undo
        if (isCapture) {
            this.lastCapturedPiece = targetPiece as ChessNode;
            this.lastCapturedChessId = (targetPiece as ChessNode).chessId;
        } else {
            this.lastCapturedPiece = null;
            this.lastCapturedChessId = null;
        }

        if (isCapture) {
            // Nếu là pháo ăn quân → dùng hiệu ứng pháo bắn đạn
            const isCannon = movingPiece.chessId === 2 || movingPiece.chessId === 3;
            const isHorse = movingPiece.chessId === 0 || movingPiece.chessId === 1;
            const isChariot = movingPiece.chessId === 12 || movingPiece.chessId === 13;

            console.log(`[DEBUG] Capture: chessId=${movingPiece.chessId}, isCannon=${isCannon}, isHorse=${isHorse}, horsePrefab=${!!this.horseAttackEffectPrefab}`);

            if (isCannon && this.cannonAttackEffectPrefab) {
                const fx = instantiate(this.cannonAttackEffectPrefab);
                fx.setParent(this.effectLayer || this.node);
                fx.getComponent(CannonAttackEffect2D)?.play(
                    movingPiece.worldPosition,
                    targetPiece.worldPosition,
                    () => {
                        this.playCaptureEffect(targetPiece.worldPosition);
                        targetPiece.destroy();
                        this.finishMove(movingPiece, movedTeam, col, row, true);
                    }
                );
                return; // Đợi hiệu ứng xong
            } else if (isHorse && this.horseAttackEffectPrefab) {
                console.log(`[DEBUG] Playing horse effect`);
                const fx = instantiate(this.horseAttackEffectPrefab);
                fx.setParent(this.effectLayer || this.node);
                fx.getComponent(HorseAttackEffect2D)?.play(
                    movingPiece.worldPosition,
                    targetPiece.worldPosition,
                    () => {
                        this.playCaptureEffect(targetPiece.worldPosition);
                        targetPiece.destroy();
                        this.finishMove(movingPiece, movedTeam, col, row, true);
                    }
                );
                return; // Đợi hiệu ứng xong
            } else if (isChariot && this.chariotAttackEffectPrefab) {
                const fx = instantiate(this.chariotAttackEffectPrefab);
                fx.setParent(this.effectLayer || this.node);
                fx.getComponent(ChariotAttackEffect2D)?.play(
                    movingPiece.worldPosition,
                    targetPiece.worldPosition,
                    () => {
                        this.playCaptureEffect(targetPiece.worldPosition);
                        targetPiece.destroy();
                        this.finishMove(movingPiece, movedTeam, col, row, true);
                    }
                );
                return;
            } else {
                // Quân khác ăn quân → dùng particle thường
                this.playCaptureEffect(targetPiece.worldPosition);
                targetPiece.destroy();
            }
        }

        this.finishMove(movingPiece, movedTeam, col, row, isCapture);
    }

    private finishMove(movingPiece: ChessNode, movedTeam: number, col: number, row: number, isCapture: boolean) {
        // Lưu vị trí cũ trước khi cập nhật
        const fromCol = movingPiece.col;
        const fromRow = movingPiece.row;

        // Cập nhật mảng trạng thái
        this.boardState[movingPiece.col][movingPiece.row] = null;
        movingPiece.col = col;
        movingPiece.row = row;
        this.boardState[col][row] = movingPiece;

        // Lưu record vào moveHistory
        const record: MoveRecord = {
            piece: movingPiece,
            fromCol: fromCol,
            fromRow: fromRow,
            toCol: col,
            toRow: row,
            capturedPiece: this.lastCapturedPiece,
            capturedChessId: this.lastCapturedChessId,
            wasGameOver: this.gameOver
        };
        this.moveHistory.push(record);

        // Reset captured info
        this.lastCapturedPiece = null;
        this.lastCapturedChessId = null;

        // Hiệu ứng di chuyển trượt (Tween) + Phát âm thanh
        const targetPos = this.getBoardPosition(col, row);
        tween(movingPiece)
            .to(0.1, { position: targetPos })
            .call(() => {
                if (this.audioSource) {
                    const clip = isCapture ? this.captureSound : this.moveSound;
                    if (clip) this.audioSource.playOneShot(clip, 1.0);
                }
            })
            .start();

        this.cancelSelection();

        // Đổi lượt và kiểm tra chiếu hết
        const nextTurn = 1 - movedTeam;
        this.currentTurn = nextTurn;
        this.updateTurnLabel();

        if (!ChessRules.hasAnyLegalMove(nextTurn, this.boardState)) {
            // Bên đến lượt không có nước đi hợp lệ -> bên vừa đi thắng
            this.showGameOver(movedTeam);
        } else if (ChessRules.isInCheck(nextTurn, this.boardState)) {
            this.showCheckWarning(nextTurn);
        }

        // AI đánh nếu đến lượt AI và AI được bật
        if (this.aiEnabled && this.currentTurn === TEAM_BLACK && !this.gameOver) {
            const thinkingDelay = 1 + Math.random();
            this.scheduleOnce(() => {
                this.makeAIMove();
            }, thinkingDelay);
        }
    }

    cancelSelection() {
        if (this.selectedPiece) {
            const glow = this.selectedPiece.getChildByName('glow');
            if (glow) glow.active = false;
            this.selectedPiece = null;
        }
        this.clearHints();
    }

    undoLastMove() {
        if (this.moveHistory.length === 0) return;

        const record = this.moveHistory.pop();
        if (!record) return;

        // Xóa highlight/gợi ý cũ
        this.cancelSelection();

        // Restore quân về vị trí cũ
        this.boardState[record.toCol][record.toRow] = null;
        record.piece.col = record.fromCol;
        record.piece.row = record.fromRow;
        this.boardState[record.fromCol][record.fromRow] = record.piece;
        record.piece.setPosition(this.getBoardPosition(record.fromCol, record.fromRow));

        // Restore quân bị ăn nếu có
        if (record.capturedPiece && record.capturedChessId !== null) {
            // Tạo lại quân bị ăn
            const restoredPiece = instantiate(this.chessPrefab) as ChessNode;
            restoredPiece.name = PIECE_NAME;
            restoredPiece.parent = this.node;
            restoredPiece.chessId = record.capturedChessId;
            restoredPiece.col = record.toCol;
            restoredPiece.row = record.toRow;
            this.boardState[record.toCol][record.toRow] = restoredPiece;

            const spriteNode = restoredPiece.getChildByName('sprite_quan_co');
            if (spriteNode) {
                const sprite = spriteNode.getComponent(Sprite);
                if (sprite && this.pieceImages[record.capturedChessId]) {
                    sprite.spriteFrame = this.pieceImages[record.capturedChessId];
                    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                    spriteNode.getComponent(UITransform).setContentSize(new Size(70, 70));
                }
            }
            restoredPiece.setPosition(this.getBoardPosition(record.toCol, record.toRow));
            restoredPiece.on(Node.EventType.TOUCH_START, (e: any) => {
                e.propagationStopped = true;
                this.onPieceSelected(restoredPiece);
            }, this);

            const glow = restoredPiece.getChildByName('glow');
            if (glow) glow.active = false;
        }

        // Đổi lượt về phe trước đó
        this.currentTurn = 1 - this.currentTurn;
        this.updateTurnLabel();

        // Xóa cảnh báo chiếu nếu có
        if (this.checkLabelNode && this.checkLabelNode.isValid) {
            this.checkLabelNode.destroy();
            this.checkLabelNode = null;
        }

        // Nếu trước đó game over thì xóa game over panel
        if (record.wasGameOver && this.gameOverNode && this.gameOverNode.isValid) {
            this.gameOverNode.destroy();
            this.gameOverNode = null;
            this.gameOver = false;
        }
    }

    private makeAIMove() {
        if (this.aiThinking || this.gameOver) return;

        this.aiThinking = true;

        // Lấy nước đi tốt nhất từ AI
        const aiMove = AIPlayer.getBestMove(this.boardState, TEAM_BLACK, this.aiDifficulty as AIDifficulty);

        if (aiMove) {
            const foundPiece = this.boardState[aiMove.from.x][aiMove.from.y] as ChessNode | null;
            if (foundPiece && foundPiece.chessId % 2 === TEAM_BLACK) {
                this.selectedPiece = foundPiece;
                this.executeMove(aiMove.to.x, aiMove.to.y);
            }
        }

        this.aiThinking = false;
    }

    createHint(c: number, r: number) {
        if (!this.hintPrefab) return;
        const hint = instantiate(this.hintPrefab);
        hint.parent = this.node;
        hint.name = HINT_NAME;
        hint.layer = this.node.layer;
        hint.setPosition(this.getBoardPosition(c, r));
    }

    clearHints() {
        this.node.children.filter(n => n.name === HINT_NAME).forEach(n => n.destroy());
    }

    handleMove(event: any) {
        if (this.gameOver || !this.selectedPiece) return;
        const sel = this.selectedPiece;

        const touchPos = event.getUILocation();
        const localPos = this.node.getComponent(UITransform)
            .convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));
        const cell = this.getBoardCell(localPos);
        const col = cell.x;
        const row = cell.y;

        if (ChessRules.isInBoard(col, row)) {
            const moves = ChessRules.getValidMoves(sel.col, sel.row, sel.chessId, this.boardState);
            if (moves.some(m => m.x === col && m.y === row)) {
                this.executeMove(col, row);
            } else {
                this.cancelSelection();
            }
        } else {
            this.cancelSelection();
        }
    }

    // --- GAME OVER / RESTART ---

    private showGameOver(winnerTeam: number) {
        this.gameOver = true;
        this.cancelSelection();

        const node = new Node(GAMEOVER_NAME);
        node.layer = this.node.layer;
        node.parent = this.node;

        const ui = node.addComponent(UITransform);
        const size = view.getVisibleSize();
        ui.setContentSize(size.width, size.height);

        // Nền mờ đen phủ toàn bộ màn hình
        const bgNode = new Node('GameOverBg');
        bgNode.layer = this.node.layer;
        bgNode.parent = node;
        bgNode.addComponent(UITransform).setContentSize(size.width, size.height);
        const graphics = bgNode.addComponent(Graphics);
        graphics.fillColor = new Color(0, 0, 0, 180);
        graphics.rect(-size.width / 2, -size.height / 2, size.width, size.height);
        graphics.fill();
        bgNode.setPosition(0, 0, 0);

        const label = node.addComponent(Label);
        label.string = (winnerTeam === TEAM_RED ? 'ĐỎ THẮNG' : 'ĐEN THẮNG') + '\n\n(Chạm để chơi lại)';
        label.fontSize = 56;
        label.lineHeight = 72;
        label.color = new Color(255, 215, 0);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.isBold = true;

        node.setPosition(0, 0, 100);
        node.setSiblingIndex(this.node.children.length - 1);

        node.on(Node.EventType.TOUCH_START, (e: any) => {
            e.propagationStopped = true;
            this.restartGame();
        }, this);

        this.gameOverNode = node;
    }

    private restartGame() {
        if (this.gameOverNode && this.gameOverNode.isValid) {
            this.gameOverNode.destroy();
            this.gameOverNode = null;
        }
        if (this.checkLabelNode && this.checkLabelNode.isValid) {
            this.checkLabelNode.destroy();
            this.checkLabelNode = null;
        }
        this.gameOver = false;
        this.currentTurn = TEAM_RED;
        this.selectedPiece = null;
        this.moveHistory = []; // Reset lịch sử nước đi
        this.lastCapturedPiece = null;
        this.lastCapturedChessId = null;
        this.setupFullBoard();
        this.updateTurnLabel();
    }

    private createHUD() {
        // Vị trí ngay trên đỉnh bàn cờ
        const boardTop = 4.5 * this.cellHeight + this.offsetY + 30;
        const boardRight = 4 * this.cellWidth + this.offsetX;

        // Turn indicator
        const turnNode = new Node('TurnLabel');
        turnNode.layer = this.node.layer;
        turnNode.parent = this.node;
        turnNode.addComponent(UITransform).setContentSize(300, 56);
        const turnLbl = turnNode.addComponent(Label);
        turnLbl.fontSize = 34;
        turnLbl.isBold = true;
        turnLbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        turnLbl.verticalAlign = Label.VerticalAlign.CENTER;
        turnNode.setPosition(-boardRight / 2, boardTop, 10);
        this.turnLabelNode = turnNode;
        this.updateTurnLabel();

        // Nút Undo
        const undoNode = new Node('UndoBtn');
        undoNode.layer = this.node.layer;
        undoNode.parent = this.node;
        undoNode.addComponent(UITransform).setContentSize(140, 50);
        const undoLbl = undoNode.addComponent(Label);
        undoLbl.string = '[ Undo ]';
        undoLbl.fontSize = 26;
        undoLbl.color = new Color(100, 200, 220);
        undoLbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        undoLbl.verticalAlign = Label.VerticalAlign.CENTER;
        undoNode.setPosition(boardRight - 180, boardTop, 10);
        undoNode.on(Node.EventType.TOUCH_START, (e: any) => {
            e.propagationStopped = true;
            this.undoLastMove();
        }, this);
        this.undoBtnNode = undoNode;

        // Nút Chơi lại
        const restartNode = new Node('RestartBtn');
        restartNode.layer = this.node.layer;
        restartNode.parent = this.node;
        restartNode.addComponent(UITransform).setContentSize(160, 50);
        const restartLbl = restartNode.addComponent(Label);
        restartLbl.string = '[ Chơi lại ]';
        restartLbl.fontSize = 26;
        restartLbl.color = new Color(220, 220, 100);
        restartLbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        restartLbl.verticalAlign = Label.VerticalAlign.CENTER;
        restartNode.setPosition(boardRight - 20, boardTop, 10);
        restartNode.on(Node.EventType.TOUCH_START, (e: any) => {
            e.propagationStopped = true;
            this.restartGame();
        }, this);
        this.restartBtnNode = restartNode;
    }

    private updateTurnLabel() {
        if (!this.turnLabelNode || !this.turnLabelNode.isValid) return;
        const lbl = this.turnLabelNode.getComponent(Label);
        if (!lbl) return;
        lbl.string = this.currentTurn === TEAM_RED ? 'Lượt: ĐỎ' : 'Lượt: ĐEN';
        lbl.color = this.currentTurn === TEAM_RED ? new Color(220, 50, 50) : new Color(20, 20, 20);
    }

    private showCheckWarning(team: number) {
        if (this.checkLabelNode && this.checkLabelNode.isValid) {
            this.checkLabelNode.destroy();
            this.checkLabelNode = null;
        }
        const node = new Node('CheckWarning');
        node.layer = this.node.layer;
        node.parent = this.node;
        node.addComponent(UITransform).setContentSize(500, 80);
        const lbl = node.addComponent(Label);
        lbl.string = (team === TEAM_RED ? 'ĐỎ' : 'ĐEN') + ' ĐANG BỊ CHIẾU!';
        lbl.fontSize = 44;
        lbl.isBold = true;
        lbl.color = new Color(255, 80, 0);
        lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        lbl.verticalAlign = Label.VerticalAlign.CENTER;
        node.setPosition(0, 0, 20);
        this.checkLabelNode = node;
        this.scheduleOnce(() => {
            if (this.checkLabelNode && this.checkLabelNode.isValid) {
                this.checkLabelNode.destroy();
                this.checkLabelNode = null;
            }
        }, 2.0);
    }

    private playCaptureEffect(pos: Vec3) {
        if (!this.captureParticle) return;
        const particle = instantiate(this.captureParticle);
        particle.parent = this.node;
        particle.layer = this.node.layer;
        // Convert world position to local position nếu cần
        const ui = this.node.getComponent(UITransform);
        const localPos = ui ? ui.convertToNodeSpaceAR(pos) : pos;
        particle.setPosition(localPos);
        // Particle tự destroy sau 1 giây (tùy chỉnh theo particle duration)
        this.scheduleOnce(() => {
            if (particle && particle.isValid) particle.destroy();
        }, 1.0);
    }

    private getBoardPosition(col: number, row: number): Vec3 {
        return new Vec3(
            (col - 4) * this.cellWidth + this.offsetX,
            (4.5 - row) * this.cellHeight + this.offsetY,
            0
        );
    }

    private getBoardCell(localPos: Vec3): Vec2 {
        return new Vec2(
            Math.round((localPos.x - this.offsetX) / this.cellWidth + 4),
            Math.round(4.5 - (localPos.y - this.offsetY) / this.cellHeight)
        );
    }
}
