import * as glm from "gl-matrix";

export default class Camera {
    canvas: HTMLCanvasElement;
    verticalFOV: number = 45;
    nearClip: number = 0.1;
    farClip: number = 100;
    translationSpeed: number = 5;
    rotationSpeed: number = 3;

    projection: glm.mat4 = glm.mat4.create();
    view: glm.mat4 = glm.mat4.create();
    inverseProjection: glm.mat4 = glm.mat4.create();
    inverseView: glm.mat4 = glm.mat4.create();

    position: glm.vec3 = glm.vec3.create();
    forwardDirection: glm.vec3 = glm.vec3.create();

    constructor(
        canvas: HTMLCanvasElement,
        verticalFOV: number,
        nearClip: number,
        farClip: number,
        translationSpeed: number
    ) {
        this.canvas = canvas;
        this.verticalFOV = verticalFOV;
        this.nearClip = nearClip;
        this.farClip = farClip;
        this.translationSpeed = translationSpeed;
        this.rotationSpeed = 3;

        this.forwardDirection = glm.vec3.fromValues(0, 0, -1);
        this.position = glm.vec3.fromValues(0, 0, 3);

        this.recalculateProjection();
        this.recalculateView();

        const upDirection = glm.vec3.fromValues(0, 1, 0);
        let rightDirection = glm.vec3.create();
        glm.vec3.cross(rightDirection, this.forwardDirection, upDirection);

        document.addEventListener("mousedown", async (e) => {
            // right click
            if (e.button === 2) {
                if (!document.pointerLockElement) {
                    // @ts-ignore, function DOES take param according to mdn
                    await canvas.requestPointerLock({ unadjustedMovement: true });
                }
            }
        });

        document.addEventListener("mouseup", () => {
            document.exitPointerLock();
        });

        document.addEventListener("pointerlockchange", () => {
            if (document.pointerLockElement === canvas) {
                document.addEventListener("mousemove", rotateCamera);
                document.addEventListener("keydown", translateCamera);
            } else {
                document.removeEventListener("mousemove", rotateCamera);
                document.removeEventListener("keydown", translateCamera);
            }
        });

        const translateCamera = (e: KeyboardEvent) => {
            if (e.code === "KeyW")
                glm.vec3.scaleAndAdd(
                    this.position,
                    this.position,
                    this.forwardDirection,
                    this.translationSpeed // * ts
                );
            else if (e.code === "KeyS")
                glm.vec3.scaleAndAdd(
                    this.position,
                    this.position,
                    this.forwardDirection,
                    -1 * this.translationSpeed // * ts
                );

            if (e.code === "KeyD")
                glm.vec3.scaleAndAdd(
                    this.position,
                    this.position,
                    rightDirection,
                    this.translationSpeed // * ts
                );
            else if (e.code === "KeyA")
                glm.vec3.scaleAndAdd(
                    this.position,
                    this.position,
                    rightDirection,
                    -1 * this.translationSpeed // * ts
                );

            if (e.code === "KeyE")
                glm.vec3.scaleAndAdd(
                    this.position,
                    this.position,
                    upDirection,
                    this.translationSpeed // * ts
                );
            else if (e.code === "KeyQ")
                glm.vec3.scaleAndAdd(
                    this.position,
                    this.position,
                    upDirection,
                    -1 * this.translationSpeed // * ts
                );
            this.recalculateProjection();
            this.recalculateView();
        };

        const rotateCamera = (e: MouseEvent) => {
            let delta = glm.vec2.fromValues(e.movementX, e.movementY);
            glm.vec2.scale(delta, delta, 0.001);

            let pitchDelta = delta[1] * this.rotationSpeed;
            let yawDelta = delta[0] * this.rotationSpeed;

            let pitchQuat = glm.quat.create();
            glm.quat.setAxisAngle(pitchQuat, rightDirection, -pitchDelta);

            let yawQuat = glm.quat.create();
            glm.quat.setAxisAngle(yawQuat, upDirection, -yawDelta);

            let q = glm.quat.create();
            glm.quat.mul(q, pitchQuat, yawQuat);
            glm.quat.normalize(q, q);
            glm.vec3.transformQuat(this.forwardDirection, this.forwardDirection, q);
            this.recalculateProjection();
            this.recalculateView();
        };
    }

    // update = (ts: number) => { };
    // resize = (width: number, height: number) => { };

    recalculateProjection = () => {
        glm.mat4.perspectiveZO(
            this.projection,
            this.verticalFOV,
            this.canvas.width / this.canvas.height,
            this.nearClip,
            this.farClip
        );
        glm.mat4.invert(this.inverseProjection, this.projection);
    };

    recalculateView = () => {
        let positionPlusForward = glm.vec3.create();
        glm.vec3.add(positionPlusForward, this.position, this.forwardDirection);
        glm.mat4.lookAt(
            this.view,
            this.position,
            positionPlusForward,
            glm.vec3.fromValues(0, 1, 0)
        );
        glm.mat4.invert(this.inverseView, this.view);
    };
}
