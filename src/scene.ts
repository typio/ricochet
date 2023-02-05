interface Sphere {
    position: [number, number, number];
    radius: number;
    materialIndex: number;
}

interface Material {
    albedo: [number, number, number];
    roughness: number;
    metallic: number;
}

export default class Scene {
    materials: Material[];
    spheres: Sphere[];
    lightDir: [number, number, number];

    materialsBuffer: Float32Array;
    spheresBuffer: Float32Array;
    lightDirBuffer: Float32Array;

    constructor() {
        this.materials = [
            { albedo: [1, 0, 0], roughness: 0.0, metallic: 0.5 },
            { albedo: [0, 1, 0], roughness: 0.5, metallic: 0.5 },
            { albedo: [0, 0, 1], roughness: 1.0, metallic: 0.5 },
            { albedo: [1, 1, 1], roughness: 0.1, metallic: 0.5 },
        ];

        this.spheres = [
            { position: [0, 0, -5], radius: 2, materialIndex: 0 },
            { position: [0, -5, -5], radius: 2, materialIndex: 2 },
            { position: [5, 0, -5], radius: 2, materialIndex: 1 },
            { position: [0, 0, -10], radius: 2, materialIndex: 3 },
        ];

        this.lightDir = [-1, -1, -1];

        this.updateLightDirBuffer();
        this.updateMaterialsBuffer();
        this.updateSpheresBuffer();
    }

    startTime = performance.now();

    updateSpheres = () => {
        let dx = Math.cos((Date.now() - this.startTime) / 125) * 10;
        let dy = Math.sin((Date.now() - this.startTime) / 150) * 10;
        let dz = Math.sin((Date.now() - this.startTime) / 100) * 10 + 15;
        this.spheres[3].position = [dx, dy, -5 - dz];
    };

    updateMaterialsBuffer = () => {
        let materialsArray = new Array(8 * 20).fill(0);

        for (let i = 0; i < this.materials.length; i++) {
            for (let a = 0; a < 3; a++) {
                materialsArray[i * 8 + a] = this.materials[i].albedo[a];
            }
            materialsArray[i * 8 + 3] = this.materials[i].roughness;
            materialsArray[i * 8 + 4] = this.materials[i].metallic;
        }

        this.materialsBuffer = new Float32Array(materialsArray);
    };

    updateSpheresBuffer = () => {
        let spheresArray = new Array(8 * 20).fill(0);

        for (let i = 0; i < this.spheres.length; i++) {
            for (let p = 0; p < 3; p++) {
                spheresArray[i * 8 + p] = this.spheres[i].position[p];
            }
            spheresArray[i * 8 + 3] = this.spheres[i].radius;
            spheresArray[i * 8 + 4] = this.spheres[i].materialIndex;
        }

        this.spheresBuffer = new Float32Array(spheresArray);
    };

    updateLightDirBuffer = () => {
        this.lightDirBuffer = new Float32Array(this.lightDir);
    };
}
