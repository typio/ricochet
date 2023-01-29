struct Sphere {
    pos: vec3<f32>,
    r: f32,
}

@group(0) @binding(0) var<uniform> screenResolution: vec2<f32>;
@group(0) @binding(1) var<uniform> rayOrigin: vec3<f32>;
@group(0) @binding(2) var<uniform> sphere: Sphere;

struct VertexOutput {
    @builtin(position) pos: vec4<f32>,
    @location(0) screenResolution: vec2<f32>,
    @location(1) rayOrigin: vec3<f32>,
    @location(2) spherePos: vec3<f32>,
    @location(3) sphereR: f32,
};

@vertex
fn vs_main(
        @location(0) inPos: vec3<f32>)
         -> VertexOutput {
    var out: VertexOutput;
    out.pos = vec4<f32>(inPos, 1.0);
    out.screenResolution = screenResolution;
    out.rayOrigin = rayOrigin;
    out.spherePos = sphere.pos;
    out.sphereR = sphere.r;
    return out;
}

@fragment
fn fs_main(@builtin(position) coords: vec4<f32>,
        @location(0) screenResolution: vec2<f32>,
        @location(1) rayOrigin: vec3<f32>,
        @location(2) spherePos: vec3<f32>,
        @location(3) sphereR: f32,
        ) -> @location(0) vec4<f32> {
    
    let uv = 2 * vec2<f32>(1., -1.) * (coords.xy / screenResolution) + vec2<f32>(-1.,1.);

    // return vec4(uv,0.,0.);
    let rayDirection = normalize(vec3<f32>(uv.x,uv.y,-1.));
    // let b = dot(rayOrigin, rayDirection);
    // let c = dot(rayOrigin, rayOrigin) - sphereR * sphereR;
    let a = dot(rayDirection, rayDirection);
    let b = 2 * (
        rayDirection.x * (rayOrigin.x - spherePos.x) +
        rayDirection.y * (rayOrigin.y - spherePos.y) +
        rayDirection.z * (rayOrigin.z - spherePos.z));
    let c = dot(rayOrigin, rayOrigin) +
        2 * (rayOrigin.x * spherePos.x + rayOrigin.y * spherePos.y + rayOrigin.z * spherePos.z) +
        dot(spherePos, spherePos) - sphereR * sphereR;


    let descriminant = b*b - 4 * a * c;
    if (descriminant >= 0) {
        let solution1 = (-b + sqrt(descriminant))/(2*a);
        let solution2 = (-b - sqrt(descriminant))/(2*a);

        return vec4(1.,0.95,0.,1.) * solution1 / 6; // draw circle
    } else {
        return vec4(0.5,  0.75,  0.95,  1.); // draw background
    }
}
