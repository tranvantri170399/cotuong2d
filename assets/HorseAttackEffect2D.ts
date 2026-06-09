import {
    _decorator,
    Component,
    Node,
    Vec3,
    tween,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('HorseAttackEffect2D')
export class HorseAttackEffect2D extends Component {

    @property(Node)
    horse: Node = null!;

    play(
        from: Vec3,
        to: Vec3,
        onHit: () => void
    ) {

        this.horse.setWorldPosition(from);

        const dx = to.x - from.x;
        const dy = to.y - from.y;

        const angle =
            Math.atan2(dy, dx) * 180 / Math.PI;
        const angleOffset = 90; // Chỉnh offset để sprite ngựa hướng đúng

        this.horse.angle = angle + angleOffset;

        this.horse.setScale(
            new Vec3(0.4, 0.4, 1)
        );

        tween(this.horse)
            .to(
                0.5,
                {
                    worldPosition: to
                },
                {
                    easing: 'quartIn'
                }
            )
            .call(() => {

                onHit();

                this.node.destroy();

            })
            .start();
    }
}