// @ts-ignore
import * as _webgpu_types from "@webgpu/types";

import Camera from "./camera";
import shaderWGSL from "./shader.wgsl?raw";

export default class Renderer {
    canvas: HTMLCanvasElement;
    camera: Camera;

    adapter: GPUAdapter;
    device: GPUDevice;
    queue: GPUQueue;

    context: GPUCanvasContext;
    colorTexture: GPUTexture;
    colorTextureView: GPUTextureView;
    depthTexture: GPUTexture;
    depthTextureView: GPUTextureView;

    sphere: Float32Array;
    lightDir: Float32Array;

    positionBuffer: GPUBuffer;
    rayOriginBuffer: GPUBuffer;
    inverseProjectionBuffer: GPUBuffer;
    inverseViewBuffer: GPUBuffer;
    sphereBuffer: GPUBuffer;
    lightDirBuffer: GPUBuffer;
    screenResolutionBuffer: GPUBuffer;
    uniformBindGroup: GPUBindGroup;
    uniformBindGroupLayout: GPUBindGroupLayout;
    shaderModule: GPUShaderModule;
    pipeline: GPURenderPipeline;

    commandEncoder: GPUCommandEncoder;
    passEncoder: GPURenderPassEncoder;

    constructor(canvas: HTMLCanvasElement, camera: Camera) {
        this.canvas = canvas;
        this.camera = camera;
    }

    async start() {
        if (await this.initializeAPI()) {
            window.addEventListener("resize", () => {
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;
                this.resizeBackings();
            });
            await this.initializeResources();
            this.resizeBackings();
            this.render();
        }
    }

    async initializeAPI(): Promise<boolean> {
        try {
            const entry: GPU = navigator.gpu;
            if (!entry) {
                alert(
                    "Failed to connect to GPU, please try Chrome browser if you aren't using it already."
                );
                return false;
            }

            this.adapter = ((adapter) => {
                if (adapter === null) throw new Error("Failed to get adapter");
                else return adapter;
            })(await entry.requestAdapter());

            this.device = await this.adapter.requestDevice();

            this.queue = this.device.queue;
        } catch (e) {
            console.error(e);
            return false;
        }

        return true;
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

    setUniforms = () => {
        this.screenResolutionBuffer = this.createBuffer(
            new Float32Array([this.canvas.width, this.canvas.height]),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            undefined,
            "Screen Resolution Buffer"
        );
        this.rayOriginBuffer = this.createBuffer(
            this.camera.position as Float32Array,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            undefined,
            "Camera Position Buffer"
        );
        this.inverseProjectionBuffer = this.createBuffer(
            this.camera.inverseProjection as Float32Array,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            undefined,
            "Inverse Projection Buffer"
        );
        this.inverseViewBuffer = this.createBuffer(
            this.camera.inverseView as Float32Array,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            undefined,
            "Inverse View Buffer"
        );
        this.sphereBuffer = this.createBuffer(
            this.sphere,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            undefined,
            "Sphere Position Buffer"
        );
        this.lightDirBuffer = this.createBuffer(
            this.lightDir,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            undefined,
            "Camera Position Buffer"
        );

        this.uniformBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {},
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {},
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {},
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {},
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {},
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {},
                },
            ],
        });

        this.uniformBindGroup = this.device.createBindGroup({
            layout: this.uniformBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.screenResolutionBuffer,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.rayOriginBuffer,
                    },
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this.inverseProjectionBuffer,
                    },
                },
                {
                    binding: 3,
                    resource: {
                        buffer: this.inverseViewBuffer,
                    },
                },
                {
                    binding: 4,
                    resource: {
                        buffer: this.sphereBuffer,
                    },
                },
                {
                    binding: 5,
                    resource: {
                        buffer: this.lightDirBuffer,
                    },
                },
            ],
        });
    };

    async initializeResources() {
        this.positionBuffer = this.createBuffer(
            new Float32Array([3.0, -3.0, 0.0, -3.0, -3.0, 0.0, 0.0, 3.0, 0.0]),
            GPUBufferUsage.VERTEX,
            undefined,
            "Position Buffer"
        );

        this.sphere = new Float32Array([0, 0, 0, 2]);

        this.lightDir = new Float32Array([-1, -1, -1]);

        const shaderDesc = {
            code: shaderWGSL,
        };
        this.shaderModule = this.device.createShaderModule(shaderDesc);

        const positionAttribDesc: GPUVertexAttribute = {
            shaderLocation: 0,
            offset: 0,
            format: "float32x3",
        };

        const positionBufferDesc: GPUVertexBufferLayout = {
            attributes: [positionAttribDesc],
            arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
            stepMode: "vertex",
        };

        const depthStencil: GPUDepthStencilState = {
            depthWriteEnabled: true,
            depthCompare: "less",
            format: "depth24plus-stencil8",
        };

        this.setUniforms();

        const pipelineLayoutDesc = {
            bindGroupLayouts: [this.uniformBindGroupLayout],
        };
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
            this.context = ((context) => {
                if (context === null) throw new Error("Failed to get canvas context");
                else return context;
            })(this.canvas.getContext("webgpu"));
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
        this.setUniforms();
    }

    encodeCommands() {
        let colorAttachment: GPURenderPassColorAttachment = {
            view: this.colorTextureView,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
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
        this.passEncoder.setBindGroup(0, this.uniformBindGroup);
        this.passEncoder.draw(3, 1, 0, 0);
        this.passEncoder.end();

        this.queue.submit([this.commandEncoder.finish()]);
    }
    startTime = Date.now();

    perfTime = performance.now();
    render = () => {
        // let dx = Math.cos((Date.now() - this.startTime) / 300) * 2 - 1;
        // let dy = Math.sin((Date.now() - this.startTime) / 200) * 2 - 1;
        // let dz = Math.sin((Date.now() - this.startTime) / 400) / 5;
        // this.sphere = new Float32Array([1 + dx, 1 + dy, -0.1 + dz, 1.5]);
        this.sphere = new Float32Array([0, 0, 0, 1.5]);
        this.setUniforms();
        this.colorTexture = this.context.getCurrentTexture();
        this.colorTextureView = this.colorTexture.createView();

        this.encodeCommands();

        requestAnimationFrame(this.render);
        let newPerfTime = performance.now();
        // console.log(`${(1000 / (newPerfTime - this.perfTime)).toFixed(3)}fps`);
        this.perfTime = newPerfTime;
    };
}
