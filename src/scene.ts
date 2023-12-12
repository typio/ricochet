interface Sphere {
    position: [number, number, number];
    radius: number;
    materialIndex: number;
}

interface Material {
  albedo: [number, number, number];
  roughness: number;
  metallic: number;
  emisssionColor: [number, number, number];
  emissionIntensity: number;
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
            { albedo: [1, 0.01, 0.01], roughness: 0.0, metallic: 0.0, emisssionColor: [1,0.4,0.1], emissionIntensity: 100 },
            { albedo: [0, 1, 0], roughness: 0.0, metallic: 0.5, emisssionColor: [0,1,0], emissionIntensity: 100 },
            { albedo: [0, 0, 1], roughness: 0.0, metallic: 0.5, emisssionColor: [0,0,1], emissionIntensity: 0 },
            { albedo: [0.75, 0.75, 0.75], roughness: 0.7, metallic: 1.0, emisssionColor: [1,1,1], emissionIntensity: 0 },
            { albedo: [0.5, 0.45, 0.01], roughness: 0.0, metallic: 1.0, emisssionColor: [0.5,0.5,0], emissionIntensity: 0 },
            { albedo: [0.5, 0.45, 0.01], roughness: 0.0, metallic: 1.0, emisssionColor: [1,1,1], emissionIntensity: 5 },
        ];

        this.spheres = [
            { position: [-15, 10,-15], radius: 10, materialIndex: 0 },
            { position: [5, 0, -9], radius: 2, materialIndex: 1 },
            { position: [0, -4, -15], radius: 3, materialIndex: 2 },
            { position: [0, 2, -15], radius: 2, materialIndex: 3 },
            { position: [0, -1e2 - 7, 0], radius: 1e2, materialIndex: 4 },
            { position: [5e7, 1e8 + 5e7,-5e7], radius: 1e8, materialIndex: 5 },
        ];

        this.lightDir = [1, 1, 1];

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
    let offset = 12;
        let materialsArray = new Array(offset * 20).fill(0);

        for (let i = 0; i < this.materials.length; i++) {
            for (let a = 0; a < 3; a++) {
                materialsArray[i * offset + a] = this.materials[i].albedo[a];
            }
            materialsArray[i * offset + 4] = this.materials[i].roughness;
            materialsArray[i * offset + 5] = this.materials[i].metallic;

            materialsArray[i * offset + 8 ] = this.materials[i].emisssionColor[0];
            materialsArray[i * offset + 9  ] = this.materials[i].emisssionColor[1];
            materialsArray[i * offset + 10  ] = this.materials[i].emisssionColor[2];

            materialsArray[i * offset + 11] = this.materials[i].emissionIntensity;
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
