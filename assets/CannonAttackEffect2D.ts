import {
    _decorator,
    Component,
    Node,
    Vec3,
    tween,
    UIOpacity,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('CannonAttackEffect2D')
export class CannonAttackEffect2D extends Component {
    @property(Node)
    cannon: Node = null!;

    @property(Node)
    muzzleFlash: Node = null!;

    @property(Node)
    cannonBall: Node = null!;

    play(from: Vec3, to: Vec3, onHit: () => void) {
        this.node.setWorldPosition(from);

        this.cannon.active = true;
        this.muzzleFlash.active = false;
        this.cannonBall.active = false;

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const angleOffset = 90; // Chỉnh offset để sprite pháo hướng đúng

        // Không flip, chỉ dùng angle để xoay pháo
        const finalScaleX = 1 / 3;

        this.cannon.angle = angle + angleOffset;
        this.cannon.setScale(new Vec3(0.2, 0.2, 1));

        tween(this.cannon)
            .to(0.3, { scale: new Vec3(finalScaleX, 1 / 3, 1 / 3) })
            .call(() => this.fire(to, onHit))
            .start();
    }

    private fire(to: Vec3, onHit: () => void) {
        this.cannonBall.active = true;
        this.cannonBall.setWorldPosition(this.cannon.worldPosition); // Đạn xuất phát từ tâm pháo

        tween(this.cannonBall)
            .to(0.2, { worldPosition: to })
            .call(() => {
                this.cannonBall.active = false;
                onHit();
                this.node.destroy();
            })
            .start();
    }
}