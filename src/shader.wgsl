struct Sphere {
    pos: vec3<f32>,
    r: f32,
}

@group(0) @binding(0) var<uniform> screenResolution: vec2<f32>;
@group(0) @binding(1) var<uniform> rayOrigin: vec3<f32>;
@group(0) @binding(2) var<uniform> inverseProjection: mat4x4<f32>;
@group(0) @binding(3) var<uniform> inverseView: mat4x4<f32>;
@group(0) @binding(4) var<uniform> sphere: Sphere;
@group(0) @binding(5) var<uniform> lightDir: vec3<f32>;

struct VertexOutput {
    @builtin(position) pos: vec4<f32>,
};

@vertex
fn vs_main(
        @location(0) inPos: vec3<f32>)
         -> VertexOutput {
    var out: VertexOutput;
    out.pos = vec4<f32>(inPos, 1.0);
    return out;
}

@fragment
fn  fs_main(@builtin(position) coords: vec4<f32>,
        ) -> @location(0) vec4<f32> {

    let uv = 2 * vec2(1., -1.) * ((coords.xy * vec2(screenResolution.x/screenResolution.y,1.)) / screenResolution) + vec2(-1.,1.);

    let targ = inverseProjection * vec4(uv.x, uv.y,1,1);
    // return vec4(uv,0.,0.);
    let rayDirection = (inverseView * vec4(normalize(vec3(targ.xyz) / targ.w),0)).xyz;

    
    // let b = dot(rayOrigin, rayDirection);
    // let c = dot(rayOrigin, rayOrigin) - sphere.r * sphere.r;
    let a = dot(rayDirection, rayDirection);
    let b = 2 * (
        rayDirection.x * (rayOrigin.x - sphere.pos.x) +
        rayDirection.y * (rayOrigin.y - sphere.pos.y) +
        rayDirection.z * (rayOrigin.z - sphere.pos.z));
    let c = dot(rayOrigin, rayOrigin) +
        2 * (rayOrigin.x * sphere.pos.x + rayOrigin.y * sphere.pos.y + rayOrigin.z * sphere.pos.z) +
        dot(sphere.pos, sphere.pos) - sphere.r * sphere.r;


    var descriminant = b*b - 4 * a * c;

    if (descriminant < 0) {
        return vec4(0.5,  0.75,  0.95,  1.); // draw background
        }

    let t0 = (-b + sqrt(descriminant))/(2.*a);
    let t1 = (-b - sqrt(descriminant))/(2.*a);

    let hit0 = rayOrigin + rayDirection * t0;
    let hit1 = rayOrigin + rayDirection * t1;

    let normal = normalize(hit1 - sphere.pos);

    let d = max(dot(normal, -normalize(lightDir)), 0.);
    return vec4(d * vec3(1., .95, 0.), 1.); // draw circle
}
