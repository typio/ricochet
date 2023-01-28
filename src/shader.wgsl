struct Sphere {
    position: vec3<f32>,
    radius: f32
}

struct VertexOutput {
    @builtin(position) pos: vec4<f32>,
    @location(0) cameraPos: vec3<f32>,
    @location(1) cameraDir: vec3<f32>,
    @location(2) sphere: vec4<f32>,
    @location(3) screenResolution: vec2<f32>,
};

struct UBO {
    screenResolution: vec2<f32>,
    cameraPos: vec3<f32>,
    cameraDir: vec3<f32>,
    sphere: vec4<f32>,

}

@group(0) @binding(0)
var<uniform> uniforms: UBO;

@vertex
fn vs_main(
        @location(0) inPos: vec3<f32>)
         -> VertexOutput {
    var out: VertexOutput;
    out.pos =  vec4<f32>(inPos, 1.0);
    out.cameraPos = uniforms.cameraPos;
    out.cameraDir = uniforms.cameraDir;
    out.sphere = uniforms.sphere;
    out.screenResolution = uniforms.screenResolution;
    return out;
}

@fragment
fn fs_main(@builtin(position) coords: vec4<f32>,
        @location(0) cameraPos: vec3<f32>,
        @location(1) cameraDir: vec3<f32>,
        @location(2) sphere: vec4<f32>,
        @location(3) screenResolution: vec2<f32>,
        ) -> @location(0) vec4<f32> {
    let uv = vec2<f32>(1.,-1.) * (coords.xy/ screenResolution) + vec2<f32>(0.,1.);

    return vec4(uv,0.,0.);
    let cameraRay = cameraPos - coords.xyz;
    let a = cameraRay.x * cameraRay.x + cameraRay.y * cameraRay.y;
    let b = 2 * cameraPos.x * cameraRay.x + 2 * cameraPos.y * cameraRay.y;
    let c = cameraPos.x * cameraPos.x + cameraPos.y * cameraPos.y - sphere.w;
    if (b*b - 4 * a * c >= 0) {
        return vec4(0.,0.,1.,1.); // draw circle
    } else {
        return vec4(0.5,  0.75,  0.95,  1.); // draw background
    }
}
