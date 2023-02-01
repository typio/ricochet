const SPHERE_COUNT = 13;

struct Camera {
    // position: vec3<f32>,
    // right: vec3<f32>    // u
    // up: vec3<f32>,      // v
    // forward: vec3<f32>, // w

    inverse_projection: mat4x4<f32>,
    inverse_view: mat4x4<f32>,
}

struct Sphere {
    pos: vec3<f32>,
    r: f32,
    albedo: vec3<f32>,
    padding: f32
}

@group(0) @binding(0) var<storage, read_write> pixelColors: array<vec3<f32>>;
@group(0) @binding(1) var<uniform> screenResolution: vec2<f32>;
@group(0) @binding(2) var<uniform> rayOrigin: vec3<f32>;
@group(0) @binding(3) var<uniform> camera: Camera;
@group(0) @binding(4) var<uniform> spheres: array<Sphere, SPHERE_COUNT>;
@group(0) @binding(5) var<uniform> lightDir: vec3<f32>;


// @group(0) @binding(0) var<storage, read_write> pixelColors: array<vec3<f32>>;
// @group(0) @binding(1) var<uniform> screenResolution: vec2<f32>;
// @group(0) @binding(2) var<uniform> camera: Camera;
// @group(0) @binding(5) var<uniform> spheres: array<Sphere, SPHERE_COUNT>;
// @group(0) @binding(6) var<uniform> lightDir: vec3<f32>;

struct Ray {
    origin: vec3<f32>,
    direction: vec3<f32>
}

struct RayPayload {
    color: vec3<f32>,
}

// try using <workgroup>? https://www.w3.org/TR/WGSL/#compute-shader-workgroups
fn calculate_ray_direction(coordinate: vec2<f32>) -> vec4<f32> {
    let current_pixel = coordinate;
    let pixel_center = (current_pixel + vec2(.5, .5)) / screenResolution;

    // stands for normalized device coordinate
    let ndc: vec2<f32> = vec2(2., -2.) * pixel_center + vec2(-1., 1.)
    let ray_target: vec4<f32> = camera.inverse_projection * vec4<f32>(ndc.x, ndc.y, 1., 1.);
    let pixel_ray_direction: vec4<f32> = camera.inverse_view * vec4<f32>(
        normalize(vec3<f32>(ray_target.xyz) / ray_target.w),
        0.
    );

    return pixel_ray_direction;
    
    // let uv: vec2<f32> = 2. * vec2(1., -1.) * ((coords.xy * 
    //     vec2(screenResolution.x/screenResolution.y,1.)) / screenResolution)
    //     + vec2(-1.,1.);

    // let targ = inverseProjection * vec4(uv.x, uv.y,1,1);
    // let rayDirection = (inverseView *
    //                     vec4(normalize(vec3(targ.xyz) / targ.w), 0)
    //                     ).xyz;
}

fn trace_ray() {
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    if global_id.x > u32(screenResolution.x * screenResolution.y) {
        pixelColors[global_id.x] = vec3(0, 0, 1);
        return;
    }
    let coords = vec2<f32>(f32(global_id.x % u32(screenResolution.x)), f32(global_id.x / u32(screenResolution.x)));
    let rayDirection = calculate_ray_direction(coords);


    var hitDistance: f32 = 0x1.fffffep+127f;
    var pixel = vec4(0., 0., 0., 0.);
    var hitSomething = false;
    for (var i = 0u; i < SPHERE_COUNT; i++) {
        let sphere = spheres[i];
        let rayOrigin = rayOrigin - sphere.pos;

        let a = dot(rayDirection, rayDirection);
        let b = 2 * dot(rayOrigin, rayDirection);
        let c = dot(rayOrigin, rayOrigin) - sphere.r * sphere.r;

        var descriminant = b * b - 4 * a * c;

        if descriminant < 0 {
            continue;
        }

        let t0 = (-b + sqrt(descriminant)) / (2. * a);
        let t1 = (-b - sqrt(descriminant)) / (2. * a);

        if t1 < hitDistance && t1 >= 0 {
            hitSomething = true;
            hitDistance = t1;
            let hit0 = rayOrigin + rayDirection * t0;
            let hit1 = rayOrigin + rayDirection * t1;
            let normal = normalize(hit1 - sphere.pos);
            let d = max(dot(normal, -normalize(lightDir)), 0.);
            pixel = vec4(sphere.albedo * d, 1.);
        }
    }
    if hitSomething {
        pixelColors[global_id.x] = pixel.xyz; // draw sphere
        return;
    }
    pixelColors[global_id.x] = vec3(0.5, 0.75, 0.95); // draw background
}
