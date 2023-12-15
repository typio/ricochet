interface Sphere {
  position: [number, number, number]
  radius: number
  materialIndex: number
}

interface Vertex {
  v: [number, number, number]
}

interface Triangle {
  v0: number
  v1: number
  v2: number
}

interface Material {
  albedo: [number, number, number]
  roughness: number
  metallic: number
  emisssionColor: [number, number, number]
  emissionIntensity: number
}

export default class Scene {
  materials: Material[]
  spheres: Sphere[]
  vertices: Vertex[]
  triangles: Triangle[]

  materialsBuffer: Float32Array
  sphereBuffer: Float32Array
  vertexBuffer: Float32Array
  triangleBuffer: Uint16Array

  constructor() {
    // @ts-ignore
    this.materials = [
      {
        albedo: [0.5, 0.45, 0.01],
        roughness: 1,
        metallic: 1.0,
        emisssionColor: [1, 1, 1],
        emissionIntensity: 0,
      }, // Sun
      {
        albedo: [1, 1, 1],
        roughness: 1,
        metallic: 1.0,
        emisssionColor: [0, 0, 0],
        emissionIntensity: 0,
      }, // Ground
      {
        albedo: [1, 1, 1],
        roughness: 1,
        metallic: 1.0,
        emisssionColor: [1, 1, 1],
        emissionIntensity: 1000,
      }, // Light
    ].concat(
      Array.from({ length: 98 }, (_) => {
        let bigRandom = 0.8 + Math.random() * 0.2
        let smallRandom = Math.random() * 0.2
        let red = [bigRandom, smallRandom, smallRandom]
        let gold = [bigRandom, bigRandom, smallRandom]
        let green = [smallRandom, bigRandom, smallRandom]
        let albedo =
          Math.random() > 0.8 ? gold : Math.random() > 0.4 ? red : green

        return {
          albedo,
          roughness: albedo == gold ? 0 : Math.round(Math.random()),
          metallic: 1,
          emisssionColor: [1, 1, 1],
          emissionIntensity: 0,
        }
      })
    )

    // @ts-ignore
    this.spheres = [
      { position: [5e7, 1e9 + 7e8, -5e7], radius: 1e9, materialIndex: 0 },
      { position: [0, -1e4 - 200, 0], radius: 1e4, materialIndex: 1 },
    ].concat(
      Array.from({ length: 298 }, (_, i) => {
        let z = Math.random() * 150 - 250
        let x = Math.random() * 200 - 100
        let r = (Math.max(-z, 1) / 10) * 0.7
        let y = Math.random() * 100 - 50

        return {
          position: [x, y, z],
          radius: r * Math.random(),
          materialIndex:
            Math.random() > 0.85 ? 2 : (i % this.materials.length) + 2,
        }
      })
    )

    this.vertices = [
      // Top and bottom vertices
      { v: [0, 5, -150] }, // 0
      { v: [0, -5, -150] }, // 1

      // Upper ring vertices
      { v: [-4.75, 1.5, -150] }, // 2
      { v: [-3, 1.5, -155.5] }, // 3
      { v: [3, 1.5, -155.5] }, // 4
      { v: [4.75, 1.5, -150] }, // 5
      { v: [3, 1.5, -144.5] }, // 6
      { v: [-3, 1.5, -144.5] }, // 7

      // Lower ring vertices
      { v: [-4.75, -1.5, -150] }, // 8
      { v: [-3, -1.5, -155.5] }, // 9
      { v: [3, -1.5, -155.5] }, // 10
      { v: [4.75, -1.5, -150] }, // 11
      { v: [3, -1.5, -144.5] }, // 12
      { v: [-3, -1.5, -144.5] }, // 13
    ]

    this.triangles = [
      // Upper triangles
      { v0: 0, v1: 2, v2: 3 },
      { v0: 0, v1: 3, v2: 4 },
      { v0: 0, v1: 4, v2: 5 },
      { v0: 0, v1: 5, v2: 6 },
      { v0: 0, v1: 6, v2: 7 },
      { v0: 0, v1: 7, v2: 2 },

      // Middle triangles
      { v0: 2, v1: 7, v2: 13 },
      { v0: 2, v1: 13, v2: 8 },
      { v0: 3, v1: 2, v2: 8 },
      { v0: 3, v1: 8, v2: 9 },
      { v0: 4, v1: 3, v2: 9 },
      { v0: 4, v1: 9, v2: 10 },
      { v0: 5, v1: 4, v2: 10 },
      { v0: 5, v1: 10, v2: 11 },
      { v0: 6, v1: 5, v2: 11 },
      { v0: 6, v1: 11, v2: 12 },
      { v0: 7, v1: 6, v2: 12 },
      { v0: 7, v1: 12, v2: 13 },

      // Lower triangles
      { v0: 1, v1: 9, v2: 8 },
      { v0: 1, v1: 10, v2: 9 },
      { v0: 1, v1: 11, v2: 10 },
      { v0: 1, v1: 12, v2: 11 },
      { v0: 1, v1: 13, v2: 12 },
      { v0: 1, v1: 8, v2: 13 },
    ]

    this.updateMaterialsBuffer()
    this.updateSphereBuffer()
    this.updateVertexBuffer()
    this.updateTriangleBuffer()
  }

