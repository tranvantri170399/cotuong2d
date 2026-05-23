import { _decorator, Component, Node, Prefab, instantiate, Sprite, Vec3, SpriteFrame, UITransform, Size, Vec2, AudioClip, AudioSource, tween, Vec4, view } from 'cc';
import { ChessRules } from './ChessRules';
const { ccclass, property } = _decorator;

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

    @property public cellWidth: number = 71.640625;
    @property public cellHeight: number = 73.63064236111111;
    @property public offsetX: number = -0.3125;
    @property public offsetY: number = 0.361328125;

    private selectedPiece: Node = null;
    private boardState: (Node | null)[][] = [];
    private audioSource: AudioSource = null; // Dùng cho SFX (hiệu ứng)
    private bgSource: AudioSource = null;    // Dùng riêng cho nhạc nền
    private riverEffect1: Node = null;
    private riverEffect2: Node = null;
    private riverLoopWidth: number = 0;
    private riverScrollSpeed: number = 40;
    private riverStartPos1: Vec3 = null;
    private riverOffset: number = 0;

    start() {
        // Khởi tạo Loa cho hiệu ứng (SFX)
        this.audioSource = this.getComponent(AudioSource);
        if (!this.audioSource) this.audioSource = this.addComponent(AudioSource);

        // Khởi tạo Loa riêng cho nhạc nền (BGM)
        this.bgSource = this.node.addComponent(AudioSource);

        // Cấu hình và phát nhạc nền
        if (this.bgMusic) {
            this.bgSource.clip = this.bgMusic;
            this.bgSource.loop = true;      // Phát lặp lại
            this.bgSource.playOnAwake = true;
            this.bgSource.volume = 0.3;     // Nhạc nền nên nhỏ (30%) để không át tiếng quân cờ
            this.bgSource.play();
        }

        this.initBoardArray();
        this.setupFullBoard();
        this.playRiverEffect();

        this.node.on(Node.EventType.TOUCH_START, (event) => {
            if (this.selectedPiece) {
                if (event.target === this.node || event.target.name === "HintNode") {
                    this.handleMove(event);
                }
            }
        }, this);

    }
    playRiverEffect() {
        const song1 = this.node.getChildByName("River_Effect1");
        const song2 = this.node.getChildByName("River_Effect2");

        if (!song1 || !song2) {
            console.error("Bạn chưa đặt đúng tên Node là River_Effect1 và River_Effect2");
            return;
        }

        const ui1 = song1.getComponent(UITransform);
        const ui2 = song2.getComponent(UITransform);

        if (!ui1 || !ui2) {
            console.error("River_Effect1 và River_Effect2 phải có UITransform");
            return;
        }

        // Dùng chiều rộng màn hình thực tế để river che được toàn bộ canvas
        const boardWidth = view.getVisibleSize().width;
        const tileHeight = ui1.contentSize.height;
        const riverY = this.offsetY; // Trung tâm giữa row 4 và row 5
        const riverZ = 0;

        // Bắt buộc sizeMode = CUSTOM để sprite giãn theo contentSize
        const sp1 = song1.getComponent(Sprite);
        const sp2 = song2.getComponent(Sprite);
        if (sp1) sp1.sizeMode = Sprite.SizeMode.CUSTOM;
        if (sp2) sp2.sizeMode = Sprite.SizeMode.CUSTOM;

        // Resize cả 2 tile về đúng board width
        // ui1.setContentSize(boardWidth, tileHeight);
        // ui2.setContentSize(boardWidth, tileHeight);

        const startPos1 = new Vec3(0, riverY, riverZ);
        const startPos2 = new Vec3(boardWidth, riverY, riverZ);

        this.riverEffect1 = song1;
        this.riverEffect2 = song2;
        this.riverLoopWidth = boardWidth;
        this.riverStartPos1 = startPos1;
        this.riverOffset = 0;

        song1.setPosition(startPos1);
        song2.setPosition(startPos2);
    }

    update(deltaTime: number) {
        if (
            !this.riverEffect1 ||
            !this.riverEffect2 ||
            !this.riverStartPos1 ||
            this.riverLoopWidth <= 0
        ) {
            return;
        }

        this.riverOffset += this.riverScrollSpeed * deltaTime;
        if (this.riverOffset >= this.riverLoopWidth) {
            this.riverOffset %= this.riverLoopWidth;
        }

        const x1 = this.riverStartPos1.x - this.riverOffset;
        const x2 = x1 + this.riverLoopWidth;

        this.riverEffect1.setPosition(new Vec3(x1, this.riverStartPos1.y, this.riverStartPos1.z));
        this.riverEffect2.setPosition(new Vec3(x2, this.riverStartPos1.y, this.riverStartPos1.z));
    }

    // ... (Giữ nguyên initBoardArray, setupFullBoard, createPiece) ...

    initBoardArray() {
        for (let i = 0; i < 9; i++) {
            this.boardState[i] = [];
            for (let j = 0; j < 10; j++) {
                this.boardState[i][j] = null;
            }
        }
    }

    setupFullBoard() {
        // KHÔNG dùng this.node.removeAllChildren() nữa.

        // Tìm và xóa tất cả quân cờ cũ + điểm gợi ý, giữ lại dòng sông
        const children = this.node.children.slice(); // Copy mảng con
        children.forEach(child => {
            // Chỉ xóa nếu là điểm gợi ý hoặc quân cờ (tên không phải River_Effect)
            if (child.name === "HintNode" || child.name.includes("piece") || child.getComponent(Sprite)) {
                // Lưu ý: Nếu bạn instantiate từ prefab, hãy kiểm tra logic xóa phù hợp
                // Để an toàn, ở đây mình chỉ xóa những gì không phải là "River_Effect"
                if (child.name !== "River_Effect1" && child.name !== "River_Effect2" && child.name !== "t1" && child.name !== "t2") {
                    child.destroy();
                }
            }
        });
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
        let piece = instantiate(this.chessPrefab);
        piece.parent = this.node;
        (piece as any).chessId = imgIdx;
        (piece as any).col = col;
        (piece as any).row = row;
        this.boardState[col][row] = piece;

        let spriteNode = piece.getChildByName("sprite_quan_co");
        if (spriteNode) {
            let sprite = spriteNode.getComponent(Sprite);
            sprite.spriteFrame = this.pieceImages[imgIdx];
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            spriteNode.getComponent(UITransform).setContentSize(new Size(80, 80));
        }

        piece.setPosition(this.getBoardPosition(col, row));
        piece.on(Node.EventType.TOUCH_START, (e) => {
            e.propagationStopped = true;
            this.onPieceSelected(piece);
        }, this);

        let glowNode = piece.getChildByName("glow");
        if (glowNode) glowNode.active = false;
    }

    onPieceSelected(piece: Node) {
        if (this.selectedPiece && this.selectedPiece !== piece) {
            const selectedId = (this.selectedPiece as any).chessId;
            const targetId = (piece as any).chessId;

            if ((selectedId % 2) !== (targetId % 2)) {
                const c = (this.selectedPiece as any).col;
                const r = (this.selectedPiece as any).row;
                const moves = ChessRules.getValidMoves(c, r, selectedId, this.boardState);

                const targetCol = (piece as any).col;
                const targetRow = (piece as any).row;
                const isValid = moves.some(m => m.x === targetCol && m.y === targetRow);

                if (isValid) {
                    this.executeMove(targetCol, targetRow);
                    return;
                }
            }
        }
        this.selectNewPiece(piece);
    }

    selectNewPiece(piece: Node) {
        if (this.selectedPiece) {
            let g = this.selectedPiece.getChildByName("glow");
            if (g) g.active = false;
        }

        this.selectedPiece = piece;
        let glow = piece.getChildByName("glow");
        if (glow) {
            glow.active = true;
            glow.getComponent(UITransform).setContentSize(new Size(100, 100));
        }

        this.clearHints();
        let moves = ChessRules.getValidMoves((piece as any).col, (piece as any).row, (piece as any).chessId, this.boardState);
        moves.forEach(m => this.createHint(m.x, m.y));
    }

    executeMove(col: number, row: number) {
        if (!this.selectedPiece) return;

        let targetPiece = this.boardState[col][row];
        let isCapture = targetPiece !== null && targetPiece !== this.selectedPiece;

        if (isCapture) {
            targetPiece.destroy();
        }

        // Cập nhật mảng trạng thái
        this.boardState[(this.selectedPiece as any).col][(this.selectedPiece as any).row] = null;
        (this.selectedPiece as any).col = col;
        (this.selectedPiece as any).row = row;
        this.boardState[col][row] = this.selectedPiece;

        // Hiệu ứng di chuyển trượt (Tween) + Phát âm thanh
        const targetPos = this.getBoardPosition(col, row);

        tween(this.selectedPiece)
            .to(0.1, { position: targetPos }) // Di chuyển trong 0.1s
            .call(() => {
                // Phát âm thanh sau khi quân cờ hạ xuống
                if (this.audioSource) {
                    const clip = isCapture ? this.captureSound : this.moveSound;
                    if (clip) this.audioSource.playOneShot(clip, 1.0);
                }
            })
            .start();

        this.cancelSelection();
    }

    // ... (Giữ nguyên handleMove, createHint, clearHints, cancelSelection, getBoardPosition, getBoardCell) ...

    cancelSelection() {
        if (this.selectedPiece) {
            let glow = this.selectedPiece.getChildByName("glow");
            if (glow) glow.active = false;
            this.selectedPiece = null;
        }
        this.clearHints();
    }

    createHint(c: number, r: number) {
        if (!this.hintPrefab) return;
        let hint = instantiate(this.hintPrefab);
        hint.parent = this.node;
        hint.name = "HintNode";
        hint.layer = this.node.layer;
        hint.setPosition(this.getBoardPosition(c, r));
    }

    clearHints() {
        this.node.children.filter(n => n.name === "HintNode").forEach(n => n.destroy());
    }

    handleMove(event: any) {
        let touchPos = event.getUILocation();
        let localPos = this.node.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));
        let cell = this.getBoardCell(localPos);
        let col = cell.x;
        let row = cell.y;

        if (ChessRules.isInBoard(col, row)) {
            let moves = ChessRules.getValidMoves((this.selectedPiece as any).col, (this.selectedPiece as any).row, (this.selectedPiece as any).chessId, this.boardState);
            if (moves.some(m => m.x === col && m.y === row)) {
                this.executeMove(col, row);
            } else {
                this.cancelSelection();
            }
        } else {
            this.cancelSelection();
        }
    }

    private getBoardPosition(col: number, row: number): Vec3 {
        return new Vec3((col - 4) * this.cellWidth + this.offsetX, (4.5 - row) * this.cellHeight + this.offsetY, 0);
    }

    private getBoardCell(localPos: Vec3): Vec2 {
        return new Vec2(
            Math.round((localPos.x - this.offsetX) / this.cellWidth + 4),
            Math.round(4.5 - (localPos.y - this.offsetY) / this.cellHeight)
        );
    }
}