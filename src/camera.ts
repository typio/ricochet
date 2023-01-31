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
    upDirection: glm.vec3 = glm.vec3.create();

    move = false;
    translateX = 0;
    translateY = 0;
    translateZ = 0;

    rotate = false;
    mouseMovement = [0, 0];

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
        this.upDirection = glm.vec3.fromValues(0, 1, 0);
        this.position = glm.vec3.fromValues(0, 0, 10);

        this.recalculateProjection();
        this.recalculateView();

        document.addEventListener("mousedown", async (e) => {
            // right click
            if (e.button === 2) {
                if (!document.pointerLockElement) {
                    try {
                        // @ts-ignore, function DOES take param according to mdn
                        await canvas.requestPointerLock({ unadjustedMovement: true });
                    } catch {
                        alert(
                            "Please left click the view before trying to move with right click."
                        );
                    }
                }
            }
        });

        document.addEventListener("mouseup", () => {
            document.exitPointerLock();
        });

        document.addEventListener("pointerlockchange", () => {
            if (document.pointerLockElement === canvas) {
                this.move = true;
                document.addEventListener("mousemove", getMouseMovement);
                document.addEventListener("keydown", getKeyDown);
                document.addEventListener("keyup", getKeyUp);
            } else {
                this.move = false;
                document.removeEventListener("mousemove", getMouseMovement);
                document.removeEventListener("keydown", getKeyDown);
                // we don't remove up so we can see a keyup after pointer unlock
            }
        });

        const getKeyDown = (e: KeyboardEvent) => {
            if (e.code === "KeyW") this.translateZ = 1;
            else if (e.code === "KeyS") this.translateZ = -1;

            if (e.code === "KeyD") this.translateX = 1;
            else if (e.code === "KeyA") this.translateX = -1;

            if (e.code === "KeyE") this.translateY = 1;
            else if (e.code === "KeyQ") this.translateY = -1;
        };

        const getKeyUp = (e: KeyboardEvent) => {
            if (e.code === "KeyW") this.translateZ = 0;
            else if (e.code === "KeyS") this.translateZ = 0;

            if (e.code === "KeyD") this.translateX = 0;
            else if (e.code === "KeyA") this.translateX = 0;

            if (e.code === "KeyE") this.translateY = 0;
            else if (e.code === "KeyQ") this.translateY = 0;
        };

        const getMouseMovement = (e: MouseEvent) => {
            this.mouseMovement[0] += e.movementX;
            this.mouseMovement[1] += e.movementY;
        };
    }

    updatePos = () => {
        if (this.move) {
            // translate
            let rightDirection = glm.vec3.create();
            glm.vec3.cross(rightDirection, this.forwardDirection, this.upDirection);
            if (this.translateX !== 0)
                glm.vec3.scaleAndAdd(
                    this.position,
                    this.position,
                    rightDirection,
                    this.translationSpeed * this.translateX // * ts
                );
            if (this.translateY !== 0)
                glm.vec3.scaleAndAdd(
                    this.position,
                    this.position,
                    this.upDirection,
                    this.translationSpeed * this.translateY // * ts
                );
            if (this.translateZ !== 0)
                glm.vec3.scaleAndAdd(
                    this.position,
                    this.position,
                    this.forwardDirection,
                    this.translationSpeed * this.translateZ // * ts
                );

            // rotate
            glm.vec3.cross(rightDirection, this.forwardDirection, this.upDirection);

            rightDirection = glm.vec3.create();
            glm.vec3.cross(rightDirection, this.forwardDirection, this.upDirection);
            let delta = glm.vec2.fromValues(
                this.mouseMovement[0],
                this.mouseMovement[1]
            );
            glm.vec2.scale(delta, delta, 0.001);

            let pitchDelta = delta[1] * this.rotationSpeed;
            let yawDelta = delta[0] * this.rotationSpeed;

            let pitchQuat = glm.quat.create();
            glm.quat.setAxisAngle(pitchQuat, rightDirection, -pitchDelta);

            let yawQuat = glm.quat.create();
            glm.quat.setAxisAngle(yawQuat, this.upDirection, -yawDelta);

            let q = glm.quat.create();
            glm.quat.mul(q, pitchQuat, yawQuat);
            glm.quat.normalize(q, q);
            glm.vec3.transformQuat(this.forwardDirection, this.forwardDirection, q);
            this.recalculateProjection();
            this.recalculateView();

            this.mouseMovement = [0, 0];
        }
    };

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
