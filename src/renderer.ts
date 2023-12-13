// @ts-ignore
import * as _webgpu_types from '@webgpu/types'

import Camera from './camera'
import Scene from './scene'
import renderWGSL from './shaders/render.wgsl?raw'
import raygenWGSL from './shaders/raygen.wgsl?raw'

export default class Renderer {
  canvas: HTMLCanvasElement
  scene: Scene
  camera: Camera
  running: Boolean

  adapter: GPUAdapter
  device: GPUDevice
  queue: GPUQueue

  context: GPUCanvasContext

  colorTexture: GPUTexture
  colorTextureView: GPUTextureView

  depthTexture: GPUTexture
  depthTextureView: GPUTextureView

  accumulations: number

  accumulationsBuffer: GPUBuffer
  accumulationColorsBuffer: GPUBuffer
  rayOriginBuffer: GPUBuffer
  cameraBuffer: GPUBuffer
  materialsBuffer: GPUBuffer
  sphereBuffer: GPUBuffer
  scenePropsBuffer: GPUBuffer
  screenResolutionBuffer: GPUBuffer
  pixelColorsBuffer: GPUBuffer
  randomSeedBuffer: GPUBuffer

  uniformBindGroup: GPUBindGroup
  uniformBindGroupLayout: GPUBindGroupLayout

  computeBindGroup: GPUBindGroup
  computeBindGroupLayout: GPUBindGroupLayout
  computePipeline: GPUComputePipeline

  renderBindGroup: GPUBindGroup
  renderBindGroupLayout: GPUBindGroupLayout
  renderPipeline: GPURenderPipeline

  commandEncoder: GPUCommandEncoder

  sceneProps: {
    [key: string]: any
  }

  constructor(canvas: HTMLCanvasElement, scene: Scene, camera: Camera) {
    this.canvas = canvas
    this.scene = scene
    this.camera = camera

    this.accumulations = 0

    this.sceneProps = {
      sunIntensity: 0,
      spheres: 40,
      rayOffset: 0,
      rayBounces: 4,
    }
  }

