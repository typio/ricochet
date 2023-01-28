struct Sphere {
    position: vec3<f32>,
    radius: f32
}

struct VertexOutput {
    @builtin(position) pos: vec4<f32>,
    @location(0) cameraPos: vec3<f32>,
    @location(1) cameraDir: vec3<f32>,
    @location(2) sphere: vec4<f32>,
};

@vertex
fn vs_main(
        @location(0) inPos: vec3<f32>)
         -> VertexOutput {
    var out: VertexOutput;
    out.pos =  vec4<f32>(inPos, 1.0);
    out.cameraPos = vec3(-3.,-3.,0.);
    out.cameraDir = vec3(1.,1.,0.);
    out.sphere = vec4(0.,0.,0.,2.);
    return out;
}



@fragment
fn fs_main(@builtin(position) coords: vec4<f32>,
        @location(0) cameraPos: vec3<f32>,
        @location(1) cameraDir: vec3<f32>,
        @location(2) sphere: vec4<f32>,
        ) -> @location(0) vec4<f32> {
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
