interface Sphere {
    position: [number, number, number];
    radius: number;
    albedo: [number, number, number];
}

export default class Scene {
    spheres: Sphere[];
    lightDir: [number, number, number];

    spheresBuffer: Float32Array;
    lightDirBuffer: Float32Array;

    constructor() {
        this.spheres = [
            { position: [0, 0, -5], radius: 2, albedo: [0, 1, 0] },
            { position: [5, 0, -5], radius: 2, albedo: [1, 0, 0] },
            { position: [0, -5, -5], radius: 2, albedo: [0, 0, 1] },
            { position: [0, 0, -10], radius: 2, albedo: [1, 1, 1] },
        ];

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                this.spheres.push({
                    position: [-1 * 5 + i * 5, -1 * 5 + j * 5, -50],
                    radius: 3.5,
                    albedo: [1 / ((i + j - 3) / 3), 1 / (j / 1.5), 1 / (i / 1.5)],
                });
            }
        }

        this.lightDir = [1, -1, -1];

        this.lightDirBuffer = new Float32Array(this.lightDir);

        this.updateSpheresBuffer();
    }

    startTime = performance.now();

    updateSpheres = () => {
        let dx = Math.cos((Date.now() - this.startTime) / 125) * 10;
        let dy = Math.sin((Date.now() - this.startTime) / 150) * 10;
        let dz = Math.sin((Date.now() - this.startTime) / 100) * 10 + 15;
        this.spheres[3].position = [dx, dy, -5 - dz];

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                let idx = 4 + i * 3 + j;
                if ((i + j) % 2 === 0)
                    this.spheres[idx].position[2] =
                        -50 + Math.sin((Date.now() - this.startTime) / 125) * 4;
                else
                    this.spheres[idx].position[2] =
                        -50 + Math.cos((Date.now() - this.startTime) / 150) * 4;
            }
        }
    };

    updateSpheresBuffer = () => {
        let spheresArray = new Array(8 * 200).fill(0);

        for (let i = 0; i < this.spheres.length; i++) {
            for (let p = 0; p < 3; p++) {
                spheresArray[i * 8 + p] = this.spheres[i].position[p];
            }
            spheresArray[i * 8 + 3] = this.spheres[i].radius;
            for (let a = 0; a < 3; a++) {
                spheresArray[i * 8 + 4 + a] = this.spheres[i].albedo[a];
            }
        }

        this.spheresBuffer = new Float32Array(spheresArray);
    };

    updateLightDirBuffer = () => {
        this.lightDirBuffer = new Float32Array(this.lightDir);
    };
}