  startTime = performance.now()

  updateSpheres = () => {
    let dx = Math.cos((Date.now() - this.startTime) / 125) * 10
    let dy = Math.sin((Date.now() - this.startTime) / 150) * 10
    let dz = Math.sin((Date.now() - this.startTime) / 100) * 10 + 15
    this.spheres[3].position = [dx, dy, -5 - dz]
  }

  updateMaterialsBuffer = () => {
    let offset = 12
    let materialsArray = new Array(offset * this.materials.length).fill(0)

    for (let i = 0; i < this.materials.length; i++) {
      for (let a = 0; a < 3; a++) {
        materialsArray[i * offset + a] = this.materials[i].albedo[a]
      }
      materialsArray[i * offset + 4] = this.materials[i].roughness
      materialsArray[i * offset + 5] = this.materials[i].metallic

      materialsArray[i * offset + 8] = this.materials[i].emisssionColor[0]
      materialsArray[i * offset + 9] = this.materials[i].emisssionColor[1]
      materialsArray[i * offset + 10] = this.materials[i].emisssionColor[2]

      materialsArray[i * offset + 11] = this.materials[i].emissionIntensity
    }

    this.materialsBuffer = new Float32Array(materialsArray)
  }

  updateSphereBuffer = () => {
    let count = this.spheres.length
    let spheresArray = new Array(8 * count).fill(0)

    for (let i = 0; i < this.spheres.length; i++) {
      for (let p = 0; p < 3; p++) {
        spheresArray[i * 8 + p] = this.spheres[i].position[p]
      }
      spheresArray[i * 8 + 3] = this.spheres[i].radius
      spheresArray[i * 8 + 4] = this.spheres[i].materialIndex
    }

    this.sphereBuffer = new Float32Array(spheresArray)
  }

  updateTriangleBuffer = () => {
    let count = 100
    let offset = 8
    let triangleArray = new Array(offset * count).fill(0)

    for (let i = 0; i < this.triangles.length; i++) {
      triangleArray[i * offset] = this.triangles[i].v0
      triangleArray[i * offset + 2] = this.triangles[i].v1
      triangleArray[i * offset + 4] = this.triangles[i].v2
    }

    this.triangleBuffer = new Uint16Array(triangleArray)
  }

  updateVertexBuffer = () => {
    let count = 100
    let offset = 4
    let vertexArray = new Array(offset * count).fill(0)

    for (let i = 0; i < this.vertices.length; i++) {
      vertexArray[i * offset] = this.vertices[i].v[0]
      vertexArray[i * offset + 1] = this.vertices[i].v[1]
      vertexArray[i * offset + 2] = this.vertices[i].v[2]
    }

    this.vertexBuffer = new Float32Array(vertexArray)
  }
}
