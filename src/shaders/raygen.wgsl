const SPHERE_COUNT = 13;

struct Sphere {
    pos: vec3<f32>,
    r: f32,
    albedo: vec3<f32>,
    padding: f32
}

@group(0) @binding(0) var<storage, read_write> pixelColors: array<vec3<f32>>;
@group(0) @binding(1) var<uniform> screenResolution: vec2<f32>;
@group(0) @binding(2) var<uniform> rayOrigin: vec3<f32>;
@group(0) @binding(3) var<uniform> inverseProjection: mat4x4<f32>;
@group(0) @binding(4) var<uniform> inverseView: mat4x4<f32>;
@group(0) @binding(5) var<uniform> spheres: array<Sphere, SPHERE_COUNT>;
@group(0) @binding(6) var<uniform> lightDir: vec3<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    if (global_id.x > u32(screenResolution.x * screenResolution.y)) {
        pixelColors[global_id.x] = vec3(0, 0,1);
        return;
    }
    let coords = vec2<f32>(f32(global_id.x % u32(screenResolution.x)),
                            f32(global_id.x / u32(screenResolution.x)));

    let uv = 2 * vec2(1., -1.) * 
        (
            (coords.xy * vec2(screenResolution.x/screenResolution.y,1.)) 
            / screenResolution
        )
        + vec2(-1.,1.);

    let targ = inverseProjection * vec4(uv.x, uv.y,1,1);
    let rayDirection = (inverseView *
                        vec4(normalize(vec3(targ.xyz) / targ.w), 0)
                        ).xyz;

    var hitDistance : f32 = 0x1.fffffep+127f;
    var pixel = vec4(0.,0.,0.,0.);
    var hitSomething = false;
    for (var i = 0u; i < SPHERE_COUNT; i++) {
        let sphere = spheres[i];
        let rayOrigin = rayOrigin - sphere.pos;

        let a = dot(rayDirection, rayDirection);
        let b = 2* dot(rayOrigin, rayDirection);
        let c = dot(rayOrigin, rayOrigin) - sphere.r * sphere.r;

        var descriminant = b * b - 4 * a * c;

        if (descriminant < 0) {
            continue;
        }

        let t0 = (-b + sqrt(descriminant))/(2.*a);
        let t1 = (-b - sqrt(descriminant))/(2.*a);

        if (t1 < hitDistance && t1 >=0) {
            hitSomething = true;
            hitDistance = t1;
            let hit0 = rayOrigin + rayDirection * t0;
            let hit1 = rayOrigin + rayDirection * t1;
            let normal = normalize(hit1 - sphere.pos);
            let d = max(dot(normal, -normalize(lightDir)), 0.);
            pixel = vec4(sphere.albedo * d, 1.);
        } 

    }
    if (hitSomething) {
        pixelColors[global_id.x] = pixel.xyz; // draw sphere
        return;
    }
    pixelColors[global_id.x] = vec3(0.5,  0.75,  0.95); // draw background
}