  start = async () => {
    this.running = true
    if (await this.initializeAPI()) {
      Object.keys(this.sceneProps).forEach((inputId) => {
        let inputElement = document.getElementById(inputId) as HTMLInputElement
        let inputValueElement = document.getElementById(inputId + 'Value')
        if (inputValueElement)
          inputValueElement.innerText = this.sceneProps[inputId]
        inputElement.value = this.sceneProps[inputId]
        if (inputElement) {
          inputElement.addEventListener('input', (e) => {
            let target = e.target as HTMLInputElement
            this.sceneProps[inputId] = Number(target?.value)

            let inputValueElement = document.getElementById(inputId + 'Value')
            if (inputValueElement)
              inputValueElement.innerText = this.sceneProps[inputId]

            // WARN: LOL BAD hack pls fix
            if (inputId == 'sunIntensity') {
              this.scene.materialsBuffer[11] = (Number(target.value) / 100) ** 2
            }
            this.accumulations = 0
          })
        }
      })

      window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyP') {
          this.running = !this.running
          if (this.running) {
            this.frame()
          }
        }
      })
      window.addEventListener('resize', () => {
        this.canvas.width = window.innerWidth
        this.canvas.height = window.innerHeight
        this.resizeBackings()
      })
      await this.initializeResources()
      this.resizeBackings()
      this.frame()
    }
  }

  initializeAPI = async (): Promise<boolean> => {
    try {
      const entry: GPU = navigator.gpu
      if (!entry) {
        alert(
          "Failed to connect to GPU, please try Chrome browser if you aren't using it already."
        )
        return false
      }

      this.adapter = ((adapter) => {
        if (adapter === null) throw new Error('Failed to get adapter')
        else return adapter
      })(await entry.requestAdapter())

      this.device = await this.adapter.requestDevice()

      this.queue = this.device.queue
    } catch (e) {
      console.error(e)
      return false
    }

    return true
  }

  createBuffer = (
    arr: Float32Array | Uint16Array,
    usage: number,
    size?: number,
    label?: string
  ) => {
    let desc = {
      label,
      size: size ?? (arr.byteLength + 3) & ~3,
      usage,
      mappedAtCreation: true,
    }
    let buffer = this.device.createBuffer(desc)
    const writeArray =
      arr instanceof Uint16Array
        ? new Uint16Array(buffer.getMappedRange())
        : new Float32Array(buffer.getMappedRange())
    writeArray.set(arr)
    buffer.unmap()
    return buffer
  }

  initializeResources = async () => {
    // COMPUTE
    this.pixelColorsBuffer = this.createBuffer(
      new Float32Array([]),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      this.canvas.width *
        this.canvas.height *
        4 *
        Float32Array.BYTES_PER_ELEMENT,
      'Pixel Colors Buffer'
    )
    this.accumulationColorsBuffer = this.createBuffer(
      new Float32Array([]),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      this.canvas.width *
        this.canvas.height *
        4 *
        Float32Array.BYTES_PER_ELEMENT,
      'Pixel Colors Buffer'
    )
    this.setComputeBindGroup()

    const raygenShaderModule = this.device.createShaderModule({
      code: raygenWGSL,
    })

    const computePipelineLayoutDesc = {
      bindGroupLayouts: [this.computeBindGroupLayout],
    }
    const computeLayout = this.device.createPipelineLayout(
      computePipelineLayoutDesc
    )
    this.computePipeline = await this.device.createComputePipelineAsync({
      layout: computeLayout,
      compute: { module: raygenShaderModule, entryPoint: 'main' },
    })

    //RENDER
    const renderShaderModule = this.device.createShaderModule({
      code: renderWGSL,
    })

    this.setRenderBindGroup()

    const renderPipelineLayoutDesc = {
      bindGroupLayouts: [this.renderBindGroupLayout],
    }
    const renderLayout = this.device.createPipelineLayout(
      renderPipelineLayoutDesc
    )

    const vertex: GPUVertexState = {
      module: renderShaderModule,
      entryPoint: 'vs_main',
    }

    const colorState: GPUColorTargetState = {
      format: 'bgra8unorm',
    }

    const fragment: GPUFragmentState = {
      module: renderShaderModule,
      entryPoint: 'fs_main',
      targets: [colorState],
    }

    const primitive: GPUPrimitiveState = {
      frontFace: 'ccw',
      cullMode: 'none',
      topology: 'triangle-list',
    }
    const renderPipelineDesc: GPURenderPipelineDescriptor = {
      layout: renderLayout,

      vertex,
      fragment,

      primitive,
    }
    this.renderPipeline =
      await this.device.createRenderPipelineAsync(renderPipelineDesc)
  }

  resizeBackings = () => {
    if (!this.context) {
      this.context = ((context) => {
        if (context === null) throw new Error('Failed to get canvas context')
        else return context
      })(this.canvas.getContext('webgpu'))
      const canvasConfig: GPUCanvasConfiguration = {
        device: this.device,
        format: 'bgra8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        alphaMode: 'opaque',
      }
      this.context.configure(canvasConfig)
    }
  }

  setComputeBindGroup = () => {
    this.screenResolutionBuffer = this.createBuffer(
      new Float32Array([this.canvas.width, this.canvas.height]),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      undefined,
      'Screen Resolution Buffer'
    )
    this.rayOriginBuffer = this.createBuffer(
      new Float32Array(this.camera.position),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      undefined,
      'Ray Origin Buffer'
    )
    this.cameraBuffer = this.createBuffer(
      new Float32Array(
        // @ts-ignore
        this.camera.inverseProjection.concat(this.camera.inverseView)
      ),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      undefined,
      'Camera Buffer'
    )
    this.materialsBuffer = this.createBuffer(
      new Float32Array(this.scene.materialsBuffer),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      undefined,
      'Material Buffer'
    )
    this.sphereBuffer = this.createBuffer(
      new Float32Array(this.scene.spheresBuffer),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      undefined,
      'Sphere Buffer'
    )
    this.scenePropsBuffer = this.createBuffer(
      new Float32Array(Object.values(this.sceneProps)),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      undefined,
      'Scene Props Buffer'
    )
    this.randomSeedBuffer = this.createBuffer(
      new Float32Array([Math.random()]),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      undefined,
      'Random Seed Buffer'
    )
    this.accumulationsBuffer = this.createBuffer(
      new Float32Array([this.accumulations]),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      undefined,
      'Accumulations Buffer'
    )

    this.computeBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
        {
          binding: 6,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
        {
          binding: 7,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
        {
          binding: 8,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
        {
          binding: 9,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' },
        },
      ],
    })

    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computeBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.pixelColorsBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.screenResolutionBuffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: this.rayOriginBuffer,
          },
        },
        {
          binding: 3,
          resource: {
            buffer: this.cameraBuffer,
          },
        },
        {
          binding: 4,
          resource: {
            buffer: this.materialsBuffer,
          },
        },
        {
          binding: 5,
          resource: {
            buffer: this.sphereBuffer,
          },
        },
        {
          binding: 6,
          resource: {
            buffer: this.scenePropsBuffer,
          },
        },
        {
          binding: 7,
          resource: {
            buffer: this.randomSeedBuffer,
          },
        },
        {
          binding: 8,
          resource: {
            buffer: this.accumulationsBuffer,
          },
        },
        {
          binding: 9,
          resource: {
            buffer: this.accumulationColorsBuffer,
          },
        },
      ],
    })
  }

  setRenderBindGroup = () => {
    this.screenResolutionBuffer = this.createBuffer(
      new Float32Array([this.canvas.width, this.canvas.height]),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      undefined,
      'Screen Resolution Buffer'
    )
    this.accumulationsBuffer = this.createBuffer(
      new Float32Array([this.accumulations]),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      undefined,
      'Accumulations Buffer'
    )

    this.renderBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    })

    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.pixelColorsBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.screenResolutionBuffer },
        },
      ],
    })
  }

  computePass = () => {
    // TODO: get clever and only update this stuff when it changes
    this.setComputeBindGroup()
    this.commandEncoder = this.device.createCommandEncoder()
    const passEncoder = this.commandEncoder.beginComputePass()
    passEncoder.setPipeline(this.computePipeline)
    passEncoder.setBindGroup(0, this.computeBindGroup)
    passEncoder.dispatchWorkgroups(
      Math.ceil((this.canvas.width * this.canvas.height) / 64)
    )
    passEncoder.end()
  }

  renderPass = () => {
    this.setRenderBindGroup()
    const passEncoder = this.commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.colorTextureView,
          clearValue: { r: 0, g: 0, b: 1, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })
    passEncoder.setPipeline(this.renderPipeline)
    passEncoder.setBindGroup(0, this.renderBindGroup)
    passEncoder.draw(6, 1, 0, 0)
    passEncoder.end()
  }

  perfTime = performance.now()
  perfTimeLogs: number[] = []
  fpsElement = document.getElementById('fps')
  rendertimeElement = document.getElementById('rendertime')
  accumulationsElement = document.getElementById('accumulations')

  frame = () => {
    this.colorTexture = this.context.getCurrentTexture()
    this.colorTextureView = this.colorTexture.createView()

    this.camera.updatePos()
    // this.scene.updateSpheres();
    this.scene.updateSpheresBuffer()

    this.accumulations++
    if (this.camera.move) {
      this.accumulations = 0
    }


    this.computePass()
    this.renderPass()

    this.queue.submit([this.commandEncoder.finish()])

    if (
      this.fpsElement &&
      this.rendertimeElement &&
      this.accumulationsElement
    ) {
      this.accumulationsElement.innerText = `${this.accumulations} samples`

      let newPerfTime = performance.now()
      this.perfTimeLogs.push(newPerfTime - this.perfTime)

      let averagePerfTime =
        this.perfTimeLogs.reduce((a, b) => a + b) / this.perfTimeLogs.length

      // update DOM text
      this.fpsElement.innerText = `${(1000 / averagePerfTime).toFixed(0)}fps`
      this.rendertimeElement.innerText = `${averagePerfTime.toFixed(
        0
      )}ms render time`

      while (this.perfTimeLogs.length > 25) this.perfTimeLogs.shift()
      this.perfTime = newPerfTime
    }

    if (this.running) requestAnimationFrame(this.frame)
  }
}
