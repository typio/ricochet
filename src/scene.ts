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
           { albedo: [0.5, 0.45, 0.01], roughness: 1, metallic: 1.0, emisssionColor: [1,1,1], emissionIntensity: 0.1 }, // Sun
          { albedo: [1, 1, 1], roughness: 1, metallic: 1.0, emisssionColor: [0,0,0], emissionIntensity: 0 } // Ground
      ]
      .concat(
        Array.from({ length: 98 }, (_) => {
          let bigRandom = 0.8 + Math.random() * 0.2
          let smallRandom = Math.random() * 0.2
          let red = [bigRandom, smallRandom, smallRandom]
          let gold = [bigRandom, bigRandom, smallRandom]
          let green = [smallRandom, bigRandom, smallRandom]
          let albedo = Math.random() > 0.9 ? gold : Math.random() > 0.4 ? red : green

          return { 
            albedo,
            roughness: albedo == gold ? 0 : Math.random(),
            metallic: 1,
            emisssionColor: [1,1,1],
            emissionIntensity: (Math.random() > 0.9) ? 1000 : 0
        }})
      )

      this.spheres = [
          { position: [5e7, 1e9 + 7e8,-5e7], radius: 1e1, materialIndex: 0 },
          { position: [0, -1e4 - 200, 0], radius: 1e4, materialIndex: 1 },
      ]
      .concat(
        Array.from({ length: 98 }, (_, i) => {
          let z = Math.random() * 150 - 180;
          let x = Math.random() * 200 - 100
          let r = (Math.max(-z, 1) / 10) * 0.7

          let y = Math.random() * 100 - 50

          return { 
            position: [x, y, z],
            radius: r,
            materialIndex: i + 2
        }})
      )


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
        let materialsArray = new Array(offset * this.materials.length).fill(0);

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
        let spheresArray = new Array(8 * this.spheres.length).fill(0);

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
