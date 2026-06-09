import {
    _decorator,
    Component,
    Node,
    tween,
    Vec3,
    UIOpacity,
    ParticleSystem2D,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('CaptureEffect2D')
export class CaptureEffect2D extends Component {

    @property(Node)
    flash: Node = null!;

    @property(Node)
    ring: Node = null!;

    @property(ParticleSystem2D)
    particle: ParticleSystem2D = null!;

    start() {
        this.play();
    }

    play() {

        // FLASH
        const flashOpacity = this.flash.getComponent(UIOpacity)!;

        this.flash.setScale(new Vec3(0.2, 0.2, 1));
        flashOpacity.opacity = 255;

        tween(this.flash)
            .to(0.12, {
                scale: new Vec3(1.3, 1.3, 1)
            })
            .start();

        tween(flashOpacity)
            .to(0.12, {
                opacity: 0
            })
            .start();


        // RING
        const ringOpacity = this.ring.getComponent(UIOpacity)!;

        this.ring.setScale(new Vec3(0.5, 0.5, 1));
        ringOpacity.opacity = 220;

        tween(this.ring)
            .to(0.35, {
                scale: new Vec3(1.8, 1.8, 1)
            })
            .start();

        tween(ringOpacity)
            .to(0.35, {
                opacity: 0
            })
            .start();


        // PARTICLE
        this.particle.resetSystem();


        // DESTROY
        tween(this.node)
            .delay(1)
            .call(() => {
                this.node.destroy();
            })
            .start();
    }
}