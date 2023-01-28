import * as _webgpu_types from "@webgpu/types";

import shaderWGSL from "./shader.wgsl?raw";

let rayEmitterVector = new Float32Array([3, 3, 0, 1, 1, 0]);

let spherePosition = new Float32Array([0, 0, 0, 2]);

export default class Renderer {
    canvas: HTMLCanvasElement;

    adapter: GPUAdapter;
    device: GPUDevice;
    queue: GPUQueue;

    context: GPUCanvasContext;
    colorTexture: GPUTexture;
    colorTextureView: GPUTextureView;
    depthTexture: GPUTexture;
    depthTextureView: GPUTextureView;

    positionBuffer: GPUBuffer;
    rayEmitterBuffer: GPUBuffer;
    spherePositionBuffer: GPUBuffer;
    shaderModule: GPUShaderModule;
    pipeline: GPURenderPipeline;

    commandEncoder: GPUCommandEncoder;
    passEncoder: GPURenderPassEncoder;

    constructor(canvas) {
        this.canvas = canvas;
    }

    async start() {
        if (await this.initializeAPI()) {
            this.resizeBackings();
            await this.initializeResources();
            this.render();
        }
    }

    async initializeAPI(): Promise<boolean> {
        try {
            const entry: GPU = navigator.gpu;
            if (!entry) {
                return false;
            }

            this.adapter = await entry.requestAdapter();

            this.device = await this.adapter.requestDevice();

            this.queue = this.device.queue;
        } catch (e) {
            console.error(e);
            return false;
        }

        return true;
    }

    async initializeResources() {
        const createBuffer = (
            arr: Float32Array | Uint16Array,
            usage: number,
            label?: string
        ) => {
            let desc = {
                label,
                size: (arr.byteLength + 3) & ~3,
                usage,
                mappedAtCreation: true,
            };
            let buffer = this.device.createBuffer(desc);
            const writeArray =
                arr instanceof Uint16Array
                    ? new Uint16Array(buffer.getMappedRange())
                    : new Float32Array(buffer.getMappedRange());
            writeArray.set(arr);
            buffer.unmap();
            return buffer;
        };

        this.indexBuffer = createBuffer(
            new Uint16Array([0, 1, 2]),
            GPUBufferUsage.INDEX
        );
        this.positionBuffer = createBuffer(
            new Float32Array([3.0, -3.0, 0.0, -3.0, -3.0, 0.0, 0.0, 3.0, 0.0]),
            GPUBufferUsage.VERTEX,
            "Position Buffer"
        );
        this.rayEmitterBuffer = createBuffer(
            rayEmitterVector,
            GPUBufferUsage.UNIFORM,
            "Ray Emitter Vector"
        );
        this.spherePositionBuffer = createBuffer(
            spherePosition,
            GPUBufferUsage.UNIFORM,
            "Sphere Position Buffer"
        );

        const shaderDesc = {
            code: shaderWGSL,
        };
        this.shaderModule = this.device.createShaderModule(shaderDesc);

        const positionAttribDesc: GPUVertexAttribute = {
            shaderLocation: 0,
            offset: 0,
            format: "float32x3",
        };
        const rayEmitterVectorAttribDesc: GPUVertexAttribute = {
            shaderLocation: 1,
            offset: 0,
            format: "float32x3",
        };
        const spherePositionAttribDesc: GPUVertexAttribute = {
            shaderLocation: 2,
            offset: 0,
            format: "float32x4",
        };

        const positionBufferDesc: GPUVertexBufferLayout = {
            attributes: [positionAttribDesc],
            arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
            stepMode: "vertex",
        };
        const rayEmitterVectorBufferDesc: GPUVertexBufferLayout = {
            attributes: [rayEmitterVectorAttribDesc],
            arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
            stepMode: "vertex",
        };
        const spherePositionBufferDesc: GPUVertexBufferLayout = {
            attributes: [spherePositionAttribDesc],
            arrayStride: 4 * Float32Array.BYTES_PER_ELEMENT,
            stepMode: "vertex",
        };

        const depthStencil: GPUDepthStencilState = {
            depthWriteEnabled: true,
            depthCompare: "less",
            format: "depth24plus-stencil8",
        };

        const pipelineLayoutDesc = { bindGroupLayouts: [] };
        const layout = this.device.createPipelineLayout(pipelineLayoutDesc);

        const vertex: GPUVertexState = {
            module: this.shaderModule,
            entryPoint: "vs_main",
            buffers: [positionBufferDesc],
        };

        const colorState: GPUColorTargetState = {
            format: "bgra8unorm",
        };

        const fragment: GPUFragmentState = {
            module: this.shaderModule,
            entryPoint: "fs_main",
            targets: [colorState],
        };

        const primitive: GPUPrimitiveState = {
            frontFace: "ccw",
            cullMode: "none",
            topology: "triangle-list",
        };

        const pipelineDesc: GPURenderPipelineDescriptor = {
            layout,

            vertex,
            fragment,

            primitive,
            depthStencil,
        };
        this.pipeline = await this.device.createRenderPipelineAsync(pipelineDesc);
    }

    resizeBackings() {
        if (!this.context) {
            this.context = this.canvas.getContext("webgpu");
            const canvasConfig: GPUCanvasConfiguration = {
                device: this.device,
                format: "bgra8unorm",
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
                alphaMode: "opaque",
            };
            this.context.configure(canvasConfig);
        }

        const depthTextureDesc: GPUTextureDescriptor = {
            size: [this.canvas.width, this.canvas.height, 1],
            dimension: "2d",
            format: "depth24plus-stencil8",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        };

        this.depthTexture = this.device.createTexture(depthTextureDesc);
        this.depthTextureView = this.depthTexture.createView();
    }

    encodeCommands() {
        let colorAttachment: GPURenderPassColorAttachment = {
            view: this.colorTextureView,
            clearValue: { r: 0.5, g: 0.75, b: 0.95, a: 1 },
            loadOp: "clear",
            storeOp: "store",
        };

        const depthAttachment: GPURenderPassDepthStencilAttachment = {
            view: this.depthTextureView,
            depthClearValue: 1,
            depthLoadOp: "clear",
            depthStoreOp: "store",
            stencilClearValue: 0,
            stencilLoadOp: "clear",
            stencilStoreOp: "store",
        };

        const renderPassDesc: GPURenderPassDescriptor = {
            colorAttachments: [colorAttachment],
            depthStencilAttachment: depthAttachment,
        };

        this.commandEncoder = this.device.createCommandEncoder();

        this.passEncoder = this.commandEncoder.beginRenderPass(renderPassDesc);
        this.passEncoder.setPipeline(this.pipeline);
        this.passEncoder.setViewport(
            0,
            0,
            this.canvas.width,
            this.canvas.height,
            0,
            1
        );
        this.passEncoder.setScissorRect(
            0,
            0,
            this.canvas.width,
            this.canvas.height
        );
        this.passEncoder.setVertexBuffer(0, this.positionBuffer);
        this.passEncoder.draw(3, 1, 0, 0);
        this.passEncoder.end();

        this.queue.submit([this.commandEncoder.finish()]);
    }

    render = () => {
        this.colorTexture = this.context.getCurrentTexture();
        this.colorTextureView = this.colorTexture.createView();

        this.encodeCommands();

        requestAnimationFrame(this.render);
    };
}
