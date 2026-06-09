import {
    _decorator,
    Component,
    Node,
    tween,
    Vec3,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ChariotAttackEffect2D')
export class ChariotAttackEffect2D extends Component {

    @property(Node)
    chariot: Node = null!;

    play(
        from: Vec3,
        to: Vec3,
        onHit: () => void
    ) {
        this.chariot.setWorldPosition(from);

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const angleOffset = 90;

        this.chariot.angle = angle + angleOffset;
        this.chariot.setScale(new Vec3(0.4, 0.4, 1));

        tween(this.chariot)
            .to(0.5, { worldPosition: to }, { easing: 'quartIn' })
            .call(() => {
                onHit();
                this.node.destroy();
            })
            .start();
    }
}